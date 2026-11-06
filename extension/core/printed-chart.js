import { utcFromOffset, ZONE_OFFSETS } from "./civiltime.js";
import { SIDEREAL_TOLERANCE_SECONDS, siderealGap } from "./sidereal.js";

const refused = (reason) => ({ kind: "refused", reason });

// Minutes east of UTC for the zone labels a desktop program prints next to its
// offset. Ambiguous ones such as BST or IST stay out, as in ZONE_OFFSETS.
const LABEL_OFFSETS = Object.freeze({ ...ZONE_OFFSETS, GMT: 0, UT: 0, UTC: 0 });

// A local-mean-time offset is the longitude at 4 minutes a degree. Programs
// print it to the minute, rounded or cut short, so it can be a minute out.
const LMT_TOLERANCE_MINUTES = 1;

// The Gregorian calendar's first day. The fixed-width local time sorts like
// the dates it writes, so a date before it compares as less.
export const GREGORIAN_START = "1582-10-15";

/**
 * Decides the UTC instant for the birth data a desktop astrology program
 * printed with its chart, as one of the readers for those programs returns
 * it. Every reader turns its program's offset into minutes east of UTC, so
 * nothing here knows which way round the program printed it.
 *
 * The checks are only what the record allows: a weekday must fall on the
 * date, a zone label AstroChart Bridge knows must give the printed offset, "LMT"
 * must fit the longitude, and a sidereal time must fit the UTC and longitude.
 * A record with none of them comes back with the offset-unchecked warning. A
 * record with a Universal Time takes its offset from it, and one that also
 * has an offset must agree with it to the minute. A record with neither
 * an offset nor a Universal Time, from a program that prints none, comes back
 * for the user to enter the offset, as an Astro-Seek page without a Universal
 * Time does.
 *
 * A date before 15 October 1582, when the Gregorian calendar began, is
 * refused before anything else. No program's layout says reliably which
 * calendar such a date is in: Solar Fire and Astro Gold take an unmarked one
 * as Julian, and a date marked Gregorian could still be taken as Julian by
 * astro.com, Astro-Seek or Stellarium. A Julian date would fail the weekday,
 * Julian Day and sidereal checks as a misreading, so the calendar goes first.
 *
 * @param {{ site: string, local: string, lat: number, lng: number, zoneLabel: string | null,
 *   offsetMinutes?: number, utc?: string, siderealSeconds?: number, weekday?: number }} chart
 *   local is the wall-clock time, e.g. "2024-04-17T08:00:00"; offsetMinutes is
 *   minutes east of UTC and runs to the second, as a fraction, when the program
 *   printed seconds; utc is a printed Universal Time, e.g. "2024-04-17T12:00:00Z";
 *   siderealSeconds is a printed local sidereal time, counted from midnight;
 *   weekday is 0 for Sunday, as Date#getUTCDay counts
 * @returns {{ kind: "natal", site: string, local: string, zoneLabel: string | null, lat: number, lng: number }
 *     & ({ utc: string, utcSource: "declared" | "printed", offsetMinutes: number, warnings?: ["offset-unchecked"] }
 *       | { utc: null, utcSource: "needs-offset", reason: "no-printed-offset" })
 *   | { kind: "refused", reason: "calendar-unsupported" | "weekday-mismatch" | "zone-offset-mismatch" | "offset-out-of-range"
 *       | "sidereal-mismatch" }}
 */
export function resolvePrinted({ site, local, lat, lng, zoneLabel, offsetMinutes: declared, utc: printedUtc, siderealSeconds, weekday }) {
  if (local < GREGORIAN_START) return refused("calendar-unsupported");
  if (weekday !== undefined && new Date(`${local.slice(0, 10)}T00:00:00Z`).getUTCDay() !== weekday) {
    return refused("weekday-mismatch");
  }
  if (declared === undefined && printedUtc === undefined) {
    return { kind: "natal", site, local, zoneLabel, lat, lng, utc: null, utcSource: "needs-offset", reason: "no-printed-offset" };
  }
  const offsetMinutes = printedUtc === undefined ? declared : (Date.parse(`${local}Z`) - Date.parse(printedUtc)) / 60_000;
  // A program that prints both can round one of them, as a local-mean-time
  // offset from a longitude printed to the minute.
  if (declared !== undefined && Math.abs(declared - offsetMinutes) > 1) return refused("zone-offset-mismatch");
  // -12:00 to +14:00 is the range parseOffset accepts. A local-mean-time
  // offset falls inside it too: 180° is 12 hours.
  if (offsetMinutes < -720 || offsetMinutes > 840) return refused("offset-out-of-range");

  // An offset and a Universal Time that agree check each other.
  let checked = declared !== undefined && printedUtc !== undefined;
  if (zoneLabel === "LMT") {
    if (Math.abs(offsetMinutes - lng * 4) > LMT_TOLERANCE_MINUTES) return refused("zone-offset-mismatch");
    checked = true;
  } else if (zoneLabel !== null && Object.hasOwn(LABEL_OFFSETS, zoneLabel)) {
    if (LABEL_OFFSETS[zoneLabel] !== offsetMinutes) return refused("zone-offset-mismatch");
    checked = true;
  }

  const utc = printedUtc ?? utcFromOffset(local, offsetMinutes);
  if (siderealSeconds !== undefined) {
    if (siderealGap(utc, lng, siderealSeconds) > SIDEREAL_TOLERANCE_SECONDS) return refused("sidereal-mismatch");
    checked = true;
  }

  return {
    kind: "natal",
    site,
    local,
    zoneLabel,
    lat,
    lng,
    utc,
    utcSource: printedUtc === undefined ? "declared" : "printed",
    offsetMinutes,
    ...(checked ? {} : { warnings: ["offset-unchecked"] }),
  };
}

/**
 * resolvePrinted for each of the readings a reader couldn't choose between,
 * such as a date that reads as 3 February or 2 March: the one reading whose
 * checks pass, or the first reading's refusal when none do.
 *
 * @param {Parameters<typeof resolvePrinted>[0][]} readings
 * @returns {ReturnType<typeof resolvePrinted> | { kind: "refused", reason: "ambiguous-screenshot" }}
 */
export function resolveReadings(readings) {
  const results = readings.map(resolvePrinted);
  const fitting = results.filter((result) => result.kind !== "refused");
  if (fitting.length > 1) return refused("ambiguous-screenshot");
  return fitting[0] ?? results[0];
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** "July" or "Jul" in any case → 7; 0 for anything else. */
export function monthNumber(name) {
  const lower = name.toLowerCase();
  return MONTHS.findIndex((month) => lower === month || lower === month.slice(0, 3)) + 1;
}

/** "Saturday" or "Sat" in any case → 6, as Date#getUTCDay counts; -1 for anything else. */
export function weekdayNumber(name) {
  const lower = name.toLowerCase();
  return WEEKDAYS.findIndex((day) => lower === day || lower === day.slice(0, 3));
}

/**
 * A wall-clock time as "1942-04-24T05:04:00", or null when the date isn't on
 * the calendar or the clock doesn't fit a day.
 *
 * @param {{ year: number, month: number, day: number, hour: number, minute: number, second?: number }} time
 */
export function localIso({ year, month, day, hour, minute, second = 0 }) {
  // Date.UTC takes years 0 to 99 for 1900 to 1999, so the year is set apart.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  const onCalendar = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!onCalendar || hour > 23 || minute > 59 || second > 59) return null;
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/**
 * Signed decimal degrees, rounded to 6 decimals like the other readers, or
 * null when the minutes or seconds don't fit or the value passes limit.
 * "0 - value" keeps 0°0'W at 0 instead of -0.
 */
export function angle({ deg, min, sec = 0, negative, limit }) {
  if (min > 59 || sec > 59) return null;
  const value = Math.round((deg + min / 60 + sec / 3600) * 1e6) / 1e6;
  if (value > limit) return null;
  return negative ? 0 - value : value;
}

/** The text's lines with their spaces closed up, and no empty ones. */
export const linesOf = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const pad = (n, width = 2) => String(n).padStart(width, "0");
