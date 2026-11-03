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
import { EclipseFlag } from '../constants.js';
/**
 * Reads the eclipse kind out of the returned flags.
 *
 * Order matters: a hybrid eclipse sets both the annular-total bit and,
 * depending on the call, the total or annular bit as well, so it has to be
 * tested first or it would be reported as one of its two halves.
 */
export function solarEclipseKind(flags) {
    if (flags & EclipseFlag.AnnularTotal)
        return 'hybrid';
    if (flags & EclipseFlag.Total)
        return 'total';
    if (flags & EclipseFlag.Annular)
        return 'annular';
    return 'partial';
}
export function lunarEclipseKind(flags) {
    if (flags & EclipseFlag.Total)
        return 'total';
    if (flags & EclipseFlag.Partial)
        return 'partial';
    return 'penumbral';
}
/**
 * A returned time of zero means the phase did not occur.
 *
 * Swiss Ephemeris leaves the slot untouched rather than signalling absence,
 * and the buffer is zeroed before each call, so zero is the marker. A real
 * Julian day is never zero — that would be 4713 BCE, outside every ephemeris
 * this library can reach.
 */
export function optionalTime(value) {
    return value === 0 ? undefined : value;
}
//# sourceMappingURL=eclipses.js.map