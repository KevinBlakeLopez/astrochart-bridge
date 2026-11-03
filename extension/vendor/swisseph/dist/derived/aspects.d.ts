/**
 * Aspects between chart points.
 *
 * Pure geometry over longitudes the library already computes. The interesting
 * part is not detecting a 90° separation — it is that **orb schemes genuinely
 * disagree** between traditions, and most libraries hardcode one.
 *
 * Three schemes ship here and custom ones are first-class. Orbs may be
 * attached to the aspect, to the body, or to both; all three conventions
 * exist in practice, so which one applies is an explicit choice.
 */
/** A named angular relationship. */
export interface AspectDefinition {
    name: string;
    /** Exact separation in degrees. */
    angle: number;
    /**
     * Relative strength, used for sorting and for schemes that scale orbs by
     * aspect importance. 1 = major, lower = minor.
     */
    weight: number;
}
/** Ptolemaic aspects — the five recognised by traditional astrology. */
export declare const MAJOR_ASPECTS: Record<string, AspectDefinition>;
/** Minor aspects in common modern use. */
export declare const MINOR_ASPECTS: Record<string, AspectDefinition>;
export declare const ALL_ASPECTS: Record<string, AspectDefinition>;
/**
 * How orbs are decided.
 *
 * `byAspect` gives each aspect a fixed orb. `byBody` gives each body its own
 * orb and combines the two bodies' values. Supply both and `combine` decides
 * how they interact.
 */
export interface OrbScheme {
    name: string;
    /** Orb in degrees, per aspect key. */
    byAspect?: Record<string, number>;
    /** Orb in degrees, per body. */
    byBody?: Record<number, number>;
    /**
     * How two bodies' orbs combine when `byBody` is used.
     * 'mean' averages them, 'max' takes the wider, 'sum' adds them (the
     * traditional "moiety" convention adds each body's half-orb).
     */
    combine?: 'mean' | 'max' | 'sum';
    /** Fallback when neither table covers a pair. */
    fallback: number;
}
/**
 * A common modern scheme: orb depends on the aspect, not the bodies.
 * Widely used in software defaults.
 */
export declare const MODERN_ORBS: OrbScheme;
/**
 * Traditional moiety scheme: each body carries half an orb and two bodies
 * aspect when they are within the sum of their halves. The luminaries get the
 * widest orbs, which is the point of the scheme.
 */
export declare const TRADITIONAL_MOIETIES: OrbScheme;
/** A deliberately tight scheme, useful when only exact contacts matter. */
export declare const TIGHT_ORBS: OrbScheme;
/** A point participating in aspect search. */
export interface AspectPoint {
    /** Label used in results. */
    name: string;
    longitude: number;
    /** Body constant, if this point is a body — required for `byBody` orbs. */
    body?: number;
    /** Degrees per day; enables applying/separating detection. */
    speed?: number;
    /**
     * Points that are **not independent of one another**.
     *
     * {@link findAspects} never pairs two points carrying the same group, and
     * the reason is that the angle between them is not an aspect at all.
     * The Ascendant and the Midheaven are the case that forces this: their
     * separation is a function of latitude and obliquity, nothing else. At 20°
     * it happens to be 89.98°, so a chart there reports an Ascendant–Midheaven
     * square with a 0°01' orb — the tightest contact in the chart, sorted to
     * the top, and carrying no information whatsoever. Every chart at that
     * latitude gets it.
     *
     * Only {@link findAspects} honours this. {@link findAspectsBetween} compares
     * two separate sets, where one chart's angles against another's are a real
     * contact, so it deliberately ignores the group.
     */
    group?: string;
}
export interface Aspect {
    aspect: AspectDefinition;
    from: AspectPoint;
    to: AspectPoint;
    /** Angular separation between the points, 0–180. */
    separation: number;
    /** How far from exact, in degrees. Always positive. */
    orb: number;
    /** The orb allowed for this pair under the chosen scheme. */
    maxOrb: number;
    /**
     * 1 when exact, falling to 0 at the edge of the orb. Multiplied by the
     * aspect's weight, so a wide minor aspect scores below a tight major one.
     */
    strength: number;
    /**
     * True when the faster point is moving toward exactness. Requires `speed`
     * on both points; undefined otherwise.
     */
    applying?: boolean;
}
/** Shortest angular distance between two longitudes, 0–180. */
export declare function separation(a: number, b: number): number;
export interface FindAspectsOptions {
    /** Which aspects to look for. Defaults to the Ptolemaic five. */
    aspects?: Record<string, AspectDefinition>;
    /** Orb scheme. Defaults to {@link MODERN_ORBS}. */
    orbs?: OrbScheme;
}
/**
 * Finds aspects among a set of points.
 *
 * Each unordered pair is examined once, except pairs that share a
 * {@link AspectPoint.group} — those are not independent and are skipped.
 * Results are sorted strongest first.
 *
 * ```ts
 * const aspects = findAspects([
 *   { name: 'Sun', longitude: 54.5, body: Body.Sun, speed: 0.97 },
 *   { name: 'Moon', longitude: 296.9, body: Body.Moon, speed: 12.8 },
 * ], { orbs: TRADITIONAL_MOIETIES });
 * ```
 */
export declare function findAspects(points: AspectPoint[], options?: FindAspectsOptions): Aspect[];
/**
 * Finds aspects between two sets — synastry, transits to a natal chart, or
 * any comparison where within-set pairs are not wanted.
 */
export declare function findAspectsBetween(from: AspectPoint[], to: AspectPoint[], options?: FindAspectsOptions): Aspect[];
//# sourceMappingURL=aspects.d.ts.map