import { angle, linesOf, localIso, monthNumber, weekdayNumber } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Solar Fire and Astro Gold, both by Esoteric Technologies, print the same
// chart details block. Solar Fire's, top left of the wheel, as its Solar Fire
// 9 User Guide (2014) shows it and a chart exported from Solar Fire v9.0.19
// prints it:
//   Chart 1
//   July 5 2015              the chart's name, typed by the user
//   Natal Chart
//   Jul 4 2015, Sat
//   11:15 am  MDT +6:00
//   Denver, Colorado
//   39°N44'21" 104°W59'03"
//   Geocentric / Tropical / Whole Signs / True Node, one a line
// Astro Gold's Chart Details panel, beside the wheel, in its macOS and
// Windows user guides:
//   1 - Chart
//   Angelina Jolie
//   Female - Equal
//   4 Jun 1975, Wed
//   9:09 AM PDT +7:00
//   Los Angeles, California
//   34°N03'08" 118°W14'34"
// Astro Gold's wheel prints the same lines without the coordinates.
// Solar Fire's date follows Windows's date order and its time Windows's
// clock, so either can come in two forms. The weekday, the zone label and the
// seconds are printed only by some versions or only when there is something
// to print.

// "24 Apr 1942" or "Jul 4 2015", then OS or NS for Old or New Style, or BC,
// then ", Sat" or ", Saturday".
const DATE = String.raw`(?:(\d{1,2}) ([A-Za-z]{3,9})|([A-Za-z]{3,9}) (\d{1,2})),? (\d{1,4})(?: (OS|NS|BC))?(?:,? ([A-Za-z]{3,9}))?`;
// "5:04 am", "8:00 PM", "1:25:49 PM", "13:25".
const CLOCK = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?([AaPp])\.?[Mm]\.?)?`;
// "+4:00", "GMT +0:00", "LMT +5:42:58". West of Greenwich is +, as Solar
// Fire's guide says to enter it and Astro Gold prints PDT +7:00.
const ZONE = String.raw`(?:([A-Z]{2,5}) )?([+-])(\d{1,2}):(\d{2})(?::(\d{2}))?`;
// "40°N38'", "39°N44'21"", or with no degree sign or quotes, as on Solar
// Fire's older captions: "51N31". Seconds come out of a PDF as two single quotes.
const LATITUDE = String.raw`(\d{1,2})°?([NS])(\d{2})'?(?:(\d{2})(?:"|''))?`;
const LONGITUDE = String.raw`(\d{1,3})°?([EW])(\d{2})'?(?:(\d{2})(?:"|''))?`;

const whole = (source) => new RegExp(`^${source}$`);
const DATE_TEXT = whole(DATE);
const CLOCK_TEXT = whole(CLOCK);
const ZONE_TEXT = whole(ZONE);
const LATITUDE_TEXT = whole(LATITUDE);
const LONGITUDE_TEXT = whole(LONGITUDE);
const TIME_LINE = new RegExp(`^(?<clock>${CLOCK}) (?<zone>${ZONE})$`);
const COORDS_LINE = new RegExp(`^(?<lat>${LATITUDE}) (?<lng>${LONGITUDE})$`);

// The line above the date says the chart's kind, in each program's words.
const SOLAR_FIRE_TYPE = /^(?:Natal|Event|Horary) Chart(?: \(\d+\))?$/;
const ASTRO_GOLD_TYPE = /^(?:Natal|Female|Male|Event|Horary)(?: - .+)?$/;

/**
 * Whether a screenshot's text has a Solar Fire or Astro Gold chart details
 * block: a time with an offset on a line of its own. The coordinates aren't
 * needed to recognise it, so a screenshot of Astro Gold's wheel, which prints
 * none, is refused for what it lacks.
 *
 * @param {string} text
 */
export function detect(text) {
  return linesOf(text).some((line) => TIME_LINE.test(line));
}

/**
 * Reads a Solar Fire or Astro Gold chart details block: the record
 * resolvePrinted takes. Neither program prints a Universal Time or sidereal
 * time, so a weekday and a zone label are all there is to check. The site is
 * the program the type line above the date names, or both when it's out of
 * the screenshot.
 *
 * @param {string} text  one line of the block per line
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "no-coordinates"
 *       | "calendar-unsupported" | "apparent-time" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const timeAt = lines.flatMap((line, index) => (TIME_LINE.test(line) ? [index] : []));
  const coordsLines = lines.filter((line) => COORDS_LINE.test(line));
  // Two blocks mean two charts, as on a bi-wheel.
  if (timeAt.length > 1 || coordsLines.length > 1) return refused("ambiguous-screenshot");
  if (timeAt.length === 0) return refused("unreadable-screenshot");
  if (coordsLines.length === 0) return refused("no-coordinates");

  // A chart's name can look like a date too, so the date is only ever read
  // from the line just above the time.
  const at = timeAt[0];
  const { clock, zone } = TIME_LINE.exec(lines[at]).groups;
  const { lat, lng } = COORDS_LINE.exec(coordsLines[0]).groups;
  return chartRecord(siteOf(lines[at - 2] ?? ""), [
    readDate(lines[at - 1] ?? ""),
    readClock(clock),
    readZone(zone),
    readLatitude(lat),
    readLongitude(lng),
  ]);
}

function siteOf(typeLine) {
  if (SOLAR_FIRE_TYPE.test(typeLine)) return "solar-fire";
  if (ASTRO_GOLD_TYPE.test(typeLine)) return "astro-gold";
  return "solar-fire-or-astro-gold";
}

/**
 * The record resolvePrinted takes, from the parts the read* functions below
 * return, or the first part's refusal.
 *
 * @param {string} site
 * @param {object[]} parts  readDate, readClock, readZone, readLatitude and readLongitude's results
 */
export function chartRecord(site, parts) {
  const failed = parts.find((part) => part.kind === "refused");
  if (failed) return failed;
  const { year, month, day, weekday, hour, minute, second, zoneLabel, offsetMinutes, lat, lng } = Object.assign({}, ...parts);
  const local = localIso({ year, month, day, hour, minute, second });
  if (local === null) return refused("unreadable-screenshot");
  return { site, local, lat, lng, zoneLabel, offsetMinutes, ...(weekday === undefined ? {} : { weekday }) };
}

/**
 * "24 Apr 1942", "Jul 4 2015, Sat" → { year, month, day, weekday? }. Chart
 * Bridge counts dates on the Gregorian calendar from year 1, so Old Style and
 * BC are refused.
 */
export function readDate(text) {
  const match = DATE_TEXT.exec(text);
  if (!match) return refused("unreadable-screenshot");
  const [, dayFirst, monthSecond, monthFirst, daySecond, year, style, weekdayName] = match;
  if (style === "OS" || style === "BC") return refused("calendar-unsupported");
  const month = monthNumber(monthSecond ?? monthFirst);
  const weekday = weekdayName === undefined ? undefined : weekdayNumber(weekdayName);
  if (month === 0 || weekday === -1) return refused("unreadable-screenshot");
  return { year: Number(year), month, day: Number(dayFirst ?? daySecond), ...(weekday === undefined ? {} : { weekday }) };
}

/** "5:04 am", "13:25" → { hour, minute, second } on a 24-hour clock. */
export function readClock(text) {
  const match = CLOCK_TEXT.exec(text);
  if (!match) return refused("unreadable-screenshot");
  const [, hour, minute, second, half] = match;
  const clock = clockHour(Number(hour), half);
  if (clock === null) return refused("unreadable-screenshot");
  return { hour: clock, minute: Number(minute), second: Number(second ?? 0) };
}

/**
 * "MDT +6:00" → { zoneLabel: "MDT", offsetMinutes: -360 }. Local apparent
 * time runs on the Sun, not the clock: its offset changes through the year
 * with the equation of time, so it is refused.
 */
export function readZone(text) {
  const match = ZONE_TEXT.exec(text);
  if (!match) return refused("unreadable-screenshot");
  const [, zoneLabel, sign, hours, minutes, seconds] = match;
  if (zoneLabel === "LAT") return refused("apparent-time");
  if (Number(minutes) > 59 || Number(seconds ?? 0) > 59) return refused("unreadable-screenshot");
  // The program's + is west, so its +5:00 is UTC-05:00. "0 - size" keeps
  // -0:00 at 0 instead of -0.
  const size = Number(hours) * 60 + Number(minutes) + Number(seconds ?? 0) / 60;
  return { zoneLabel: zoneLabel ?? null, offsetMinutes: sign === "+" ? 0 - size : size };
}

/** "40°N38'" → { lat: 40.633333 }. */
export function readLatitude(text) {
  const match = LATITUDE_TEXT.exec(text);
  const lat = match && angle({ deg: Number(match[1]), min: Number(match[3]), sec: Number(match[4] ?? 0), negative: match[2] === "S", limit: 90 });
  return lat === null ? refused("unreadable-screenshot") : { lat };
}

/** "073°W56'" → { lng: -73.933333 }. */
export function readLongitude(text) {
  const match = LONGITUDE_TEXT.exec(text);
  const lng = match && angle({ deg: Number(match[1]), min: Number(match[3]), sec: Number(match[4] ?? 0), negative: match[2] === "W", limit: 180 });
  return lng === null ? refused("unreadable-screenshot") : { lng };
}

// 1 to 12 with "a" or "p" as a 24-hour hour; 0 to 23 with neither. null otherwise.
function clockHour(hour, half) {
  if (half === undefined) return hour <= 23 ? hour : null;
  if (hour < 1 || hour > 12) return null;
  // 12 am is midnight, 12 pm noon.
  return (hour % 12) + (half.toLowerCase() === "p" ? 12 : 0);
}
