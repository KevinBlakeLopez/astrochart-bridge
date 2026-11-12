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
//
// Check that night's weather, when the user clicks it, asks Open-Meteo for
// ERA5's weather in the twilights (core/open-meteo.js), then works each
// twilight out again with that night's air. Each planet bright enough to see
// then gives the cloud at its best moment, and is probably clouded out when
// low or mid cloud covered nearly all of ERA5's square at every best moment
// it had. High cloud alone never hides one: a bright planet can show through.
import { natalChartFor, readLink } from "./chart-model.js";
// A UTC instant at the chart's offset, to the nearest minute, with its date
// when that isn't the chart's own.
import { atChartOffset as when } from "./chart-time.js";
import { DEFAULT_CONDITION_LIMITS, ELEVATION_LIMITS, PLANETS, classify, conditionLimitsFit, visibility } from "./core/helioscope.js";
import { nearestHour, readWeather, weatherRequest } from "./core/open-meteo.js";
import { stellariumUrl } from "./core/stellarium.js";
import { text } from "./messages/index.js";
import { offsetText, viewFor } from "./popup-model.js";

/**
 * The page's settings. The orbs are the limits of the traditional condition,
 * in whole minutes of arc, as they're typed and kept.
 *
 * @typedef {{ cazimi: number, combust: number, underTheBeams: number }} Orbs
 * @typedef {{ elevation: number | null, orbs: Orbs }} Settings  elevation is null when none was given
 */

// The orbs, from the inside out.
const ORBS = Object.freeze(["cazimi", "combust", "underTheBeams"]);

// Orbs in whole minutes of arc from limits in degrees, and back.
const inMinutes = (limits) => Object.fromEntries(ORBS.map((name) => [name, Math.round(limits[name] * 60)]));
const inDegrees = (orbs) => Object.fromEntries(ORBS.map((name) => [name, orbs[name] / 60]));

// visibility()'s own limits, 17′, 8°30′ and 15°, the values most often cited.
const DEFAULT_ORBS = Object.freeze(inMinutes(DEFAULT_CONDITION_LIMITS));

// No elevation given, so the results assume 0 m and say so, and the default
// orbs.
export const DEFAULT_SETTINGS = Object.freeze({ elevation: null, orbs: DEFAULT_ORBS });

// The settings' key in the extension's storage on this computer.
const SETTINGS_KEY = "helioscope-settings";

const MINUS = "−";
const WINDOWS = ["evening", "morning"];

// Low or mid cloud over this much of ERA5's square, in %, at a planet's best
// moment probably hid it: a choice, not a measurement. High cloud alone
// never does, since a bright planet can show through it.
const CLOUDED_OUT = 90;

// The names Stellarium Web's skysource/ path takes, which it looks up through
// the NoctuaSky API: English, whatever the interface's language.
const SKY_SOURCES = Object.freeze({ mercury: "Mercury", venus: "Venus", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn" });

// Degrees: the field of view the feasibility doc checked (§7), which shows the
// planet among its neighbours.
const FIELD_OF_VIEW = 60;

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
 * @param {Settings} settings
 * @returns {{ kind: "results", results: Record<string, object> } | { kind: "refused", reason: string }}
 */
export function visibilities(chart, engine, { elevation, orbs }) {
  const conditionLimits = inDegrees(orbs);
  const options = elevation === null || elevation === undefined ? { conditionLimits } : { elevation, conditionLimits };
  const results = {};
  for (const planet of PLANETS) {
    const result = visibility(chart, planet, engine, options);
    if (result.kind === "refused") return result;
    results[planet] = result;
  }
  return { kind: "results", results };
}

/**
 * The planets again with that night's air: the evening twilight worked out
 * with the evening's engine, the morning with the morning's, and the two
 * judged together as visibilities judges them. A twilight with no window
 * can share the other's engine, since a window's bounds don't depend on the
 * air.
 *
 * @param {object} chart  a normalized chart
 * @param {{ evening: import("./helioscope-engine.js").Engine, morning: import("./helioscope-engine.js").Engine }} engines
 * @param {Settings} settings
 * @returns {ReturnType<typeof visibilities>}
 */
export function visibilitiesWithAir(chart, { evening, morning }, settings) {
  const dusk = visibilities(chart, evening, settings);
  if (dusk.kind === "refused" || evening === morning) return dusk;
  const dawn = visibilities(chart, morning, settings);
  if (dawn.kind === "refused") return dawn;
  const results = {};
  for (const planet of PLANETS) {
    const windows = { evening: dusk.results[planet].windows.evening, morning: dawn.results[planet].windows.morning };
    results[planet] = { ...dusk.results[planet], windows, classification: classify(windows.evening, windows.morning) };
  }
  return { kind: "results", results };
}

/**
 * What Check that night's weather asks Open-Meteo for: the hour nearest the
 * middle of each twilight, for its air, from every month the twilights touch,
 * their ends included, since each planet's cloud is read at the hour nearest
 * its own best moment. A twilight's bounds are the Sun's, the same for every
 * planet. null for a twilight with no window.
 *
 * @param {object} chart  a normalized chart
 * @param {Record<string, object>} results  from visibilities
 * @param {string} today  the UTC date, "YYYY-MM-DD"
 * @returns {{ kind: "request", url: string, hours: { evening: string | null, morning: string | null } }
 *   | { kind: "refused", reason: "no-twilight" | "before-1940" | "future" }}
 */
export function weatherRequestFor(chart, results, today) {
  const hours = {};
  const asked = [];
  for (const name of WINDOWS) {
    const bounded = PLANETS.map((planet) => results[planet].windows[name]).find((window) => window.start && window.end);
    hours[name] = bounded ? nearestHour(new Date((Date.parse(bounded.start.utc) + Date.parse(bounded.end.utc)) / 2).toISOString()) : null;
    if (bounded) asked.push(nearestHour(bounded.start.utc), hours[name], nearestHour(bounded.end.utc));
  }
  if (asked.length === 0) return { kind: "refused", reason: "no-twilight" };
  const request = weatherRequest(chart, asked, today);
  return request.kind === "refused" ? request : { ...request, hours };
}

/**
 * Whether the page can offer Check that night's weather, or why not.
 *
 * @param {object} chart
 * @param {Record<string, object>} results
 * @param {string} today
 * @returns {{ kind: "offer" } | { kind: "refused", reason: "no-twilight" | "before-1940" | "future" }}
 */
export function weatherOffer(chart, results, today) {
  const request = weatherRequestFor(chart, results, today);
  return request.kind === "refused" ? request : { kind: "offer" };
}

/**
 * That night's weather at each twilight's hour, from Open-Meteo's answer,
 * with every hour of the answer kept for the planets' best moments. Every
 * twilight with a window needs its reading: a night ERA5 hasn't reached yet
 * is refused rather than half shown.
 *
 * @param {unknown} answer  Open-Meteo's JSON
 * @param {{ evening: string | null, morning: string | null }} hours  from weatherRequestFor
 * @param {string} today  the UTC date it was asked on, for the credit
 * @returns {{ kind: "weather", year: string, evening: Night | null, morning: Night | null,
 *   hourly: Record<string, import("./core/open-meteo.js").Reading | null> }
 *   | { kind: "refused", reason: "not-yet" } | { kind: "failed", reason: "unexpected-answer" }}
 */
export function nightWeather(answer, hours, today) {
  const read = readWeather(answer);
  if (read.kind === "failed") return read;
  const night = {};
  for (const name of WINDOWS) {
    const hour = hours[name];
    const reading = hour === null ? null : (read.at[hour] ?? null);
    if (hour !== null && reading === null) return { kind: "refused", reason: "not-yet" };
    night[name] = reading === null ? null : { hour, ...reading };
  }
  return { kind: "weather", year: today.slice(0, 4), ...night, hourly: read.at };
}

/**
 * The screen for a chart's results: the chart screen's own rows, so the chart
 * reads as it does in the popup, then the weather check, a row for each
 * planet with its details, the assumptions and the notes.
 *
 * @param {object} chart  a normalized chart
 * @param {Record<string, object>} results  from visibilities, or visibilitiesWithAir once the weather is in
 * @param {WeatherCheck} [weather]  where the weather check stands: offered, unless the page says otherwise
 * @returns {{ state: "ready", rows: [string, string][], weather: object, planets: object[], assumptions: [string, string][], notes: string[] }}
 */
export function viewForVisibility(chart, results, weather = OFFERED) {
  const words = text().helioscope;
  const list = PLANETS.map((planet) => results[planet]);
  const night = weather.kind === "weather" ? weather : null;
  const planets = list.map((result) => planetRow(result, chart, night));
  // What a Stellarium Web link sends, said once, when there's a link to say it of.
  const linksNote = planets.some(({ link }) => link !== null) ? [words.linksNote] : [];
  return {
    state: "ready",
    rows: viewFor(chart).rows,
    weather: weatherView(weather, chart),
    method: methodFor(list[0].assumptions),
    planets,
    assumptions: assumptionRows(list, night),
    notes: [words.timesAt(offsetText(chart.offsetMinutes)), ...linksNote],
  };
}

const OFFERED = Object.freeze({ kind: "offer" });

// The weather check as the page shows it: a button with what it sends; what
// it's doing; why it can't be done; or that night's weather, with the credit
// Open-Meteo and ERA5's licence ask for. A failure, or Firefox's consent
// refused, keeps the button, to try again.
function weatherView(weather, chart) {
  const words = text().helioscope.weather;
  if (weather.kind === "asking") return { kind: "asking", message: words.asking };
  if (weather.kind === "weather") {
    // The cloud in all at the reading's hour, said at the chart's offset.
    const cloud = (night) => cloudSaid(night.cloud, when(`${night.hour}:00Z`, chart));
    return {
      kind: "shown",
      title: words.title,
      line: nightLine(weather, cloud),
      note: words.reworked,
      credit: { data: words.credit.data, licence: words.credit.licence, source: words.credit.source(weather.year) },
    };
  }
  const offer = { kind: "offer", button: words.button, note: words.sends, message: null, code: null };
  if (weather.kind === "offer") return offer;
  // Firefox refusing to ask for its consent sent nothing, so it says so.
  if (weather.kind === "failed") return { ...offer, message: weather.reason === "consent-failed" ? words.consentFailed : words.failed, code: weather.reason };
  if (weather.reason === "declined") return { ...offer, message: words.refusals.declined };
  return { kind: "unavailable", message: Object.hasOwn(words.refusals, weather.reason) ? words.refusals[weather.reason] : words.failed };
}

// The cloud in all at a time: "90 % cloud at 18:00", or "no cloud at 07:00".
function cloudSaid(cloud, time) {
  const words = text().helioscope.weather;
  return cloud.total === 0 ? words.clearAt(time) : words.cloudAt(plain(cloud.total), time);
}

// Each twilight with that night's weather, "Dusk: …", joined.
function nightLine(weather, said) {
  const words = text().helioscope.weather;
  const parts = WINDOWS.filter((name) => weather[name] !== null).map((name) => words.twilight(words.twilights[name], said(weather[name])));
  return parts.length === 2 ? words.both(...parts) : parts[0];
}

// How each column judges, said under its heading: the traditional condition
// from the longitude gap alone, with the limits this page used, and the
// prediction, in plain words, whether the planet was bright enough to see.
function methodFor({ conditionLimits: { cazimi, combust, underTheBeams } }) {
  const words = text().helioscope;
  return {
    moment: words.methodMoment(arc(cazimi), arc(combust), arc(underTheBeams)),
    prediction: words.methodPrediction,
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

// An orb as it's typed: a plain number, whole degrees, whole degrees and
// minutes, or minutes alone with a minute mark. ° or º marks the degrees, and
// ′, ' or ’ the minutes: º is what Spanish keyboards type for degrees, and ’
// what iPhones and Macs type for an apostrophe. A plain number is degrees,
// except in the cazimi box, as the owner chose on 10 November 2026: cazimi is
// always given in minutes.
const PLAIN = /^(\d{1,2})$/;
const DEGREES = /^(\d{1,2})\s*[°º]$/;
const DEGREES_AND_MINUTES = /^(\d{1,2})\s*(?:[°º]\s*|\s+)(\d{1,2})\s*['′’]?$/;
const MINUTES = /^(\d{1,2})\s*['′’]$/;

/**
 * An orb as the page prints it, in its box and under Assumptions: 17′,
 * 8°30′, 15°.
 *
 * @param {number} minutes  whole minutes of arc
 * @returns {string}
 */
export const orbText = (minutes) => arc(minutes / 60);

/**
 * What the three orb boxes hold: each orb in whole degrees and minutes, or
 * its default when its box is empty, and the three nested, from cazimi out
 * to under the beams, which is at most 30°.
 *
 * @param {{ cazimi: string, combust: string, underTheBeams: string }} typed
 * @returns {{ kind: "orbs", orbs: Orbs }
 *   | { kind: "refused", reason: "not-degrees-and-minutes", orb: keyof Orbs, message: string }
 *   | { kind: "refused", reason: "out-of-order", orb: null, message: string }}
 *   the first box that isn't an orb, from the inside out, or null when the orbs don't nest
 */
export function readOrbs(typed) {
  const words = text().helioscope;
  const orbs = {};
  for (const name of ORBS) {
    const trimmed = typed[name].trim();
    const minutes = trimmed === "" ? DEFAULT_ORBS[name] : minutesIn(trimmed, name === "cazimi");
    if (minutes === null) return { kind: "refused", reason: "not-degrees-and-minutes", orb: name, message: words.orbRefused };
    orbs[name] = minutes;
  }
  if (!orbsFit(orbs)) return { kind: "refused", reason: "out-of-order", orb: null, message: words.orbsOutOfOrder };
  return { kind: "orbs", orbs };
}

// Whole minutes of arc from what's typed, or null when it isn't an orb. A
// plain number is minutes when plainIsMinutes, and minutes alone are under 60.
function minutesIn(typed, plainIsMinutes) {
  const plain = typed.match(PLAIN);
  if (plain && plainIsMinutes) return Number(plain[1]) < 60 ? Number(plain[1]) : null;
  if (plain) return Number(plain[1]) * 60;
  const degrees = typed.match(DEGREES);
  if (degrees) return Number(degrees[1]) * 60;
  const both = typed.match(DEGREES_AND_MINUTES);
  if (both) return Number(both[2]) < 60 ? Number(both[1]) * 60 + Number(both[2]) : null;
  const minutes = typed.match(MINUTES);
  if (minutes) return Number(minutes[1]) < 60 ? Number(minutes[1]) : null;
  return null;
}

// Whether orbs are whole minutes of arc that visibility() takes.
const orbsFit = (orbs) => ORBS.every((name) => Number.isInteger(orbs?.[name])) && conditionLimitsFit(inDegrees(orbs));

/**
 * The page's settings, as the user last left them on this computer.
 *
 * @param {chrome.storage.StorageArea} storage  chrome.storage.local, webStorageArea's localStorage on
 *   the web, or a stand-in in tests
 * @returns {Promise<Settings>}  DEFAULT_SETTINGS until the user chooses
 */
export async function helioscopeSettings(storage) {
  const { [SETTINGS_KEY]: stored } = await storage.get(SETTINGS_KEY);
  return settingsFrom(stored);
}

/**
 * Keeps the page's settings, or forgets them when they're the defaults again.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {Settings} settings
 */
export async function setHelioscopeSettings(storage, settings) {
  const kept = settingsFrom(settings);
  const isDefault = kept.elevation === DEFAULT_SETTINGS.elevation && ORBS.every((name) => kept.orbs[name] === DEFAULT_ORBS[name]);
  if (isDefault) await storage.remove(SETTINGS_KEY);
  else await storage.set({ [SETTINGS_KEY]: kept });
}

// Each setting as stored, or its default where the stored value doesn't fit:
// storage can hold anything an older version or a hand edit left there. The
// orbs go back to their defaults together, since one alone may not nest with
// the others. 0.3.0 kept under the beams alone, as 15 or 17 degrees beside
// the elevation.
function settingsFrom(value) {
  const fromOlder = [15, 17].includes(value?.underTheBeams) ? { ...DEFAULT_ORBS, underTheBeams: value.underTheBeams * 60 } : null;
  const orbs = value?.orbs ?? fromOlder;
  return {
    elevation: fits(value?.elevation) ? value.elevation : DEFAULT_SETTINGS.elevation,
    orbs: orbsFit(orbs) ? { cazimi: orbs.cazimi, combust: orbs.combust, underTheBeams: orbs.underTheBeams } : DEFAULT_ORBS,
  };
}

const fits = (metres) => Number.isInteger(metres) && metres >= ELEVATION_LIMITS.lowest && metres <= ELEVATION_LIMITS.highest;

function planetRow(result, chart, night) {
  return {
    planet: result.planet,
    name: text().helioscope.planets[result.planet],
    moment: momentFor(result.solar),
    prediction: predictionFor(result, chart, night),
    details: detailRows(result, chart),
    link: stellariumLink(result, chart),
  };
}

// Stellarium Web at the planet's best moment, the one its prediction names,
// with the planet selected, from the chart's place at the elevation the
// prediction used: 0 m when none was given, so Stellarium's horizon is the
// prediction's. A planet with no best moment has no link.
function stellariumLink({ planet, place, classification, windows }, chart) {
  if (classification.kind !== "detectable" && classification.kind !== "undetectable") return null;
  const words = text().helioscope;
  const { utc } = windows[classification.window].best;
  return {
    text: words.seeInStellarium,
    label: words.stellariumLabel(words.planets[planet], when(utc, chart)),
    url: stellariumUrl({ utc, lat: place.lat, lng: place.lng }, { object: SKY_SOURCES[planet], elevation: place.elevation, fov: FIELD_OF_VIEW }),
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

// The prediction from the windows in plain words: the best moment, and how
// many times brighter or fainter than needed the planet was then. A planet
// visible in both windows, as one near opposition can be, says so. The
// magnitudes themselves are in its details. With that night's weather in, a
// planet bright enough to see also gives the cloud at each best moment it was
// bright enough at, and is probably clouded out when every one was under
// thick low or mid cloud: its brightness answer stays, and the cloud says why.
function predictionFor({ classification, windows }, chart, night) {
  const words = text().helioscope;
  const { kind } = classification;
  const label = words.predictions[kind];
  if (kind === "detectable" || kind === "undetectable") {
    const window = classification.window;
    const time = when(windows[window].best.utc, chart);
    const ratio = times(classification.margin);
    if (kind === "undetectable") return { kind, label, detail: words.tooFaintAt(words.windows[window], time, ratio), cloud: null };
    const other = window === "evening" ? "morning" : "evening";
    const second = windows[other];
    const both = second.kind === "evaluated" && second.best.margin > 0;
    const visible = words.visibleAt(words.windows[window], time, ratio);
    const detail = both ? `${visible}${words.alsoVisible(words.windows[other])}` : visible;
    const sky = night ? skyAt(both ? WINDOWS : [window], windows, night, chart) : null;
    if (sky?.cloudedOut) return { kind: "clouded", label: words.predictions.clouded, detail, cloud: sky.line };
    return { kind, label, detail, cloud: sky?.line ?? null };
  }
  if (kind === "below-horizon") return { kind, label, detail: words.belowBoth, cloud: null };
  if (kind === "indeterminate") return { kind, label, detail: noWindowText(windows), cloud: null };
  return { kind, label, detail: text().view.code(classification.reason), cloud: null };
}

// That night's cloud at the hour nearest a planet's best moment in each of
// the twilights named, "Dusk: 90 % cloud at 18:00 (low 0 %, mid 86 %, high
// 88 %)", and whether the planet was probably clouded out: only when every
// twilight has a reading, each with low or mid cloud over CLOUDED_OUT % or
// more of ERA5's square. A twilight with no reading is left out of the line
// and could have been clear. null when none has a reading.
function skyAt(names, windows, night, chart) {
  const words = text().helioscope.weather;
  const seen = names.map((name) => {
    const hour = nearestHour(windows[name].best.utc);
    return { name, hour, reading: night.hourly[hour] ?? null };
  });
  const read = seen.filter(({ reading }) => reading !== null);
  if (read.length === 0) return null;
  const said = ({ name, hour, reading: { cloud } }) => {
    const total = cloudSaid(cloud, when(`${hour}:00Z`, chart));
    const layers = words.cloudValue(plain(cloud.low), plain(cloud.mid), plain(cloud.high));
    return words.twilight(words.twilights[name], cloud.total === 0 ? total : words.withLayers(total, layers));
  };
  return {
    line: read.length === 2 ? words.both(...read.map(said)) : said(read[0]),
    cloudedOut: read.length === seen.length && read.every(({ reading: { cloud } }) => Math.max(cloud.low, cloud.mid) >= CLOUDED_OUT),
  };
}

// How many times brighter, or fainter, than needed: the margin in magnitudes
// as a ratio of brightness, about 2.5 to a magnitude, to two significant
// figures in the language's numbers. It's the same margin in other units, not
// a class: nothing is banded.
const times = (margin) =>
  (10 ** (0.4 * Math.abs(margin))).toLocaleString(text().helioscope.locale, {
    maximumSignificantDigits: 2,
    minimumSignificantDigits: 2,
  });

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
function detailRows({ windows, solar }, chart) {
  const { labels } = text().helioscope;
  const rows = [];
  for (const name of WINDOWS) {
    const window = windows[name];
    rows.push([labels[name], windowText(window, chart)]);
    if (window.kind === "evaluated") rows.push([labels.best[name], bestText(window.best, chart)]);
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

function bestText(best, chart) {
  const words = text().helioscope;
  return words.bestMoment({
    time: when(best.utc, chart),
    margin: signed(best.margin),
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

// The atmosphere and observer as Swiss Ephemeris completed them, from the
// first planet with a sample above the horizon: they're the same at one
// place for every planet. With that night's weather in, the atmosphere is
// each twilight's, which Swiss Ephemeris takes as given, and the cloud at
// each height follows it. The rest is the same in every result.
function assumptionRows(results, night) {
  const words = text().helioscope.assumptions;
  const { weather } = text().helioscope;
  const { assumptions } = results[0];
  const completed = results.find((result) => result.assumptions.atmosphere.completed !== null)?.assumptions;
  const rows = [[words.ephemeris, words.ephemerisValue(assumptions.swissEphemeris)]];
  if (night) {
    rows.push(
      [weather.air, nightLine(night, ({ air }) => words.atmosphereValue(plain(air.pressure), plain(air.temperature), plain(air.humidity)))],
      [weather.cloud, nightLine(night, ({ cloud }) => weather.cloudValue(plain(cloud.low), plain(cloud.mid), plain(cloud.high)))],
    );
  } else if (completed) {
    const { pressure, temperature, humidity } = completed.atmosphere.completed;
    rows.push([words.atmosphere, words.atmosphereValue(plain(pressure), plain(temperature), plain(humidity))]);
  }
  if (completed) {
    const { age, snellenRatio, binocular } = completed.observer.completed;
    rows.push([words.observer, words.observerValue(age, plain(snellenRatio), binocular === 1)]);
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

// A value as Swiss Ephemeris or the weather has it, to at most 0.01, with a
// true minus below 0: 1013.25, 15, −2.8.
const plain = (x) => {
  const rounded = Math.round(x * 100) / 100;
  return `${rounded < 0 ? MINUS : ""}${String(Math.abs(rounded)).replace(".", text().helioscope.decimal)}`;
};

/**
 * @typedef {{ kind: "offer" } | { kind: "asking" } | { kind: "failed", reason: string }
 *   | { kind: "refused", reason: "no-twilight" | "before-1940" | "future" | "not-yet" | "declined" }
 *   | ReturnType<typeof nightWeather>} WeatherCheck
 *   where Check that night's weather stands, as the page keeps it
 * @typedef {import("./core/open-meteo.js").Reading & { hour: string }} Night  a twilight's reading, at its hour in GMT
 */
