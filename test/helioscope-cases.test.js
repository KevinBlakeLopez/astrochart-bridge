import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { visibility } from "../extension/core/helioscope.js";
import { createEngine } from "../extension/helioscope-engine.js";

// Native Swiss Ephemeris for the nine reference cases of
// docs/HELIOSCOPE_V1_FEASIBILITY.md §8, and for London on a night the Sun
// never reaches -18°, written by tools/make-helioscope-reference.mjs, and gate
// 4's tolerances, as in helioscope-engine.test.js.
const { cases: CASES } = JSON.parse(readFileSync(new URL("helioscope-reference-cases.json", import.meta.url), "utf8"));
const MAGNITUDES = 1e-8;
const DEGREES = 2e-7;

// What each case shows, as §8 reads them.
const EXPECTED = {
  // Glare, not geometry: above the horizon at the edges of both windows, and
  // about 15 magnitudes too faint.
  "mercury-superior-conjunction-2024": {
    classification: { kind: "undetectable", window: "evening" },
    condition: "cazimi",
    apparition: "evening",
  },
  "venus-evening-2025-01-10": {
    classification: { kind: "detectable", window: "evening" },
    condition: "clear",
    apparition: "evening",
  },
  // East of the Sun by longitude, but 8.4° from it on the sky, and closest to
  // detectable in the morning.
  "venus-inferior-conjunction-2025": {
    classification: { kind: "undetectable", window: "morning" },
    condition: "cazimi",
    apparition: "evening",
  },
  // Geometry, not glare: Mars and Saturn never rise during either window.
  "mars-conjunction-2023": { classification: { kind: "below-horizon" }, condition: "cazimi", apparition: "morning" },
  // Up all night, and best in the darker morning window.
  "jupiter-opposition-2024": {
    classification: { kind: "detectable", window: "morning" },
    condition: "clear",
    apparition: "morning",
  },
  "saturn-conjunction-2025": { classification: { kind: "below-horizon" }, condition: "cazimi", apparition: "morning" },
  "venus-evening-2025-01-10-sydney": {
    classification: { kind: "detectable", window: "evening" },
    condition: "clear",
    apparition: "evening",
  },
  // Polar night, then midnight sun: no window, so no prediction yet (§6's
  // rule, still open).
  "jupiter-opposition-2024-tromso": {
    classification: { kind: "indeterminate", reason: "no-window" },
    condition: "clear",
    apparition: "morning",
  },
  "venus-2025-06-21-tromso": {
    classification: { kind: "indeterminate", reason: "no-window" },
    condition: "clear",
    apparition: "morning",
  },
  // The Sun sets but never reaches -18°, so both windows meet at its lowest
  // point, and Venus, a morning planet, shows in the morning one.
  "venus-2025-06-21-london": {
    classification: { kind: "detectable", window: "morning" },
    condition: "clear",
    apparition: "morning",
  },
};

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is more than ${tolerance} from ${expected}`);
}

const margin = (sample) => sample.dret[0] - sample.dret[7];

// dret's slots, by the names the result gives them.
const SLOTS = [
  ["limitingMagnitude", MAGNITUDES],
  ["altitude", DEGREES],
  ["azimuth", DEGREES],
  ["sunAltitude", DEGREES],
  ["sunAzimuth", DEGREES],
  ["moonAltitude", DEGREES],
  ["moonAzimuth", DEGREES],
  ["objectMagnitude", MAGNITUDES],
];

function assertWindow(actual, native, label) {
  if (native.kind === "no-window") {
    assert.deepEqual(actual, native, label);
    return;
  }
  const { best, ...window } = actual;
  assert.deepEqual(
    {
      kind: window.kind,
      start: window.start.jd,
      startEvent: window.start.event,
      end: window.end.jd,
      endEvent: window.end.event,
      samples: window.samples,
      aboveHorizon: window.aboveHorizon,
    },
    {
      kind: native.kind,
      start: native.start,
      startEvent: native.startEvent,
      end: native.end,
      endEvent: native.endEvent,
      samples: native.samples,
      aboveHorizon: native.aboveHorizon,
    },
    label,
  );
  if (native.kind !== "evaluated") return;
  assert.equal(best.jd, native.best.jd, `${label}: best sample`);
  assert.ok(best.jd >= native.start && best.jd <= native.end, `${label}: best sample inside the window`);
  assert.equal(best.raw.ret, native.best.ret, `${label}: return code`);
  assert.equal(best.raw.serr, native.best.serr, `${label}: serr`);
  assert.equal(best.vision, native.best.ret & 1 ? "scotopic" : "photopic", `${label}: vision`);
  near(best.margin, margin(native.best), MAGNITUDES, `${label}: margin`);
  SLOTS.forEach(([key, tolerance], slot) => near(best[key], native.best.dret[slot], tolerance, `${label}: ${key}`));
}

async function visibilityOf({ planet, lat, lng, elevation, utc }) {
  const engine = await createEngine();
  try {
    // The fields of a chart that Helioscope reads.
    return visibility({ kind: "natal", lat, lng, utc, utcSource: "declared" }, planet, engine, { elevation });
  } finally {
    engine.dispose();
  }
}

for (const reference of CASES) {
  const expected = EXPECTED[reference.label];
  const { kind, window } = expected.classification;
  test(`reference case ${reference.label}: ${kind}${window ? `, from the ${window} window` : ""}, as native Swiss Ephemeris finds it`, async () => {
    const result = await visibilityOf(reference);
    assert.equal(result.at.jd, reference.jd);
    for (const name of ["evening", "morning"]) {
      assertWindow(result.windows[name], reference.windows[name], `${reference.label}, ${name}`);
    }

    const { solar } = result;
    for (const key of ["sunLongitude", "planetLongitude", "planetLatitude", "elongation"]) {
      near(solar[key], reference.solar[key], DEGREES, key);
    }
    assert.equal(solar.condition, expected.condition);
    assert.equal(solar.apparition, expected.apparition);

    const { margin: best, ...classification } = result.classification;
    assert.deepEqual(classification, expected.classification);
    if (window) near(best, margin(reference.windows[window].best), MAGNITUDES, "classification's margin");
  });
}

test("reference cases: every case has an expectation, and every expectation a case", () => {
  assert.deepEqual(CASES.map((c) => c.label).sort(), Object.keys(EXPECTED).sort());
});
