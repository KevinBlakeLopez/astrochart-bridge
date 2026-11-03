import { isoUtc } from "./civiltime.js";
import { withLabels } from "./names.js";
import { angle, linesOf, localIso, monthNumber, weekdayNumber } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Astrolog, by Walter Pullen, prints a chart's data at the top of the sidebar
// beside its wheel. Its DrawInfo, in Astrolog 8.00's xcharts0.cpp, writes:
//   Astrolog 8.00
//   Kevin                         (the name, if there is one)
//   Mon July 19, 1971             (=Yd: Mon 19 July 1971)
//   11:01am (ST Zone 8W)          (=b0: 11:01:00am ST Zone 8W)
//   Seattle, WA                   (the place, if there is one)
//   122°20W  47°36N               (=b0: 122°19'59W  47°36'35N)
//   Placidus houses
//   Tropical, Geocentric
//   Julian Day: 2441152.29236
// West of Greenwich is +, so 8W is UTC-08:00. ST or DT says whether an hour
// of daylight time is added; AT, some other amount, which isn't printed. LMT
// is the longitude at 4 minutes a degree, plus any daylight time. =Yz1 prints
// the two together: Zone h7w for UTC-07:00, or Zone m122w20 for a meridian,
// which LMT, LAT and a zone given as a meridian all print. =b1 prints
// milliseconds, drops "Zone " and splits the coordinates into Longitude: and
// Latitude: lines. The Julian Day is Universal Time: CastChart adds the zone
// and daylight time to the noon Julian day of the date, with no Delta-T.
// Before 15 October 1582 the date is in the Julian calendar.
const CLOCK = String.raw`(?<hour>\d{1,2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:\.\d{3})?)?(?<half>[ap]m)?`;
const ZONE = String.raw`(?:(?<dst>[SDA])T (?:Zone )?(?<zone>LMT|LAT|(?<zoneHours>\d{1,2})(?::(?<zoneMinutes>\d{2}))?(?<zoneSide>[EW]))|Zone (?<net>[hm])(?<netSize>\d{1,3})(?<netSide>[ew])(?<netMinutes>\d{2})?)`;
// A degree mark of ° or :, then minutes and seconds, or decimal degrees.
const ANGLE = (name) =>
  String.raw`(?<${name}Deg>\d{1,3})(?:[°:](?<${name}Min>\d{2})(?:'(?<${name}Sec>\d{2})(?:\.\d{3})?)?|(?<${name}Frac>\.\d+))(?<${name}Side>[EWNS])`;

const FIELDS = {
  date: /^(?<weekday>Sun|Mon|Tue|Wed|Thu|Fri|Sat) (?:(?<month>[A-Z][a-z]+) (?<day>\d{1,2}), (?<year>-?\d{1,5})|(?<dayFirst>\d{1,2}) (?<monthAfter>[A-Z][a-z]+) (?<yearAfter>-?\d{1,5}))$/,
  when: new RegExp(String.raw`^${CLOCK} \(?${ZONE}\)?$`),
  coords: new RegExp(String.raw`^${ANGLE("lng")} ${ANGLE("lat")}$`),
  lng: new RegExp(String.raw`^Longitude: ${ANGLE("lng")}$`),
  lat: new RegExp(String.raw`^Latitude: ${ANGLE("lat")}$`),
  julianDay: /^(?:Julian Day|J\. Day): (?<jd>\d{7}\.\d+)$/,
};
const REQUIRED = ["date", "when"];
// Lines for a progressed chart or one with time added, whose Julian Day isn't
// the moment of the date and time above it.
const MOVED = /^(?:Progress To|Time|Objs|Cusp): /;

// The Julian Day at 1970-01-01 00:00 UT, where Date counts from.
const UNIX_EPOCH_JD = 2440587.5;
const GREGORIAN_START = "1582-10-15";

/**
 * Whether a screenshot's text has an Astrolog time line, with its zone.
 *
 * @param {string} text
 */
export function detect(text) {
  return linesOf(text).some((line) => FIELDS.when.test(line));
}

/**
 * Reads the top of an Astrolog sidebar: the record resolvePrinted takes. The
 * Julian Day, when the screenshot has it, is the Universal Time the offset
 * must agree with.
 *
 * @param {string} text
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "chart-type-unsupported"
 *       | "calendar-unsupported" | "apparent-time" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const found = {};
  for (const [name, pattern] of Object.entries(FIELDS)) {
    const matches = lines.map((line) => pattern.exec(line)).filter(Boolean);
    // Two blocks mean two charts, as beside a bi-wheel.
    if (matches.length > 1) return refused("ambiguous-screenshot");
    if (matches.length === 1) found[name] = matches[0].groups;
  }
  if (REQUIRED.some((name) => !found[name])) return refused("unreadable-screenshot");
  if (lines.some((line) => MOVED.test(line))) return refused("chart-type-unsupported");
  const place = found.coords ?? (found.lng && found.lat && { ...found.lng, ...found.lat });
  if (!place) return refused("unreadable-screenshot");

  const { date, when, julianDay } = found;
  if (when.zone === "LAT") return refused("apparent-time");
  const local = localTime(date, when);
  const lng = degrees(place, "lng", ["E", "W"], 180);
  const lat = degrees(place, "lat", ["N", "S"], 90);
  if (!local || lng === null || lat === null) return refused("unreadable-screenshot");
  if (local.slice(0, 10) < GREGORIAN_START) return refused("calendar-unsupported");

  const utc = julianDay && isoUtc(Math.round(((Number(julianDay.jd) - UNIX_EPOCH_JD) * 86_400_000) / 1000) * 1000);
  // A meridian may be LAT's, which is off LMT by the equation of time, so it
  // is taken only with a Julian Day to check it.
  const offset = when.net === "m" && !utc ? undefined : offsetFor(when, lng);
  return withLabels(
    {
      site: "astrolog",
      local,
      lat,
      lng,
      zoneLabel: null,
      weekday: weekdayNumber(date.weekday),
      ...(offset === undefined ? {} : { offsetMinutes: offset }),
      ...(utc ? { utc } : {}),
    },
    labelsOf(lines),
  );
}

// DrawInfo prints the name, if there is one, between its header and the
// date, and the place, if there is one, between the time and the
// coordinates. Each is read only with both of its neighbours where they
// should be, since either line can be missing.
const HEADER = /^Astrolog \d/;

function labelsOf(lines) {
  const at = (name) => lines.findIndex((line) => FIELDS[name].test(line));
  const dateAt = at("date");
  const whenAt = at("when");
  const coordsNext = ["coords", "lng"].some((name) => FIELDS[name].test(lines[whenAt + 2] ?? ""));
  return {
    name: HEADER.test(lines[dateAt - 2] ?? "") ? (lines[dateAt - 1] ?? null) : null,
    place: coordsNext ? lines[whenAt + 1] : null,
  };
}

// The wall-clock time, or null when the date or clock doesn't fit.
function localTime(date, when) {
  const hour = Number(when.hour);
  if (when.half && (hour < 1 || hour > 12)) return null;
  return localIso({
    year: Number(date.year ?? date.yearAfter),
    month: monthNumber(date.month ?? date.monthAfter),
    day: Number(date.day ?? date.dayFirst),
    hour: when.half ? (hour % 12) + (when.half === "pm" ? 12 : 0) : hour,
    minute: Number(when.minute),
    second: Number(when.second ?? 0),
  });
}

// Minutes east of UTC, or undefined for AT, whose daylight time isn't printed.
function offsetFor(when, lng) {
  if (when.net === "h") return signed(Number(when.netSize) * 60 + Number(when.netMinutes ?? 0), when.netSide === "e");
  // Degrees and minutes of arc west, at 4 minutes of time a degree.
  if (when.net === "m") return signed((Number(when.netSize) + Number(when.netMinutes ?? 0) / 60) * 4, when.netSide === "e");
  if (when.dst === "A") return undefined;
  const daylight = when.dst === "D" ? 60 : 0;
  if (when.zone === "LMT") return lng * 4 + daylight;
  return signed(Number(when.zoneHours) * 60 + Number(when.zoneMinutes ?? 0), when.zoneSide === "E") + daylight;
}

// "0 - size" keeps 0W at 0 instead of -0.
const signed = (size, east) => (east ? size : 0 - size);

// Signed decimal degrees for the lng or lat groups, or null when they don't fit.
function degrees(groups, name, [positive, negative], limit) {
  const side = groups[`${name}Side`];
  if (side !== positive && side !== negative) return null;
  const frac = groups[`${name}Frac`];
  if (frac !== undefined) {
    const value = Number(groups[`${name}Deg`] + frac);
    return value > limit ? null : side === negative ? 0 - value : value;
  }
  return angle({
    deg: Number(groups[`${name}Deg`]),
    min: Number(groups[`${name}Min`]),
    sec: Number(groups[`${name}Sec`] ?? 0),
    negative: side === negative,
    limit,
  });
}
