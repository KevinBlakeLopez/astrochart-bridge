// What the parans page works out: the angular events of the chosen bodies
// around a chart's moment, from core/parans.js, and the pairs of them close
// enough to count as parans with the page's settings, and the screen drawn
// from them. The chart arrives in the page's link, read as the receiving page
// reads one. Times are at the chart's own offset, to the nearest minute, as
// on Helioscope's page.
//
// A paran here is two events of two different bodies whose ARMCs are within
// the orb, at most 12 hours apart. The ARMC gap is wrapped into
// (-180, 180], so two events nearly a sidereal day apart have nearly the same
// ARMC; the 12 hours keep those out, since they aren't the same moment of the
// day. Both are this page's rule: astro-research's parans-v1 has no orb.
import { natalChartFor, readLink } from "./chart-model.js";
import { atChartOffset } from "./chart-time.js";
import { BODIES, DWARF_PLANETS, ELEVATION_LIMITS, FIXED_STARS, PLANETS, angularEvents, isStar, paranGaps } from "./core/parans.js";
import { text } from "./messages/index.js";
import { offsetText, viewFor } from "./popup-model.js";

// Degrees of ARMC, 1° being about 4 minutes of time.
export const ORBS = Object.freeze([0.25, 0.5, 1, 2]);

// The horizons the page offers, as the engine takes them: the geometric
// horizon, the centre of the disc with no refraction, and the almanac's, the
// upper limb with refraction at 1013.25 hPa and 10 °C. They're the two
// test/parans-reference.json checks.
export const HORIZONS = Object.freeze({
  geometric: Object.freeze({ disc: "centre", refraction: null }),
  almanac: Object.freeze({ disc: "upper-limb", refraction: Object.freeze({ pressure: 1013.25, temperature: 10 }) }),
});

// A 1° orb, the Sun, the Moon and the planets, the geometric horizon and no
// elevation given, so the results assume 0 m and say so. The dwarf planets
// and the fixed stars are left to be ticked.
export const DEFAULT_SETTINGS = Object.freeze({ orb: 1, bodies: PLANETS, stars: false, horizon: "geometric", elevation: null });

// The files the page loads from vendor/swisseph/ephe/, about 1.7 MB in all:
// for the dwarf planets, each one's long file, for 3000 BC to 2999, and
// Ceres's three main asteroid files, for 1200 to 2999, which between them
// cover every window the page takes; and for the fixed stars, Swiss
// Ephemeris's star catalogue.
export const EPHEMERIS_FILES = Object.freeze([
  "s136108.se1", "s136199.se1", "s136472.se1", "se20000.se1", "se28978.se1", "se90377.se1", "se90482.se1",
  "seas_12.se1", "seas_18.se1", "seas_24.se1", "sefstars.txt",
]);

// The settings' key in the extension's storage on this computer.
const SETTINGS_KEY = "parans-settings";

// Two events further apart than this aren't a paran, whatever their ARMCs.
const MOST_SECONDS_APART = 12 * 3600;

/**
 * The chart in the page's link, as angularEvents takes it.
 *
 * @param {string} hash  location.hash
 * @returns {null | { kind: "chart", chart: object } | { kind: "refused", reason: string }}
 *   null when the link has no chart at all
 */
export function chartFromLink(hash) {
  const result = readLink(hash);
  if (result === null || result.kind === "refused") return result;
  return { kind: "chart", chart: natalChartFor(result.chart) };
}

/**
 * The chart's angular events with the page's settings, and its parans.
 *
 * @param {object} chart  a normalized chart
 * @param {import("./helioscope-engine.js").Engine} engine
 * @param {Settings} settings  as paransSettings gives them: two bodies or more
 * @returns {{ kind: "parans", events: import("./core/parans.js").AngularEvents, parans: Paran[] }
 *   | { kind: "refused", reason: string } | { kind: "failed", point: string, event: string, failure: object }}
 *   angularEvents' refusal or failure as it gave it
 */
export function paransFor(chart, engine, { orb, bodies, stars, horizon, elevation }) {
  if (!Array.isArray(bodies) || bodies.length < 2) throw new Error(`paransFor needs two bodies or more; got ${JSON.stringify(bodies)}`);
  if (!Object.hasOwn(HORIZONS, horizon)) throw new Error(`paransFor takes a horizon from ${Object.keys(HORIZONS).join(", ")}; got ${horizon}`);
  const options = {
    bodies: BODIES.filter((body) => bodies.includes(body)),
    stars: stars === true ? FIXED_STARS.map(({ designation }) => designation) : [],
    horizon: HORIZONS[horizon],
  };
  if (elevation !== null && elevation !== undefined) options.elevation = elevation;
  const events = angularEvents(chart, engine, options);
  if (events.kind !== "events") return events;
  return { kind: "parans", events, parans: paransWithin(events, orb) };
}

/**
 * The pairs of events of two different bodies whose ARMCs are within orb,
 * the bound included, at most 12 hours apart, the closest first. Pairs as
 * close as each other keep paranGaps's order, the earlier first.
 *
 * @param {import("./core/parans.js").AngularEvents} events  from angularEvents
 * @param {number} orb  degrees of ARMC, one of ORBS
 * @returns {Paran[]}
 */
export function paransWithin(events, orb) {
  if (!ORBS.includes(orb)) throw new Error(`paransWithin takes an orb from ${ORBS.join(", ")}; got ${orb}`);
  return paranGaps(events)
    .filter(({ armc, seconds }) => Math.abs(armc) <= orb && Math.abs(seconds) <= MOST_SECONDS_APART)
    .sort((a, b) => Math.abs(a.armc) - Math.abs(b.armc));
}

/**
 * The screen for a chart's parans: the chart screen's own rows, so the chart
 * reads as it does in the popup, then the parans, closest first, every event
 * in time order with the risings and settings that didn't happen, the
 * assumptions and the notes.
 *
 * @param {object} chart  a normalized chart
 * @param {{ events: import("./core/parans.js").AngularEvents, parans: Paran[] }} worked  from paransFor
 * @param {Settings} settings  the ones paransFor was given
 * @returns {{ state: "ready", rows: [string, string][],
 *   parans: { heading: string, columns: { paran: string, apart: string }, rows: object[], none: string | null },
 *   events: { heading: string, summary: string, rows: [string, string][], missing: string[] },
 *   assumptions: { heading: string, rows: [string, string][] }, notes: string[] }}
 */
export function viewForParans(chart, { events, parans }, { orb, horizon }) {
  const words = text().parans;
  const when = (event) => atChartOffset(event.utc, chart);
  const said = (event) => words.event(pointName(event.point), event.event);
  return {
    state: "ready",
    rows: viewFor(chart).rows,
    parans: {
      heading: words.withinOrb(plain(orb)),
      columns: { ...words.columns },
      rows: parans.map(({ first, second, armc, seconds }) => ({
        first: words.at(said(first), when(first)),
        second: words.at(said(second), when(second)),
        armc: words.armcGap(decimal(Math.abs(armc), 2)),
        time: timeGap(seconds),
      })),
      none: parans.length === 0 ? words.none(plain(orb)) : null,
    },
    events: {
      heading: words.eventsHeading,
      summary: words.eventsSummary,
      rows: events.events.map((event) => [when(event), words.eventArmc(said(event), decimal(aroundCircle(event.armc), 2))]),
      missing: missingLines(events.noRiseOrSet),
    },
    assumptions: { heading: words.assumptionsHeading, rows: assumptionRows(events, chart, orb, horizon) },
    notes: [words.timesAt(offsetText(chart.offsetMinutes)), words.armcNote],
  };
}

/**
 * The screen for a page with nothing to work out: no chart in its link, a
 * link or chart that's refused, Swiss Ephemeris failing to start, or one of
 * its searches failing. A refusal keeps its code on screen, as the popup's do.
 *
 * @param {string | null} reason  a link's or angularEvents's, or "engine-failed"; null for no chart
 * @returns {{ state: "empty", message: string } | { state: "refused", message: string, code: string }}
 */
export function viewForRefusal(reason) {
  const words = text().parans;
  if (reason === null) return { state: "empty", message: words.empty };
  const fromLink = text().chart.refusals.link;
  let message = words.refusals.other;
  if (Object.hasOwn(words.refusals, reason)) message = words.refusals[reason];
  else if (Object.hasOwn(fromLink, reason)) message = fromLink[reason];
  return { state: "refused", message, code: reason };
}

/**
 * The screen for one of Swiss Ephemeris's searches failing, which fails the
 * whole result: a list with a hole in it would look complete.
 *
 * @param {{ point: string, event: string, failure: { reason: string } }} failed  from paransFor
 * @returns {{ state: "refused", message: string, code: string }}
 */
export function viewForFailure({ point, event, failure }) {
  return { state: "refused", message: text().parans.failed(point, event), code: failure.reason };
}

// The bodies that didn't rise, set or either, in BODIES's order, then the
// stars that didn't rise or set, in one line, brightest first: at a high
// latitude they can be dozens. A star misses both, never only one.
function missingLines(noRiseOrSet) {
  const words = text().parans;
  const lines = [];
  for (const body of BODIES) {
    const rise = noRiseOrSet.some(({ point, event }) => point === body && event === "rise");
    const set = noRiseOrSet.some(({ point, event }) => point === body && event === "set");
    if (rise || set) lines.push(words.missing(body, rise && set ? "both" : rise ? "rise" : "set"));
  }
  const stars = FIXED_STARS.filter(({ designation }) => noRiseOrSet.some(({ point }) => point === designation));
  if (stars.length > 0) lines.push(words.starsMissing(stars.map(starLabel)));
  return lines;
}

// A body by its key, which the language's words name, or a star by its
// catalogue name and its other names, which they take as they are.
const pointName = (point) => (isStar(point) ? starLabel(FIXED_STARS.find(({ designation }) => designation === point)) : point);

// "Deneb (Deneb Adige)", "Rigil Kentaurus (Rigel Kentaurus, Toliman, Bungula)", "Vega (Abhijit)", or "Rasalhague".
const starLabel = ({ name, otherNames }) => (otherNames.length === 0 ? name : `${name} (${otherNames.join(", ")})`);

// The window, as angularEvents had it, then how each event was found, the
// horizon, the elevation and the orb. Where the dwarf planets and the stars
// come from is said only when they were chosen.
function assumptionRows({ window, assumptions, bodies, stars = [] }, chart, orb, horizon) {
  const words = text().parans.assumptions;
  const { metres, source } = assumptions.elevation;
  const elevation = `${metres < 0 ? MINUS : ""}${Math.abs(metres)}`;
  const { refraction } = HORIZONS[horizon];
  const dwarfPlanets = bodies.some((body) => DWARF_PLANETS.includes(body)) ? [[words.dwarfPlanets, words.dwarfPlanetsValue]] : [];
  const fixedStars = stars.length > 0 ? [[words.stars, words.starsValue(stars.length)]] : [];
  return [
    [words.ephemeris, words.ephemerisValue(assumptions.swissEphemeris)],
    ...dwarfPlanets,
    ...fixedStars,
    [words.time, words.timeValue],
    [words.window, words.windowValue(atChartOffset(window.start.utc, chart), atChartOffset(window.end.utc, chart))],
    [words.position, words.positionValue],
    [words.horizon, refraction === null ? words.geometric : words.almanac(plain(refraction.pressure), plain(refraction.temperature))],
    [words.culminations, words.culminationsValue],
    [words.search, words.searchValue(assumptions.refineLeadMinutes)],
    [words.elevation, source === "default" ? words.elevationDefault(elevation) : words.elevationGiven(elevation)],
    [words.orb, words.orbValue(plain(orb))],
  ];
}

const MINUS = "−";

// The time between two events, to the nearest second: "1 min 41 s", "41 s".
function timeGap(seconds) {
  const whole = Math.round(Math.abs(seconds));
  return text().parans.timeGap(Math.floor(whole / 60), whole % 60);
}

// x to so many decimal places, with the language's decimal mark.
const decimal = (x, digits) => x.toFixed(digits).replace(".", text().parans.decimal);

// An ARMC in [0, 360) to 0.01°, so 359.996° is 0.00°, not 360.00°.
const aroundCircle = (degrees) => (Math.round(degrees * 100) / 100) % 360;

// A value as it's set, with the language's decimal mark: 0.25, 1, 1013.25.
const plain = (x) => String(x).replace(".", text().parans.decimal);

/**
 * An orb as its radio button says it, with the language's decimal mark: "0.25°", "0,25°".
 *
 * @param {number} orb  one of ORBS
 */
export const orbLabel = (orb) => `${plain(orb)}°`;

/**
 * The bodies whose boxes can't be unticked: both of the last two, since a
 * paran takes two bodies. None while there are more.
 *
 * @param {string[]} bodies  the ticked ones, as the settings have them
 * @returns {string[]}
 */
export const lockedBodies = (bodies) => (bodies.length <= 2 ? [...bodies] : []);

/**
 * What the elevation box holds: nothing, which is no elevation, or whole
 * metres in the range the engine takes, as on Helioscope's page.
 *
 * @param {string} typed
 * @returns {{ kind: "elevation", metres: number | null } | { kind: "refused", reason: "not-whole-metres" | "out-of-range", message: string }}
 */
export function readElevation(typed) {
  const trimmed = typed.trim();
  if (trimmed === "") return { kind: "elevation", metres: null };
  const message = text().parans.elevationRefused;
  if (!/^-?\d+$/.test(trimmed)) return { kind: "refused", reason: "not-whole-metres", message };
  // || 0 turns "-0" into 0.
  const metres = Number(trimmed) || 0;
  if (!fits(metres)) return { kind: "refused", reason: "out-of-range", message };
  return { kind: "elevation", metres };
}

/**
 * The page's settings, as the user last left them on this computer.
 *
 * @param {chrome.storage.StorageArea} storage  chrome.storage.local, or a stand-in in tests
 * @returns {Promise<Settings>}  DEFAULT_SETTINGS until the user chooses
 */
export async function paransSettings(storage) {
  const { [SETTINGS_KEY]: stored } = await storage.get(SETTINGS_KEY);
  return settingsFrom(stored);
}

/**
 * Keeps the page's settings, or forgets them when they're the defaults again.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {Settings} settings
 */
export async function setParansSettings(storage, settings) {
  const kept = settingsFrom(settings);
  // Kept bodies are in BODIES's order, as the default's are.
  const isDefault =
    kept.orb === DEFAULT_SETTINGS.orb &&
    kept.bodies.join() === DEFAULT_SETTINGS.bodies.join() &&
    kept.stars === DEFAULT_SETTINGS.stars &&
    kept.horizon === DEFAULT_SETTINGS.horizon &&
    kept.elevation === DEFAULT_SETTINGS.elevation;
  if (isDefault) await storage.remove(SETTINGS_KEY);
  else await storage.set({ [SETTINGS_KEY]: kept });
}

// Each setting as stored, or its default where the stored value doesn't fit:
// storage can hold anything an older version or a hand edit left there. The
// bodies come back in BODIES's order.
function settingsFrom(value) {
  return {
    orb: ORBS.includes(value?.orb) ? value.orb : DEFAULT_SETTINGS.orb,
    bodies: someBodies(value?.bodies) ? BODIES.filter((body) => value.bodies.includes(body)) : [...DEFAULT_SETTINGS.bodies],
    // Only a true ticks them: anything else stored is the default.
    stars: value?.stars === true,
    horizon: typeof value?.horizon === "string" && Object.hasOwn(HORIZONS, value.horizon) ? value.horizon : DEFAULT_SETTINGS.horizon,
    elevation: fits(value?.elevation) ? value.elevation : DEFAULT_SETTINGS.elevation,
  };
}

// Two bodies or more, each once, each one angularEvents knows.
const someBodies = (bodies) =>
  Array.isArray(bodies) && bodies.length >= 2 && new Set(bodies).size === bodies.length && bodies.every((body) => BODIES.includes(body));

const fits = (metres) => Number.isInteger(metres) && metres >= ELEVATION_LIMITS.lowest && metres <= ELEVATION_LIMITS.highest;

/**
 * @typedef {{ orb: number, bodies: string[], stars: boolean, horizon: keyof typeof HORIZONS, elevation: number | null }} Settings
 *   stars is whether FIXED_STARS are worked out too; elevation is null when none was given
 * @typedef {ReturnType<typeof paranGaps>[number]} Paran
 */
