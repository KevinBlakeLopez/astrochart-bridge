// The view model of Helioscope's page, helioscope.html: the chart from the
// page's link, the five planets worked out with the page's settings, and the
// screen drawn from them. Most cases run the real engine, so every string
// below is what the page shows for that chart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classify } from "../extension/core/helioscope.js";
import { toFragment, toPortable } from "../extension/core/portable.js";
import { createEngine } from "../extension/helioscope-engine.js";
import { viewFor } from "../extension/popup-model.js";
import {
  chartFromLink,
  helioscopeSettings,
  nightWeather,
  readElevation,
  setHelioscopeSettings,
  viewForRefusal,
  viewForVisibility,
  visibilities,
  visibilitiesWithAir,
  weatherOffer,
  weatherRequestFor,
} from "../extension/helioscope-model.js";

// The feasibility doc's reference chart (§10): New York, 10 January 2025 at
// 17:35, UTC-05:00. Its evening and morning windows are both on 10 January.
const NEW_YORK = {
  kind: "natal",
  site: null,
  local: "2025-01-10T17:35:00",
  zoneLabel: null,
  lat: 40.7128,
  lng: -74.006,
  utc: "2025-01-10T22:35:00Z",
  utcSource: "declared",
  offsetMinutes: -300,
};

// The same place at 01:30 the next morning: the nearest sunset is the
// evening before, on 10 January, and the nearest sunrise is that morning's.
const NEW_YORK_EARLY = { ...NEW_YORK, local: "2025-01-11T01:30:00", utc: "2025-01-11T06:30:00Z" };

// London on 21 June 2025, when the Sun never reaches -18°: the windows run
// to and from its lowest point, after midnight, as decided on 6 November 2026 (§6).
const LONDON = { ...NEW_YORK, local: "2025-06-21T22:00:00", utc: "2025-06-21T21:00:00Z", lat: 51.5074, lng: -0.1278, offsetMinutes: 60 };

// Tromsø at midsummer: no sunset and no sunrise, so no window and no prediction.
const TROMSO = { ...NEW_YORK, local: "2025-06-21T02:00:00", utc: "2025-06-21T00:00:00Z", lat: 69.6492, lng: 18.9553, offsetMinutes: 120 };

// No elevation given, and under the beams within 15°: the page's defaults.
const DEFAULTS = { elevation: null, underTheBeams: 15 };

// What a page with a Stellarium Web link says about it, after the offset.
const LINKS_NOTE =
  "See it in Stellarium Web sends that moment and the chart's place to stellarium-web.org, whose page passes the link on to Google's advertising tags. Stellarium Web's clock starts running at once; its pause button stops it.";

// What the page works out for a chart, with an engine of its own.
async function worked(chart, settings = DEFAULTS) {
  const engine = await createEngine();
  try {
    return visibilities(chart, engine, settings);
  } finally {
    engine.dispose();
  }
}

// The screen for a chart, by planet.
async function screen(chart, settings = DEFAULTS) {
  const { kind, results } = await worked(chart, settings);
  assert.equal(kind, "results");
  const view = viewForVisibility(chart, results);
  return { view, planets: Object.fromEntries(view.planets.map((row) => [row.planet, row])) };
}

// An engine that finds windows a fixed time after wherever each search
// starts, as test/helioscope.test.js has it, and answers every sample with
// limitingMagnitude.
function fakeEngine(limitingMagnitude) {
  const after = { sunset: 0.3, sunrise: 0.3, "astronomical-dusk": 0.06, "astronomical-dawn": 0.94 };
  return {
    assumptions: {
      swissEphemeris: "2.10.03",
      ephemeris: "moshier",
      helflag: 4,
      moon: "included",
      atmosphere: { pressure: 0, temperature: 0, humidity: 0, meteorologicalRange: 0 },
      observer: { age: 0, snellenRatio: 0 },
    },
    sunEvent: (jd, _place, event) => ({ kind: "found", jd: jd + after[event] }),
    solarGeometry: () => ({ kind: "computed", sunLongitude: 290.9, planetLongitude: 338.1, planetLatitude: -0.6, elongation: 47.2 }),
    limitingMagnitude,
  };
}

test("chartFromLink: a link's chart becomes the natal chart visibility() takes, as the receiving page reads it", () => {
  const built = toPortable(
    { local: NEW_YORK.local, utc: NEW_YORK.utc, lat: NEW_YORK.lat, lng: NEW_YORK.lng },
    { site: "astro-seek", via: "page", zoneLabel: "EST", utcBasis: "printed" },
  );
  assert.deepEqual(chartFromLink(`#${toFragment(built.chart)}`), { kind: "chart", chart: { ...NEW_YORK, zoneLabel: "EST" } });
});

test("chartFromLink: no chart in the link is null, and a damaged or newer one is refused with the link's reason", () => {
  assert.equal(chartFromLink(""), null);
  assert.equal(chartFromLink("#"), null);
  assert.deepEqual(chartFromLink("#hello"), { kind: "refused", reason: "malformed" });
  assert.deepEqual(chartFromLink("#v2=abc"), { kind: "refused", reason: "unsupported-version" });
});

test("visibilities: the five planets in order, each worked out with the page's elevation and limit for under the beams", async () => {
  const { kind, results } = await worked(NEW_YORK, { elevation: 120, underTheBeams: 17 });
  assert.equal(kind, "results");
  assert.deepEqual(Object.keys(results), ["mercury", "venus", "mars", "jupiter", "saturn"]);
  for (const [planet, result] of Object.entries(results)) {
    assert.equal(result.kind, "visibility");
    assert.equal(result.planet, planet);
    assert.deepEqual(result.assumptions.elevation, { metres: 120, source: "given" });
    assert.equal(result.assumptions.conditionLimits.underTheBeams, 17);
  }
});

test("visibilities: with no elevation given, each result says it assumed 0 m", async () => {
  const { results } = await worked(NEW_YORK);
  assert.deepEqual(results.venus.assumptions.elevation, { metres: 0, source: "default" });
  assert.equal(results.venus.assumptions.conditionLimits.underTheBeams, 15);
});

test("visibilities: a chart visibility() refuses is refused once, for the whole page", async () => {
  const late = { ...NEW_YORK, local: "3000-01-01T12:00:00", utc: "3000-01-01T17:00:00Z" };
  assert.deepEqual(await worked(late), { kind: "refused", reason: "date-out-of-range" });
  assert.deepEqual(await worked(NEW_YORK, { elevation: 30_000, underTheBeams: 15 }), { kind: "refused", reason: "invalid-elevation" });
});

test("viewForVisibility: the chart screen's own rows, then the five planets in order", async () => {
  const { view } = await screen(NEW_YORK);
  assert.equal(view.state, "ready");
  assert.deepEqual(view.rows, viewFor(NEW_YORK).rows);
  assert.deepEqual(
    view.planets.map(({ planet, name }) => [planet, name]),
    [["mercury", "Mercury"], ["venus", "Venus"], ["mars", "Mars"], ["jupiter", "Jupiter"], ["saturn", "Saturn"]],
  );
});

test("viewForVisibility: each planet's condition and side of the Sun at the chart's moment, kept apart from the prediction", async () => {
  const { planets } = await screen(NEW_YORK);
  assert.deepEqual(planets.mercury.moment, { condition: "clear", side: "morning", text: "Clear · morning", angle: "17.3° west of the Sun" });
  assert.deepEqual(planets.venus.moment, { condition: "clear", side: "evening", text: "Clear · evening", angle: "47.2° east of the Sun" });
  assert.deepEqual(planets.mars.moment, { condition: "clear", side: "morning", text: "Clear · morning", angle: "172.7° west of the Sun" });
  assert.deepEqual(planets.jupiter.moment, { condition: "clear", side: "evening", text: "Clear · evening", angle: "141.3° east of the Sun" });
  assert.deepEqual(planets.saturn.moment, { condition: "clear", side: "evening", text: "Clear · evening", angle: "54.4° east of the Sun" });
});

test("viewForVisibility: each prediction says, in plain words, its best moment at the chart's offset to the nearest minute, and how many times brighter or fainter than needed", async () => {
  const { planets } = await screen(NEW_YORK);
  assert.deepEqual(planets.mercury.prediction, { kind: "undetectable", label: "Too faint", detail: "Best chance at dawn, 06:38: about 2.4 times too faint" });
  assert.deepEqual(planets.venus.prediction, { kind: "detectable", label: "Visible", detail: "At dusk, 18:15: about 4,000 times brighter than needed" });
  // Mars is near opposition, up all night, and visible in both windows.
  assert.deepEqual(planets.mars.prediction, { kind: "detectable", label: "Visible", detail: "At dawn, 05:42: about 1,200 times brighter than needed · also visible at dusk" });
  assert.deepEqual(planets.jupiter.prediction, { kind: "detectable", label: "Visible", detail: "At dusk, 18:21: about 310 times brighter than needed" });
  assert.deepEqual(planets.saturn.prediction, { kind: "detectable", label: "Visible", detail: "At dusk, 18:15: about 29 times brighter than needed" });
});

test("viewForVisibility: a planet's details give both windows, its best moment's sky, and its two angles from the Sun", async () => {
  const { planets } = await screen(NEW_YORK);
  assert.deepEqual(planets.venus.details, [
    ["Evening", "From sunset at 16:49 to the end of astronomical twilight at 18:26, above the horizon in 50 of 50 samples"],
    ["Best at dusk", "18:15: magnitude −4.53 against a limiting magnitude of 4.48, a margin of +9.01. 25° up in the southwest, the Sun 16° below the horizon"],
    ["Morning", "From the start of astronomical twilight at 05:42 to sunrise at 07:19, below the horizon throughout"],
    ["Longitude gap", "+47.16°"],
    ["Elongation", "47.17°"],
  ]);
  assert.deepEqual(planets.mars.details, [
    ["Evening", "From sunset at 16:49 to the end of astronomical twilight at 18:26, above the horizon in 41 of 50 samples"],
    ["Best at dusk", "18:26: magnitude −1.40 against a limiting magnitude of 2.76, a margin of +4.16. 14° up in the east, the Sun 18° below the horizon"],
    ["Morning", "From the start of astronomical twilight at 05:42 to sunrise at 07:19, above the horizon in 50 of 50 samples"],
    ["Best at dawn", "05:42: magnitude −1.39 against a limiting magnitude of 6.30, a margin of +7.70. 27° up in the west, the Sun 18° below the horizon"],
    ["Longitude gap", "−172.68°"],
    ["Elongation", "171.56°"],
  ]);
});

test("viewForVisibility: a time on another day than the chart's carries its date", async () => {
  const { planets } = await screen(NEW_YORK_EARLY);
  assert.equal(planets.venus.prediction.detail, "At dusk, 18:15 on 10 Jan: about 4,000 times brighter than needed");
  assert.equal(planets.mercury.prediction.detail, "Best chance at dawn, 06:40: about 3.2 times too faint");
  assert.deepEqual(planets.venus.details.slice(0, 2), [
    ["Evening", "From sunset at 16:49 on 10 Jan to the end of astronomical twilight at 18:26 on 10 Jan, above the horizon in 50 of 50 samples"],
    ["Best at dusk", "18:15 on 10 Jan: magnitude −4.53 against a limiting magnitude of 4.48, a margin of +9.01. 25° up in the southwest, the Sun 16° below the horizon"],
  ]);
});

test("viewForVisibility: a window that runs to or from the Sun's lowest point says so", async () => {
  const { view, planets } = await screen(LONDON);
  assert.equal(planets.venus.prediction.detail, "At dawn, 03:38 on 22 Jun: about 63 times brighter than needed");
  assert.deepEqual(planets.venus.details.slice(0, 3), [
    ["Evening", "From sunset at 21:22 to the Sun's lowest point at 01:02 on 22 Jun, below the horizon throughout"],
    ["Morning", "From the Sun's lowest point at 01:02 on 22 Jun to sunrise at 04:43 on 22 Jun, above the horizon in 61 of 112 samples"],
    ["Best at dawn", "03:38 on 22 Jun: magnitude −4.21 against a limiting magnitude of 0.28, a margin of +4.49. 8° up in the east, the Sun 8° below the horizon"],
  ]);
  assert.deepEqual(view.notes, ["Times are at UTC+01:00, the chart's offset.", LINKS_NOTE]);
});

test("viewForVisibility: with no sunset and no sunrise there's no prediction, and the row says why", async () => {
  const { view, planets } = await screen(TROMSO);
  assert.deepEqual(planets.venus.prediction, { kind: "indeterminate", label: "No prediction", detail: "The Sun doesn't set or rise that day" });
  assert.deepEqual(planets.venus.details.slice(0, 2), [
    ["Evening", "None: the Sun doesn't set that day"],
    ["Morning", "None: the Sun doesn't rise that day"],
  ]);
  // No best moment, so no link, and no planet has one, so no note about them.
  assert.equal(planets.venus.link, null);
  assert.deepEqual(view.notes, ["Times are at UTC+02:00, the chart's offset."]);
});

test("viewForVisibility: a planet with a best moment links to Stellarium Web at that moment, from the chart's place and elevation", async () => {
  const { planets } = await screen(NEW_YORK);
  assert.deepEqual(planets.venus.link, {
    text: "See it in Stellarium Web",
    label: "See Venus at 18:15 in Stellarium Web",
    url: "https://stellarium-web.org/skysource/Venus?date=2025-01-10T23%3A14%3A32Z&lat=40.7128&lng=-74.006&elev=0&fov=60",
  });
  // Mercury isn't detectable, but it has a best moment, at dawn.
  assert.equal(planets.mercury.link.label, "See Mercury at 06:38 in Stellarium Web");
  // Mars is detectable in both windows: the link is the one its row names, at dawn.
  assert.equal(
    planets.mars.link.url,
    "https://stellarium-web.org/skysource/Mars?date=2025-01-10T10%3A42%3A08Z&lat=40.7128&lng=-74.006&elev=0&fov=60",
  );
  const high = await screen(NEW_YORK, { elevation: 120, underTheBeams: 15 });
  assert.match(high.planets.venus.link.url, /&elev=120&fov=60$/);
});

test("viewForVisibility: a link's label carries the date of a moment on another day than the chart's", async () => {
  const { planets } = await screen(NEW_YORK_EARLY);
  assert.equal(planets.venus.link.label, "See Venus at 18:15 on 10 Jan in Stellarium Web");
});

test("viewForVisibility: a planet below the horizon in both windows, or one the engine fails on, says so", async () => {
  const chart = NEW_YORK;
  const below = visibilities(chart, fakeEngine(() => ({ kind: "below-horizon", raw: { ret: -2, dret: [-100], serr: "" } })), DEFAULTS);
  const belowRow = viewForVisibility(chart, below.results).planets.find(({ planet }) => planet === "venus");
  assert.deepEqual(belowRow.prediction, { kind: "below-horizon", label: "Below the horizon", detail: "Below the horizon at dusk and at dawn" });
  assert.equal(belowRow.link, null);

  const failing = () => ({ kind: "failed", reason: "engine-error", raw: { ret: -1, dret: [], serr: "error in swe_calc" } });
  const failed = visibilities(chart, fakeEngine(failing), DEFAULTS);
  const failedRow = viewForVisibility(chart, failed.results).planets.find(({ planet }) => planet === "venus");
  assert.deepEqual(failedRow.prediction, { kind: "unavailable", label: "Couldn't be worked out", detail: "Code: engine-error" });
  assert.deepEqual(failedRow.details.slice(0, 2), [
    ["Evening", "Couldn't be worked out: engine-error"],
    ["Morning", "Couldn't be worked out: engine-error"],
  ]);
  assert.equal(failedRow.link, null);
});

test("viewForVisibility: the notes say whose offset the times are at and what a Stellarium Web link sends, and the assumptions are listed as Swiss Ephemeris completed them", async () => {
  const { view } = await screen(NEW_YORK);
  assert.deepEqual(view.notes, ["Times are at UTC-05:00, the chart's offset.", LINKS_NOTE]);
  assert.deepEqual(view.assumptions, [
    ["Ephemeris", "Swiss Ephemeris 2.10.03, Moshier"],
    ["Atmosphere", "1013.25\u00a0hPa, 15\u00a0°C, 40\u00a0% humidity"],
    ["Observer", "Aged 36, Snellen ratio 1, both eyes"],
    ["Elevation", "0\u00a0m, as none was given"],
    ["Moon", "Its light is included"],
    ["Samples", "Every 2 minutes"],
    ["Limits", "Cazimi 17′, combust 8°30′, under the beams 15°"],
  ]);

  const chosen = await screen(NEW_YORK, { elevation: 120, underTheBeams: 17 });
  assert.deepEqual(chosen.view.assumptions.find(([label]) => label === "Elevation"), ["Elevation", "120\u00a0m"]);
  assert.deepEqual(chosen.view.assumptions.find(([label]) => label === "Limits"), ["Limits", "Cazimi 17′, combust 8°30′, under the beams 17°"]);
});

test("viewForRefusal: no chart, a link's refusal, a chart that can't be worked out, and Swiss Ephemeris failing to start each say why, with a code", () => {
  assert.deepEqual(viewForRefusal(null), {
    state: "empty",
    message: "This page works out which planets were visible for a chart. Open it from a chart in AstroChart Bridge.",
  });
  assert.deepEqual(viewForRefusal("malformed"), {
    state: "refused",
    message: "This link is incomplete or damaged. Copy the whole link again.",
    code: "malformed",
  });
  assert.deepEqual(viewForRefusal("date-out-of-range"), {
    state: "refused",
    message: "AstroChart Bridge works out which planets were visible only for dates before 3000.",
    code: "date-out-of-range",
  });
  assert.deepEqual(viewForRefusal("invalid-coordinates"), {
    state: "refused",
    message: "This chart's place isn't a latitude and longitude on the globe.",
    code: "invalid-coordinates",
  });
  assert.deepEqual(viewForRefusal("engine-failed"), {
    state: "refused",
    message: "Swiss Ephemeris couldn't start in this browser, so the planets can't be worked out.",
    code: "engine-failed",
  });
});

test("readElevation: an empty box is no elevation, and whole metres from -500 to 25000 are taken", () => {
  assert.deepEqual(readElevation(""), { kind: "elevation", metres: null });
  assert.deepEqual(readElevation("   "), { kind: "elevation", metres: null });
  assert.deepEqual(readElevation(" 120 "), { kind: "elevation", metres: 120 });
  assert.deepEqual(readElevation("-500"), { kind: "elevation", metres: -500 });
  assert.deepEqual(readElevation("25000"), { kind: "elevation", metres: 25_000 });
});

test("readElevation: anything else is refused, with what to type instead", () => {
  const message = "Enter whole metres, from -500 to 25000.";
  for (const typed of ["12.5", "abc", "1e3", "25,000", "+"]) {
    assert.deepEqual(readElevation(typed), { kind: "refused", reason: "not-whole-metres", message }, typed);
  }
  for (const typed of ["25001", "-501"]) {
    assert.deepEqual(readElevation(typed), { kind: "refused", reason: "out-of-range", message }, typed);
  }
});

// A stand-in for chrome.storage.local, as test/preference.test.js has it.
function storage(initial = {}) {
  const items = { ...initial };
  return {
    items,
    async get(key) {
      return Object.hasOwn(items, key) ? { [key]: items[key] } : {};
    },
    async set(entries) {
      Object.assign(items, entries);
    },
    async remove(key) {
      delete items[key];
    },
  };
}

test("helioscopeSettings: no elevation and 15° until the user chooses, then what they chose", async () => {
  const area = storage();
  assert.deepEqual(await helioscopeSettings(area), DEFAULTS);
  await setHelioscopeSettings(area, { elevation: 120, underTheBeams: 17 });
  assert.deepEqual(area.items, { "helioscope-settings": { elevation: 120, underTheBeams: 17 } });
  assert.deepEqual(await helioscopeSettings(area), { elevation: 120, underTheBeams: 17 });
});

test("helioscopeSettings: going back to the defaults forgets the choice, and a stored value that doesn't fit is the default", async () => {
  const area = storage({ "helioscope-settings": { elevation: 120, underTheBeams: 17 } });
  await setHelioscopeSettings(area, DEFAULTS);
  assert.deepEqual(area.items, {});
  const odd = storage({ "helioscope-settings": { elevation: "high", underTheBeams: 16 } });
  assert.deepEqual(await helioscopeSettings(odd), DEFAULTS);
  const far = storage({ "helioscope-settings": { elevation: 30_000, underTheBeams: 17 } });
  assert.deepEqual(await helioscopeSettings(far), { elevation: null, underTheBeams: 17 });
});

test("viewForVisibility: each result's heading says how it's judged, with the limits the page used", async () => {
  const { view } = await screen(NEW_YORK);
  assert.deepEqual(view.method, {
    moment: "The traditional condition, from the longitude gap alone: cazimi within 17′, combust 8°30′, under the beams 15°",
    prediction: "Whether it was bright enough to see in the twilights nearest the chart's moment",
  });
  const wider = await screen(NEW_YORK, { elevation: null, underTheBeams: 17 });
  assert.match(wider.view.method.moment, /under the beams 17°$/);
});

test("viewForVisibility: how many times brighter or fainter is the margin at 2.5 to a magnitude, to two significant figures, and never banded", async () => {
  // London on 21 June 2025: Jupiter deep in the Sun's glow, and Mars only just bright enough.
  const { planets } = await screen(LONDON);
  assert.match(planets.jupiter.prediction.detail, /: about 2,100,000 times too faint$/);
  assert.match(planets.mars.prediction.detail, /: about 1\.8 times brighter than needed$/);
  assert.equal(planets.mars.prediction.label, "Visible");
});

// Check that night's weather. ERA5 is Open-Meteo's answer for the New York
// chart's month, recorded as test/open-meteo.test.js says, so nothing here
// goes to the network. TODAY is the day it was recorded.
const ERA5 = JSON.parse(readFileSync(new URL("./open-meteo-era5-new-york-2025-01.json", import.meta.url), "utf8"));
const TODAY = "2026-11-10";
const NIGHT_HOURS = { evening: "2025-01-10T23:00", morning: "2025-01-10T12:00" };
const OFFER = {
  kind: "offer",
  button: "Check that night's weather",
  note: "Sends the chart's month and its place, rounded to about 25\u00a0km, to open-meteo.com, whose logs may keep them for up to 90 days.",
  message: null,
  code: null,
};

test("weatherRequestFor asks Open-Meteo for the hour nearest the middle of each twilight, for the chart's month", async () => {
  const { results } = await worked(NEW_YORK);
  const request = weatherRequestFor(NEW_YORK, results, TODAY);
  // Dusk runs from 21:48:32 to 23:25:36 UTC, and that morning's dawn from 10:42:08 to 12:19:10.
  assert.deepEqual(request.hours, NIGHT_HOURS);
  const sent = Object.fromEntries(new URL(request.url).searchParams);
  assert.deepEqual([sent.latitude, sent.longitude, sent.start_date, sent.end_date], ["40.75", "-74", "2025-01-01", "2025-01-31"]);
});

test("weatherOffer offers the check, unless the night is before 1940, after today, or has no twilight", async () => {
  const offered = async (chart) => weatherOffer(chart, (await worked(chart)).results, TODAY);
  assert.deepEqual(await offered(NEW_YORK), { kind: "offer" });
  assert.deepEqual(await offered({ ...NEW_YORK, local: "1935-01-10T17:35:00", utc: "1935-01-10T22:35:00Z" }), { kind: "refused", reason: "before-1940" });
  assert.deepEqual(await offered({ ...NEW_YORK, local: "2026-12-10T17:35:00", utc: "2026-12-10T22:35:00Z" }), { kind: "refused", reason: "future" });
  assert.deepEqual(await offered(TROMSO), { kind: "refused", reason: "no-twilight" });
});

test("nightWeather reads each twilight's hour, and refuses a night ERA5 hasn't reached yet", () => {
  assert.deepEqual(nightWeather(ERA5, NIGHT_HOURS, TODAY), {
    kind: "weather",
    year: "2026",
    evening: { hour: "2025-01-10T23:00", cloud: { total: 90, low: 0, mid: 86, high: 88 }, air: { pressure: 1007, temperature: 1.4, humidity: 56 } },
    morning: { hour: "2025-01-10T12:00", cloud: { total: 0, low: 0, mid: 0, high: 0 }, air: { pressure: 1010.8, temperature: -2.8, humidity: 65 } },
  });
  // A twilight with no window has no hour, and needs no weather.
  assert.equal(nightWeather(ERA5, { ...NIGHT_HOURS, evening: null }, TODAY).evening, null);
  // The archive answers the days ERA5 hasn't reached with null.
  const unreached = { ...ERA5, hourly: { ...ERA5.hourly, cloud_cover: ERA5.hourly.cloud_cover.map(() => null) } };
  assert.deepEqual(nightWeather(unreached, NIGHT_HOURS, TODAY), { kind: "refused", reason: "not-yet" });
  assert.deepEqual(nightWeather({ error: true, reason: "out of range" }, NIGHT_HOURS, TODAY), { kind: "failed", reason: "unexpected-answer" });
});

// The planets with that night's air, an engine for each twilight, as the page
// makes them once the weather is in.
async function withAir(chart, weather) {
  const evening = await createEngine({ atmosphere: weather.evening.air });
  const morning = await createEngine({ atmosphere: weather.morning.air });
  try {
    return {
      both: visibilitiesWithAir(chart, { evening, morning }, DEFAULTS),
      dusk: visibilities(chart, evening, DEFAULTS),
      dawn: visibilities(chart, morning, DEFAULTS),
    };
  } finally {
    evening.dispose();
    morning.dispose();
  }
}

test("visibilitiesWithAir works each twilight out under its own night's air, and judges the two together", async () => {
  const { both, dusk, dawn } = await withAir(NEW_YORK, nightWeather(ERA5, NIGHT_HOURS, TODAY));
  assert.equal(both.kind, "results");
  for (const [planet, result] of Object.entries(both.results)) {
    assert.deepEqual(result.windows.evening, dusk.results[planet].windows.evening, planet);
    assert.deepEqual(result.windows.morning, dawn.results[planet].windows.morning, planet);
    assert.deepEqual(result.classification, classify(result.windows.evening, result.windows.morning), planet);
  }
  // Against the default air's −0.94, +9.01, +7.70, +6.24 and +3.65.
  const margins = Object.fromEntries(
    Object.entries(both.results).map(([planet, { classification: c }]) => [planet, `${c.kind} at ${c.window}, ${c.margin.toFixed(2)}`]),
  );
  assert.deepEqual(margins, {
    mercury: "undetectable at morning, -1.23",
    venus: "detectable at evening, 8.98",
    mars: "detectable at morning, 7.65",
    jupiter: "detectable at evening, 6.23",
    saturn: "detectable at evening, 3.62",
  });
});

test("viewForVisibility: with that night's weather, the cloud at each twilight, the planets worked out again, the night's air under Assumptions, and the credit", async () => {
  const weather = nightWeather(ERA5, NIGHT_HOURS, TODAY);
  const { both } = await withAir(NEW_YORK, weather);
  const view = viewForVisibility(NEW_YORK, both.results, weather);
  assert.deepEqual(view.weather, {
    kind: "shown",
    title: "That night's weather, from ERA5",
    line: "Dusk: 90\u00a0% cloud at 18:00 · Dawn: no cloud at 07:00",
    note: "The planets below are worked out again with that night's air. ERA5's cloud is for a square about 25\u00a0km across, and a bright planet can show through thin high cloud or a gap.",
    credit: { data: "Weather data by Open-Meteo.com", licence: "CC BY 4.0", source: "generated using Copernicus Climate Change Service information 2026" },
  });
  // Venus's margin is +8.98 with that night's air, against +9.01 with the default.
  const venus = view.planets.find(({ planet }) => planet === "venus");
  assert.equal(venus.prediction.detail, "At dusk, 18:15: about 3,900 times brighter than needed");
  assert.deepEqual(view.assumptions.slice(1, 4), [
    ["Atmosphere that night", "Dusk: 1007\u00a0hPa, 1.4\u00a0°C, 56\u00a0% humidity · Dawn: 1010.8\u00a0hPa, −2.8\u00a0°C, 65\u00a0% humidity"],
    ["Cloud that night", "Dusk: low 0\u00a0%, mid 86\u00a0%, high 88\u00a0% · Dawn: low 0\u00a0%, mid 0\u00a0%, high 0\u00a0%"],
    ["Observer", "Aged 36, Snellen ratio 1, both eyes"],
  ]);
});

test("viewForVisibility: before a check, the page offers one and says what it sends, and after a refusal or failure it says why", async () => {
  const { results } = await worked(NEW_YORK);
  const weatherIn = (state) => viewForVisibility(NEW_YORK, results, state).weather;
  assert.deepEqual(viewForVisibility(NEW_YORK, results).weather, OFFER);
  assert.deepEqual(weatherIn({ kind: "offer" }), OFFER);
  assert.deepEqual(weatherIn({ kind: "asking" }), { kind: "asking", message: "Asking Open-Meteo…" });
  // A failure, or Firefox's consent refused, can be tried again.
  assert.deepEqual(weatherIn({ kind: "failed", reason: "network" }), { ...OFFER, message: "Couldn't get the weather.", code: "network" });
  assert.deepEqual(weatherIn({ kind: "refused", reason: "declined" }), { ...OFFER, message: "Firefox wasn't allowed to send it, so nothing was sent." });
  // Firefox refusing to ask at all, as it does when the manifest it loaded
  // doesn't declare the consent, says that nothing was sent either.
  assert.deepEqual(weatherIn({ kind: "failed", reason: "consent-failed" }), {
    ...OFFER,
    message: "Firefox couldn't ask for its consent, so nothing was sent.",
    code: "consent-failed",
  });
  // The rest can't be, so there's nothing to click.
  const unavailable = {
    "before-1940": "ERA5's weather starts in 1940, so there's none to check for this chart.",
    future: "That night hasn't happened yet, so there's no weather to check.",
    "no-twilight": "There's no twilight that night, so there's no weather to check.",
    "not-yet": "ERA5 doesn't have that night yet: it runs about 5 days behind.",
  };
  for (const [reason, message] of Object.entries(unavailable)) {
    assert.deepEqual(weatherIn({ kind: "refused", reason }), { kind: "unavailable", message }, reason);
  }
  // Until the weather is in, the assumptions are the default air's.
  assert.deepEqual(viewForVisibility(NEW_YORK, results, { kind: "asking" }).assumptions[1], ["Atmosphere", "1013.25\u00a0hPa, 15\u00a0°C, 40\u00a0% humidity"]);
});
