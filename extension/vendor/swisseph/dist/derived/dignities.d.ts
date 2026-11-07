/**
 * Essential dignities and rulerships.
 *
 * Pure table work — Swiss Ephemeris gives the position, this layer says what
 * the tradition takes that position to mean.
 *
 * Five essential dignities: domicile, exaltation, triplicity, terms (bounds)
 * and faces (decans). Detriment and fall are the opposites of domicile and
 * exaltation, so they are derived rather than tabulated.
 *
 * Triplicity rulers and terms depend on **sect**; the determination in
 * `sect.ts` feeds in here.
 */
import { type Sign } from '../constants.js';
import type { Sect } from './sect.js';
/** The kinds of dignity, in traditional order of weight. */
export type DignityKind = 'domicile' | 'exaltation' | 'triplicity' | 'term' | 'face' | 'detriment' | 'fall' | 'peregrine';
/** The classical seven — the dignity tables cover only these. */
export declare const TRADITIONAL_RULERS: readonly [0, 1, 2, 3, 4, 5, 6];
/**
 * Domicile, the traditional assignment, indexed by sign (0 = Aries).
 *
 * Modern astrology gives Scorpio to Pluto, Aquarius to Uranus and Pisces to
 * Neptune; {@link MODERN_RULERS} carries that separately. The traditional
 * techniques — dignity scoring, profection, firdaria — need the classical
 * assignment.
 */
export declare const DOMICILE: readonly number[];
/** The modern outer-planet assignments. Differs from traditional in three signs. */
export declare const MODERN_RULERS: readonly number[];
/** Exaltation degrees: body to absolute longitude (0 = 0° Aries). */
export declare const EXALTATION: Readonly<Record<number, number>>;
export declare const FACES: readonly number[];
/** A sign's element: 0 fire, 1 earth, 2 air, 3 water. */
export declare const elementOf: (signIndex: number) => number;
export interface DignityReport {
    body: number;
    longitude: number;
    signIndex: number;
    sign: Sign;
    degreeInSign: number;
    /** The traditional lord of this sign. */
    domicileRuler: number;
    /** The triplicity ruler, chosen by sect. */
    triplicityRuler: number;
    /** The ruler of the term the body falls in. */
    termRuler: number;
    /** The ruler of the face the body falls in. */
    faceRuler: number;
    /** The dignities the body holds at this position, in order of weight. */
    dignities: DignityKind[];
    /**
     * Classical scoring: domicile 5, exaltation 4, triplicity 3, term 2,
     * face 1; detriment −5, fall −4. Zero means peregrine — no dignity at all.
     */
    score: number;
}
/**
 * Evaluates a body's essential dignities at a given longitude.
 *
 * Only meaningful for the classical seven; the outer planets have no place in
 * the traditional tables and come back with an empty `dignities` list.
 */
export declare function evaluateDignities(body: number, longitude: number, sect: Sect): DignityReport;
/** A sign's ruler, traditional or modern. */
export declare function rulerOfSign(signIndex: number, modern?: boolean): number;
/** The term divisions of a sign — for display and inspection. */
export declare function termsOfSign(signIndex: number): {
    ruler: number;
    from: number;
    to: number;
}[];
//# sourceMappingURL=dignities.d.ts.map