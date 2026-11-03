/**
 * Sect — whether a chart is diurnal or nocturnal.
 *
 * Most Arabic lots, the dignities and much of traditional technique depend on
 * it, and getting it wrong corrupts results silently: the day and night
 * formulae for the Lot of Fortune are mirror images, so an inverted sect puts
 * the lot somewhere else entirely without raising anything.
 *
 * The rule is simple — the chart is diurnal when the Sun is above the
 * horizon. There are two ways to define "above", they disagree in the edge
 * cases, and both are offered so the choice is the caller's.
 */
/** A chart's sect. */
export type Sect = 'day' | 'night';
/**
 * Latitude of the polar circle, 90° minus the obliquity of the ecliptic.
 *
 * The ascendant-based sect rule is **exact** up to this latitude and breaks
 * down beyond it — see below.
 */
export declare const POLAR_CIRCLE_LATITUDE = 66.56;
export type SectMethod = 
/**
 * The Sun's true geometric altitude. **The default.**
 *
 * Correct at every latitude. Below the polar circle it agrees exactly with
 * `'ascendant'`; beyond it, this is the only one that is right.
 */
'altitude'
/**
 * The Ascendant–Descendant axis: the Sun is above the horizon when it is
 * more than 180° past the Ascendant (houses 7–12).
 *
 * The traditional shortcut, and **exact** for |latitude| ≤ 66.56° — it was
 * measured to agree with true altitude in 100% of cases up to the polar
 * circle.
 *
 * **Unreliable beyond the polar circle.** There, Swiss Ephemeris swaps the
 * Ascendant and Descendant when the Ascendant lands on the "wrong" side
 * (swehouse.c:998), which inverts the assumption that houses 1–6 are below
 * the horizon. Measured disagreement: 6% at 67°, 18% at 70° — where it can
 * report "night" with the Sun 11° up — and 36% at 80°.
 *
 * Use it when all you have are longitudes and the latitude is temperate.
 */
 | 'ascendant';
export interface SectOptions {
    /** Defaults to `'altitude'`, which is correct at every latitude. */
    method?: SectMethod;
    /**
     * How far below the horizon the Sun may be and still count as day, in
     * degrees.
     *
     * Some traditional sources fold twilight into the day, usually 5–6°. The
     * default is 0, the strict geometric horizon. Any other value changes the
     * sect of some charts, so it should be a deliberate choice.
     */
    twilightAllowance?: number;
}
export interface SectResult {
    sect: Sect;
    /**
     * The Sun's distance from the horizon axis in degrees; positive is above.
     *
     * **Careful — this measures different things depending on the method:**
     *
     *   `'altitude'`  — the true geometric altitude.
     *   `'ascendant'` — the arc measured **along the ecliptic** from the
     *                   Ascendant–Descendant axis. Not a true altitude, and it
     *                   departs noticeably from one depending on latitude and
     *                   obliquity. Good enough to decide sect and to ask "is
     *                   this near the horizon", but do not report it as an
     *                   altitude.
     *
     * `twilightAllowance` is read on the same scale: under `'ascendant'` the
     * degrees you pass are ecliptic arc, not true degrees below the horizon.
     * Use `method: 'altitude'` if you want real twilight.
     */
    sunElevation: number;
    method: SectMethod;
    /**
     * True when the Sun is within a degree of the horizon. Sect is fragile in
     * these charts: the choice of method, a twilight allowance, or a minute of
     * uncertainty in the birth time can all flip it.
     */
    borderline: boolean;
}
/** Reduces an angle to [0, 360). */
export declare function normalizeDegrees(angle: number): number;
/**
 * Determines a chart's sect.
 *
 * @param sunLongitude the Sun's ecliptic longitude in degrees
 * @param ascendant    the Ascendant in degrees
 * @param sunAltitude  the Sun's true altitude; only for `method: 'altitude'`
 */
export declare function determineSect(sunLongitude: number, ascendant: number, options?: SectOptions & {
    sunAltitude?: number;
}): SectResult;
//# sourceMappingURL=sect.d.ts.map