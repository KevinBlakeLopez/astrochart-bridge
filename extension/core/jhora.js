import { angle, linesOf, localIso, monthNumber } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Jagannatha Hora's birth data block, as its author pasted it into his posts
// on jyotish-blog.blogspot.com (2005 to 2007), the labels padded to one
// column:
//   Bill Gates
//   Natal Chart
//   Date:          October 26, 1955
//   Time:          9:17:59 pm
//   Time Zone:     8:00:00 (West of GMT)
//   Place:         122 W 20' 30", 47 N 36' 32"
//                  Seattle, Washington, USA
//   Altitude:      0.00 meters
//   ...
//   Sidereal Time: 23:27:48
// The time is 12-hour or 24-hour, as set in Jagannatha Hora's preferences.
// The place gives the longitude first; its name, on the line below, can be
// "--, --". The Sidereal Time is local mean sidereal time: on each of the six
// blocks in those posts it was within 1 s of localSiderealSeconds. Its
// Vedic Weekday changes at sunrise, not midnight, so it isn't a check on the date.
const FIELDS = {
  date: /^Date: (?<month>[A-Z][a-z]+) (?<day>\d{1,2}), (?<year>\d{1,4})$/,
  time: /^Time: (?<hour>\d{1,2}):(?<minute>\d{2}):(?<second>\d{2})(?: (?<half>[ap])m)?$/,
  zone: /^Time Zone: (?<hours>\d{1,2}):(?<minutes>\d{2}):(?<seconds>\d{2}) \((?<side>East|West) of GMT\)$/,
  place:
    /^Place: (?<lngDeg>\d{1,3}) (?<lngSide>[EW]) (?<lngMin>\d{2})' (?<lngSec>\d{2})", (?<latDeg>\d{1,2}) (?<latSide>[NS]) (?<latMin>\d{2})' (?<latSec>\d{2})"/,
  sidereal: /^Sidereal Time: (?<hour>\d{1,2}):(?<minute>\d{2}):(?<second>\d{2})$/,
};
// The line above the date names the chart; a popup's derived chart, such as
// a Period Entry Chart, prints its own moment.
const CHART_LINE = /\bChart$/;

/**
 * Whether a screenshot's text has Jagannatha Hora's Time Zone line, East or
 * West of GMT.
 *
 * @param {string} text
 */
export function detect(text) {
  return linesOf(text).some((line) => FIELDS.zone.test(line));
}

/**
 * Reads Jagannatha Hora's birth data block: the record resolvePrinted takes,
 * with the sidereal time to check it.
 *
 * @param {string} text
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "chart-type-unsupported" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const found = {};
  for (const [name, pattern] of Object.entries(FIELDS)) {
    const at = lines.flatMap((line, index) => (pattern.test(line) ? [index] : []));
    // Two blocks mean two charts.
    if (at.length > 1) return refused("ambiguous-screenshot");
    if (at.length === 0) return refused("unreadable-screenshot");
    found[name] = { at: at[0], groups: pattern.exec(lines[at[0]]).groups };
  }

  const above = lines[found.date.at - 1] ?? "";
  if (CHART_LINE.test(above) && above !== "Natal Chart") return refused("chart-type-unsupported");

  const { date, time, zone, place, sidereal } = Object.fromEntries(Object.entries(found).map(([name, { groups }]) => [name, groups]));
  const hour = clockHour(Number(time.hour), time.half);
  const local =
    hour !== null &&
    localIso({
      year: Number(date.year),
      month: monthNumber(date.month),
      day: Number(date.day),
      hour,
      minute: Number(time.minute),
      second: Number(time.second),
    });
  const lng = angle({ deg: Number(place.lngDeg), min: Number(place.lngMin), sec: Number(place.lngSec), negative: place.lngSide === "W", limit: 180 });
  const lat = angle({ deg: Number(place.latDeg), min: Number(place.latMin), sec: Number(place.latSec), negative: place.latSide === "S", limit: 90 });
  const siderealSeconds = clockSeconds(sidereal);
  if (!local || lat === null || lng === null || siderealSeconds === null || Number(zone.minutes) > 59 || Number(zone.seconds) > 59) {
    return refused("unreadable-screenshot");
  }

  // "0 - size" keeps 0:00:00 West of GMT at 0 instead of -0.
  const size = Number(zone.hours) * 60 + Number(zone.minutes) + Number(zone.seconds) / 60;
  return {
    site: "jhora",
    local,
    lat,
    lng,
    zoneLabel: null,
    offsetMinutes: zone.side === "West" ? 0 - size : size,
    siderealSeconds,
  };
}

// 1 to 12 with "a" or "p" as a 24-hour hour; 0 to 23 with neither. null otherwise.
function clockHour(hour, half) {
  if (half === undefined) return hour <= 23 ? hour : null;
  if (hour < 1 || hour > 12) return null;
  // 12 am is midnight, 12 pm noon.
  return (hour % 12) + (half === "p" ? 12 : 0);
}

function clockSeconds({ hour, minute, second }) {
  const [h, m, s] = [hour, minute, second].map(Number);
  return h > 23 || m > 59 || s > 59 ? null : h * 3600 + m * 60 + s;
}
