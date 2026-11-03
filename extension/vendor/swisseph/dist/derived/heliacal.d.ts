/**
 * Heliacal phenomena — the first and last visible appearances of a star or
 * planet in the twilight.
 *
 * These are the events ancient calendars were built on: the heliacal rising
 * of Sirius opening the Egyptian year, the first evening appearance of Venus.
 * Unlike everything else in this library they are not pure geometry — whether
 * an object is *visible* depends on the atmosphere and on the observer's eye,
 * so the answer carries assumptions. Swiss Ephemeris implements Schaefer's
 * visibility model; the inputs it needs are typed here with their defaults
 * made explicit rather than hidden.
 */
/** Atmospheric conditions at the observing site. */
export interface Atmosphere {
    /**
     * Pressure in millibars (hPa).
     *
     * Leave undefined and Swiss Ephemeris estimates pressure and temperature
     * from the site's height above sea level, which is the sensible choice for
     * a historical event where nobody recorded the weather.
     */
    pressure?: number;
    /** Temperature in °C. Default 15. */
    temperature?: number;
    /** Relative humidity in percent. */
    humidity?: number;
    /**
     * Meteorological range in kilometres. Default 40.
     *
     * Values between 0 and 1 are read instead as the total atmospheric
     * extinction coefficient (0.25 is a reasonable one); −1 derives it from
     * the other values. An unusual overload, and it is the library's, not ours.
     */
    visibilityRange?: number;
}
/** The observer. Only age and acuity matter unless optical aid is declared. */
export interface Observer {
    /** Years. Default 36 — "an experienced sky observer in ancient times". */
    age?: number;
    /** Snellen ratio of visual acuity. Default 1. */
    snellenRatio?: number;
    /**
     * The remaining fields apply only when `HeliacalFlag.OpticalParams` is set.
     */
    binocular?: boolean;
    /** Telescope magnification; 1 = naked eye. */
    magnification?: number;
    /** Aperture in millimetres. */
    apertureMm?: number;
    /** Optical transmission, 0–1. */
    transmission?: number;
}
export interface HeliacalResult {
    /** Start of visibility. The event itself, for most purposes. */
    visibilityBegin: number;
    /**
     * Optimum visibility. Zero from Swiss Ephemeris — and so undefined here —
     * when the arcus visionis method is selected.
     */
    optimum?: number;
    /** End of visibility. Undefined under the arcus visionis method. */
    visibilityEnd?: number;
    /** The event type that was searched for. */
    event: number;
    /** The object as the library resolved it. */
    object: string;
}
/**
 * Packs an {@link Atmosphere} into the four doubles the C API expects.
 *
 * Leaving pressure at zero is meaningful: it tells Swiss Ephemeris to derive
 * pressure and temperature from the observer's height. That is why the
 * default here is 0 and not 1013.25 — substituting the sea-level value would
 * silently discard the altitude the caller supplied.
 */
export declare function atmosphereToArray(atmosphere?: Atmosphere): number[];
/** Packs an {@link Observer} into the six doubles the C API expects. */
export declare function observerToArray(observer?: Observer): number[];
//# sourceMappingURL=heliacal.d.ts.map