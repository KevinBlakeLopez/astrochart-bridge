/**
 * Declination: parallels, contraparallels, and out-of-bounds bodies.
 *
 * Longitude is only half of a position. Two bodies can be 90° apart in the
 * zodiac and still sit on the same small circle of declination, which
 * traditional and modern practice both read as a conjunction-like tie. Most
 * JavaScript astrology libraries never expose declination at all.
 *
 * The values themselves come from the ephemeris — ask for equatorial
 * coordinates and declination is the second component. This module is the
 * geometry laid over them.
 */
/**
 * Mean obliquity of the ecliptic at J2000.0, in degrees.
 *
 * 84381.406 arcseconds, the IAU 2006 value — which is what Swiss Ephemeris
 * itself returns. The older IAU 1976 figure of 84381.448″ (23.4392911°) is
 * still widely quoted and differs by 0.042″; using it here would put this
 * constant permanently at odds with the library's own numbers.
 *
 * A convenience default only. Obliquity decreases by roughly 47 arcseconds
 * per century, so over the ±600-year span the data package covers it moves
 * about 0.08° — enough to flip a body sitting near the boundary from
 * in-bounds to out-of-bounds. Pass the true obliquity for the date when it
 * matters; `SwissEph#obliquity()` returns it.
 */
export const OBLIQUITY_J2000 = 23.4392794;
/**
 * Finds declination aspects among a set of points.
 *
 * A **parallel** holds when two declinations are equal within orb; a
 * **contraparallel** when they are equal in size and opposite in sign.
 *
 * Near the celestial equator both can be true at once — at +0.3° and −0.3°
 * the two declinations differ by 0.6° *and* sum to 0°, so under a 1° orb the
 * pair is both parallel and contraparallel. That is a real property of the
 * geometry, not a bug, and both are reported. Filter by `kind` if your
 * tradition admits only one.
 *
 * ```ts
 * const ties = findDeclinationAspects([
 *   { name: 'Sun', declination: 21.3 },
 *   { name: 'Venus', declination: 20.9 },
 * ]);
 * ```
 */
export function findDeclinationAspects(points, options = {}) {
    const maxOrb = options.orb ?? 1;
    const includeContra = options.includeContraparallel ?? true;
    const found = [];
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const from = points[i];
            const to = points[j];
            const parallelOrb = Math.abs(from.declination - to.declination);
            if (parallelOrb <= maxOrb) {
                found.push({
                    kind: 'parallel', from, to,
                    orb: parallelOrb, maxOrb, strength: 1 - parallelOrb / maxOrb,
                    ...applyingState(from, to, 'parallel'),
                });
            }
            if (!includeContra)
                continue;
            const contraOrb = Math.abs(from.declination + to.declination);
            if (contraOrb <= maxOrb) {
                found.push({
                    kind: 'contraparallel', from, to,
                    orb: contraOrb, maxOrb, strength: 1 - contraOrb / maxOrb,
                    ...applyingState(from, to, 'contraparallel'),
                });
            }
        }
    }
    return found.sort((a, b) => b.strength - a.strength);
}
/**
 * Whether the tie is closing.
 *
 * The orb is `|δ₁ − δ₂|` for a parallel and `|δ₁ + δ₂|` for a contraparallel,
 * so the tie is applying exactly when that derivative is negative:
 *
 *   d(orb)/dt = sign(gap) · (speed₁ ∓ speed₂)
 *
 * This used a finite step of 0.01 days, the same one the longitude engine
 * used, and it carried the same defect: when the step was wider than twice
 * the orb it stepped **past** exactness and called a closing tie separating.
 * Declination speeds are small, so the window was narrow — but it sat right
 * at exactness, which is the only place a parallel is interesting.
 *
 * A body reversing across its solstice point still needs no special case: the
 * reversal is already in the sign of its declination speed.
 */
function applyingState(from, to, kind) {
    if (from.speed === undefined || to.speed === undefined)
        return {};
    const parallel = kind === 'parallel';
    const gap = parallel
        ? from.declination - to.declination
        : from.declination + to.declination;
    const gapRate = parallel ? from.speed - to.speed : from.speed + to.speed;
    return { applying: Math.sign(gap) * gapRate < 0 };
}
/**
 * Flags bodies whose declination exceeds the Sun's maximum — "out of bounds".
 *
 * The Sun cannot pass the obliquity of the ecliptic, so a body beyond it is
 * outside the band the Sun ever reaches. The Moon, Mercury, Venus, Mars and
 * Pluto all manage it; Jupiter through Neptune effectively never do.
 *
 * The limit is the obliquity, which drifts. Pass the value for the date
 * rather than relying on the J2000 default when a body sits near the edge.
 */
export function outOfBounds(points, obliquity = OBLIQUITY_J2000) {
    return points.map((p) => {
        const excess = Math.abs(p.declination) - obliquity;
        return {
            name: p.name,
            declination: p.declination,
            outOfBounds: excess > 0,
            excess,
            limit: obliquity,
            hemisphere: p.declination >= 0 ? 'north' : 'south',
        };
    });
}
//# sourceMappingURL=declination.js.map