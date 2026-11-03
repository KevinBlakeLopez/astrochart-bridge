import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { read as readEditChart } from "../extension/core/astrogold.js";
import { detect, read } from "../extension/core/esotech.js";

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
    // Above the type line, and under the time.
    name: "Barbra Streisand",
    place: "Brooklyn, New York",
  });
});

test("the chart's name is read above a type line this reader knows, and the place under the time", () => {
  const labels = (lines) => {
    const { name, place } = read(ocr(lines));
    return { name, place };
  };
  assert.deepEqual(labels(STREISAND), { name: "Barbra Streisand", place: "Brooklyn, New York" });
  // Solar Fire's user named this chart with a date; it is still its name.
  assert.deepEqual(labels(DENVER), { name: "July 5 2015", place: "Denver, Colorado" });
  assert.deepEqual(labels(CHAPLIN), { name: "Charles Chaplin", place: "London, England" });
  // No type line above the date, so the line above it, if any, isn't taken for a name.
  assert.deepEqual(labels(NEW_YORK), { name: undefined, place: "New York, NY" });
  assert.deepEqual(labels(["A heading", ...NEW_YORK]), { name: undefined, place: "New York, NY" });
  // With the coordinates straight under the time, there is no place line.
  assert.deepEqual(labels(STREISAND.filter((line) => line !== "Brooklyn, New York")), { name: "Barbra Streisand", place: undefined });
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
    // For astro.com's and Astro-Seek's forms.
    name: { first: "Barbra Streisand", last: "" },
    town: "Brooklyn, New York",
  });
});

test("a US-ordered date is read from the line above the time, not from the chart's name", () => {
  const chart = analyzeScreenshot(ocr(DENVER));
  assert.equal(chart.local, "2015-07-04T11:15:00");
  assert.equal(chart.utc, "2015-07-04T17:15:00Z");
  assert.deepEqual([chart.lat, chart.lng], [39.739167, -104.984167]);
  // AstroChart Bridge doesn't know MDT, so the offset is still unchecked.
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

test("a block is recognised by its time with an offset", () => {
  assert.equal(detect(ocr(STREISAND)), true);
  assert.equal(detect(ocr(STREISAND.filter((line) => !line.startsWith("5:04")))), false);
});

test("Solar Fire's type line names Solar Fire", () => {
  assert.equal(read(ocr(STREISAND)).site, "solar-fire");
  assert.equal(read(ocr(DENVER)).site, "solar-fire");
});

test("a block cut off above the date could be either program", () => {
  assert.equal(read(ocr(NEW_YORK)).site, "solar-fire-or-astro-gold");
});

// Astro Gold's blocks as its macOS, Windows and iOS user guides show them.
// The Chart Details panel, which joins the type and the house system:
const JOLIE = ["1 - Chart", "Angelina Jolie", "Female - Equal", "4 Jun 1975, Wed", "9:09 AM PDT +7:00", "Los Angeles, California", "34°N03'08\" 118°W14'34\""];
// The wheel, which prints no coordinates; the coordinates are the panel's for Melbourne.
const SAMPLE_WHEEL = ["Sample", "Natal", "16 Aug 1984, Thu", "3:00:36 PM AEST -10:00", "Melbourne, Australia", "Geocentric", "Tropical", "Placidus"];

test("Astro Gold's Chart Details panel reads as Astro Gold", () => {
  assert.deepEqual(analyzeScreenshot(ocr(JOLIE)), {
    kind: "natal",
    site: "astro-gold",
    local: "1975-06-04T09:09:00",
    zoneLabel: "PDT",
    lat: 34.052222,
    lng: -118.242778,
    utc: "1975-06-04T16:09:00Z",
    utcSource: "declared",
    offsetMinutes: -420,
    warnings: ["offset-unchecked"],
    name: { first: "Angelina Jolie", last: "" },
    town: "Los Angeles, California",
    // From the type line, "Female - Equal".
    gender: "female",
  });
});

test("the type line's first word is the chart's gender, where it gives one", () => {
  const gender = (lines) => read(ocr(lines)).gender;
  assert.equal(gender(JOLIE.map((line) => (line === "Female - Equal" ? "Male - Equal" : line))), "male");
  assert.equal(gender(STREISAND.map((line) => (line.startsWith("Natal") ? "Event Chart" : line))), "event");
  assert.equal(gender(STREISAND.map((line) => (line.startsWith("Natal") ? "Horary Chart" : line))), "horary");
  // A natal chart, or a type line that isn't one this reader knows, gives none.
  assert.equal(gender(STREISAND), undefined);
  assert.equal(gender(NEW_YORK), undefined);
});

test("Astro Gold's wheel is refused for the coordinates it doesn't print", () => {
  assert.deepEqual(analyzeScreenshot(ocr(SAMPLE_WHEEL)), { kind: "refused", reason: "no-coordinates" });
  // The iOS wheel, with a local-mean-time offset and no zone label.
  const einstein = ["Albert Einstein", "Male", "14 Mar 1879, Fri", "11:30 AM -0:40", "Ulm, Germany", "Tropical", "Porphyry"];
  assert.deepEqual(analyzeScreenshot(ocr(einstein)), { kind: "refused", reason: "no-coordinates" });
});

test("Astro Gold's wheel with the panel's coordinates checks AEST and keeps the seconds", () => {
  const chart = analyzeScreenshot(ocr([...SAMPLE_WHEEL, "37°S49' 144°E58'"]));
  assert.equal(chart.site, "astro-gold");
  assert.equal(chart.utc, "1984-08-16T05:00:36Z");
  assert.equal(chart.offsetMinutes, 600);
  assert.equal(chart.warnings, undefined);
});

// The iOS Edit Chart screen, one labelled field a row.
const EDIT_CHART = [
  "Name Sample",
  "Date 23 Nov 1963",
  "Time 7:12 AM",
  "Place Melbourne",
  "Country or US State Australia",
  "Latitude 37°S49'",
  "Longitude 144°E58'",
  "Timezone AEST -10:00",
];

test("Astro Gold's Edit Chart screen reads its labelled fields", () => {
  assert.deepEqual(analyzeScreenshot(ocr(EDIT_CHART)), {
    kind: "natal",
    site: "astro-gold",
    local: "1963-11-23T07:12:00",
    zoneLabel: "AEST",
    lat: -37.816667,
    lng: 144.966667,
    utc: "1963-11-22T21:12:00Z",
    utcSource: "declared",
    offsetMinutes: 600,
    // The Place row; the screen has no name.
    town: "Melbourne",
  });
});

test("an Edit Chart offset alone, as in the macOS dialog, is unchecked", () => {
  const chart = analyzeScreenshot(swap(EDIT_CHART, "Timezone", "Timezone: -10:00"));
  assert.equal(chart.utc, "1963-11-22T21:12:00Z");
  assert.deepEqual(chart.warnings, ["offset-unchecked"]);
});

test("an Edit Chart screen missing a field, or with one twice, is refused", () => {
  assert.deepEqual(readEditChart(ocr(EDIT_CHART.filter((line) => !line.startsWith("Longitude")))), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
  assert.deepEqual(readEditChart(ocr([...EDIT_CHART, "Date 24 Nov 1963"])), { kind: "refused", reason: "ambiguous-screenshot" });
});
