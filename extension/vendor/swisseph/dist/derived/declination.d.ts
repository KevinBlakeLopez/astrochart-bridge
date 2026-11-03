/**
 * Declination: parallels, contraparallels, and out-of-bounds bodies.
 *
 * Longitude is only half of a position. Two bodies can be 90° apart in the
 * zodiac and still sit on the same small circle of declination, which
 * traditional and modern practice both read as a conjunction-like tie. Most
 * JavaScript astrology libraries never expose declination at all.
 *
 * The values themselves come from the ephemeris — ask for equatorial
 * coordinates and declination is the second component. This module is the
 * geometry laid over them.
 */
/**
 * Mean obliquity of the ecliptic at J2000.0, in degrees.
 *
 * 84381.406 arcseconds, the IAU 2006 value — which is what Swiss Ephemeris
 * itself returns. The older IAU 1976 figure of 84381.448″ (23.4392911°) is
 * still widely quoted and differs by 0.042″; using it here would put this
 * constant permanently at odds with the library's own numbers.
 *
 * A convenience default only. Obliquity decreases by roughly 47 arcseconds
 * per century, so over the ±600-year span the data package covers it moves
 * about 0.08° — enough to flip a body sitting near the boundary from
 * in-bounds to out-of-bounds. Pass the true obliquity for the date when it
 * matters; `SwissEph#obliquity()` returns it.
 */
export declare const OBLIQUITY_J2000 = 23.4392794;
/** A point taking part in a declination search. */
export interface DeclinationPoint {
    /** Label used in results. */
    name: string;
    /** Declination in degrees, north positive. */
    declination: number;
    /** Body constant, if this point is a body. */
    body?: number;
    /** Degrees per day of declination change; enables applying/separating. */
    speed?: number;
}
export type DeclinationAspectKind = 'parallel' | 'contraparallel';
export interface DeclinationAspect {
    kind: DeclinationAspectKind;
    from: DeclinationPoint;
    to: DeclinationPoint;
    /** How far from exact, in degrees. Always positive. */
    orb: number;
    maxOrb: number;
    /** 1 when exact, falling to 0 at the edge of the orb. */
    strength: number;
    /**
     * True when the two declinations are closing. Requires `speed` on both
     * points; undefined otherwise.
     */
    applying?: boolean;
}
export interface DeclinationOptions {
    /**
     * Allowed orb in degrees. One degree is the common default; some schools
     * use 1.5° for the luminaries and less for everything else.
     */
    orb?: number;
    /** Whether to include contraparallels. Defaults to true. */
    includeContraparallel?: boolean;
}
/**
 * Finds declination aspects among a set of points.
 *
 * A **parallel** holds when two declinations are equal within orb; a
 * **contraparallel** when they are equal in size and opposite in sign.
 *
 * Near the celestial equator both can be true at once — at +0.3° and −0.3°
 * the two declinations differ by 0.6° *and* sum to 0°, so under a 1° orb the
 * pair is both parallel and contraparallel. That is a real property of the
 * geometry, not a bug, and both are reported. Filter by `kind` if your
 * tradition admits only one.
 *
 * ```ts
 * const ties = findDeclinationAspects([
 *   { name: 'Sun', declination: 21.3 },
 *   { name: 'Venus', declination: 20.9 },
 * ]);
 * ```
 */
export declare function findDeclinationAspects(points: DeclinationPoint[], options?: DeclinationOptions): DeclinationAspect[];
export interface OutOfBoundsReport {
    name: string;
    declination: number;
    outOfBounds: boolean;
    /** Degrees past the obliquity limit. Zero or negative when in bounds. */
    excess: number;
    /** The limit used, i.e. the obliquity supplied. */
    limit: number;
    hemisphere: 'north' | 'south';
}
/**
 * Flags bodies whose declination exceeds the Sun's maximum — "out of bounds".
 *
 * The Sun cannot pass the obliquity of the ecliptic, so a body beyond it is
 * outside the band the Sun ever reaches. The Moon, Mercury, Venus, Mars and
 * Pluto all manage it; Jupiter through Neptune effectively never do.
 *
 * The limit is the obliquity, which drifts. Pass the value for the date
 * rather than relying on the J2000 default when a body sits near the edge.
 */
export declare function outOfBounds(points: DeclinationPoint[], obliquity?: number): OutOfBoundsReport[];
//# sourceMappingURL=declination.d.ts.map