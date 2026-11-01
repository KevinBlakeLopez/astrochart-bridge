import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyUrl } from "../extension/core/astroseek.js";

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

test("the browser's own pages are unsupported, in Chrome, Brave, Edge, Firefox and Safari", () => {
  for (const url of [
    "chrome://extensions/",
    "brave://extensions/",
    "edge://extensions/",
    "edge://newtab/",
    "about:debugging#/runtime/this-firefox",
    "about:addons",
    "safari-web-extension://0d9f5b3e-6a4c-4b8e-9f2a-1c7d3e5a8b90/screenshot.html",
    // A tab with no address, as popup.js reads one whose url the browser leaves out.
    "",
  ]) {
    assert.deepEqual(classifyUrl(url), unsupported, url);
  }
});

test("a string that is not a URL is unsupported", () => {
  assert.deepEqual(classifyUrl("not a url"), unsupported);
});
