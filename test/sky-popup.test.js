import { test } from "node:test";
import assert from "node:assert/strict";
import { isStellariumWeb } from "../extension/core/stellarium.js";
import { ASTRO_SEEK_SAVE_NOTE, viewFor, viewForAstroCom, viewForSky } from "../extension/popup-model.js";

test("only stellarium-web.org tabs count as Stellarium Web", () => {
  assert.equal(isStellariumWeb("https://stellarium-web.org/?date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74"), true);
  assert.equal(isStellariumWeb("https://stellarium-web.org/skysource/Moon"), true);
  for (const url of [
    "https://example.com/",
    "https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?narozeni_den=17",
    "https://stellarium-web.org.example.com/",
    "brave://extensions/",
    "edge://extensions/",
    "about:debugging#/runtime/this-firefox",
    "safari-web-extension://0d9f5b3e-6a4c-4b8e-9f2a-1c7d3e5a8b90/screenshot.html",
    "not a url",
  ]) {
    assert.equal(isStellariumWeb(url), false, url);
  }
});

test("a Stellarium sky becomes a screen that opens the Astro-Seek chart, or saves it there", () => {
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
      ASTRO_SEEK_SAVE_NOTE,
    ],
    // view.js opens astroSeekUrl of this sky, so Astro-Seek gets 12:00 UT.
    sky,
    buttons: [
      { label: "Open chart in Astro-Seek", opens: "astro-seek" },
      { label: "Save in Astro-Seek…", saves: { town: null, name: null, gender: null }, secondary: true },
    ],
    // test/astro-com-handoff.test.js covers the astro.com screen itself.
    next: { label: "Enter in astro.com…", view: viewForAstroCom(sky) },
  });
});

test("a Stellarium tab whose sky can't be read says so", () => {
  assert.deepEqual(viewFor({ kind: "refused", reason: "stellarium-unreadable" }), {
    state: "refused",
    message: "AstroChart Bridge couldn't read the sky from this Stellarium Web tab.",
  });
});
