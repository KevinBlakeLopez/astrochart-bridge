/**
 * Antiscia and contra-antiscia.
 *
 * A point's antiscion is its mirror across the solstitial axis (0° Cancer –
 * 0° Capricorn). Two points in antiscion share the same declination and the
 * same day length, which is the physical basis of the technique: they are
 * equidistant from the solstice, so the Sun stands at the same height on both
 * days of the year.
 *
 * Contra-antiscia mirror across the equinoctial axis (0° Aries – 0° Libra)
 * instead, giving opposite declinations.
 *
 * The arithmetic is trivial; the value is in getting the axis right and in
 * finding contacts, which is where implementations differ.
 */
import { type Sign } from '../constants.js';
import type { AspectPoint } from './aspects.js';
/**
 * The antiscion of a longitude: its reflection across the Cancer–Capricorn
 * axis.
 *
 * Derivation: reflecting across 0° Cancer (90°) maps `x` to `180 − x`.
 * 15° Gemini (75°) becomes 15° Cancer (105°); 0° Cancer maps to itself.
 */
export declare function antiscion(longitude: number): number;
/**
 * The contra-antiscion: reflection across the Aries–Libra axis, which maps
 * `x` to `360 − x`. Equivalently, the antiscion's opposition.
 */
export declare function contraAntiscion(longitude: number): number;
export interface ReflectedPoint {
    /** The original point's label. */
    name: string;
    /** Original longitude. */
    longitude: number;
    /** Reflection across the solstitial axis. */
    antiscion: number;
    /** Reflection across the equinoctial axis. */
    contraAntiscion: number;
    antiscionSign: Sign;
    contraAntiscionSign: Sign;
}
/** Computes both reflections for a point. */
export declare function reflect(name: string, longitude: number): ReflectedPoint;
export type AntisciaKind = 'antiscion' | 'contra-antiscion';
export interface AntisciaContact {
    kind: AntisciaKind;
    /** The point whose reflection was taken. */
    from: AspectPoint;
    /** The point the reflection falls on. */
    to: AspectPoint;
    /** Where the reflection landed. */
    reflectedLongitude: number;
    /** Distance from the contacted point, in degrees. */
    orb: number;
    maxOrb: number;
    /** 1 when exact, falling to 0 at the edge of the orb. */
    strength: number;
}
export interface AntisciaOptions {
    /**
     * Allowed orb in degrees. Traditional practice keeps these very tight —
     * often 1° or less — because the technique rests on an exact symmetry
     * rather than on a sphere of influence.
     */
    orb?: number;
    /** Whether to include contra-antiscia. Defaults to true. */
    includeContra?: boolean;
}
/**
 * Finds antiscia contacts among a set of points.
 *
 * Each unordered pair is reported once. A pair is checked in one direction
 * only because the relation is symmetric: if A's antiscion falls on B, then
 * B's antiscion falls on A by construction, and reporting both would double
 * every contact.
 *
 * ```ts
 * const contacts = findAntiscia([
 *   { name: 'Sun', longitude: 54.5 },
 *   { name: 'Mars', longitude: 126.1 },
 * ], { orb: 1 });
 * ```
 */
export declare function findAntiscia(points: AspectPoint[], options?: AntisciaOptions): AntisciaContact[];
//# sourceMappingURL=antiscia.d.ts.map