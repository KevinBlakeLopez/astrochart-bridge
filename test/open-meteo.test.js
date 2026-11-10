// Open-Meteo's archive of ERA5, as Helioscope's weather check asks it and
// reads it: core/open-meteo.js, with no network.
//
// test/open-meteo-era5-new-york-2025-01.json is the archive's answer, as
// it came, for January 2025 at ERA5's point nearest the feasibility doc's
// invented New York chart, fetched on 10 November 2026. Weather data by
// Open-Meteo.com, under CC BY 4.0, generated using Copernicus Climate Change
// Service information 2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIRST_DAY, nearestHour, readWeather, weatherRequest } from "../extension/core/open-meteo.js";

const ANSWER = JSON.parse(readFileSync(new URL("./open-meteo-era5-new-york-2025-01.json", import.meta.url), "utf8"));

const NEW_YORK = { lat: 40.7128, lng: -74.006 };
const TODAY = "2026-11-10";
const VARIABLES = "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,temperature_2m,surface_pressure";

// The query a request sends, as name and value.
const sent = (request) => Object.fromEntries(new URL(request.url).searchParams);

test("nearestHour rounds an instant to the hour, named as the archive names its hours in GMT", () => {
  assert.equal(nearestHour("2025-01-10T22:37:04Z"), "2025-01-10T23:00");
  assert.equal(nearestHour("2025-01-10T11:29:59Z"), "2025-01-10T11:00");
  assert.equal(nearestHour("2025-01-10T11:30:00Z"), "2025-01-10T12:00");
  assert.equal(nearestHour("2025-01-31T23:40:00Z"), "2025-02-01T00:00");
});

test("weatherRequest asks for ERA5 alone, in GMT, for every hour of the month, at ERA5's point nearest the place", () => {
  const request = weatherRequest(NEW_YORK, ["2025-01-10T23:00", "2025-01-10T12:00"], TODAY);
  assert.equal(request.kind, "request");
  assert.equal(request.url.split("?")[0], "https://archive-api.open-meteo.com/v1/archive");
  assert.deepEqual(sent(request), {
    latitude: "40.75",
    longitude: "-74",
    start_date: "2025-01-01",
    end_date: "2025-01-31",
    hourly: VARIABLES,
    models: "era5",
    timezone: "GMT",
  });
});

// ERA5's grid is a quarter of a degree, so the place is sent no more exactly
// than ERA5 can use it.
test("the place is sent to the nearest quarter degree", () => {
  const place = (lat, lng) => {
    const { latitude, longitude } = sent(weatherRequest({ lat, lng }, ["2025-01-10T23:00"], TODAY));
    return [latitude, longitude];
  };
  assert.deepEqual(place(51.5074, -0.1278), ["51.5", "-0.25"]);
  assert.deepEqual(place(0.1, -0.1), ["0", "0"]);
  assert.deepEqual(place(-33.8688, 151.2093), ["-33.75", "151.25"]);
  assert.deepEqual(place(34.05, -118.25), ["34", "-118.25"]);
  assert.deepEqual(place(89.99, 179.99), ["90", "180"]);
});

test("twilights either side of a month's end ask for both months", () => {
  const request = weatherRequest(NEW_YORK, ["2025-01-31T23:00", "2025-02-01T11:00"], TODAY);
  assert.deepEqual([sent(request).start_date, sent(request).end_date], ["2025-01-01", "2025-02-28"]);
});

test("the months stop at today, the last day the archive takes", () => {
  const request = weatherRequest(NEW_YORK, ["2026-11-04T22:00"], TODAY);
  assert.deepEqual([sent(request).start_date, sent(request).end_date], ["2026-11-01", "2026-11-10"]);
});

// The archive answers both with HTTP 400, "out of allowed range".
test("nothing is asked for before 1940, or for a night after today", () => {
  assert.equal(FIRST_DAY, "1940-01-01");
  assert.deepEqual(weatherRequest(NEW_YORK, ["1939-12-31T21:00", "1940-01-01T11:00"], TODAY), { kind: "refused", reason: "before-1940" });
  assert.deepEqual(weatherRequest(NEW_YORK, ["2026-11-11T01:00"], TODAY), { kind: "refused", reason: "future" });
  assert.equal(weatherRequest(NEW_YORK, ["1940-01-01T21:00"], TODAY).kind, "request");
  assert.equal(weatherRequest(NEW_YORK, ["2026-11-10T22:00"], TODAY).kind, "request");
});

test("readWeather gives the cloud at each height and the air at each hour asked for", () => {
  assert.deepEqual(readWeather(ANSWER, ["2025-01-10T23:00", "2025-01-10T12:00"]), {
    kind: "weather",
    at: {
      "2025-01-10T23:00": { cloud: { total: 90, low: 0, mid: 86, high: 88 }, air: { pressure: 1007, temperature: 1.4, humidity: 56 } },
      "2025-01-10T12:00": { cloud: { total: 0, low: 0, mid: 0, high: 0 }, air: { pressure: 1010.8, temperature: -2.8, humidity: 65 } },
    },
  });
});

// An answer with one hour's values changed, as the archive could send them.
function withHour(hour, values) {
  const i = ANSWER.hourly.time.indexOf(hour);
  const hourly = { ...ANSWER.hourly };
  for (const [name, value] of Object.entries(values)) hourly[name] = hourly[name].with(i, value);
  return { ...ANSWER, hourly };
}

// ERA5 runs about five days behind, and the archive answers the days it
// hasn't reached with null.
test("an hour the answer doesn't have, or has no value for yet, is null", () => {
  const unreached = withHour("2025-01-10T23:00", { relative_humidity_2m: null });
  assert.deepEqual(readWeather(unreached, ["2025-01-10T23:00", "2025-02-01T00:00"]).at, {
    "2025-01-10T23:00": null,
    "2025-02-01T00:00": null,
  });
});

test("an answer that isn't in the shape asked for is refused, not guessed at", () => {
  const refused = { kind: "failed", reason: "unexpected-answer" };
  const hours = ["2025-01-10T23:00"];
  const shapes = {
    nothing: null,
    "an error": { error: true, reason: "Parameter 'start_date' is out of allowed range from 1940-01-01 to 2026-11-10" },
    "another offset": { ...ANSWER, utc_offset_seconds: -18000 },
    "another unit": { ...ANSWER, hourly_units: { ...ANSWER.hourly_units, temperature_2m: "°F" } },
    "a variable missing": { ...ANSWER, hourly: { ...ANSWER.hourly, surface_pressure: undefined } },
    "a short list": { ...ANSWER, hourly: { ...ANSWER.hourly, cloud_cover: ANSWER.hourly.cloud_cover.slice(1) } },
    "a value as text": withHour("2025-01-10T23:00", { temperature_2m: "1.4" }),
    "cloud over 100 %": withHour("2025-01-10T23:00", { cloud_cover_mid: 101 }),
    "humidity below 0": withHour("2025-01-10T23:00", { relative_humidity_2m: -1 }),
    // Swiss Ephemeris would take a pressure of 0 as one to fill in.
    "no pressure": withHour("2025-01-10T23:00", { surface_pressure: 0 }),
  };
  for (const [name, answer] of Object.entries(shapes)) assert.deepEqual(readWeather(answer, hours), refused, name);
});
