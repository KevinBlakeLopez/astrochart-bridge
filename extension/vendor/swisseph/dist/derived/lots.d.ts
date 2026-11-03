/**
 * Arabic lots (Arabic parts).
 *
 * Swiss Ephemeris does **not** provide these — they are pure arithmetic and
 * so fall outside its scope. They are nonetheless in constant use, and there
 * is no properly done implementation on the JavaScript side.
 *
 * Every one of them has the shape `A + B − C`. The difficulty is not in the
 * formula but in two other places:
 *
 * 1. **Sect.** Most lots have day and night formulae that mirror each other.
 *    Get the sect backwards and the lot lands somewhere else entirely,
 *    without raising anything. See `sect.ts`, where the choice of method and
 *    the twilight allowance are made explicit.
 *
 * 2. **Dependencies.** Some lots refer to other lots — Eros uses the Lot of
 *    Spirit, Necessity uses Fortune. Resolve them in the wrong order and you
 *    compute against an undefined value.
 *
 * Sources disagree on some formulae. Every definition names the tradition it
 * follows in its `source` field, and you can supply your own definitions if
 * you follow a different one.
 */
import { type Sign } from '../constants.js';
import { type Sect } from './sect.js';
/**
 * The points a lot formula can refer to.
 *
 * Planets and angles directly; other lots through the `lot:` prefix.
 */
export type LotPoint = 'Ascendant' | 'Midheaven' | 'Descendant' | 'ImumCoeli' | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn' | 'NorthNode' | 'SouthNode' | `lot:${string}` | {
    degree: number;
};
/** `a + b − c`. Every traditional lot takes this shape. */
export interface LotFormula {
    a: LotPoint;
    b: LotPoint;
    c: LotPoint;
}
export interface LotDefinition {
    name: string;
    /** The formula for a diurnal chart. */
    day: LotFormula;
    /** The nocturnal formula. Without it the lot is not sect-dependent and the day formula is used. */
    night?: LotFormula;
    /**
     * An escape hatch for lots that do not fit the A+B−C pattern.
     *
     * When present, the day and night formulae are ignored. Not every
     * traditional lot is A+B−C: the Lot of Basis requires choosing the
     * **shorter** arc between two points, which is a conditional.
     *
     * @param resolve gives the longitude of a point, or of another lot
     */
    compute?: (resolve: (point: LotPoint) => number, sect: Sect) => number;
    /** The tradition or source the formula rests on. */
    source: string;
    /** A note, especially where sources disagree. */
    note?: string;
}
/**
 * The seven Hermetic lots.
 *
 * The best-documented set in the ancient sources, appearing in this form in
 * Paulus Alexandrinus and Vettius Valens. Fortune and Spirit underpin the
 * rest.
 */
export declare const HERMETIC_LOTS: Record<string, LotDefinition>;
/**
 * The lots outside the Hermetic seven — chiefly from Valens.
 *
 * Sources are less consistent here than for the Hermetic seven; each one's
 * `note` field records where they diverge.
 *
 * This set is **not self-contained**: `Basis` is defined in terms of Fortune
 * and Spirit, which live in {@link HERMETIC_LOTS}. `calculateLots` resolves
 * such references from {@link ALL_LOTS}, so passing this set on its own works
 * — the two Hermetic lots are computed as intermediates and left out of the
 * result.
 */
export declare const NON_HERMETIC_LOTS: Record<string, LotDefinition>;
/** Every lot that ships with the library. */
export declare const ALL_LOTS: Record<string, LotDefinition>;
/**
 * @deprecated Renamed to {@link NON_HERMETIC_LOTS}, which says what the set
 * actually is. The old name promised "the lots in common use" while excluding
 * Fortune and Spirit — the two most common of all — because it was really
 * "everything in {@link ALL_LOTS} that is not Hermetic". Kept as an alias.
 */
export declare const COMMON_LOTS: Record<string, LotDefinition>;
/** The positions a lot calculation needs. */
export interface ChartPoints {
    ascendant: number;
    midheaven: number;
    sun: number;
    moon: number;
    mercury: number;
    venus: number;
    mars: number;
    jupiter: number;
    saturn: number;
    /** The Moon's north node. Only needed by lots that refer to it. */
    northNode?: number;
}
export interface LotResult {
    key: string;
    name: string;
    longitude: number;
    signIndex: number;
    sign: Sign;
    degreeInSign: number;
    /** Which formula was applied for this lot. */
    sectUsed: Sect;
    /** Whether the lot is sect-dependent; if not, day and night agree. */
    sectDependent: boolean;
    source: string;
    note?: string;
}
/**
 * Calculates the lots.
 *
 * Dependencies resolve themselves: when a lot refers to another, that one is
 * computed first. A circular definition raises an error. A reference to a lot
 * outside `definitions` is resolved from {@link ALL_LOTS}, so any subset of the
 * built-in sets can be passed on its own; only the keys you asked for are
 * returned.
 *
 * ```ts
 * const lots = calculateLots(points, 'day');
 * lots.Fortune.longitude;
 * ```
 *
 * @param sect `'day'`, `'night'`, or the {@link SectResult} from
 *             `determineSect()`. Anything else throws — a mistyped sect must
 *             not quietly produce a day chart.
 */
export declare function calculateLots(points: ChartPoints, sect: Sect | {
    sect: Sect;
}, definitions?: Record<string, LotDefinition>): Record<string, LotResult>;
/** The bodies to gather with `swe.calc()` in order to fill in `ChartPoints`. */
export declare const LOT_REQUIRED_BODIES: readonly [0, 1, 2, 3, 4, 5, 6];
/**
 * Alternative formulae for the same lot, from different traditions.
 *
 * Traditional sources genuinely disagree about some lots, and astrology
 * software exposes that disagreement as a setting. Rather than pick a
 * "correct" one and hide the rest, the well-documented variants are named and
 * selectable — which also makes it possible to see **why** another program
 * gives a different answer.
 *
 * ```ts
 * calculateLots(points, sect, { ...ALL_LOTS, ...LOT_VARIANTS.FortuneNoSect });
 * ```
 */
export declare const LOT_VARIANTS: Record<string, Record<string, LotDefinition>>;
//# sourceMappingURL=lots.d.ts.map