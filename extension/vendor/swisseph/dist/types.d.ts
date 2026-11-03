import type { Sign } from './constants.js';
/** The ephemeris that actually produced a result. */
export type EphemerisModel = 'swiss' | 'moshier' | 'jpl';
/** A body's position. */
export interface Position {
    /** Ecliptic longitude in degrees, [0, 360). Right ascension under `Flag.Equatorial`. */
    longitude: number;
    /** Ecliptic latitude in degrees. Declination under `Flag.Equatorial`. */
    latitude: number;
    /** Distance in astronomical units. */
    distance: number;
    /** Change in longitude, degrees per day. Negative means retrograde. */
    longitudeSpeed: number;
    latitudeSpeed: number;
    /** Change in distance, AU per day. */
    distanceSpeed: number;
    /**
     * Which ephemeris was actually used.
     *
     * Swiss Ephemeris does **not** fail when it cannot find the `.se1` file you
     * asked for — it falls back to Moshier without saying so. Check this field
     * or you will believe you have a precision you did not get.
     */
    ephemeris: EphemerisModel;
    /** Warning text from the library, e.g. a missing file. Null when clean. */
    warning: string | null;
}
/** A position with sign and retrograde state derived. */
export interface PositionWithSign extends Position {
    /** Sign index, 0 = Aries. */
    signIndex: number;
    sign: Sign;
    /** Degrees within the sign, [0, 30). */
    degreeInSign: number;
    /** True when longitude speed is negative. */
    retrograde: boolean;
}
/** Equatorial coordinates — what declination work needs. */
export interface EquatorialPosition {
    /** Right ascension in degrees, [0, 360). */
    rightAscension: number;
    /** Declination in degrees, north positive. */
    declination: number;
    distance: number;
    /** Degrees per day. */
    rightAscensionSpeed: number;
    /** Degrees per day. Drives applying/separating for parallels. */
    declinationSpeed: number;
    distanceSpeed: number;
    ephemeris: EphemerisModel;
    warning: string | null;
}
/** Obliquity of the ecliptic and the nutation at a moment. */
export interface Obliquity {
    /** True obliquity — mean plus the nutation in obliquity. */
    trueObliquity: number;
    meanObliquity: number;
    nutationInLongitude: number;
    nutationInObliquity: number;
}
/** An observer's place on Earth. */
export interface GeoPosition {
    /** Geographic latitude, north positive. */
    latitude: number;
    /** Geographic longitude, east positive. */
    longitude: number;
    /** Height above sea level in metres. Defaults to 0. */
    altitude?: number;
}
/** House cusps and angles. */
export interface Houses {
    /**
     * The cusps, `cusps[0]` being the first house. (The C API uses a 1-based
     * array; this one is 0-based.)
     *
     * **Twelve entries for every house system except `'G'`.** Gauquelin sectors
     * are 36, and they are counted in the *clockwise* direction — check
     * `cusps.length` rather than assuming twelve. The one exception is a
     * Gauquelin chart beyond the polar circle: the system is undefined there,
     * Swiss Ephemeris substitutes Porphyry and produces only twelve cusps, so
     * `substituted` is true and `cusps.length` is 12.
     */
    cusps: number[];
    /** The house system code that was asked for. */
    requestedSystem: string;
    /**
     * True when Swiss Ephemeris used a different system than the one requested.
     *
     * Placidus, Koch, Gauquelin and Sunshine are mathematically undefined
     * beyond the polar circle. Swiss Ephemeris quietly substitutes Porphyry and
     * returns −1 (swehouse.c:1252) while still filling in **valid** cusps — so
     * that −1 is a warning, not a failure.
     *
     * Ignore this field and a high-latitude chart may be using a house system
     * you did not choose. The `warning` text names the substitute.
     */
    substituted: boolean;
    ascendant: number;
    midheaven: number;
    /**
     * The Descendant — the Ascendant's opposition.
     *
     * Derived here rather than read from a cusp on purpose. In a quadrant
     * system it equals `cusps[6]`, but in whole sign, equal, Morinus, Vehlow
     * and the meridian systems it does **not**: the seventh cusp is a house
     * boundary, and the Descendant is where the ecliptic meets the western
     * horizon. Reading one for the other is wrong by up to a whole sign.
     */
    descendant: number;
    /**
     * The Imum Coeli — the Midheaven's opposition, the lower meridian.
     * Equal to `cusps[3]` in a quadrant system and not otherwise; see
     * {@link descendant}.
     */
    imumCoeli: number;
    /** Right ascension of the meridian. */
    armc: number;
    vertex: number;
    equatorialAscendant: number;
    coAscendantKoch: number;
    coAscendantMunkasey: number;
    polarAscendant: number;
    warning: string | null;
}
/** A fixed star's position. */
export interface StarPosition extends Position {
    /**
     * The full name the library resolved, in the form `Aldebaran,alTau`:
     * traditional name plus Bayer/Flamsteed designation.
     */
    resolvedName: string;
}
/** A Julian day converted back to a calendar date. */
export interface CalendarDate {
    year: number;
    month: number;
    day: number;
    /** Decimal hour, e.g. 14.5 = 14:30. */
    hour: number;
}
export interface CalcOptions {
    /**
     * Extra flags (`Flag.*`). The ephemeris source and `Flag.Speed` are added
     * by default; both can be overridden from here.
     */
    flags?: number;
    /** Ephemeris source. Defaults to `'swiss'`, which falls back to Moshier. */
    ephemeris?: EphemerisModel;
}
export interface SwissEphOptions {
    /**
     * Ephemeris files to write into the virtual filesystem. Keys are file names
     * (`"sepl_18.se1"`), values are the contents.
     */
    files?: Record<string, Uint8Array | ArrayBuffer>;
    /**
     * Where to look for ephemeris files. A real directory under Node; the
     * virtual directory populated by `files` in a browser (default `/ephe`).
     */
    ephemerisPath?: string;
}
/** Thrown when Swiss Ephemeris reports an error. */
export declare class SwissEphError extends Error {
    /** The C function that failed. */
    readonly fn: string;
    /**
     * The library's own `serr` text, when `message` rephrases it.
     *
     * Kept because it is the ground truth and because a Swiss Ephemeris user
     * may recognise it — but it is not the message, since it can point
     * somewhere unhelpful. A missing-file error names the **virtual** search
     * path inside the WebAssembly filesystem (`'.:/users/ephe/'`), which does
     * not exist on the caller's machine and sends them looking in the wrong
     * place.
     */
    readonly detail?: string | undefined;
    constructor(message: string, 
    /** The C function that failed. */
    fn: string, 
    /**
     * The library's own `serr` text, when `message` rephrases it.
     *
     * Kept because it is the ground truth and because a Swiss Ephemeris user
     * may recognise it — but it is not the message, since it can point
     * somewhere unhelpful. A missing-file error names the **virtual** search
     * path inside the WebAssembly filesystem (`'.:/users/ephe/'`), which does
     * not exist on the caller's machine and sends them looking in the wrong
     * place.
     */
    detail?: string | undefined);
    /**
     * The `.se1` file the library could not find, when that is what failed.
     *
     * Null for every other error. Useful for deciding what to fetch and retry.
     */
    get missingFile(): string | null;
}
//# sourceMappingURL=types.d.ts.map