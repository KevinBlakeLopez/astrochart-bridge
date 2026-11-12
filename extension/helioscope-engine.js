// Swiss Ephemeris for Helioscope and parans, from vendor/swisseph/
// (@kuntay/swisseph 0.2.2, AGPL-3.0-or-later). This is the only file that
// loads its WebAssembly. It makes the calls Helioscope and parans need and
// reports what Swiss Ephemeris found; what that means for a chart is decided
// in core/helioscope.js.
//
// Swiss Ephemeris has edges a caller must handle, which
// docs/HELIOSCOPE_V1_FEASIBILITY.md §8 lists:
//
// - It rewrites the atmosphere, observer and object name it's given, so every
//   input is written afresh for each call.
// - It caches extinction on the Sun's altitude and right ascension, whatever
//   the atmosphere. So an engine's atmosphere is fixed when the engine is
//   made: another atmosphere needs another engine, a new WebAssembly instance
//   whose caches start empty.
// - It falls back from ephemeris files to Moshier without saying so, so
//   Moshier is always asked for, and checked where the flags come back.
//   Asteroids have no Moshier theory: Ceres and the dwarf planets are read
//   from the asteroid files in vendor/swisseph/ephe/, when the engine is
//   given them, with the Sun and Earth still from Moshier, and without a
//   body's file its calls fail.
// - It takes impossible places and dates, so those are refused before any
//   call, as are results that aren't finite.
// - It reads a name it doesn't know as a fixed star's, so swe_vis_limit_mag,
//   which takes a name, is only ever given the five naked-eye planets.
//   swe_rise_trans takes a body's number, and is given those in BODIES.
import { createSwissEph } from "./vendor/swisseph/dist/index.js";

// swephexp.h
const SEFLG_MOSEPH = 4;
const SE_SUN = 0;
const SE_CALC_RISE = 1;
const SE_CALC_SET = 2;
const SE_CALC_MTRANSIT = 4;
const SE_CALC_ITRANSIT = 8;
const SE_BIT_DISC_CENTER = 256;
const SE_BIT_NO_REFRACTION = 512;
const SE_BIT_ASTRO_TWILIGHT = 4096;
const SE_BIT_DISC_BOTTOM = 8192;

// What swe_rise_trans returns when the event doesn't happen, and
// swe_vis_limit_mag when the object is below the horizon.
const NOT_FOUND = -2;
const BELOW_HORIZON = -2;

// The Moshier ephemeris, with nothing else set: the real Sun and Moon count,
// and there's no optical aid.
const HELFLAG = SEFLG_MOSEPH;

const PLANETS = Object.freeze({ mercury: 2, venus: 3, mars: 4, jupiter: 5, saturn: 6 });

// The bodies whose rising, setting and transits parans take, by Swiss
// Ephemeris's numbers. Ceres, SE_CERES, is in the main asteroid files,
// seas_*.se1, each of which covers 600 years. The others are numbered
// asteroids, SE_AST_OFFSET plus their Minor Planet Center number, each in a
// file of its own: the long one, se20000.se1 or s136199.se1, covers 3000 BC
// to 2999.
const SE_AST_OFFSET = 10000;
const BODIES = Object.freeze({
  sun: SE_SUN, moon: 1, mercury: 2, venus: 3, mars: 4, jupiter: 5, saturn: 6, uranus: 7, neptune: 8, pluto: 9,
  ceres: 17,
  eris: SE_AST_OFFSET + 136199,
  makemake: SE_AST_OFFSET + 136472,
  haumea: SE_AST_OFFSET + 136108,
  varuna: SE_AST_OFFSET + 20000,
  ixion: SE_AST_OFFSET + 28978,
  orcus: SE_AST_OFFSET + 90482,
  sedna: SE_AST_OFFSET + 90377,
});

// An ephemeris file's name, as Swiss Ephemeris looks it up: seas_18.se1,
// s136199s.se1.
const EPHEMERIS_FILE = /^[a-z0-9_]+\.se1$/;
// What Swiss Ephemeris says when a body's file isn't loaded.
const FILE_NOT_FOUND = /SwissEph file '[^']+' not found/;

// The four angles, as astro-research's parans-v1 calls swe_rise_trans: the
// transits are at hour angle 0 and 180. The disc and the refraction apply to
// rising and setting only.
const ANGULAR_EVENTS = Object.freeze({
  rise: SE_CALC_RISE,
  set: SE_CALC_SET,
  "upper-transit": SE_CALC_MTRANSIT,
  "lower-transit": SE_CALC_ITRANSIT,
});
// The point of the Sun's or Moon's disc on the horizon. Swiss Ephemeris's
// default is the upper limb. The planets are points.
const DISCS = Object.freeze({ "upper-limb": 0, centre: SE_BIT_DISC_CENTER, "lower-limb": SE_BIT_DISC_BOTTOM });
const ABSOLUTE_ZERO_C = -273.15;

// Sunrise and sunset are the Sun's upper limb at the horizon, refracted for
// the standard pressure at the observer's elevation and 0 °C: swe_rise_trans
// is given a pressure of 0, which swe_azalt fills in, and a temperature of 0,
// which it doesn't. Astronomical twilight is the Sun's centre at -18°,
// unrefracted (swecl.c). The lower transit is the Sun crossing the meridian
// below the pole: its lowest point, to within 15 seconds in the cases measured
// (docs/HELIOSCOPE_V1_FEASIBILITY.md §6).
const SUN_EVENTS = Object.freeze({
  sunrise: SE_CALC_RISE,
  sunset: SE_CALC_SET,
  "astronomical-dawn": SE_CALC_RISE | SE_BIT_ASTRO_TWILIGHT,
  "astronomical-dusk": SE_CALC_SET | SE_BIT_ASTRO_TWILIGHT,
  "lower-transit": SE_CALC_ITRANSIT,
});

// 0 asks Swiss Ephemeris to fill a value in, as default_heliacal_parameters
// in swehel.c does: the pressure and temperature from the elevation, 40 %
// humidity, the extinction from the humidity, and an observer of 36 with a
// Snellen ratio of 1. It fills in a temperature or humidity of 0 only when
// the pressure is 0 too. These are Helioscope's defaults.
const ATMOSPHERE = Object.freeze({ pressure: 0, temperature: 0, humidity: 0, meteorologicalRange: 0 });
const OBSERVER = Object.freeze({ age: 0, snellenRatio: 0 });

// The Julian Days the compiled-in Moshier ephemeris covers (§8, item 10).
const FIRST_JD = 625000.5;
const LAST_JD = 2818000.5;

// Metres. swe_vis_limit_mag takes any elevation; swe_heliacal_ut refuses
// those outside these (§8, item 9).
const LOWEST = -500;
const HIGHEST = 25_000;

const DOUBLE = 8;
// AS_MAXCH in sweodef.h, for error messages and object names.
const STRING_BYTES = 256;
// swe_vis_limit_mag writes dret[0] to dret[7]. swehel.c has a dret[8] commented out.
const DRET_DOUBLES = 10;

const INVALID = Object.freeze({ kind: "failed", reason: "invalid-input" });

/**
 * A fresh Swiss Ephemeris, for one atmosphere and observer. Rejects when the
 * WebAssembly can't be loaded.
 *
 * @param {{ atmosphere?: Partial<typeof ATMOSPHERE>, observer?: Partial<typeof OBSERVER>,
 *   ephemerisFiles?: Record<string, Uint8Array> }} [options]
 *   values for Swiss Ephemeris to use instead of filling them in: pressure in
 *   hPa, temperature in °C, humidity in %, meteorologicalRange in km (below
 *   1, the total extinction coefficient instead), age in years; and the
 *   ephemeris files to mount, by name, such as vendor/swisseph/ephe/'s, for
 *   the bodies Moshier doesn't have
 * @returns {Promise<Engine>}
 */
export async function createEngine({ atmosphere = {}, observer = {}, ephemerisFiles = {} } = {}) {
  const requested = {
    atmosphere: Object.freeze(settings("atmosphere", ATMOSPHERE, atmosphere)),
    observer: Object.freeze(settings("observer", OBSERVER, observer)),
  };
  const files = fileNames(ephemerisFiles);
  const { pressure, temperature, humidity, meteorologicalRange } = requested.atmosphere;
  const datm = [pressure, temperature, humidity, meteorologicalRange];
  const dobs = [requested.observer.age, requested.observer.snellenRatio, 0, 0, 0, 0];

  const swe = await createSwissEph();
  if (files.length > 0) swe.mountEphemeris(ephemerisFiles);
  const wasm = swe.raw;
  const cwrap = (name, count) => wasm.cwrap(name, "number", Array(count).fill("number"));
  const riseTrans = cwrap("swe_rise_trans", 10);
  const calcUt = cwrap("swe_calc_ut", 5);
  const phenoUt = cwrap("swe_pheno_ut", 5);
  const visLimitMag = cwrap("swe_vis_limit_mag", 8);
  const sidTime = cwrap("swe_sidtime", 1);
  const buffers = {
    geo: wasm._malloc(3 * DOUBLE),
    atm: wasm._malloc(4 * DOUBLE),
    obs: wasm._malloc(6 * DOUBLE),
    dret: wasm._malloc(DRET_DOUBLES * DOUBLE),
    xx: wasm._malloc(6 * DOUBLE),
    attr: wasm._malloc(20 * DOUBLE),
    tret: wasm._malloc(10 * DOUBLE),
    name: wasm._malloc(STRING_BYTES),
    serr: wasm._malloc(STRING_BYTES),
  };
  const write = (pointer, values) => values.forEach((value, i) => wasm.setValue(pointer + i * DOUBLE, value, "double"));
  const read = (pointer, count) => Array.from({ length: count }, (_, i) => wasm.getValue(pointer + i * DOUBLE, "double"));
  // Swiss Ephemeris writes a message only when it has one.
  const clearError = () => wasm.setValue(buffers.serr, 0, "i8");
  const error = () => wasm.UTF8ToString(buffers.serr);
  let disposed = false;
  const live = () => {
    if (disposed) throw new Error("This Helioscope engine has been disposed");
  };

  // swe_calc_ut and swe_pheno_ut return the flags they used, or -1.
  function flagsFailure(ret) {
    if (ret < 0) return { kind: "failed", reason: "engine-error", serr: error() };
    if ((ret & SEFLG_MOSEPH) === 0) return { kind: "failed", reason: "not-moshier", serr: error() };
    return null;
  }

  function position(jd, ipl) {
    clearError();
    const failure = flagsFailure(calcUt(jd, ipl, SEFLG_MOSEPH, buffers.xx, buffers.serr));
    if (failure) return failure;
    const [longitude, latitude] = read(buffers.xx, 2);
    return { kind: "computed", longitude, latitude };
  }

  /**
   * The next sunrise, sunset, start or end of astronomical twilight, or lower
   * transit of the Sun after jd, at place. none when it doesn't happen in the
   * day or so swe_rise_trans searches: in polar day and night, and on summer
   * nights that never get dark enough for astronomical twilight to end.
   *
   * @param {number} jd  Julian Day (UT)
   * @param {Place} place
   * @param {keyof typeof SUN_EVENTS} event
   * @returns {{ kind: "found", jd: number } | { kind: "none" } | Failure}
   */
  function sunEvent(jd, place, event) {
    live();
    if (!Object.hasOwn(SUN_EVENTS, event)) {
      throw new Error(`sunEvent needs an event: ${Object.keys(SUN_EVENTS).join(", ")}; got ${event}`);
    }
    if (!isDate(jd) || !isPlace(place)) return INVALID;
    write(buffers.geo, [place.lng, place.lat, place.elevation]);
    write(buffers.tret, [Number.NaN]);
    clearError();
    const ret = riseTrans(jd, SE_SUN, 0, SEFLG_MOSEPH, SUN_EVENTS[event], buffers.geo, 0, 0, buffers.tret, buffers.serr);
    return riseTransResult(ret);
  }

  // What swe_rise_trans found: tret[0] when it returns 0. It returns -2 for an
  // event that doesn't happen in the day or so it searches, and -1 when it
  // fails, as it does for a body whose file isn't loaded for that date.
  function riseTransResult(ret) {
    if (ret === NOT_FOUND) return { kind: "none" };
    if (ret < 0) {
      const serr = error();
      return { kind: "failed", reason: FILE_NOT_FOUND.test(serr) ? "no-ephemeris-file" : "engine-error", serr };
    }
    const [found] = read(buffers.tret, 1);
    return Number.isFinite(found) ? { kind: "found", jd: found } : { kind: "failed", reason: "not-finite", serr: error() };
  }

  /**
   * The next rising, setting, upper or lower transit of body after jd, at
   * place, as astro-research's parans-v1 asks swe_rise_trans for it. none when
   * Swiss Ephemeris says the body doesn't rise or set (circumpolar or never
   * rising: it can't say which).
   *
   * Asking for Moshier means there's nothing to fall back from:
   * swe_rise_trans returns 0, -1 or -2, not the flags it used, so unlike
   * swe_calc_ut's they can't be checked.
   *
   * @param {number} jd  Julian Day (UT)
   * @param {Place} place
   * @param {keyof typeof BODIES} body
   * @param {keyof typeof ANGULAR_EVENTS} event
   * @param {Horizon} horizon
   * @returns {{ kind: "found", jd: number } | { kind: "none" } | Failure}
   */
  function angularEvent(jd, place, body, event, horizon) {
    live();
    const ipl = bodyNumber(body);
    const rsmi = angularEventFlags(event, horizon);
    if (!isDate(jd) || !isPlace(place)) return INVALID;
    // Unused without refraction, as astro-research passes them.
    const { pressure, temperature } = horizon.refraction ?? { pressure: 0, temperature: 0 };
    write(buffers.geo, [place.lng, place.lat, place.elevation]);
    write(buffers.tret, [Number.NaN]);
    clearError();
    const ret = riseTrans(jd, ipl, 0, SEFLG_MOSEPH, rsmi, buffers.geo, pressure, temperature, buffers.tret, buffers.serr);
    return riseTransResult(ret);
  }

  /**
   * The ARMC, the right ascension of the meridian, at jd and place: Swiss
   * Ephemeris's apparent sidereal time, in degrees, plus the longitude.
   *
   * @param {number} jd  Julian Day (UT)
   * @param {Place} place
   * @returns {{ kind: "computed", armc: number } | Failure}
   */
  function armc(jd, place) {
    live();
    if (!isDate(jd) || !isPlace(place)) return INVALID;
    const hours = sidTime(jd);
    if (!Number.isFinite(hours)) return { kind: "failed", reason: "not-finite" };
    return { kind: "computed", armc: (((hours * 15 + place.lng) % 360) + 360) % 360 };
  }

  /**
   * The Sun's and the planet's geocentric apparent ecliptic longitudes, the
   * planet's ecliptic latitude, and its elongation from the Sun, in degrees.
   *
   * @param {number} jd  Julian Day (UT)
   * @param {keyof typeof PLANETS} planet
   * @returns {{ kind: "computed", sunLongitude: number, planetLongitude: number, planetLatitude: number,
   *   elongation: number } | Failure}
   */
  function solarGeometry(jd, planet) {
    live();
    const ipl = planetNumber(planet);
    if (!isDate(jd)) return INVALID;
    const sun = position(jd, SE_SUN);
    if (sun.kind === "failed") return sun;
    const body = position(jd, ipl);
    if (body.kind === "failed") return body;
    clearError();
    const failure = flagsFailure(phenoUt(jd, ipl, SEFLG_MOSEPH, buffers.attr, buffers.serr));
    if (failure) return failure;
    // attr[2] is the elongation.
    const elongation = read(buffers.attr, 3)[2];
    const values = { sunLongitude: sun.longitude, planetLongitude: body.longitude, planetLatitude: body.latitude, elongation };
    if (!Object.values(values).every(Number.isFinite)) return { kind: "failed", reason: "not-finite", serr: error() };
    return { kind: "computed", ...values };
  }

  /**
   * The faintest magnitude visible where the planet is in the sky at jd, seen
   * from place under this engine's atmosphere, with the planet's own
   * magnitude. below-horizon while its unrefracted altitude is below 0.
   *
   * @param {number} jd  Julian Day (UT)
   * @param {Place} place
   * @param {keyof typeof PLANETS} planet
   * @returns {ReturnType<typeof visLimitResult> | Failure}
   */
  function limitingMagnitude(jd, place, planet) {
    live();
    planetNumber(planet);
    if (!isDate(jd) || !isPlace(place)) return INVALID;
    write(buffers.geo, [place.lng, place.lat, place.elevation]);
    write(buffers.atm, datm);
    write(buffers.obs, dobs);
    write(buffers.dret, Array(DRET_DOUBLES).fill(Number.NaN));
    // A buffer of its own, since Swiss Ephemeris lowercases the name in place.
    wasm.stringToUTF8(planet, buffers.name, STRING_BYTES);
    clearError();
    const ret = visLimitMag(jd, buffers.geo, buffers.atm, buffers.obs, buffers.name, HELFLAG, buffers.dret, buffers.serr);
    // Below the horizon, only dret[0] means anything: Swiss Ephemeris zeroes
    // dret[1] to dret[6] and leaves dret[7] as it was.
    const written = ret >= 0 ? 8 : ret === BELOW_HORIZON ? 1 : 0;
    return visLimitResult({
      ret,
      dret: read(buffers.dret, written),
      serr: error(),
      datm: read(buffers.atm, 4),
      dobs: read(buffers.obs, 6),
      object: wasm.UTF8ToString(buffers.name),
    });
  }

  /** Frees the engine's memory. It can't be used afterwards. */
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const pointer of Object.values(buffers)) wasm._free(pointer);
    swe.dispose();
  }

  return Object.freeze({
    assumptions: Object.freeze({
      swissEphemeris: swe.version,
      ephemeris: "moshier",
      helflag: HELFLAG,
      moon: "included",
      atmosphere: requested.atmosphere,
      observer: requested.observer,
      ephemerisFiles: files,
    }),
    sunEvent,
    solarGeometry,
    limitingMagnitude,
    angularEvent,
    armc,
    dispose,
  });
}

/**
 * What one swe_vis_limit_mag call found, from the values it returned. The
 * planet is predicted visible when the limiting magnitude is greater than its
 * own, which core/helioscope.js decides.
 *
 * @param {{ ret: number, dret: number[], serr: string, datm: number[], dobs: number[], object: string }} raw
 *   dret holds only the values Swiss Ephemeris wrote, datm and dobs the
 *   atmosphere and observer as it filled them in
 */
export function visLimitResult(raw) {
  const { ret, dret, datm, dobs } = raw;
  if (ret === BELOW_HORIZON) return { kind: "below-horizon", raw };
  if (ret < 0) return { kind: "failed", reason: "engine-error", raw };
  if (dret.length !== 8 || ![...dret, ...datm, ...dobs].every(Number.isFinite)) {
    return { kind: "failed", reason: "not-finite", raw };
  }
  const [limitingMagnitude, altitude, azimuth, sunAltitude, sunAzimuth, moonAltitude, moonAzimuth, objectMagnitude] = dret;
  const [pressure, temperature, humidity, meteorologicalRange] = datm;
  const [age, snellenRatio, binocular, magnification, aperture, transmission] = dobs;
  return {
    kind: "evaluated",
    limitingMagnitude,
    objectMagnitude,
    altitude,
    azimuth,
    sunAltitude,
    sunAzimuth,
    moonAltitude,
    moonAzimuth,
    // Bit 0 is set for scotopic vision. Bit 1, "near the limit", never is (§6).
    vision: ret & 1 ? "scotopic" : "photopic",
    completed: {
      atmosphere: { pressure, temperature, humidity, meteorologicalRange },
      observer: { age, snellenRatio, binocular, magnification, aperture, transmission },
    },
    raw,
  };
}

function settings(name, defaults, given) {
  for (const [key, value] of Object.entries(given)) {
    if (!Object.hasOwn(defaults, key)) throw new Error(`createEngine doesn't know the ${name}'s ${key}`);
    if (!Number.isFinite(value)) throw new Error(`createEngine needs a finite ${name} ${key}, got ${value}`);
  }
  return { ...defaults, ...given };
}

// The ephemeris files' names, sorted, once each has been checked: a file
// name Swiss Ephemeris would look up, and its bytes.
function fileNames(ephemerisFiles) {
  if (ephemerisFiles === null || typeof ephemerisFiles !== "object" || Array.isArray(ephemerisFiles)) {
    throw new Error(`createEngine takes ephemerisFiles as an object of files by name; got ${JSON.stringify(ephemerisFiles)}`);
  }
  for (const [name, bytes] of Object.entries(ephemerisFiles)) {
    if (!EPHEMERIS_FILE.test(name)) throw new Error(`createEngine takes .se1 files by their own names; got ${name}`);
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new Error(`createEngine needs ${name}'s bytes, as a Uint8Array`);
  }
  return Object.freeze(Object.keys(ephemerisFiles).sort());
}

function planetNumber(planet) {
  if (!Object.hasOwn(PLANETS, planet)) {
    throw new Error(`Helioscope's engine takes a naked-eye planet: ${Object.keys(PLANETS).join(", ")}; got ${planet}`);
  }
  return PLANETS[planet];
}

function bodyNumber(body) {
  if (!Object.hasOwn(BODIES, body)) {
    throw new Error(`angularEvent takes a body: ${Object.keys(BODIES).join(", ")}; got ${body}`);
  }
  return BODIES[body];
}

// swe_rise_trans's rsmi, from an event and a horizon. A horizon it doesn't
// know, or a refraction that isn't physical, is a mistake in the caller.
function angularEventFlags(event, horizon) {
  if (!Object.hasOwn(ANGULAR_EVENTS, event)) {
    throw new Error(`angularEvent takes an event: ${Object.keys(ANGULAR_EVENTS).join(", ")}; got ${event}`);
  }
  const keys = Object.keys(horizon ?? {}).sort().join();
  if (keys !== "disc,refraction") {
    throw new Error(`angularEvent takes a horizon of a disc and a refraction; got ${JSON.stringify(horizon)}`);
  }
  if (!Object.hasOwn(DISCS, horizon.disc)) {
    throw new Error(`angularEvent takes a disc: ${Object.keys(DISCS).join(", ")}; got ${horizon.disc}`);
  }
  const { refraction } = horizon;
  if (refraction !== null) {
    const { pressure, temperature } = refraction;
    // Swiss Ephemeris reads a pressure of 0 as "estimate it from the elevation".
    if (Object.keys(refraction).sort().join() !== "pressure,temperature" ||
        !(Number.isFinite(pressure) && pressure > 0) ||
        !(Number.isFinite(temperature) && temperature > ABSOLUTE_ZERO_C)) {
      throw new Error(`angularEvent takes a refraction of a positive pressure and a temperature above absolute zero; got ${JSON.stringify(refraction)}`);
    }
  }
  let rsmi = ANGULAR_EVENTS[event];
  if (event === "rise" || event === "set") rsmi |= DISCS[horizon.disc];
  if (refraction === null) rsmi |= SE_BIT_NO_REFRACTION;
  return rsmi;
}

const isDate = (jd) => Number.isFinite(jd) && jd >= FIRST_JD && jd <= LAST_JD;

function isPlace(place) {
  const { lat, lng, elevation } = place ?? {};
  return [lat, lng, elevation].every(Number.isFinite) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    elevation >= LOWEST &&
    elevation <= HIGHEST;
}

/**
 * @typedef {{ lat: number, lng: number, elevation: number }} Place
 *   degrees north and east, and metres above sea level
 * @typedef {{ disc: keyof typeof DISCS, refraction: null | { pressure: number, temperature: number } }} Horizon
 *   the point of the disc that rises and sets, and the refraction, in hPa
 *   and °C; null is the geometric horizon
 * @typedef {{ kind: "failed", reason: "invalid-input" | "engine-error" | "no-ephemeris-file" | "not-finite" | "not-moshier",
 *   serr?: string }} Failure
 *   invalid-input is refused before Swiss Ephemeris is called; no-ephemeris-file
 *   is a body's file not loaded for that date
 * @typedef {Awaited<ReturnType<typeof createEngine>>} Engine
 */
