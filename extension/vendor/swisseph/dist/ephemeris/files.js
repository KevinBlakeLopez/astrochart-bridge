/**
 * Working out ephemeris file names from a date range.
 *
 * Swiss Ephemeris splits its data into 600-year slices, and the file name is
 * entirely derivable from the date. That is what makes lazy loading possible:
 * out of a 379 MB archive we can know **in advance** which ~2 MB a given
 * calculation actually needs.
 *
 * The naming (verified against the published file list):
 *   CE:  sepl_NN.se1  — NN = 6 × floor(year / 600),  NN 0..168
 *   BCE: seplmNN.se1  — NN = 6 × ceil(-year / 600),  NN 6..132
 *
 * Years use **astronomical** numbering: 1 = 1 CE, 0 = 1 BCE, −1 = 2 BCE.
 * `swe_revjul()` uses the same convention, so `calendarDate().year` can be
 * passed straight in.
 */
const PREFIX = {
    planets: 'sepl', // Güneş..Plüton
    moon: 'semo', // Ay
    asteroids: 'seas', // Chiron, Pholus, Ceres, Pallas, Juno, Vesta
};
/** Years covered by one file. */
const YEARS_PER_FILE = 600;
/** Step between file indices — 600 years is 6 units. */
const INDEX_STEP = 6;
/** The astronomical year range covered, which is DE441's own limit. */
export const COVERAGE = {
    minYear: -13200,
    maxYear: 17399,
};
/** Plain-text files needed alongside the main ones. */
export const AUXILIARY_FILES = {
    /** The fixed star catalogue, for `swe_fixstar` / `swe_fixstar2`. */
    fixedStars: 'sefstars.txt',
    /** Orbital elements for Uranian planets, Transpluto and the like. */
    fictitiousBodies: 'seorbel.txt',
    /** Named-asteroid lookup. 16 MB — not part of the core package. */
    asteroidNames: 'seasnam.txt',
};
/**
 * The file covering a given astronomical year, or null when the year falls
 * outside the covered range.
 */
export function ephemerisFileFor(kind, year) {
    if (!Number.isFinite(year) || year < COVERAGE.minYear || year > COVERAGE.maxYear) {
        return null;
    }
    const prefix = PREFIX[kind];
    if (year >= 0) {
        const index = INDEX_STEP * Math.floor(year / YEARS_PER_FILE);
        return `${prefix}_${pad(index)}.se1`;
    }
    // MÖ tarafında dosyalar geriye doğru numaralanıyor ve _00'ın MÖ karşılığı
    // yok: astronomik yıl 0 (= MÖ 1) zaten _00 dosyasında.
    const index = INDEX_STEP * Math.ceil(-year / YEARS_PER_FILE);
    return `${prefix}m${pad(index)}.se1`;
}
/** Indices are at least two digits: 6 becomes "06", 102 stays "102". */
function pad(index) {
    return String(index).padStart(2, '0');
}
/**
 * Every file a date range needs.
 *
 * ```ts
 * requiredEphemerisFiles({ fromYear: 1900, toYear: 2100 })
 * // ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1']
 *
 * requiredEphemerisFiles({ fromYear: 1750, toYear: 1850 })
 * // two slices, because it crosses the 1799/1800 boundary:
 * // ['sepl_12.se1', 'sepl_18.se1', 'semo_12.se1', ...]
 * ```
 */
export function requiredEphemerisFiles(options) {
    const { fromYear, kinds = ['planets', 'moon', 'asteroids'] } = options;
    const toYear = options.toYear ?? fromYear;
    // Dilim sıra numaraları yılda monoton artıyor, bu yüzden aradaki her
    // dilimi tek tek saymak yeterli. Yıl yıl gezmeye ya da sınır durumlarını
    // elle kovalamaya gerek yok.
    const loOrdinal = sliceOrdinal(clampYear(Math.min(fromYear, toYear)));
    const hiOrdinal = sliceOrdinal(clampYear(Math.max(fromYear, toYear)));
    const files = [];
    for (const kind of kinds) {
        for (let ordinal = loOrdinal; ordinal <= hiOrdinal; ordinal++) {
            const name = fileForOrdinal(kind, ordinal);
            if (name)
                files.push(name);
        }
    }
    if (options.fixedStars)
        files.push(AUXILIARY_FILES.fixedStars);
    if (options.fictitiousBodies)
        files.push(AUXILIARY_FILES.fictitiousBodies);
    return files;
}
/**
 * Turns a year into the monotonic ordinal of its 600-year slice.
 * 0–599 CE is 0, 600–1199 CE is 1, and the BCE side runs −1, −2, …
 */
function sliceOrdinal(year) {
    return year >= 0
        ? Math.floor(year / YEARS_PER_FILE)
        : -Math.ceil(-year / YEARS_PER_FILE);
}
function fileForOrdinal(kind, ordinal) {
    const prefix = PREFIX[kind];
    if (ordinal >= 0) {
        const index = INDEX_STEP * ordinal;
        return index <= 168 ? `${prefix}_${pad(index)}.se1` : null;
    }
    const index = INDEX_STEP * -ordinal;
    return index <= 132 ? `${prefix}m${pad(index)}.se1` : null;
}
function clampYear(year) {
    return Math.min(COVERAGE.maxYear, Math.max(COVERAGE.minYear, year));
}
/**
 * A rough estimate of which year a Julian day falls in.
 *
 * Good enough to **choose a file** — the slices are 600 years wide, so a
 * day's error never changes the answer (and on a slice boundary the
 * neighbouring file is already being loaded). Use `calendarDate()` for
 * anything calendrical.
 */
export function approximateYearFromJulianDay(jd) {
    // J2000.0 = JD 2451545.0 = 2000-01-01.5, Jülyen yılı 365.25 gün.
    return Math.floor(2000 + (jd - 2451545.0) / 365.25);
}
//# sourceMappingURL=files.js.map