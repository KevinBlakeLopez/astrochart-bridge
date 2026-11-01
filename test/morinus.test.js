import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { detect, read } from "../extension/core/morinus.js";
import { offsetPreview } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

// Morinus's status bar and square chart as the Python 3 forks of Morinus 8
// format them (morin.py, squarechart.py), and a Valens wheel as the
// screenshots on its site show it. The programs' own text, not OCR's.
const STATUS_BAR = "Prince Charles | Radix | 1948.november.14. 21:14:39ZN | Long.: 00°10'W Lat.: 51°30'N";
const SQUARE = ["1948.november.14", "21:14:39 ZN", "London", "00°10'W  51°30'N", "Prince Charles", "Radix", "Placidus"];
const VALENS = ["November 14, 1948", "21:14:39 UT", "Buckingham Palace", "00°10'W  51°30'N", "Prince Charles", "Radix", "Tropical", "Porphyrius"];

const ocr = (lines) => lines.join("\n");
// lines with the line that starts with `start` replaced.
const swap = (lines, start, line) => ocr(lines.map((current) => (current.startsWith(start) ? line : current)));

const LA = { timeZone: "America/Los_Angeles" };

test("a ZN status bar reads its clock, with no offset", () => {
  assert.deepEqual(read(STATUS_BAR), {
    site: "morinus",
    local: "1948-11-14T21:14:39",
    lat: 51.5,
    lng: -0.166667,
    zoneLabel: null,
  });
});

test("a ZN chart asks for its offset", () => {
  assert.deepEqual(analyzeScreenshot(STATUS_BAR), {
    kind: "natal",
    site: "morinus",
    local: "1948-11-14T21:14:39",
    zoneLabel: null,
    lat: 51.5,
    lng: -0.166667,
    utc: null,
    utcSource: "needs-offset",
    reason: "no-printed-offset",
  });
});

test("the offset prompt names Morinus and daylight saving, and the typed offset decides the UTC", () => {
  const view = viewForScreenshot(analyzeScreenshot(STATUS_BAR), LA);
  assert.equal(view.state, "enter-offset");
  assert.equal(
    view.message,
    "Morinus doesn't print the UTC offset. Enter the offset at the birth place, including daylight saving, as ±HH:MM.",
  );
  assert.deepEqual(offsetPreview(view, "+00:00").sky, { utc: "1948-11-14T21:14:39Z", lat: 51.5, lng: -0.166667 });
});

test("the status bar's fields read on lines of their own too", () => {
  const split = ocr(["Prince Charles", "Radix", "1948.november.14. 21:14:39ZN", "Long.: 00°10'W Lat.: 51°30'N"]);
  assert.deepEqual(read(split), read(STATUS_BAR));
});

test("the square chart reads like the status bar, and both together agree", () => {
  assert.deepEqual(read(ocr(SQUARE)), read(STATUS_BAR));
  assert.deepEqual(read(ocr([...SQUARE, STATUS_BAR])), read(STATUS_BAR));
});

test("a status bar and square chart that differ are refused", () => {
  const other = swap(SQUARE, "21:14", "09:14:39 ZN");
  assert.deepEqual(read(`${other}\n${STATUS_BAR}`), { kind: "refused", reason: "ambiguous-screenshot" });
});

test("a UT time is its own UTC, and the zone needs no check", () => {
  assert.deepEqual(analyzeScreenshot(ocr(VALENS)), {
    kind: "natal",
    site: "valens",
    local: "1948-11-14T21:14:39",
    zoneLabel: "UT",
    lat: 51.5,
    lng: -0.166667,
    utc: "1948-11-14T21:14:39Z",
    utcSource: "declared",
    offsetMinutes: 0,
  });
  assert.equal(analyzeScreenshot(swap(SQUARE, "21:14", "21:14:39 UT")).utc, "1948-11-14T21:14:39Z");
});

test("a three-digit longitude east and a southern latitude read", () => {
  const sydney = swap(VALENS, "00°10'W", "151°12'E  33°52'S");
  assert.deepEqual([read(sydney).lat, read(sydney).lng], [-33.866667, 151.2]);
});

test("LC, local mean or apparent time, is refused", () => {
  assert.deepEqual(read(swap(SQUARE, "21:14", "21:14:39 LC")), { kind: "refused", reason: "local-time-ambiguous" });
  assert.deepEqual(read(STATUS_BAR.replace("ZN", "LC")), { kind: "refused", reason: "local-time-ambiguous" });
});

test("a Julian or BC date is refused", () => {
  const calendar = { kind: "refused", reason: "calendar-unsupported" };
  assert.deepEqual(read(swap(SQUARE, "1948", "1948.november.14 J")), calendar);
  assert.deepEqual(read(STATUS_BAR.replace("1948", "-44")), calendar);
});

// Only the square chart marks a Julian date, so an earlier one elsewhere could be either.
test("a date before the Gregorian calendar is refused unless the square chart says it isn't Julian", () => {
  assert.deepEqual(read(STATUS_BAR.replace("1948", "1500")), { kind: "refused", reason: "calendar-unsupported" });
  assert.deepEqual(read(swap(VALENS, "November", "November 14, 1500")), { kind: "refused", reason: "calendar-unsupported" });
  assert.equal(read(swap(SQUARE, "1948", "1500.november.14")).local, "1500-11-14T21:14:39");
});

test("a transit is refused, a horary opens, and other chart types are refused", () => {
  assert.deepEqual(read(STATUS_BAR.replace("Radix", "Transit")), { kind: "refused", reason: "transit" });
  assert.equal(read(swap(SQUARE, "Radix", "Horary")).local, "1948-11-14T21:14:39");
  assert.deepEqual(read(swap(VALENS, "Radix", "Solar")), { kind: "refused", reason: "chart-type-unsupported" });
  assert.deepEqual(read(swap(SQUARE, "Radix", "PDs in chart")), { kind: "refused", reason: "chart-type-unsupported" });
});

test("a blank place still finds the coordinates", () => {
  const noPlace = ocr(SQUARE.filter((line) => line !== "London"));
  assert.deepEqual(read(noPlace), read(STATUS_BAR));
});

test("values that don't fit are refused, not guessed", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(swap(SQUARE, "1948", "1948.novembre.14")), unreadable);
  assert.deepEqual(read(swap(SQUARE, "21:14", "25:14:39 ZN")), unreadable);
  assert.deepEqual(read(swap(SQUARE, "00°10'W", "00°70'W  51°30'N")), unreadable);
  assert.deepEqual(read(STATUS_BAR.replace(/ \| Long.*/, "")), unreadable);
  assert.deepEqual(read(ocr(SQUARE.filter((line) => line !== "1948.november.14"))), unreadable);
});

test("a time tagged ZN, UT or LC is recognised", () => {
  assert.equal(detect(STATUS_BAR), true);
  assert.equal(detect(ocr(VALENS)), true);
  assert.equal(detect(ocr(VALENS.filter((line) => !line.startsWith("21:14")))), false);
});

test("the unreadable message names Morinus and Valens", () => {
  assert.match(viewForScreenshot({ kind: "refused", reason: "unreadable-screenshot" }).message, /Morinus.*Valens/);
});

test("a year before 100 isn't taken for one in the 1900s", () => {
  assert.equal(read(swap(SQUARE, "1948", "44.november.14")).local, "0044-11-14T21:14:39");
});
