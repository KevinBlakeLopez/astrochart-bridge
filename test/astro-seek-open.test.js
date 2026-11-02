import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ASTRO_SEEK_ACCESS, chooseFormCity, openAndSave } from "../extension/astro-seek-open.js";
import {
  astroSeekSaveUrl,
  chooseCity,
  guardChartPlace,
  readCityList,
  readSavePage,
  savePlace,
  showCityChoice,
  typeCity,
} from "../extension/core/astroseek.js";
import { TOWN_LIMIT_KM } from "../extension/core/towns.js";

const VALUES = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74, town: "New York", name: "Chart Bridge test" };
const SAVE_URL = astroSeekSaveUrl(VALUES, { name: VALUES.name });
const LABELS = ["New York, USA, New York (40n43, 74w0)", "New York City, USA, New York (40n43, 74w0)"];
const LISTED = { state: "listed", labels: LABELS };

// A stand-in for chrome.tabs, as in test/astro-com-open.test.js: create makes
// a tab that is still loading, and the test decides when it loads and where.
function fakeTabs() {
  const updated = new Set();
  const removed = new Set();
  const tabs = new Map();
  let nextId = 70;
  return {
    created: [],
    async create({ url, active }) {
      const tab = { id: nextId++, url: "about:blank", status: "loading", active };
      tabs.set(tab.id, tab);
      this.created.push({ url, active });
      return { ...tab };
    },
    async get(id) {
      if (!tabs.has(id)) throw new Error(`No tab with id: ${id}.`);
      return { ...tabs.get(id) };
    },
    onUpdated: { addListener: (f) => updated.add(f), removeListener: (f) => updated.delete(f) },
    onRemoved: { addListener: (f) => removed.add(f), removeListener: (f) => removed.delete(f) },
    load(id, url) {
      Object.assign(tabs.get(id), { url, status: "complete" });
      for (const listener of [...updated]) listener(id, { status: "complete" }, { ...tabs.get(id) });
    },
  };
}

// A stand-in for chrome.scripting that answers for the save page's functions:
// lists answers readCityList in turn, its last answer once the rest are used.
function fakeScripting({ page = { auth: "signed-in", form: "city-empty" }, guard = { guarding: true }, typed = { typed: true }, lists = [LISTED], fail = null } = {}) {
  const calls = [];
  return {
    calls,
    async executeScript({ target, func, args }) {
      calls.push({ tabId: target.tabId, func: func.name, args });
      if (func.name === fail) throw new Error("Cannot access contents of the page.");
      if (func === readSavePage) return [{ result: page }];
      if (func === guardChartPlace) return [{ result: guard }];
      if (func === typeCity) return [{ result: typed }];
      if (func === readCityList) return [{ result: lists.length > 1 ? lists.shift() : lists[0] }];
      if (func === showCityChoice) return [{ result: { shown: true } }];
      throw new Error(`unexpected ${func.name}`);
    },
  };
}

const QUICK = { timeoutMs: 1000, cityWait: { timeoutMs: 30, pollMs: 1 } };

// Starts openAndSave and loads the tab it opens at url, or never, with null.
async function openThenLoad(browser, { url = SAVE_URL, values = VALUES, timeoutMs = QUICK.timeoutMs } = {}) {
  const pending = openAndSave(browser, { values, timeoutMs, cityWait: QUICK.cityWait });
  await new Promise((resolve) => setTimeout(resolve, 5));
  if (url !== null) browser.tabs.load(70, url);
  return pending;
}

const browserWith = (scripting = fakeScripting()) => ({ tabs: fakeTabs(), scripting });
const funcs = (scripting) => scripting.calls.map(({ func }) => func);

test("AstroChart Bridge asks only for www.astro-seek.com, which the manifest lists as optional", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(ASTRO_SEEK_ACCESS, { origins: ["https://www.astro-seek.com/*"] });
  assert.ok(manifest.optional_host_permissions.includes("https://www.astro-seek.com/*"));
});

test("the save link opens behind the popup, with the chart's name", async () => {
  const browser = browserWith();
  await openThenLoad(browser);
  assert.deepEqual(browser.tabs.created, [{ url: SAVE_URL, active: false }]);
});

test("signed in, the chart's place is guarded before the town is typed, and the town is chosen from the list", async () => {
  const scripting = fakeScripting({ lists: [{ state: "waiting" }, LISTED] });
  const browser = browserWith(scripting);
  assert.deepEqual(await openThenLoad(browser), { outcome: "filled", tabId: 70 });
  assert.deepEqual(funcs(scripting), ["readSavePage", "guardChartPlace", "typeCity", "readCityList", "readCityList", "showCityChoice"]);
  const args = Object.fromEntries(scripting.calls.map(({ func, args }) => [func, args]));
  assert.deepEqual(args.guardChartPlace, [savePlace(VALUES)]);
  assert.deepEqual(args.typeCity, ["New York"]);
  assert.deepEqual(args.showCityChoice, [chooseCity(LABELS, VALUES), "New York", TOWN_LIMIT_KM]);
  assert.equal(args.showCityChoice[0].kind, "pick");
});

test("a page that can't tell whether it's signed in is filled in the same way", async () => {
  const scripting = fakeScripting({ page: { auth: "unknown", form: "city-empty" } });
  assert.equal((await openThenLoad(browserWith(scripting))).outcome, "filled");
  assert.ok(funcs(scripting).includes("showCityChoice"));
});

test("a chart with no town is guarded, and its box asks for a town", async () => {
  const scripting = fakeScripting();
  assert.equal((await openThenLoad(browserWith(scripting), { values: { ...VALUES, town: null } })).outcome, "filled");
  assert.deepEqual(funcs(scripting), ["readSavePage", "guardChartPlace", "showCityChoice"]);
  assert.deepEqual(scripting.calls.at(-1).args, [{ kind: "no-town" }, null, TOWN_LIMIT_KM]);
});

test("signed out, nothing is filled in and the tab is left for the person", async () => {
  const scripting = fakeScripting({ page: { auth: "signed-out", form: "unrecognised" } });
  assert.deepEqual(await openThenLoad(browserWith(scripting)), { outcome: "signed-out", tabId: 70 });
  assert.deepEqual(funcs(scripting), ["readSavePage"]);
});

test("a Birth city already typed, or a form that isn't recognised, isn't filled in", async () => {
  for (const [form, page] of [["city-typed", "city-typed"], ["unrecognised", "unrecognised"]]) {
    const scripting = fakeScripting({ page: { auth: "signed-in", form } });
    assert.deepEqual(await openThenLoad(browserWith(scripting)), { outcome: "not-filled", tabId: 70, page });
    assert.deepEqual(funcs(scripting), ["readSavePage"]);
  }
});

test("a tab that doesn't load in time, or ends up somewhere other than the save page, isn't filled in", async () => {
  const slow = fakeScripting();
  assert.deepEqual(await openThenLoad(browserWith(slow), { url: null, timeoutMs: 20 }), { outcome: "not-filled", tabId: 70, page: "not-loaded" });
  const elsewhere = fakeScripting();
  assert.deepEqual(await openThenLoad(browserWith(elsewhere), { url: "https://www.astro-seek.com/login" }), {
    outcome: "not-filled",
    tabId: 70,
    page: "elsewhere",
  });
  assert.deepEqual([...funcs(slow), ...funcs(elsewhere)], []);
});

test("a guard that can't start, or a script the browser refuses, isn't filled in", async () => {
  const unguarded = fakeScripting({ guard: { guarding: false } });
  assert.deepEqual(await openThenLoad(browserWith(unguarded)), { outcome: "not-filled", tabId: 70, page: "unrecognised" });
  assert.deepEqual(funcs(unguarded), ["readSavePage", "guardChartPlace"]);
  const refused = fakeScripting({ fail: "typeCity" });
  assert.deepEqual(await openThenLoad(browserWith(refused)), { outcome: "not-filled", tabId: 70, page: "unrecognised" });
});

test("a list that doesn't come in time is no-list, for the box to say so", async () => {
  const scripting = fakeScripting({ lists: [{ state: "waiting" }] });
  assert.deepEqual(await chooseFormCity(scripting, 70, VALUES, { timeoutMs: 20, pollMs: 1 }), { kind: "no-list" });
});

test("Birth city typed in before or while waiting is the person's, so nothing is chosen", async () => {
  const before = fakeScripting({ typed: { typed: false, form: "city-typed" } });
  assert.equal(await chooseFormCity(before, 70, VALUES, { timeoutMs: 20, pollMs: 1 }), null);
  assert.deepEqual(funcs(before), ["typeCity"]);
  const during = fakeScripting({ lists: [{ state: "waiting" }, { state: "changed" }] });
  assert.equal(await chooseFormCity(during, 70, VALUES, { timeoutMs: 1000, pollMs: 1 }), null);

  const scripting = fakeScripting({ lists: [{ state: "changed" }] });
  await openThenLoad(browserWith(scripting));
  assert.equal(funcs(scripting).includes("showCityChoice"), false);
});
