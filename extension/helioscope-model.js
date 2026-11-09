// What Helioscope's page shows: which planets could be seen with the naked
// eye in the twilight around a chart's moment, from its place. The chart
// arrives in the page's link, read as the receiving page reads one, and
// core/helioscope.js works out each planet with the page's engine. Every
// decision is made here, so helioscope.js only runs the engine, keeps the
// settings and draws with helioscope-view.js.
//
// The four results of the feasibility doc's §6 stay apart on screen: the
// traditional condition and the side of the Sun are at the chart's moment,
// and the prediction is from the twilight windows around it, with its raw
// margin and no "marginal" class. Times are at the chart's own offset, to the
// nearest minute, since the extension has no time zones to give another.
import { natalChartFor, readLink } from "./chart-model.js";
import { ELEVATION_LIMITS, PLANETS, UNDER_THE_BEAMS_LIMITS, visibility } from "./core/helioscope.js";
import { text } from "./messages/index.js";
import { offsetText, viewFor } from "./popup-model.js";

// No elevation given, so the results assume 0 m and say so, and under the
// beams within 15°, as visibility() has them.
export const DEFAULT_SETTINGS = Object.freeze({ elevation: null, underTheBeams: 15 });

// The settings' key in the extension's storage on this computer.
const SETTINGS_KEY = "helioscope-settings";

const MINUS = "−";
const WINDOWS = ["evening", "morning"];

/**
 * The chart in the page's link, as visibility() takes it.
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
 * Every planet's visibility for the chart, in PLANETS's order. The planets
 * share the chart, so a chart visibility() refuses is refused once.
 *
 * @param {object} chart  a normalized chart
 * @param {import("./helioscope-engine.js").Engine} engine
 * @param {{ elevation: number | null, underTheBeams: number }} settings  elevation is null when none was given
 * @returns {{ kind: "results", results: Record<string, object> } | { kind: "refused", reason: string }}
 */
export function visibilities(chart, engine, { elevation, underTheBeams }) {
  const options = elevation === null || elevation === undefined ? { underTheBeams } : { elevation, underTheBeams };
  const results = {};
  for (const planet of PLANETS) {
    const result = visibility(chart, planet, engine, options);
    if (result.kind === "refused") return result;
    results[planet] = result;
  }
  return { kind: "results", results };
}

/**
 * The screen for a chart's results: the chart screen's own rows, so the chart
 * reads as it does in the popup, then a row for each planet with its
 * details, the assumptions and the notes.
 *
 * @param {object} chart  a normalized chart
 * @param {Record<string, object>} results  from visibilities
 * @returns {{ state: "ready", rows: [string, string][], planets: object[], assumptions: [string, string][], notes: string[] }}
 */
export function viewForVisibility(chart, results) {
  const list = PLANETS.map((planet) => results[planet]);
  return {
    state: "ready",
    rows: viewFor(chart).rows,
    planets: list.map((result) => planetRow(result, chart)),
    assumptions: assumptionRows(list),
    notes: [text().helioscope.timesAt(offsetText(chart.offsetMinutes))],
  };
}

/**
 * The screen for a page with nothing to work out: no chart in its link, a
 * link or chart that's refused, or Swiss Ephemeris failing to start. A
 * refusal keeps its code on screen, as the popup's do.
 *
 * @param {string | null} reason  a link's or visibility()'s, or "engine-failed"; null for no chart
 * @returns {{ state: "empty", message: string } | { state: "refused", message: string, code: string }}
 */
export function viewForRefusal(reason) {
  const words = text().helioscope;
  if (reason === null) return { state: "empty", message: words.empty };
  const fromLink = text().chart.refusals.link;
  let message = words.refusals.other;
  if (Object.hasOwn(words.refusals, reason)) message = words.refusals[reason];
  else if (Object.hasOwn(fromLink, reason)) message = fromLink[reason];
  return { state: "refused", message, code: reason };
}

/**
 * What the elevation box holds: nothing, which is no elevation, or whole
 * metres in the range the engine takes.
 *
 * @param {string} typed
 * @returns {{ kind: "elevation", metres: number | null } | { kind: "refused", reason: "not-whole-metres" | "out-of-range", message: string }}
 */
export function readElevation(typed) {
  const trimmed = typed.trim();
  if (trimmed === "") return { kind: "elevation", metres: null };
  const message = text().helioscope.elevationRefused;
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
 * @returns {Promise<{ elevation: number | null, underTheBeams: number }>}  DEFAULT_SETTINGS until the user chooses
 */
export async function helioscopeSettings(storage) {
  const { [SETTINGS_KEY]: stored } = await storage.get(SETTINGS_KEY);
  return settingsFrom(stored);
}

/**
 * Keeps the page's settings, or forgets them when they're the defaults again.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {{ elevation: number | null, underTheBeams: number }} settings
 */
export async function setHelioscopeSettings(storage, settings) {
  const kept = settingsFrom(settings);
  const isDefault = kept.elevation === DEFAULT_SETTINGS.elevation && kept.underTheBeams === DEFAULT_SETTINGS.underTheBeams;
  if (isDefault) await storage.remove(SETTINGS_KEY);
  else await storage.set({ [SETTINGS_KEY]: kept });
}

// Each setting as stored, or its default where the stored value doesn't fit:
// storage can hold anything an older version or a hand edit left there.
function settingsFrom(value) {
  return {
    elevation: fits(value?.elevation) ? value.elevation : DEFAULT_SETTINGS.elevation,
    underTheBeams: UNDER_THE_BEAMS_LIMITS.includes(value?.underTheBeams) ? value.underTheBeams : DEFAULT_SETTINGS.underTheBeams,
  };
}

const fits = (metres) => Number.isInteger(metres) && metres >= ELEVATION_LIMITS.lowest && metres <= ELEVATION_LIMITS.highest;

function planetRow(result, chart) {
  return {
    planet: result.planet,
    name: text().helioscope.planets[result.planet],
    moment: momentFor(result.solar),
    prediction: predictionFor(result, chart),
    details: detailRows(result, chart),
  };
}

// The traditional condition and the side of the Sun at the chart's moment.
function momentFor(solar) {
  const words = text().helioscope;
  if (solar.kind !== "computed") {
    return { condition: null, side: null, text: words.notWorkedOut, angle: text().view.code(solar.reason) };
  }
  const { condition, apparition: side, longitudeGap: gap } = solar;
  const named = words.conditions[condition];
  return {
    condition,
    side,
    text: side === null ? named : words.moment(named, words.sides[side]),
    angle: angleFromSun(gap),
  };
}

// The gap in longitude, in (-180, 180], as east or west of the Sun.
function angleFromSun(gap) {
  const words = text().helioscope;
  if (gap === 0) return words.inConjunction;
  if (gap === 180) return words.inOpposition;
  const degrees = decimal(Math.abs(gap), 1);
  return gap > 0 ? words.eastOfSun(degrees) : words.westOfSun(degrees);
}

// The prediction from the windows, with the best one's time and margin. A
// planet detectable in both windows, as one near opposition can be, gets the
// other window's margin too.
function predictionFor({ classification, windows }, chart) {
  const words = text().helioscope;
  const { kind } = classification;
  const label = words.predictions[kind];
  if (kind === "detectable" || kind === "undetectable") {
    const window = classification.window;
    const best = words.best(words.windows[window], when(windows[window].best.utc, chart), signed(classification.margin));
    const other = window === "evening" ? "morning" : "evening";
    const second = windows[other];
    const both = kind === "detectable" && second.kind === "evaluated" && second.best.margin > 0;
    return { kind, label, detail: both ? `${best}${words.also(words.windows[other], signed(second.best.margin))}` : best };
  }
  if (kind === "below-horizon") return { kind, label, detail: words.belowBoth };
  if (kind === "indeterminate") return { kind, label, detail: noWindowText(windows) };
  return { kind, label, detail: text().view.code(classification.reason) };
}

function noWindowText({ evening, morning }) {
  const { noWindow } = text().helioscope;
  const noSunset = evening.kind === "no-window" && evening.reason === "no-sunset";
  const noSunrise = morning.kind === "no-window" && morning.reason === "no-sunrise";
  if (noSunset && noSunrise) return noWindow.both;
  if (noSunset) return noWindow.set;
  if (noSunrise) return noWindow.rise;
  return noWindow.other;
}

// Each window, and its best moment when it has one, then the planet's two
// angles from the Sun.
function detailRows({ planet, windows, solar }, chart) {
  const { labels } = text().helioscope;
  const rows = [];
  for (const name of WINDOWS) {
    const window = windows[name];
    rows.push([labels[name], windowText(window, chart)]);
    if (window.kind === "evaluated") rows.push([labels.best[name], bestText(planet, window.best, chart)]);
  }
  if (solar.kind === "computed") {
    rows.push([labels.longitudeGap, `${signed(solar.longitudeGap)}°`], [labels.elongation, `${decimal(solar.elongation, 2)}°`]);
  }
  return rows;
}

function windowText(window, chart) {
  const words = text().helioscope;
  if (window.kind === "failed") return words.failed(window.reason);
  if (window.kind === "no-window") return Object.hasOwn(words.none, window.reason) ? words.none[window.reason] : words.none.other;
  const { start, end } = window;
  const span = words.span(words.events[start.event], when(start.utc, chart), words.events[end.event], when(end.utc, chart));
  return window.kind === "evaluated" ? `${span}${words.above(window.aboveHorizon, window.samples)}` : `${span}${words.below}`;
}

function bestText(planet, best, chart) {
  const words = text().helioscope;
  return words.bestMoment({
    time: when(best.utc, chart),
    margin: signed(best.margin),
    planet: words.planets[planet],
    magnitude: magnitude(best.objectMagnitude),
    limit: magnitude(best.limitingMagnitude),
    altitude: Math.round(best.altitude),
    direction: words.directions[compassPoint(best.azimuth)],
    sunDepth: Math.round(-best.sunAltitude),
  });
}

// One of eight points, from the engine's azimuth, which runs from north
// through east: Venus after sunset comes out at 231°, in the southwest.
const compassPoint = (azimuth) => ((Math.round(azimuth / 45) % 8) + 8) % 8;

// A UTC instant at the chart's offset, to the nearest minute, with its date
// when that isn't the chart's own.
function when(utc, chart) {
  const words = text().helioscope;
  const minute = 60_000;
  const local = new Date(Math.round((Date.parse(utc) + chart.offsetMinutes * minute) / minute) * minute).toISOString();
  const time = local.slice(11, 16);
  if (local.slice(0, 10) === chart.local.slice(0, 10)) return time;
  const [, month, day] = local.slice(0, 10).split("-").map(Number);
  return words.onDay(time, words.dayMonth(day, month));
}

// The atmosphere and observer as Swiss Ephemeris completed them, from the
// first planet with a sample above the horizon: they're the same at one
// place for every planet. The rest is the same in every result.
function assumptionRows(results) {
  const words = text().helioscope.assumptions;
  const { assumptions } = results[0];
  const completed = results.find((result) => result.assumptions.atmosphere.completed !== null)?.assumptions;
  const rows = [[words.ephemeris, words.ephemerisValue(assumptions.swissEphemeris)]];
  if (completed) {
    const { pressure, temperature, humidity } = completed.atmosphere.completed;
    const { age, snellenRatio, binocular } = completed.observer.completed;
    rows.push(
      [words.atmosphere, words.atmosphereValue(plain(pressure), plain(temperature), plain(humidity))],
      [words.observer, words.observerValue(age, plain(snellenRatio), binocular === 1)],
    );
  }
  const { metres, source } = assumptions.elevation;
  const elevation = `${metres < 0 ? MINUS : ""}${Math.abs(metres)}`;
  const { cazimi, combust, underTheBeams } = assumptions.conditionLimits;
  rows.push(
    [words.elevation, source === "default" ? words.elevationDefault(elevation) : words.elevationGiven(elevation)],
    [words.moon, assumptions.moon === "included" ? words.moonIncluded : words.moonLeftOut],
    [words.samples, words.every(assumptions.stepMinutes)],
    [words.limits, words.limitsValue(arc(cazimi), arc(combust), arc(underTheBeams))],
  );
  return rows;
}

// Degrees as degrees and minutes of arc: 17′, 8°30′, 15°.
function arc(degrees) {
  const minutes = Math.round(degrees * 60);
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (whole === 0) return `${rest}′`;
  return rest === 0 ? `${whole}°` : `${whole}°${rest}′`;
}

// x to so many decimal places, with the language's decimal mark.
const decimal = (x, digits) => x.toFixed(digits).replace(".", text().helioscope.decimal);

// A margin or a gap from the Sun, to 0.01, with a plus or a true minus.
const signed = (x) => `${x > 0 ? "+" : x < 0 ? MINUS : ""}${decimal(Math.abs(x), 2)}`;

// A magnitude, to 0.01, with a true minus when it's below 0.
const magnitude = (x) => `${x < 0 ? MINUS : ""}${decimal(Math.abs(x), 2)}`;

// A filled-in value as Swiss Ephemeris has it, to at most 0.01: 1013.25, 15.
const plain = (x) => String(Math.round(x * 100) / 100).replace(".", text().helioscope.decimal);
