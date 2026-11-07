/**
 * Parans — paranatellonta.
 *
 * Two objects are in paran when each stands on one of the four angles at the
 * same moment: rising, setting, culminating, or anticulminating. It is a
 * relationship in *time* rather than in longitude, which is why a star 40°
 * away in the zodiac can still be tied to a planet.
 *
 * This module does the matching. Producing the event times needs the
 * ephemeris and the observer's latitude — `SwissEph#angleEvents()` does that
 * and feeds the result in here.
 */
/** The four angles an object can occupy. */
export type AngleEvent = 'rise' | 'set' | 'culminate' | 'anticulminate';
export declare const ANGLE_EVENTS: readonly AngleEvent[];
/** When an object reaches each angle. Julian days, UT. */
export interface AngleEventTimes {
    /** Label used in results. */
    name: string;
    /** Body constant, when the object is a body. */
    body?: number;
    /** Catalogue name, when the object is a fixed star. */
    star?: string;
    /**
     * Time of each event. An angle is absent when the object does not reach
     * it — a circumpolar star never rises or sets, though it still culminates.
     */
    events: Partial<Record<AngleEvent, number>>;
    /** True when the object stays above the horizon at this latitude. */
    circumpolar?: boolean;
    /** True when the object never rises at this latitude. */
    neverRises?: boolean;
}
export interface ParanContact {
    from: {
        name: string;
        event: AngleEvent;
        jd: number;
    };
    to: {
        name: string;
        event: AngleEvent;
        jd: number;
    };
    /** How far the two events are apart, in minutes of time. */
    orbMinutes: number;
    maxOrbMinutes: number;
    /** 1 when simultaneous, falling to 0 at the edge of the orb. */
    strength: number;
}
export interface ParanOptions {
    /**
     * Allowed separation in minutes of time.
     *
     * Brady's method fixes a paran by finding the latitude at which the two
     * events are simultaneous, so no orb is needed. Working at a *given*
     * latitude, as a natal chart does, requires one, and sources differ on how
     * wide. The default is 30 minutes; set it to whatever your source says.
     */
    orbMinutes?: number;
    /**
     * Restrict to pairs where one side comes from this list of names. Useful
     * for "which stars touch my planets" without also reporting star-star and
     * planet-planet pairs.
     */
    onlyInvolving?: readonly string[];
}
/**
 * Separation between two event times, in minutes, compared modulo one day.
 *
 * Each of the four events recurs once per rotation, so a rise at 23:50 and a
 * culmination at 00:10 the following day are twenty minutes apart, not
 * twenty-three hours. Comparing raw Julian days would miss every paran that
 * straddles the boundary of the window the events were computed in.
 *
 * The wrap uses a solar day. The recurrence is really a sidereal day for
 * stars and about 24h50m for the Moon, so a pair matched *through* the wrap
 * carries up to a few minutes of extra error. Pairs inside the window — the
 * overwhelming majority — are exact.
 */
export declare function eventSeparationMinutes(a: number, b: number): number;
/**
 * Finds parans among a set of objects whose angle times are known.
 *
 * Each unordered pair of objects is examined at all sixteen combinations of
 * angles; every combination within orb is reported, because an object can
 * legitimately hold two ties to the same partner.
 *
 * ```ts
 * const events = ANGLE_EVENTS.map(...);   // via SwissEph#angleEvents()
 * const parans = findParans(events, { orbMinutes: 20 });
 * ```
 */
export declare function findParans(objects: AngleEventTimes[], options?: ParanOptions): ParanContact[];
//# sourceMappingURL=parans.d.ts.map