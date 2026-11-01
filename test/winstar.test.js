import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { detect, read } from "../extension/core/winstar.js";

// The upper right of a Win*Star wheel, and the Julian Day its Tech 1 wheel
// adds, as the screenshots on astrologysoftware.com show them. Win*Star's own
// text, not OCR's.
const FOSTER = ["Jodie Foster", "Nov 19, 1962", "Los Angeles,CA", "08:14:00 AM PST", "ZONE: +08:00", "118W15'00\"", "34N03'00\""];
const TECH_1 = ["Julian Day: 2437988.17639", "Obliq. Eclip: +23°26'34\"", "The 323rd day of the year."];

const ocr = (lines) => lines.join("\n");
// lines with the line that starts with `start` replaced.
const swap = (lines, start, line) => lines.map((current) => (current.startsWith(start) ? line : current));

test("the wheel opens at its ZONE, west of Greenwich as +", () => {
  assert.deepEqual(analyzeScreenshot(ocr(FOSTER)), {
    kind: "natal",
    site: "winstar",
    local: "1962-11-19T08:14:00",
    zoneLabel: "PST",
    lat: 34.05,
    lng: -118.25,
    utc: "1962-11-19T16:14:00Z",
    utcSource: "declared",
    offsetMinutes: -480,
    warnings: ["offset-unchecked"],
  });
});

test("the Tech 1 wheel's Julian Day is the Universal Time, and checks the ZONE", () => {
  const chart = analyzeScreenshot(ocr([...FOSTER, ...TECH_1]));
  assert.equal(chart.utc, "1962-11-19T16:14:00Z");
  assert.equal(chart.utcSource, "printed");
  assert.equal(chart.offsetMinutes, -480);
  assert.equal(chart.warnings, undefined);
});

test("a Julian Day that doesn't fit the ZONE is refused", () => {
  // An hour later: 0.04167 of a day.
  assert.deepEqual(analyzeScreenshot(ocr([...FOSTER, "Julian Day: 2437988.21806"])), { kind: "refused", reason: "zone-offset-mismatch" });
});

test("a known zone label checks the ZONE", () => {
  const nyc = swap(swap(FOSTER, "08:14", "08:14:00 AM EST"), "ZONE", "ZONE: +04:00");
  assert.deepEqual(analyzeScreenshot(ocr(nyc)), { kind: "refused", reason: "zone-offset-mismatch" });
  const est = swap(swap(FOSTER, "08:14", "08:14:00 AM EST"), "ZONE", "ZONE: +05:00");
  assert.equal(analyzeScreenshot(ocr(est)).warnings, undefined);
});

test("east of Greenwich is -, with a full month name and no seconds", () => {
  const sydney = ["January 15, 2024", "Sydney,NSW", "8:00 AM AEDT", "ZONE: -11:00", "151E12'", "33S52'"];
  const chart = analyzeScreenshot(ocr(sydney));
  assert.equal(chart.utc, "2024-01-14T21:00:00Z");
  assert.deepEqual([chart.lat, chart.lng], [-33.866667, 151.2]);
});

test("two charts, or one missing a field, are refused", () => {
  assert.deepEqual(read(ocr([...FOSTER, ...FOSTER])), { kind: "refused", reason: "ambiguous-screenshot" });
  assert.deepEqual(read(ocr(FOSTER.filter((line) => !line.startsWith("34N")))), { kind: "refused", reason: "unreadable-screenshot" });
});

test("values that don't fit are refused, not guessed", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(ocr(swap(FOSTER, "Nov", "Nov 31, 1962"))), unreadable);
  assert.deepEqual(read(ocr(swap(FOSTER, "08:14", "13:14:00 AM PST"))), unreadable);
  assert.deepEqual(read(ocr(swap(FOSTER, "34N", "34N63'00\""))), unreadable);
  assert.deepEqual(read(ocr(swap(FOSTER, "ZONE", "ZONE: +08:75"))), unreadable);
});

test("a wheel is recognised by its ZONE line", () => {
  assert.equal(detect(ocr(FOSTER)), true);
  assert.equal(detect(ocr(FOSTER.filter((line) => !line.startsWith("ZONE")))), false);
});
