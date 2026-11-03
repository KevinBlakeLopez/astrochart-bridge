import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { detect, read } from "../extension/core/timepassages.js";

// The corners of a TimePassages wheel, as the screenshots on astrograph.com
// show them, read corner by corner. TimePassages's own text, not OCR's.
const PITT = ["Brad Pitt", "Dec 18, 1963, 6:31:00 AM CST", "Cancer Rising", "Sagittarius Moon", "Pisces Sun", "Shawnee, OK", "35N20, 96W55", "TLT 6:03", "ST 11:48:57", "Placidus"];

const ocr = (lines) => lines.join("\n");
// lines with the line that starts with `start` replaced, or removed if line is null.
const swap = (lines, start, line) => lines.flatMap((current) => (current.startsWith(start) ? (line === null ? [] : [line]) : [current]));

test("the offset comes from ST, rounded to the minute, and TLT agrees", () => {
  assert.deepEqual(analyzeScreenshot(ocr(PITT)), {
    kind: "natal",
    site: "timepassages",
    local: "1963-12-18T06:31:00",
    zoneLabel: "CST",
    lat: 35.333333,
    lng: -96.916667,
    utc: "1963-12-18T12:31:00Z",
    utcSource: "declared",
    offsetMinutes: -360,
    // Above the date and time, and above the coordinates.
    name: { first: "Brad Pitt", last: "" },
    town: "Shawnee, OK",
  });
});

test("ST alone, without TLT, gives the offset", () => {
  assert.equal(analyzeScreenshot(ocr(swap(PITT, "TLT", null))).utc, "1963-12-18T12:31:00Z");
});

test("a misread ST or TLT is refused for disagreeing", () => {
  const mismatch = { kind: "refused", reason: "true-local-time-mismatch" };
  assert.deepEqual(analyzeScreenshot(ocr(swap(PITT, "ST", "ST 11:58:57"))), mismatch);
  assert.deepEqual(analyzeScreenshot(ocr(swap(PITT, "TLT", "TLT 6:13"))), mismatch);
});

// ST and TLT are both local times, so a longitude misread by whole degrees
// moves the UT 4 minutes a degree and both still fit. The offset then falls
// off the quarter hour, unless the misread is a multiple of 15 degrees.
test("a misread longitude is refused for an offset off the quarter hour", () => {
  const offQuarter = { kind: "refused", reason: "offset-off-quarter-hour" };
  // 5 degrees: -340. 2 degrees: -352.
  assert.deepEqual(analyzeScreenshot(ocr(swap(PITT, "35N20", "35N20, 91W55"))), offQuarter);
  assert.deepEqual(analyzeScreenshot(ocr(swap(PITT, "35N20", "35N20, 98W55"))), offQuarter);
});

test("a longitude misread by 15 degrees still isn't caught: the UT moves an hour", () => {
  assert.equal(analyzeScreenshot(ocr(swap(PITT, "35N20", "35N20, 81W55"))).offsetMinutes, -300);
});

test("without ST, the offset is the user's to enter", () => {
  const chart = analyzeScreenshot(ocr(swap(PITT, "ST", null)));
  assert.equal(chart.utcSource, "needs-offset");
  assert.equal(chart.zoneLabel, "CST");
});

test("a known zone label must give the offset ST does", () => {
  assert.deepEqual(analyzeScreenshot(ocr(swap(PITT, "Dec 18", "Dec 18, 1963, 6:31:00 AM EST"))), {
    kind: "refused",
    reason: "zone-offset-mismatch",
  });
});

// Samoa keeps UTC+13 and American Samoa UTC-11, as in test/chart-image.test.js.
// ST fits two offsets a sidereal day apart, 4 minutes off whole days, so only
// one is on a quarter hour; TLT, the local mean time, agrees.
const APIA = ["June 15, 2024, 1:00:00 PM", "Apia, Samoa", "13S50, 171W45", "ST 6:08:04"];
const PAGO_PAGO = ["June 15, 2024, 1:00:00 PM", "Pago Pago, AS", "14S17, 170W42", "ST 6:16:13"];

test("of ST's two offsets, the one on a quarter hour is UTC+13 in Apia", () => {
  const chart = analyzeScreenshot(ocr(APIA));
  assert.equal(chart.utc, "2024-06-15T00:00:00Z");
  assert.equal(chart.offsetMinutes, 780);
  assert.equal(analyzeScreenshot(ocr([...APIA, "TLT 12:33"])).offsetMinutes, 780);
});

test("and UTC-11 in Pago Pago", () => {
  const chart = analyzeScreenshot(ocr(PAGO_PAGO));
  assert.equal(chart.utc, "2024-06-16T00:00:00Z");
  assert.equal(chart.offsetMinutes, -660);
});

test("an LMT chart's offset keeps its seconds", () => {
  const lmt = swap(swap(PITT, "Dec 18", "Dec 18, 1863, 6:31:00 AM LMT"), "ST", "ST 12:17:33");
  const chart = analyzeScreenshot(ocr(swap(lmt, "TLT", null)));
  assert.equal(chart.zoneLabel, "LMT");
  // 96W55 is 6h27m40s west.
  assert.ok(Math.abs(chart.offsetMinutes - -(6 * 60 + 27 + 40 / 60)) < 1 / 60 + 1e-9, String(chart.offsetMinutes));
});

test("a biwheel, a transit or a progression is refused", () => {
  for (const title of ["Comparison Biwheel", "Transits", "Progressed Chart"]) {
    assert.deepEqual(read(ocr([...PITT, title])), { kind: "refused", reason: "chart-type-unsupported" });
  }
});

test("a signed coordinate, or values that don't fit, are refused, not guessed", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(ocr(swap(PITT, "35N20", "48N24, -10E00"))), unreadable);
  assert.deepEqual(read(ocr(swap(PITT, "35N20", "35N70, 96W55"))), unreadable);
  assert.deepEqual(read(ocr(swap(PITT, "Dec 18", "Dec 32, 1963, 6:31:00 AM CST"))), unreadable);
  assert.deepEqual(read(ocr(swap(PITT, "ST", "ST 11:48:67"))), unreadable);
  assert.deepEqual(read(ocr(swap(PITT, "35N20", null))), unreadable);
});

test("a wheel is recognised by its TLT or ST line", () => {
  assert.equal(detect(ocr(PITT)), true);
  assert.equal(detect(ocr(swap(swap(PITT, "TLT", null), "ST", null))), false);
});
