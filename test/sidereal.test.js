import { test } from "node:test";
import assert from "node:assert/strict";
import { localSiderealSeconds, siderealGap } from "../extension/core/sidereal.js";

const seconds = (h, m, s) => h * 3600 + m * 60 + s;

function assertNear(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected} ± ${tolerance}, got ${actual}`);
}

// Meeus, Astronomical Algorithms, 2nd ed., examples 12.a and 12.b. Meeus uses
// the full IAU 1982 polynomial, so these check the linear formula against it.
test("Greenwich at 0h UT matches Meeus 12.a", () => {
  assertNear(localSiderealSeconds("1987-04-10T00:00:00Z", 0), seconds(13, 10, 46.3668), 0.01);
});

test("Greenwich later the same day matches Meeus 12.b", () => {
  assertNear(localSiderealSeconds("1987-04-10T19:21:00Z", 0), seconds(8, 34, 57.0896), 0.01);
});

// astro.com's chart image for the invented Test chart (17 April 2024, 08:00 in
// New York) prints Univ.Time 12:00, 74w00 and Sid. Time 20:48:26.
test("New York matches the Sid. Time astro.com printed", () => {
  assertNear(localSiderealSeconds("2024-04-17T12:00:00Z", -74), seconds(20, 48, 26), 1);
});

test("a west longitude that crosses sidereal midnight wraps to the day before", () => {
  // Greenwich 8h34m57s, minus 10 hours for 150°W.
  assertNear(localSiderealSeconds("1987-04-10T19:21:00Z", -150), seconds(22, 34, 57.0896), 0.01);
});

test("the same clock time a day later is about 236 s later", () => {
  const shift = localSiderealSeconds("2024-04-18T12:00:00Z", -74) - localSiderealSeconds("2024-04-17T12:00:00Z", -74);
  assertNear(shift, 236.56, 0.1);
});

test("the gap to a printed sidereal time is the same either side", () => {
  assertNear(siderealGap("2024-04-17T12:00:00Z", -74, seconds(20, 48, 26)), 0.33, 0.01);
  assertNear(siderealGap("2024-04-17T12:00:00Z", -74, seconds(20, 48, 27)), 0.67, 0.01);
});

test("the gap goes the short way round sidereal midnight", () => {
  // Greenwich 13h10m46.37s plus 11 hours for 165°E is 0h10m46.37s.
  assertNear(siderealGap("1987-04-10T00:00:00Z", 165, seconds(23, 59, 50)), 656.37, 0.01);
});

test("a time without Z throws", () => {
  assert.throws(() => localSiderealSeconds("2024-04-17T12:00:00", -74));
});
