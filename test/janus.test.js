import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { detect, read } from "../extension/core/janus.js";

// The middle of a Janus wheel, as the screenshots on astrology-house.com show
// it, and lines of a Janus Light report's sample PDF. Janus's own text, not OCR's.
const LINCOLN = [
  "Abraham Lincoln",
  "Natal Chart",
  "12 Feb 1809",
  "6:57:53 AM",
  "LMT +05:42:58",
  "Hodgenville KY",
  "USA",
  "85w44'24 37n34'26",
  "Geocentric",
  "Tropical",
  "Whole Signs",
  "True Node",
];
// A report's line, with Los Angeles's coordinates written as the wheel writes them.
const REPORT = ["4 Aug 1981 4:46:00 AM PDT +07:00:00", "Los Angeles CA", "118w14'34 34n03'08"];

const ocr = (lines) => lines.join("\n");
const swap = (lines, start, line) => ocr(lines.map((current) => (current.startsWith(start) ? line : current)));

test("the wheel's LMT offset, to the second, fits its longitude", () => {
  assert.deepEqual(analyzeScreenshot(ocr(LINCOLN)), {
    kind: "natal",
    site: "janus",
    local: "1809-02-12T06:57:53",
    zoneLabel: "LMT",
    lat: 37.573889,
    lng: -85.74,
    utc: "1809-02-12T12:40:51Z",
    utcSource: "declared",
    offsetMinutes: 0 - (342 + 58 / 60),
    // Above Natal Chart, and the town and country lines between the zone and the coordinates.
    name: { first: "Abraham Lincoln", last: "" },
    town: "Hodgenville KY, USA",
  });
});

test("an LMT offset that doesn't fit the longitude is refused", () => {
  assert.deepEqual(analyzeScreenshot(swap(LINCOLN, "LMT", "LMT +05:12:58")), { kind: "refused", reason: "zone-offset-mismatch" });
});

test("a report's one line reads, west of Greenwich as +", () => {
  const chart = analyzeScreenshot(ocr(REPORT));
  assert.equal(chart.local, "1981-08-04T04:46:00");
  assert.equal(chart.utc, "1981-08-04T11:46:00Z");
  assert.equal(chart.offsetMinutes, -420);
  assert.deepEqual(chart.warnings, ["offset-unchecked"]);
});

test("east of Greenwich is -, and a known zone label checks the offset", () => {
  const london = ["15 Sep 1984 4:20:00 PM GMT -01:00:00", "London", "0w07'00 51n30'00"];
  assert.deepEqual(analyzeScreenshot(ocr(london)), { kind: "refused", reason: "zone-offset-mismatch" });
  const sydney = ["Natal Chart", "15 Jan 2024", "8:00:00 AM", "AEDT -11:00:00", "Sydney", "151e12'00 33s52'00"];
  const chart = analyzeScreenshot(ocr(sydney));
  assert.equal(chart.utc, "2024-01-14T21:00:00Z");
  assert.equal(chart.warnings, undefined);
});

test("coordinates without seconds read", () => {
  const chart = read(swap(LINCOLN, "85w", "85w44' 37n34'"));
  assert.deepEqual([chart.lat, chart.lng], [37.566667, -85.733333]);
});

test("a transit or progression is refused; an event chart opens", () => {
  assert.deepEqual(read(swap(LINCOLN, "Natal Chart", "Progressed Chart")), { kind: "refused", reason: "chart-type-unsupported" });
  assert.equal(read(swap(LINCOLN, "Natal Chart", "Event Chart")).local, "1809-02-12T06:57:53");
});

test("two charts, or a block missing its coordinates, are refused", () => {
  assert.deepEqual(read(ocr([...LINCOLN, ...REPORT])), { kind: "refused", reason: "ambiguous-screenshot" });
  assert.deepEqual(read(ocr(LINCOLN.filter((line) => !line.startsWith("85w")))), { kind: "refused", reason: "unreadable-screenshot" });
});

test("values that don't fit are refused, not guessed", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(swap(LINCOLN, "12 Feb", "30 Feb 1809")), unreadable);
  assert.deepEqual(read(swap(LINCOLN, "6:57", "13:57:53 AM")), unreadable);
  assert.deepEqual(read(swap(LINCOLN, "85w", "85w44'24 37n94'26")), unreadable);
  // The date must be two lines above the zone.
  assert.deepEqual(read(ocr(LINCOLN.filter((line) => line !== "12 Feb 1809"))), unreadable);
});

test("Old Style dates and local apparent time are refused, as for Solar Fire", () => {
  assert.deepEqual(read(swap(LINCOLN, "12 Feb", "12 Feb 1509 OS")), { kind: "refused", reason: "calendar-unsupported" });
  assert.deepEqual(read(swap(LINCOLN, "LMT", "LAT +05:42:58")), { kind: "refused", reason: "apparent-time" });
});

test("a block is recognised by its zone to the second and its coordinates", () => {
  assert.equal(detect(ocr(LINCOLN)), true);
  assert.equal(detect(ocr(REPORT)), true);
  assert.equal(detect(ocr(LINCOLN.filter((line) => !line.startsWith("85w")))), false);
});
