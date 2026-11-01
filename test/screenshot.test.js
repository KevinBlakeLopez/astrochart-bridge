import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readScreenshot } from "../extension/core/astroseek.js";
import { analyzeScreenshot } from "../extension/core/index.js";

// OCR of a whole Astro-Seek screenshot gives each label and its value on one
// line, then whatever it makes of the chart wheel. These lines copy the shape
// Tesseract.js 5.1.1 gave for a full-size screenshot, filled in with the
// invented New York chart from fixtures/astroseek/ny-2024-04-17.json.
const NY_LINES = [
  "Date of Birth (local time): 17 April 2024 - 08:00 (EDT, DST)",
  "Universal Time (UT/GMT): 17 April 2024 - 12:00",
  "Local Sidereal Time (LsT): 20:48:26",
  "House system: Placidus system",
  "Latitude, Longitude: 40°43'N, 74°0'W",
  "City: New York",
  "Country: E= United States (US), NY",
  "Birth chart | Custom graphics | -| Shape || Aspect tables || Positions || Dominants",
  "20°20",
  "26° \\ 53'",
];

const ocr = (lines) => lines.join("\n");
// NY_LINES with the line that starts with `start` replaced, or removed if line is null.
const withLine = (start, line) =>
  ocr(NY_LINES.flatMap((current) => (current.startsWith(start) ? (line === null ? [] : [line]) : [current])));

const PAGE_RESULT = JSON.parse(
  readFileSync(new URL("../fixtures/astroseek/ny-2024-04-17.json", import.meta.url), "utf8"),
).expected;

test("a screenshot's lines are read like the page's", () => {
  assert.deepEqual(readScreenshot(ocr(NY_LINES)), {
    local: "2024-04-17T08:00:00",
    zoneLabel: "EDT, DST",
    printedUt: "2024-04-17T12:00:00Z",
    lat: 40.716667,
    lng: -74,
    siderealSeconds: 74906,
  });
});

test("a screenshot of the New York chart gives the same result as its page", () => {
  assert.deepEqual(analyzeScreenshot(ocr(NY_LINES)), PAGE_RESULT);
});

// Tesseract.js read a half-size screenshot, scaled back up 2x, like this.
test("labels that lost their grey parts still read", () => {
  const small = ocr([
    "Date of Birth time): 17 April 2024 - 08:00 (EDT, DST)",
    "Universal Time MT): 17 April 2024 - 12:00",
    "Local Sidereal Time : 20:48:26",
    "Latitude, Longitude: 40°43'N, 74°0'W",
  ]);
  assert.deepEqual(analyzeScreenshot(small), PAGE_RESULT);
});

// Chrome's canvas scaled a half-size screenshot up 2x to 4x; Tesseract.js read
// each value right but the colons as these.
test("a label's colon read as something else still reads", () => {
  const separators = ocr([
    "Date of Birth - 17 April 2024 - 08:00 (EDT, DST)",
    "Universal Time - 17 April 2024 - 12:00",
    "Local Sidereal Time 3 20:48:26",
    "Latitude, Longitude; 40°43'N, 74°0'W",
  ]);
  assert.deepEqual(analyzeScreenshot(separators), PAGE_RESULT);
});

test("a value is never read from inside a longer number", () => {
  // "117" isn't a day; reading "17 April" or "7 April" out of it would be a guess.
  const glued = withLine("Date of Birth", "Date of Birth: 117 April 2024 - 08:00 (EDT, DST)");
  assert.deepEqual(readScreenshot(glued), { kind: "refused", reason: "unreadable-screenshot" });
});

test("a zone label OCR cut short is refused, not guessed", () => {
  assert.deepEqual(analyzeScreenshot(withLine("Date of Birth", "Date of Birth - 17 April 2024 - 08:00 (¢ :")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

test("two dates of birth, as on a synastry page, are refused", () => {
  const twoCharts = ocr([...NY_LINES, "Date of Birth (local time): 15 January 2024 - 08:00 (AEDT, DST)"]);
  assert.deepEqual(analyzeScreenshot(twoCharts), { kind: "refused", reason: "ambiguous-screenshot" });
});

test("a screenshot without the sidereal time is refused", () => {
  assert.deepEqual(analyzeScreenshot(withLine("Local Sidereal Time", null)), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

test("a latitude read without its N is refused", () => {
  assert.deepEqual(analyzeScreenshot(withLine("Latitude", "Latitude, Longitude: 40043', 74°0'W")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

test("a latitude with 96 minutes is refused", () => {
  assert.deepEqual(analyzeScreenshot(withLine("Latitude", "Latitude, Longitude: 40°96'N, 74°0'W")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

test("a misread sidereal time is refused", () => {
  assert.deepEqual(analyzeScreenshot(withLine("Local Sidereal Time", "Local Sidereal Time (LST): 20:43:26")), {
    kind: "refused",
    reason: "sidereal-mismatch",
  });
});

test("a misread UT is refused", () => {
  assert.deepEqual(analyzeScreenshot(withLine("Universal Time", "Universal Time (UT/GMT): 17 April 2024 - 13:00")), {
    kind: "refused",
    reason: "sidereal-mismatch",
  });
});

test("a misread longitude is refused", () => {
  assert.deepEqual(analyzeScreenshot(withLine("Latitude", "Latitude, Longitude: 40°43'N, 71°0'W")), {
    kind: "refused",
    reason: "sidereal-mismatch",
  });
});

test("a misread year in the local date is refused", () => {
  const local = "Date of Birth (local time): 17 April 2021 - 08:00 (EDT, DST)";
  assert.deepEqual(analyzeScreenshot(withLine("Date of Birth", local)), { kind: "refused", reason: "offset-out-of-range" });
});

// The sky would still be right, since it comes from the UT, but the zone label
// shows the local time can't be.
test("a misread local hour contradicts the zone label", () => {
  const local = "Date of Birth (local time): 17 April 2024 - 03:00 (EDT, DST)";
  assert.equal(analyzeScreenshot(withLine("Date of Birth", local)).utcSource, "needs-choice");
});

test("nothing but wheel text is refused", () => {
  assert.deepEqual(analyzeScreenshot("20°20\n26° \\ 53'\nGET"), { kind: "refused", reason: "unreadable-screenshot" });
});
