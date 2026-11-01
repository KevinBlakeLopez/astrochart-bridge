import { isoUtc } from "./civiltime.js";
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
 * @param {{ local: string, weekday: number, utMinutes: number, utSecond?: number, siderealSeconds: number, lng: number }} header
 *   local is the wall-clock time, e.g. "2024-04-17T08:00:00"; weekday is 0 for
 *   Sunday, as Date#getUTCDay counts; utMinutes and siderealSeconds count from
 *   midnight; utSecond is the seconds Univ.Time prints, left out when it prints
 *   none; lng is degrees east
 * @returns {{ utc: string, utcSource: "printed", offsetMinutes: number, siderealErrorSeconds: number }
 *   | { kind: "refused", reason: "weekday-mismatch" | "sidereal-mismatch" }}
 */
export function resolveHeaderUtc({ local, weekday, utMinutes, utSecond, siderealSeconds, lng }) {
  const localDayMs = Date.parse(`${local.slice(0, 10)}T00:00:00Z`);
  if (new Date(localDayMs).getUTCDay() !== weekday) return refused("weekday-mismatch");

  // UT falls on the local date, the day before or the day after. Each choice
  // gives an offset; only -12:00 to +14:00, the range parseOffset accepts, are
  // real. When Univ.Time prints no seconds, this takes it, like resolveUtc, as
  // the time with its seconds dropped, so the offset is worked out to the
  // minute. A local-mean-time chart prints them, since its offset runs to the
  // second, and then the UT is taken as printed.
  const wallMs = Date.parse(`${local}Z`);
  const utMs = (utMinutes * 60 + (utSecond ?? 0)) * 1000;
  const readings = [-1, 0, 1]
    .map((days) => {
      const offsetMs = wallMs - (localDayMs + days * DAY_MS + utMs);
      return utSecond === undefined ? Math.floor(offsetMs / 60_000) * 60_000 : offsetMs;
    })
    .filter((offsetMs) => offsetMs >= -720 * 60_000 && offsetMs <= 840 * 60_000)
    .map((offsetMs) => {
      const utc = isoUtc(wallMs - offsetMs);
      return { utc, offsetMinutes: offsetMs / 60_000, error: siderealGap(utc, lng, siderealSeconds) };
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

// The header of astro.com's chart image as OCR reads it, one line of the image
// per line, each followed by whatever OCR made of the wheel beside it:
//   We., 26 July 1645 Time: 7:30:03 a.m. LMT
//   London, ENG (UK) Univ.Time: 7:30:43
//   0w10, 51n30 Sid. Time: 3:47:11
// OCR has read a clock time's colons as "-" or as nothing ("7-30-03",
// "347-11", "34711"), so its separators are optional. Minutes and seconds
// always have two digits, and the hour is tried with one digit first, so the
// digits split one way only. resolveHeaderUtc's Sid. Time check catches a
// misread Univ.Time or Sid. Time; nothing but the offset's range catches a
// misread Time.
const CLOCK = String.raw`(\d{1,2}?)[:.-]?(\d{2})(?:[:.-]?(\d{2}))?(?!\d)`;
// The weekday, date and local time. The time is always read with its a.m. or
// p.m.: without one, the hour could be 12 out.
const DATE_LINE = new RegExp(
  String.raw`^(Mo|Tu|We|Th|Fr|Sa|Su)\.,? (\d{1,2}) ([A-Za-z]+) (\d{1,4}) Time\W*${CLOCK} ?([ap])\.? ?m\b`,
);
// The place name comes first, so Univ.Time is found anywhere in its line.
const UT_LINE = new RegExp(String.raw`Univ\W*Time\W*${CLOCK}`);
// Longitude, latitude, then Sid. Time, which OCR has also read as "Sd. Time".
// A leading 0 has come out as the letter O.
const COORDS_LINE = new RegExp(
  String.raw`^([\dO]{1,3})([ew])(\d{2}), ?([\dO]{1,2})([ns])(\d{2}) S[il]?d\W*Time\W*${CLOCK}`,
);

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Reads the OCR text of a screenshot of an astro.com chart image: the values
 * resolveHeaderUtc takes, and the latitude, which nothing checks. Anything
 * not in a form seen in a header is refused, not guessed.
 *
 * @param {string} text  OCR output, one line of the image per line
 * @returns {{ local: string, weekday: number, utMinutes: number, utSecond?: number, siderealSeconds: number, lat: number, lng: number }
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" }}
 */
export function readHeader(text) {
  const lines = text.split("\n").map((line) => line.replace(/\s+/g, " ").trim());
  const found = {};
  for (const [name, pattern] of Object.entries({ date: DATE_LINE, ut: UT_LINE, coords: COORDS_LINE })) {
    const matches = lines.map((line) => pattern.exec(line)).filter(Boolean);
    // Two headers mean two charts, as in a synastry drawing.
    if (matches.length > 1) return refused("ambiguous-screenshot");
    if (matches.length === 0) return refused("unreadable-screenshot");
    found[name] = matches[0];
  }

  const [, weekdayCode, day, monthName, year, ...localClock] = found.date;
  const date = { year: Number(year), month: monthNumber(monthName), day: Number(day) };
  const local = twelveHourClock(localClock);
  const ut = clock(found.ut.slice(1));
  const [, lngDeg, lngSide, lngMin, latDeg, latSide, latMin, ...siderealClock] = found.coords;
  const sidereal = clock(siderealClock);
  const lng = degrees(lngDeg, lngMin, lngSide === "w", 180);
  const lat = degrees(latDeg, latMin, latSide === "s", 90);
  if (!isCalendarDate(date) || !local || !ut || !sidereal || sidereal.second === undefined || lng === null || lat === null) {
    return refused("unreadable-screenshot");
  }

  return {
    local: `${isoDate(date)}T${pad(local.hour)}:${pad(local.minute)}:${pad(local.second ?? 0)}`,
    weekday: WEEKDAYS.indexOf(weekdayCode),
    utMinutes: ut.hour * 60 + ut.minute,
    ...(ut.second === undefined ? {} : { utSecond: ut.second }),
    siderealSeconds: sidereal.hour * 3600 + sidereal.minute * 60 + sidereal.second,
    lat,
    lng,
  };
}

// The groups of CLOCK as a 24-hour time, or null. second is undefined when
// none was printed.
function clock([hour, minute, second]) {
  const time = { hour: Number(hour), minute: Number(minute), second: second === undefined ? undefined : Number(second) };
  return time.hour <= 23 && time.minute <= 59 && (time.second ?? 0) <= 59 ? time : null;
}

// The groups of CLOCK, then "a" or "p", as a 24-hour time, or null.
function twelveHourClock([hour, minute, second, half]) {
  const time = clock([hour, minute, second]);
  if (!time || time.hour < 1 || time.hour > 12) return null;
  // 12 a.m. is midnight, 12 p.m. noon.
  return { ...time, hour: (time.hour % 12) + (half === "p" ? 12 : 0) };
}

// "July" or "Jul" → 7; NaN for anything else, which isCalendarDate refuses.
function monthNumber(name) {
  const lower = name.toLowerCase();
  const index = MONTHS.findIndex((month) => lower === month || lower === month.slice(0, 3));
  return index === -1 ? NaN : index + 1;
}

// Signed decimal degrees, rounded to 6 decimals like the other readers, or
// null past the limit. "0 - value" keeps 0°0'W at 0 instead of -0.
function degrees(deg, min, negative, limit) {
  const value = Math.round((Number(deg.replaceAll("O", "0")) + Number(min) / 60) * 1e6) / 1e6;
  if (Number(min) > 59 || value > limit) return null;
  return negative ? 0 - value : value;
}

function isCalendarDate({ year, month, day }) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pad = (n, width = 2) => String(n).padStart(width, "0");

const isoDate = ({ year, month, day }) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
