import { test } from "node:test";
import assert from "node:assert/strict";
import { readEngine, skyFromEngine, townFromPlace } from "../extension/core/stellarium.js";
import { astroSeekSaveNamedNote, astroSeekSaveNote, viewForSky } from "../extension/popup-model.js";

const RAD = Math.PI / 180;
const NY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };

// The browser sends the tab only readEngine's source, so it is rebuilt from
// its source here and run against a stand-in for the page's document.
function runInPage(globals) {
  const document = { querySelector: (selector) => (selector === "#app" ? { __vue_app__: { config: { globalProperties: globals } } } : null) };
  return new Function("document", `return (${readEngine})();`)(document);
}

// Stellarium Web's engine and store as read on 2026-11-02, opened at New
// York's coordinates. The detected location is invented.
const CORE = { utc: 60417.5, latitude: 40.716667 * RAD, longitude: -74 * RAD };
const CURRENT = { accuracy: 1, alt: 0, country: "United States", lat: 40.716667, lng: -74, short_name: "New York", street_address: "" };
const DETECTED = { accuracy: 20000, alt: 0, country: "Detectedland", lat: 12.5, lng: 34.5, short_name: "Near Detected Town", street_address: "1 Detected Street" };
const STORE = { state: { currentLocation: CURRENT, autoDetectedLocation: DETECTED, useAutoLocation: false } };

test("readEngine reads the time and place, and the name, country and coordinates of the place shown", () => {
  const engine = runInPage({ $stel: { core: CORE }, $store: STORE });
  assert.deepEqual(engine, {
    utcMjd: 60417.5,
    latitudeRad: CORE.latitude,
    longitudeRad: CORE.longitude,
    place: { name: "New York", country: "United States", lat: 40.716667, lng: -74 },
  });
  assert.equal(townFromPlace(engine.place, skyFromEngine(engine)), "New York");
});

test("readEngine never reads the visitor's detected location, even when Stellarium Web uses it", () => {
  const store = { state: { ...STORE.state, useAutoLocation: true } };
  const read = JSON.stringify(runInPage({ $stel: { core: CORE }, $store: store }));
  for (const value of ["Detected", "12.5", "34.5", "20000"]) assert.equal(read.includes(value), false, value);
});

test("readEngine reads the sky without a store or a usable place, and nothing without an engine", () => {
  assert.equal(runInPage({ $stel: { core: CORE } }).place, null);
  assert.deepEqual(runInPage({ $stel: { core: CORE }, $store: { state: { currentLocation: { short_name: 7, lat: "40" } } } }).place, {
    name: null,
    country: null,
    lat: null,
    lng: null,
  });
  assert.equal(runInPage({ $store: STORE }), null);
  assert.equal(runInPage({ $stel: { core: { ...CORE, utc: undefined } }, $store: STORE }), null);
});

// What Stellarium Web named these coordinates on 2026-11-02. Its own names
// go to the forms as they are: their lists choose a match near the
// coordinates, or ask.
test("the place's name is the town, as Stellarium Web gives it", () => {
  for (const [name, country, lat, lng] of [
    ["Munich", "Germany", 48.137, 11.575],
    ["Shinjuku", "Japan", 35.6895, 139.6917],
    ["Park County", "United States", 44.6, -110.5],
    ["Village of Pelham Manor", "United States", 40.9, -73.8],
  ]) {
    assert.equal(townFromPlace({ name, country, lat, lng }, { lat, lng }), name);
  }
  assert.equal(townFromPlace({ name: "  Sydney ", country: "Australia", lat: -33.8667, lng: 151.2 }, { lat: -33.8667, lng: 151.2 }), "Sydney");
});

test("open sea, with no name but coordinates, has no town", () => {
  const sea = { name: "Lat 30.000° Lon -40.000°", country: "Unknown", lat: 30, lng: -40 };
  assert.equal(townFromPlace(sea, { lat: 30, lng: -40 }), null);
  assert.equal(townFromPlace({ ...sea, country: "Unknown", name: "Somewhere" }, { lat: 30, lng: -40 }), null);
  assert.equal(townFromPlace({ ...sea, country: "Portugal" }, { lat: 30, lng: -40 }), null);
});

test("a name for other coordinates, or none, isn't this sky's town", () => {
  const ny = { name: "New York", country: "United States", lat: 40.716667, lng: -74 };
  assert.equal(townFromPlace(ny, { lat: 40.7172, lng: -74.0004 }), "New York");
  assert.equal(townFromPlace(ny, { lat: 40.72, lng: -74 }), null);
  assert.equal(townFromPlace(ny, { lat: 40.716667, lng: -73.99 }), null);
  assert.equal(townFromPlace({ ...ny, lat: null }, NY), null);
  assert.equal(townFromPlace({ ...ny, name: " " }, NY), null);
  assert.equal(townFromPlace({ ...ny, name: null }, NY), null);
  assert.equal(townFromPlace(null, NY), null);
});

test("the town goes to Enter in astro.com… and Save in Astro-Seek…", () => {
  const view = viewForSky(NY, { timeZone: "America/Los_Angeles", town: "New York" });
  assert.equal(view.next.view.buttons[0].holds.town, "New York");
  assert.match(view.next.view.notes.join(" "), /AstroChart Bridge fills in the town New York/);
  assert.deepEqual(view.buttons.find(({ saves }) => saves).saves, { town: "New York", name: null, gender: null });
  assert.ok(view.notes.includes(astroSeekSaveNamedNote()));

  const unnamed = viewForSky(NY, { timeZone: "America/Los_Angeles" });
  assert.equal(unnamed.next.view.buttons[0].holds.town, null);
  assert.ok(unnamed.notes.includes(astroSeekSaveNote()));
});
