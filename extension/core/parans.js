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

// The Sun, the Moon and the planets out to Pluto, from Moshier's theory.
export const PLANETS = Object.freeze([
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto",
]);
// Ceres and the dwarf planets and candidates beyond Neptune, from
// Astrodienst's asteroid files, which the engine has to be given: without
// them, their searches fail.
export const DWARF_PLANETS = Object.freeze(["ceres", "eris", "makemake", "haumea", "varuna", "ixion", "orcus", "sedna"]);
export const BODIES = Object.freeze([...PLANETS, ...DWARF_PLANETS]);

// The fixed stars, from Swiss Ephemeris's star catalogue, sefstars.txt, which
// the engine has to be given: every star in it brighter than visual magnitude
// 2.0, and the 64 stars Bernadette Brady uses, four of them star clusters,
// brightest first. Each is its catalogue designation, as Swiss Ephemeris
// takes it, with the catalogue's first name for it, its other names, the
// catalogue's and Brady's, and its magnitude. tools/fixed-stars.mjs works the
// list out from the catalogue, and test/parans-stars.test.js checks it's this
// one.
export const FIXED_STARS = Object.freeze([
  { designation: ",alCMa", name: "Sirius", otherNames: ["Lubdhaka"], magnitude: -1.46 },
  { designation: ",alCar", name: "Canopus", otherNames: ["Agastya"], magnitude: -0.74 },
  { designation: ",alCen", name: "Rigil Kentaurus", otherNames: ["Rigel Kentaurus", "Toliman", "Bungula"], magnitude: -0.1 },
  { designation: ",alBoo", name: "Arcturus", otherNames: ["Svati"], magnitude: -0.05 },
  { designation: ",alLyr", name: "Vega", otherNames: ["Abhijit"], magnitude: 0.03 },
  { designation: ",alAur", name: "Capella", otherNames: ["Brahmahridaya"], magnitude: 0.08 },
  { designation: ",beOri", name: "Rigel", otherNames: [], magnitude: 0.13 },
  { designation: ",alCMi", name: "Procyon", otherNames: [], magnitude: 0.37 },
  { designation: ",alOri", name: "Betelgeuse", otherNames: ["Beteigeuse", "Ardra"], magnitude: 0.42 },
  { designation: ",alEri", name: "Achernar", otherNames: [], magnitude: 0.46 },
  { designation: ",beCen", name: "Hadar", otherNames: ["Agena"], magnitude: 0.6 },
  { designation: ",alAql", name: "Altair", otherNames: ["Shravana"], magnitude: 0.76 },
  { designation: ",alCru", name: "Acrux", otherNames: [], magnitude: 0.81 },
  { designation: ",alTau", name: "Aldebaran", otherNames: ["Rohini"], magnitude: 0.86 },
  { designation: ",alSco", name: "Antares", otherNames: ["Jyeshtha"], magnitude: 0.91 },
  { designation: ",alVir", name: "Spica", otherNames: ["Citra"], magnitude: 0.97 },
  { designation: ",beGem", name: "Pollux", otherNames: ["Punarvasu"], magnitude: 1.14 },
  { designation: ",alPsA", name: "Fomalhaut", otherNames: [], magnitude: 1.16 },
  { designation: ",alCyg", name: "Deneb", otherNames: ["Deneb Adige"], magnitude: 1.25 },
  { designation: ",beCru", name: "Mimosa", otherNames: [], magnitude: 1.25 },
  { designation: ",alLeo", name: "Regulus", otherNames: ["Magha"], magnitude: 1.4 },
  { designation: ",epCMa", name: "Adara", otherNames: ["Adhara"], magnitude: 1.5 },
  { designation: ",alGem", name: "Castor", otherNames: [], magnitude: 1.58 },
  { designation: ",laSco", name: "Shaula", otherNames: ["Mula"], magnitude: 1.62 },
  { designation: ",gaCru", name: "Gacrux", otherNames: [], magnitude: 1.64 },
  { designation: ",gaOri", name: "Bellatrix", otherNames: ["Durga"], magnitude: 1.64 },
  { designation: ",beTau", name: "Elnath", otherNames: ["El Nath", "Alnath"], magnitude: 1.65 },
  { designation: ",beCar", name: "Miaplacidus", otherNames: [], magnitude: 1.69 },
  { designation: ",epOri", name: "Alnilam", otherNames: ["Ganesha"], magnitude: 1.69 },
  { designation: ",alGru", name: "Alnair", otherNames: [], magnitude: 1.71 },
  { designation: ",epUMa", name: "Alioth", otherNames: ["Angiras"], magnitude: 1.77 },
  { designation: ",zeOri", name: "Alnitak", otherNames: ["Iyappa"], magnitude: 1.79 },
  { designation: ",alPer", name: "Mirfak", otherNames: ["Mirphak"], magnitude: 1.79 },
  { designation: ",alUMa", name: "Dubhe", otherNames: ["Kratu"], magnitude: 1.79 },
  { designation: ",ga-2Vel", name: "Suhail al Muhlif", otherNames: ["Regor"], magnitude: 1.83 },
  { designation: ",deCMa", name: "Wezen", otherNames: [], magnitude: 1.84 },
  { designation: ",epSgr", name: "Kaus Australis", otherNames: [], magnitude: 1.85 },
  { designation: ",etUMa", name: "Alkaid", otherNames: ["Benetnash", "Marichi"], magnitude: 1.86 },
  { designation: ",thSco", name: "Sargas", otherNames: [], magnitude: 1.862 },
  { designation: ",beAur", name: "Menkalinan", otherNames: [], magnitude: 1.9 },
  { designation: ",alPav", name: "Peacock", otherNames: [], magnitude: 1.918 },
  { designation: ",gaGem", name: "Alhena", otherNames: ["Almeisan"], magnitude: 1.92 },
  { designation: ",alTrA", name: "Atria", otherNames: [], magnitude: 1.92 },
  { designation: ",deVel", name: "Alsephina", otherNames: ["Koo She"], magnitude: 1.95 },
  { designation: ",epCar", name: "Avior", otherNames: [], magnitude: 1.953 },
  { designation: ",beCMa", name: "Mirzam", otherNames: ["Murzim", "Murzims"], magnitude: 1.97 },
  { designation: ",alHya", name: "Alphard", otherNames: ["Cor Hydrae"], magnitude: 1.97 },
  { designation: ",ga-1Leo", name: "Algieba", otherNames: [], magnitude: 1.98 },
  { designation: ",alAri", name: "Hamal", otherNames: [], magnitude: 2.01 },
  { designation: ",alUMi", name: "Polaris", otherNames: [], magnitude: 2.02 },
  { designation: ",beAnd", name: "Mirach", otherNames: [], magnitude: 2.05 },
  { designation: ",alAnd", name: "Alpheratz", otherNames: ["Sirrah"], magnitude: 2.06 },
  { designation: ",alOph", name: "Rasalhague", otherNames: [], magnitude: 2.07 },
  { designation: ",bePer", name: "Algol", otherNames: [], magnitude: 2.12 },
  { designation: ",beLeo", name: "Denebola", otherNames: ["Uttaraphalguni"], magnitude: 2.13 },
  { designation: ",alCas", name: "Schedar", otherNames: ["Shedir", "Schedir"], magnitude: 2.23 },
  { designation: ",alCrB", name: "Alphecca", otherNames: ["Alphekka", "Gemma"], magnitude: 2.24 },
  { designation: ",alPhe", name: "Ankaa", otherNames: [], magnitude: 2.37 },
  { designation: ",bePeg", name: "Scheat", otherNames: [], magnitude: 2.42 },
  { designation: ",alCep", name: "Alderamin", otherNames: [], magnitude: 2.46 },
  { designation: ",alPeg", name: "Markab", otherNames: ["Purvabhadra"], magnitude: 2.48 },
  { designation: ",alCet", name: "Menkar", otherNames: [], magnitude: 2.53 },
  { designation: ",deLeo", name: "Zosma", otherNames: ["Dhur", "Purvaphalguni"], magnitude: 2.53 },
  { designation: ",beLib", name: "Zubeneshamali", otherNames: ["Zuben Eschamali"], magnitude: 2.62 },
  { designation: ",alCol", name: "Phact", otherNames: [], magnitude: 2.65 },
  { designation: ",al-2Lib", name: "Zubenelgenubi", otherNames: ["Zuben Elgenubi"], magnitude: 2.75 },
  { designation: ",epVir", name: "Vindemiatrix", otherNames: [], magnitude: 2.79 },
  { designation: ",deCap", name: "Deneb Algedi", otherNames: [], magnitude: 2.83 },
  { designation: ",etTau", name: "Alcyone", otherNames: ["Krttika"], magnitude: 2.87 },
  { designation: ",beAqr", name: "Sadalsuud", otherNames: [], magnitude: 2.89 },
  { designation: ",alAqr", name: "Sadalmelek", otherNames: ["Sadalmelik"], magnitude: 2.94 },
  { designation: ",alHer", name: "Ras Algethi", otherNames: ["Rasalgethi"], magnitude: 3.06 },
  { designation: ",M7", name: "Acumen", otherNames: [], magnitude: 3.3 },
  { designation: ",alDra", name: "Thuban", otherNames: ["Dhruva"], magnitude: 3.68 },
  { designation: ",NGC869", name: "Capulus", otherNames: [], magnitude: 3.7 },
  { designation: ",alDel", name: "Sualocin", otherNames: [], magnitude: 3.8 },
  { designation: ",alPsc", name: "Alrischa", otherNames: ["Alrescha", "Al Rescha"], magnitude: 3.82 },
  { designation: ",alSgr", name: "Rukbat", otherNames: [], magnitude: 3.943 },
  { designation: ",alCrt", name: "Alkes", otherNames: [], magnitude: 4.07 },
  { designation: ",M6", name: "Aculeus", otherNames: [], magnitude: 4.2 },
  { designation: ",alCnc", name: "Acubens", otherNames: ["Ashlesha (Colebrook)"], magnitude: 4.249 },
  { designation: ",alCom", name: "Diadem", otherNames: [], magnitude: 4.32 },
  { designation: ",M22", name: "Facies", otherNames: [], magnitude: 6.17 },
].map((star) => Object.freeze({ ...star, otherNames: Object.freeze(star.otherNames) })));
const STAR_DESIGNATIONS = Object.freeze(FIXED_STARS.map(({ designation }) => designation));

/** Whether a point is one of FIXED_STARS, by its designation, rather than a body. */
export const isStar = (point) => STAR_DESIGNATIONS.includes(point);

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
// inside the Moshier ephemeris. For parans the whole window has to fit.
export const FIRST_JD = julianDay("1582-10-15T00:00:00Z");
export const END_JD = julianDay("3000-01-01T00:00:00Z");
// Metres: the elevations the engine takes.
export const ELEVATION_LIMITS = Object.freeze({ lowest: -500, highest: 25_000 });

const refused = (reason) => ({ kind: "refused", reason });
const instant = (jd) => ({ jd, utc: utcFromJulianDay(jd) });

/**
 * A natal chart's moment and place, as parans and declinations take them:
 * only natal charts with a decided UTC, and not at the poles, where the
 * meridian, and so the angles, aren't defined. Whether the date is in range
 * is each one's own check.
 *
 * @param {object} chart  a normalized chart, as analyzePage or analyzeEntry gives it
 * @returns {{ kind: "refused", reason: "not-natal" | "needs-offset" | "needs-choice" | "invalid-coordinates" | "at-pole" }
 *   | { kind: "moment", jd: number, lat: number, lng: number }}
 */
export function natalMoment(chart) {
  if (chart?.kind !== "natal") return refused("not-natal");
  if (typeof chart.utc !== "string") return refused(chart.utcSource === "needs-choice" ? "needs-choice" : "needs-offset");
  const { lat, lng } = chart;
  if (!(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) {
    return refused("invalid-coordinates");
  }
  if (Math.abs(lat) === 90) return refused("at-pole");
  return { kind: "moment", jd: julianDay(chart.utc), lat, lng };
}

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
 * @param {{ bodies: (typeof BODIES)[number][], stars?: string[], horizon: import("../helioscope-engine.js").Horizon,
 *   elevation?: number }} options
 *   the bodies, each once; the fixed stars, by their designations in
 *   FIXED_STARS, each once, none unless given; the horizon, which the engine
 *   checks; the observer's elevation in metres
 * @returns {{ kind: "refused", reason: "not-natal" | "needs-offset" | "needs-choice" | "invalid-coordinates"
 *   | "at-pole" | "date-out-of-range" | "invalid-elevation" }
 *   | { kind: "failed", point: string, event: string, failure: object }
 *   | AngularEvents}
 */
export function angularEvents(chart, engine, { bodies, stars = [], horizon, elevation } = {}) {
  checkBodies(bodies);
  checkStars(stars);
  const moment = natalMoment(chart);
  if (moment.kind === "refused") return moment;
  const { jd, lat, lng } = moment;
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
  for (const point of [...bodies, ...stars]) {
    for (const event of EVENTS) {
      const failed = collect(engine, place, start, end, horizon, point, event, events, noRiseOrSet);
      if (failed) return { kind: "failed", point, event, failure: failed };
    }
  }
  // Stable, so events at the same instant keep the order they were searched in.
  events.sort((a, b) => a.jd - b.jd);
  const { swissEphemeris, ephemeris, ephemerisFiles = [] } = engine.assumptions;
  return {
    kind: "events",
    window: { start: instant(start), end: instant(end) },
    place,
    horizon,
    bodies: [...bodies],
    stars: [...stars],
    events,
    noRiseOrSet,
    conventions: CONVENTIONS,
    assumptions: {
      swissEphemeris,
      ephemeris,
      // The files the engine read the dwarf planets and the stars from, if any.
      ephemerisFiles: [...ephemerisFiles],
      timeScale: "utc-as-ut",
      windowHours: WINDOW_HOURS,
      refineLeadMinutes: REFINE_LEAD_MINUTES,
      elevation: { metres, source: elevation === undefined ? "default" : "given" },
    },
  };
}

/**
 * Every pair of events of two different points, the earlier first, but never
 * of two stars: the time
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
      // Two stars keep the same pattern every day at a latitude, so their
      // pairs say nothing about the chart: a star pairs with a body only.
      if (first.point === second.point || (isStar(first.point) && isStar(second.point))) continue;
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

function checkStars(stars) {
  if (!Array.isArray(stars) || new Set(stars).size !== stars.length || !stars.every(isStar)) {
    throw new Error(`angularEvents takes stars, each once, by their designations in FIXED_STARS; got ${JSON.stringify(stars)}`);
  }
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
