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
export const ANGLE_EVENTS = ['rise', 'set', 'culminate', 'anticulminate'];
const MINUTES_PER_DAY = 1440;
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
export function eventSeparationMinutes(a, b) {
    const raw = a - b;
    const wrapped = raw - Math.round(raw); // nearest equivalent within ±½ day
    return Math.abs(wrapped) * MINUTES_PER_DAY;
}
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
export function findParans(objects, options = {}) {
    const maxOrbMinutes = options.orbMinutes ?? 30;
    const filter = options.onlyInvolving;
    const contacts = [];
    for (let i = 0; i < objects.length; i++) {
        for (let j = i + 1; j < objects.length; j++) {
            const a = objects[i];
            const b = objects[j];
            if (filter && !filter.includes(a.name) && !filter.includes(b.name))
                continue;
            for (const eventA of ANGLE_EVENTS) {
                const timeA = a.events[eventA];
                if (timeA === undefined)
                    continue;
                for (const eventB of ANGLE_EVENTS) {
                    const timeB = b.events[eventB];
                    if (timeB === undefined)
                        continue;
                    const orbMinutes = eventSeparationMinutes(timeA, timeB);
                    if (orbMinutes > maxOrbMinutes)
                        continue;
                    contacts.push({
                        from: { name: a.name, event: eventA, jd: timeA },
                        to: { name: b.name, event: eventB, jd: timeB },
                        orbMinutes,
                        maxOrbMinutes,
                        strength: 1 - orbMinutes / maxOrbMinutes,
                    });
                }
            }
        }
    }
    return contacts.sort((x, y) => y.strength - x.strength);
}
//# sourceMappingURL=parans.js.map