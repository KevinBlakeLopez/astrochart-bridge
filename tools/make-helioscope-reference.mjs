// Writes the native Swiss Ephemeris values Helioscope's tests compare the
// WebAssembly in extension/vendor/swisseph/ with
// (docs/HELIOSCOPE_V1_FEASIBILITY.md §8 and §10):
//
// - test/helioscope-venus-new-york.json: every sample of both windows for
//   Venus from New York around the evening of 10 January 2025, the proof of
//   concept's case, and the other calls the engine's tests make.
// - test/helioscope-reference-cases.json: §8's nine reference cases, each with
//   its windows and the best sample of each.
//
// Run it by hand, after changing a case; the tests never run it.
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

const VENUS_OUT = new URL("../test/helioscope-venus-new-york.json", import.meta.url);
const CASES_OUT = new URL("../test/helioscope-reference-cases.json", import.meta.url);

// The places of §8's reference cases, in degrees and metres.
const PLACES = {
  newYork: { lat: 40.7128, lng: -74.006, elevation: 10 },
  sydney: { lat: -33.8688, lng: 151.2093, elevation: 0 },
  tromso: { lat: 69.6492, lng: 18.9553, elevation: 0 },
};

// §8's reference cases. The instants for the conjunctions and the opposition
// are the spike's: a scan picked the quarter-day nearest the smallest longitude
// gap, or nearest 180°.
const CASES = [
  { label: "mercury-superior-conjunction-2024", planet: "mercury", place: "newYork", utc: "2024-06-14T18:00:00Z" },
  { label: "venus-evening-2025-01-10", planet: "venus", place: "newYork", utc: "2025-01-10T22:35:00Z" },
  { label: "venus-inferior-conjunction-2025", planet: "venus", place: "newYork", utc: "2025-03-23T00:00:00Z" },
  { label: "mars-conjunction-2023", planet: "mars", place: "newYork", utc: "2023-11-18T06:00:00Z" },
  { label: "jupiter-opposition-2024", planet: "jupiter", place: "newYork", utc: "2024-12-07T18:00:00Z" },
  { label: "saturn-conjunction-2025", planet: "saturn", place: "newYork", utc: "2025-03-12T12:00:00Z" },
  { label: "venus-evening-2025-01-10-sydney", planet: "venus", place: "sydney", utc: "2025-01-10T09:00:00Z" },
  { label: "jupiter-opposition-2024-tromso", planet: "jupiter", place: "tromso", utc: "2024-12-07T18:00:00Z" },
  { label: "venus-2025-06-21-tromso", planet: "venus", place: "tromso", utc: "2025-06-21T00:00:00Z" },
];

// swephexp.h
const SEFLG_MOSEPH = 4;
const SE_SUN = 0;
const SE_PLANETS = { mercury: 2, venus: 3, mars: 4, jupiter: 5, saturn: 6 };
const SE_BIT_ASTRO_TWILIGHT = 4096;
const RSMI = {
  sunrise: 1,
  sunset: 2,
  "astronomical-dawn": 1 | SE_BIT_ASTRO_TWILIGHT,
  "astronomical-dusk": 2 | SE_BIT_ASTRO_TWILIGHT,
};

const julianDay = (utc) => Date.parse(utc) / 86_400_000 + 2440587.5;
const emptyEphemeris = mkdtempSync(join(tmpdir(), "helioscope-ephe-"));

function session(lines) {
  const input = [`ephe ${emptyEphemeris}`, ...lines].join("\n") + "\n";
  const result = spawnSync(harness, [], { input, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${harness} exited ${result.status}: ${result.stderr}`);
  return result.stdout.trim().split("\n").map((line) => JSON.parse(line)).filter((o) => o.cmd !== "ephe");
}

// Atmosphere and observer all 0, so Swiss Ephemeris fills in its defaults;
// only the meteorological range (datm[3]) is ever set here.
const vlm = (jd, { lat, lng, elevation }, planet, range = 0) =>
  `vlm v ${jd} ${lng} ${lat} ${elevation} 0 0 0 ${range} 0 0 ${planet} ${SEFLG_MOSEPH}`;
const rise = (from, { lat, lng, elevation }, event) =>
  `rise r ${from} ${SE_SUN} ${lng} ${lat} ${elevation} 0 0 ${RSMI[event]} ${SEFLG_MOSEPH}`;

// One swe_vis_limit_mag call. Below the horizon, Swiss Ephemeris sets only
// dret[0], to -100: it zeroes dret[1] to dret[6] and leaves dret[7] as the
// caller left it, so only dret[0] is kept. Otherwise it writes dret[0] to
// dret[7] (§8, item 1).
function call(o) {
  if (o.dret.slice(0, 8).some((v) => typeof v !== "number")) throw new Error(`not finite: ${JSON.stringify(o)}`);
  return { ret: o.ret, dret: o.ret === -2 ? [o.dret[0]] : o.dret.slice(0, 8), serr: o.serr };
}
const filledIn = (o) => ({ datm: o.datm_after, dobs: o.dobs_after, object: o.object_after });
const margin = (sample) => sample.dret[0] - sample.dret[7];

// The windows of §6: sunset to the end of astronomical twilight, and its start
// to sunrise, for the sunset and the sunrise nearest the chart's instant.
// swe_rise_trans finds the next event after the time it's given, so the
// nearest is chosen from searches 1.5 and 0.5 days before and 0.5 days after.
// A twilight more than half a day from its sunset or sunrise belongs to
// another night.
function windows(t, place) {
  const from = [t - 1.5, t - 0.5, t + 0.5];
  const searches = [...from.map((at) => ({ from: at, event: "sunset" })), ...from.map((at) => ({ from: at, event: "sunrise" }))];
  const found = session(searches.map((search) => rise(search.from, place, search.event)));
  const sunEvents = searches.map((search, i) => ({ ...search, ret: found[i].ret, jd: found[i].ret === 0 ? found[i].tret : null }));
  const nearest = (event) =>
    sunEvents.filter((e) => e.event === event && e.ret === 0).map((e) => e.jd)
      .reduce((a, b) => (a === null || Math.abs(b - t) < Math.abs(a - t) ? b : a), null);
  const sunset = nearest("sunset");
  const sunrise = nearest("sunrise");
  const twilight = [
    ...(sunset === null ? [] : [{ from: sunset, event: "astronomical-dusk" }]),
    ...(sunrise === null ? [] : [{ from: sunrise - 1, event: "astronomical-dawn" }]),
  ];
  const rows = twilight.length === 0 ? [] : session(twilight.map((search) => rise(search.from, place, search.event)));
  twilight.forEach((search, i) => sunEvents.push({ ...search, ret: rows[i].ret, jd: rows[i].tret }));
  const end = (event) => sunEvents.find((e) => e.event === event) ?? { ret: -2 };
  const dusk = end("astronomical-dusk");
  const dawn = end("astronomical-dawn");

  let evening = { kind: "window", start: sunset, end: dusk.jd };
  if (sunset === null) evening = { kind: "no-window", reason: "no-sunset" };
  else if (dusk.ret !== 0 || dusk.jd - sunset >= 0.5) evening = { kind: "no-window", reason: "no-astronomical-dusk" };
  let morning = { kind: "window", start: dawn.jd, end: sunrise };
  if (sunrise === null) morning = { kind: "no-window", reason: "no-sunrise" };
  else if (dawn.ret !== 0 || dawn.jd >= sunrise || sunrise - dawn.jd >= 0.5) morning = { kind: "no-window", reason: "no-astronomical-dawn" };
  return { sunEvents, evening, morning };
}

// Every 2 minutes from the window's start while inside it, then the end.
function instants(start, end) {
  const out = [];
  for (let k = 0; start + k / 720 <= end; k += 1) out.push(start + k / 720);
  if (out.at(-1) !== end) out.push(end);
  return out;
}

// Every sample of a window, from one fresh process.
function sampled({ start, end }, place, planet) {
  const jds = instants(start, end);
  const rows = session(jds.map((jd) => vlm(jd, place, planet)));
  // Swiss Ephemeris fills in the atmosphere and observer before it checks
  // the horizon, the same way for every call at one place.
  const filled = JSON.stringify(filledIn(rows[0]));
  if (!rows.every((o) => JSON.stringify(filledIn(o)) === filled)) throw new Error("filled-in values differ between samples");
  return { start, end, ...filledIn(rows[0]), samples: rows.map((o, i) => ({ jd: jds[i], ...call(o) })) };
}

// A window as the cases file keeps it: its bounds and counts, and the sample
// with the largest margin while the planet is above the horizon, the earliest
// of equal ones.
function summary(window, place, planet) {
  if (window.kind === "no-window") return window;
  const { start, end, samples } = sampled(window, place, planet);
  const above = samples.filter((s) => s.ret >= 0);
  const counts = { start, end, samples: samples.length, aboveHorizon: above.length };
  if (above.length === 0) return { kind: "below-horizon", ...counts };
  return { kind: "evaluated", ...counts, best: above.reduce((a, b) => (margin(b) > margin(a) ? b : a)) };
}

function solar(t, planet) {
  const ipl = SE_PLANETS[planet];
  const [sun, body, pheno] = session([
    `calc s ${t} ${SE_SUN} ${SEFLG_MOSEPH}`,
    `calc p ${t} ${ipl} ${SEFLG_MOSEPH}`,
    `pheno e ${t} ${ipl} ${SEFLG_MOSEPH}`,
  ]);
  return {
    values: { sunLongitude: sun.x[0], planetLongitude: body.x[0], planetLatitude: body.x[1], elongation: pheno.elongation },
    ret: { sun: sun.ret, planet: body.ret, pheno: pheno.ret },
  };
}

const [{ version }] = session(["version"]);

// The proof of concept's case, in full.
function venusFromNewYork() {
  const place = PLACES.newYork;
  const utc = "2025-01-10T22:35:00Z";
  const t = julianDay(utc);
  const { sunEvents, evening, morning } = windows(t, place);
  if (evening.kind !== "window" || morning.kind !== "window") throw new Error("Venus from New York needs both windows");
  const one = (jd, where, range) => {
    const [o] = session([vlm(jd, where, "venus", range)]);
    return { jd, ...call(o), ...filledIn(o) };
  };
  const geometry = solar(t, "venus");
  const [, stale10] = session([vlm(t, place, "venus", 40), vlm(t, place, "venus", 10)]);
  const later = julianDay("2025-01-10T23:35:00Z");
  return {
    about: [
      "Native Swiss Ephemeris values for Helioscope's proof of concept, written by tools/make-helioscope-reference.mjs, whose header says how the harness was built.",
      "Julian Days are UT. Every call used the Moshier ephemeris and an ephemeris path with no files.",
      "swe_vis_limit_mag calls give the atmosphere and observer as 0, for Swiss Ephemeris to fill in; datm, dobs and object are its filled-in values.",
      "Below the horizon (ret -2), Swiss Ephemeris sets only dret[0], so that is all a sample keeps.",
      "Each window ran in a fresh process, as did each other group of calls. atmospheres.range10AfterRange40 is the second of two calls in one process, after one with a 40 km range: Swiss Ephemeris returned its cached extinction.",
    ],
    swissEphemeris: version,
    case: { planet: "venus", utc, ...place, jd: t },
    sunEvents,
    windows: { evening: sampled(evening, place, "venus"), morning: sampled(morning, place, "venus") },
    reference: one(t, place),
    solar: { ...geometry.values, ret: geometry.ret },
    atmospheres: {
      range40: one(t, place, 40),
      range10: one(t, place, 10),
      range10AfterRange40: { jd: t, ...call(stale10), ...filledIn(stale10) },
    },
    elevation3000: { elevation: 3000, ...one(later, { ...place, elevation: 3000 }) },
  };
}

// §8's nine cases, each window summarized.
function referenceCases() {
  return {
    about: [
      "Native Swiss Ephemeris values for the nine reference cases of docs/HELIOSCOPE_V1_FEASIBILITY.md §8, written by tools/make-helioscope-reference.mjs, whose header says how the harness was built.",
      "Julian Days are UT. Every call used the Moshier ephemeris, an ephemeris path with no files, and an atmosphere and observer of 0 for Swiss Ephemeris to fill in.",
      "Each window keeps its bounds, its number of samples and how many were above the horizon, and its best sample: the largest margin among those, with what swe_vis_limit_mag returned for it.",
    ],
    swissEphemeris: version,
    cases: CASES.map(({ label, planet, place: name, utc }) => {
      const place = PLACES[name];
      const t = julianDay(utc);
      const { evening, morning } = windows(t, place);
      return {
        label,
        planet,
        place: name,
        ...place,
        utc,
        jd: t,
        solar: solar(t, planet).values,
        windows: { evening: summary(evening, place, planet), morning: summary(morning, place, planet) },
      };
    }),
  };
}

// Arrays of numbers on one line each.
const format = (value) =>
  JSON.stringify(value, null, 2).replace(/\[\n\s+([-\d.e+,\s]+?)\n\s+\]/g, (_, inner) => `[${inner.split(/,\s*/).join(", ")}]`) + "\n";

const venus = venusFromNewYork();
const cases = referenceCases();
rmSync(emptyEphemeris, { recursive: true });
writeFileSync(VENUS_OUT, format(venus));
writeFileSync(CASES_OUT, format(cases));

console.log(`Swiss Ephemeris ${version}`);
console.log(`reference call: ret ${venus.reference.ret}, limit ${venus.reference.dret[0]}, Venus ${venus.reference.dret[7]}, altitude ${venus.reference.dret[1]}`);
for (const c of cases.cases) {
  const describe = (w) =>
    w.kind === "evaluated"
      ? `${w.samples} samples, ${w.aboveHorizon} above; best ${margin(w.best).toFixed(3)} at ${new Date(Math.round((w.best.jd - 2440587.5) * 86_400_000)).toISOString()}`
      : w.kind === "below-horizon" ? `${w.samples} samples, below the horizon throughout` : `${w.kind} (${w.reason})`;
  console.log(`${c.label}: evening ${describe(c.windows.evening)}; morning ${describe(c.windows.morning)}`);
}
console.log(`wrote ${VENUS_OUT.pathname} and ${CASES_OUT.pathname}`);
