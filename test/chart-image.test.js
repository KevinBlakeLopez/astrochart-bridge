import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveHeaderUtc } from "../extension/core/chart-image.js";

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
