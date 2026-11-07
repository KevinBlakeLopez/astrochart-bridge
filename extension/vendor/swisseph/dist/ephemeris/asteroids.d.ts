/**
 * Numbered asteroids.
 *
 * Swiss Ephemeris keeps each numbered asteroid in its **own** file and
 * addresses it as `AsteroidOffset + number`. Six of them are present in the
 * main `seas_*.se1` file; the rest have to be loaded separately.
 *
 * **Two important differences from the planets:**
 *
 * 1. When the file is missing, Swiss Ephemeris does **not** fall back to
 *    Moshier — there is no analytic theory for asteroids. The calculation
 *    fails. Code that relies on the planets' silent fallback has to catch
 *    errors here.
 *
 * 2. Asteroid files cover only 1500–2100 CE (the short files). Long versions
 *    cover 3000 BCE – 2999 CE but are roughly ten times the size.
 */
/** What is needed to build an asteroid's file name. */
export interface AsteroidFileSpec {
    /** The file name, e.g. `"se00433s.se1"` or `"s136199s.se1"`. */
    fileName: string;
    /** Subdirectory in the upstream archive, e.g. `"ast0"`. */
    directory: string;
    /** Full path relative to the archive root. */
    path: string;
}
/**
 * The asteroids and dwarf planets astrologers actually ask for, by MPC
 * number.
 *
 * These are **not** `Body` constants. Convert with `asteroidBody()` before
 * passing them to `swe_calc()`; raw `AsteroidOffset + number` arithmetic
 * gives a surprising result for Chiron and Pholus — see below.
 */
export declare const Asteroid: {
    readonly Ceres: 1;
    readonly Pallas: 2;
    readonly Juno: 3;
    readonly Vesta: 4;
    readonly Astraea: 5;
    readonly Hygiea: 10;
    readonly Psyche: 16;
    readonly Eros: 433;
    /** Asteroid Lilith. **Not** Black Moon Lilith — see `Body.BlackMoonLilithMean`. */
    readonly Lilith: 1181;
    readonly Chiron: 2060;
    readonly Pholus: 5145;
    readonly Nessus: 7066;
    readonly Chariklo: 10199;
    readonly Varuna: 20000;
    readonly Ixion: 28978;
    readonly Quaoar: 50000;
    readonly Sedna: 90377;
    readonly Orcus: 90482;
    readonly Haumea: 136108;
    readonly Eris: 136199;
    readonly Makemake: 136472;
    readonly Gonggong: 225088;
};
export type Asteroid = (typeof Asteroid)[keyof typeof Asteroid];
/**
 * Converts an MPC number into the body number to pass to `swe_calc()`.
 *
 * Returns a `Body` constant for the six that live in the main ephemeris — no
 * extra file needed — and `AsteroidOffset + number` for everything else.
 *
 * ```ts
 * swe.calc(jd, asteroidBody(Asteroid.Chiron));   // main ephemeris, no file
 * swe.calc(jd, asteroidBody(Asteroid.Eris));     // needs s136199s.se1
 * ```
 */
export declare function asteroidBody(number: number): number;
/** Numbers present in the main ephemeris, needing **no** separate download. */
export declare const BUILT_IN_ASTEROIDS: ReadonlySet<number>;
/**
 * The file name for an asteroid number.
 *
 * The scheme keeps the base name at eight characters, inherited from DOS 8.3:
 *   number < 100000  → se00433s.se1   (`se` + 5 digits)
 *   number ≥ 100000  → s136199s.se1   (`s` + 6 digits)
 *
 * The trailing `s` marks the short file (1500–2100 CE); the long files
 * (3000 BCE – 2999 CE) drop it and are about ten times larger.
 *
 * The subdirectory is `ast{floor(number / 1000)}`. You do not need to
 * reproduce that structure when mounting into the virtual filesystem: the
 * fallback chain at sweph.c:2204–2222 strips the `astN/` prefix and also
 * looks in the main ephemeris directory (verified experimentally).
 */
export declare function asteroidFile(number: number, options?: {
    long?: boolean;
}): AsteroidFileSpec;
/**
 * Popular asteroids that need their own file downloaded. The ones already in
 * the main ephemeris are not listed.
 */
export declare const POPULAR_ASTEROIDS: readonly number[];
/** Number to name, for error messages and diagnostics. */
export declare const ASTEROID_NAMES: Readonly<Record<number, string>>;
//# sourceMappingURL=asteroids.d.ts.map