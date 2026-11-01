import { angle, localIso, monthNumber, weekdayNumber } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Solar Fire's chart details block, top left of the wheel, as its Solar Fire
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
// The date follows Windows's date order and the time its clock, so either can
// come in two forms. The weekday, the zone label and the seconds are printed
// only by some versions or only when there is something to print.

// "24 Apr 1942" or "Jul 4 2015", then OS or NS for Old or New Style, or BC,
// then ", Sat" or ", Saturday". A chart's name can look like a date too, so
// this is only ever tried on the line just above the time.
const DATE_LINE = /^(?:(\d{1,2}) ([A-Za-z]{3,9})|([A-Za-z]{3,9}) (\d{1,2})),? (\d{1,4})(?: (OS|NS|BC))?(?:,? ([A-Za-z]{3,9}))?$/;
// "5:04 am +4:00", "8:00 PM GMT +0:00", "13:25 CET -1:00". West of Greenwich
// is +, as Solar Fire's guide says to enter it.
const TIME_LINE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?([AaPp])\.?[Mm]\.?)? (?:([A-Z]{2,5}) )?([+-])(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
// "40°N38' 073°W56'", "39°N44'21" 104°W59'03"", or with no degree signs or
// quotes, as on the guide's older captions: "51N31 000W06". Seconds come out
// of a PDF as two single quotes.
const COORDS_LINE = /^(\d{1,2})°?([NS])(\d{2})'?(?:(\d{2})(?:"|''))? (\d{1,3})°?([EW])(\d{2})'?(?:(\d{2})(?:"|''))?$/;

const linesOf = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/**
 * Whether a screenshot's text has a Solar Fire chart details block: a time
 * with an offset on one line, and coordinates written 40°N38'.
 *
 * @param {string} text
 */
export function detect(text) {
  const lines = linesOf(text);
  return lines.some((line) => TIME_LINE.test(line)) && lines.some((line) => COORDS_LINE.test(line));
}

/**
 * Reads the chart details block of a Solar Fire wheel: the record
 * resolvePrinted takes. Solar Fire prints no Universal Time or sidereal time,
 * so a weekday and a zone label are all there is to check.
 *
 * @param {string} text  one line of the block per line
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "calendar-unsupported" | "apparent-time" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const timeAt = lines.flatMap((line, index) => (TIME_LINE.test(line) ? [index] : []));
  const coordsLines = lines.filter((line) => COORDS_LINE.test(line));
  // Two blocks mean two charts, as on a bi-wheel.
  if (timeAt.length > 1 || coordsLines.length > 1) return refused("ambiguous-screenshot");
  if (timeAt.length === 0 || coordsLines.length === 0) return refused("unreadable-screenshot");

  const dateMatch = DATE_LINE.exec(lines[timeAt[0] - 1] ?? "");
  if (!dateMatch) return refused("unreadable-screenshot");
  const [, dayFirst, monthSecond, monthFirst, daySecond, year, style, weekdayName] = dateMatch;
  // Chart Bridge counts dates on the Gregorian calendar from year 1.
  if (style === "OS" || style === "BC") return refused("calendar-unsupported");

  const [, hour, minute, second, half, zoneLabel, sign, zoneHours, zoneMinutes, zoneSeconds] =
    TIME_LINE.exec(lines[timeAt[0]]);
  // Local apparent time runs on the Sun, not the clock: its offset changes
  // through the year with the equation of time.
  if (zoneLabel === "LAT") return refused("apparent-time");
  const clock = clockHour(Number(hour), half);
  if (clock === null) return refused("unreadable-screenshot");

  const local = localIso({
    year: Number(year),
    month: monthNumber(monthSecond ?? monthFirst),
    day: Number(dayFirst ?? daySecond),
    hour: clock,
    minute: Number(minute),
    second: Number(second ?? 0),
  });
  const weekday = weekdayName === undefined ? undefined : weekdayNumber(weekdayName);

  const [, latDeg, latSide, latMin, latSec, lngDeg, lngSide, lngMin, lngSec] = COORDS_LINE.exec(coordsLines[0]);
  const lat = angle({ deg: Number(latDeg), min: Number(latMin), sec: Number(latSec ?? 0), negative: latSide === "S", limit: 90 });
  const lng = angle({ deg: Number(lngDeg), min: Number(lngMin), sec: Number(lngSec ?? 0), negative: lngSide === "W", limit: 180 });

  if (local === null || weekday === -1 || lat === null || lng === null || Number(zoneMinutes) > 59 || Number(zoneSeconds ?? 0) > 59) {
    return refused("unreadable-screenshot");
  }
  // Solar Fire's + is west, so its +5:00 is UTC-05:00. "0 - size" keeps
  // -0:00 at 0 instead of -0.
  const size = Number(zoneHours) * 60 + Number(zoneMinutes) + Number(zoneSeconds ?? 0) / 60;
  const offsetMinutes = sign === "+" ? 0 - size : size;

  return {
    site: "solar-fire",
    local,
    lat,
    lng,
    zoneLabel: zoneLabel ?? null,
    offsetMinutes,
    ...(weekday === undefined ? {} : { weekday }),
  };
}

// 1 to 12 with "a" or "p" as a 24-hour hour; 0 to 23 with neither. null otherwise.
function clockHour(hour, half) {
  if (half === undefined) return hour <= 23 ? hour : null;
  if (hour < 1 || hour > 12) return null;
  // 12 am is midnight, 12 pm noon.
  return (hour % 12) + (half.toLowerCase() === "p" ? 12 : 0);
}
