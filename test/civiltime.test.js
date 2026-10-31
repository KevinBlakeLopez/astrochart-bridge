import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveUtc, ZONE_OFFSETS } from "../extension/core/civiltime.js";

const NY = { local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", printedUt: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };

test("a printed UT whose label matches is used as printed", () => {
  assert.deepEqual(resolveUtc(NY), { utc: "2024-04-17T12:00:00Z", utcSource: "printed", offsetMinutes: -240 });
});

test("a UT on the previous day gives a positive offset", () => {
  const sydney = { local: "2024-01-15T08:00:00", zoneLabel: "AEDT, DST", printedUt: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 };
  assert.deepEqual(resolveUtc(sydney), { utc: "2024-01-14T21:00:00Z", utcSource: "printed", offsetMinutes: 660 });
});

test("War Time in January is -4", () => {
  const ny1944 = { local: "1944-01-10T12:00:00", zoneLabel: "EWT, DST", printedUt: "1944-01-10T16:00:00Z", lat: 40.716667, lng: -74 };
  assert.deepEqual(resolveUtc(ny1944), { utc: "1944-01-10T16:00:00Z", utcSource: "printed", offsetMinutes: -240 });
});

test("a label that disagrees with the printed UT makes the user choose", () => {
  const gap = { local: "2021-03-14T02:30:00", zoneLabel: "EST", printedUt: "2021-03-14T06:30:00Z", lat: 40.716667, lng: -74 };
  assert.deepEqual(resolveUtc(gap), {
    utc: null,
    utcSource: "needs-choice",
    reason: "zone-label-mismatch",
    candidates: [
      { utc: "2021-03-14T06:30:00Z", offsetMinutes: -240, basis: "printed UT" },
      { utc: "2021-03-14T07:30:00Z", offsetMinutes: -300, basis: "zone label EST" },
    ],
  });
});

test("an unknown label keeps the printed UT with a warning", () => {
  const paris = { local: "2024-01-15T09:00:00", zoneLabel: "CET", printedUt: "2024-01-15T08:00:00Z", lat: 48.85, lng: 2.35 };
  assert.deepEqual(resolveUtc(paris), {
    utc: "2024-01-15T08:00:00Z",
    utcSource: "printed",
    offsetMinutes: 60,
    warnings: ["zone-label-unknown"],
  });
});

test("a missing label keeps the printed UT with the same warning", () => {
  assert.deepEqual(resolveUtc({ ...NY, zoneLabel: null }), {
    utc: "2024-04-17T12:00:00Z",
    utcSource: "printed",
    offsetMinutes: -240,
    warnings: ["zone-label-unknown"],
  });
});

test("no printed UT means the user enters the offset", () => {
  assert.deepEqual(resolveUtc({ ...NY, printedUt: null }), { utc: null, utcSource: "needs-offset", reason: "no-printed-ut" });
});

// Each entry must come from a label seen on a captured page. Ambiguous
// abbreviations such as IST or CST are never added.
test("the zone table holds only labels seen in fixtures", () => {
  assert.deepEqual(ZONE_OFFSETS, { EST: -300, EDT: -240, EWT: -240, AEST: 600, AEDT: 660 });
});
