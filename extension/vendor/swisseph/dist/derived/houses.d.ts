/**
 * Placing a point in a house.
 *
 * Swiss Ephemeris hands back cusps and stops there — which house a body falls
 * in is left to the caller, and the caller usually gets it wrong. The naive
 * `floor((longitude − ascendant) / 30) + 1` is right only for equal houses
 * from the Ascendant; in Placidus a house can be 60° wide and its neighbour
 * 12°, and the whole calculation has to cross 0° Aries without noticing.
 *
 * So it lives here, once, with the wrap handled by construction: a point is
 * in house *i* when the arc **forward** from cusp *i* to the point is shorter
 * than the arc forward from cusp *i* to cusp *i+1*. No comparison ever spans
 * the 0/360 boundary, so there is no boundary case to get wrong.
 */
/**
 * Which house a longitude falls in, 1–12.
 *
 * A point sitting exactly on a cusp belongs to the house that cusp *begins*,
 * which is the universal convention.
 *
 * ```ts
 * const { cusps } = swe.houses(jd, 39.93, 32.86, HouseSystem.Placidus);
 * const sun = swe.calc(jd, Body.Sun);
 * houseOf(sun.longitude, cusps);   // 7
 * ```
 *
 * @param cusps the twelve cusps from {@link Houses.cusps}, in zodiacal order
 * @throws when given anything other than twelve cusps covering the circle —
 *         notably Gauquelin sectors, which are 36 and run the other way
 */
export declare function houseOf(longitude: number, cusps: readonly number[]): number;
/** A point to be placed, and the house it landed in. */
export interface HousePlacement<T> {
    point: T;
    /** 1–12. */
    house: number;
}
/**
 * Places a whole set of points at once.
 *
 * ```ts
 * const placed = assignHouses(positions, cusps, (p) => p.longitude);
 * ```
 *
 * @param longitudeOf reads the longitude out of each point
 */
export declare function assignHouses<T>(points: readonly T[], cusps: readonly number[], longitudeOf: (point: T) => number): HousePlacement<T>[];
//# sourceMappingURL=houses.d.ts.map