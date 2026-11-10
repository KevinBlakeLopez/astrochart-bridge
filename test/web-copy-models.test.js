// The import pages' screens on the web copy, which can't open tabs it keeps
// values for, ask for access to a site, or fill in a form: built with
// onTheWeb, no button anywhere on a screen, or on a screen a button leads
// to, carries what only the extension can act on. Without it, every screen
// is the extension's, as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { viewForAafText } from "../extension/aaf-model.js";
import { viewForHorFile } from "../extension/hor-model.js";
import { viewForEntry, viewForLocalEntry } from "../extension/paste-model.js";
import { astroSeekSaveUrl } from "../extension/core/astroseek.js";
import { viewFor, viewForAstroComByHand, viewForAstroSeekSave } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

const WEB = { timeZone: "America/Los_Angeles", onTheWeb: true };
const EXTENSION = { timeZone: "America/Los_Angeles" };
const EXTENSION_ONLY = ["fills", "holds", "saves", "keeps"];

// Where in a screen, its nested screens included, a key only the extension acts on is.
function extensionOnly(value, path = "view") {
  if (Array.isArray(value)) return value.flatMap((each, at) => extensionOnly(each, `${path}[${at}]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, each]) =>
    EXTENSION_ONLY.includes(key) ? [`${path}.${key}`] : extensionOnly(each, `${path}.${key}`),
  );
}

const NY_ENTRY = { date: "2024-04-17", time: "08:00:00", lat: 40.716667, lng: -74, offsetMinutes: -240 };
const NY_TEXT = "#A93:Test,New York,*,17.4.2024,8:00,New York,NY (US)\n#B93:*,40n43,74w00,5hw00,1\n";
const HOR = new Uint8Array(readFileSync(new URL("../fixtures/morinus/ny-est-plus-dst.p2.hor", import.meta.url)));
const SCREENSHOT = {
  kind: "natal",
  site: "astro-seek",
  local: "2024-04-17T08:00:00",
  zoneLabel: "EDT, DST",
  utc: "2024-04-17T12:00:00Z",
  utcSource: "printed",
  offsetMinutes: -240,
  lat: 40.716667,
  lng: -74,
};
const ASTRO_COM_SCREENSHOT = { ...SCREENSHOT, site: "astro-com", zoneLabel: null };
const CHOOSE_SCREENSHOT = {
  ...SCREENSHOT,
  utc: null,
  utcSource: "needs-choice",
  reason: "zone-label-mismatch",
  candidates: [
    { utc: "2024-04-17T12:00:00Z", offsetMinutes: -240, basis: "printed UT" },
    { utc: "2024-04-17T13:00:00Z", offsetMinutes: -300, basis: "zone label EST" },
  ],
};

// Every import page's screens, built for one copy or the other.
const screens = (options) => ({
  "a pasted chart": viewForEntry(NY_ENTRY, { ...options, name: { first: "Test", last: "" }, town: "New York", gender: "female" }),
  "a pasted chart with no offset": viewForLocalEntry(
    { local: "2024-04-17T08:00:00", lat: 40.716667, lng: -74 },
    { ...options, town: "New York" },
  ),
  "an AAF file": viewForAafText(NY_TEXT, options),
  "a Morinus file": viewForHorFile(HOR, options),
  "a screenshot of an Astro-Seek chart": viewForScreenshot(SCREENSHOT, options),
  "a screenshot of an astro.com chart": viewForScreenshot(ASTRO_COM_SCREENSHOT, options),
  "a screenshot whose offset needs choosing": viewForScreenshot(CHOOSE_SCREENSHOT, options),
  "the popup's own astro.com screen": viewFor(ASTRO_COM_SCREENSHOT, options),
  "the popup's own Astro-Seek screen": viewFor(SCREENSHOT, options),
});

// A chart screen, or the first chart of a file's list.
const chartOf = (view) => view.items?.[0].view ?? view;

test("on the web, no screen an import page draws carries what only the extension can act on", () => {
  for (const [name, view] of Object.entries(screens(WEB))) assert.deepEqual(extensionOnly(view), [], name);
});

test("without onTheWeb, the screens are the extension's, as before", () => {
  for (const [name, view] of Object.entries(screens(EXTENSION))) assert.notDeepEqual(extensionOnly(view), [], name);
});

test("on the web, Enter in astro.com… leads to the values to type in, with the chart's name, town and gender", () => {
  const { next } = screens(WEB)["a pasted chart"];
  assert.equal(next.label, "Enter in astro.com…");
  assert.equal(next.view.state, "astro-com-by-hand");
  assert.deepEqual(next.view.buttons, [{ label: "Open astro.com's form", url: "https://www.astro.com/cgi/ade.cgi" }]);
  const rows = Object.fromEntries(next.view.rows);
  assert.equal(rows["First name"], "Test");
  assert.equal(rows.Town, "New York");
  assert.equal(rows.Gender, "female");
  for (const name of ["an AAF file", "a Morinus file", "a screenshot of an Astro-Seek chart", "a screenshot of an astro.com chart"]) {
    assert.equal(chartOf(screens(WEB)[name]).next.view.state, "astro-com-by-hand", name);
  }
});

test("on the web, a pasted chart with no offset opens the values to type in, with no UTC", () => {
  const view = screens(WEB)["a pasted chart with no offset"];
  assert.equal(view.state, "astro-com-by-hand");
  assert.match(view.notes[0], /^No UTC offset was entered, so this chart can open only in astro\.com\./);
  assert.equal(view.sky.utc, null);
});

test("on the web, Save in Astro-Seek… stays after Open chart in Astro-Seek, and keeps the chart's town, name and gender for its screen", () => {
  for (const [name, view] of Object.entries(screens(WEB))) {
    const { buttons } = chartOf(view);
    if (!buttons) continue;
    const at = buttons.findIndex(({ opens }) => opens === "astro-seek");
    if (at === -1) continue;
    assert.equal(buttons[at + 1].label, "Save in Astro-Seek…", name);
    assert.equal(buttons.filter(({ savesByHand }) => savesByHand).length, 1, name);
  }
  const save = screens(WEB)["a pasted chart"].buttons.find(({ savesByHand }) => savesByHand);
  assert.deepEqual(save, { label: "Save in Astro-Seek…", savesByHand: { town: "New York", name: "Test", gender: "female" }, secondary: true });
});

test("by hand, Save in Astro-Seek… opens the form filled in by its address, and says this page can't choose the town", () => {
  const sky = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
  const saves = { town: "New York", name: "Test", gender: null };
  const view = viewForAstroSeekSave({ outcome: "by-hand" }, sky, saves);
  const declined = viewForAstroSeekSave({ outcome: "declined" }, sky, saves);
  assert.equal(view.message, "This page can't choose the town in Astro-Seek's form for you.");
  assert.deepEqual({ ...view, message: null }, { ...declined, message: null });
  assert.deepEqual(view.buttons, [{ label: "Open Astro-Seek's form", url: astroSeekSaveUrl(sky, { name: "Test" }) }]);
});

test("the values to type into astro.com include the chart's gender, and no Gender row without one", () => {
  const sky = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
  const labels = (view) => view.rows.map(([label]) => label);
  assert.equal(labels(viewForAstroComByHand(sky, { gender: "male" })).includes("Gender"), true);
  assert.equal(labels(viewForAstroComByHand(sky)).includes("Gender"), false);
});
