import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { detect, read } from "../extension/core/astrolog.js";

// The top of an Astrolog 8.00 sidebar, as DrawInfo in xcharts0.cpp and the
// formatters in general.cpp write it. The Julian Days are CastChart's sum, the
// noon Julian day of the date plus clock, zone and daylight time, worked out
// here: Astrolog itself hasn't been run to print them.
const SEATTLE = [
  "Astrolog 8.00",
  "Kevin",
  "Mon July 19, 1971",
  "11:01am (DT Zone 8W)",
  "Seattle, WA",
  "122°20W  47°36N",
  "Placidus houses",
  "Tropical, Geocentric",
  "Julian Day: 2441152.25069",
];

const ocr = (lines) => lines.join("\n");
// lines with the line that starts with `start` replaced, or dropped for null.
const swap = (lines, start, line) =>
  lines.flatMap((current) => (current.startsWith(start) ? (line === null ? [] : [line]) : [current]));

test("the sidebar opens at its zone, west of Greenwich as +, which its Julian Day checks", () => {
  assert.deepEqual(analyzeScreenshot(ocr(SEATTLE)), {
    kind: "natal",
    site: "astrolog",
    local: "1971-07-19T11:01:00",
    zoneLabel: null,
    lat: 47.6,
    lng: -122.333333,
    utc: "1971-07-19T18:01:00Z",
    utcSource: "printed",
    offsetMinutes: -420,
    // The lines between the header and the date, and between the time and the coordinates.
    name: { first: SEATTLE[1], last: "" },
    town: SEATTLE[4],
  });
});

test("the name and place, each of which DrawInfo can leave out, are read only between their neighbours", () => {
  const labels = (lines) => {
    const { name, place } = read(ocr(lines));
    return { name, place };
  };
  // With no name, the header is right above the date; with no place, the coordinates are right under the time.
  assert.deepEqual(labels(swap(SEATTLE, SEATTLE[1], null)), { name: undefined, place: SEATTLE[4] });
  assert.deepEqual(labels(swap(SEATTLE, SEATTLE[4], null)), { name: SEATTLE[1], place: undefined });
  // Without the header, the line above the date isn't taken for a name.
  assert.deepEqual(labels(SEATTLE.slice(1)), { name: undefined, place: SEATTLE[4] });
});

test("seconds, milliseconds, day-first dates, 24-hour times and : marks read the same", () => {
  const seconds = swap(swap(SEATTLE, "11:01", "11:01:00am DT Zone 8:00W"), "122", "122°19'59W 47°36'35N");
  const milliseconds = swap(
    swap(swap(SEATTLE, "11:01", "11:01:00.000am DT 8:00W"), "122", "Longitude: 122°19'59.000W"),
    "Julian",
    "J. Day: 2441152.25069444",
  ).toSpliced(6, 0, "Latitude: 47°36'35.000N");
  const european = swap(swap(swap(SEATTLE, "Mon", "Mon 19 July 1971"), "11:01", "11:01 (DT Zone 8W)"), "122", "122:20W 47:36N");
  for (const lines of [seconds, milliseconds, european]) {
    const chart = analyzeScreenshot(ocr(lines));
    assert.equal(chart.utc, "1971-07-19T18:01:00Z");
    assert.equal(chart.warnings, undefined);
  }
  assert.deepEqual(read(ocr(seconds)).lng, -122.333056);
  assert.deepEqual(read(ocr(swap(SEATTLE, "122", "122.33W 47.61N"))).lng, -122.33);
});

test("east of Greenwich, to the half hour", () => {
  const varanasi = ["Thu October 2, 1969", "12:25pm (ST Zone 5:30E)", "82°54E 25°08N", "Julian Day: 2440496.78819"];
  const chart = analyzeScreenshot(ocr(varanasi));
  assert.equal(chart.utc, "1969-10-02T06:55:00Z");
  assert.equal(chart.offsetMinutes, 330);
  assert.deepEqual([chart.lat, chart.lng], [25.133333, 82.9]);
});

test("LMT is the longitude at 4 minutes a degree", () => {
  const lincoln = ["Sun February 12, 1809", "6:57:53am ST Zone LMT", "85°44'24W 37°34'26N"];
  const chart = analyzeScreenshot(ocr(lincoln));
  assert.equal(chart.offsetMinutes, -342.96);
  assert.equal(chart.utc, "1809-02-12T12:40:50Z");
  assert.deepEqual(chart.warnings, ["offset-unchecked"]);
  assert.equal(analyzeScreenshot(ocr([...lincoln, "Julian Day: 2381826.02836"])).warnings, undefined);
});

test("=Yz1's combined offset, in hours or as a meridian", () => {
  assert.equal(read(ocr(swap(SEATTLE, "11:01", "11:01am (Zone h7w)"))).offsetMinutes, -420);
  assert.equal(read(ocr(swap(SEATTLE, "11:01", "11:01am (Zone h5e30)"))).offsetMinutes, 330);
  assert.equal(analyzeScreenshot(ocr(swap(SEATTLE, "11:01", "11:01am (Zone m105w)"))).utc, "1971-07-19T18:01:00Z");
  // LAT prints a meridian too, so without a Julian Day to check it the user enters the offset.
  const unchecked = read(ocr(swap(swap(SEATTLE, "11:01", "11:01am (Zone m105w)"), "Julian", null)));
  assert.equal(unchecked.offsetMinutes, undefined);
  assert.equal(analyzeScreenshot(ocr(swap(swap(SEATTLE, "11:01", "11:01am (Zone m105w)"), "Julian", null))).utcSource, "needs-offset");
});

test("AT's daylight time isn't printed, so the Julian Day gives the UTC, or the user enters the offset", () => {
  const half = swap(swap(SEATTLE, "11:01", "11:01am (AT Zone 8W)"), "Julian", "Julian Day: 2441152.27153");
  const chart = analyzeScreenshot(ocr(half));
  assert.equal(chart.utc, "1971-07-19T18:31:00Z");
  assert.equal(chart.offsetMinutes, -450);
  assert.deepEqual(chart.warnings, ["offset-unchecked"]);
  assert.equal(analyzeScreenshot(ocr(swap(half, "Julian", null))).utcSource, "needs-offset");
});

test("without a Julian Day the zone opens unchecked", () => {
  const chart = analyzeScreenshot(ocr(swap(SEATTLE, "Julian", null)));
  assert.equal(chart.utc, "1971-07-19T18:01:00Z");
  assert.deepEqual(chart.warnings, ["offset-unchecked"]);
});

test("a Julian Day or weekday that doesn't fit is refused", () => {
  // ST read for DT: an hour off the Julian Day.
  assert.deepEqual(analyzeScreenshot(ocr(swap(SEATTLE, "11:01", "11:01am (ST Zone 8W)"))), { kind: "refused", reason: "zone-offset-mismatch" });
  assert.deepEqual(analyzeScreenshot(ocr(swap(SEATTLE, "Julian", "Julian Day: 2441152.29236"))), { kind: "refused", reason: "zone-offset-mismatch" });
  assert.deepEqual(analyzeScreenshot(ocr(swap(SEATTLE, "Mon", "Tue July 19, 1971"))), { kind: "refused", reason: "weekday-mismatch" });
});

test("LAT, Julian-calendar dates and moved charts are refused", () => {
  assert.deepEqual(read(ocr(swap(SEATTLE, "11:01", "11:01am (ST Zone LAT)"))), { kind: "refused", reason: "apparent-time" });
  assert.deepEqual(read(ocr(swap(SEATTLE, "Mon", "Sun October 14, 1582"))), { kind: "refused", reason: "calendar-unsupported" });
  for (const line of ["Progress To: Jan  1, 2026", "Time: +1:00 (12:01pm)", "Objs: +1:00 (12:01pm)", "Cusp: +1:00 (12:01pm)"]) {
    assert.deepEqual(read(ocr([...SEATTLE, line])), { kind: "refused", reason: "chart-type-unsupported" });
  }
});

test("two charts, or one missing a field, are refused", () => {
  const transit = ["#1: Inner Ring (Natal)", ...SEATTLE.slice(1, 6), "", "#2: Outer Ring (Transit)", "Sun November 1, 2026", "9:00am (ST Zone 8W)", "122°20W  47°36N"];
  assert.deepEqual(analyzeScreenshot(ocr(transit)), { kind: "refused", reason: "ambiguous-screenshot" });
  assert.deepEqual(read(ocr(swap(SEATTLE, "122", null))), { kind: "refused", reason: "unreadable-screenshot" });
  assert.deepEqual(read(ocr(swap(SEATTLE, "Mon", null))), { kind: "refused", reason: "unreadable-screenshot" });
});

test("values that don't fit are refused, not guessed", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(ocr(swap(SEATTLE, "Mon", "Mon February 30, 1971"))), unreadable);
  assert.deepEqual(read(ocr(swap(SEATTLE, "11:01", "13:01pm (DT Zone 8W)"))), unreadable);
  assert.deepEqual(read(ocr(swap(SEATTLE, "122", "122°20W  47°66N"))), unreadable);
  assert.deepEqual(read(ocr(swap(SEATTLE, "122", "122°20N  47°36W"))), unreadable);
});

test("0W is 0, not -0", () => {
  assert.ok(Object.is(read(ocr(swap(SEATTLE, "11:01", "11:01am (ST Zone 0W)"))).offsetMinutes, 0));
});

test("a sidebar is recognised by its time and zone line", () => {
  assert.equal(detect(ocr(SEATTLE)), true);
  assert.equal(detect(ocr(swap(SEATTLE, "11:01", null))), false);
});
