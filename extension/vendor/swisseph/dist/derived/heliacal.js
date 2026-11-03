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
/**
 * Packs an {@link Atmosphere} into the four doubles the C API expects.
 *
 * Leaving pressure at zero is meaningful: it tells Swiss Ephemeris to derive
 * pressure and temperature from the observer's height. That is why the
 * default here is 0 and not 1013.25 — substituting the sea-level value would
 * silently discard the altitude the caller supplied.
 */
export function atmosphereToArray(atmosphere = {}) {
    return [
        atmosphere.pressure ?? 0,
        atmosphere.temperature ?? 15,
        atmosphere.humidity ?? 40,
        atmosphere.visibilityRange ?? 40,
    ];
}
/** Packs an {@link Observer} into the six doubles the C API expects. */
export function observerToArray(observer = {}) {
    return [
        observer.age ?? 36,
        observer.snellenRatio ?? 1,
        observer.binocular === false ? 0 : 1,
        observer.magnification ?? 1,
        observer.apertureMm ?? 0,
        observer.transmission ?? 0,
    ];
}
//# sourceMappingURL=heliacal.js.map