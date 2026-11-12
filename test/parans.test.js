import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { julianDay } from "../extension/core/stellarium-desktop.js";
import { BODIES, DWARF_PLANETS, PLANETS, angularEvents, paranGaps } from "../extension/core/parans.js";
import { createEngine } from "../extension/helioscope-engine.js";

// astro-research's parans-v1 events and gaps for the ten bodies, written by
// tools/make-parans-reference.py.
const REFERENCE = JSON.parse(readFileSync(new URL("parans-reference.json", import.meta.url), "utf8"));

// test/parans-engine.test.js's tolerances: the engine's events are the
// reference's to within them, measured there.
const EVENT_SECONDS = { moon: 0.25, planets: 0.1 };
// astro-research's gaps are in TT, these in UT, so they differ by how much
// delta-T changes between the two events: at most 1.33 ms over the 3,576 gaps,
// for 23 hours in Sydney in 1987 (measured on 10 November 2026).
const UT_FOR_TT_SECONDS = 3e-3;

const DAY_SECONDS = 86400;
const MINUTE = 1 / 1440;
const LEAD = 3 / 1440;
const GEOMETRIC = { disc: "centre", refraction: null };

const dashed = (name) => name.replaceAll("_", "-");

function horizonOf(name) {
  const { disc, refraction } = REFERENCE.horizons[name];
  return {
    disc: dashed(disc),
    refraction: refraction && { pressure: refraction.pressureHpa, temperature: refraction.temperatureC },
  };
}

const natal = (utc, lat, lng) => ({ kind: "natal", utc, utcSource: "printed-utc", lat, lng });

// ---- Ceres, with the real engine and its files ----------------------------

// Native Swiss Ephemeris's Ceres, as test/parans-engine.test.js compares the
// engine with it, there with the same tolerance.
const ASTEROIDS = JSON.parse(readFileSync(new URL("parans-asteroid-reference.json", import.meta.url), "utf8"));
const ASTEROID_SECONDS = 0.025;
const ephemerisFiles = () => Object.fromEntries(Object.keys(ASTEROIDS.files).map((name) => [
  name,
  new Uint8Array(readFileSync(new URL(`../extension/vendor/swisseph/ephe/${name}`, import.meta.url))),
]));

test("angularEvents: the dwarf planets' events, with their files, are native Swiss Ephemeris's, and the files are named in the assumptions", async (t) => {
  const engine = await createEngine({ ephemerisFiles: ephemerisFiles() });
  t.after(() => engine.dispose());
  for (const reference of ASTEROIDS.results) {
    const result = angularEvents(natal(reference.utc, reference.lat, reference.lng), engine, {
      bodies: ["sun", ...DWARF_PLANETS],
      horizon: horizonOf(reference.horizon),
    });
    assert.equal(result.kind, "events", reference.name);
    for (const body of DWARF_PLANETS) {
      const label = `${reference.name}: ${body}`;
      const ours = result.events.filter(({ point }) => point === body);
      const native = reference.events.filter(({ point }) => point === body);
      assert.deepEqual(ours.map(({ event }) => event), native.map(({ event }) => event), label);
      ours.forEach(({ jd, event }, i) => {
        const seconds = Math.abs(jd - native[i].jdUt) * DAY_SECONDS;
        assert.ok(seconds <= ASTEROID_SECONDS, `${label} ${event}: ${seconds} s from native's`);
      });
      const missing = result.noRiseOrSet.filter(({ point }) => point === body).map(({ event }) => event);
      assert.deepEqual(missing, reference.noRiseOrSet.filter(([point]) => point === body).map(([, event]) => event), label);
    }
    assert.deepEqual(result.assumptions.ephemerisFiles, Object.keys(ASTEROIDS.files));
  }
});

test("angularEvents: Ceres without its files fails the whole result, naming Ceres and the missing file", async (t) => {
  const engine = await createEngine();
  t.after(() => engine.dispose());
  const [reference] = ASTEROIDS.results;
  const result = angularEvents(natal(reference.utc, reference.lat, reference.lng), engine, { bodies: ["sun", "ceres"], horizon: GEOMETRIC });
  assert.equal(result.kind, "failed");
  assert.equal(result.point, "ceres");
  assert.equal(result.event, "rise");
  assert.equal(result.failure.reason, "no-ephemeris-file");
});

// ---- Against astro-research, with the real engine -------------------------

test("angularEvents: the events of the ten bodies are astro-research's, within the engine's tolerance, in all six cases", async (t) => {
  const engine = await createEngine();
  t.after(() => engine.dispose());
  for (const reference of REFERENCE.cases) {
    const result = angularEvents(natal(reference.utc, reference.lat, reference.lng), engine, {
      bodies: PLANETS,
      horizon: horizonOf(reference.horizon),
    });
    assert.equal(result.kind, "events", reference.name);
    assert.ok(Math.abs(result.window.start.jd - reference.window.startJdUt) < 1e-9, `${reference.name}: window start`);
    assert.ok(Math.abs(result.window.end.jd - reference.window.endJdUt) < 1e-9, `${reference.name}: window end`);
    assert.equal(result.events.length, reference.events.length, `${reference.name}: how many events`);
    // Matched by point and event, not by position: two events a tenth of a
    // second apart can swap places.
    const unmatched = [...result.events];
    for (const { point, event, jdUt } of reference.events) {
      const label = `${reference.name}: ${point} ${event}`;
      const candidates = unmatched.filter((e) => e.point === point && e.event === dashed(event));
      assert.ok(candidates.length > 0, `${label} is missing`);
      const nearest = candidates.reduce((a, b) => (Math.abs(a.jd - jdUt) <= Math.abs(b.jd - jdUt) ? a : b));
      const seconds = Math.abs(nearest.jd - jdUt) * DAY_SECONDS;
      const allowed = point === "moon" ? EVENT_SECONDS.moon : EVENT_SECONDS.planets;
      assert.ok(seconds <= allowed, `${label}: ${seconds.toFixed(3)} s from astro-research's`);
      unmatched.splice(unmatched.indexOf(nearest), 1);
    }
    assert.deepEqual(unmatched, [], `${reference.name}: events astro-research doesn't have`);
    assert.deepEqual(
      result.noRiseOrSet.map(({ point, event }) => [point, event]).sort(),
      reference.noRiseOrSet,
      `${reference.name}: no rising or setting`,
    );
    for (let i = 1; i < result.events.length; i += 1) {
      assert.ok(result.events[i - 1].jd <= result.events[i].jd, `${reference.name}: in time order`);
    }
  }
});

test("paranGaps: on astro-research's own events, its gaps, pair for pair and in its order", () => {
  for (const reference of REFERENCE.cases) {
    const events = reference.events.map(({ point, event, jdUt, armc }) => ({ point, event: dashed(event), jd: jdUt, armc }));
    const gaps = paranGaps({ kind: "events", events });
    assert.equal(gaps.length, reference.gaps.length, reference.name);
    gaps.forEach((gap, n) => {
      const [i, j, seconds, armc] = reference.gaps[n];
      assert.equal(gap.first, events[i], `${reference.name}: gap ${n}'s first`);
      assert.equal(gap.second, events[j], `${reference.name}: gap ${n}'s second`);
      assert.equal(gap.armc, armc, `${reference.name}: gap ${n}'s ARMC`);
      assert.ok(Math.abs(gap.seconds - seconds) <= UT_FOR_TT_SECONDS, `${reference.name}: gap ${n}: ${gap.seconds} s, not ${seconds}`);
    });
  }
});

test("angularEvents: the result says what it assumed, and that it isn't astro-research's own", async (t) => {
  const engine = await createEngine();
  t.after(() => engine.dispose());
  const reference = REFERENCE.cases[0];
  const result = angularEvents(natal(reference.utc, reference.lat, reference.lng), engine, { bodies: ["sun"], horizon: GEOMETRIC });
  assert.equal(result.conventions, "parans-v1, on the Moshier ephemeris, with the UTC as UT");
  assert.deepEqual(result.assumptions, {
    swissEphemeris: "2.10.03",
    ephemeris: "moshier",
    ephemerisFiles: [],
    timeScale: "utc-as-ut",
    windowHours: 12,
    refineLeadMinutes: 3,
    elevation: { metres: 0, source: "default" },
  });
  assert.deepEqual(result.place, { lat: reference.lat, lng: reference.lng, elevation: 0 });
  assert.deepEqual(result.horizon, GEOMETRIC);
  assert.deepEqual(result.bodies, ["sun"]);
  assert.equal(result.window.start.utc, "2024-04-10T02:30:00Z");
  assert.equal(result.window.end.utc, "2024-04-11T02:30:00Z");
  assert.ok(result.events.every((e) => typeof e.utc === "string"));
});

// ---- The search, with a scripted engine -----------------------------------

const UTC = "2024-04-10T12:00:00Z";
const BIRTH = julianDay(UTC);
const START = BIRTH - 0.5;
const END = BIRTH + 0.5;
const PLACE = natal(UTC, 51.5, -0.13);

// An event of one body recurring every period days from at. A search finds
// the first one it would place after where it starts, error days late, as
// swe_rise_trans's first search can be a few seconds off. The refining search,
// from 3 minutes before what the last search found, finds that one exactly.
// Options change that: none: no event at all; noneBefore: none for searches
// from before that day; refinedNone: the refining search finds nothing;
// refinedTo: it finds that day; failed: the engine fails.
function scriptedEngine(script) {
  const calls = [];
  const last = new Map();
  const spec = (body, event) => {
    const found = script[`${body} ${event}`];
    if (found === undefined) throw new Error(`the script has no ${body} ${event}`);
    return found;
  };
  return {
    calls,
    assumptions: { swissEphemeris: "scripted", ephemeris: "moshier" },
    angularEvent(from, place, body, event, horizon) {
      calls.push({ from, body, event });
      assert.deepEqual(horizon, GEOMETRIC);
      const key = `${body} ${event}`;
      const s = spec(body, event);
      if (s.failed) return { kind: "failed", reason: "engine-error", serr: "scripted" };
      const error = s.error ?? 0;
      const period = s.period ?? 0.9973;
      if (last.has(key) && Math.abs(from - (last.get(key).returned - LEAD)) < 1e-9) {
        if (s.refinedNone) return { kind: "none" };
        return { kind: "found", jd: s.refinedTo ?? last.get(key).jd };
      }
      if (s.none || from < (s.noneBefore ?? -Infinity)) return { kind: "none" };
      for (let k = Math.floor((from - s.at) / period) - 1; ; k += 1) {
        const jd = s.at + k * period;
        if (jd + error > from) {
          last.set(key, { jd, returned: jd + error });
          return { kind: "found", jd: jd + error };
        }
      }
    },
    armc(jd) {
      if (script.armcFails) return { kind: "failed", reason: "not-finite" };
      return { kind: "computed", armc: (((jd - BIRTH) * 360.9856) % 360 + 360) % 360 };
    },
  };
}

// Every event of each body once a day at its own hour, with changes.
function dailyScript(bodies, changes = {}) {
  const script = {};
  for (const [n, body] of bodies.entries()) {
    script[`${body} rise`] = { at: START + 0.1 + n * 0.01 };
    script[`${body} set`] = { at: START + 0.6 + n * 0.01 };
    script[`${body} upper-transit`] = { at: START + 0.35 + n * 0.01 };
    script[`${body} lower-transit`] = { at: START + 0.85 + n * 0.01 };
  }
  return { ...script, ...changes };
}

const run = (engine, bodies, chart = PLACE) => angularEvents(chart, engine, { bodies, horizon: GEOMETRIC });
const found = (result, body, event) => result.events.filter((e) => e.point === body && e.event === event);

test("angularEvents: each event is the refining search's, from 3 minutes before the first one's", () => {
  const at = START + 0.1;
  const engine = scriptedEngine(dailyScript(["mars"], { "mars rise": { at, error: 2 / DAY_SECONDS } }));
  const result = run(engine, ["mars"]);
  assert.deepEqual(found(result, "mars", "rise").map((e) => e.jd), [at]);
  const searches = engine.calls.filter((c) => c.event === "rise").map((c) => c.from);
  assert.deepEqual(searches.slice(0, 2), [START, at + 2 / DAY_SECONDS - LEAD]);
});

test("angularEvents: a refining search that finds nothing keeps the first search's event", () => {
  const at = START + 0.2;
  const engine = scriptedEngine(dailyScript(["mars"], { "mars set": { at, error: 1e-5, refinedNone: true } }));
  assert.deepEqual(found(run(engine, ["mars"]), "mars", "set").map((e) => e.jd), [at + 1e-5]);
});

test("angularEvents: the window is [start, end): an event the refining search moves before the start is left out, as is one at the end", () => {
  const engine = scriptedEngine(dailyScript(["sun", "mars", "venus"], {
    // Found 1 s after the start, then refined to 1 s before it. The next one
    // is after the end.
    "sun rise": { at: START - 1 / DAY_SECONDS, error: 2 / DAY_SECONDS, period: 1.2 },
    // Refined to 1 s after the start.
    "mars rise": { at: START + 1 / DAY_SECONDS, error: 2 / DAY_SECONDS, period: 1.2 },
    "venus set": { at: END, period: 1.2 },
    "venus rise": { at: END - 1 / DAY_SECONDS, period: 1.2 },
  }));
  const result = run(engine, ["sun", "mars", "venus"]);
  assert.deepEqual(found(result, "sun", "rise"), []);
  assert.deepEqual(found(result, "mars", "rise").map((e) => e.jd), [START + 1 / DAY_SECONDS]);
  assert.deepEqual(found(result, "venus", "set"), []);
  assert.deepEqual(found(result, "venus", "rise").map((e) => e.jd), [END - 1 / DAY_SECONDS]);
});

test("angularEvents: two of one event in the window are both found, a minute apart or more", () => {
  // A star-like body: rising every 23 h 56 m, first just after the start.
  const engine = scriptedEngine(dailyScript(["jupiter"], { "jupiter rise": { at: START + 0.001, period: 0.99727 } }));
  const rises = found(run(engine, ["jupiter"]), "jupiter", "rise").map((e) => e.jd);
  assert.deepEqual(rises, [START + 0.001, START + 0.001 + 0.99727]);
});

test("angularEvents: a rising that doesn't happen is noted once, and the search goes on from after the next upper transit", () => {
  // The Moon doesn't rise until after the first upper transit of the day.
  const transit = START + 0.35;
  const engine = scriptedEngine(dailyScript(["moon"], {
    "moon rise": { at: START + 0.6, noneBefore: transit },
    "moon upper-transit": { at: transit },
  }));
  const result = run(engine, ["moon"]);
  assert.deepEqual(result.noRiseOrSet, [{ point: "moon", event: "rise" }]);
  assert.deepEqual(found(result, "moon", "rise").map((e) => e.jd), [START + 0.6]);
  const rises = engine.calls.filter((c) => c.event === "rise").map((c) => c.from);
  assert.equal(rises[1], transit + MINUTE);
});

test("angularEvents: with no rising and no upper transit before the end, the search stops", () => {
  const engine = scriptedEngine(dailyScript(["pluto"], {
    "pluto rise": { none: true },
    "pluto set": { none: true },
    // The one before is long before the start.
    "pluto upper-transit": { at: END + 0.1, period: 30 },
  }));
  const result = run(engine, ["pluto"]);
  assert.deepEqual(result.noRiseOrSet, [{ point: "pluto", event: "rise" }, { point: "pluto", event: "set" }]);
  assert.deepEqual(found(result, "pluto", "rise"), []);
  assert.equal(engine.calls.filter((c) => c.event === "rise").length, 1);
});

test("angularEvents: each event carries the ARMC at its own instant", () => {
  const engine = scriptedEngine(dailyScript(["saturn"]));
  for (const e of run(engine, ["saturn"]).events) {
    assert.equal(e.armc, engine.armc(e.jd).armc, `${e.point} ${e.event}`);
  }
});

test("angularEvents: events at the same instant keep the bodies' order, then rise, set, upper and lower transit", () => {
  const at = START + 0.4;
  const same = { "rise": { at }, "set": { at }, "upper-transit": { at }, "lower-transit": { at } };
  const script = {};
  for (const body of ["venus", "mars"]) for (const [event, spec] of Object.entries(same)) script[`${body} ${event}`] = spec;
  const order = run(scriptedEngine(script), ["venus", "mars"]).events.map((e) => `${e.point} ${e.event}`);
  assert.deepEqual(order, [
    "venus rise", "venus set", "venus upper-transit", "venus lower-transit",
    "mars rise", "mars set", "mars upper-transit", "mars lower-transit",
  ]);
});

test("angularEvents: any failure fails the whole result, naming the body and event, with nothing partial", () => {
  const failed = run(scriptedEngine(dailyScript(["sun", "moon"], { "moon set": { failed: true } })), ["sun", "moon"]);
  assert.deepEqual(failed, { kind: "failed", point: "moon", event: "set", failure: { kind: "failed", reason: "engine-error", serr: "scripted" } });
  const transit = run(scriptedEngine(dailyScript(["sun"], { "sun rise": { none: true }, "sun upper-transit": { failed: true } })), ["sun"]);
  assert.deepEqual(transit, { kind: "failed", point: "sun", event: "rise", failure: { kind: "failed", reason: "engine-error", serr: "scripted" } });
  const armc = run(scriptedEngine({ ...dailyScript(["sun"]), armcFails: true }), ["sun"]);
  assert.deepEqual(armc, { kind: "failed", point: "sun", event: "rise", failure: { kind: "failed", reason: "not-finite" } });
});

test("angularEvents: a search that would go back in time fails instead of looping", () => {
  // The refining search lands half a day before the first search's event.
  const engine = scriptedEngine(dailyScript(["mars"], { "mars rise": { at: START + 0.1, error: 1e-5, refinedTo: START - 0.4 } }));
  assert.deepEqual(run(engine, ["mars"]), { kind: "failed", point: "mars", event: "rise", failure: { kind: "failed", reason: "search-stalled" } });
});

// ---- Charts and arguments -------------------------------------------------

test("angularEvents: charts it can't take are refused before the engine is called", () => {
  const engine = scriptedEngine({});
  const cases = [
    [{ ...PLACE, kind: "transit" }, "not-natal"],
    [null, "not-natal"],
    [{ ...PLACE, utc: null, utcSource: "needs-offset" }, "needs-offset"],
    [{ ...PLACE, utc: null, utcSource: "needs-choice" }, "needs-choice"],
    [{ ...PLACE, lat: 91 }, "invalid-coordinates"],
    [{ ...PLACE, lng: Number.NaN }, "invalid-coordinates"],
    [{ ...PLACE, lat: 90 }, "at-pole"],
    [{ ...PLACE, lat: -90 }, "at-pole"],
    // The window, birth ±12 hours, has to fit: from 1582-10-15 until 3000.
    [{ ...PLACE, utc: "1582-10-15T06:00:00Z" }, "date-out-of-range"],
    [{ ...PLACE, utc: "2999-12-31T18:00:00Z" }, "date-out-of-range"],
  ];
  for (const [chart, reason] of cases) {
    assert.deepEqual(run(engine, ["sun"], chart), { kind: "refused", reason }, reason);
  }
  for (const elevation of [Number.NaN, -501, 25_001]) {
    assert.deepEqual(angularEvents(PLACE, engine, { bodies: ["sun"], horizon: GEOMETRIC, elevation }), { kind: "refused", reason: "invalid-elevation" });
  }
  assert.deepEqual(engine.calls, []);
  // Just inside: the window starts on 1582-10-15 and ends before 3000.
  for (const utc of ["1582-10-15T12:00:00Z", "2999-12-31T11:00:00Z"]) {
    const engine = scriptedEngine(dailyScript(["sun"]));
    assert.equal(angularEvents({ ...PLACE, utc }, engine, { bodies: ["sun"], horizon: GEOMETRIC }).kind, "events", utc);
  }
});

test("angularEvents: an elevation given is used and said to be given", () => {
  const engine = scriptedEngine(dailyScript(["sun"]));
  const result = angularEvents(PLACE, engine, { bodies: ["sun"], horizon: GEOMETRIC, elevation: 120 });
  assert.equal(result.place.elevation, 120);
  assert.deepEqual(result.assumptions.elevation, { metres: 120, source: "given" });
});

test("angularEvents: bodies are a list of the ten and the dwarf planets, each once; anything else is a mistake in the caller", () => {
  assert.deepEqual(PLANETS, ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]);
  assert.deepEqual(DWARF_PLANETS, ["ceres", "eris", "makemake", "haumea", "varuna", "ixion", "orcus", "sedna"]);
  assert.deepEqual(BODIES, [...PLANETS, ...DWARF_PLANETS]);
  const engine = scriptedEngine({});
  for (const bodies of [[], ["sun", "sun"], ["earth"], ["Sun"], "sun", undefined]) {
    assert.throws(() => run(engine, bodies), /bod/, JSON.stringify(bodies));
  }
});

// ---- Gaps -----------------------------------------------------------------

test("paranGaps: every pair of events of two different points, earlier first, with the ARMC gap in (-180, 180]", () => {
  const events = [
    { point: "sun", event: "rise", jd: 10, armc: 350 },
    { point: "sun", event: "upper-transit", jd: 10.25, armc: 80 },
    { point: "moon", event: "rise", jd: 10.5, armc: 170 },
    { point: "mars", event: "set", jd: 10.75, armc: 350 },
  ];
  const gaps = paranGaps({ kind: "events", events }).map((g) => [events.indexOf(g.first), events.indexOf(g.second), g.seconds, g.armc]);
  assert.deepEqual(gaps, [
    // sun rise and sun upper-transit are one point's, so no gap
    [0, 2, 0.5 * DAY_SECONDS, 180], // 170 - 350 = -180, which wraps to 180
    [0, 3, 0.75 * DAY_SECONDS, 0],
    [1, 2, 0.25 * DAY_SECONDS, 90],
    [1, 3, 0.5 * DAY_SECONDS, -90], // 350 - 80 = 270
    [2, 3, 0.25 * DAY_SECONDS, 180],
  ]);
});

test("paranGaps: only a result with events has gaps", () => {
  assert.throws(() => paranGaps({ kind: "refused", reason: "not-natal" }), /events/);
});
