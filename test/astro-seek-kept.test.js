import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { astroSeekUrl, sameAstroSeekChart } from "../extension/core/astroseek.js";
import { analyzePage } from "../extension/core/index.js";
import { astroSeekTabs, heldForTab, holdForTab } from "../extension/pending.js";
import { viewFor, viewForAstroCom, withAstroSeekSave } from "../extension/popup-model.js";

// An Astro-Seek chart placed by coordinates, 17 Apr 2024 00:00 UT at
// 40°43'N, 74°0'W, as Open chart in Astro-Seek opens one.
const { url: PAGE_URL, input: PAGE_INPUT } = JSON.parse(
  readFileSync(new URL("../fixtures/astroseek/manual-ut-2024-04-17-0000.json", import.meta.url), "utf8"),
);
const PAGE = analyzePage({ url: PAGE_URL, input: PAGE_INPUT });
// The chart the screen decided, before Astro-Seek rounds it to whole minutes.
const SKY = { utc: "2024-04-17T00:00:20Z", lat: 40.7128, lng: -74.006 };
const NAME = { first: "Example", last: "Person" };
const LA = { timeZone: "America/Los_Angeles" };

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

const DAY = 24 * 60 * 60_000;
const T0 = Date.UTC(2026, 10, 2, 12);

test("an Astro-Seek tab's town and name are kept until the browser quits, apart from astro.com's", async () => {
  const storage = fakeStorage();
  await astroSeekTabs.hold(storage, 7, { ...SKY, town: "New York", name: NAME }, T0);
  const kept = { ...SKY, local: null, town: "New York", name: NAME };
  assert.deepEqual(await astroSeekTabs.held(storage, 7, T0 + 7 * DAY), kept);
  // Never an astro.com tab's, nor theirs an Astro-Seek tab's.
  assert.equal(await heldForTab(storage, 7, T0), null);
  await holdForTab(storage, 8, SKY, T0);
  assert.equal(await astroSeekTabs.held(storage, 8, T0), null);
  // Keeping astro.com's values tidies only astro.com's expired ones.
  await holdForTab(storage, 9, SKY, T0 + DAY);
  assert.deepEqual(await astroSeekTabs.held(storage, 7, T0 + DAY), kept);
  await astroSeekTabs.release(storage, 7);
  assert.equal(await astroSeekTabs.held(storage, 7, T0), null);
});

test("the same Astro-Seek chart is the same to the minute and to the minute of arc", () => {
  const page = { utc: PAGE.utc, lat: PAGE.lat, lng: PAGE.lng };
  assert.equal(sameAstroSeekChart(SKY, page), true);
  assert.equal(sameAstroSeekChart({ ...SKY, utc: "2024-04-17T00:01:00Z" }, page), false);
  assert.equal(sameAstroSeekChart({ ...SKY, lat: 40.7 }, page), false);
  assert.equal(sameAstroSeekChart({ ...SKY, lng: 74.006 }, page), false);
  assert.equal(sameAstroSeekChart({ ...SKY, utc: null }, { ...page, utc: null }), false);
});

test("Open chart in Astro-Seek keeps a town or name for its tab, and nothing for a chart with neither", () => {
  const screen = { notes: [], buttons: [{ label: "Open Stellarium Web", opens: "stellarium" }, { label: "Open chart in Astro-Seek", opens: "astro-seek" }] };
  const opener = (chart) => withAstroSeekSave(screen, chart).buttons[1];
  assert.deepEqual(opener({ town: "New York", name: NAME }).keeps, { town: "New York", name: NAME });
  assert.deepEqual(opener({ town: "New York" }).keeps, { town: "New York", name: null });
  assert.equal(opener({}).keeps, undefined);
  assert.equal(opener({ name: { first: " ", last: "" } }).keeps, undefined);
});

test("on the tab, Save in Astro-Seek… and Enter in astro.com… use the kept town and name", () => {
  const kept = { town: "New York", name: NAME };
  const view = viewFor(PAGE, { ...LA, kept });
  assert.deepEqual(view.buttons[1], { label: "Save in Astro-Seek…", saves: { town: "New York", name: "Example Person" }, secondary: true });
  assert.deepEqual(view.next.view, viewForAstroCom(view.sky, { local: PAGE.local, town: "New York", name: NAME }));
  // Kept for a tab or not, a chart Astro-Seek placed by its own town keeps Astro-Seek's own save link.
  assert.equal(viewFor(PAGE, { ...LA, town: "New York", kept }).buttons.some(({ saves }) => saves), false);
});

test("a page opens Open chart in Astro-Seek through the browser, keeping the town and name for the tab", async (t) => {
  const storage = fakeStorage();
  const created = [];
  const opened = [];
  globalThis.chrome = { tabs: { create: async ({ url }) => (created.push(url), { id: 41 }) }, storage: { session: storage } };
  globalThis.window = { open: (url) => opened.push(url) };
  t.after(() => {
    delete globalThis.chrome;
    delete globalThis.window;
  });
  const { openLink } = await import("../extension/astro-com-page.js");
  const url = astroSeekUrl(SKY);

  await openLink(null, { url, keeps: { town: "New York", name: NAME } }, SKY);
  assert.deepEqual(created, [url]);
  const kept = await astroSeekTabs.held(storage, 41);
  assert.equal(sameAstroSeekChart(kept, PAGE), true);
  assert.deepEqual([kept.town, kept.name], ["New York", NAME]);

  // A link that keeps nothing still opens as a plain link.
  await openLink(null, { url }, SKY);
  assert.deepEqual(opened, [url]);
});
