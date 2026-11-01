// J2000.0, the epoch the formula counts days from.
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86_400_000;
const SIDEREAL_DAY_SECONDS = 86_400;

// Universal Time is printed to the minute, so a birth time with seconds can put
// the real UT up to a minute after it. Readings a day apart differ by 236.6 s of
// sidereal time, so at most one of them can come this close. Astro-Seek's
// printed LST was within 1.6 s of localSiderealSeconds on every fixture.
export const SIDEREAL_TOLERANCE_SECONDS = 90;

// "2024-04-17T12:00:00Z", the form utcFromOffset returns. Date.parse reads a
// time without the Z in the computer's time zone, which would shift the result.
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * Local mean sidereal time, in seconds after sidereal midnight, for a UTC
 * instant and a longitude in degrees east.
 *
 * Greenwich mean sidereal time comes from the USNO's linear formula,
 * 18.697374558 h + 24.06570982441908 h per day since J2000.0, which loses about
 * 0.1 s per century away from 2000. It is mean sidereal time: the equation of
 * the equinoxes, at most about 1.2 s, is left out. UTC stands in for UT1, which
 * differs by less than a second.
 *
 * Throws on anything but a UTC instant, like stellariumUrl: that is a bug in
 * the caller, not something to explain to the user.
 *
 * @param {string} utc  e.g. "2024-04-17T12:00:00Z"
 * @param {number} lng  degrees east, negative for west
 * @returns {number}  0 up to, but not including, 86400
 */
export function localSiderealSeconds(utc, lng) {
  if (typeof utc !== "string" || !UTC_INSTANT.test(utc)) {
    throw new Error(`localSiderealSeconds needs a UTC instant like 2024-04-17T12:00:00Z, got ${utc}`);
  }
  const days = (Date.parse(utc) - J2000_MS) / DAY_MS;
  const hours = 18.697374558 + 24.06570982441908 * days + lng / 15;
  return (((hours % 24) + 24) % 24) * 3600;
}

/**
 * Seconds between the sidereal time for a UTC instant and longitude and a
 * printed one, the short way round sidereal midnight.
 *
 * @param {string} utc
 * @param {number} lng  degrees east
 * @param {number} printedSeconds  the printed sidereal time, in seconds after midnight
 * @returns {number}
 */
export function siderealGap(utc, lng, printedSeconds) {
  const gap = Math.abs(localSiderealSeconds(utc, lng) - printedSeconds) % SIDEREAL_DAY_SECONDS;
  return Math.min(gap, SIDEREAL_DAY_SECONDS - gap);
}
