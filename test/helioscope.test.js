import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  apparition,
  classify,
  conditionLimitsFit,
  DEFAULT_CONDITION_LIMITS,
  longitudeGap,
  sampleInstants,
  traditionalCondition,
  visibility,
} from "../extension/core/helioscope.js";
import { createEngine } from "../extension/helioscope-engine.js";

// Native Swiss Ephemeris for Venus from New York, and gate 4's tolerances, as
// in helioscope-engine.test.js.
const NATIVE = JSON.parse(readFileSync(new URL("helioscope-venus-new-york.json", import.meta.url), "utf8"));
const MAGNITUDES = 1e-8;
const DEGREES = 2e-7;
const FILLED_IN = 1e-12;

// The proof of concept's chart, 5:35 pm EST in New York, as the paste page gives it.
const CHART = {
  kind: "natal",
  site: "text",
  local: "2025-01-10T17:35:00",
  zoneLabel: null,
  lat: 40.7128,
  lng: -74.006,
  utc: "2025-01-10T22:35:00Z",
  utcSource: "declared",
  offsetMinutes: -300,
};

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is more than ${tolerance} from ${expected}`);
}

async function venusFor(chart, options) {
  const engine = await createEngine();
  try {
    return visibility(chart, "venus", engine, options);
  } finally {
    engine.dispose();
  }
}

// New York at 10 m, the elevation the reference cases used.
const VENUS = await venusFor(CHART, { elevation: 10 });
const { evening: EVENING, morning: MORNING } = NATIVE.windows;
const margin = (sample) => sample.dret[0] - sample.dret[7];
const BEST = EVENING.samples.filter((s) => s.ret >= 0).reduce((a, b) => (margin(b) > margin(a) ? b : a));

// Any use of this engine fails the test.
const UNUSED = new Proxy({}, {
  get(_, key) {
    throw new Error(`the engine's ${String(key)} was used`);
  },
});

test("visibility, Venus from New York on 10 January 2025: one result for the chart's instant and place", () => {
  assert.deepEqual(Object.keys(VENUS), ["kind", "planet", "at", "place", "solar", "windows", "classification", "assumptions"]);
  assert.equal(VENUS.kind, "visibility");
  assert.equal(VENUS.planet, "venus");
  assert.deepEqual(VENUS.at, { jd: NATIVE.case.jd, utc: "2025-01-10T22:35:00Z" });
  assert.deepEqual(VENUS.place, { lat: 40.7128, lng: -74.006, elevation: 10 });
});

test("visibility, Venus from New York: the evening window runs from sunset to the end of astronomical twilight, sampled every 2 minutes", () => {
  const { best, ...window } = VENUS.windows.evening;
  assert.deepEqual(window, {
    kind: "evaluated",
    start: { jd: EVENING.start, utc: "2025-01-10T21:48:32Z", event: "sunset" },
    end: { jd: EVENING.end, utc: "2025-01-10T23:25:36Z", event: "astronomical-dusk" },
    samples: 50,
    aboveHorizon: 50,
  });
});

test("visibility, Venus from New York: the best evening sample is native's, at 23:14:32 UTC, scotopic, a margin of +9.01", () => {
  const { best } = VENUS.windows.evening;
  assert.equal(best.jd, BEST.jd);
  assert.equal(best.utc, "2025-01-10T23:14:32Z");
  near(best.margin, margin(BEST), MAGNITUDES, "margin");
  near(best.limitingMagnitude, BEST.dret[0], MAGNITUDES, "limiting magnitude");
  near(best.objectMagnitude, BEST.dret[7], MAGNITUDES, "Venus's magnitude");
  near(best.altitude, BEST.dret[1], DEGREES, "altitude");
  near(best.azimuth, BEST.dret[2], DEGREES, "azimuth");
  near(best.sunAltitude, BEST.dret[3], DEGREES, "Sun's altitude");
  near(best.moonAltitude, BEST.dret[5], DEGREES, "Moon's altitude");
  assert.equal(best.vision, "scotopic");
  // Swiss Ephemeris's own values travel with it.
  assert.equal(best.raw.ret, BEST.ret);
  assert.equal(best.raw.dret.length, 8);
  assert.equal(best.raw.object, "venus");
  assert.equal(best.raw.serr, "");
});

test("visibility, Venus from New York: in the morning window before sunrise, Venus is below the horizon throughout", () => {
  assert.deepEqual(VENUS.windows.morning, {
    kind: "below-horizon",
    start: { jd: MORNING.start, utc: "2025-01-10T10:42:08Z", event: "astronomical-dawn" },
    end: { jd: MORNING.end, utc: "2025-01-10T12:19:10Z", event: "sunrise" },
    samples: 50,
    aboveHorizon: 0,
  });
});

test("visibility, Venus from New York: predicted detectable, from the evening window", () => {
  const { margin: best, ...classification } = VENUS.classification;
  assert.deepEqual(classification, { kind: "detectable", window: "evening" });
  near(best, margin(BEST), MAGNITUDES, "margin");
});

test("visibility, Venus from New York: the solar condition, elongation and apparition are taken at the chart's instant, apart from visibility", () => {
  const { solar } = VENUS;
  assert.equal(solar.kind, "computed");
  for (const key of ["sunLongitude", "planetLongitude", "planetLatitude", "elongation"]) {
    near(solar[key], NATIVE.solar[key], DEGREES, key);
  }
  near(solar.longitudeGap, NATIVE.solar.planetLongitude - NATIVE.solar.sunLongitude, 2 * DEGREES, "longitude gap");
  assert.equal(solar.condition, "clear");
  assert.equal(solar.apparition, "evening");
});

test("visibility, Venus from New York: the assumptions go with the result", () => {
  const { atmosphere, ...assumptions } = VENUS.assumptions;
  assert.deepEqual(assumptions, {
    swissEphemeris: "2.10.03",
    ephemeris: "moshier",
    helflag: 4,
    moon: "included",
    observer: {
      requested: { age: 0, snellenRatio: 0 },
      completed: { age: 36, snellenRatio: 1, binocular: 1, magnification: 1, aperture: 0, transmission: 0 },
    },
    elevation: { metres: 10, source: "given" },
    windowRule: "astronomical-twilight-or-lower-transit",
    stepMinutes: 2,
    // Degrees: 17′, 8°30′ and 15°.
    conditionLimits: { cazimi: 17 / 60, combust: 8.5, underTheBeams: 15 },
  });
  assert.deepEqual(atmosphere.requested, { pressure: 0, temperature: 0, humidity: 0, meteorologicalRange: 0 });
  // As Swiss Ephemeris filled them in: pressure and temperature for 10 m, 40 % humidity.
  ["pressure", "temperature", "humidity", "meteorologicalRange"].forEach((key, i) => {
    near(atmosphere.completed[key], EVENING.datm[i], FILLED_IN, key);
  });
});

test("visibility: the elevation is 0 m unless one is given, since charts don't carry it", async () => {
  const { assumptions } = await venusFor(CHART);
  assert.deepEqual(assumptions.elevation, { metres: 0, source: "default" });
  // Swiss Ephemeris then fills in the International Standard Atmosphere at sea level.
  assert.equal(assumptions.atmosphere.completed.pressure, 1013.25);
  assert.equal(assumptions.atmosphere.completed.temperature, 15);
});

test("visibility: a chart Helioscope can't evaluate is refused before anything is computed", () => {
  const charts = [
    [{ kind: "refused", reason: "unreadable-page" }, "not-natal"],
    [{ ...CHART, utc: null, utcSource: "needs-offset" }, "needs-offset"],
    [{ ...CHART, utc: null, utcSource: "needs-choice" }, "needs-choice"],
    [{ ...CHART, lat: null }, "invalid-coordinates"],
    [{ ...CHART, lat: 91 }, "invalid-coordinates"],
    [{ ...CHART, lng: -181 }, "invalid-coordinates"],
    // Charts before 1582-10-15 are refused before Helioscope too: their dates
    // are Julian-calendar dates, which julianDay would read as Gregorian.
    [{ ...CHART, utc: "1500-06-01T12:00:00Z" }, "date-out-of-range"],
    // The Moshier ephemeris ends in 3003.
    [{ ...CHART, utc: "3000-01-01T00:00:00Z" }, "date-out-of-range"],
  ];
  for (const [chart, reason] of charts) {
    assert.deepEqual(visibility(chart, "venus", UNUSED, { elevation: 10 }), { kind: "refused", reason }, reason);
  }
  // Swiss Ephemeris takes -2,000 m and 30,000 m; swe_heliacal_ut refuses outside -500 m to 25,000 m.
  for (const elevation of [Number.NaN, -501, 25_001, "10"]) {
    assert.deepEqual(visibility(CHART, "venus", UNUSED, { elevation }), { kind: "refused", reason: "invalid-elevation" }, String(elevation));
  }
});

test("visibility: the condition follows the limits given, and the prediction doesn't: Venus 16.08° west of the Sun on 1 November 2025", async () => {
  const chart = { ...CHART, local: "2025-11-01T13:00:00", utc: "2025-11-01T17:00:00Z", offsetMinutes: -240 };
  const engine = await createEngine();
  try {
    const fifteen = visibility(chart, "venus", engine);
    const seventeen = visibility(chart, "venus", engine, { conditionLimits: { ...DEFAULT_CONDITION_LIMITS, underTheBeams: 17 } });
    const wider = visibility(chart, "venus", engine, { conditionLimits: { cazimi: 1, combust: 16.5, underTheBeams: 20 } });
    assert.equal(fifteen.solar.condition, "clear");
    assert.equal(seventeen.solar.condition, "under-the-beams");
    assert.equal(wider.solar.condition, "combust");
    assert.deepEqual(fifteen.assumptions.conditionLimits, { cazimi: 17 / 60, combust: 8.5, underTheBeams: 15 });
    assert.deepEqual(seventeen.assumptions.conditionLimits, { cazimi: 17 / 60, combust: 8.5, underTheBeams: 17 });
    assert.deepEqual(wider.assumptions.conditionLimits, { cazimi: 1, combust: 16.5, underTheBeams: 20 });
    // The traditional condition is kept apart from the prediction, which doesn't change.
    for (const other of [seventeen, wider]) {
      assert.deepEqual(other.windows, fifteen.windows);
      assert.deepEqual(other.classification, fifteen.classification);
    }
  } finally {
    engine.dispose();
  }
});

test("visibility: takes limits in degrees that nest, from cazimi out to under the beams at most 30°, and nothing else", () => {
  // 17′, 8°30′ and 15°, the values most often cited.
  assert.deepEqual(DEFAULT_CONDITION_LIMITS, { cazimi: 17 / 60, combust: 8.5, underTheBeams: 15 });
  for (const limits of [DEFAULT_CONDITION_LIMITS, { cazimi: 1 / 60, combust: 2 / 60, underTheBeams: 3 / 60 }, { cazimi: 1, combust: 17, underTheBeams: 30 }]) {
    assert.equal(conditionLimitsFit(limits), true, JSON.stringify(limits));
  }
  const refused = [
    { cazimi: 0, combust: 8.5, underTheBeams: 15 },
    { cazimi: -17 / 60, combust: 8.5, underTheBeams: 15 },
    { cazimi: 17 / 60, combust: 17 / 60, underTheBeams: 15 },
    { cazimi: 17 / 60, combust: 15, underTheBeams: 15 },
    { cazimi: 17 / 60, combust: 16, underTheBeams: 15 },
    { cazimi: 17 / 60, combust: 8.5, underTheBeams: 30.01 },
    { cazimi: 17 / 60, combust: 8.5, underTheBeams: Number.POSITIVE_INFINITY },
    { cazimi: 17 / 60, combust: Number.NaN, underTheBeams: 15 },
    { cazimi: 17 / 60, combust: "8.5", underTheBeams: 15 },
    { cazimi: 17 / 60, combust: 8.5 },
    null,
    15,
  ];
  for (const conditionLimits of refused) {
    assert.equal(conditionLimitsFit(conditionLimits), false, String(conditionLimits?.combust ?? conditionLimits));
    assert.throws(() => visibility(CHART, "venus", UNUSED, { conditionLimits }), /condition limits/, String(conditionLimits?.combust ?? conditionLimits));
  }
});

test("visibility: only the five naked-eye planets", () => {
  for (const planet of ["sun", "moon", "uranus", "Venus"]) {
    assert.throws(() => visibility(CHART, planet, UNUSED), /planet/, planet);
  }
});

test("visibility: in London on 21 June 2025 the Sun never reaches -18°, so the windows run to and from its lowest point, its lower transit (§6)", async () => {
  const london = { ...CHART, local: "2025-06-21T22:00:00", lat: 51.5074, lng: -0.1278, utc: "2025-06-21T21:00:00Z", offsetMinutes: 60 };
  const { windows, classification } = await venusFor(london);
  assert.deepEqual(
    [windows.evening.start.event, windows.evening.end.event, windows.morning.start.event, windows.morning.end.event],
    ["sunset", "lower-transit", "lower-transit", "sunrise"],
  );
  // That night's two windows meet at the lower transit, found once from the
  // sunset and once from the day before's sunrise.
  assert.ok(Math.abs(windows.evening.end.jd - windows.morning.start.jd) < 1 / 86_400);
  // 00:02:28.7, to the nearest second.
  assert.equal(windows.evening.end.utc, "2025-06-22T00:02:29Z");
  assert.notEqual(classification.kind, "indeterminate");
});

test("visibility: with no sunset or no sunrise at all, there's still no window and no prediction: Tromsø at midsummer", async () => {
  const tromso = { ...CHART, local: "2025-06-21T02:00:00", lat: 69.6492, lng: 18.9553, utc: "2025-06-21T00:00:00Z", offsetMinutes: 120 };
  const result = await venusFor(tromso);
  assert.deepEqual(result.windows, {
    evening: { kind: "no-window", reason: "no-sunset" },
    morning: { kind: "no-window", reason: "no-sunrise" },
  });
  assert.deepEqual(result.classification, { kind: "indeterminate", reason: "no-window" });
  assert.equal(result.solar.kind, "computed");
  // Nothing was sampled, so Swiss Ephemeris filled nothing in.
  assert.equal(result.assumptions.atmosphere.completed, null);
  assert.equal(result.assumptions.observer.completed, null);
});

test("visibility: an engine failure in a window makes the prediction unavailable", () => {
  // Windows a fixed time after wherever each search starts, then a failed sample.
  const after = { sunset: 0.3, sunrise: 0.3, "astronomical-dusk": 0.06, "astronomical-dawn": 0.94 };
  const engine = {
    assumptions: {
      swissEphemeris: "2.10.03",
      ephemeris: "moshier",
      helflag: 4,
      moon: "included",
      atmosphere: { pressure: 0, temperature: 0, humidity: 0, meteorologicalRange: 0 },
      observer: { age: 0, snellenRatio: 0 },
    },
    sunEvent: (jd, _place, event) => ({ kind: "found", jd: jd + after[event] }),
    solarGeometry: () => ({ kind: "computed", sunLongitude: 290.9, planetLongitude: 338.1, planetLatitude: -0.6, elongation: 47.2 }),
    limitingMagnitude: () => ({ kind: "failed", reason: "engine-error", raw: { ret: -1, dret: [], serr: "error in swe_calc" } }),
  };
  const result = visibility(CHART, "venus", engine);
  assert.deepEqual(result.windows.evening, { kind: "failed", reason: "engine-error", serr: "error in swe_calc" });
  assert.deepEqual(result.classification, { kind: "unavailable", reason: "engine-error" });
});

test("sampleInstants: every 2 minutes from the start while inside the window, then the end: native's evening instants exactly", () => {
  assert.deepEqual(sampleInstants(EVENING.start, EVENING.end), EVENING.samples.map((s) => s.jd));
});

test("sampleInstants: a window a whole number of steps long ends on a sample, which isn't repeated", () => {
  const start = 2460686.5;
  const end = start + 10 / 1440;
  const instants = sampleInstants(start, end);
  assert.equal(instants.length, 6);
  assert.equal(instants.at(-1), end);
});

test("longitudeGap: the planet's longitude minus the Sun's, from -180° (excluded) to 180°", () => {
  assert.equal(longitudeGap(10, 350), 20);
  assert.equal(longitudeGap(350, 10), -20);
  assert.equal(longitudeGap(359, 1), -2);
  assert.equal(longitudeGap(0, 0), 0);
  // Opposition is +180 from either side.
  assert.equal(longitudeGap(100, 280), 180);
  assert.equal(longitudeGap(280, 100), 180);
});

test("traditionalCondition: cazimi within 17′, combust within 8°30′, under the beams within 15°, either side", () => {
  const cases = [
    [0, "cazimi"],
    [17 / 60, "cazimi"],
    [-17 / 60, "cazimi"],
    [0.3, "combust"],
    [8.5, "combust"],
    [-8.5, "combust"],
    [8.51, "under-the-beams"],
    [-15, "under-the-beams"],
    [15.01, "clear"],
    [47.16, "clear"],
    [180, "clear"],
  ];
  for (const [gap, condition] of cases) assert.equal(traditionalCondition(gap), condition, String(gap));
});

test("traditionalCondition: with the limits given, such as under the beams within 17°, or all three wider", () => {
  const seventeen = { ...DEFAULT_CONDITION_LIMITS, underTheBeams: 17 };
  const cases = [
    [17 / 60, "cazimi"],
    [8.5, "combust"],
    [15.01, "under-the-beams"],
    [-17, "under-the-beams"],
    [17.01, "clear"],
  ];
  for (const [gap, condition] of cases) assert.equal(traditionalCondition(gap, seventeen), condition, String(gap));
  const wider = { cazimi: 1, combust: 10, underTheBeams: 20 };
  const widerCases = [
    [-1, "cazimi"],
    [1.01, "combust"],
    [10, "combust"],
    [-10.01, "under-the-beams"],
    [20, "under-the-beams"],
    [20.01, "clear"],
  ];
  for (const [gap, condition] of widerCases) assert.equal(traditionalCondition(gap, wider), condition, String(gap));
});

test("apparition: east of the Sun is the evening sky, west the morning, and neither at conjunction or opposition", () => {
  assert.equal(apparition(47.16), "evening");
  assert.equal(apparition(179.9), "evening");
  assert.equal(apparition(-44.66), "morning");
  assert.equal(apparition(-179.86), "morning");
  assert.equal(apparition(0), null);
  assert.equal(apparition(180), null);
});

test("classify: a failure outweighs everything, positive evidence needs one window, negative evidence both", () => {
  const evaluated = (margin) => ({ kind: "evaluated", best: { margin } });
  const below = { kind: "below-horizon" };
  const none = { kind: "no-window", reason: "no-sunset" };
  const failed = { kind: "failed", reason: "engine-error", serr: "" };
  const cases = [
    [evaluated(9), below, { kind: "detectable", window: "evening", margin: 9 }],
    // Jupiter at opposition: both windows, the larger margin.
    [evaluated(7.99), evaluated(8.78), { kind: "detectable", window: "morning", margin: 8.78 }],
    [evaluated(1), none, { kind: "detectable", window: "evening", margin: 1 }],
    // Venus at inferior conjunction: short in both, closest in the morning.
    [evaluated(-6.38), evaluated(-1.08), { kind: "undetectable", window: "morning", margin: -1.08 }],
    // Detectable needs a margin above 0.
    [evaluated(0), below, { kind: "undetectable", window: "evening", margin: 0 }],
    [below, below, { kind: "below-horizon" }],
    [evaluated(-1), none, { kind: "indeterminate", reason: "no-window" }],
    [below, none, { kind: "indeterminate", reason: "no-window" }],
    [none, none, { kind: "indeterminate", reason: "no-window" }],
    [evaluated(9), failed, { kind: "unavailable", reason: "engine-error" }],
  ];
  for (const [evening, morning, expected] of cases) {
    assert.deepEqual(classify(evening, morning), expected, `${evening.kind} ${evening.best?.margin ?? ""}, ${morning.kind} ${morning.best?.margin ?? ""}`);
  }
});
