// Declinations: the parallels and contra-parallels of Ceres and the dwarf
// planets with a chart's Ascendant, MC and Vertex and its Sun, Moon and
// planets out to Pluto. Nothing here loads the engine or uses a browser API;
// ../helioscope-engine.js is the engine, Swiss Ephemeris's WebAssembly.
//
// The conventions:
//
// - the bodies' geocentric apparent declinations on the true equator of
//   date, from their actual positions, ecliptic latitude included, not from
//   their zodiacal degrees: Eris's orbit is inclined 44° to the ecliptic, and
//   Sedna, Makemake, Haumea and Orcus can be far from it too;
// - the Ascendant, MC and Vertex are points on the ecliptic, so each one's
//   declination is its longitude's, through the true obliquity of the date;
// - the Descendant, IC and anti-Vertex aren't listed: each has the opposite
//   declination of its partner, so a parallel to the Descendant is a
//   contra-parallel to the Ascendant;
// - a parallel is two declinations within the orb of each other, a
//   contra-parallel two within the orb of being opposite, the orb included.
//   Near the equator a pair can be both, and both are listed;
// - the chart's UTC is taken as UT, and the planets are Moshier's, as for
//   parans.
//
// test/declinations.test.js compares the declinations with native Swiss
// Ephemeris's. Where one engine call fails the whole result does: a list of
// contacts with a body missing would look complete.
import { utcFromJulianDay } from "./stellarium-desktop.js";
import { DWARF_PLANETS, END_JD, FIRST_JD, PLANETS, natalMoment } from "./parans.js";

export { DWARF_PLANETS, PLANETS };
export const ANGLES = Object.freeze(["ascendant", "midheaven", "vertex"]);
// What each dwarf planet is compared with, in the order contacts are listed.
export const PARTNERS = Object.freeze([...ANGLES, ...PLANETS]);
export const CONTACTS = Object.freeze(["parallel", "contra-parallel"]);

const CONVENTIONS = "geocentric apparent declinations on the true equator of date; the angles as ecliptic points; " +
  "the Moshier ephemeris, with the UTC as UT";

const refused = (reason) => ({ kind: "refused", reason });
const RADIANS = Math.PI / 180;

/**
 * The declination of a point on the ecliptic, in degrees.
 *
 * @param {number} longitude  its ecliptic longitude, in degrees
 * @param {number} obliquity  the obliquity of the ecliptic, in degrees
 */
export function eclipticDeclination(longitude, obliquity) {
  return Math.asin(Math.sin(obliquity * RADIANS) * Math.sin(longitude * RADIANS)) / RADIANS;
}

/**
 * The declinations of the dwarf planets, the angles and the planets at the
 * chart's moment and place. The engine isn't disposed.
 *
 * Only natal charts with a decided UTC are taken, and not at the poles, where
 * the angles aren't defined.
 *
 * @param {object} chart  a normalized chart, as analyzePage or analyzeEntry gives it
 * @param {import("../helioscope-engine.js").Engine} engine  from createEngine, with the dwarf planets' files
 * @returns {{ kind: "refused", reason: "not-natal" | "needs-offset" | "needs-choice" | "invalid-coordinates"
 *   | "at-pole" | "date-out-of-range" }
 *   | { kind: "failed", point: string, failure: object }
 *   | Declinations}
 */
export function declinations(chart, engine) {
  const moment = natalMoment(chart);
  if (moment.kind === "refused") return moment;
  const { jd, lat, lng } = moment;
  if (jd < FIRST_JD || jd >= END_JD) return refused("date-out-of-range");
  const place = { lat, lng };

  const angles = engine.angles(jd, place);
  if (angles.kind === "failed") return { kind: "failed", point: "angles", failure: angles };
  const { obliquity } = angles;
  const points = {};
  for (const angle of ANGLES) {
    points[angle] = { longitude: angles[angle], declination: eclipticDeclination(angles[angle], obliquity) };
  }
  for (const body of [...DWARF_PLANETS, ...PLANETS]) {
    const found = engine.equatorialPosition(jd, body);
    if (found.kind === "failed") return { kind: "failed", point: body, failure: found };
    points[body] = { rightAscension: found.rightAscension, declination: found.declination };
  }

  const { swissEphemeris, ephemeris, ephemerisFiles = [] } = engine.assumptions;
  return {
    kind: "declinations",
    moment: { jd, utc: utcFromJulianDay(jd) },
    place,
    obliquity,
    points,
    conventions: CONVENTIONS,
    assumptions: {
      swissEphemeris,
      ephemeris,
      // The asteroid files the engine read the dwarf planets from.
      ephemerisFiles: [...ephemerisFiles],
      timeScale: "utc-as-ut",
      angles: { houseSystem: "porphyry", armc: angles.armc },
    },
  };
}

/**
 * Every parallel and contra-parallel of a dwarf planet with one of PARTNERS
 * within the orb, the orb included: by dwarf planet, then by partner, the
 * parallel before the contra-parallel. Each one's orb is how far it is from
 * exact, in degrees.
 *
 * @param {Declinations} result  from declinations
 * @param {number} orb  degrees of declination, more than 0
 * @returns {{ dwarfPlanet: string, partner: string, contact: "parallel" | "contra-parallel", orb: number }[]}
 */
export function declinationContacts(result, orb) {
  if (result?.kind !== "declinations") {
    throw new Error(`declinationContacts needs declinations' result; got ${result?.kind}`);
  }
  if (!(Number.isFinite(orb) && orb > 0)) throw new Error(`declinationContacts needs an orb above 0°; got ${orb}`);
  const contacts = [];
  for (const dwarfPlanet of DWARF_PLANETS) {
    const own = result.points[dwarfPlanet].declination;
    for (const partner of PARTNERS) {
      const other = result.points[partner].declination;
      const gaps = { parallel: Math.abs(own - other), "contra-parallel": Math.abs(own + other) };
      for (const contact of CONTACTS) {
        if (gaps[contact] <= orb) contacts.push({ dwarfPlanet, partner, contact, orb: gaps[contact] });
      }
    }
  }
  return contacts;
}

/**
 * @typedef {{ kind: "declinations", moment: { jd: number, utc: string }, place: { lat: number, lng: number },
 *   obliquity: number,
 *   points: Record<string, { declination: number, longitude?: number, rightAscension?: number }>,
 *   conventions: string, assumptions: object }} Declinations
 *   every angle has its ecliptic longitude, every body its right ascension; all in degrees
 */
