import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { julianDay } from "../extension/core/stellarium-desktop.js";
import { createEngine, visLimitResult } from "../extension/helioscope-engine.js";

// Native Swiss Ephemeris for Venus from New York around the evening of
// 10 January 2025, written by tools/make-helioscope-reference.mjs.
const NATIVE = JSON.parse(readFileSync(new URL("helioscope-venus-new-york.json", import.meta.url), "utf8"));

// Gate 4 (docs/HELIOSCOPE_V1_FEASIBILITY.md §8) ran 3,757 calls through this
// WebAssembly and through the native -O2 build NATIVE comes from. They
// differed by at most 8.6e-9 magnitudes, 1.8e-7° (the Sun's azimuth), and
// 1.1e-13 hPa in the pressure Swiss Ephemeris fills in. Measured the same way
// for the proof of concept, swe_rise_trans gave bit-identical times in 96
// calls around the nine reference cases, so times are compared exactly.
const MAGNITUDES = 1e-8;
const DEGREES = 2e-7;
const FILLED_IN = 1e-12;

const T = NATIVE.case.jd;
const PLACE = { lat: NATIVE.case.lat, lng: NATIVE.case.lng, elevation: NATIVE.case.elevation };

// A fresh engine for each test, as Helioscope makes one for each calculation.
async function fresh(t, options) {
  const engine = await createEngine(options);
  t.after(() => engine.dispose());
  return engine;
}

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is more than ${tolerance} from ${expected}`);
}

// dret holds the limiting magnitude, the altitude and azimuth of the object,
// the Sun and the Moon, then the object's magnitude.
function assertNative(result, native, label) {
  assert.equal(result.raw.ret, native.ret, `${label}: return code`);
  assert.equal(result.raw.dret.length, native.dret.length, `${label}: slots written`);
  near(result.raw.dret[0], native.dret[0], MAGNITUDES, `${label}: limiting magnitude`);
  for (let slot = 1; slot < native.dret.length - 1; slot += 1) {
    near(result.raw.dret[slot], native.dret[slot], DEGREES, `${label}: dret[${slot}]`);
  }
  if (native.dret.length === 8) near(result.raw.dret[7], native.dret[7], MAGNITUDES, `${label}: object magnitude`);
  native.datm.forEach((value, i) => near(result.raw.datm[i], value, FILLED_IN, `${label}: datm[${i}]`));
  assert.deepEqual(result.raw.dobs, native.dobs, `${label}: dobs`);
  assert.equal(result.raw.object, native.object, `${label}: object`);
  assert.equal(result.raw.serr, native.serr, `${label}: serr`);
}

test("createEngine: Swiss Ephemeris's own defaults, the Moshier ephemeris and the Moon, all stated", async (t) => {
  const engine = await fresh(t);
  assert.deepEqual(engine.assumptions, {
    swissEphemeris: "2.10.03",
    ephemeris: "moshier",
    helflag: 4,
    moon: "included",
    // 0 asks Swiss Ephemeris to fill a value in, the way the reference values were computed.
    atmosphere: { pressure: 0, temperature: 0, humidity: 0, meteorologicalRange: 0 },
    observer: { age: 0, snellenRatio: 0 },
  });
});

test("createEngine: an atmosphere is checked, and a name it doesn't know is refused rather than ignored", async () => {
  await assert.rejects(createEngine({ atmosphere: { humidity: Number.NaN } }), /humidity/);
  // @kuntay/swisseph's own name for the meteorological range.
  await assert.rejects(createEngine({ atmosphere: { visibilityRange: 10 } }), /visibilityRange/);
  await assert.rejects(createEngine({ observer: { age: Infinity } }), /age/);
});

test("limitingMagnitude: the reference call of §10 is native's, Venus from New York at 22:35 UTC", async (t) => {
  const engine = await fresh(t);
  const result = engine.limitingMagnitude(NATIVE.reference.jd, PLACE, "venus");
  assert.equal(result.kind, "evaluated");
  assertNative(result, NATIVE.reference, "reference");
  const { raw, completed, ...named } = result;
  const [limit, altitude, azimuth, sunAltitude, sunAzimuth, moonAltitude, moonAzimuth, magnitude] = raw.dret;
  assert.deepEqual(named, {
    kind: "evaluated",
    limitingMagnitude: limit,
    objectMagnitude: magnitude,
    altitude,
    azimuth,
    sunAltitude,
    sunAzimuth,
    moonAltitude,
    moonAzimuth,
    vision: "photopic",
  });
  // The atmosphere and observer as Swiss Ephemeris filled them in.
  const [pressure, temperature, humidity, meteorologicalRange] = raw.datm;
  assert.deepEqual(completed, {
    atmosphere: { pressure, temperature, humidity, meteorologicalRange },
    observer: { age: 36, snellenRatio: 1, binocular: 1, magnification: 1, aperture: 0, transmission: 0 },
  });
});

test("limitingMagnitude: every sample of both windows is native's, in one engine", async (t) => {
  const engine = await fresh(t);
  for (const name of ["evening", "morning"]) {
    const window = NATIVE.windows[name];
    for (const sample of window.samples) {
      const label = `${name} ${sample.jd}`;
      const result = engine.limitingMagnitude(sample.jd, PLACE, "venus");
      assert.equal(result.kind, sample.ret === -2 ? "below-horizon" : "evaluated", label);
      assertNative(result, { ...sample, datm: window.datm, dobs: window.dobs, object: window.object }, label);
      if (sample.ret >= 0) assert.equal(result.vision, sample.ret & 1 ? "scotopic" : "photopic", label);
    }
  }
});

test("limitingMagnitude: below the horizon is a result, and keeps nothing from the call before (§8, item 4)", async (t) => {
  const engine = await fresh(t);
  engine.limitingMagnitude(NATIVE.windows.evening.samples[0].jd, PLACE, "venus");
  const result = engine.limitingMagnitude(NATIVE.windows.morning.samples[0].jd, PLACE, "venus");
  assert.equal(result.kind, "below-horizon");
  // Swiss Ephemeris writes only dret[0] here; the object's magnitude from the
  // evening call would otherwise still be in dret[7].
  assert.deepEqual(result.raw.dret, [-100]);
  assert.equal(result.raw.serr, "object is below local horizon");
});

test("limitingMagnitude: every input is written afresh, since Swiss Ephemeris fills the atmosphere in in place (§8, item 2)", async (t) => {
  const engine = await fresh(t);
  const first = engine.limitingMagnitude(T, PLACE, "venus");
  near(first.raw.datm[0], NATIVE.reference.datm[0], FILLED_IN, "pressure at 10 m");
  // Reusing the rewritten atmosphere would keep 10 m's 1012 hPa: Swiss
  // Ephemeris fills in a pressure only when it's given 0.
  const { jd, elevation } = NATIVE.elevation3000;
  const result = engine.limitingMagnitude(jd, { ...PLACE, elevation }, "venus");
  assertNative(result, NATIVE.elevation3000, "3000 m");
  assert.deepEqual(engine.assumptions.atmosphere, { pressure: 0, temperature: 0, humidity: 0, meteorologicalRange: 0 });
});

test("limitingMagnitude: a second atmosphere at the same instant needs its own engine, which isn't given the first one's cached extinction (§8, item 5)", async (t) => {
  const forty = await fresh(t, { atmosphere: { meteorologicalRange: 40 } });
  const ten = await fresh(t, { atmosphere: { meteorologicalRange: 10 } });
  assert.deepEqual(ten.assumptions.atmosphere, { pressure: 0, temperature: 0, humidity: 0, meteorologicalRange: 10 });
  assertNative(forty.limitingMagnitude(T, PLACE, "venus"), NATIVE.atmospheres.range40, "40 km");
  const result = ten.limitingMagnitude(T, PLACE, "venus");
  assertNative(result, NATIVE.atmospheres.range10, "10 km");
  // What one native process returned for 10 km after 40 km.
  assert.ok(result.limitingMagnitude < NATIVE.atmospheres.range10AfterRange40.dret[0] - 2);
});

test("sunEvent: sunsets, sunrises and the ends of astronomical twilight are native's to the bit", async (t) => {
  const engine = await fresh(t);
  for (const { from, event, ret, jd } of NATIVE.sunEvents) {
    assert.deepEqual(engine.sunEvent(from, PLACE, event), ret === 0 ? { kind: "found", jd } : { kind: "none" }, `${event} from ${from}`);
  }
});

test("sunEvent: an event that doesn't happen is none, not a failure: London has no astronomical dusk on 21 June 2025", async (t) => {
  const engine = await fresh(t);
  const london = { lat: 51.5074, lng: -0.1278, elevation: 0 };
  const sunset = engine.sunEvent(julianDay("2025-06-21T10:00:00Z"), london, "sunset");
  assert.equal(sunset.kind, "found");
  assert.deepEqual(engine.sunEvent(sunset.jd, london, "astronomical-dusk"), { kind: "none" });
});

test("sunEvent: the Sun's lower transit, its lowest point, is native's to the bit: London, the night of 21 June 2025", async (t) => {
  const engine = await fresh(t);
  const { cases } = JSON.parse(readFileSync(new URL("helioscope-reference-cases.json", import.meta.url), "utf8"));
  const { lat, lng, elevation, windows } = cases.find((c) => c.label === "venus-2025-06-21-london");
  const place = { lat, lng, elevation };
  // Searched from the sunset, and from the day before's sunrise, as the windows are.
  assert.deepEqual(engine.sunEvent(windows.evening.start, place, "lower-transit"), { kind: "found", jd: windows.evening.end });
  assert.deepEqual(engine.sunEvent(windows.morning.end - 1, place, "lower-transit"), { kind: "found", jd: windows.morning.start });
});

test("solarGeometry: the Sun's and Venus's longitudes, Venus's latitude and its elongation are native's", async (t) => {
  const engine = await fresh(t);
  const result = engine.solarGeometry(T, "venus");
  assert.equal(result.kind, "computed");
  for (const key of ["sunLongitude", "planetLongitude", "planetLatitude", "elongation"]) {
    near(result[key], NATIVE.solar[key], DEGREES, key);
  }
});

test("input Swiss Ephemeris would take is checked before any call (§8, item 9)", async (t) => {
  const engine = await fresh(t);
  const places = [
    { lat: -91 }, // Swiss Ephemeris returns plausible numbers
    { lat: 95 }, // "below the horizon"
    { lat: Number.NaN }, // NaN results
    { lng: 400 }, // the same as 40
    { lng: -181 },
    { elevation: 1_000_000 }, // a NaN limit
    // Taken by swe_vis_limit_mag, refused by swe_heliacal_ut.
    { elevation: 30_000 },
    { elevation: -2_000 },
  ];
  for (const change of places) {
    const place = { ...PLACE, ...change };
    const failed = { kind: "failed", reason: "invalid-input" };
    assert.deepEqual(engine.limitingMagnitude(T, place, "venus"), failed, `${Object.entries(change)}`);
    assert.deepEqual(engine.sunEvent(T, place, "sunset"), failed, `${Object.entries(change)}`);
  }
});

test("dates outside the Moshier ephemeris are refused before any call (§8, item 10)", async (t) => {
  const engine = await fresh(t);
  const failed = { kind: "failed", reason: "invalid-input" };
  // Moshier covers Julian Days 625000.5 to 2818000.5.
  for (const jd of [625_000, 2_818_001, Number.NaN, Infinity]) {
    assert.deepEqual(engine.limitingMagnitude(jd, PLACE, "venus"), failed, String(jd));
    assert.deepEqual(engine.sunEvent(jd, PLACE, "sunset"), failed, String(jd));
    assert.deepEqual(engine.solarGeometry(jd, "venus"), failed, String(jd));
  }
});

test("the Sun, and names Swiss Ephemeris would look up as stars, never reach it (§8, item 11)", async (t) => {
  const engine = await fresh(t);
  for (const name of ["sun", "moon", "Venus", "sirius", "earth"]) {
    assert.throws(() => engine.limitingMagnitude(T, PLACE, name), /planet/, name);
    assert.throws(() => engine.solarGeometry(T, name), /planet/, name);
  }
  assert.throws(() => engine.sunEvent(T, PLACE, "noon"), /event/);
});

test("visLimitResult: a result that isn't finite, or an error, is a failure", () => {
  const raw = {
    ret: 0,
    dret: [Number.NaN, 30.4, 221.6, -8.9, 248.8, 42.4, 89, -4.5],
    serr: "",
    datm: [1012.05, 14.935, 40, 0],
    dobs: [36, 1, 1, 1, 0, 0],
    object: "venus",
  };
  assert.deepEqual(visLimitResult(raw), { kind: "failed", reason: "not-finite", raw });
  const pressure = { ...raw, dret: [3.01, ...raw.dret.slice(1)], datm: [Infinity, 14.935, 40, 0] };
  assert.deepEqual(visLimitResult(pressure), { kind: "failed", reason: "not-finite", raw: pressure });
  const error = { ...raw, ret: -1, dret: [], serr: "error in swe_calc" };
  assert.deepEqual(visLimitResult(error), { kind: "failed", reason: "engine-error", raw: error });
});

test("dispose: an engine can't be used afterwards", async () => {
  const engine = await createEngine();
  engine.dispose();
  engine.dispose();
  assert.throws(() => engine.limitingMagnitude(T, PLACE, "venus"), /disposed/);
  assert.throws(() => engine.sunEvent(T, PLACE, "sunset"), /disposed/);
});
