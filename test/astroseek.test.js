import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyUrl, townFromUrl } from "../extension/core/astroseek.js";

const fixtureUrl = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8")).url;

const unsupported = { kind: "refused", reason: "unsupported" };

test("natal chart pages are natal", () => {
  for (const name of ["ny-2024-04-17", "sydney-2024-01-15", "ny-1944-01-10", "ny-2021-03-14-gap"]) {
    assert.deepEqual(classifyUrl(fixtureUrl(name)), { kind: "natal" }, name);
  }
});

test("traditional and asteroids chart pages are natal too", () => {
  for (const name of ["traditional-ny-2024-04-17", "traditional-ny-2021-03-14-gap", "asteroids-ny-2024-04-17"]) {
    assert.deepEqual(classifyUrl(fixtureUrl(name)), { kind: "natal" }, name);
  }
});

test("a transit page is refused even though its URL contains narozeni_den", () => {
  const url = fixtureUrl("transit-sydney-2026-11-01");
  assert.ok(url.includes("narozeni_den"));
  assert.deepEqual(classifyUrl(url), { kind: "refused", reason: "transit" });
});

test("a love-compatibility page is refused as synastry", () => {
  assert.deepEqual(classifyUrl(fixtureUrl("compatibility-sydney-ny")), { kind: "refused", reason: "synastry" });
});

test("other Astro-Seek pages are unsupported, even with bare natal parameters", () => {
  // A made-up path: no other specialised page has been captured yet.
  const other =
    "https://horoscopes.astro-seek.com/calculate-example-chart/?narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024";
  assert.deepEqual(classifyUrl(other), unsupported);
  assert.deepEqual(classifyUrl("https://horoscopes.astro-seek.com/birth-chart-horoscope-online"), unsupported);
});

test("only the Astro-Seek horoscopes host counts", () => {
  for (const url of [
    "https://example.com/calculate-birth-chart-horoscope-online/?narozeni_den=17",
    "https://horoscopes.astro-seek.com.example.com/calculate-birth-chart-horoscope-online/?narozeni_den=17",
  ]) {
    assert.deepEqual(classifyUrl(url), unsupported, url);
  }
});

test("the browser's own pages are unsupported, in Chrome, Brave, Edge and Firefox", () => {
  for (const url of [
    "chrome://extensions/",
    "brave://extensions/",
    "edge://extensions/",
    "edge://newtab/",
    "about:debugging#/runtime/this-firefox",
    "about:addons",
  ]) {
    assert.deepEqual(classifyUrl(url), unsupported, url);
  }
});

test("a string that is not a URL is unsupported", () => {
  assert.deepEqual(classifyUrl("not a url"), unsupported);
});

test("a chart's town is the city in its address, for astro.com's town field", () => {
  assert.equal(townFromUrl(fixtureUrl("ny-2024-04-17")), "New York");
  assert.equal(townFromUrl(fixtureUrl("sydney-2024-01-15")), "Sydney");
  assert.equal(townFromUrl(fixtureUrl("traditional-ny-2024-04-17")), "New York");
});

test("a chart placed by coordinates, or another site's page, names no town", () => {
  // Charts Chart Bridge opens in Astro-Seek, like this one, name no country and
  // put "Manually place: °'N, °'E" where the city goes.
  assert.equal(townFromUrl(fixtureUrl("manual-ut-2024-04-17-0000")), null);
  assert.equal(townFromUrl("https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?narozeni_den=17"), null);
  assert.equal(townFromUrl("https://example.com/?narozeni_mesto_hidden=New+York&narozeni_stat_hidden=US"), null);
  assert.equal(townFromUrl("not a url"), null);
});
