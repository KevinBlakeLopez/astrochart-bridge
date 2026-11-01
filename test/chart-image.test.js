import { test } from "node:test";
import assert from "node:assert/strict";
import { readHeader, resolveHeaderUtc } from "../extension/core/chart-image.js";

const minutes = (h, m) => h * 60 + m;
const seconds = (h, m, s) => h * 3600 + m * 60 + s;

// The header of astro.com's chart image for the invented Test chart:
// "We., 17 April 2024", "8:00 a.m.", Univ.Time 12:00, 74w00, Sid. Time 20:48:26.
const NY = { local: "2024-04-17T08:00:00", weekday: 3, utMinutes: minutes(12, 0), siderealSeconds: seconds(20, 48, 26), lng: -74 };

test("the Test chart's header gives 12:00 UT on the same day", () => {
  assert.deepEqual(resolveHeaderUtc(NY), {
    utc: "2024-04-17T12:00:00Z",
    utcSource: "printed",
    offsetMinutes: -240,
    siderealErrorSeconds: 0,
  });
});

// The headers below weren't drawn by astro.com. Their Sid. Times are
// localSiderealSeconds rounded down to the second.

test("an evening birth west of Greenwich has its UT on the next day", () => {
  const header = { ...NY, local: "2024-04-17T22:00:00", utMinutes: minutes(2, 0), siderealSeconds: seconds(10, 50, 44) };
  assert.deepEqual(resolveHeaderUtc(header), {
    utc: "2024-04-18T02:00:00Z",
    utcSource: "printed",
    offsetMinutes: -240,
    siderealErrorSeconds: 0,
  });
});

test("a morning birth east of Greenwich has its UT on the day before", () => {
  const sydney = { local: "2024-01-15T08:00:00", weekday: 1, utMinutes: minutes(21, 0), siderealSeconds: seconds(14, 40, 6), lng: 151.2 };
  assert.deepEqual(resolveHeaderUtc(sydney), {
    utc: "2024-01-14T21:00:00Z",
    utcSource: "printed",
    offsetMinutes: 660,
    siderealErrorSeconds: 1,
  });
});

// Samoa keeps UTC+13 and American Samoa UTC-11, 80 km apart. The same local
// and UT clock times fit both, a day apart; only the Sid. Time tells them apart.
const SAMOA_CLOCKS = { local: "2024-06-15T13:00:00", weekday: 6, utMinutes: minutes(0, 0) };

test("Apia's Sid. Time picks UTC+13", () => {
  const apia = { ...SAMOA_CLOCKS, siderealSeconds: seconds(6, 8, 4), lng: -171.75 };
  assert.equal(resolveHeaderUtc(apia).utc, "2024-06-15T00:00:00Z");
  assert.equal(resolveHeaderUtc(apia).offsetMinutes, 780);
});

test("Pago Pago's Sid. Time picks UTC-11", () => {
  const pagoPago = { ...SAMOA_CLOCKS, siderealSeconds: seconds(6, 16, 13), lng: -170.7 };
  assert.equal(resolveHeaderUtc(pagoPago).utc, "2024-06-16T00:00:00Z");
  assert.equal(resolveHeaderUtc(pagoPago).offsetMinutes, -660);
});

test("a birth time with seconds keeps them, and the offset stays whole", () => {
  const header = { ...NY, local: "2024-04-17T07:30:03", utMinutes: minutes(11, 30), siderealSeconds: seconds(20, 18, 24) };
  assert.deepEqual(resolveHeaderUtc(header), {
    utc: "2024-04-17T11:30:03Z",
    utcSource: "printed",
    offsetMinutes: -240,
    siderealErrorSeconds: 0,
  });
});

// From astro.com's chart image for William Lilly's "Will Sick One Die?" horary:
// "We., 26 July 1645", "7:30:03 a.m. LMT", Univ.Time 7:30:43, 0w10, Sid. Time 3:47:11.
// Local mean time at 0°10'W is 40 s behind UT, so Univ.Time prints its seconds.
const LILLY = {
  local: "1645-07-26T07:30:03",
  weekday: 3,
  utMinutes: minutes(7, 30),
  utSecond: 43,
  siderealSeconds: seconds(3, 47, 11),
  lng: -(10 / 60),
};

test("a local-mean-time header's Univ.Time keeps its seconds, and so does the offset", () => {
  const { offsetMinutes, ...rest } = resolveHeaderUtc(LILLY);
  assert.deepEqual(rest, { utc: "1645-07-26T07:30:43Z", utcSource: "printed", siderealErrorSeconds: 0 });
  assert.equal(Math.round(offsetMinutes * 60), -40);
});

test("Univ.Time's seconds count toward the Sid. Time check", () => {
  // Read without them, the UT is 40 s early.
  const { utSecond, ...noSeconds } = LILLY;
  assert.equal(resolveHeaderUtc(noSeconds).siderealErrorSeconds, 40);
});

test("a Sid. Time a minute out still passes", () => {
  assert.equal(resolveHeaderUtc({ ...NY, siderealSeconds: seconds(20, 49, 26) }).siderealErrorSeconds, 60);
});

test("a Sid. Time 100 s out is refused", () => {
  assert.deepEqual(resolveHeaderUtc({ ...NY, siderealSeconds: seconds(20, 50, 6) }), {
    kind: "refused",
    reason: "sidereal-mismatch",
  });
});

test("a misread UT is refused", () => {
  assert.deepEqual(resolveHeaderUtc({ ...NY, utMinutes: minutes(12, 8) }), { kind: "refused", reason: "sidereal-mismatch" });
});

test("a misread longitude is refused", () => {
  assert.deepEqual(resolveHeaderUtc({ ...NY, lng: -71 }), { kind: "refused", reason: "sidereal-mismatch" });
});

test("a misread day is refused", () => {
  assert.deepEqual(resolveHeaderUtc({ ...NY, local: "2024-04-11T08:00:00", weekday: 4 }), {
    kind: "refused",
    reason: "sidereal-mismatch",
  });
});

// 2020-04-17 was a Friday. Its sidereal time at 12:00 UT is within 7 s of
// 2024's, so only the weekday catches this one.
test("a misread year is refused by the weekday", () => {
  assert.deepEqual(resolveHeaderUtc({ ...NY, local: "2020-04-17T08:00:00" }), { kind: "refused", reason: "weekday-mismatch" });
});

// What Tesseract.js 5.1.1 read from the top of a screenshot of astro.com's chart
// image for Lilly's horary, 1344 px wide, scaled up 2x as the screenshot page
// does. Each line runs on into what it made of the wheel.
const LILLY_OCR = [
  "Will Sick One Die? William Lilly questio \\L/_",
  "We., 26 July 1645 Time: 7:30:03 a.m. LMT MC,g",
  "London, ENG (UK) Univ.Time: 7:30:43 WWW.8Str0. Com",
  "0w10, 51n30 Sid. Time: 347-11 hm am",
  "Event Chart",
  "Method: Web Style / Placidus",
];
const LILLY_HEADER = { ...LILLY, lat: 51.5, lng: -0.166667 };
const ocr = (lines) => lines.join("\n");
// LILLY_OCR with the line that starts with `start` replaced.
const withLine = (start, line) => ocr(LILLY_OCR.map((current) => (current.startsWith(start) ? line : current)));

test("an astro.com chart image's header reads into resolveHeaderUtc's values", () => {
  assert.deepEqual(readHeader(ocr(LILLY_OCR)), LILLY_HEADER);
});

// The same screenshot read without scaling up: "51n30" lost its n.
test("a latitude read without its n is refused", () => {
  assert.deepEqual(readHeader(withLine("0w10", "0w10, 5130 Sid, Time: 347-11 i= WHT com")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

// Read from the header alone, cropped and scaled up.
test("OCR's other readings of the header still read", () => {
  const cropped = ocr([
    "Will Sick One Die? William Lilly questio",
    "",
    "We. 26 July 1645 Time: 7-30-03 am. LMT",
    "London, ENG (UK) Univ.Time: 7:30:43",
    "",
    "Ow10, 51n30 Sd. Time: 34711",
  ]);
  assert.deepEqual(readHeader(cropped), LILLY_HEADER);
});

// The Test chart's header, as for NY above.
const NY_OCR = [
  "Test",
  "We., 17 April 2024 Time: 8:00 a.m.",
  "New York, NY (US) Univ.Time: 12:00",
  "74w00, 40n43 Sid. Time: 20:48:26",
];

test("a header whose Univ.Time prints no seconds reads without them", () => {
  assert.deepEqual(readHeader(ocr(NY_OCR)), { ...NY, lat: 40.716667 });
});

test("p.m. and a three-letter month read", () => {
  const evening = ocr(["Su., 1 Nov 2026 Time: 9:15 p.m.", "Tokyo, JPN Univ.Time: 12:15", "139e45, 35n41 Sid. Time: 3:00:00"]);
  assert.equal(readHeader(evening).local, "2026-11-01T21:15:00");
});

test("12 a.m. is midnight and 12 p.m. noon", () => {
  const at = (time) => readHeader(withLine("We.", `We., 26 July 1645 Time: ${time} LMT`)).local.slice(11);
  assert.equal(at("12:05 a.m."), "00:05:00");
  assert.equal(at("12:05 p.m."), "12:05:00");
});

test("a local time without a.m. or p.m. is refused, not guessed", () => {
  assert.deepEqual(readHeader(withLine("We.", "We., 26 July 1645 Time: 7:30:03 LMT")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

test("an hour past 12 with a.m. is refused", () => {
  assert.deepEqual(readHeader(withLine("We.", "We., 26 July 1645 Time: 19:30:03 a.m. LMT")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

test("a Sid. Time without its seconds is refused", () => {
  assert.deepEqual(readHeader(withLine("0w10", "0w10, 51n30 Sid. Time: 3:47")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

test("a date that doesn't exist is refused", () => {
  assert.deepEqual(readHeader(withLine("We.", "We., 31 June 1645 Time: 7:30:03 a.m. LMT")), {
    kind: "refused",
    reason: "unreadable-screenshot",
  });
});

test("a date before the Gregorian calendar began is refused for its calendar, not as misread", () => {
  for (const date of ["We., 26 July 1545", "We., 26 July 45", "Th., 14 Oct 1582"]) {
    assert.deepEqual(readHeader(withLine("We.", `${date} Time: 7:30:03 a.m. LMT`)), { kind: "refused", reason: "calendar-unsupported" });
  }
  assert.equal(readHeader(withLine("We.", "Fr., 15 Oct 1582 Time: 7:30:03 a.m. LMT")).local, "1582-10-15T07:30:03");
});

test("two headers, as in a drawing of two charts, are refused", () => {
  assert.deepEqual(readHeader(ocr([...LILLY_OCR, ...NY_OCR])), { kind: "refused", reason: "ambiguous-screenshot" });
});

test("a screenshot without the header is refused", () => {
  assert.deepEqual(readHeader(ocr(LILLY_OCR.slice(4))), { kind: "refused", reason: "unreadable-screenshot" });
});
