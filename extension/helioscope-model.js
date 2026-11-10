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
// twilight out again with that night's air. Its cloud is shown, never turned
// into a verdict: a bright planet can show through thin high cloud or a gap.
import { natalChartFor, readLink } from "./chart-model.js";
import { ELEVATION_LIMITS, PLANETS, UNDER_THE_BEAMS_LIMITS, classify, visibility } from "./core/helioscope.js";
import { nearestHour, readWeather, weatherRequest } from "./core/open-meteo.js";
import { stellariumUrl } from "./core/stellarium.js";
import { text } from "./messages/index.js";
import { offsetText, viewFor } from "./popup-model.js";

// No elevation given, so the results assume 0 m and say so, and under the
// beams within 15°, as visibility() has them.
export const DEFAULT_SETTINGS = Object.freeze({ elevation: null, underTheBeams: 15 });

// The settings' key in the extension's storage on this computer.
const SETTINGS_KEY = "helioscope-settings";

const MINUS = "−";
const WINDOWS = ["evening", "morning"];

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
 * The planets again with that night's air: the evening twilight worked out
 * with the evening's engine, the morning with the morning's, and the two
 * judged together as visibilities judges them. A twilight with no window
 * can share the other's engine, since a window's bounds don't depend on the
 * air.
 *
 * @param {object} chart  a normalized chart
 * @param {{ evening: import("./helioscope-engine.js").Engine, morning: import("./helioscope-engine.js").Engine }} engines
 * @param {{ elevation: number | null, underTheBeams: number }} settings
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
 * middle of each twilight, from the months they fall in. A twilight's bounds
 * are the Sun's, the same for every planet. null for a twilight with no window.
 *
 * @param {object} chart  a normalized chart
 * @param {Record<string, object>} results  from visibilities
 * @param {string} today  the UTC date, "YYYY-MM-DD"
 * @returns {{ kind: "request", url: string, hours: { evening: string | null, morning: string | null } }
 *   | { kind: "refused", reason: "no-twilight" | "before-1940" | "future" }}
 */
export function weatherRequestFor(chart, results, today) {
  const hours = {};
  for (const name of WINDOWS) {
    const bounded = PLANETS.map((planet) => results[planet].windows[name]).find((window) => window.start && window.end);
    hours[name] = bounded ? nearestHour(new Date((Date.parse(bounded.start.utc) + Date.parse(bounded.end.utc)) / 2).toISOString()) : null;
  }
  const wanted = WINDOWS.map((name) => hours[name]).filter((hour) => hour !== null);
  if (wanted.length === 0) return { kind: "refused", reason: "no-twilight" };
  const request = weatherRequest(chart, wanted, today);
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
 * That night's weather at each twilight's hour, from Open-Meteo's answer.
 * Every twilight with a window needs its reading: a night ERA5 hasn't reached
 * yet is refused rather than half shown.
 *
 * @param {unknown} answer  Open-Meteo's JSON
 * @param {{ evening: string | null, morning: string | null }} hours  from weatherRequestFor
 * @param {string} today  the UTC date it was asked on, for the credit
 * @returns {{ kind: "weather", year: string, evening: Night | null, morning: Night | null }
 *   | { kind: "refused", reason: "not-yet" } | { kind: "failed", reason: "unexpected-answer" }}
 */
export function nightWeather(answer, hours, today) {
  const wanted = WINDOWS.map((name) => hours[name]).filter((hour) => hour !== null);
  const read = readWeather(answer, wanted);
  if (read.kind === "failed") return read;
  const night = {};
  for (const name of WINDOWS) {
    const hour = hours[name];
    if (hour !== null && read.at[hour] === null) return { kind: "refused", reason: "not-yet" };
    night[name] = hour === null ? null : { hour, ...read.at[hour] };
  }
  return { kind: "weather", year: today.slice(0, 4), ...night };
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
  const planets = list.map((result) => planetRow(result, chart));
  // What a Stellarium Web link sends, said once, when there's a link to say it of.
  const linksNote = planets.some(({ link }) => link !== null) ? [words.linksNote] : [];
  const night = weather.kind === "weather" ? weather : null;
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
    const cloud = (night) => {
      const time = when(`${night.hour}:00Z`, chart);
      return night.cloud.total === 0 ? words.clearAt(time) : words.cloudAt(plain(night.cloud.total), time);
    };
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
  if (weather.kind === "failed") return { ...offer, message: words.failed, code: weather.reason };
  if (weather.reason === "declined") return { ...offer, message: words.refusals.declined };
  return { kind: "unavailable", message: Object.hasOwn(words.refusals, weather.reason) ? words.refusals[weather.reason] : words.failed };
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
// magnitudes themselves are in its details.
function predictionFor({ classification, windows }, chart) {
  const words = text().helioscope;
  const { kind } = classification;
  const label = words.predictions[kind];
  if (kind === "detectable" || kind === "undetectable") {
    const window = classification.window;
    const time = when(windows[window].best.utc, chart);
    const ratio = times(classification.margin);
    if (kind === "undetectable") return { kind, label, detail: words.tooFaintAt(words.windows[window], time, ratio) };
    const other = window === "evening" ? "morning" : "evening";
    const second = windows[other];
    const both = second.kind === "evaluated" && second.best.margin > 0;
    const detail = words.visibleAt(words.windows[window], time, ratio);
    return { kind, label, detail: both ? `${detail}${words.alsoVisible(words.windows[other])}` : detail };
  }
  if (kind === "below-horizon") return { kind, label, detail: words.belowBoth };
  if (kind === "indeterminate") return { kind, label, detail: noWindowText(windows) };
  return { kind, label, detail: text().view.code(classification.reason) };
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
