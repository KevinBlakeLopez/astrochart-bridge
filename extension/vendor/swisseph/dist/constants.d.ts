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
export declare const Body: {
    readonly Sun: 0;
    readonly Moon: 1;
    readonly Mercury: 2;
    readonly Venus: 3;
    readonly Mars: 4;
    readonly Jupiter: 5;
    readonly Saturn: 6;
    readonly Uranus: 7;
    readonly Neptune: 8;
    readonly Pluto: 9;
    readonly MeanNode: 10;
    readonly TrueNode: 11;
    readonly MeanApog: 12;
    readonly OscuApog: 13;
    readonly Earth: 14;
    readonly Chiron: 15;
    readonly Pholus: 16;
    readonly Ceres: 17;
    readonly Pallas: 18;
    readonly Juno: 19;
    readonly Vesta: 20;
    readonly IntpApog: 21;
    readonly IntpPerg: 22;
    readonly BlackMoonLilithMean: 12;
    readonly BlackMoonLilithTrue: 13;
    readonly InterpolatedApogee: 21;
    readonly InterpolatedPerigee: 22;
    /** The Moon's mean north node (Rahu). */
    readonly NorthNodeMean: 10;
    /** The Moon's true (osculating) north node. */
    readonly NorthNodeTrue: 11;
};
export type Body = (typeof Body)[keyof typeof Body];
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
export declare const REQUIRES_EPHEMERIS_FILE: ReadonlySet<number>;
/**
 * `swe_calc()` flags, combined as a bit mask.
 *
 * The ephemeris choices (Swiss / Moshier / JPL) are mutually exclusive —
 * pass at most one. With none, Swiss Ephemeris is assumed and falls back to
 * Moshier when the files are absent.
 */
export declare const Flag: {
    readonly Tropical: 0;
    readonly Jpleph: 1;
    readonly Swieph: 2;
    readonly Defaulteph: 2;
    readonly Moseph: 4;
    readonly Helctr: 8;
    readonly Truepos: 16;
    readonly J2000: 32;
    readonly Nonut: 64;
    readonly Speed3: 128;
    readonly Nogdefl: 512;
    readonly Noaberr: 1024;
    readonly Astrometric: 1536;
    readonly Xyz: 4096;
    readonly Baryctr: 16384;
    readonly Topoctr: 32768;
    readonly OrbelAa: 32768;
    readonly Icrs: 131072;
    readonly Dpsideps1980: 262144;
    readonly Jplhor: 262144;
    readonly JplhorApprox: 524288;
    readonly CenterBody: 1048576;
    readonly TestPlmoon: 2228280;
    /** The `.se1` files. Falls back to Moshier, silently, when absent. */
    readonly SwissEphemeris: 2;
    /** Analytic theory, no files needed. Always available. */
    readonly Moshier: 4;
    /** A raw JPL file (`de441.eph` and friends). Node only, 2.6 GB. */
    readonly JplEphemeris: 1;
    readonly Heliocentric: 8;
    readonly Barycentric: 16384;
    readonly Topocentric: 32768;
    /** Equatorial instead of ecliptic coordinates (right ascension / declination). */
    readonly Equatorial: 2048;
    /** Cartesian x/y/z instead of spherical. */
    readonly Cartesian: 4096;
    readonly Radians: 8192;
    /** No light-time or aberration correction — the geometric (true) position. */
    readonly TruePosition: 16;
    readonly NoNutation: 64;
    readonly NoGravitationalDeflection: 512;
    readonly NoAberration: 1024;
    readonly J2000Equinox: 32;
    /** The sidereal zodiac, used together with `setSiderealMode()`. */
    readonly Sidereal: 65536;
    /** Also compute speeds. Cheap, and usually wanted. */
    readonly Speed: 256;
};
export type Flag = number;
export declare const Calendar: {
    readonly Julian: 0;
    readonly Gregorian: 1;
};
export type Calendar = (typeof Calendar)[keyof typeof Calendar];
export declare const HouseSystem: {
    readonly Equal: 'A';
    readonly Alcabitius: 'B';
    readonly Campanus: 'C';
    readonly EqualMC: 'D';
    readonly CarterPoliEqu: 'F';
    readonly GauquelinSectors: 'G';
    readonly HorizonAzimut: 'H';
    readonly Sunshine: 'I';
    readonly SunshineAlt: 'i';
    readonly SavardA: 'J';
    readonly Koch: 'K';
    readonly PullenSD: 'L';
    readonly Morinus: 'M';
    readonly Equal1Aries: 'N';
    readonly Porphyry: 'O';
    readonly Placidus: 'P';
    readonly PullenSR: 'Q';
    readonly Regiomontanus: 'R';
    readonly Sripati: 'S';
    readonly PolichPage: 'T';
    readonly KrusinskiPisaGoelzer: 'U';
    readonly EqualVehlow: 'V';
    readonly EqualWholeSign: 'W';
    readonly AxialRotationSystemMeridianHouses: 'X';
    readonly APCHouses: 'Y';
};
export type HouseSystem = (typeof HouseSystem)[keyof typeof HouseSystem];
/** Indices into the `ascmc` array of `swe_houses_ex2()` (swephexp.h:164–172). */
export declare const ASCMC: {
    readonly Ascendant: 0;
    readonly Midheaven: 1;
    readonly Armc: 2;
    readonly Vertex: 3;
    readonly EquatorialAscendant: 4;
    readonly CoAscendantKoch: 5;
    readonly CoAscendantMunkasey: 6;
    readonly PolarAscendant: 7;
    readonly Count: 8;
};
/** The zodiac signs, 0 = Aries. Obtained by dividing longitude by 30. */
export declare const SIGNS: readonly ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export type Sign = (typeof SIGNS)[number];
//# sourceMappingURL=constants.d.ts.map