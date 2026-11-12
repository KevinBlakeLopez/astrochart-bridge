import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  ANGLES,
  DWARF_PLANETS,
  PARTNERS,
  PLANETS,
  declinationContacts,
  declinations,
  eclipticDeclination,
} from "../extension/core/declinations.js";
import { createEngine } from "../extension/helioscope-engine.js";

// Native Swiss Ephemeris's declinations, written by
// tools/make-declinations-reference.py: with the engine's settings, and on
// the DE-based files for the dates they cover.
const REFERENCE = JSON.parse(readFileSync(new URL("declinations-reference.json", import.meta.url), "utf8"));

// The largest differences from the reference, measured on 12 November 2026
// over the 6 cases, with about twice that allowed.
const BUILD_DEGREES = {
  bodies: 5e-9, // 2.2e-9°, Eris in 2900
  rightAscensions: 1.2e-8, // 5.9e-9°, Eris in 2900
  angles: 1e-9, // 4.3e-10°, Tromsø's Vertex: the formula here against swe_cotrans
  longitudes: 3e-9, // 1.2e-9°, Tromsø's Vertex
  armc: 2e-9, // 9.3e-10°, Tromsø
};
// How far Moshier's declinations are from the DE files', in arcseconds.
const DE_ARCSECONDS = {
  moon: 2, // 0.82″, London 2024
  planets: 0.5, // 0.25″, Pluto, Sydney 1987
  dwarfPlanets: 0.03, // 0.012″, Ceres, Tromsø
};

const natal = (utc, lat, lng) => ({ kind: "natal", utc, utcSource: "printed-utc", lat, lng });
const ephemerisFiles = () => Object.fromEntries(Object.keys(REFERENCE.files).map((name) => [
  name,
  new Uint8Array(readFileSync(new URL(`../extension/vendor/swisseph/ephe/${name}`, import.meta.url))),
]));

async function withFiles(t) {
  const engine = await createEngine({ ephemerisFiles: ephemerisFiles() });
  t.after(() => engine.dispose());
  return engine;
}

test("the reference was worked out from the asteroid files the extension vendors", () => {
  for (const [name, sha256] of Object.entries(REFERENCE.files)) {
    const bytes = readFileSync(new URL(`../extension/vendor/swisseph/ephe/${name}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256, name);
  }
});

// ---- the real engine against native Swiss Ephemeris ------------------------

test("declinations: every body, angle and obliquity is native Swiss Ephemeris's, within the tolerance", async (t) => {
  const engine = await withFiles(t);
  for (const reference of REFERENCE.results) {
    const result = declinations(natal(reference.utc, reference.lat, reference.lng), engine);
    assert.equal(result.kind, "declinations", reference.name);
    assert.equal(result.obliquity, reference.obliquity, reference.name);
    assert.ok(Math.abs(result.assumptions.angles.armc - reference.armc) <= BUILD_DEGREES.armc, reference.name);
    assert.deepEqual(Object.keys(result.points).sort(), [...ANGLES, ...DWARF_PLANETS, ...PLANETS].sort());
    for (const [point, expected] of Object.entries(reference.points)) {
      const label = `${reference.name}: ${point}`;
      const found = result.points[point];
      const angle = ANGLES.includes(point);
      const allowed = angle ? BUILD_DEGREES.angles : BUILD_DEGREES.bodies;
      const off = Math.abs(found.declination - expected.declination);
      assert.ok(off <= allowed, `${label}: ${off}° from native Swiss Ephemeris's declination, more than ${allowed}°`);
      if (angle) assert.ok(Math.abs(found.longitude - expected.longitude) <= BUILD_DEGREES.longitudes, label);
      else assert.ok(Math.abs(found.rightAscension - expected.rightAscension) <= BUILD_DEGREES.rightAscensions, label);
    }
  }
});

test("declinations: Moshier's are the DE files' to within an arcsecond or two, from 1800 to 2400", async (t) => {
  const engine = await withFiles(t);
  const covered = REFERENCE.results.filter((reference) => reference.deDeclinations !== null);
  assert.deepEqual(covered.map((reference) => reference.name), ["london-2024", "tromso-2024", "sydney-1987", "equator-2010"]);
  for (const reference of covered) {
    const result = declinations(natal(reference.utc, reference.lat, reference.lng), engine);
    for (const [body, expected] of Object.entries(reference.deDeclinations)) {
      const allowed = body === "moon" ? DE_ARCSECONDS.moon
        : DWARF_PLANETS.includes(body) ? DE_ARCSECONDS.dwarfPlanets : DE_ARCSECONDS.planets;
      const off = Math.abs(result.points[body].declination - expected) * 3600;
      assert.ok(off <= allowed, `${reference.name}: ${body} ${off.toFixed(3)}″ from the DE files', more than ${allowed}″`);
    }
  }
});

test("declinations: on the equator the Vertex is an equinox, at declination 0", async (t) => {
  const engine = await withFiles(t);
  const result = declinations(natal("2010-03-20T17:00:00Z", 0, -78.4678), engine);
  assert.equal(result.points.vertex.longitude % 180, 0);
  assert.ok(Math.abs(result.points.vertex.declination) < 1e-12);
});

test("declinations: a dwarf planet's declination is its actual position's, not its zodiacal degree's", async (t) => {
  // Eris in 2900, at about 40° from the declination of its degree: the case
  // tools/make-declinations-reference.py checks.
  const engine = await withFiles(t);
  const result = declinations(natal("2900-01-01T00:00:00Z", -33.8688, 151.2093), engine);
  const expected = REFERENCE.results.find((reference) => reference.name === "sydney-2900").points.eris.declination;
  assert.ok(Math.abs(result.points.eris.declination - expected) <= BUILD_DEGREES.bodies);
  assert.ok(Math.abs(expected) > 30, "Eris is far from the ecliptic in 2900");
});

test("declinations: says what it assumed", async (t) => {
  const engine = await withFiles(t);
  const result = declinations(natal("2024-04-10T14:30:00Z", 51.5074, -0.1278), engine);
  assert.deepEqual(result.moment, { jd: REFERENCE.results[0].jdUt, utc: "2024-04-10T14:30:00Z" });
  assert.deepEqual(result.place, { lat: 51.5074, lng: -0.1278 });
  assert.equal(result.conventions, "geocentric apparent declinations on the true equator of date; " +
    "the angles as ecliptic points; the Moshier ephemeris, with the UTC as UT");
  assert.equal(result.assumptions.ephemeris, "moshier");
  assert.deepEqual(result.assumptions.ephemerisFiles, Object.keys(REFERENCE.files));
  assert.equal(result.assumptions.timeScale, "utc-as-ut");
  assert.equal(result.assumptions.angles.houseSystem, "porphyry");
});

test("declinations: without the dwarf planets' files the whole result fails, at Ceres", async (t) => {
  const engine = await createEngine();
  t.after(() => engine.dispose());
  const result = declinations(natal("2024-04-10T14:30:00Z", 51.5074, -0.1278), engine);
  assert.equal(result.kind, "failed");
  assert.equal(result.point, "ceres");
  assert.equal(result.failure.reason, "no-ephemeris-file");
});

test("equatorialPosition and angles: refuse impossible dates and places before calling Swiss Ephemeris", async (t) => {
  const engine = await withFiles(t);
  const invalid = { kind: "failed", reason: "invalid-input" };
  assert.deepEqual(engine.equatorialPosition(Number.NaN, "eris"), invalid);
  assert.deepEqual(engine.equatorialPosition(1e9, "sun"), invalid);
  assert.deepEqual(engine.angles(2460411.1, { lat: 91, lng: 0 }), invalid);
  assert.deepEqual(engine.angles(2460411.1, { lat: 51.5 }), invalid);
  assert.deepEqual(engine.angles(Number.NaN, { lat: 51.5, lng: 0 }), invalid);
});

test("equatorialPosition: a body the engine doesn't know is a mistake in the caller", async (t) => {
  const engine = await withFiles(t);
  assert.throws(() => engine.equatorialPosition(2460411.1, "chiron"), /The engine takes a body/);
});

test("equatorialPosition: without a dwarf planet's file, no-ephemeris-file, with Swiss Ephemeris's message", async (t) => {
  const engine = await createEngine();
  t.after(() => engine.dispose());
  const found = engine.equatorialPosition(2460411.1, "sedna");
  assert.equal(found.reason, "no-ephemeris-file");
  assert.match(found.serr, /SwissEph file '[^']+' not found/);
});

// ---- refusals, with an engine that's never called ---------------------------

const UNCALLED = new Proxy({}, { get: (_, name) => { throw new Error(`the engine was asked for ${String(name)}`); } });

test("declinations: refuses charts it can't work out, as parans does, before calling the engine", () => {
  const cases = [
    [{ kind: "transit", utc: "2024-04-10T14:30:00Z", lat: 51.5, lng: 0 }, "not-natal"],
    [{ kind: "natal", utc: null, utcSource: "needs-offset", lat: 51.5, lng: 0 }, "needs-offset"],
    [{ kind: "natal", utc: null, utcSource: "needs-choice", lat: 51.5, lng: 0 }, "needs-choice"],
    [natal("2024-04-10T14:30:00Z", 91, 0), "invalid-coordinates"],
    [natal("2024-04-10T14:30:00Z", 51.5, Number.NaN), "invalid-coordinates"],
    [natal("2024-04-10T14:30:00Z", -90, 0), "at-pole"],
    [natal("1582-10-14T23:59:00Z", 51.5, 0), "date-out-of-range"],
    [natal("3000-01-01T00:00:00Z", 51.5, 0), "date-out-of-range"],
  ];
  for (const [chart, reason] of cases) assert.deepEqual(declinations(chart, UNCALLED), { kind: "refused", reason }, reason);
});

test("declinations: takes the first Gregorian day, which parans' 12-hour window doesn't", () => {
  const scripted = {
    assumptions: { swissEphemeris: "scripted", ephemeris: "moshier", ephemerisFiles: [] },
    angles: () => ({ kind: "computed", ascendant: 0, midheaven: 90, vertex: 180, armc: 90, obliquity: 23.5 }),
    equatorialPosition: () => ({ kind: "computed", rightAscension: 0, declination: 0 }),
  };
  assert.equal(declinations(natal("1582-10-15T00:00:00Z", 51.5, 0), scripted).kind, "declinations");
});

// ---- the formula -------------------------------------------------------------

test("eclipticDeclination: 0 at the equinoxes, the obliquity at the solstices", () => {
  assert.equal(eclipticDeclination(0, 23.44), 0);
  assert.ok(Math.abs(eclipticDeclination(180, 23.44)) < 1e-12);
  assert.ok(Math.abs(eclipticDeclination(90, 23.44) - 23.44) < 1e-12);
  assert.ok(Math.abs(eclipticDeclination(270, 23.44) + 23.44) < 1e-12);
  // The Descendant's declination is the Ascendant's, opposite.
  assert.ok(Math.abs(eclipticDeclination(200, 23.44) + eclipticDeclination(20, 23.44)) < 1e-12);
});

// ---- contacts, from a result made by hand ------------------------------------

// Every point at 50°, out of reach, except the ones given.
function made(declinationsByPoint) {
  const points = {};
  for (const point of [...ANGLES, ...DWARF_PLANETS, ...PLANETS]) {
    points[point] = { declination: declinationsByPoint[point] ?? 50 };
  }
  // The dwarf planets apart from one another, so none of their pairs could match.
  DWARF_PLANETS.forEach((dwarf, i) => {
    if (declinationsByPoint[dwarf] === undefined) points[dwarf] = { declination: -80 + i * 3 };
  });
  return { kind: "declinations", points };
}

test("declinationContacts: a parallel and a contra-parallel within the orb, with how far each is from exact", () => {
  const result = made({ eris: -7.2, sun: -7.5, moon: 6.9, midheaven: 12 });
  assert.deepEqual(declinationContacts(result, 1).map(({ orb, ...rest }) => ({ ...rest, orb: Number(orb.toFixed(6)) })), [
    { dwarfPlanet: "eris", partner: "sun", contact: "parallel", orb: 0.3 },
    { dwarfPlanet: "eris", partner: "moon", contact: "contra-parallel", orb: 0.3 },
  ]);
});

test("declinationContacts: the orb is included, and nothing past it", () => {
  // Binary fractions, so the gaps are exact.
  const result = made({ sedna: 5.5, vertex: 6.5, mars: 4.25 });
  assert.deepEqual(declinationContacts(result, 1).map((each) => [each.partner, each.orb]), [["vertex", 1]]);
  assert.deepEqual(declinationContacts(result, 1.25).map((each) => [each.partner, each.orb]), [["vertex", 1], ["mars", 1.25]]);
  assert.deepEqual(declinationContacts(result, 0.5), []);
});

test("declinationContacts: near the equator a pair is both parallel and contra-parallel, and both are listed", () => {
  const result = made({ ceres: 0.25, ascendant: -0.25 });
  assert.deepEqual(declinationContacts(result, 1).map((each) => [each.partner, each.contact, each.orb]), [
    ["ascendant", "parallel", 0.5],
    ["ascendant", "contra-parallel", 0],
  ]);
});

test("declinationContacts: by dwarf planet, then by partner, the angles first", () => {
  const result = made({ ceres: 10, orcus: -20, pluto: -20, ascendant: 20, venus: 10, midheaven: -10 });
  assert.deepEqual(declinationContacts(result, 1).map((each) => `${each.dwarfPlanet} ${each.partner} ${each.contact}`), [
    "ceres midheaven contra-parallel",
    "ceres venus parallel",
    "orcus ascendant contra-parallel",
    "orcus pluto parallel",
  ]);
});

test("declinationContacts: only a dwarf planet with an angle or planet, never two dwarf planets", () => {
  const result = made({ eris: 3, makemake: 3, haumea: -3 });
  assert.deepEqual(declinationContacts(result, 1), []);
  assert.deepEqual(PARTNERS, ["ascendant", "midheaven", "vertex", ...PLANETS]);
});

test("declinationContacts: needs declinations' result and an orb above 0", () => {
  assert.throws(() => declinationContacts({ kind: "refused", reason: "not-natal" }, 1), /declinations' result/);
  for (const orb of [0, -1, Number.NaN, "1"]) assert.throws(() => declinationContacts(made({}), orb), /orb above 0/);
});
