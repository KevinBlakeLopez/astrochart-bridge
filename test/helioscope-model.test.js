// The view model of Helioscope's page, helioscope.html: the chart from the
// page's link, the five planets worked out with the page's settings, and the
// screen drawn from them. Most cases run the real engine, so every string
// below is what the page shows for that chart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toFragment, toPortable } from "../extension/core/portable.js";
import { createEngine } from "../extension/helioscope-engine.js";
import { viewFor } from "../extension/popup-model.js";
import {
  chartFromLink,
  helioscopeSettings,
  readElevation,
  setHelioscopeSettings,
  viewForRefusal,
  viewForVisibility,
  visibilities,
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

test("viewForVisibility: each prediction gives its best window, its time at the chart's offset to the nearest minute, and its margin", async () => {
  const { planets } = await screen(NEW_YORK);
  assert.deepEqual(planets.mercury.prediction, { kind: "undetectable", label: "Not detectable", detail: "Best at dawn, 06:38: −0.94" });
  assert.deepEqual(planets.venus.prediction, { kind: "detectable", label: "Detectable", detail: "Best at dusk, 18:15: +9.01" });
  // Mars is near opposition, up all night, and detectable in both windows:
  // the other one's margin follows.
  assert.deepEqual(planets.mars.prediction, { kind: "detectable", label: "Detectable", detail: "Best at dawn, 05:42: +7.70 · dusk +4.16" });
  assert.deepEqual(planets.jupiter.prediction, { kind: "detectable", label: "Detectable", detail: "Best at dusk, 18:21: +6.24" });
  assert.deepEqual(planets.saturn.prediction, { kind: "detectable", label: "Detectable", detail: "Best at dusk, 18:15: +3.65" });
});

test("viewForVisibility: a planet's details give both windows, its best moment's sky, and its two angles from the Sun", async () => {
  const { planets } = await screen(NEW_YORK);
  assert.deepEqual(planets.venus.details, [
    ["Evening", "From sunset at 16:49 to the end of astronomical twilight at 18:26, above the horizon in 50 of 50 samples"],
    ["Best at dusk", "18:15: margin +9.01, Venus at −4.53 against a limit of 4.48, 25° up in the southwest, the Sun 16° down"],
    ["Morning", "From the start of astronomical twilight at 05:42 to sunrise at 07:19, below the horizon throughout"],
    ["Longitude gap", "+47.16°"],
    ["Elongation", "47.17°"],
  ]);
  assert.deepEqual(planets.mars.details, [
    ["Evening", "From sunset at 16:49 to the end of astronomical twilight at 18:26, above the horizon in 41 of 50 samples"],
    ["Best at dusk", "18:26: margin +4.16, Mars at −1.40 against a limit of 2.76, 14° up in the east, the Sun 18° down"],
    ["Morning", "From the start of astronomical twilight at 05:42 to sunrise at 07:19, above the horizon in 50 of 50 samples"],
    ["Best at dawn", "05:42: margin +7.70, Mars at −1.39 against a limit of 6.30, 27° up in the west, the Sun 18° down"],
    ["Longitude gap", "−172.68°"],
    ["Elongation", "171.56°"],
  ]);
});

test("viewForVisibility: a time on another day than the chart's carries its date", async () => {
  const { planets } = await screen(NEW_YORK_EARLY);
  assert.equal(planets.venus.prediction.detail, "Best at dusk, 18:15 on 10 Jan: +9.01");
  assert.equal(planets.mercury.prediction.detail, "Best at dawn, 06:40: −1.28");
  assert.deepEqual(planets.venus.details.slice(0, 2), [
    ["Evening", "From sunset at 16:49 on 10 Jan to the end of astronomical twilight at 18:26 on 10 Jan, above the horizon in 50 of 50 samples"],
    ["Best at dusk", "18:15 on 10 Jan: margin +9.01, Venus at −4.53 against a limit of 4.48, 25° up in the southwest, the Sun 16° down"],
  ]);
});

test("viewForVisibility: a window that runs to or from the Sun's lowest point says so", async () => {
  const { view, planets } = await screen(LONDON);
  assert.equal(planets.venus.prediction.detail, "Best at dawn, 03:38 on 22 Jun: +4.49");
  assert.deepEqual(planets.venus.details.slice(0, 3), [
    ["Evening", "From sunset at 21:22 to the Sun's lowest point at 01:02 on 22 Jun, below the horizon throughout"],
    ["Morning", "From the Sun's lowest point at 01:02 on 22 Jun to sunrise at 04:43 on 22 Jun, above the horizon in 61 of 112 samples"],
    ["Best at dawn", "03:38 on 22 Jun: margin +4.49, Venus at −4.21 against a limit of 0.28, 8° up in the east, the Sun 8° down"],
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
    ["Atmosphere", "1013.25 hPa, 15 °C, 40 % humidity"],
    ["Observer", "Aged 36, Snellen ratio 1, both eyes"],
    ["Elevation", "0 m, as none was given"],
    ["Moon", "Its light is included"],
    ["Samples", "Every 2 minutes"],
    ["Limits", "Cazimi 17′, combust 8°30′, under the beams 15°"],
  ]);

  const chosen = await screen(NEW_YORK, { elevation: 120, underTheBeams: 17 });
  assert.deepEqual(chosen.view.assumptions.find(([label]) => label === "Elevation"), ["Elevation", "120 m"]);
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
