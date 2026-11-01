import { utcFromOffset, ZONE_OFFSETS } from "./civiltime.js";

const refused = (reason) => ({ kind: "refused", reason });

// Minutes east of UTC for the zone labels a desktop program prints next to its
// offset. Ambiguous ones such as BST or IST stay out, as in ZONE_OFFSETS.
const LABEL_OFFSETS = Object.freeze({ ...ZONE_OFFSETS, GMT: 0, UT: 0, UTC: 0 });

// A local-mean-time offset is the longitude at 4 minutes a degree. Programs
// print it to the minute, rounded or cut short, so it can be a minute out.
const LMT_TOLERANCE_MINUTES = 1;

/**
 * Decides the UTC instant for the birth data a desktop astrology program
 * printed with its chart, as one of the readers for those programs returns
 * it. Every reader turns its program's offset into minutes east of UTC, so
 * nothing here knows which way round the program printed it.
 *
 * The checks are only what the record allows: a weekday must fall on the
 * date, a zone label Chart Bridge knows must give the printed offset, and
 * "LMT" must fit the longitude. A record with none of them comes back with
 * the offset-unchecked warning. A record without an offset, from a program
 * that prints none, comes back for the user to enter one, as an Astro-Seek
 * page without a Universal Time does.
 *
 * @param {{ site: string, local: string, lat: number, lng: number, zoneLabel: string | null,
 *   offsetMinutes?: number, weekday?: number }} chart
 *   local is the wall-clock time, e.g. "2024-04-17T08:00:00"; offsetMinutes is
 *   minutes east of UTC and runs to the second, as a fraction, when the program
 *   printed seconds; weekday is 0 for Sunday, as Date#getUTCDay counts
 * @returns {{ kind: "natal", site: string, local: string, zoneLabel: string | null, lat: number, lng: number }
 *     & ({ utc: string, utcSource: "declared", offsetMinutes: number, warnings?: ["offset-unchecked"] }
 *       | { utc: null, utcSource: "needs-offset", reason: "no-printed-offset" })
 *   | { kind: "refused", reason: "weekday-mismatch" | "zone-offset-mismatch" | "offset-out-of-range" }}
 */
export function resolvePrinted({ site, local, lat, lng, zoneLabel, offsetMinutes, weekday }) {
  if (weekday !== undefined && new Date(`${local.slice(0, 10)}T00:00:00Z`).getUTCDay() !== weekday) {
    return refused("weekday-mismatch");
  }
  if (offsetMinutes === undefined) {
    return { kind: "natal", site, local, zoneLabel, lat, lng, utc: null, utcSource: "needs-offset", reason: "no-printed-offset" };
  }
  // -12:00 to +14:00 is the range parseOffset accepts. A local-mean-time
  // offset falls inside it too: 180° is 12 hours.
  if (offsetMinutes < -720 || offsetMinutes > 840) return refused("offset-out-of-range");

  let checked = false;
  if (zoneLabel === "LMT") {
    if (Math.abs(offsetMinutes - lng * 4) > LMT_TOLERANCE_MINUTES) return refused("zone-offset-mismatch");
    checked = true;
  } else if (zoneLabel !== null && Object.hasOwn(LABEL_OFFSETS, zoneLabel)) {
    if (LABEL_OFFSETS[zoneLabel] !== offsetMinutes) return refused("zone-offset-mismatch");
    checked = true;
  }

  return {
    kind: "natal",
    site,
    local,
    zoneLabel,
    lat,
    lng,
    utc: utcFromOffset(local, offsetMinutes),
    utcSource: "declared",
    offsetMinutes,
    ...(checked ? {} : { warnings: ["offset-unchecked"] }),
  };
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
