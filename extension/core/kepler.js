import { withLabels } from "./names.js";
import { angle, linesOf, localIso, monthNumber } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Kepler and Sirius, both by Cosmic Patterns, print the same data block, as
// the screenshots of Kepler 9.26 and Sirius 2.0 on astrosoftware.com show
// it. The Modern style sets it in two columns, which OCR reads across:
//   Frederic Chopin                    Tropical Placidus
//   March 1, 1810                Time Zone: 0 hours West
//   6:00 PM                             Local Mean Time
//   Warsaw, Poland                       52 N 15   21 E 00
//   NATAL CHART
// The Bach style in one: March 31, 1685 / 12:00 PM / Standard Time /
// Eisenach, Germany / 50 N 59   10 E 19 / Time Zone: 1 hours East. So each
// value is found by its own pattern, not by its line. A table beside the
// wheel can add "G.M.T. 16:36:00" and "Sidereal Time 4:35:17", which fit
// that chart to the second.
// A local-mean-time chart prints "0 hours West" wherever it is, so its offset
// comes from the longitude. No daylight-time chart has been seen, so neither
// its line's words nor whether its Time Zone takes in the hour are known.
const FIELDS = {
  date: /^(?<month>[A-Z][a-z]+) (?<day>\d{1,2}), (?<year>\d{1,4})\b/,
  time: /^(?<hour>\d{1,2}):(?<minute>\d{2}) (?<half>AM|PM)\b/,
  zone: /\bTime Zone: (?<hours>\d{1,2}(?:\.\d+)?) hours? (?<side>West|East)\b/,
  // "Standard Time", "Local Mean Time", or whatever a daylight-time chart
  // prints, at the end of its line: the time's, in the Modern style.
  timeType: /(?:^|\d (?:AM|PM) )(?<type>(?:[A-Z][a-z]+ )+Time)$/,
  // Latitude first, to the minute.
  coords: /\b(?<latDeg>\d{1,2}) (?<latSide>[NS]) (?<latMin>\d{2}) (?<lngDeg>\d{1,3}) (?<lngSide>[EW]) (?<lngMin>\d{2})\b/,
  gmt: /\bG\.M\.T\.:? (?<hour>\d{1,2}):(?<minute>\d{2}):(?<second>\d{2})\b/,
  sidereal: /\bSidereal Time:? (?<hour>\d{1,2}):(?<minute>\d{2}):(?<second>\d{2})\b/,
};
const REQUIRED = ["date", "time", "coords"];
const CHART_LINE = /^(?:[A-Z]+ )+CHART$/;

const DAY_MS = 86_400_000;

/**
 * Whether a screenshot's text has Kepler's or Sirius's Time Zone, in hours
 * West or East.
 *
 * @param {string} text
 */
export function detect(text) {
  return linesOf(text).some((line) => FIELDS.zone.test(line));
}

/**
 * Reads a Kepler or Sirius data block: the record resolvePrinted takes or,
 * with a G.M.T. that prints no date, its readings on the local day and the
 * days either side.
 *
 * @param {string} text
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | Parameters<typeof import("./printed-chart.js").resolvePrinted>[0][]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "chart-type-unsupported" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const found = {};
  for (const [name, pattern] of Object.entries(FIELDS)) {
    const matches = lines.map((line) => pattern.exec(line)).filter(Boolean);
    // Two blocks mean two charts, as on a bi-wheel.
    if (matches.length > 1) return refused("ambiguous-screenshot");
    if (matches.length === 1) found[name] = matches[0].groups;
  }
  if (REQUIRED.some((name) => !found[name])) return refused("unreadable-screenshot");
  const chartLine = lines.find((line) => CHART_LINE.test(line));
  if (chartLine !== undefined && chartLine !== "NATAL CHART") return refused("chart-type-unsupported");

  const { date, time, zone, timeType, coords, gmt, sidereal } = found;
  const hour = Number(time.hour);
  const local =
    hour >= 1 &&
    hour <= 12 &&
    localIso({
      year: Number(date.year),
      month: monthNumber(date.month),
      day: Number(date.day),
      hour: (hour % 12) + (time.half === "PM" ? 12 : 0),
      minute: Number(time.minute),
    });
  const lat = angle({ deg: Number(coords.latDeg), min: Number(coords.latMin), negative: coords.latSide === "S", limit: 90 });
  const lng = angle({ deg: Number(coords.lngDeg), min: Number(coords.lngMin), negative: coords.lngSide === "W", limit: 180 });
  const gmtClock = gmt && clockText(gmt);
  const siderealSeconds = sidereal && clockSeconds(sidereal);
  if (!local || lat === null || lng === null || gmtClock === null || siderealSeconds === null) {
    return refused("unreadable-screenshot");
  }

  const record = withLabels({
    site: programOf(lines),
    local,
    lat,
    lng,
    zoneLabel: null,
    ...offsetFor(timeType?.type, zone, lng),
    ...(siderealSeconds === undefined ? {} : { siderealSeconds }),
  }, labelsOf(lines));
  if (gmtClock === undefined) return record;
  // The G.M.T. falls on the local date, the day before or the day after.
  const localDayMs = Date.parse(`${local.slice(0, 10)}T00:00:00Z`);
  return [0, -1, 1].map((days) => ({
    ...record,
    utc: `${new Date(localDayMs + days * DAY_MS).toISOString().slice(0, 10)}T${gmtClock}Z`,
  }));
}

// { offsetMinutes } for the time type, or nothing for the user to enter.
// The chart's name is the line above the date, less the zodiac and house
// system the Modern style sets beside it: "Frederic Chopin Tropical
// Placidus". The place is before the coordinates on their line, as the
// Modern style sets it, or the line above them, as the Bach style does. A
// line this reader knows is neither, and a line that is only the zodiac and
// house system names nothing.
const ZODIAC_AFTER = /(?:^|\s+)(?:Tropical|Sidereal)\b.*$/;

function labelsOf(lines) {
  const known = (line) => Object.values(FIELDS).some((pattern) => pattern.test(line)) || CHART_LINE.test(line);
  const label = (line) => (line === undefined || known(line) ? null : line);
  const dateAt = lines.findIndex((line) => FIELDS.date.test(line));
  const coordsAt = lines.findIndex((line) => FIELDS.coords.test(line));
  const before = lines[coordsAt].slice(0, FIELDS.coords.exec(lines[coordsAt]).index).trim();
  return {
    name: label(lines[dateAt - 1])?.replace(ZODIAC_AFTER, "") ?? null,
    place: before === "" ? label(lines[coordsAt - 1]) : before,
  };
}

function offsetFor(type, zone, lng) {
  if (type === "Local Mean Time") return { offsetMinutes: Math.round(lng * 4 * 60) / 60 };
  if (type !== "Standard Time" || !zone) return {};
  // "0 - size" keeps 0 hours West at 0 instead of -0.
  const size = Math.round(Number(zone.hours) * 60);
  return { offsetMinutes: zone.side === "West" ? 0 - size : size };
}

function programOf(lines) {
  if (lines.some((line) => /\bKepler \d/.test(line))) return "kepler";
  if (lines.some((line) => /\bSirius \d/.test(line))) return "sirius";
  return "kepler-or-sirius";
}

// "16:36:00" with two-digit hours, or null.
function clockText(groups) {
  const seconds = clockSeconds(groups);
  if (seconds === null) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}

function clockSeconds({ hour, minute, second }) {
  const [h, m, s] = [hour, minute, second].map(Number);
  return h > 23 || m > 59 || s > 59 ? null : h * 3600 + m * 60 + s;
}
