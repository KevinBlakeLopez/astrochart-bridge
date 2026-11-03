import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withAafExport } from "../extension/aaf-model.js";
import { analyzePage } from "../extension/core/index.js";
import { viewForDesktopImport, viewForDesktopSend, withDesktopSend } from "../extension/desktop-model.js";
import { actionGroups, groupLabels, viewFor, viewForSky } from "../extension/popup-model.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const analyze = (name) => {
  const { url, input } = fixture(name);
  return analyzePage({ url, input });
};

const LA = { timeZone: "America/Los_Angeles" };
const NY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const { sky: SKY, elsewhere: ELSEWHERE } = groupLabels();

// Each group as its label, then its actions: a button by its label, anything else by its kind.
const groupsOf = (view) => actionGroups(view).map(({ label, actions }) => [label, ...actions.map(({ kind, button }) => button?.label ?? kind)]);

// A chart screen as the popup draws it: with the AAF file, then Send to
// Stellarium Desktop. town is the one an Astro-Seek page's address names.
const chartScreen = (result, default_, { town = null } = {}) =>
  withDesktopSend(withAafExport(viewFor(result, { ...LA, town }), result), default_);
const NEW_YORK = { town: "New York" };

test("an Astro-Seek chart's ways to see the sky come first, and the rest go under Take the chart elsewhere", () => {
  assert.deepEqual(groupsOf(chartScreen(analyze("ny-2024-04-17"), undefined, NEW_YORK)), [
    [SKY, "Open Stellarium Web", "desktop"],
    [ELSEWHERE, "Share…", "download", "next"],
  ]);
});

test("an Astro-Seek chart placed by coordinates leads Take the chart elsewhere with Save in Astro-Seek…", () => {
  assert.deepEqual(groupsOf(chartScreen(analyze("manual-ut-2024-04-17-0000"))), [
    [SKY, "Open Stellarium Web", "desktop"],
    [ELSEWHERE, "Save in Astro-Seek…", "Share…", "download", "next"],
  ]);
});

test("an astro.com chart's Open chart in Astro-Seek goes under Take the chart elsewhere", () => {
  const result = {
    kind: "natal",
    site: "astro-com",
    local: "2024-04-17T23:00:00",
    zoneLabel: null,
    lat: 40.716667,
    lng: -74,
    utc: "2024-04-18T03:00:00Z",
    utcSource: "declared",
    offsetMinutes: -240,
  };
  assert.deepEqual(groupsOf(chartScreen(result)), [
    [SKY, "Open Stellarium Web", "desktop"],
    [ELSEWHERE, "Open chart in Astro-Seek", "Save in Astro-Seek…", "Share…", "download"],
  ]);
});

test("with Stellarium Desktop the default, it leads See the sky, and the line about the default ends it", () => {
  assert.deepEqual(groupsOf(chartScreen(analyze("ny-2024-04-17"), { preferred: true }, NEW_YORK)), [
    [SKY, "desktop", "Open Stellarium Web", "default-choice"],
    [ELSEWHERE, "Share…", "download", "next"],
  ]);
});

test("a Stellarium Web tab's main button opens Astro-Seek, so Take the chart elsewhere comes first", () => {
  assert.deepEqual(groupsOf(withDesktopSend(withAafExport(viewForSky(NY, LA), NY))), [
    [ELSEWHERE, "Open chart in Astro-Seek", "Save in Astro-Seek…", "download", "next"],
    [SKY, "desktop"],
  ]);
});

test("the sky imported from Stellarium Desktop is grouped the same way", () => {
  assert.deepEqual(groupsOf(viewForDesktopImport({ state: "connected", sky: NY })), [
    [ELSEWHERE, "Open chart in Astro-Seek", "Save in Astro-Seek…", "next"],
    [SKY, "Open Stellarium Web"],
  ]);
});

test("a screen without both kinds of action has no labels and keeps its order", () => {
  // The sent screen's line about the default sits beside Done: no way to see the sky.
  assert.deepEqual(groupsOf(viewForDesktopSend({ state: "sent" }, NY)), [[null, "Done", "default-choice"]]);
  // A screen with nothing but ways to see the sky.
  assert.deepEqual(groupsOf(withDesktopSend({ state: "ready", sky: NY, notes: [] })), [[null, "Open Stellarium Web", "desktop"]]);
});

test("an action actionGroups doesn't know goes under Take the chart elsewhere, not nowhere", () => {
  const view = { state: "ready", sky: NY, notes: [], buttons: [{ label: "Open Stellarium Web", opens: "stellarium" }, { label: "Something new", does: "new" }] };
  assert.deepEqual(groupsOf(view), [
    [SKY, "Open Stellarium Web"],
    [ELSEWHERE, "Something new"],
  ]);
});
