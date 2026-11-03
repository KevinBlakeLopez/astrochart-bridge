import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkApplied,
  isStellariumServer,
  julianDay,
  readStatus,
  skyFromStatus,
  townFromStatus,
  transferRequests,
  utcFromJulianDay,
} from "../extension/core/stellarium-desktop.js";

// The fields GET /api/main/status sends, from MainService::get in Stellarium
// v25.1's RemoteControl plugin. Not yet captured from a running Stellarium.
const STATUS = {
  location: {
    name: "New York",
    role: "C",
    planet: "Earth",
    latitude: 40.71666717529297,
    longitude: -74,
    altitude: 10,
    region: "Northern America",
    state: "New York",
    landscapeKey: "guereins",
  },
  time: {
    jday: 2460418,
    deltaT: 0.000799,
    gmtShift: -0.16666666666666666,
    timeZone: "UTC-04:00",
    utc: "2024-04-17T12:00:00.000Z",
    local: "2024-04-17T08:00:00.000",
    isTimeNow: false,
    timerate: 0,
  },
  selectioninfo: "",
  view: { fov: 60 },
};

const NY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };

// Reference values from Python's datetime: toordinal() + 1721424.5 plus the day fraction.
test("julianDay: J2000.0 is 2451545.0", () => {
  assert.equal(julianDay("2000-01-01T12:00:00Z"), 2451545);
});

test("julianDay: New York 2024 at noon UT", () => {
  assert.equal(julianDay("2024-04-17T12:00:00Z"), 2460418);
});

test("julianDay: Sydney's chart, on the day before its local date", () => {
  assert.equal(julianDay("2024-01-14T21:00:00Z"), 2460324.375);
});

test("julianDay: New York 1944, War Time already decided upstream", () => {
  assert.ok(Math.abs(julianDay("1944-01-10T16:00:00Z") - 2431100.1666666665) < 1e-9);
});

test("julianDay: one second is 1/86400 of a day", () => {
  assert.ok(Math.abs(julianDay("2024-04-17T12:00:01Z") - 2460418.000011574) < 1e-9);
});

test("julianDay throws for anything but a UTC instant, like stellariumUrl", () => {
  assert.throws(() => julianDay("2024-04-17T12:00:00"));
  assert.throws(() => julianDay("2024-04-17T08:00:00-04:00"));
  assert.throws(() => julianDay(null));
});

test("utcFromJulianDay: back to the instant, without milliseconds", () => {
  assert.equal(utcFromJulianDay(2460418), "2024-04-17T12:00:00Z");
  assert.equal(utcFromJulianDay(2460324.375), "2024-01-14T21:00:00Z");
  assert.equal(utcFromJulianDay(2431100.1666666665), "1944-01-10T16:00:00Z");
});

test("utcFromJulianDay rounds to the nearest second", () => {
  assert.equal(utcFromJulianDay(2460418 + 0.4 / 86400), "2024-04-17T12:00:00Z");
  assert.equal(utcFromJulianDay(2460418 + 0.6 / 86400), "2024-04-17T12:00:01Z");
});

test("readStatus keeps only what AstroChart Bridge uses", () => {
  assert.deepEqual(readStatus(STATUS), {
    jday: 2460418,
    timerate: 0,
    lat: 40.71666717529297,
    lng: -74,
    planet: "Earth",
    name: "New York",
  });
});

test("readStatus: a status with no name still reads, with name null", () => {
  const { name, ...location } = STATUS.location;
  assert.equal(readStatus({ ...STATUS, location }).name, null);
});

test("townFromStatus: a place's name is the town, but not one made of its coordinates", () => {
  const town = (name) => townFromStatus({ ...readStatus(STATUS), name });
  assert.equal(town("New York"), "New York");
  assert.equal(town("  Zürich "), "Zürich");
  // A name of the user's own goes in too; the forms' lists choose by coordinates, or ask.
  assert.equal(town("Home"), "Home");
  // How Stellarium names a place set by coordinates alone, as Send to Stellarium Desktop sets it.
  for (const name of ["40.716667, -74", "-33.86667, 151.2", "", "  ", null]) assert.equal(town(name), null, name);
});

test("readStatus: anything not shaped like Stellarium's status is null", () => {
  for (const json of [
    null,
    "ok",
    [],
    {},
    { ...STATUS, time: {} },
    { ...STATUS, location: null },
    { ...STATUS, time: { ...STATUS.time, jday: "2460418" } },
    { ...STATUS, time: { ...STATUS.time, timerate: null } },
    { ...STATUS, location: { ...STATUS.location, latitude: 91 } },
    { ...STATUS, location: { ...STATUS.location, longitude: -180.5 } },
    { ...STATUS, location: { ...STATUS.location, planet: 3 } },
  ]) {
    assert.equal(readStatus(json), null, JSON.stringify(json));
  }
});

test("skyFromStatus: Stellarium's single-precision coordinates come back to 6 decimals", () => {
  assert.deepEqual(skyFromStatus(readStatus(STATUS)), { kind: "sky", sky: NY });
});

// -33.866667 and -33.86667 are the same float, 0.3 m apart, so the round trip
// can't tell which was sent and gives the shorter.
test("skyFromStatus: Sydney, southern latitude and eastern longitude", () => {
  const status = { ...readStatus(STATUS), jday: 2460324.375, lat: -33.866668701171875, lng: 151.1999969482422 };
  assert.deepEqual(skyFromStatus(status), {
    kind: "sky",
    sky: { utc: "2024-01-14T21:00:00Z", lat: -33.86667, lng: 151.2 },
  });
});

test("skyFromStatus refuses an observer on another planet", () => {
  assert.deepEqual(skyFromStatus({ ...readStatus(STATUS), planet: "Mars" }), {
    kind: "refused",
    reason: "stellarium-not-earth",
  });
});

// Before 15 October 1582 Stellarium's dates are Julian-calendar dates, and
// AstroChart Bridge's are Gregorian, so the same day would read differently.
test("skyFromStatus refuses a date before the Gregorian calendar or after 9999", () => {
  for (const jday of [2299160.4, 5373484.5]) {
    assert.deepEqual(skyFromStatus({ ...readStatus(STATUS), jday }), {
      kind: "refused",
      reason: "stellarium-date-out-of-range",
    });
  }
  assert.equal(skyFromStatus({ ...readStatus(STATUS), jday: 2299160.5 }).kind, "sky");
});

test("transferRequests: pause first, then the place, then the time", () => {
  const plan = transferRequests(NY);
  assert.equal(plan.kind, "requests");
  assert.deepEqual(
    plan.requests.map(({ path, params }) => [path, params.toString()]),
    [
      ["/api/main/time", "timerate=0"],
      ["/api/location/setlocationfields", "latitude=40.716667&longitude=-74"],
      ["/api/main/time", "time=2460418"],
    ],
  );
});

test("transferRequests: Sydney's signs go through as they are", () => {
  const [, place, time] = transferRequests({ utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 }).requests;
  assert.equal(place.params.toString(), "latitude=-33.866667&longitude=151.2");
  assert.equal(time.params.toString(), "time=2460324.375");
});

test("transferRequests refuses a date before the Gregorian calendar", () => {
  assert.deepEqual(transferRequests({ ...NY, utc: "1582-10-04T12:00:00Z" }), {
    kind: "refused",
    reason: "stellarium-date-out-of-range",
  });
});

test("transferRequests refuses coordinates outside the globe", () => {
  for (const sky of [{ ...NY, lat: 90.1 }, { ...NY, lng: 181 }, { ...NY, lat: Number.NaN }]) {
    assert.deepEqual(transferRequests(sky), { kind: "refused", reason: "invalid-coordinates" });
  }
});

test("checkApplied: Stellarium's own reading of the sent sky passes", () => {
  assert.deepEqual(checkApplied(NY, readStatus(STATUS)), []);
});

test("checkApplied: a second either way passes, more than that is a time mismatch", () => {
  const status = readStatus(STATUS);
  assert.deepEqual(checkApplied(NY, { ...status, jday: 2460418 + 1 / 86400 }), []);
  assert.deepEqual(checkApplied(NY, { ...status, jday: 2460418 - 1.5 / 86400 }), ["time"]);
});

test("checkApplied: a clock left running is a mismatch", () => {
  assert.deepEqual(checkApplied(NY, { ...readStatus(STATUS), timerate: 1 / 86400 }), ["clock-running"]);
});

test("checkApplied: coordinates more than 0.0001° out are mismatches", () => {
  const status = readStatus(STATUS);
  assert.deepEqual(checkApplied(NY, { ...status, lat: 40.7168 }), ["latitude"]);
  assert.deepEqual(checkApplied(NY, { ...status, lng: 74 }), ["longitude"]);
  assert.deepEqual(checkApplied(NY, { ...status, lat: 40.71675 }), []);
});

test("checkApplied: an untouched Stellarium shows every mismatch", () => {
  const untouched = { jday: 2461000.5, timerate: 1 / 86400, lat: 48.85, lng: 2.35, planet: "Earth", name: "Paris" };
  assert.deepEqual(checkApplied(NY, untouched), ["time", "clock-running", "latitude", "longitude"]);
});

// RequestHandler.cpp sets it on every response, a 401 included.
test("isStellariumServer: the Server header Stellarium's plugin sends", () => {
  assert.equal(isStellariumServer("Stellarium RemoteControl 0.0.3"), true);
  assert.equal(isStellariumServer("nginx/1.25.3"), false);
  assert.equal(isStellariumServer(null), false);
});
