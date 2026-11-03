/**
 * The public constants.
 *
 * Every numeric value comes from `generated/constants.ts`, which is produced
 * from `swephexp.h` — so a transcription error is impossible and an upstream
 * version bump carries the values across on its own.
 *
 * This file only improves the **names**. The generated ones are mechanical
 * transforms of C macros (`Helctr`, `Nonut`, `MeanApog`) and make for a poor
 * public API. Both spellings work: the generated names are spread in, then
 * readable aliases are added alongside them.
 */
import { Body as RawBody, Flag as RawFlag, Calendar as RawCalendar, HouseSystem as RawHouseSystem, } from './generated/constants.js';
export { Ayanamsa, HOUSE_SYSTEM_NAMES, HOUSE_SYSTEM_ALIASES, AsteroidOffset, FictitiousOffset, PlanetMoonOffset, RiseTransit, EclipseFlag, HeliacalEvent, HeliacalFlag, EclipticNutationId, } from './generated/constants.js';
/**
 * Celestial bodies.
 *
 * "Lilith" names three different things in astrology and they are constantly
 * confused. All three are here, under names that tell them apart:
 *
 *   `BlackMoonLilithMean` — the mean lunar apogee. **Not** a body. This is
 *                           what most astrology software calls "Lilith".
 *   `BlackMoonLilithTrue` — the osculating (true) apogee. A different answer.
 *   Asteroid 1181         — an actual asteroid: `AsteroidOffset + 1181`.
 *
 * The three give completely different positions.
 *
 * **Not every body in this enum behaves like a planet.** `Chiron`, `Pholus`,
 * `Ceres`, `Pallas`, `Juno` and `Vesta` need `seas_18.se1` and **throw** when
 * it is absent, where the planets fall back to Moshier. They sit next to
 * `Pluto` with nothing in the type to distinguish them, so a loop over "all
 * the bodies" works in Moshier mode until it reaches Chiron. Filter with
 * {@link REQUIRES_EPHEMERIS_FILE}.
 */
export const Body = {
    ...RawBody,
    BlackMoonLilithMean: RawBody.MeanApog,
    BlackMoonLilithTrue: RawBody.OscuApog,
    InterpolatedApogee: RawBody.IntpApog,
    InterpolatedPerigee: RawBody.IntpPerg,
    /** The Moon's mean north node (Rahu). */
    NorthNodeMean: RawBody.MeanNode,
    /** The Moon's true (osculating) north node. */
    NorthNodeTrue: RawBody.TrueNode,
};
/**
 * The bodies that need an ephemeris file and **throw** without one.
 *
 * Swiss Ephemeris has an analytic theory (Moshier) for the Sun through Pluto,
 * so those degrade quietly to lower precision when `sepl_*.se1` is missing —
 * check `Position.ephemeris` to see which you got. There is no analytic theory
 * for the asteroids, so for these there is nothing to degrade to: the call
 * raises.
 *
 * That difference is invisible in the type. `Body.Chiron` sits beside
 * `Body.Pluto` and nothing says one of them behaves differently, so this set is
 * the machine-readable form of the distinction — preferable to a documentation
 * note, which a loop cannot read:
 *
 * ```ts
 * const safe = bodies.filter((b) => !REQUIRES_EPHEMERIS_FILE.has(b));
 * ```
 *
 * Numbered asteroids (`AsteroidOffset + n`) need their own file each and are
 * not listed; they are covered by `BUILT_IN_ASTEROIDS` and `asteroidFile()`.
 */
export const REQUIRES_EPHEMERIS_FILE = new Set([
    Body.Chiron,
    Body.Pholus,
    Body.Ceres,
    Body.Pallas,
    Body.Juno,
    Body.Vesta,
]);
/**
 * `swe_calc()` flags, combined as a bit mask.
 *
 * The ephemeris choices (Swiss / Moshier / JPL) are mutually exclusive —
 * pass at most one. With none, Swiss Ephemeris is assumed and falls back to
 * Moshier when the files are absent.
 */
export const Flag = {
    ...RawFlag,
    // --- efemeris kaynağı ---
    /** The `.se1` files. Falls back to Moshier, silently, when absent. */
    SwissEphemeris: RawFlag.Swieph,
    /** Analytic theory, no files needed. Always available. */
    Moshier: RawFlag.Moseph,
    /** A raw JPL file (`de441.eph` and friends). Node only, 2.6 GB. */
    JplEphemeris: RawFlag.Jpleph,
    // --- koordinat çerçevesi ---
    Heliocentric: RawFlag.Helctr,
    Barycentric: RawFlag.Baryctr,
    Topocentric: RawFlag.Topoctr,
    /** Equatorial instead of ecliptic coordinates (right ascension / declination). */
    Equatorial: RawFlag.Equatorial,
    /** Cartesian x/y/z instead of spherical. */
    Cartesian: RawFlag.Xyz,
    Radians: RawFlag.Radians,
    // --- konum düzeltmeleri ---
    /** No light-time or aberration correction — the geometric (true) position. */
    TruePosition: RawFlag.Truepos,
    NoNutation: RawFlag.Nonut,
    NoGravitationalDeflection: RawFlag.Nogdefl,
    NoAberration: RawFlag.Noaberr,
    J2000Equinox: RawFlag.J2000,
    // --- zodyak ---
    /** The sidereal zodiac, used together with `setSiderealMode()`. */
    Sidereal: RawFlag.Sidereal,
    /** Also compute speeds. Cheap, and usually wanted. */
    Speed: RawFlag.Speed,
};
export const Calendar = { ...RawCalendar };
export const HouseSystem = { ...RawHouseSystem };
/** Indices into the `ascmc` array of `swe_houses_ex2()` (swephexp.h:164–172). */
export const ASCMC = {
    Ascendant: 0,
    Midheaven: 1,
    Armc: 2,
    Vertex: 3,
    EquatorialAscendant: 4,
    CoAscendantKoch: 5,
    CoAscendantMunkasey: 6,
    PolarAscendant: 7,
    Count: 8,
};
/** The zodiac signs, 0 = Aries. Obtained by dividing longitude by 30. */
export const SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
//# sourceMappingURL=constants.js.map