import { angle, linesOf, localIso, weekdayNumber } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Planetdance prints a chart's data in three layouts, as the screenshots in
// a 2021 review of Planetdance on livingincycles.blog show them. Its wheel,
// top left:
//   Startup
//   03/02/2021 18:56:37 EET +02:00
//   Helsinki, Finland, 24e56, 60n10
//   Whole Sign St:3:32:41
// Its data screen, which prints the Universal Time but no offset, and the
// sidereal time with a degree sign though it counts hours:
//   Startup 03/02/2021 18:56:37 Helsinki, Finland, 24e56, 60n10, Europe/Helsinki
//   UT:03/02/2021 16:56:37 Julian: 2459249.205984 Sidereal Time  03°32'41" Wednesday
// Its Vedic screen, which prints neither:
//   03/02/2021 ,  18:56:37
//   Helsinki, Finland, 24e56, 60n10, Europe/Helsinki
// East of Greenwich is +. Every sample writes the date day first, but nothing
// shows whether that follows Windows's date order, so a date that reads
// either way is read both ways when a sidereal time can tell them apart.

const DATE = String.raw`(?<first>\d{2})/(?<second>\d{2})/(?<year>\d{1,4})`;
const CLOCK = String.raw`(?<hour>\d{2}):(?<minute>\d{2}):(?<sec>\d{2})`;
// "24e56, 60n10", longitude first. A forum post shows "79w60", so 60 minutes
// is taken as the next degree.
const COORDS = String.raw`(?<lngDeg>\d{1,3})(?<lngSide>[ew])(?<lngMin>\d{2}), (?<latDeg>\d{1,2})(?<latSide>[ns])(?<latMin>\d{2})`;

// "EET +02:00", "LMT +00:17". A forum post shows "-04.00".
const WHEEL_TIME = new RegExp(String.raw`^${DATE} ${CLOCK} (?:(?<zoneLabel>[A-Z]{2,5}) )?(?<sign>[+-])(?<zoneHours>\d{2})[:.](?<zoneMinutes>\d{2})$`);
// The place line ends with the coordinates, then on some screens the zone's name.
const PLACE_LINE = new RegExp(String.raw`(?:^|, )${COORDS}(?:, [\w/+-]+)?$`);
const WHEEL_SIDEREAL = /\bSt: ?(?<hour>\d{1,2}):(?<minute>\d{2}):(?<sec>\d{2})\b/;

const DATA_LOCAL = new RegExp(String.raw`(?<![\d/])${DATE} ${CLOCK} .+, ${COORDS}(?:, [\w/+-]+)?$`);
const DATA_UT = new RegExp(String.raw`\bUT: ?${DATE} ${CLOCK}`);
const DATA_SIDEREAL = /\bSidereal Time:? +(?<hour>\d{1,2})°(?<minute>\d{2})'(?<sec>\d{2})"/;
const DATA_WEEKDAY = /\b(?<weekday>Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/;

const VEDIC_TIME = new RegExp(String.raw`^${DATE} ?, ?${CLOCK}$`);

/**
 * Whether a screenshot's text has a Planetdance date and time: day-first
 * with a zone on the wheel, after "UT:" on the data screen, or with a comma
 * between them on the Vedic screen.
 *
 * @param {string} text
 */
export function detect(text) {
  return linesOf(text).some((line) => WHEEL_TIME.test(line) || DATA_UT.test(line) || VEDIC_TIME.test(line));
}

/**
 * Reads Planetdance's wheel, data screen or Vedic screen: the record
 * resolvePrinted takes, or both readings of a date that reads either way. The
 * wheel is read first, then the data screen, then the Vedic screen; they show
 * the same chart.
 *
 * @param {string} text
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | Parameters<typeof import("./printed-chart.js").resolvePrinted>[0][]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "zone-offset-mismatch" }}
 */
export function read(text) {
  const lines = linesOf(text);
  return wheel(lines) ?? dataScreen(lines) ?? vedicScreen(lines) ?? refused("unreadable-screenshot");
}

function wheel(lines) {
  const at = lines.flatMap((line, index) => (WHEEL_TIME.test(line) ? [index] : []));
  if (at.length === 0) return null;
  if (at.length > 1) return refused("ambiguous-screenshot");
  const time = WHEEL_TIME.exec(lines[at[0]]).groups;
  const place = placeOf(PLACE_LINE.exec(lines[at[0] + 1] ?? "")?.groups);
  if (!place || Number(time.zoneMinutes) > 59) return refused("unreadable-screenshot");

  const sidereal = siderealOf(lines, WHEEL_SIDEREAL);
  const size = Number(time.zoneHours) * 60 + Number(time.zoneMinutes);
  let offsetMinutes = time.sign === "-" ? 0 - size : size;
  const zoneLabel = time.zoneLabel ?? null;
  if (zoneLabel === "LMT") {
    // Planetdance works local mean time out from the longitude and prints it
    // to the minute: Brussels at 4e21 is 17m24s, printed +00:17. The
    // longitude gives the seconds back.
    const lmt = Math.round(place.lng * 4 * 60) / 60;
    if (Math.abs(offsetMinutes - lmt) > 1) return refused("zone-offset-mismatch");
    offsetMinutes = lmt;
  }
  return readings(time, sidereal, (local) => ({ site: "planetdance", local, ...place, zoneLabel, offsetMinutes }));
}

function dataScreen(lines) {
  const locals = lines.map((line) => DATA_LOCAL.exec(line)).filter(Boolean);
  const uts = lines.map((line) => DATA_UT.exec(line)).filter(Boolean);
  if (uts.length === 0) return null;
  if (locals.length > 1 || uts.length > 1) return refused("ambiguous-screenshot");
  const place = placeOf(locals[0]?.groups);
  const sidereal = siderealOf(lines, DATA_SIDEREAL);
  if (!place || sidereal === null) return refused("unreadable-screenshot");
  const local = locals[0].groups;
  const ut = uts[0].groups;
  const weekdayName = lines.map((line) => DATA_WEEKDAY.exec(line)?.groups.weekday).find(Boolean);

  // Both dates are written the same way, so they are read the same way round.
  return readings(local, sidereal, (localIsoText, dayFirst) => {
    const utIso = isoFrom(ut, dayFirst);
    return utIso && {
      site: "planetdance",
      local: localIsoText,
      ...place,
      zoneLabel: null,
      utc: `${utIso}Z`,
      ...(weekdayName === undefined ? {} : { weekday: weekdayNumber(weekdayName) }),
    };
  });
}

function vedicScreen(lines) {
  const at = lines.flatMap((line, index) => (VEDIC_TIME.test(line) ? [index] : []));
  if (at.length === 0) return null;
  if (at.length > 1) return refused("ambiguous-screenshot");
  const place = placeOf(PLACE_LINE.exec(lines[at[0] + 1] ?? "")?.groups);
  if (!place) return refused("unreadable-screenshot");
  // No zone and no sidereal time, so the date is read day first, as every
  // sample prints it, and the user enters the offset.
  return readings(VEDIC_TIME.exec(lines[at[0]]).groups, null, (local) => ({ site: "planetdance", local, ...place, zoneLabel: null }));
}

// The records for a date read day first and, when a sidereal time can tell
// them apart, month first too. make gets each local time and whether it was
// read day first, and can return null for a reading that doesn't fit.
function readings(time, sidereal, make) {
  const orders = [true];
  if (sidereal !== null && time.first !== time.second) orders.push(false);
  const records = orders
    .map((dayFirst) => {
      const local = isoFrom(time, dayFirst);
      const record = local && make(local, dayFirst);
      return record && (sidereal === null ? record : { ...record, siderealSeconds: sidereal });
    })
    .filter(Boolean);
  if (records.length === 0) return refused("unreadable-screenshot");
  return records.length === 1 ? records[0] : records;
}

// The groups of DATE and CLOCK as "2021-02-03T18:56:37", or null.
function isoFrom({ first, second, year, hour, minute, sec }, dayFirst) {
  return localIso({
    year: Number(year),
    month: Number(dayFirst ? second : first),
    day: Number(dayFirst ? first : second),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(sec),
  });
}

function siderealOf(lines, pattern) {
  const found = lines.map((line) => pattern.exec(line)?.groups).find(Boolean);
  if (!found) return null;
  const [hour, minute, second] = [found.hour, found.minute, found.sec].map(Number);
  return hour > 23 || minute > 59 || second > 59 ? null : hour * 3600 + minute * 60 + second;
}

// { lat, lng } from the groups of COORDS, or null.
function placeOf(groups) {
  if (!groups) return null;
  const lng = coordinate(groups.lngDeg, groups.lngMin, groups.lngSide === "w", 180);
  const lat = coordinate(groups.latDeg, groups.latMin, groups.latSide === "s", 90);
  return lat === null || lng === null ? null : { lat, lng };
}

function coordinate(deg, min, negative, limit) {
  // 60 minutes is the next degree.
  const carry = Number(min) === 60;
  return angle({ deg: Number(deg) + (carry ? 1 : 0), min: carry ? 0 : Number(min), negative, limit });
}
