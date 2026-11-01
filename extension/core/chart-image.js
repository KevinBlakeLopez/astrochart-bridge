import { utcFromOffset } from "./civiltime.js";
import { SIDEREAL_TOLERANCE_SECONDS, siderealGap } from "./sidereal.js";

const DAY_MS = 86_400_000;

const refused = (reason) => ({ kind: "refused", reason });

/**
 * Decides the UTC instant for an astro.com chart image header. The header
 * prints Univ.Time without a date and Sid. Time to the second, so the date is
 * the one whose sidereal time matches.
 *
 * The checks are there for misreads. Sidereal time covers the UT, its date
 * and the longitude, but comes back to nearly the same value a year later, so
 * the printed weekday covers the year. Nothing covers the latitude.
 *
 * @param {{ local: string, weekday: number, utMinutes: number, siderealSeconds: number, lng: number }} header
 *   local is the wall-clock time, e.g. "2024-04-17T08:00:00"; weekday is 0 for
 *   Sunday, as Date#getUTCDay counts; utMinutes and siderealSeconds count from
 *   midnight; lng is degrees east
 * @returns {{ utc: string, utcSource: "printed", offsetMinutes: number, siderealErrorSeconds: number }
 *   | { kind: "refused", reason: "weekday-mismatch" | "sidereal-mismatch" }}
 */
export function resolveHeaderUtc({ local, weekday, utMinutes, siderealSeconds, lng }) {
  const localDayMs = Date.parse(`${local.slice(0, 10)}T00:00:00Z`);
  if (new Date(localDayMs).getUTCDay() !== weekday) return refused("weekday-mismatch");

  // UT falls on the local date, the day before or the day after. Each choice
  // gives an offset; only -12:00 to +14:00, the range parseOffset accepts, are
  // real. Like resolveUtc, this takes the printed UT as the time with its
  // seconds dropped, so the offset is worked out to the minute.
  const wallMs = Date.parse(`${local}Z`);
  const readings = [-1, 0, 1]
    .map((days) => Math.floor((wallMs - (localDayMs + days * DAY_MS + utMinutes * 60_000)) / 60_000))
    .filter((offsetMinutes) => offsetMinutes >= -720 && offsetMinutes <= 840)
    .map((offsetMinutes) => {
      const utc = utcFromOffset(local, offsetMinutes);
      return { utc, offsetMinutes, error: siderealGap(utc, lng, siderealSeconds) };
    });

  const best = readings.reduce((a, b) => (b.error < a.error ? b : a));
  if (best.error > SIDEREAL_TOLERANCE_SECONDS) return refused("sidereal-mismatch");
  return {
    utc: best.utc,
    utcSource: "printed",
    offsetMinutes: best.offsetMinutes,
    siderealErrorSeconds: Math.round(best.error),
  };
}
