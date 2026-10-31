import { test } from "node:test";
import assert from "node:assert/strict";
import { stellariumUrl } from "../extension/core/stellarium.js";

test("New York: date, lat and lng only, so Stellarium keeps its default view", () => {
  assert.equal(
    stellariumUrl({ utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 }),
    "https://stellarium-web.org/?date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74",
  );
});

test("Sydney: negative latitude, positive longitude", () => {
  assert.equal(
    stellariumUrl({ utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 }),
    "https://stellarium-web.org/?date=2024-01-14T21%3A00%3A00Z&lat=-33.866667&lng=151.2",
  );
});

// Checked on stellarium-web.org: a date without Z is read in the browser's
// time zone, and an unencoded + offset falls back to 1858-11-17.
test("a UTC without Z throws", () => {
  assert.throws(() => stellariumUrl({ utc: "2024-04-17T12:00:00", lat: 40.716667, lng: -74 }));
});

test("a time with an offset throws", () => {
  assert.throws(() => stellariumUrl({ utc: "2024-04-17T08:00:00-04:00", lat: 40.716667, lng: -74 }));
});

test("no decided UTC throws", () => {
  assert.throws(() => stellariumUrl({ utc: null, lat: 40.716667, lng: -74 }));
});
