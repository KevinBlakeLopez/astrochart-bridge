import { test } from "node:test";
import assert from "node:assert/strict";
import { astroSeekUrl } from "../extension/core/astroseek.js";
import { isStellariumWeb } from "../extension/core/stellarium.js";
import { viewFor, viewForSky } from "../extension/popup-model.js";

test("only stellarium-web.org tabs count as Stellarium Web", () => {
  assert.equal(isStellariumWeb("https://stellarium-web.org/?date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74"), true);
  assert.equal(isStellariumWeb("https://stellarium-web.org/skysource/Moon"), true);
  for (const url of [
    "https://example.com/",
    "https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?narozeni_den=17",
    "https://stellarium-web.org.example.com/",
    "brave://extensions/",
    "edge://extensions/",
    "not a url",
  ]) {
    assert.equal(isStellariumWeb(url), false, url);
  }
});

test("a Stellarium sky becomes a screen that opens the Astro-Seek chart", () => {
  const sky = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
  assert.deepEqual(viewForSky(sky, { timeZone: "America/Los_Angeles" }), {
    state: "to-astro-seek",
    rows: [
      ["Stellarium time", "05:00 on 17 Apr 2024, your computer's time"],
      ["UTC", "2024-04-17 12:00"],
      ["Place", "40°43'N, 74°0'W"],
    ],
    notes: [
      "Astro-Seek will draw this chart in UT/GMT at these coordinates, rounded to the minute, with no city.",
      "Opening the chart sends this date, time and place to astro-seek.com.",
    ],
    button: "Open chart in Astro-Seek",
    url: astroSeekUrl(sky),
  });
});

test("a Stellarium tab whose sky can't be read says so", () => {
  assert.deepEqual(viewFor({ kind: "refused", reason: "stellarium-unreadable" }), {
    state: "refused",
    message: "Chart Bridge couldn't read the sky from this Stellarium Web tab.",
  });
});
