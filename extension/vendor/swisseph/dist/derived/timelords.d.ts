/**
 * Time-lord techniques: annual profections and Persian firdaria.
 *
 * Both are pure arithmetic over a birth moment — no ephemeris involved — but
 * both hide a decision that changes every result: **how long a year is**.
 * Traditions used the Egyptian 365-day year, the Julian 365.25, or the
 * tropical year; modern software mostly uses the tropical year without
 * saying so. Over a 75-year firdaria cycle the Egyptian and tropical years
 * drift about 18 days apart, which is enough to move a sub-period boundary
 * past a transit you were trying to date. The length is an explicit option
 * here, and the default is stated.
 */
import { type Sign } from '../constants.js';
import type { Sect } from './sect.js';
/** Mean tropical year in days at J2000. The default throughout this module. */
export declare const TROPICAL_YEAR = 365.24219;
/** The Julian year — 365.25 days. Used by some traditional sources. */
export declare const JULIAN_YEAR = 365.25;
/** The Egyptian civil year — exactly 365 days, no intercalation. */
export declare const EGYPTIAN_YEAR = 365;
export interface ProfectionOptions {
    /** Days per year. Defaults to {@link TROPICAL_YEAR}. */
    yearLength?: number;
    /** Use modern rulerships (Pluto, Uranus, Neptune) for the lord. */
    modernRulers?: boolean;
    /**
     * Completed years of age, when you have computed it another way — for
     * instance from exact solar returns rather than a fixed year length.
     * Overrides the elapsed-time calculation.
     */
    age?: number;
}
export interface ProfectedUnit {
    /**
     * The activated natal house, 1–12 — counted from the natal Ascendant, for
     * the year, the month and the day alike.
     *
     * This is the house you would quote: if the profected month falls in the
     * sign occupying the natal seventh, `house` is 7. It is **not** the position
     * of the unit within its parent period; that is `month.index` and
     * `day.index`.
     */
    house: number;
    signIndex: number;
    sign: Sign;
    /** Ruler of the profected sign — the lord of the period. */
    lord: number;
}
export interface Profection extends ProfectedUnit {
    /** Completed years since birth. */
    age: number;
    /** How far through the profection year, 0–1. */
    yearFraction: number;
    /** The profected month: the year divided into twelve. */
    month: ProfectedUnit & {
        index: number;
    };
    /** The profected day: the month divided into twelve, roughly 2.5 days. */
    day: ProfectedUnit & {
        index: number;
    };
}
/**
 * Annual, monthly and daily profection from the natal Ascendant.
 *
 * The Ascendant advances one sign per year of life, so the twelfth year
 * returns to the natal sign. Each year subdivides into twelve months and each
 * month into twelve days, the same step applied three times.
 *
 * `house` is the natal house for all three units, counted from the natal
 * Ascendant; `month.index` and `day.index` give the position within the parent
 * period.
 *
 * ```ts
 * const p = profection(natalJd, targetJd, natalAscendant);
 * p.house;        // 1–12, the natal house activated for the year
 * p.month.house;  // 1–12, the natal house the profected month falls in
 * p.month.index;  // 1–12, which month of the profection year it is
 * p.lord;         // Body constant ruling the profected sign
 * ```
 *
 * @param natalJd    birth moment, Julian day
 * @param jd         the moment being examined
 * @param ascendant  natal Ascendant longitude in degrees
 */
export declare function profection(natalJd: number, jd: number, ascendant: number, options?: ProfectionOptions): Profection;
/**
 * Firdaria time lords. The lunar nodes take their turn alongside the seven
 * planets, and Swiss Ephemeris has no body constant for the south node, so
 * lords are named rather than numbered. {@link LORD_BODY} maps the seven
 * planets and the north node to body constants.
 */
export type FirdariaLord = 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn' | 'NorthNode' | 'SouthNode';
export declare const LORD_BODY: Record<FirdariaLord, number | null>;
interface LordSpan {
    lord: FirdariaLord;
    years: number;
}
/**
 * Day-birth sequence. Begins with the Sun and totals 75 years.
 * Abu Ma'shar, transmitted through Bonatti.
 */
export declare const FIRDARIA_DIURNAL: readonly LordSpan[];
/** Night-birth sequence. Begins with the Moon; the same 75 years. */
export declare const FIRDARIA_NOCTURNAL: readonly LordSpan[];
/** Total length of one firdaria cycle, in years. */
export declare const FIRDARIA_CYCLE_YEARS = 75;
export interface FirdariaPeriod {
    lord: FirdariaLord;
    /** Body constant, or null for the south node. */
    body: number | null;
    startJd: number;
    endJd: number;
    /** Length in years, using the year length in force. */
    years: number;
    /**
     * Sub-periods, present on major periods only. The nodes have none — a
     * point on the Moon's orbit was not held to delegate.
     */
    sub?: FirdariaPeriod[];
}
export interface FirdariaOptions {
    /** Days per year. Defaults to {@link TROPICAL_YEAR}. */
    yearLength?: number;
    /**
     * How many 75-year cycles to lay out. Two covers any lifetime; the
     * sequence simply repeats.
     */
    cycles?: number;
}
/**
 * The firdaria sequence from birth.
 *
 * Nine periods totalling 75 years, ordered by sect. Each planetary period
 * divides into seven equal sub-periods that run through the seven planets in
 * the same order, starting from the period's own lord. The two node periods
 * are not subdivided.
 *
 * ```ts
 * const periods = firdaria(natalJd, 'day');
 * periods[0].lord;            // 'Sun' for a day birth
 * periods[0].sub?.[1].lord;   // 'Venus' — next in sequence
 * ```
 */
export declare function firdaria(birthJd: number, sect: Sect, options?: FirdariaOptions): FirdariaPeriod[];
export interface FirdariaAt {
    major: FirdariaPeriod;
    /** Null inside a node period, which has no sub-periods. */
    minor: FirdariaPeriod | null;
    /** Years elapsed since birth, using the year length in force. */
    ageYears: number;
}
/**
 * The firdaria lords in force at a given moment.
 *
 * Returns null when the moment falls outside the cycles laid out — raise
 * `cycles` rather than assuming the sequence stops.
 */
export declare function firdariaAt(birthJd: number, sect: Sect, jd: number, options?: FirdariaOptions): FirdariaAt | null;
export {};
//# sourceMappingURL=timelords.d.ts.map