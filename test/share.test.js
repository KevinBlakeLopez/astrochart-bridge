import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import {
  chartToShare,
  labelsToShare,
  townAndName,
  viewFor,
  viewForAstroCom,
  viewForShareRefusal,
  viewForSky,
} from "../extension/popup-model.js";
import { RECEIVER_URL } from "../extension/share-config.js";

const analyze = (name) => {
  const { url, input } = JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
  return analyzePage({ url, input });
};

const NY_SKY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };

// chartToShare's chart, or a failed assertion naming the refusal.
function shared(result, sky, via, chart) {
  const built = chartToShare(result, sky, via, chart);
  assert.equal(built.kind, "portable", `refused: ${built.reason}`);
  return built.chart;
}

// --- What is shared ---

test("a ready Astro-Seek chart is shared with its local time, zone label and printed UT", () => {
  assert.deepEqual(shared(analyze("ny-2024-04-17"), NY_SKY, "page"), {
    format: "astrochart",
    version: 1,
    chart: { calendar: "gregorian", local: "2024-04-17T08:00:00", utcOffsetSeconds: -14400, latitude: 40.716667, longitude: -74 },
    source: { site: "astro-seek", via: "page", zoneLabel: "EDT, DST", utcBasis: "printed" },
  });
});

test("a ready astro.com chart has no zone label, and its offset was declared", () => {
  const result = {
    kind: "natal", site: "astro-com", local: "2024-04-17T08:00:00", zoneLabel: null, lat: 40.716667, lng: -74,
    utc: "2024-04-17T12:00:00Z", utcSource: "declared", offsetMinutes: -240,
  };
  assert.deepEqual(shared(result, NY_SKY, "page").source, { site: "astro-com", via: "page", utcBasis: "declared" });
});

test("a screenshot's chart says it came from a screenshot", () => {
  const result = {
    kind: "natal", site: "astro-com", local: "1645-07-26T07:30:03", zoneLabel: null, lat: 51.5, lng: -0.166667,
    utc: "1645-07-26T07:30:43Z", utcSource: "printed", offsetMinutes: -40 / 60,
  };
  const chart = shared(result, { utc: result.utc, lat: result.lat, lng: result.lng }, "screenshot");
  assert.deepEqual(chart.source, { site: "astro-com", via: "screenshot", utcBasis: "printed" });
  assert.equal(chart.chart.utcOffsetSeconds, -40);
});

test("on the choose screen, the reading picked decides the offset and its basis", () => {
  const gap = analyze("ny-2021-03-14-gap");
  const [printed, label] = viewFor(gap).choices;
  const asPrinted = shared(gap, printed.sky, "page");
  const asLabelled = shared(gap, label.sky, "page");
  assert.equal(asPrinted.chart.utcOffsetSeconds, -14400);
  assert.equal(asPrinted.source.utcBasis, "printed");
  assert.equal(asLabelled.chart.utcOffsetSeconds, -18000);
  assert.equal(asLabelled.source.utcBasis, "zone-label");
  assert.equal(asLabelled.source.zoneLabel, "EST");
});

test("on the enter-offset screen, the offset was entered", () => {
  const result = {
    kind: "natal", site: "astro-seek", local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", lat: 40.716667, lng: -74,
    utc: null, utcSource: "needs-offset", reason: "no-printed-ut",
  };
  const chart = shared(result, NY_SKY, "page");
  assert.equal(chart.chart.utcOffsetSeconds, -14400);
  assert.equal(chart.source.utcBasis, "entered");
});

test("the sky shared is the one decided, not the result's", () => {
  // The popup passes the sky its buttons open; on a ready screen it is the result's.
  const chart = shared(analyze("sydney-2024-01-15"), { utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 }, "page");
  assert.equal(chart.chart.utcOffsetSeconds, 39600);
  assert.equal(chart.chart.latitude, -33.866667);
});

test("a chart before 15 October 1582 is refused", () => {
  const result = {
    kind: "natal", site: "astro-seek", local: "1500-01-01T12:00:00", zoneLabel: null, lat: 41.9, lng: 12.5,
    utc: "1500-01-01T11:00:00Z", utcSource: "printed", offsetMinutes: 60,
  };
  assert.deepEqual(chartToShare(result, { utc: result.utc, lat: result.lat, lng: result.lng }, "page"), {
    kind: "refused",
    reason: "before-gregorian",
  });
});

// --- The chart's name and town ---

const ASTRO_COM = {
  kind: "natal", site: "astro-com", local: "2024-04-17T08:00:00", zoneLabel: null, lat: 40.716667, lng: -74,
  utc: "2024-04-17T12:00:00Z", utcSource: "declared", offsetMinutes: -240,
  town: "New York, NY", name: { first: "Jane", last: "Doe" },
};

test("a chart with no town or name is shared with no labels, as before", () => {
  assert.ok(!Object.hasOwn(shared(analyze("ny-2024-04-17"), NY_SKY, "page"), "labels"));
  assert.ok(!Object.hasOwn(shared(analyze("ny-2024-04-17"), NY_SKY, "page", { town: null, name: null }), "labels"));
});

test("a chart's town and name go with it as labels, the name's two parts as one", () => {
  const chart = shared(ASTRO_COM, NY_SKY, "page", townAndName(ASTRO_COM));
  assert.deepEqual(chart.labels, { name: "Jane Doe", town: "New York, NY" });
});

test("townAndName gives an astro.com page's own record, and an Astro-Seek page's or its tab's", () => {
  assert.deepEqual(townAndName(ASTRO_COM, { town: "Elsewhere", name: null }), { town: "New York, NY", name: { first: "Jane", last: "Doe" } });
  const seek = analyze("ny-2024-04-17");
  const kept = { town: "Kept Town", name: { first: "Kept", last: "" } };
  assert.deepEqual(townAndName(seek), { town: null, name: null });
  assert.deepEqual(townAndName(seek, { kept }), { town: "Kept Town", name: { first: "Kept", last: "" } });
  assert.deepEqual(townAndName(seek, { town: "Page Town", name: null, kept }), { town: "Page Town", name: { first: "Kept", last: "" } });
});

test("townAndName gives Share… what the Astro-Seek screen gives astro.com's form", () => {
  const seek = analyze("ny-2024-04-17");
  const options = { town: null, name: { first: "Jane", last: "Doe" }, kept: { town: "New York, NY", name: null } };
  const holds = viewFor(seek, options).next.view.buttons[0].holds;
  assert.deepEqual(townAndName(seek, options), { town: holds.town, name: holds.name });
});

test("a name or town the format can't carry is left out, and the chart still shares", () => {
  assert.deepEqual(labelsToShare({ name: { first: "x".repeat(101), last: "" }, town: "Paris" }), { town: "Paris" });
  assert.deepEqual(labelsToShare({ name: { first: "Jane", last: "Doe" }, town: "Paris\u202E" }), { name: "Jane Doe" });
  assert.deepEqual(labelsToShare({ name: { first: " ", last: "" }, town: "  " }), {});
  assert.deepEqual(labelsToShare({ town: "  Paris  " }), { town: "Paris" });
  assert.deepEqual(labelsToShare(), {});
  const chart = shared(ASTRO_COM, NY_SKY, "page", { name: { first: "x".repeat(101), last: "" }, town: null });
  assert.ok(!Object.hasOwn(chart, "labels"));
});

// --- When sharing is refused ---

test("a refusal to share explains itself, keeps its code, and offers only Cancel", () => {
  assert.deepEqual(viewForShareRefusal("before-gregorian"), {
    state: "share-refused",
    message: "AstroChart Bridge can't share a chart dated before 15 October 1582 yet: it can't tell which calendar the date is in.",
    code: "before-gregorian",
    notes: [],
    buttons: [],
  });
  assert.deepEqual(viewForShareRefusal("invalid-source"), {
    state: "share-refused",
    message: "AstroChart Bridge can't share this chart.",
    code: "invalid-source",
    notes: [],
    buttons: [],
  });
});

// --- Where Share… is offered ---

test("a Stellarium tab has no birthplace time, so it can't be shared", () => {
  assert.doesNotMatch(JSON.stringify(viewForSky(NY_SKY)), /"share"/);
});

test("the astro.com screens don't offer to share", () => {
  assert.doesNotMatch(JSON.stringify(viewForAstroCom(NY_SKY)), /"share"/);
});

test("a refused page has nothing to share", () => {
  assert.equal(viewFor(analyze("transit-sydney-2026-11-01")).buttons, undefined);
});

// --- The receiving page's address ---

test("shared links open the receiving page on https, by its file name", () => {
  const url = new URL(RECEIVER_URL);
  assert.equal(url.protocol, "https:");
  // A folder address would be redirected, and a redirect carries the fragment along.
  assert.match(url.pathname, /\/chart\.html$/);
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
});
