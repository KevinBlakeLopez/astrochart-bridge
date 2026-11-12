// What the declinations page works out: the declinations of a chart's dwarf
// planets, angles and planets at its moment, from core/declinations.js, the
// dwarf planets' parallels and contra-parallels within the page's orb, and
// the screen drawn from them. The chart arrives in the page's link, read as
// the parans page reads one, and the dwarf planets come from the same files.
//
// Declinations are said in degrees and minutes, north or south, as charts
// print them; an orb in degrees and minutes too.
import { DWARF_PLANETS, PLANETS, ANGLES, declinationContacts, declinations } from "./core/declinations.js";
import { text } from "./messages/index.js";
import { viewFor } from "./popup-model.js";

export { EPHEMERIS_FILES, chartFromLink } from "./parans-model.js";

// Degrees of declination.
export const ORBS = Object.freeze([0.5, 1, 1.5]);
export const DEFAULT_SETTINGS = Object.freeze({ orb: 1 });

// The settings' key in the extension's storage on this computer.
const SETTINGS_KEY = "declinations-settings";

/**
 * The chart's declinations, and the contacts within the settings' orb.
 *
 * @param {object} chart  a normalized chart
 * @param {import("./helioscope-engine.js").Engine} engine  with the dwarf planets' files
 * @param {Settings} settings
 * @returns {{ kind: "declinations", result: import("./core/declinations.js").Declinations, contacts: Contact[] }
 *   | { kind: "refused", reason: string } | { kind: "failed", point: string, failure: object }}
 *   declinations' refusal or failure as it gave it
 */
export function declinationsFor(chart, engine, { orb }) {
  if (!ORBS.includes(orb)) throw new Error(`declinationsFor takes an orb from ${ORBS.join(", ")}; got ${orb}`);
  const result = declinations(chart, engine);
  if (result.kind !== "declinations") return result;
  return { kind: "declinations", result, contacts: declinationContacts(result, orb) };
}

/**
 * The screen for a chart's declinations: the chart screen's own rows, then
 * the contacts, by dwarf planet, every declination and the assumptions, each
 * closed until opened, and the notes.
 *
 * @param {object} chart  a normalized chart
 * @param {{ result: import("./core/declinations.js").Declinations, contacts: Contact[] }} worked  from declinationsFor
 * @param {Settings} settings  the ones declinationsFor was given
 * @returns {{ state: "ready", rows: [string, string][],
 *   contacts: { heading: string, columns: { contact: string, orb: string }, rows: object[], none: string | null },
 *   declinations: { heading: string, rows: [string, string][] },
 *   assumptions: { heading: string, rows: [string, string][] }, notes: string[] }}
 */
export function viewForDeclinations(chart, { result, contacts }, { orb }) {
  const words = text().declinations;
  const { points } = result;
  return {
    state: "ready",
    rows: viewFor(chart).rows,
    contacts: {
      heading: words.withinOrb(orbLabel(orb)),
      columns: { ...words.columns },
      rows: contacts.map(({ dwarfPlanet, partner, contact, orb: off }) => ({
        pair: words.pair(words.names[dwarfPlanet], words.names[partner]),
        contact: words.contacts[contact],
        orb: degreesAndMinutes(off),
        declinations: words.both(declination(points[dwarfPlanet].declination), declination(points[partner].declination)),
      })),
      none: contacts.length === 0 ? words.none(orbLabel(orb)) : null,
    },
    declinations: {
      heading: words.declinationsHeading,
      rows: [...DWARF_PLANETS, ...ANGLES, ...PLANETS].map((point) => [words.names[point], declination(points[point].declination)]),
    },
    assumptions: { heading: words.assumptionsHeading, rows: assumptionRows(result, orb) },
    notes: [words.mirrorNote],
  };
}

/**
 * The screen for a page with nothing to work out: no chart in its link, a
 * link or chart that's refused, or Swiss Ephemeris failing to start. A
 * refusal keeps its code on screen, as the popup's do.
 *
 * @param {string | null} reason  a link's or declinations's, or "engine-failed"; null for no chart
 * @returns {{ state: "empty", message: string } | { state: "refused", message: string, code: string }}
 */
export function viewForRefusal(reason) {
  const words = text().declinations;
  if (reason === null) return { state: "empty", message: words.empty };
  const fromLink = text().chart.refusals.link;
  let message = words.refusals.other;
  if (Object.hasOwn(words.refusals, reason)) message = words.refusals[reason];
  else if (Object.hasOwn(fromLink, reason)) message = fromLink[reason];
  return { state: "refused", message, code: reason };
}

/**
 * The screen for one of Swiss Ephemeris's calls failing, which fails the
 * whole result: a list of contacts with a body missing would look complete.
 *
 * @param {{ point: string, failure: { reason: string } }} failed  from declinationsFor
 * @returns {{ state: "refused", message: string, code: string }}
 */
export function viewForFailure({ point, failure }) {
  const words = text().declinations;
  const message = point === "angles" ? words.anglesFailed : words.failed(point);
  return { state: "refused", message, code: failure.reason };
}

// How the declinations were worked out, then the orb. Where the dwarf
// planets come from, and the angles' obliquity, as for parans.
function assumptionRows({ obliquity, assumptions }, orb) {
  const words = text().declinations.assumptions;
  return [
    [words.ephemeris, words.ephemerisValue(assumptions.swissEphemeris)],
    [words.dwarfPlanets, words.dwarfPlanetsValue],
    [words.time, words.timeValue],
    [words.position, words.positionValue],
    [words.angles, words.anglesValue(degreesAndMinutes(obliquity))],
    [words.orb, words.orbValue(orbLabel(orb))],
  ];
}

// Whole arcminutes of x degrees, x 0 or more, as degrees and minutes:
// 23.4377 is 23°26′, 0.9983 is 1°00′, never 0°60′.
function degreesAndMinutes(degrees) {
  const minutes = Math.round(Math.abs(degrees) * 60);
  return `${Math.floor(minutes / 60)}°${String(minutes % 60).padStart(2, "0")}′`;
}

// A declination as charts print it: 7°10′ S, 23°26′ N, and 0°00′ with no
// side when it rounds to the equator.
function declination(degrees) {
  const words = text().declinations;
  const said = degreesAndMinutes(degrees);
  if (Math.round(Math.abs(degrees) * 60) === 0) return said;
  return words.side(said, degrees > 0 ? "north" : "south");
}

/**
 * An orb as its radio button says it, with the language's decimal mark: "0.5°", "0,5°".
 *
 * @param {number} orb  one of ORBS
 */
export const orbLabel = (orb) => `${String(orb).replace(".", text().declinations.decimal)}°`;

/**
 * The page's settings, as the user last left them on this computer.
 *
 * @param {chrome.storage.StorageArea} storage  chrome.storage.local, or a stand-in in tests
 * @returns {Promise<Settings>}  DEFAULT_SETTINGS until the user chooses
 */
export async function declinationsSettings(storage) {
  const { [SETTINGS_KEY]: stored } = await storage.get(SETTINGS_KEY);
  return settingsFrom(stored);
}

/**
 * Keeps the page's settings, or forgets them when they're the defaults again.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {Settings} settings
 */
export async function setDeclinationsSettings(storage, settings) {
  const kept = settingsFrom(settings);
  if (kept.orb === DEFAULT_SETTINGS.orb) await storage.remove(SETTINGS_KEY);
  else await storage.set({ [SETTINGS_KEY]: kept });
}

// The stored orb, or the default where it doesn't fit: storage can hold
// anything an older version or a hand edit left there.
function settingsFrom(value) {
  return { orb: ORBS.includes(value?.orb) ? value.orb : DEFAULT_SETTINGS.orb };
}

/**
 * @typedef {{ orb: number }} Settings  degrees of declination, one of ORBS
 * @typedef {ReturnType<typeof declinationContacts>[number]} Contact
 */
