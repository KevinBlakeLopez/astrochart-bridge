// What the parans page works out: the angular events of the chosen bodies
// around a chart's moment, from core/parans.js, and the pairs of them close
// enough to count as parans with the page's settings. The chart arrives in
// the page's link, read as the receiving page reads one. Nothing here has
// words in it yet; the screen's text comes with the page.
//
// A paran here is two events of two different bodies whose ARMCs are within
// the orb, at most 12 hours apart. The ARMC gap is wrapped into
// (-180, 180], so two events nearly a sidereal day apart have nearly the same
// ARMC; the 12 hours keep those out, since they aren't the same moment of the
// day. Both are this page's rule: astro-research's parans-v1 has no orb.
import { natalChartFor, readLink } from "./chart-model.js";
import { BODIES, ELEVATION_LIMITS, angularEvents, paranGaps } from "./core/parans.js";

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

// A 1° orb, every body, the geometric horizon and no elevation given, so
// the results assume 0 m and say so.
export const DEFAULT_SETTINGS = Object.freeze({ orb: 1, bodies: BODIES, horizon: "geometric", elevation: null });

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
export function paransFor(chart, engine, { orb, bodies, horizon, elevation }) {
  if (!Array.isArray(bodies) || bodies.length < 2) throw new Error(`paransFor needs two bodies or more; got ${JSON.stringify(bodies)}`);
  if (!Object.hasOwn(HORIZONS, horizon)) throw new Error(`paransFor takes a horizon from ${Object.keys(HORIZONS).join(", ")}; got ${horizon}`);
  const options = { bodies: BODIES.filter((body) => bodies.includes(body)), horizon: HORIZONS[horizon] };
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
  // Kept bodies are distinct and known, so as many as BODIES is all of them.
  const isDefault =
    kept.orb === DEFAULT_SETTINGS.orb &&
    kept.bodies.length === DEFAULT_SETTINGS.bodies.length &&
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
    horizon: typeof value?.horizon === "string" && Object.hasOwn(HORIZONS, value.horizon) ? value.horizon : DEFAULT_SETTINGS.horizon,
    elevation: fits(value?.elevation) ? value.elevation : DEFAULT_SETTINGS.elevation,
  };
}

// Two bodies or more, each once, each one angularEvents knows.
const someBodies = (bodies) =>
  Array.isArray(bodies) && bodies.length >= 2 && new Set(bodies).size === bodies.length && bodies.every((body) => BODIES.includes(body));

const fits = (metres) => Number.isInteger(metres) && metres >= ELEVATION_LIMITS.lowest && metres <= ELEVATION_LIMITS.highest;

/**
 * @typedef {{ orb: number, bodies: string[], horizon: keyof typeof HORIZONS, elevation: number | null }} Settings
 *   elevation is null when none was given
 * @typedef {ReturnType<typeof paranGaps>[number]} Paran
 */
