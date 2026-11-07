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
/** Which kind of ephemeris file. All three cover the same year ranges. */
export type EphemerisFileKind = 'planets' | 'moon' | 'asteroids';
/** The astronomical year range covered, which is DE441's own limit. */
export declare const COVERAGE: {
    readonly minYear: -13200;
    readonly maxYear: 17399;
};
/** Plain-text files needed alongside the main ones. */
export declare const AUXILIARY_FILES: {
    /** The fixed star catalogue, for `swe_fixstar` / `swe_fixstar2`. */
    readonly fixedStars: 'sefstars.txt';
    /** Orbital elements for Uranian planets, Transpluto and the like. */
    readonly fictitiousBodies: 'seorbel.txt';
    /** Named-asteroid lookup. 16 MB — not part of the core package. */
    readonly asteroidNames: 'seasnam.txt';
};
/**
 * The file covering a given astronomical year, or null when the year falls
 * outside the covered range.
 */
export declare function ephemerisFileFor(kind: EphemerisFileKind, year: number): string | null;
export interface RequiredFilesOptions {
    /** First year, in astronomical numbering. */
    fromYear: number;
    /** Last year. Defaults to `fromYear`. */
    toYear?: number;
    /** Which kinds of body are needed. Defaults to all three. */
    kinds?: EphemerisFileKind[];
    /** Include the fixed star catalogue. Defaults to false. */
    fixedStars?: boolean;
    /** Include the fictitious-body elements. Defaults to false. */
    fictitiousBodies?: boolean;
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
export declare function requiredEphemerisFiles(options: RequiredFilesOptions): string[];
/**
 * A rough estimate of which year a Julian day falls in.
 *
 * Good enough to **choose a file** — the slices are 600 years wide, so a
 * day's error never changes the answer (and on a slice boundary the
 * neighbouring file is already being loaded). Use `calendarDate()` for
 * anything calendrical.
 */
export declare function approximateYearFromJulianDay(jd: number): number;
//# sourceMappingURL=files.d.ts.map