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

// Helioscope's page opens a planet at its best moment this way, in the form
// docs/HELIOSCOPE_V1_FEASIBILITY.md §7 checked on stellarium-web.org: the
// planet selected and the view locked on it, from that elevation, with that
// field of view.
test("a planet, an elevation and a field of view go in the path and after the place", () => {
  assert.equal(
    stellariumUrl({ utc: "2025-01-10T23:14:31Z", lat: 40.7128, lng: -74.006 }, { object: "Venus", elevation: 10, fov: 60 }),
    "https://stellarium-web.org/skysource/Venus?date=2025-01-10T23%3A14%3A31Z&lat=40.7128&lng=-74.006&elev=10&fov=60",
  );
});

test("each of them is sent only when given, and an elevation of 0 is still sent", () => {
  const sky = { utc: "2025-01-10T23:14:31Z", lat: 40.7128, lng: -74.006 };
  assert.equal(stellariumUrl(sky, {}), stellariumUrl(sky));
  assert.equal(stellariumUrl(sky, { elevation: 0 }), "https://stellarium-web.org/?date=2025-01-10T23%3A14%3A31Z&lat=40.7128&lng=-74.006&elev=0");
  assert.equal(stellariumUrl(sky, { object: "Jupiter" }), "https://stellarium-web.org/skysource/Jupiter?date=2025-01-10T23%3A14%3A31Z&lat=40.7128&lng=-74.006");
});

test("an elevation or a field of view that isn't a finite number throws, as an undecided UTC does", () => {
  const sky = { utc: "2025-01-10T23:14:31Z", lat: 40.7128, lng: -74.006 };
  assert.throws(() => stellariumUrl(sky, { elevation: Number.NaN }));
  assert.throws(() => stellariumUrl(sky, { fov: Number.POSITIVE_INFINITY }));
});
