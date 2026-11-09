// Which planets were visible: the chart screens' way to Helioscope's page.
// It goes wherever Share… goes, and like Share… it opens a page in a tab
// with the chart in its link, here helioscope.html, with no name or town.
// popup.js, screenshot.js and paste.js open it; their part is in the manual
// test checklist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withAafExport } from "../extension/aaf-model.js";
import { analyzePage } from "../extension/core/index.js";
import { toFragment } from "../extension/core/portable.js";
import { withDesktopSend } from "../extension/desktop-model.js";
import { chartFromLink } from "../extension/helioscope-model.js";
import { viewForEntry } from "../extension/paste-model.js";
import {
  actionGroups,
  chartToShare,
  groupLabels,
  helioscopeButton,
  viewFor,
  viewForAstroCom,
  viewForHelioscopeRefusal,
  viewForSky,
} from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const analyze = (name) => {
  const { url, input } = fixture(name);
  return analyzePage({ url, input });
};

const LA = { timeZone: "America/Los_Angeles" };
const NY_SKY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const HELIOSCOPE = "Which planets were visible";
const labels = (view) => view.buttons.map(({ label }) => label);

test("the button is a secondary one, and its screen's script opens the page", () => {
  assert.deepEqual(helioscopeButton(), { label: "Which planets were visible", does: "helioscope", secondary: true });
});

test("every chart screen that offers Share… offers it right before Share…, a horary chart's too", () => {
  const astroCom = {
    kind: "natal", site: "astro-com", local: "2024-04-17T23:00:00", zoneLabel: null, lat: 40.716667, lng: -74,
    utc: "2024-04-18T03:00:00Z", utcSource: "declared", offsetMinutes: -240,
  };
  const needsOffset = {
    kind: "natal", site: "astro-seek", local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", lat: 40.716667, lng: -74,
    utc: null, utcSource: "needs-offset", reason: "no-printed-ut",
  };
  const needsChoice = {
    kind: "natal", site: "astro-seek", local: "2021-03-14T02:30:00", zoneLabel: "EST", lat: 40.716667, lng: -74,
    utc: null, utcSource: "needs-choice",
    candidates: [
      { basis: "printed UT", utc: "2021-03-14T06:30:00Z", offsetMinutes: -240 },
      { basis: "zone label", utc: "2021-03-14T07:30:00Z", offsetMinutes: -300 },
    ],
  };
  const screenshot = {
    kind: "natal", site: "astro-seek", local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", lat: 40.716667, lng: -74,
    utc: "2024-04-17T12:00:00Z", utcSource: "printed", offsetMinutes: -240,
  };
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };
  const screens = {
    "an Astro-Seek page": viewFor(analyze("ny-2024-04-17"), { ...LA, town: "New York" }),
    "an Astro-Seek page placed by coordinates": viewFor(analyze("manual-ut-2024-04-17-0000"), LA),
    "an astro.com page": viewFor(astroCom, LA),
    "a page whose offset is to be entered": viewFor(needsOffset),
    "a page whose UTC is to be chosen": viewFor(needsChoice),
    "a screenshot": viewForScreenshot(screenshot, LA),
    // A horary chart is natal to the reader, with horary as its gender.
    "a horary chart's screenshot": viewForScreenshot({ ...screenshot, gender: "horary" }, LA),
    "pasted text": viewForEntry(entry, LA),
  };
  for (const [name, view] of Object.entries(screens)) {
    const shown = labels(view);
    assert.ok(shown.includes("Share…"), `${name}: ${shown.join(", ")}`);
    assert.equal(shown.indexOf(HELIOSCOPE), shown.indexOf("Share…") - 1, `${name}: ${shown.join(", ")}`);
  }
});

test("a screen that doesn't offer Share… doesn't offer it either: a Stellarium tab's, the astro.com step and a refused page", () => {
  // A Stellarium tab's sky has no birthplace time for the link to carry.
  assert.doesNotMatch(JSON.stringify(viewForSky(NY_SKY)), /"helioscope"/);
  assert.doesNotMatch(JSON.stringify(viewForAstroCom(NY_SKY)), /"helioscope"/);
  assert.equal(viewFor(analyze("transit-sydney-2026-11-01")).buttons, undefined);
});

const { sky: SKY, elsewhere: ELSEWHERE } = groupLabels();
const groupsOf = (view) => actionGroups(view).map(({ label, actions }) => [label, ...actions.map(({ kind, button }) => button?.label ?? kind)]);
// A chart screen as the popup draws it: with the AAF file, then Send to Stellarium Desktop.
const chartScreen = (result, default_) => withDesktopSend(withAafExport(viewFor(result, { ...LA, town: "New York" }), result), default_);

test("it goes under See the sky, after the Stellarium buttons and the line about which is the default", () => {
  const result = analyze("ny-2024-04-17");
  assert.deepEqual(groupsOf(chartScreen(result)), [
    [SKY, "Open Stellarium Web", "desktop", HELIOSCOPE],
    [ELSEWHERE, "Share…", "download", "next"],
  ]);
  assert.deepEqual(groupsOf(chartScreen(result, { preferred: true })), [
    [SKY, "desktop", "Open Stellarium Web", "default-choice", HELIOSCOPE],
    [ELSEWHERE, "Share…", "download", "next"],
  ]);
});

test("its link carries the chart without its name or town, and Helioscope's page reads it back as the same chart", () => {
  const result = analyze("ny-2024-04-17");
  const view = viewFor(result, { ...LA, town: "New York" });
  // As the popup builds it for helioscope.html: no labels, even for a chart that has them.
  const shared = chartToShare(result, view.sky, "page");
  assert.equal(shared.kind, "portable");
  assert.equal(Object.hasOwn(shared.chart, "labels"), false);
  assert.deepEqual(chartFromLink(`#${toFragment(shared.chart)}`), {
    kind: "chart",
    chart: {
      kind: "natal",
      site: null,
      local: result.local,
      zoneLabel: result.zoneLabel,
      lat: result.lat,
      lng: result.lng,
      utc: result.utc,
      utcSource: "declared",
      offsetMinutes: result.offsetMinutes,
    },
  });
});

test("a chart its link can't carry says why, with Cancel back to the chart, as Share… does", () => {
  assert.deepEqual(viewForHelioscopeRefusal("before-gregorian"), {
    state: "helioscope-refused",
    message: "AstroChart Bridge can't work out the planets for a chart dated before 15 October 1582 yet: it can't tell which calendar the date is in.",
    code: "before-gregorian",
    notes: [],
    buttons: [],
  });
  assert.equal(viewForHelioscopeRefusal("unknown-field").message, "AstroChart Bridge can't work out the planets for this chart.");
});
