// Helioscope: whether a planet could be seen with the naked eye in the
// twilight around a chart's instant, from its place. Everything here is
// decided from what an engine reports. ../helioscope-engine.js is the engine,
// Swiss Ephemeris's WebAssembly; nothing here loads it or uses a browser API.
//
// docs/HELIOSCOPE_V1_FEASIBILITY.md §6 sets out the design. Four results are
// kept apart. The traditional solar condition, the true elongation and the
// apparition are taken at the chart's instant. The predicted visibility comes
// from the observation windows around it, never from the instant itself: a
// planet below the horizon at birth says nothing about glare.
import { julianDay, utcFromJulianDay } from "./stellarium-desktop.js";

export const PLANETS = Object.freeze(["mercury", "venus", "mars", "jupiter", "saturn"]);

// Degrees: 17′, 8°30′ and 15°, the values most often cited. The traditions
// differ for under the beams, so a caller can choose 17°, the other value
// most often cited, as the owner decided on 6 November 2026. Each result
// records the limits it used.
const CONDITION_LIMITS = Object.freeze({ cazimi: 17 / 60, combust: 8.5, underTheBeams: 15 });
export const UNDER_THE_BEAMS_LIMITS = Object.freeze([15, 17]);

// The windows of §6, reported by this name. The evening one runs from the
// sunset nearest the chart's instant to the end of astronomical twilight, and
// the morning one from the start of astronomical twilight to the sunrise
// nearest it. On a night the Sun never reaches -18°, as in summer from about
// 48.6° north, they run to and from its lower transit, its lowest point, as
// the owner decided on 6 November 2026. With no sunset or no sunrise at all,
// there's no window.
const WINDOW_RULE = "astronomical-twilight-or-lower-transit";
const STEP_MINUTES = 2;
// A twilight more than half a day from its sunset or sunrise belongs to
// another night.
const SAME_NIGHT = 0.5;

// From 1582-10-15, the first Gregorian day: earlier charts are dated in the
// Julian calendar, which julianDay would read as Gregorian. Until 3000,
// inside the Moshier ephemeris, which ends in 3003.
const FIRST_JD = julianDay("1582-10-15T00:00:00Z");
const END_JD = julianDay("3000-01-01T00:00:00Z");

// Metres: the elevations the engine takes, swe_heliacal_ut's limits.
const LOWEST = -500;
const HIGHEST = 25_000;

const refused = (reason) => ({ kind: "refused", reason });

/**
 * Whether planet could be seen with the naked eye in the twilight around the
 * chart's instant, from its place, with the traditional solar condition,
 * elongation and apparition at that instant. The prediction assumes the
 * engine's atmosphere and observer; the engine isn't disposed.
 *
 * Only natal charts with a decided UTC are taken. Charts carry no elevation,
 * so it's 0 m unless options gives one. Under the beams means within 15° of
 * the Sun unless options chooses 17°.
 *
 * @param {object} chart  a normalized chart, as analyzePage or analyzeEntry gives it
 * @param {(typeof PLANETS)[number]} planet
 * @param {import("../helioscope-engine.js").Engine} engine  from createEngine
 * @param {{ elevation?: number, underTheBeams?: (typeof UNDER_THE_BEAMS_LIMITS)[number] }} [options]
 *   the observer's elevation in metres, and the limit for under the beams in degrees
 * @returns {{ kind: "refused", reason: "not-natal" | "needs-offset" | "needs-choice" | "invalid-coordinates"
 *   | "date-out-of-range" | "invalid-elevation" } | Visibility}
 */
export function visibility(chart, planet, engine, { elevation, underTheBeams = CONDITION_LIMITS.underTheBeams } = {}) {
  if (!PLANETS.includes(planet)) throw new Error(`visibility needs a naked-eye planet: ${PLANETS.join(", ")}; got ${planet}`);
  if (!UNDER_THE_BEAMS_LIMITS.includes(underTheBeams)) {
    throw new Error(`visibility takes under the beams as ${UNDER_THE_BEAMS_LIMITS.join("° or ")}°; got ${underTheBeams}`);
  }
  const limits = Object.freeze({ ...CONDITION_LIMITS, underTheBeams });
  if (chart?.kind !== "natal") return refused("not-natal");
  if (typeof chart.utc !== "string") return refused(chart.utcSource === "needs-choice" ? "needs-choice" : "needs-offset");
  if (!onGlobe(chart.lat, chart.lng)) return refused("invalid-coordinates");
  const jd = julianDay(chart.utc);
  if (jd < FIRST_JD || jd >= END_JD) return refused("date-out-of-range");
  const metres = elevation === undefined ? 0 : elevation;
  if (!Number.isFinite(metres) || metres < LOWEST || metres > HIGHEST) return refused("invalid-elevation");

  const place = { lat: chart.lat, lng: chart.lng, elevation: metres };
  const evening = sampled(eveningWindow(engine, jd, place), engine, place, planet);
  const morning = sampled(morningWindow(engine, jd, place), engine, place, planet);
  // Swiss Ephemeris fills the atmosphere and observer in the same way for
  // every call at one place, so any sample above the horizon shows them.
  const completed = evening.completed ?? morning.completed;
  const { atmosphere, observer, ...engineAssumptions } = engine.assumptions;
  return {
    kind: "visibility",
    planet,
    at: { jd, utc: chart.utc },
    place,
    solar: solar(engine.solarGeometry(jd, planet), underTheBeams),
    windows: { evening: evening.window, morning: morning.window },
    classification: classify(evening.window, morning.window),
    assumptions: {
      ...engineAssumptions,
      atmosphere: { requested: atmosphere, completed: completed?.atmosphere ?? null },
      observer: { requested: observer, completed: completed?.observer ?? null },
      elevation: { metres, source: elevation === undefined ? "default" : "given" },
      windowRule: WINDOW_RULE,
      stepMinutes: STEP_MINUTES,
      conditionLimits: limits,
    },
  };
}

/**
 * The prediction from the two windows, in §6's terms. A failure in either
 * makes it unavailable. A margin above 0 in either window makes the planet
 * detectable, but undetectable, or below the horizon, needs both windows:
 * without one, the prediction is indeterminate.
 *
 * @param {Window} evening
 * @param {Window} morning
 * @returns {{ kind: "detectable" | "undetectable", window: "evening" | "morning", margin: number }
 *   | { kind: "below-horizon" } | { kind: "indeterminate", reason: "no-window" }
 *   | { kind: "unavailable", reason: string }}
 */
export function classify(evening, morning) {
  const windows = [["evening", evening], ["morning", morning]];
  const failed = windows.find(([, window]) => window.kind === "failed");
  if (failed) return { kind: "unavailable", reason: failed[1].reason };
  // The window with the larger margin, or the evening one when they're equal.
  let best = null;
  for (const [name, window] of windows) {
    if (window.kind === "evaluated" && (best === null || window.best.margin > best.margin)) {
      best = { window: name, margin: window.best.margin };
    }
  }
  if (best !== null && best.margin > 0) return { kind: "detectable", ...best };
  if (windows.some(([, window]) => window.kind === "no-window")) return { kind: "indeterminate", reason: "no-window" };
  if (best !== null) return { kind: "undetectable", ...best };
  return { kind: "below-horizon" };
}

/**
 * The instants a window is sampled at: every STEP_MINUTES from its start
 * while still inside it, then its end, so that no sample falls outside it.
 *
 * @param {number} start  Julian Day (UT)
 * @param {number} end
 * @returns {number[]}
 */
export function sampleInstants(start, end) {
  const instants = [];
  for (let k = 0; start + (k * STEP_MINUTES) / 1440 <= end; k += 1) instants.push(start + (k * STEP_MINUTES) / 1440);
  if (instants.at(-1) !== end) instants.push(end);
  return instants;
}

/**
 * The planet's geocentric apparent ecliptic longitude minus the Sun's, in
 * degrees above -180 and up to 180: positive east of the Sun.
 *
 * @param {number} planetLongitude
 * @param {number} sunLongitude
 * @returns {number}
 */
export function longitudeGap(planetLongitude, sunLongitude) {
  const gap = (((planetLongitude - sunLongitude) % 360) + 360) % 360;
  return gap > 180 ? gap - 360 : gap;
}

/**
 * The traditional solar condition for a longitude gap, on either side of the
 * Sun, by CONDITION_LIMITS, with under the beams to the limit given.
 *
 * @param {number} gap  degrees, as longitudeGap gives it
 * @param {(typeof UNDER_THE_BEAMS_LIMITS)[number]} [underTheBeams]  degrees
 * @returns {"cazimi" | "combust" | "under-the-beams" | "clear"}
 */
export function traditionalCondition(gap, underTheBeams = CONDITION_LIMITS.underTheBeams) {
  const distance = Math.abs(gap);
  if (distance <= CONDITION_LIMITS.cazimi) return "cazimi";
  if (distance <= CONDITION_LIMITS.combust) return "combust";
  if (distance <= underTheBeams) return "under-the-beams";
  return "clear";
}

/**
 * The sky of the planet's apparition, from its side of the Sun: east is the
 * evening sky, west the morning. null at conjunction and opposition, which
 * are on neither side. Near them, and at an inferior conjunction far from the
 * ecliptic, a planet can be in both skies; the windows show which.
 *
 * @param {number} gap  degrees, as longitudeGap gives it
 * @returns {"evening" | "morning" | null}
 */
export function apparition(gap) {
  if (gap > 0 && gap < 180) return "evening";
  if (gap < 0 && gap > -180) return "morning";
  return null;
}

// The sunset or sunrise nearest jd. swe_rise_trans finds the next one after
// the time it's given, so the nearest is chosen from searches 1.5 and 0.5 days
// before and 0.5 days after.
function nearest(engine, jd, place, event) {
  let best = null;
  for (const from of [jd - 1.5, jd - 0.5, jd + 0.5]) {
    const found = engine.sunEvent(from, place, event);
    if (found.kind === "failed") return found;
    if (found.kind === "found" && (best === null || Math.abs(found.jd - jd) < Math.abs(best.jd - jd))) best = found;
  }
  return best ?? { kind: "none" };
}

// The end of astronomical twilight after the sunset or, on a night the Sun
// never reaches -18°, its lower transit.
function eveningWindow(engine, jd, place) {
  const sunset = nearest(engine, jd, place, "sunset");
  if (sunset.kind === "none") return { kind: "no-window", reason: "no-sunset" };
  if (sunset.kind === "failed") return sunset;
  const tonight = (found) => found.kind === "found" && found.jd - sunset.jd < SAME_NIGHT;
  for (const event of ["astronomical-dusk", "lower-transit"]) {
    const end = engine.sunEvent(sunset.jd, place, event);
    if (end.kind === "failed") return end;
    if (tonight(end)) return { kind: "window", start: { jd: sunset.jd, event: "sunset" }, end: { jd: end.jd, event } };
  }
  return { kind: "no-window", reason: "no-astronomical-dusk" };
}

// The start of astronomical twilight before the sunrise or, on a night the Sun
// never reaches -18°, its lower transit. The first of either after the day
// before's sunrise is this morning's, if there's one.
function morningWindow(engine, jd, place) {
  const sunrise = nearest(engine, jd, place, "sunrise");
  if (sunrise.kind === "none") return { kind: "no-window", reason: "no-sunrise" };
  if (sunrise.kind === "failed") return sunrise;
  const thisMorning = (found) => found.kind === "found" && found.jd < sunrise.jd && sunrise.jd - found.jd < SAME_NIGHT;
  for (const event of ["astronomical-dawn", "lower-transit"]) {
    const start = engine.sunEvent(sunrise.jd - 1, place, event);
    if (start.kind === "failed") return start;
    if (thisMorning(start)) return { kind: "window", start: { jd: start.jd, event }, end: { jd: sunrise.jd, event: "sunrise" } };
  }
  return { kind: "no-window", reason: "no-astronomical-dawn" };
}

// A window's samples, and the best of them: the largest margin while the
// planet is above the horizon. The first failure stops it.
function sampled(window, engine, place, planet) {
  if (window.kind === "failed") return { window: failure(window), completed: null };
  if (window.kind !== "window") return { window, completed: null };
  const instants = sampleInstants(window.start.jd, window.end.jd);
  let best = null;
  let aboveHorizon = 0;
  for (const jd of instants) {
    const result = engine.limitingMagnitude(jd, place, planet);
    if (result.kind === "failed") return { window: failure(result), completed: null };
    if (result.kind === "below-horizon") continue;
    aboveHorizon += 1;
    // In magnitudes: above 0, the planet is predicted visible.
    const margin = result.limitingMagnitude - result.objectMagnitude;
    if (best === null || margin > best.margin) best = { jd, margin, result };
  }
  const bounds = { start: bound(window.start), end: bound(window.end), samples: instants.length, aboveHorizon };
  if (best === null) return { window: { kind: "below-horizon", ...bounds }, completed: null };
  const { kind, completed, raw, ...values } = best.result;
  return {
    window: { kind: "evaluated", ...bounds, best: { ...instant(best.jd), margin: best.margin, ...values, raw } },
    completed,
  };
}

function solar(geometry, underTheBeams) {
  if (geometry.kind !== "computed") return failure(geometry);
  const { sunLongitude, planetLongitude, planetLatitude, elongation } = geometry;
  const gap = longitudeGap(planetLongitude, sunLongitude);
  return {
    kind: "computed",
    sunLongitude,
    planetLongitude,
    planetLatitude,
    longitudeGap: gap,
    elongation,
    condition: traditionalCondition(gap, underTheBeams),
    apparition: apparition(gap),
  };
}

const failure = ({ reason, serr, raw }) => ({ kind: "failed", reason, serr: serr ?? raw?.serr ?? "" });

const instant = (jd) => ({ jd, utc: utcFromJulianDay(jd) });

// A window's start or end, and which Sun event it is.
const bound = ({ jd, event }) => ({ ...instant(jd), event });

const onGlobe = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * @typedef {{ jd: number, utc: string }} Instant  utc to the nearest second
 * @typedef {Instant & { event: "sunset" | "astronomical-dusk" | "lower-transit" | "astronomical-dawn" | "sunrise" }} Bound
 * @typedef {{ kind: "evaluated", start: Bound, end: Bound, samples: number, aboveHorizon: number,
 *     best: Instant & { margin: number } & object }
 *   | { kind: "below-horizon", start: Bound, end: Bound, samples: number, aboveHorizon: 0 }
 *   | { kind: "no-window", reason: "no-sunset" | "no-astronomical-dusk" | "no-sunrise" | "no-astronomical-dawn" }
 *   | { kind: "failed", reason: string, serr: string }} Window
 *   best holds the engine's values for that sample, with raw, Swiss Ephemeris's own
 * @typedef {{ kind: "visibility", planet: string, at: Instant, place: { lat: number, lng: number, elevation: number },
 *   solar: object, windows: { evening: Window, morning: Window }, classification: ReturnType<typeof classify>,
 *   assumptions: object }} Visibility
 */
