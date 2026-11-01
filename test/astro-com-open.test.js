import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ASTRO_COM_ACCESS, openAndFill, tabLoaded } from "../extension/astro-com-open.js";
import { fillForm, formValues, readFormPage } from "../extension/core/astrocom.js";
import { heldForTab } from "../extension/pending.js";
import {
  ASTRO_COM_BUSY,
  viewForAstroCom,
  viewForAstroComManual,
  viewForAstroComNotFilled,
} from "../extension/popup-model.js";

const FORM_URL = "https://www.astro.com/cgi/ade.cgi";
const VALUES = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74, town: "New York", name: null };

// A stand-in for chrome.storage.session, as in test/astro-com-form.test.js.
function fakeStorage() {
  const items = {};
  return {
    items,
    async get(keys) {
      if (keys === null) return { ...items };
      return Object.fromEntries([keys].flat().filter((key) => key in items).map((key) => [key, items[key]]));
    },
    async set(more) {
      Object.assign(items, structuredClone(more));
    },
    async remove(keys) {
      for (const key of [keys].flat()) delete items[key];
    },
  };
}

// A stand-in for chrome.tabs: create makes a tab that is still loading, and
// the test decides when it loads, where it ends up, or that it closes.
function fakeTabs() {
  const updated = new Set();
  const removed = new Set();
  const tabs = new Map();
  let nextId = 40;
  return {
    created: [],
    updates: [],
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
    async update(id, properties) {
      this.updates.push([id, properties]);
      return { ...tabs.get(id), ...properties };
    },
    onUpdated: { addListener: (f) => updated.add(f), removeListener: (f) => updated.delete(f) },
    onRemoved: { addListener: (f) => removed.add(f), removeListener: (f) => removed.delete(f) },
    listeners: () => updated.size + removed.size,
    load(id, url = FORM_URL) {
      Object.assign(tabs.get(id), { url, status: "complete" });
      for (const listener of [...updated]) listener(id, { status: "complete" }, { ...tabs.get(id) });
    },
    close(id) {
      tabs.delete(id);
      for (const listener of [...removed]) listener(id, {});
    },
  };
}

// A stand-in for chrome.scripting that answers for readFormPage and fillForm.
function fakeScripting({ page = { auth: "unknown", form: "blank" }, fill = { filled: true } } = {}) {
  const calls = [];
  return {
    calls,
    async executeScript({ target, func, args }) {
      calls.push({ tabId: target.tabId, func: func.name, args });
      if (func === readFormPage) return [{ result: page }];
      if (func === fillForm) return [{ result: fill }];
      throw new Error(`unexpected ${func.name}`);
    },
  };
}

// Starts openAndFill and loads the tab it opens, the way a page finishes loading after create.
async function openThenLoad(browser, { url = FORM_URL, timeoutMs = 1000, loadAt } = {}) {
  const pending = openAndFill(browser, { url: FORM_URL, values: VALUES, timeoutMs });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const [tab] = browser.tabs.created;
  if (loadAt !== null && tab) browser.tabs.load(40, loadAt ?? url);
  return pending;
}

const browserWith = (scripting = fakeScripting()) => ({ tabs: fakeTabs(), scripting, storage: fakeStorage() });

test("AstroChart Bridge asks only for www.astro.com, and only when the form button is clicked", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(ASTRO_COM_ACCESS, { origins: ["https://www.astro.com/*"] });
  assert.ok(manifest.optional_host_permissions.includes("https://www.astro.com/*"));
  assert.equal((manifest.host_permissions ?? []).length, 0);
});

test("a signed-in or unknown browser's blank form is filled in with no stop, and the values are forgotten", async () => {
  const browser = browserWith();
  const result = await openThenLoad(browser);
  assert.deepEqual(result, { outcome: "filled", tabId: 40 });
  // The tab opens behind the popup, which closes when it comes to the front.
  assert.deepEqual(browser.tabs.created, [{ url: FORM_URL, active: false }]);
  assert.deepEqual(browser.scripting.calls, [
    { tabId: 40, func: "readFormPage", args: undefined },
    { tabId: 40, func: "fillForm", args: [formValues(VALUES)] },
  ]);
  assert.equal(await heldForTab(browser.storage, 40), null);
  assert.equal(browser.tabs.listeners(), 0);
});

test("a signed-out browser is stopped before anything is filled in, with the values kept for the tab", async () => {
  const browser = browserWith(fakeScripting({ page: { auth: "signed-out", form: "blank" } }));
  const result = await openThenLoad(browser);
  assert.deepEqual(result, { outcome: "choose", tabId: 40, page: { kind: "form", auth: "signed-out", form: "blank" } });
  assert.deepEqual(browser.scripting.calls.map((call) => call.func), ["readFormPage"]);
  assert.deepEqual(await heldForTab(browser.storage, 40), VALUES);
});

test("a form that isn't blank, or isn't recognised, is left for the user to choose", async () => {
  for (const form of ["typed", "unrecognised"]) {
    const browser = browserWith(fakeScripting({ page: { auth: "unknown", form } }));
    assert.deepEqual(await openThenLoad(browser), { outcome: "choose", tabId: 40, page: { kind: "form", auth: "unknown", form } });
    assert.deepEqual(browser.scripting.calls.map((call) => call.func), ["readFormPage"]);
  }
});

test("a form that changed between reading and filling is left for the user to choose, as it now is", async () => {
  const browser = browserWith(fakeScripting({ fill: { filled: false, form: "typed" } }));
  assert.deepEqual(await openThenLoad(browser), {
    outcome: "choose", tabId: 40, page: { kind: "form", auth: "unknown", form: "typed" },
  });
  assert.deepEqual(await heldForTab(browser.storage, 40), VALUES);
});

test("a page that doesn't finish loading in time isn't filled in, and its values wait for the two-click way", async () => {
  const browser = browserWith();
  const result = await openThenLoad(browser, { timeoutMs: 20, loadAt: null });
  assert.deepEqual(result, { outcome: "not-filled", tabId: 40 });
  assert.deepEqual(browser.scripting.calls, []);
  assert.deepEqual(await heldForTab(browser.storage, 40), VALUES);
  assert.equal(browser.tabs.listeners(), 0);
});

test("a tab that ends up somewhere other than the form, such as a sign-in page, isn't filled in", async () => {
  const browser = browserWith();
  const result = await openThenLoad(browser, { loadAt: "https://www.astro.com/cgi/awd.cgi?lang=e" });
  assert.deepEqual(result, { outcome: "not-filled", tabId: 40 });
  assert.deepEqual(browser.scripting.calls, []);
});

test("a script that can't run on the tab, or a tab closed while loading, isn't filled in", async () => {
  const failing = { async executeScript() { throw new Error("Cannot access contents of the page."); } };
  assert.deepEqual(await openThenLoad(browserWith(failing)), { outcome: "not-filled", tabId: 40 });

  const browser = browserWith();
  const pending = openAndFill(browser, { url: FORM_URL, values: VALUES, timeoutMs: 1000 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  browser.tabs.close(40);
  assert.deepEqual(await pending, { outcome: "not-filled", tabId: 40 });
});

test("a tab that had already loaded when the wait began counts as loaded", async () => {
  const tabs = fakeTabs();
  const { id } = await tabs.create({ url: FORM_URL, active: false });
  tabs.load(id);
  assert.equal((await tabLoaded(tabs, id, 1000)).url, FORM_URL);
  assert.equal(tabs.listeners(), 0);
});

test("another tab loading doesn't count", async () => {
  const tabs = fakeTabs();
  const { id } = await tabs.create({ url: FORM_URL, active: false });
  const other = await tabs.create({ url: FORM_URL, active: false });
  const waiting = tabLoaded(tabs, id, 30);
  tabs.load(other.id);
  assert.equal(await waiting, null);
});

// --- What the popup shows around it ----------------------------------------

test("the form button fills the form in as it opens; signing in and creating an account only keep the values", () => {
  const view = viewForAstroCom(VALUES, { town: VALUES.town });
  assert.equal(view.message, "AstroChart Bridge opens astro.com's form and fills it in as it opens. It doesn't submit the form.");
  assert.deepEqual(view.buttons.map(({ label, fills }) => [label, fills === true]), [
    ["Open astro.com's form", true],
    ["Sign in", false],
    ["Create account", false],
  ]);
  assert.ok(view.notes.includes(
    "The first time, your browser asks to let AstroChart Bridge read and change www.astro.com pages. It uses that only to fill in the form in the tab it opens. If you say no, it shows the values to fill in yourself.",
  ));
});

test("while the form loads, the popup says so and offers nothing to click", () => {
  assert.deepEqual(ASTRO_COM_BUSY, { state: "astro-com-busy", message: "Opening astro.com's form to fill it in…", notes: [], buttons: [] });
});

test("declining the access gives the two-click way, with the toolbar icon named at that moment", () => {
  const view = viewForAstroComManual(VALUES);
  assert.equal(view.state, "astro-com-manual");
  assert.equal(view.message, "AstroChart Bridge can't fill in the form without access to www.astro.com.");
  assert.deepEqual(view.notes, [
    "After the astro.com tab opens, click the AstroChart Bridge icon in the toolbar again to fill in the form.",
  ]);
  assert.deepEqual(view.rows, viewForAstroCom(VALUES, { town: VALUES.town }).rows);
  // This button only keeps the values for the tab, so it never asks again.
  assert.deepEqual(view.buttons, [{ label: "Open astro.com's form", url: FORM_URL, holds: VALUES }]);
});

test("a form that didn't load in time leads to its tab, with the toolbar icon named", () => {
  const view = viewForAstroComNotFilled(VALUES);
  assert.equal(view.state, "astro-com-not-filled");
  assert.equal(view.message, "astro.com's form didn't finish opening, so AstroChart Bridge couldn't fill it in yet.");
  assert.deepEqual(view.notes, [
    "Switch to the astro.com tab, then click the AstroChart Bridge icon in the toolbar again to fill in the form.",
  ]);
  assert.deepEqual(view.buttons, [{ label: "Go to the astro.com tab", does: "show-tab" }]);
});

test("on the screenshot page, a form that needs a choice first leads to its tab, where the popup offers it", () => {
  const view = viewForAstroComNotFilled(VALUES, "choose");
  assert.equal(view.message, "astro.com's form is open, but something needs your choice first, such as signing in.");
  assert.deepEqual(view.notes, viewForAstroComNotFilled(VALUES).notes);
  assert.deepEqual(view.buttons, viewForAstroComNotFilled(VALUES).buttons);
});
