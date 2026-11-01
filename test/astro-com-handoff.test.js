import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import { viewFor, viewForAstroCom, viewForSky } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const analyze = (name) => analyzePage(fixture(name));
const LA = { timeZone: "America/Los_Angeles" };
const NY_SKY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };

// Chart Bridge can't tell whether the browser is signed in to astro.com, so the
// sign-in advice is a note beside the form button, never a step before it.
const SIGN_IN_NOTE =
  "astro.com draws the chart only for a signed-in account. If it asks, sign in or create a free account, then come back to this chart for these values.";

test("the astro.com screen lists the form's values in Universal Time", () => {
  assert.deepEqual(viewForAstroCom(NY_SKY), {
    state: "to-astro-com",
    rows: [
      ["Birthday", "17 April 2024"],
      ["Hour, min", "12:00"],
      ["Time zone", "00:00 GMT / UT, under show / hide extended settings"],
      ["Place", "40°43'N, 74°0'W"],
    ],
    warnings: [],
    message: "Enter these in astro.com's birth data form. Chart Bridge doesn't fill it in or send it.",
    notes: [
      "The date and time are Universal Time, so they can differ from the local birth date and time.",
      "astro.com asks for a country and town, not coordinates. Choose the town nearest this place and check the coordinates astro.com shows.",
      SIGN_IN_NOTE,
    ],
    sky: NY_SKY,
    buttons: [
      { label: "Open astro.com's form", url: "https://www.astro.com/cgi/ade.cgi" },
      { label: "Sign in", url: "https://www.astro.com/cgi/awd.cgi?lang=e" },
      { label: "Create account", url: "https://www.astro.com/cgi/scus.cgi?act=new&" },
    ],
  });
});

test("a signed-in browser isn't held up: the form is the first button and needs nothing first", () => {
  const view = viewForAstroCom(NY_SKY);
  assert.equal(view.buttons[0].label, "Open astro.com's form");
  assert.notEqual(view.sky, null);
});

test("Sydney's morning is the previous UTC day", () => {
  const view = viewForAstroCom({ utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 });
  assert.deepEqual(view.rows.slice(0, 2), [["Birthday", "14 January 2024"], ["Hour, min", "21:00"]]);
  assert.deepEqual(view.rows[3], ["Place", "33°52'S, 151°12'E"]);
});

test("seconds the form can't take are named, not silently dropped", () => {
  const view = viewForAstroCom({ ...NY_SKY, utc: "2024-04-17T12:00:30Z" });
  assert.deepEqual(view.rows[1], ["Hour, min", "12:00"]);
  assert.deepEqual(view.warnings, ["astro.com takes whole minutes, so the 30 seconds are left out."]);
});

test("an Astro-Seek chart with a decided UTC leads to the astro.com screen", () => {
  const view = viewFor(analyze("ny-2024-04-17"), LA);
  assert.deepEqual(view.next, { label: "Enter in astro.com…", view: viewForAstroCom(NY_SKY) });
});

test("an astro.com chart doesn't lead back to astro.com", () => {
  const result = {
    kind: "natal", site: "astro-com", local: "2024-04-17T08:00:00", zoneLabel: null, lat: 40.716667, lng: -74,
    utc: "2024-04-17T12:00:00Z", utcSource: "declared", offsetMinutes: -240,
  };
  assert.equal(viewFor(result, LA).next, undefined);
});

test("screens without a decided UTC don't lead to astro.com", () => {
  assert.equal(viewFor(analyze("ny-2021-03-14-gap")).next, undefined);
  const needsOffset = {
    kind: "natal", site: "astro-seek", local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", lat: 40.716667, lng: -74,
    utc: null, utcSource: "needs-offset", reason: "no-printed-ut",
  };
  assert.equal(viewFor(needsOffset).next, undefined);
});

test("a Stellarium sky leads to the astro.com screen", () => {
  assert.deepEqual(viewForSky(NY_SKY, LA).next, { label: "Enter in astro.com…", view: viewForAstroCom(NY_SKY) });
});

test("a screenshot's chart leads to the astro.com screen, as the popup's does", () => {
  const result = analyze("ny-2024-04-17");
  assert.deepEqual(viewForScreenshot(result, LA).next, viewFor(result, LA).next);
});
