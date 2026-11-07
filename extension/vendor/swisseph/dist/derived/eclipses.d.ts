/**
 * Eclipse result types and flag decoding.
 *
 * Swiss Ephemeris returns eclipse kind and visibility as a bit field and the
 * timings as a bare array of doubles whose meaning changes between the solar
 * and lunar calls. This module turns both into named fields, so nobody has to
 * remember that `tret[4]` is the start of totality in one call and something
 * else in another.
 *
 * The finding itself is `SwissEph#solarEclipse()` / `#lunarEclipse()`.
 */
export type SolarEclipseKind = 'total' | 'annular' | 'hybrid' | 'partial';
export type LunarEclipseKind = 'total' | 'partial' | 'penumbral';
/**
 * Reads the eclipse kind out of the returned flags.
 *
 * Order matters: a hybrid eclipse sets both the annular-total bit and,
 * depending on the call, the total or annular bit as well, so it has to be
 * tested first or it would be reported as one of its two halves.
 */
export declare function solarEclipseKind(flags: number): SolarEclipseKind;
export declare function lunarEclipseKind(flags: number): LunarEclipseKind;
/** Timings shared by both kinds of eclipse. Julian days, UT. */
export interface EclipseTimings {
    /** Maximum eclipse. */
    maximum: number;
    /** Start of the partial phase. Absent for a purely penumbral eclipse. */
    partialBegin?: number;
    partialEnd?: number;
    /** Start of totality. Absent unless the eclipse is total. */
    totalityBegin?: number;
    totalityEnd?: number;
}
export interface SolarEclipse {
    kind: SolarEclipseKind;
    /** True when the shadow axis meets the Earth. */
    central: boolean;
    timings: EclipseTimings & {
        /** Start and end of the central line, global searches only. */
        centreLineBegin?: number;
        centreLineEnd?: number;
        /** When the eclipse happens at local apparent noon, global searches only. */
        localNoon?: number;
        /** Sunrise and sunset inside the eclipse, local searches only. */
        sunrise?: number;
        sunset?: number;
    };
    /** Raw flags, for anything this type does not surface. */
    flags: number;
    /** Present for local searches. */
    local?: SolarEclipseLocal;
}
export interface SolarEclipseLocal {
    /** Fraction of the Sun's diameter covered — the magnitude. */
    magnitude: number;
    /** Fraction of the Sun's disc covered. Not the same as magnitude. */
    obscuration: number;
    /** Ratio of the lunar diameter to the solar one. */
    diameterRatio: number;
    /** Diameter of the core shadow, kilometres. */
    coreShadowKm: number;
    /** Sun's azimuth at maximum. */
    azimuth: number;
    /** Sun's true altitude at maximum. Negative means below the horizon. */
    altitude: number;
    apparentAltitude: number;
    /** Magnitude as NASA reports it, which differs from `magnitude`. */
    nasaMagnitude: number;
    /** Saros series number, and the member's place within it. */
    saros: number;
    sarosMember: number;
    /** True when the eclipse is visible from the place asked about. */
    visible: boolean;
}
export interface LunarEclipse {
    kind: LunarEclipseKind;
    timings: EclipseTimings & {
        penumbralBegin?: number;
        penumbralEnd?: number;
        /** Moonrise and moonset during the eclipse, local searches only. */
        moonrise?: number;
        moonset?: number;
    };
    flags: number;
    local?: LunarEclipseLocal;
}
export interface LunarEclipseLocal {
    /** Umbral magnitude. */
    magnitude: number;
    penumbralMagnitude: number;
    azimuth: number;
    altitude: number;
    apparentAltitude: number;
    saros: number;
    sarosMember: number;
    visible: boolean;
}
/**
 * A returned time of zero means the phase did not occur.
 *
 * Swiss Ephemeris leaves the slot untouched rather than signalling absence,
 * and the buffer is zeroed before each call, so zero is the marker. A real
 * Julian day is never zero — that would be 4713 BCE, outside every ephemeris
 * this library can reach.
 */
export declare function optionalTime(value: number): number | undefined;
//# sourceMappingURL=eclipses.d.ts.map