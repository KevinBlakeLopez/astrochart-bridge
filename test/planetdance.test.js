import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { read } from "../extension/core/planetdance.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

// Planetdance's layouts as the screenshots in a 2021 review of Planetdance on
// livingincycles.blog show them. Planetdance's own text, not OCR's. Each
// sidereal time is within 2 s of localSiderealSeconds for its chart.
const HELSINKI = ["Startup", "03/02/2021 18:56:37 EET +02:00", "Helsinki, Finland, 24e56, 60n10", "Whole Sign St:3:32:41"];
const BRUSSELS = ["Example", "19/06/1821 17:14:45 LMT +00:17", "Brussels, Belgium, 4e21, 50n51", "Regiomontanus St:11:05:06"];
const DATA_SCREEN = [
  "Startup 03/02/2021 18:56:37 Helsinki, Finland, 24e56, 60n10, Europe/Helsinki",
  "UT:03/02/2021 16:56:37 Julian: 2459249.205984 Sidereal Time  03°32'41\" Wednesday",
];
const VEDIC = ["Classical North Indian Chart for:  Startup", "03/02/2021 ,  18:56:37", "Helsinki, Finland, 24e56, 60n10, Europe/Helsinki", "Chart Style:  North Indian", "Ayanamsa:  Lahiri"];

const ocr = (lines) => lines.join("\n");
// lines with the line that starts with `start` replaced.
const swap = (lines, start, line) => ocr(lines.map((current) => (current.startsWith(start) ? line : current)));

const HELSINKI_PLACE = { lat: 60.166667, lng: 24.933333 };

test("the wheel opens at its offset, which its St: checks", () => {
  assert.deepEqual(analyzeScreenshot(ocr(HELSINKI)), {
    kind: "natal",
    site: "planetdance",
    local: "2021-02-03T18:56:37",
    zoneLabel: "EET",
    ...HELSINKI_PLACE,
    utc: "2021-02-03T16:56:37Z",
    utcSource: "declared",
    offsetMinutes: 120,
  });
});

test("a date that reads either way is read both ways, with the sidereal time to choose", () => {
  const readings = read(ocr(HELSINKI));
  assert.deepEqual(readings.map((reading) => reading.local), ["2021-02-03T18:56:37", "2021-03-02T18:56:37"]);
  // The same chart printed month first opens on the same day.
  assert.equal(analyzeScreenshot(swap(HELSINKI, "03/02", "02/03/2021 18:56:37 EET +02:00")).utc, "2021-02-03T16:56:37Z");
});

test("a misread sidereal time is refused", () => {
  assert.deepEqual(analyzeScreenshot(swap(HELSINKI, "Whole", "Whole Sign St:3:42:41")), { kind: "refused", reason: "sidereal-mismatch" });
});

test("a misread offset is refused by the sidereal time", () => {
  assert.deepEqual(analyzeScreenshot(swap(HELSINKI, "03/02", "03/02/2021 18:56:37 EET +03:00")), {
    kind: "refused",
    reason: "sidereal-mismatch",
  });
});

test("a wheel without its St: line opens day first, unchecked", () => {
  const chart = analyzeScreenshot(ocr(HELSINKI.slice(0, 3)));
  assert.equal(chart.utc, "2021-02-03T16:56:37Z");
  assert.deepEqual(chart.warnings, ["offset-unchecked"]);
});

test("an LMT offset printed to the minute takes its seconds from the longitude", () => {
  const chart = analyzeScreenshot(ocr(BRUSSELS));
  assert.equal(chart.utc, "1821-06-19T16:57:21Z");
  assert.equal(chart.offsetMinutes, 17.4);
  assert.deepEqual([chart.lat, chart.lng], [50.85, 4.35]);
});

test("an LMT offset that doesn't fit the longitude is refused", () => {
  assert.deepEqual(analyzeScreenshot(swap(BRUSSELS, "19/06", "19/06/1821 17:14:45 LMT +00:47")), {
    kind: "refused",
    reason: "zone-offset-mismatch",
  });
});

test("a west offset with a dot, as a forum post shows it, reads", () => {
  const pittsburgh = ["04/07/1990 12:00:00 EDT -04.00", "Pittsburgh, PA, 79w60, 40n26"];
  const chart = analyzeScreenshot(ocr(pittsburgh));
  assert.equal(chart.utc, "1990-07-04T16:00:00Z");
  // 79w60 is 80 degrees west.
  assert.deepEqual([chart.lat, chart.lng], [40.433333, -80]);
});

test("the data screen takes its offset from its UT, checked by its sidereal time and weekday", () => {
  assert.deepEqual(analyzeScreenshot(ocr(DATA_SCREEN)), {
    kind: "natal",
    site: "planetdance",
    local: "2021-02-03T18:56:37",
    zoneLabel: null,
    ...HELSINKI_PLACE,
    utc: "2021-02-03T16:56:37Z",
    utcSource: "printed",
    offsetMinutes: 120,
  });
});

test("the data screen's weekday must fall on its date", () => {
  const wrongDay = ocr([DATA_SCREEN[0], DATA_SCREEN[1].replace("Wednesday", "Thursday")]);
  assert.deepEqual(analyzeScreenshot(wrongDay), { kind: "refused", reason: "weekday-mismatch" });
});

test("the Vedic screen, with no zone, asks for the offset", () => {
  assert.deepEqual(analyzeScreenshot(ocr(VEDIC)), {
    kind: "natal",
    site: "planetdance",
    local: "2021-02-03T18:56:37",
    zoneLabel: null,
    ...HELSINKI_PLACE,
    utc: null,
    utcSource: "needs-offset",
    reason: "no-printed-offset",
  });
  assert.match(viewForScreenshot(analyzeScreenshot(ocr(VEDIC))).message, /^Planetdance doesn't print the UTC offset/);
});

test("a bi-wheel's cut-off place, or two wheels, are refused", () => {
  assert.deepEqual(analyzeScreenshot(swap(HELSINKI, "Helsinki", "Helsinki, Finland, 24e56,..")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
  assert.deepEqual(analyzeScreenshot(ocr([...HELSINKI, ...BRUSSELS])), { kind: "refused", reason: "ambiguous-screenshot" });
});

test("values that don't fit are refused, not guessed", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(swap(HELSINKI, "03/02", "31/02/2021 18:56:37 EET +02:00")), unreadable);
  assert.deepEqual(read(swap(HELSINKI, "03/02", "03/02/2021 18:56:37 EET +02:75")), unreadable);
  assert.deepEqual(read(swap(HELSINKI, "Helsinki", "Helsinki, Finland, 24e56, 60n61")), unreadable);
  assert.deepEqual(read(ocr([DATA_SCREEN[1]])), unreadable);
});
