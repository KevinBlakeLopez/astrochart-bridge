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
import { AsteroidOffset, Body } from '../constants.js';
/**
 * The asteroids and dwarf planets astrologers actually ask for, by MPC
 * number.
 *
 * These are **not** `Body` constants. Convert with `asteroidBody()` before
 * passing them to `swe_calc()`; raw `AsteroidOffset + number` arithmetic
 * gives a surprising result for Chiron and Pholus — see below.
 */
export const Asteroid = {
    // --- ana kuşak ---
    Ceres: 1,
    Pallas: 2,
    Juno: 3,
    Vesta: 4,
    Astraea: 5,
    Hygiea: 10,
    Psyche: 16,
    Eros: 433,
    /** Asteroid Lilith. **Not** Black Moon Lilith — see `Body.BlackMoonLilithMean`. */
    Lilith: 1181,
    // --- centaurlar ---
    Chiron: 2060,
    Pholus: 5145,
    Nessus: 7066,
    Chariklo: 10199,
    // --- trans-Neptün cisimleri ---
    Varuna: 20000,
    Ixion: 28978,
    Quaoar: 50000,
    Sedna: 90377,
    Orcus: 90482,
    Haumea: 136108,
    Eris: 136199,
    Makemake: 136472,
    Gonggong: 225088,
};
/**
 * The `Body` constant for asteroids that live in the main ephemeris file.
 *
 * **A trap worth naming:** `AsteroidOffset + 2060` does *not* read Chiron
 * from the main ephemeris. It looks for `se02060s.se1` and fails when that
 * file is absent. Swiss Ephemeris only remaps numbers 1–4 onto built-in
 * bodies (sweph.c:1031, bounded by `MPC_VESTA`); Chiron and Pholus sit
 * outside that remapping even though they are in the main file.
 */
const BODY_FOR_ASTEROID = {
    [Asteroid.Ceres]: Body.Ceres,
    [Asteroid.Pallas]: Body.Pallas,
    [Asteroid.Juno]: Body.Juno,
    [Asteroid.Vesta]: Body.Vesta,
    [Asteroid.Chiron]: Body.Chiron,
    [Asteroid.Pholus]: Body.Pholus,
};
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
export function asteroidBody(number) {
    return BODY_FOR_ASTEROID[number] ?? AsteroidOffset + number;
}
/** Numbers present in the main ephemeris, needing **no** separate download. */
export const BUILT_IN_ASTEROIDS = new Set(Object.keys(BODY_FOR_ASTEROID).map(Number));
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
export function asteroidFile(number, options = {}) {
    if (!Number.isInteger(number) || number < 1) {
        throw new RangeError(`Invalid asteroid number: ${number}. Expected a positive integer — the ` +
            'minor planet number, not the Body constant.');
    }
    const suffix = options.long ? '' : 's';
    const base = number < 100000
        ? `se${String(number).padStart(5, '0')}`
        : `s${number}`;
    const fileName = `${base}${suffix}.se1`;
    const directory = `ast${Math.floor(number / 1000)}`;
    return { fileName, directory, path: `${directory}/${fileName}` };
}
/**
 * Popular asteroids that need their own file downloaded. The ones already in
 * the main ephemeris are not listed.
 */
export const POPULAR_ASTEROIDS = Object.values(Asteroid)
    .filter((n) => !BUILT_IN_ASTEROIDS.has(n))
    .sort((a, b) => a - b);
/** Number to name, for error messages and diagnostics. */
export const ASTEROID_NAMES = Object.fromEntries(Object.entries(Asteroid).map(([name, number]) => [number, name]));
//# sourceMappingURL=asteroids.js.map