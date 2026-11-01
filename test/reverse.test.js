import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import { astroSeekUrl } from "../extension/core/astroseek.js";
import { skyFromEngine } from "../extension/core/stellarium.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const RAD = Math.PI / 180;
const params = (url) => Object.fromEntries(new URL(url).searchParams);

// Stellarium Web's engine keeps the time as a Modified Julian Date in UTC and
// the place in radians.
test("the engine's state becomes a UTC instant and degrees", () => {
  assert.deepEqual(skyFromEngine({ utcMjd: 60417.5, latitudeRad: 40.716667 * RAD, longitudeRad: -74 * RAD }), {
    utc: "2024-04-17T12:00:00Z",
    lat: 40.716667,
    lng: -74,
  });
});

test("a running clock is rounded to the nearest minute", () => {
  // Read from stellarium-web.org on 2025-01-14 06:05:20.561 UTC.
  assert.equal(skyFromEngine({ utcMjd: 60689.25371019961, latitudeRad: 0, longitudeRad: 0 }).utc, "2025-01-14T06:05:00Z");
});

// The one Astro-Seek chart seen with a manual zone and no city: UT/GMT, no
// daylight saving, coordinates only.
test("the Astro-Seek link has exactly the parameters of the captured manual-UT chart", () => {
  const captured = new URL(fixture("manual-ut-2024-04-17-0000").url);
  const built = new URL(astroSeekUrl({ utc: "2024-04-17T00:00:00Z", lat: 40.716667, lng: -74 }));
  assert.equal(built.origin + built.pathname, captured.origin + captured.pathname);
  assert.deepEqual([...built.searchParams], [...captured.searchParams]);
});

test("the link uses UTC, so Sydney's morning is the previous UTC day, south and east", () => {
  const sent = params(astroSeekUrl({ utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 }));
  assert.deepEqual(
    [sent.narozeni_den, sent.narozeni_mesic, sent.narozeni_rok, sent.narozeni_hodina, sent.narozeni_minuta, sent.narozeni_sekunda],
    ["14", "1", "2024", "21", "00", "00"],
  );
  assert.deepEqual(
    [sent.narozeni_sirka_stupne, sent.narozeni_sirka_minuty, sent.narozeni_sirka_smer],
    ["33", "52", "1"],
  );
  assert.deepEqual(
    [sent.narozeni_delka_stupne, sent.narozeni_delka_minuty, sent.narozeni_delka_smer],
    ["151", "12", "0"],
  );
  assert.deepEqual([sent.narozeni_timezone_form, sent.narozeni_timezone_dst_form], ["0", "0"]);
});

test("coordinates round to whole minutes and carry into the next degree", () => {
  const sent = params(astroSeekUrl({ utc: "2024-04-17T00:00:00Z", lat: 40.9999, lng: -74 }));
  assert.deepEqual([sent.narozeni_sirka_stupne, sent.narozeni_sirka_minuty], ["41", "0"]);
});

test("a UTC without Z throws", () => {
  assert.throws(() => astroSeekUrl({ utc: "2024-04-17T00:00:00", lat: 40.716667, lng: -74 }));
});

test("round trip: the chart it opens reads back as the same sky", () => {
  const sky = { utc: "2024-04-17T00:00:00Z", lat: 40.716667, lng: -74 };
  const result = analyzePage({ url: astroSeekUrl(sky), text: fixture("manual-ut-2024-04-17-0000").input.text });
  assert.deepEqual({ utc: result.utc, lat: result.lat, lng: result.lng }, sky);
});
