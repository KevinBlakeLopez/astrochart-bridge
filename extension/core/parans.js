// Parans: every rising, setting, upper and lower transit of the chosen bodies
// within a chart's instant ±12 hours, at its place, and the gaps between the
// events of every two bodies. Nothing here loads the engine or uses a browser
// API; ../helioscope-engine.js is the engine, Swiss Ephemeris's WebAssembly.
//
// This follows astro-research's parans-v1 conventions, on the Moshier
// ephemeris and with the UTC as UT:
//
// - the body's actual position, ecliptic latitude included, as
//   swe_rise_trans computes it, not its zodiacal degree;
// - rising and setting of the chosen point of the disc, with the chosen
//   refraction, or on the geometric horizon without it; transits at hour
//   angle 0 and 180;
// - each event is the one a second search finds, started 3 minutes before
//   the first search's: the first can be a few seconds off;
// - a rising or setting Swiss Ephemeris says doesn't happen is listed once,
//   and the search carries on after the body's next upper transit;
// - events in [start, end), and gaps in time and in ARMC, with no orb: how
//   close counts as a paran isn't decided here.
//
// test/parans.test.js compares the events and gaps with astro-research's.
// Where one engine call fails the whole result does: a list of events with a
// hole in it would look complete.
import { julianDay, utcFromJulianDay } from "./stellarium-desktop.js";

export const BODIES = Object.freeze([
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
]);
// The order events of one body are searched in, and so the order of events
// at the same instant.
const EVENTS = Object.freeze(["rise", "set", "upper-transit", "lower-transit"]);

const CONVENTIONS = "parans-v1, on the Moshier ephemeris, with the UTC as UT";
const WINDOW_HOURS = 12;
const REFINE_LEAD_MINUTES = 3;
const REFINE_LEAD_DAYS = REFINE_LEAD_MINUTES / 1440;
// After an event, search again from a minute later: the same event of the
// same body comes back no sooner than about 23 hours later.
const NEXT_SEARCH_DAYS = 1 / 1440;

// As Helioscope's: from 1582-10-15, the first Gregorian day, until 3000,
// inside the Moshier ephemeris. Here the whole window has to fit.
const FIRST_JD = julianDay("1582-10-15T00:00:00Z");
const END_JD = julianDay("3000-01-01T00:00:00Z");
// Metres: the elevations the engine takes.
export const ELEVATION_LIMITS = Object.freeze({ lowest: -500, highest: 25_000 });

const refused = (reason) => ({ kind: "refused", reason });
const instant = (jd) => ({ jd, utc: utcFromJulianDay(jd) });

/**
 * Every rising, setting, upper and lower transit of bodies within the chart's
 * instant ±12 hours, at its place, in time order. The engine isn't disposed.
 *
 * Only natal charts with a decided UTC are taken, and not at the poles, where
 * the meridian isn't defined. Charts carry no elevation, so it's 0 m unless
 * options gives one.
 *
 * @param {object} chart  a normalized chart, as analyzePage or analyzeEntry gives it
 * @param {import("../helioscope-engine.js").Engine} engine  from createEngine
 * @param {{ bodies: (typeof BODIES)[number][], horizon: import("../helioscope-engine.js").Horizon, elevation?: number }} options
 *   the bodies, each once; the horizon, which the engine checks; the observer's elevation in metres
 * @returns {{ kind: "refused", reason: "not-natal" | "needs-offset" | "needs-choice" | "invalid-coordinates"
 *   | "at-pole" | "date-out-of-range" | "invalid-elevation" }
 *   | { kind: "failed", point: string, event: string, failure: object }
 *   | AngularEvents}
 */
export function angularEvents(chart, engine, { bodies, horizon, elevation } = {}) {
  checkBodies(bodies);
  if (chart?.kind !== "natal") return refused("not-natal");
  if (typeof chart.utc !== "string") return refused(chart.utcSource === "needs-choice" ? "needs-choice" : "needs-offset");
  const { lat, lng } = chart;
  if (!(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) {
    return refused("invalid-coordinates");
  }
  if (Math.abs(lat) === 90) return refused("at-pole");
  const jd = julianDay(chart.utc);
  const start = jd - WINDOW_HOURS / 24;
  const end = jd + WINDOW_HOURS / 24;
  if (start < FIRST_JD || end >= END_JD) return refused("date-out-of-range");
  const metres = elevation === undefined ? 0 : elevation;
  if (!Number.isFinite(metres) || metres < ELEVATION_LIMITS.lowest || metres > ELEVATION_LIMITS.highest) {
    return refused("invalid-elevation");
  }

  const place = { lat, lng, elevation: metres };
  const events = [];
  const noRiseOrSet = [];
  for (const point of bodies) {
    for (const event of EVENTS) {
      const failed = collect(engine, place, start, end, horizon, point, event, events, noRiseOrSet);
      if (failed) return { kind: "failed", point, event, failure: failed };
    }
  }
  // Stable, so events at the same instant keep the order they were searched in.
  events.sort((a, b) => a.jd - b.jd);
  const { swissEphemeris, ephemeris } = engine.assumptions;
  return {
    kind: "events",
    window: { start: instant(start), end: instant(end) },
    place,
    horizon,
    bodies: [...bodies],
    events,
    noRiseOrSet,
    conventions: CONVENTIONS,
    assumptions: {
      swissEphemeris,
      ephemeris,
      timeScale: "utc-as-ut",
      windowHours: WINDOW_HOURS,
      refineLeadMinutes: REFINE_LEAD_MINUTES,
      elevation: { metres, source: elevation === undefined ? "default" : "given" },
    },
  };
}

/**
 * Every pair of events of two different bodies, the earlier first: the time
 * between them, in seconds of UT, and the ARMC between them, the second's less
 * the first's in (-180, 180]. There's no orb.
 *
 * @param {AngularEvents} result  from angularEvents
 * @returns {{ first: AngularEvent, second: AngularEvent, seconds: number, armc: number }[]}
 */
export function paranGaps(result) {
  if (result?.kind !== "events") throw new Error(`paranGaps needs angularEvents' events; got ${result?.kind}`);
  const { events } = result;
  const gaps = [];
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const first = events[i];
      const second = events[j];
      if (first.point === second.point) continue;
      gaps.push({ first, second, seconds: (second.jd - first.jd) * 86400, armc: wrap(second.armc - first.armc) });
    }
  }
  return gaps;
}

// One body's events of one kind in [start, end), added to events, as
// astro-research's _collect finds them. Returns the engine's failure, if any.
function collect(engine, place, start, end, horizon, point, event, events, noRiseOrSet) {
  let from = start;
  while (from < end) {
    const first = engine.angularEvent(from, place, point, event, horizon);
    if (first.kind === "failed") return first;
    if (first.kind === "none") {
      if (!noRiseOrSet.some((m) => m.point === point && m.event === event)) noRiseOrSet.push({ point, event });
      // No rising or setting this cycle; carry on after the next upper transit.
      const transit = engine.angularEvent(from, place, point, "upper-transit", horizon);
      if (transit.kind === "failed") return transit;
      if (transit.kind === "none" || transit.jd >= end) return null;
      from = advance(from, transit.jd);
      if (from === null) return { kind: "failed", reason: "search-stalled" };
      continue;
    }
    // The refining search starts there, so its event is past the end too.
    if (first.jd - REFINE_LEAD_DAYS >= end) return null;
    const refined = engine.angularEvent(first.jd - REFINE_LEAD_DAYS, place, point, event, horizon);
    if (refined.kind === "failed") return refined;
    const jd = refined.kind === "none" ? first.jd : refined.jd;
    if (jd >= end) return null;
    if (jd >= start) {
      const armc = engine.armc(jd, place);
      if (armc.kind === "failed") return armc;
      events.push({ point, event, ...instant(jd), armc: armc.armc });
    }
    from = advance(from, jd);
    if (from === null) return { kind: "failed", reason: "search-stalled" };
  }
  return null;
}

// Where to search from after an event at jd, or null when that wouldn't be
// later than the last search: a loop astro-research's searches can't fall
// into, guarded here so a page can't hang on one.
function advance(from, jd) {
  const next = jd + NEXT_SEARCH_DAYS;
  return next > from ? next : null;
}

function checkBodies(bodies) {
  if (!Array.isArray(bodies) || bodies.length === 0 || new Set(bodies).size !== bodies.length ||
      !bodies.every((body) => BODIES.includes(body))) {
    throw new Error(`angularEvents takes bodies, each once, from ${BODIES.join(", ")}; got ${JSON.stringify(bodies)}`);
  }
}

// Into (-180, 180]. Both ARMCs lie within [0, 360), so one turn is enough.
function wrap(degrees) {
  if (degrees > 180) return degrees - 360;
  if (degrees <= -180) return degrees + 360;
  return degrees;
}

/**
 * @typedef {{ point: string, event: "rise" | "set" | "upper-transit" | "lower-transit", jd: number, utc: string,
 *   armc: number }} AngularEvent
 *   jd is the UT Julian Day, utc to the nearest second, armc in degrees at the event
 * @typedef {{ kind: "events", window: { start: { jd: number, utc: string }, end: { jd: number, utc: string } },
 *   place: { lat: number, lng: number, elevation: number }, horizon: object, bodies: string[],
 *   events: AngularEvent[], noRiseOrSet: { point: string, event: "rise" | "set" }[], conventions: string,
 *   assumptions: object }} AngularEvents
 */
