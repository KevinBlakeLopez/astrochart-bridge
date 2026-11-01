import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { detect, read } from "../extension/core/jhora.js";

// Jagannatha Hora's birth data blocks as its author pasted them into his
// posts on jyotish-blog.blogspot.com (March 2005 and July 2007). Jagannatha
// Hora's own text, not OCR's.
const block = ({ name = "Bill Gates", chart = "Natal Chart", date, time, zone, place, sidereal }) => [
  name,
  chart,
  `Date:          ${date}`,
  `Time:          ${time}`,
  `Time Zone:     ${zone}`,
  `Place:         ${place}`,
  "               --, --",
  "Altitude:      0.00 meters",
  "Lunar Yr-Mo:   Manmatha - Aswayuja",
  `Sidereal Time: ${sidereal}`,
];
const GATES = {
  date: "October 26, 1955",
  time: "9:17:59 pm",
  zone: "8:00:00 (West of GMT)",
  place: "122 W 20' 30\", 47 N 36' 32\"",
  sidereal: "23:27:48",
};
const SAMPLES = [
  [GATES, "1955-10-27T05:17:59Z"],
  [{ date: "October 2, 1969", time: "12:25:00 pm", zone: "5:30:00 (East of GMT)", place: "82 E 54' 00\", 25 N 08' 00\"", sidereal: "13:09:53" }, "1969-10-02T06:55:00Z"],
  [{ date: "January 20, 1927", time: "12:30:00 pm", zone: "5:30:00 (East of GMT)", place: "81 E 08' 00\", 16 N 10' 00\"", sidereal: "20:19:11" }, "1927-01-20T07:00:00Z"],
  [{ date: "June 10, 1998", time: "7:21:32 pm", zone: "5:30:00 (East of GMT)", place: "77 E 12' 00\", 28 N 36' 00\"", sidereal: "12:15:12" }, "1998-06-10T13:51:32Z"],
  [{ date: "November 27, 1997", time: "1:47:00 am", zone: "5:00:00 (West of GMT)", place: "71 W 12' 00\", 42 N 30' 00\"", sidereal: "6:27:06" }, "1997-11-27T06:47:00Z"],
];

const ocr = (fields) => block(fields).join("\n");

test("a block opens at its offset, which its sidereal time checks", () => {
  assert.deepEqual(analyzeScreenshot(ocr(GATES)), {
    kind: "natal",
    site: "jhora",
    local: "1955-10-26T21:17:59",
    zoneLabel: null,
    lat: 47.608889,
    lng: -122.341667,
    utc: "1955-10-27T05:17:59Z",
    utcSource: "declared",
    offsetMinutes: -480,
  });
});

for (const [fields, utc] of SAMPLES) {
  test(`the block for ${fields.date} opens at ${utc}`, () => {
    const chart = analyzeScreenshot(ocr(fields));
    assert.equal(chart.utc, utc);
    assert.equal(chart.warnings, undefined);
  });
}

test("a 24-hour time reads the same", () => {
  assert.equal(analyzeScreenshot(ocr({ ...GATES, time: "21:17:59" })).utc, "1955-10-27T05:17:59Z");
  assert.equal(read(ocr({ ...GATES, time: "12:05:00 am" })).local, "1955-10-26T00:05:00");
});

test("a misread sidereal time, or East read for West, is refused", () => {
  const mismatch = { kind: "refused", reason: "sidereal-mismatch" };
  assert.deepEqual(analyzeScreenshot(ocr({ ...GATES, sidereal: "23:37:48" })), mismatch);
  assert.deepEqual(analyzeScreenshot(ocr({ ...GATES, zone: "8:00:00 (East of GMT)" })), mismatch);
});

test("a derived chart is refused, and a block without its chart line opens", () => {
  assert.deepEqual(read(ocr({ ...GATES, chart: "Period Entry Chart" })), { kind: "refused", reason: "chart-type-unsupported" });
  const nameOnly = block(GATES).filter((line) => line !== "Natal Chart").join("\n");
  assert.equal(analyzeScreenshot(nameOnly).utc, "1955-10-27T05:17:59Z");
});

test("0:00:00 West of GMT is 0, not -0", () => {
  assert.ok(Object.is(read(ocr({ ...GATES, zone: "0:00:00 (West of GMT)" })).offsetMinutes, 0));
});

test("two blocks are refused", () => {
  const two = [...block(GATES), ...block(SAMPLES[1][0])].join("\n");
  assert.deepEqual(analyzeScreenshot(two), { kind: "refused", reason: "ambiguous-screenshot" });
});

test("a block missing a field, or with values that don't fit, is refused", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(block(GATES).filter((line) => !line.startsWith("Sidereal")).join("\n")), unreadable);
  assert.deepEqual(read(ocr({ ...GATES, date: "February 30, 1955" })), unreadable);
  assert.deepEqual(read(ocr({ ...GATES, time: "13:17:59 pm" })), unreadable);
  assert.deepEqual(read(ocr({ ...GATES, place: "122 W 20' 30\", 47 N 66' 32\"" })), unreadable);
  assert.deepEqual(read(ocr({ ...GATES, date: "Octobre 26, 1955" })), unreadable);
});

test("a block is recognised by its Time Zone line", () => {
  assert.equal(detect(ocr(GATES)), true);
  assert.equal(detect(block(GATES).filter((line) => !line.startsWith("Time Zone")).join("\n")), false);
});
