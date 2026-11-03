// Writes test/helioscope-venus-new-york.json: what native Swiss Ephemeris
// computes for Helioscope's proof of concept, Venus from New York around the
// evening of 10 January 2025 (docs/HELIOSCOPE_V1_FEASIBILITY.md §10). The
// tests compare the WebAssembly in extension/vendor/swisseph/ with it. Run it
// by hand, after changing the case; the tests never run it.
//
//   node tools/make-helioscope-reference.mjs <harness>
//
// <harness> is tools/helioscope-native.c built against the C sources of Swiss
// Ephemeris at upstream tag v2.10.3final (https://github.com/aloistr/swisseph),
// the sources @kuntay/swisseph 0.2.2 compiles. The committed values came from
// Apple clang 17 at -O2 on arm64 macOS, the build behind the doc's reference
// values. From the folder holding those sources:
//
//   clang -O2 -I. -o vislim <repository>/tools/helioscope-native.c swecl.c swedate.c swehel.c swehouse.c swejpl.c swemmoon.c swemplan.c sweph.c swephlib.c -lm
//
// The harness reads one command per line and keeps Swiss Ephemeris's state
// from line to line, so each group of calls here runs in a fresh process, as
// each Helioscope engine is a fresh WebAssembly instance. The ephemeris path
// holds no files, as in the WebAssembly, and every call asks for Moshier.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const harness = process.argv[2];
if (!harness) {
  console.error("usage: node tools/make-helioscope-reference.mjs <harness>");
  process.exit(1);
}

const OUT = new URL("../test/helioscope-venus-new-york.json", import.meta.url);
const CASE = { planet: "venus", utc: "2025-01-10T22:35:00Z", lat: 40.7128, lng: -74.006, elevation: 10 };

// swephexp.h
const SEFLG_MOSEPH = 4;
const SE_SUN = 0;
const SE_VENUS = 3;
const SE_BIT_ASTRO_TWILIGHT = 4096;
const RSMI = {
  sunrise: 1,
  sunset: 2,
  "astronomical-dawn": 1 | SE_BIT_ASTRO_TWILIGHT,
  "astronomical-dusk": 2 | SE_BIT_ASTRO_TWILIGHT,
};

const julianDay = (utc) => Date.parse(utc) / 86_400_000 + 2440587.5;
const t = julianDay(CASE.utc);
const place = { lat: CASE.lat, lng: CASE.lng, elevation: CASE.elevation };
const emptyEphemeris = mkdtempSync(join(tmpdir(), "helioscope-ephe-"));

function session(lines) {
  const input = [`ephe ${emptyEphemeris}`, ...lines].join("\n") + "\n";
  const result = spawnSync(harness, [], { input, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${harness} exited ${result.status}: ${result.stderr}`);
  return result.stdout.trim().split("\n").map((line) => JSON.parse(line)).filter((o) => o.cmd !== "ephe");
}

// Atmosphere and observer all 0, so Swiss Ephemeris fills in its defaults;
// only the meteorological range (datm[3]) is ever set here.
const vlm = (jd, { lat, lng, elevation }, range = 0) =>
  `vlm v ${jd} ${lng} ${lat} ${elevation} 0 0 0 ${range} 0 0 ${CASE.planet} ${SEFLG_MOSEPH}`;
const rise = (from, event) =>
  `rise r ${from} ${SE_SUN} ${place.lng} ${place.lat} ${place.elevation} 0 0 ${RSMI[event]} ${SEFLG_MOSEPH}`;

// One swe_vis_limit_mag call. Below the horizon, Swiss Ephemeris sets only
// dret[0], to -100: it zeroes dret[1] to dret[6] and leaves dret[7] as the
// caller left it, so only dret[0] is kept. Otherwise it writes dret[0] to
// dret[7] (§8, item 1).
function call(o) {
  if (o.dret.slice(0, 8).some((v) => typeof v !== "number")) throw new Error(`not finite: ${JSON.stringify(o)}`);
  return { ret: o.ret, dret: o.ret === -2 ? [o.dret[0]] : o.dret.slice(0, 8), serr: o.serr };
}
const filledIn = (o) => ({ datm: o.datm_after, dobs: o.dobs_after, object: o.object_after });

// The windows of §6: sunset to the end of astronomical twilight, and its start
// to sunrise, for the sunset and the sunrise nearest the chart's instant.
// swe_rise_trans finds the next event after the time it's given, so the
// nearest is chosen from searches 1.5 and 0.5 days before and 0.5 days after.
const FROM = [t - 1.5, t - 0.5, t + 0.5];
const searches = [...FROM.map((from) => ({ from, event: "sunset" })), ...FROM.map((from) => ({ from, event: "sunrise" }))];
const found = session(searches.map(({ from, event }) => rise(from, event)));
const sunEvents = searches.map((search, i) => ({ ...search, ret: found[i].ret, jd: found[i].ret === 0 ? found[i].tret : null }));
const nearest = (event) =>
  sunEvents.filter((e) => e.event === event && e.ret === 0).map((e) => e.jd).reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
const sunset = nearest("sunset");
const sunrise = nearest("sunrise");
const twilight = [{ from: sunset, event: "astronomical-dusk" }, { from: sunrise - 1, event: "astronomical-dawn" }];
const [duskRow, dawnRow] = session(twilight.map(({ from, event }) => rise(from, event)));
sunEvents.push({ ...twilight[0], ret: duskRow.ret, jd: duskRow.tret }, { ...twilight[1], ret: dawnRow.ret, jd: dawnRow.tret });
if (duskRow.ret !== 0 || duskRow.tret - sunset >= 0.5) throw new Error("no astronomical dusk after the sunset");
if (dawnRow.ret !== 0 || dawnRow.tret >= sunrise || sunrise - dawnRow.tret >= 0.5) throw new Error("no astronomical dawn before the sunrise");

// Every 2 minutes from the window's start while inside it, then the end.
function instants(start, end) {
  const out = [];
  for (let k = 0; start + k / 720 <= end; k += 1) out.push(start + k / 720);
  if (out.at(-1) !== end) out.push(end);
  return out;
}

function sampled(start, end) {
  const jds = instants(start, end);
  const rows = session(jds.map((jd) => vlm(jd, place)));
  // Swiss Ephemeris fills in the atmosphere and observer before it checks
  // the horizon, the same way for every call at one place.
  const filled = JSON.stringify(filledIn(rows[0]));
  if (!rows.every((o) => JSON.stringify(filledIn(o)) === filled)) throw new Error("filled-in values differ between samples");
  return { start, end, ...filledIn(rows[0]), samples: rows.map((o, i) => ({ jd: jds[i], ...call(o) })) };
}

const one = (jd, where, range) => {
  const [o] = session([vlm(jd, where, range)]);
  return { jd, ...call(o), ...filledIn(o) };
};

const [sun, planet, pheno] = session([
  `calc s ${t} ${SE_SUN} ${SEFLG_MOSEPH}`,
  `calc p ${t} ${SE_VENUS} ${SEFLG_MOSEPH}`,
  `pheno e ${t} ${SE_VENUS} ${SEFLG_MOSEPH}`,
]);
const [, stale10] = session([vlm(t, place, 40), vlm(t, place, 10)]);
const later = julianDay("2025-01-10T23:35:00Z");
const [{ version }] = session(["version"]);

const reference = {
  about: [
    "Native Swiss Ephemeris values for Helioscope's proof of concept, written by tools/make-helioscope-reference.mjs, whose header says how the harness was built.",
    "Julian Days are UT. Every call used the Moshier ephemeris and an ephemeris path with no files.",
    "swe_vis_limit_mag calls give the atmosphere and observer as 0, for Swiss Ephemeris to fill in; datm, dobs and object are its filled-in values.",
    "Below the horizon (ret -2), Swiss Ephemeris sets only dret[0], so that is all a sample keeps.",
    "Each window ran in a fresh process, as did each other group of calls. atmospheres.range10AfterRange40 is the second of two calls in one process, after one with a 40 km range: Swiss Ephemeris returned its cached extinction.",
  ],
  swissEphemeris: version,
  case: { ...CASE, jd: t },
  sunEvents,
  windows: { evening: sampled(sunset, duskRow.tret), morning: sampled(dawnRow.tret, sunrise) },
  reference: one(t, place),
  solar: {
    sunLongitude: sun.x[0],
    planetLongitude: planet.x[0],
    planetLatitude: planet.x[1],
    elongation: pheno.elongation,
    ret: { sun: sun.ret, planet: planet.ret, pheno: pheno.ret },
  },
  atmospheres: {
    range40: one(t, place, 40),
    range10: one(t, place, 10),
    range10AfterRange40: { jd: t, ...call(stale10), ...filledIn(stale10) },
  },
  elevation3000: { elevation: 3000, ...one(later, { ...place, elevation: 3000 }) },
};
rmSync(emptyEphemeris, { recursive: true });

// Arrays of numbers on one line each.
const text = JSON.stringify(reference, null, 2).replace(/\[\n\s+([-\d.e+,\s]+?)\n\s+\]/g, (_, inner) => `[${inner.split(/,\s*/).join(", ")}]`);
writeFileSync(OUT, text + "\n");

const { evening, morning } = reference.windows;
const best = evening.samples.filter((s) => s.ret >= 0).reduce((a, b) => (b.dret[0] - b.dret[7] > a.dret[0] - a.dret[7] ? b : a));
console.log(`Swiss Ephemeris ${version}`);
console.log(`evening: ${evening.samples.length} samples, ${evening.samples.filter((s) => s.ret >= 0).length} above the horizon; best margin ${best.dret[0] - best.dret[7]} at ${best.jd}`);
console.log(`morning: ${morning.samples.length} samples, ${morning.samples.filter((s) => s.ret >= 0).length} above the horizon`);
console.log(`reference call: ret ${reference.reference.ret}, limit ${reference.reference.dret[0]}, Venus ${reference.reference.dret[7]}, altitude ${reference.reference.dret[1]}`);
console.log(`wrote ${OUT.pathname}`);
