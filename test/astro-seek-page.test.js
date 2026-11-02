import { test } from "node:test";
import assert from "node:assert/strict";
import { isSavePage, readSavePage } from "../extension/core/astroseek.js";

// Runs a page function the way chrome.scripting.executeScript does: from its
// source alone, so it can't lean on anything else in its module.
function runInPage(func, document, ...args) {
  const rebuilt = new Function("document", "args", `return (${func})(...args);`);
  return rebuilt(document, args);
}

// The menu links that differ, as seen on 2026-11-01, among links every page has.
const SIGNED_IN = ["https://www.astro-seek.com/my-profile?logged=1", "https://www.astro-seek.com/logout"];
const SIGNED_OUT = ["https://www.astro-seek.com/login", "https://www.astro-seek.com/login", "https://www.astro-seek.com/registration"];
const EVERY_PAGE = ["https://www.astro-seek.com/", "https://horoscopes.astro-seek.com/birth-chart-horoscope-online", "javascript:void(0)"];

const FIELDS = [
  "nick",
  "narozeni_city",
  "narozeni_sirka_stupne",
  "narozeni_sirka_minuty",
  "narozeni_sirka_smer",
  "narozeni_delka_stupne",
  "narozeni_delka_minuty",
  "narozeni_delka_smer",
  "narozeni_timezone_form",
  "narozeni_timezone_dst_form",
];

// The parts of the save page readSavePage reads: its links, and the Add
// person form, form#form_jina_osoba, with the fields it checks.
function savePage({ links = [...EVERY_PAGE, ...SIGNED_IN], city = "", missing = [] } = {}) {
  const fields = FIELDS.filter((name) => !missing.includes(name)).map((name) => ({
    name,
    value: name === "narozeni_city" ? city : "",
  }));
  const form = { elements: { namedItem: (name) => fields.find((field) => field.name === name) ?? null } };
  return {
    querySelectorAll: (selector) => (selector === "a[href]" ? links.map((href) => ({ href })) : []),
    getElementById: (id) => (id === "form_jina_osoba" && !missing.includes("form") ? form : null),
  };
}

test("a signed-in page links to /logout, and the save link's form waits for a city", () => {
  assert.deepEqual(runInPage(readSavePage, savePage()), { auth: "signed-in", form: "city-empty" });
});

test("a signed-out page links to /login and /registration instead", () => {
  assert.equal(runInPage(readSavePage, savePage({ links: [...EVERY_PAGE, ...SIGNED_OUT] })).auth, "signed-out");
});

test("both links, or neither, is unknown", () => {
  for (const links of [[...EVERY_PAGE, ...SIGNED_IN, ...SIGNED_OUT], EVERY_PAGE, []]) {
    assert.equal(runInPage(readSavePage, savePage({ links })).auth, "unknown", String(links));
  }
});

test("only links to Astro-Seek count", () => {
  for (const links of [["https://example.com/logout"], ["https://astro-seek.com.example.com/logout"]]) {
    assert.equal(runInPage(readSavePage, savePage({ links })).auth, "unknown", String(links));
  }
  assert.equal(runInPage(readSavePage, savePage({ links: ["https://example.com/login", ...SIGNED_IN] })).auth, "signed-in");
});

test("a Birth city with anything in it is typed, and only spaces count as empty", () => {
  assert.equal(runInPage(readSavePage, savePage({ city: "New York, USA, New York" })).form, "city-typed");
  assert.equal(runInPage(readSavePage, savePage({ city: "  " })).form, "city-empty");
});

test("no Add person form, or one missing a field it fills in or checks, is unrecognised", () => {
  assert.deepEqual(runInPage(readSavePage, savePage({ missing: ["form"] })), { auth: "signed-in", form: "unrecognised" });
  for (const name of FIELDS) {
    assert.equal(runInPage(readSavePage, savePage({ missing: [name] })).form, "unrecognised", name);
  }
});

test("only the private astro database on www.astro-seek.com is the save page", () => {
  assert.equal(isSavePage("https://www.astro-seek.com/my-profile-astro-database?typ=save_birth_data&nick="), true);
  assert.equal(isSavePage("https://www.astro-seek.com/my-profile-astro-database?aktivni_tab=3"), true);
  for (const url of [
    "https://www.astro-seek.com/login",
    "https://www.astro-seek.com/my-profile-astro-database_pridat",
    "https://horoscopes.astro-seek.com/my-profile-astro-database",
    "http://www.astro-seek.com/my-profile-astro-database",
    "not a url",
  ]) {
    assert.equal(isSavePage(url), false, url);
  }
});
