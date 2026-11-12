import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createEngine } from "../extension/helioscope-engine.js";

// astro-research's parans-v1 events for the ten bodies, on Swiss Ephemeris's
// DE441 files, written by tools/make-parans-reference.py. The engine follows
// the same conventions on the Moshier ephemeris, so the two differ by the
// ephemeris alone.
const REFERENCE = JSON.parse(readFileSync(new URL("parans-reference.json", import.meta.url), "utf8"));

// The largest differences from the reference, measured on 10 November 2026
// over the 216 events, with about twice that allowed. They're the ephemeris's:
// astro-research's events agree with ERFA within 7 ms.
const EVENT_SECONDS = {
  moon: 0.25, // 0.118 s, London's almanac moonset
  planets: 0.1, // the Sun and the planets: 0.037 s, Neptune's rising at Tromsø
};
// 9.3e-10°: swe_sidtime gives the ARMC swe_houses_ex2 does.
const ARMC_DEGREES = 1e-8;

// parans-v1 refines each event with a second search started 3 minutes before
// it, so that's where the engine is asked from here too.
const REFINE_LEAD_DAYS = 3 / 1440;

const BODIES = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const PLACE = { lat: 51.5074, lng: -0.1278, elevation: 0 };
const JD = 2460411.1; // 2024-04-10, London's case
const GEOMETRIC = { disc: "centre", refraction: null };

// The reference's names are astro-research's: upper_transit, upper_limb.
const dashed = (name) => name.replaceAll("_", "-");

function horizonOf(name) {
  const { disc, refraction } = REFERENCE.horizons[name];
  return {
    disc: dashed(disc),
    refraction: refraction && { pressure: refraction.pressureHpa, temperature: refraction.temperatureC },
  };
}

function placeOf(reference) {
  return { lat: reference.lat, lng: reference.lng, elevation: reference.elevation };
}

async function fresh(t) {
  const engine = await createEngine();
  t.after(() => engine.dispose());
  return engine;
}

test("angularEvent: every event of the ten bodies is within the tolerance of astro-research's", async (t) => {
  const engine = await fresh(t);
  for (const reference of REFERENCE.cases) {
    const place = placeOf(reference);
    const horizon = horizonOf(reference.horizon);
    for (const { point, event, jdUt } of reference.events) {
      const label = `${reference.name}: ${point} ${event}`;
      const found = engine.angularEvent(jdUt - REFINE_LEAD_DAYS, place, point, dashed(event), horizon);
      assert.equal(found.kind, "found", label);
      const seconds = Math.abs(found.jd - jdUt) * 86400;
      const allowed = point === "moon" ? EVENT_SECONDS.moon : EVENT_SECONDS.planets;
      assert.ok(seconds <= allowed, `${label}: ${seconds.toFixed(3)} s from astro-research's, more than ${allowed} s`);
    }
  }
});

test("angularEvent: a rising or setting that doesn't happen is none, as in astro-research: Tromsø at the June solstice", async (t) => {
  const engine = await fresh(t);
  for (const reference of REFERENCE.cases.filter((c) => c.noRiseOrSet.length > 0)) {
    for (const [point, event] of reference.noRiseOrSet) {
      const found = engine.angularEvent(reference.window.startJdUt, placeOf(reference), point, event, horizonOf(reference.horizon));
      assert.deepEqual(found, { kind: "none" }, `${reference.name}: ${point} ${event}`);
    }
  }
});

test("armc: at each event's own time, within the tolerance of astro-research's apparent ARMC", async (t) => {
  const engine = await fresh(t);
  for (const reference of REFERENCE.cases) {
    for (const { point, event, jdUt, armc } of reference.events) {
      const result = engine.armc(jdUt, placeOf(reference));
      assert.equal(result.kind, "computed");
      const gap = Math.abs(((result.armc - armc + 540) % 360) - 180);
      assert.ok(gap <= ARMC_DEGREES, `${reference.name}: ${point} ${event}: ${gap}° from ${armc}`);
      assert.ok(result.armc >= 0 && result.armc < 360, `${result.armc} is in [0, 360)`);
    }
  }
});

test("angularEvent: the refraction changes the rising and setting, never the transits", async (t) => {
  const engine = await fresh(t);
  const almanac = horizonOf("almanac");
  const at = (event, horizon) => engine.angularEvent(JD, PLACE, "sun", event, horizon).jd;
  assert.ok(at("rise", almanac) < at("rise", GEOMETRIC), "an almanac sunrise is earlier");
  assert.ok(at("set", almanac) > at("set", GEOMETRIC), "an almanac sunset is later");
  assert.equal(at("upper-transit", almanac), at("upper-transit", GEOMETRIC));
  assert.equal(at("lower-transit", almanac), at("lower-transit", GEOMETRIC));
  // The lower limb rises after the centre, which rises after the upper limb.
  const rise = (disc) => at("rise", { disc, refraction: null });
  assert.ok(rise("upper-limb") < rise("centre") && rise("centre") < rise("lower-limb"));
});

test("angularEvent: a body, event or horizon it doesn't know is a mistake in the caller, and throws", async (t) => {
  const engine = await fresh(t);
  const call = (body, event, horizon) => () => engine.angularEvent(JD, PLACE, body, event, horizon);
  for (const body of ["earth", "Sun", "sirius", "mean-node", "chiron"]) {
    assert.throws(call(body, "rise", GEOMETRIC), /body/, body);
  }
  for (const event of ["upper_transit", "culminate", "sunrise"]) {
    assert.throws(call("sun", event, GEOMETRIC), /event/, event);
  }
  const horizons = [
    undefined,
    {},
    { disc: "middle", refraction: null },
    { disc: "centre" },
    { disc: "centre", refraction: null, elevation: 0 },
    // Swiss Ephemeris reads a pressure of 0 as "estimate it from the elevation".
    { disc: "centre", refraction: { pressure: 0, temperature: 10 } },
    { disc: "centre", refraction: { pressure: -1, temperature: 10 } },
    { disc: "centre", refraction: { pressure: Number.NaN, temperature: 10 } },
    { disc: "centre", refraction: { pressure: 1013.25, temperature: -273.15 } },
    { disc: "centre", refraction: { pressure: 1013.25, temperature: Infinity } },
    { disc: "centre", refraction: { pressure: 1013.25 } },
    { disc: "centre", refraction: { pressure: 1013.25, temperature: 10, humidity: 40 } },
  ];
  for (const horizon of horizons) {
    assert.throws(call("sun", "rise", horizon), /horizon|refraction|disc/, JSON.stringify(horizon));
  }
});

test("angularEvent and armc: places and dates Swiss Ephemeris would take are refused before any call", async (t) => {
  const engine = await fresh(t);
  const failed = { kind: "failed", reason: "invalid-input" };
  for (const change of [{ lat: -91 }, { lat: Number.NaN }, { lng: 400 }, { lng: -181 }, { elevation: 30_000 }]) {
    const place = { ...PLACE, ...change };
    assert.deepEqual(engine.angularEvent(JD, place, "moon", "rise", GEOMETRIC), failed, `${Object.entries(change)}`);
    assert.deepEqual(engine.armc(JD, place), failed, `${Object.entries(change)}`);
  }
  // Moshier covers Julian Days 625000.5 to 2818000.5.
  for (const jd of [625_000, 2_818_001, Number.NaN, Infinity]) {
    assert.deepEqual(engine.angularEvent(jd, PLACE, "pluto", "set", GEOMETRIC), failed, String(jd));
    assert.deepEqual(engine.armc(jd, PLACE), failed, String(jd));
  }
});

test("angularEvent: every body the reference covers is one the engine takes", () => {
  assert.deepEqual(REFERENCE.bodies, BODIES);
  assert.equal(REFERENCE.astroResearch.timeScale, "clock_as_ut1");
});

// ---- Ceres, from the asteroid files in vendor/swisseph/ephe/ ---------------

const EPHE = new URL("../extension/vendor/swisseph/ephe/", import.meta.url);
const CERES_FILES = ["seas_12.se1", "seas_18.se1", "seas_24.se1"];
const filesOf = (names) => Object.fromEntries(names.map((name) => [name, new Uint8Array(readFileSync(new URL(name, EPHE)))]));

async function withFiles(t, names) {
  const engine = await createEngine({ ephemerisFiles: filesOf(names) });
  t.after(() => engine.dispose());
  return engine;
}

const EVENTS = ["rise", "set", "upper-transit", "lower-transit"];
// Julian Days (UT): the first Gregorian day, and a day each side of 1 January 1800, where seas_12 ends and seas_18 begins.
const OCTOBER_1582 = 2299161;
const LATE_1799 = 2378495.5;
const EARLY_1800 = 2378497.5;

test("angularEvent: Ceres's four events, with its files, come in the next day, its transits half a sidereal day apart", async (t) => {
  const engine = await withFiles(t, CERES_FILES);
  const found = Object.fromEntries(EVENTS.map((event) => [event, engine.angularEvent(JD, PLACE, "ceres", event, GEOMETRIC)]));
  for (const [event, result] of Object.entries(found)) {
    assert.equal(result.kind, "found", event);
    assert.ok(result.jd > JD && result.jd < JD + 1.01, `${event}: ${result.jd}`);
  }
  // Ceres moves about 0.2° a day, so its transits are 11 h 58 min apart, give or take a minute.
  const apart = Math.abs(found["lower-transit"].jd - found["upper-transit"].jd);
  const halfSiderealDay = 0.5 / 1.0027379;
  assert.ok(Math.abs(Math.min(apart, 1 / 1.0027379 - apart) - halfSiderealDay) < 1 / 1440, `${apart * 24} h`);
});

test("angularEvent: Ceres without its file for that date fails, naming no-ephemeris-file, and isn't taken for a missing rising", async (t) => {
  const none = await fresh(t);
  const failed = none.angularEvent(JD, PLACE, "ceres", "rise", GEOMETRIC);
  assert.equal(failed.kind, "failed");
  assert.equal(failed.reason, "no-ephemeris-file");
  assert.match(failed.serr, /seas_18\.se1/);
  // seas_18 alone covers 1800 to 2399: the day before, Ceres needs seas_12.
  const onlyOne = await withFiles(t, ["seas_18.se1"]);
  assert.equal(onlyOne.angularEvent(EARLY_1800, PLACE, "ceres", "upper-transit", GEOMETRIC).kind, "found");
  const before = onlyOne.angularEvent(LATE_1799, PLACE, "ceres", "upper-transit", GEOMETRIC);
  assert.equal(before.reason, "no-ephemeris-file");
  assert.match(before.serr, /seas_12\.se1/);
});

test("angularEvent: with Ceres's three files, it's worked out from the first Gregorian day to the end of 2999", async (t) => {
  const engine = await withFiles(t, CERES_FILES);
  // 2999-12-31, a day before the window the parans page would refuse.
  for (const jd of [OCTOBER_1582, LATE_1799, EARLY_1800, 2816786.5]) {
    assert.equal(engine.angularEvent(jd, PLACE, "ceres", "upper-transit", GEOMETRIC).kind, "found", String(jd));
  }
});

test("angularEvent: mounting the files changes nothing for the ten bodies, which stay on Moshier", async (t) => {
  const plain = await fresh(t);
  const mounted = await withFiles(t, CERES_FILES);
  for (const reference of REFERENCE.cases) {
    const place = placeOf(reference);
    const horizon = horizonOf(reference.horizon);
    for (const { point, event, jdUt } of reference.events) {
      const from = jdUt - REFINE_LEAD_DAYS;
      assert.deepEqual(
        mounted.angularEvent(from, place, point, dashed(event), horizon),
        plain.angularEvent(from, place, point, dashed(event), horizon),
        `${reference.name}: ${point} ${event}`,
      );
    }
  }
});

// Native Swiss Ephemeris's Ceres, pysweph on the same files with the same
// Moshier setting, written by tools/make-asteroid-reference.py for
// test/parans-reference.json's six cases.
const ASTEROIDS = JSON.parse(readFileSync(new URL("parans-asteroid-reference.json", import.meta.url), "utf8"));
// Measured on 12 November 2026 over the 20 events: the culminations are
// native's exactly, and the risings and settings at most 9.6 ms from it
// (Sydney's), where the ten bodies' are native's exactly too. Ceres's
// position is native's to about 1e-12°, so it's swe_rise_trans's search:
// reading swecl.c, asteroids take its slower method, which stops within a
// few milliseconds, and a last digit can move where. About 2.5 times that
// is allowed.
const ASTEROID_SECONDS = { "rise-set": 0.025, transits: 1e-3 };

test("angularEvent: Ceres's events are native Swiss Ephemeris's, on the same files, in all six cases", async (t) => {
  assert.deepEqual(Object.keys(ASTEROIDS.files), CERES_FILES);
  for (const [name, sha256] of Object.entries(ASTEROIDS.files)) {
    assert.equal(createHash("sha256").update(readFileSync(new URL(name, EPHE))).digest("hex"), sha256, `${name} is the file the reference used`);
  }
  const engine = await withFiles(t, CERES_FILES);
  let compared = 0;
  for (const result of ASTEROIDS.results) {
    const place = placeOf(result);
    const horizon = horizonOf(result.horizon);
    for (const { point, event, jdUt } of result.events) {
      const label = `${result.name}: ${point} ${event}`;
      const found = engine.angularEvent(jdUt - REFINE_LEAD_DAYS, place, point, event, horizon);
      assert.equal(found.kind, "found", label);
      const allowed = event.endsWith("transit") ? ASTEROID_SECONDS.transits : ASTEROID_SECONDS["rise-set"];
      const seconds = Math.abs(found.jd - jdUt) * 86400;
      assert.ok(seconds <= allowed, `${label}: ${seconds} s from native's`);
      compared += 1;
    }
    // What native says doesn't happen doesn't happen here either: Ceres never rises at Tromsø that day.
    for (const [point, event] of result.noRiseOrSet) {
      assert.deepEqual(engine.angularEvent(result.window.startJdUt, place, point, event, horizon), { kind: "none" }, `${result.name}: ${point} ${event}`);
    }
  }
  assert.equal(compared, 20);
});

test("createEngine: its assumptions name the files it mounted, and files that aren't .se1 files by name with their bytes are refused", async (t) => {
  assert.deepEqual((await fresh(t)).assumptions.ephemerisFiles, []);
  assert.deepEqual((await withFiles(t, ["seas_24.se1", "seas_12.se1"])).assumptions.ephemerisFiles, ["seas_12.se1", "seas_24.se1"]);
  const bytes = new Uint8Array([1]);
  for (const ephemerisFiles of [null, [], "seas_18.se1", { "../seas_18.se1": bytes }, { "seas_18.txt": bytes },
    { "SEAS_18.SE1": bytes }, { "seas_18.se1": [1, 2] }, { "seas_18.se1": new Uint8Array() }]) {
    await assert.rejects(createEngine({ ephemerisFiles }), /ephemerisFiles|\.se1|bytes/, JSON.stringify(ephemerisFiles));
  }
});
