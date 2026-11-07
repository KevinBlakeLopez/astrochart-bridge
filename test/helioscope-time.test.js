import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeEntry, analyzePage } from "../extension/core/index.js";
import { visibility } from "../extension/core/helioscope.js";
import { julianDay } from "../extension/core/stellarium-desktop.js";
import { createEngine } from "../extension/helioscope-engine.js";

// Helioscope's windows come from the Sun at the chart's UTC instant and place,
// so its local date, offset and daylight saving don't decide them
// (docs/HELIOSCOPE_V1_FEASIBILITY.md §6). These charts come through the same
// readers as any other.

// Searched from different instants, the same sunset came back up to 1.25 ms
// apart in the cases measured, since swe_rise_trans's answer depends a little
// on where its search starts. Two sunsets are a day apart, so a second tells
// them apart.
const SAME_EVENT = 1 / 86_400;

function fixture(name) {
  const { url, input } = JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}`, import.meta.url), "utf8"));
  return analyzePage({ url, input });
}

async function venusFor(chart) {
  const engine = await createEngine();
  try {
    return visibility(chart, "venus", engine);
  } finally {
    engine.dispose();
  }
}

// The local date of a window's bound, at the chart's offset.
const localDate = (instant, offsetMinutes) => new Date(Date.parse(instant.utc) + offsetMinutes * 60_000).toISOString().slice(0, 10);

function assertSameWindows(a, b, label) {
  for (const name of ["evening", "morning"]) {
    for (const bound of ["start", "end"]) {
      const gap = Math.abs(a.windows[name][bound].jd - b.windows[name][bound].jd);
      assert.ok(gap < SAME_EVENT, `${label}: the ${name} windows' ${bound}s are ${gap * 86_400} s apart`);
    }
  }
}

test("time: a minute either side of local midnight, the windows are the same: that evening's, and the next morning's", async () => {
  const entry = (date, time) => analyzeEntry({ date, time, lat: 40.7128, lng: -74.006, offsetMinutes: -300 });
  const before = await venusFor(entry("2025-01-10", "23:59:00"));
  const after = await venusFor(entry("2025-01-11", "00:01:00"));
  assertSameWindows(before, after, "midnight");
  for (const result of [before, after]) {
    assert.equal(localDate(result.windows.evening.start, -300), "2025-01-10");
    assert.equal(localDate(result.windows.morning.end, -300), "2025-01-11");
  }
  assert.equal(before.classification.kind, after.classification.kind);
});

test("time: 08:00 in Sydney is the evening before in UTC, and the morning window is still that local morning", async () => {
  // 15 January 2024 at 08:00 AEDT, 21:00 UTC on the 14th.
  const chart = fixture("sydney-2024-01-15.json");
  const { at, windows } = await venusFor(chart);
  assert.equal(at.utc, "2024-01-14T21:00:00Z");
  // The sunrise two hours before the chart: the 15th in Sydney, the 14th in UTC.
  assert.equal(localDate(windows.morning.end, chart.offsetMinutes), "2024-01-15");
  assert.equal(windows.morning.end.utc.slice(0, 10), "2024-01-14");
  assert.ok(windows.morning.end.jd < at.jd);
  // The nearest sunset is the evening before, 11.8 hours earlier, not the coming one, 12.2 hours later.
  assert.equal(localDate(windows.evening.start, chart.offsetMinutes), "2024-01-14");
});

test("time: in the 2021 daylight saving gap the UTC is chosen first, and either choice gives the same windows", async () => {
  // 02:30 on 14 March 2021, which New York's clocks skipped. The page's UT and
  // its EST label disagree, so the reader leaves the UTC to the user.
  const chart = fixture("ny-2021-03-14-gap.json");
  // Any use of this engine fails the test.
  const unused = new Proxy({}, {
    get(_, key) {
      throw new Error(`the engine's ${String(key)} was used`);
    },
  });
  assert.deepEqual(visibility(chart, "venus", unused), { kind: "refused", reason: "needs-choice" });
  // The chart as each choice decides it, as popup-model.js reads a choice.
  const decided = ({ utc, offsetMinutes, basis }) =>
    ({ ...chart, utc, utcSource: basis === "printed UT" ? "printed" : "zone-label", offsetMinutes });
  const [printed, labelled] = await Promise.all(chart.candidates.map((candidate) => venusFor(decided(candidate))));
  assert.notEqual(printed.at.utc, labelled.at.utc);
  assertSameWindows(printed, labelled, "gap");
  assert.equal(printed.classification.kind, labelled.classification.kind);
});

test("time: New York in 1944, on War Time: the printed UT decides, and the windows are that day's", async () => {
  // Noon EWT on 10 January 1944, 16:00 UTC.
  const chart = fixture("ny-1944-01-10.json");
  const result = await venusFor(chart);
  assert.deepEqual(result.at, { jd: julianDay("1944-01-10T16:00:00Z"), utc: "1944-01-10T16:00:00Z" });
  assert.equal(localDate(result.windows.morning.end, chart.offsetMinutes), "1944-01-10");
  assert.equal(localDate(result.windows.evening.start, chart.offsetMinutes), "1944-01-10");
  // A prediction, not a failure.
  assert.ok(["detectable", "undetectable", "below-horizon"].includes(result.classification.kind), result.classification.kind);
});
