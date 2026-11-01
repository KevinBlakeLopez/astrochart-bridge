import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { detect, read } from "../extension/core/solarfire.js";

// Solar Fire's chart details blocks as its Solar Fire 9 User Guide (2014) and
// a chart exported from Solar Fire v9.0.19 print them. Solar Fire's own text,
// not OCR's.
const STREISAND = [
  "Barbra Streisand",
  "Natal Chart (9)",
  "24 Apr 1942",
  "5:04 am  +4:00",
  "Brooklyn, New York",
  "40°N38' 073°W56'",
  "Geocentric",
  "Tropical",
  "Placidus",
  "True Node",
];
// US date order, a weekday, a zone label and seconds in the coordinates. The
// chart's name is a date too.
const DENVER = [
  "Chart 1",
  "July 5 2015",
  "Natal Chart",
  "Jul 4 2015, Sat",
  "11:15 am  MDT +6:00",
  "Denver, Colorado",
  "39°N44'21\" 104°W59'03\"",
  "Geocentric",
  "Tropical",
  "Whole Signs",
  "True Node",
];
// A wheel pasted into a PDF, whose text gives each second mark as two quotes.
const NEW_YORK = ["Nov 24 2026, Tue", "9:53 am EST +5:00", "New York, NY", "40°N42'51'' 074°W00'23''"];
// The guide's older caption objects: PM in capitals, no degree signs.
const CHAPLIN = ["Chart 1", "Charles Chaplin", "Natal Chart (6)", "16 Apr 1889", "8:00 PM  GMT +0:00", "London, England", "51N31 000W06"];

const ocr = (lines) => lines.join("\n");
// lines with the line that starts with `start` replaced.
const swap = (lines, start, line) => ocr(lines.map((current) => (current.startsWith(start) ? line : current)));

test("a block without a zone label reads as printed, with Solar Fire's + turned to west", () => {
  assert.deepEqual(read(ocr(STREISAND)), {
    site: "solar-fire",
    local: "1942-04-24T05:04:00",
    lat: 40.633333,
    lng: -73.933333,
    zoneLabel: null,
    offsetMinutes: -240,
  });
});

test("a block with no label opens at its offset, with nothing to check it", () => {
  assert.deepEqual(analyzeScreenshot(ocr(STREISAND)), {
    kind: "natal",
    site: "solar-fire",
    local: "1942-04-24T05:04:00",
    zoneLabel: null,
    lat: 40.633333,
    lng: -73.933333,
    utc: "1942-04-24T09:04:00Z",
    utcSource: "declared",
    offsetMinutes: -240,
    warnings: ["offset-unchecked"],
  });
});

test("a US-ordered date is read from the line above the time, not from the chart's name", () => {
  const chart = analyzeScreenshot(ocr(DENVER));
  assert.equal(chart.local, "2015-07-04T11:15:00");
  assert.equal(chart.utc, "2015-07-04T17:15:00Z");
  assert.deepEqual([chart.lat, chart.lng], [39.739167, -104.984167]);
  // Chart Bridge doesn't know MDT, so the offset is still unchecked.
  assert.deepEqual(chart.warnings, ["offset-unchecked"]);
});

test("a known zone label checks the offset", () => {
  const chart = analyzeScreenshot(ocr(NEW_YORK));
  assert.equal(chart.utc, "2026-11-24T14:53:00Z");
  assert.equal(chart.zoneLabel, "EST");
  assert.deepEqual([chart.lat, chart.lng], [40.714167, -74.006389]);
  assert.equal(chart.warnings, undefined);
});

test("capital PM, GMT and coordinates without degree signs read too", () => {
  const chart = analyzeScreenshot(ocr(CHAPLIN));
  assert.equal(chart.utc, "1889-04-16T20:00:00Z");
  assert.equal(chart.offsetMinutes, 0);
  assert.deepEqual([chart.lat, chart.lng], [51.516667, -0.1]);
  assert.equal(chart.warnings, undefined);
});

test("east of Greenwich is - in Solar Fire, and a 24-hour clock reads", () => {
  const sydney = ["15 Jan 2024, Monday", "8:00 AEDT -11:00", "Sydney, Australia", "33°S52' 151°E12'"];
  const chart = analyzeScreenshot(ocr(sydney));
  assert.equal(chart.utc, "2024-01-14T21:00:00Z");
  assert.equal(chart.offsetMinutes, 660);
  assert.deepEqual([chart.lat, chart.lng], [-33.866667, 151.2]);
});

test("12 am is midnight and 12 pm noon", () => {
  assert.equal(read(swap(STREISAND, "5:04", "12:30 am +4:00")).local, "1942-04-24T00:30:00");
  assert.equal(read(swap(STREISAND, "5:04", "12:30 pm +4:00")).local, "1942-04-24T12:30:00");
});

test("an LMT offset that fits the longitude is checked, to the second", () => {
  const lincoln = ["12 Feb 1809", "6:57:53 am LMT +5:42:58", "Hodgenville, KY", "37°N34'26\" 085°W44'24\""];
  const chart = analyzeScreenshot(ocr(lincoln));
  assert.equal(chart.utc, "1809-02-12T12:40:51Z");
  assert.equal(chart.warnings, undefined);
});

test("an LMT offset that doesn't fit the longitude is refused", () => {
  const misread = ["12 Feb 1809", "6:57:53 am LMT +5:12:58", "Hodgenville, KY", "37°N34'26\" 085°W44'24\""];
  assert.deepEqual(analyzeScreenshot(ocr(misread)), { kind: "refused", reason: "zone-offset-mismatch" });
});

test("a zone label that contradicts the offset is refused", () => {
  assert.deepEqual(analyzeScreenshot(swap(NEW_YORK, "9:53", "9:53 am EST +4:00")), {
    kind: "refused",
    reason: "zone-offset-mismatch",
  });
});

test("a weekday that doesn't fall on the date is refused", () => {
  assert.deepEqual(analyzeScreenshot(swap(DENVER, "Jul 4", "Jul 4 2015, Fri")), { kind: "refused", reason: "weekday-mismatch" });
});

test("an offset past -12:00 to +14:00 is refused", () => {
  assert.deepEqual(analyzeScreenshot(swap(STREISAND, "5:04", "5:04 am +13:00")), {
    kind: "refused",
    reason: "offset-out-of-range",
  });
});

test("Old Style and BC dates are refused", () => {
  for (const date of ["24 Apr 1642 OS", "24 Apr 44 BC"]) {
    assert.deepEqual(read(swap(STREISAND, "24 Apr", date)), { kind: "refused", reason: "calendar-unsupported" });
  }
  assert.equal(read(swap(STREISAND, "24 Apr", "24 Apr 1942 NS")).local, "1942-04-24T05:04:00");
});

test("local apparent time is refused", () => {
  assert.deepEqual(read(swap(STREISAND, "5:04", "5:04 am LAT +4:56")), { kind: "refused", reason: "apparent-time" });
});

test("two blocks, as on a bi-wheel, are refused", () => {
  assert.deepEqual(analyzeScreenshot(ocr([...STREISAND, ...NEW_YORK])), { kind: "refused", reason: "ambiguous-screenshot" });
});

test("values that don't fit are refused, not guessed", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(swap(STREISAND, "24 Apr", "31 Apr 1942")), unreadable);
  assert.deepEqual(read(swap(STREISAND, "5:04", "13:04 am +4:00")), unreadable);
  assert.deepEqual(read(swap(STREISAND, "40°N", "40°N68' 073°W56'")), unreadable);
  assert.deepEqual(read(swap(DENVER, "Jul 4", "Jul 4 2015, Satday")), unreadable);
  // The date must be the line just above the time.
  assert.deepEqual(read(ocr(STREISAND.filter((line) => line !== "24 Apr 1942"))), unreadable);
});

test("a block is recognised by its time with an offset and its coordinates", () => {
  assert.equal(detect(ocr(STREISAND)), true);
  assert.equal(detect(ocr(STREISAND.filter((line) => !line.startsWith("40°N")))), false);
});
