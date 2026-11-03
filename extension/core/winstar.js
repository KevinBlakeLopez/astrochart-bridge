import { isoUtc } from "./civiltime.js";
import { chartRecord, readClock, readDate, readLatitude, readLongitude, readZone } from "./esotech.js";
import { withLabels } from "./names.js";
import { linesOf } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Win*Star, by Matrix Software, prints a chart's data at the upper right of
// its wheel, as the screenshots on astrologysoftware.com show it:
//   Jodie Foster
//   Nov 19, 1962
//   Los Angeles,CA
//   08:14:00 AM PST
//   ZONE: +08:00
//   118W15'00"
//   34N03'00"
// West of Greenwich is +, as for Solar Fire, whose readers in esotech.js read
// the values. The Tech 1 wheel adds "Julian Day: 2437988.17639", which is
// Universal Time: for that chart it is 16:14:00 UT to the second, 08:14 PST
// at +08:00.
const FIELDS = {
  date: /^(?<text>[A-Z][a-z]{2,8} \d{1,2}, \d{1,4})$/,
  time: /^(?<clock>\d{1,2}:\d{2}(?::\d{2})? [AP]M)(?: (?<zoneLabel>[A-Z]{2,5}))?$/,
  zone: /^ZONE: (?<text>[+-]\d{1,2}:\d{2})$/,
  lng: /^(?<text>\d{1,3}[EW]\d{2}'(?:\d{2}")?)$/,
  lat: /^(?<text>\d{1,2}[NS]\d{2}'(?:\d{2}")?)$/,
  julianDay: /\bJulian Day: (?<jd>\d{7}\.\d+)\b/,
};
const REQUIRED = ["date", "time", "zone", "lng", "lat"];

// The Julian Day at 1970-01-01 00:00 UT, where Date counts from.
const UNIX_EPOCH_JD = 2440587.5;

/**
 * Whether a screenshot's text has Win*Star's ZONE line.
 *
 * @param {string} text
 */
export function detect(text) {
  return linesOf(text).some((line) => FIELDS.zone.test(line));
}

/**
 * Reads the data on a Win*Star wheel: the record resolvePrinted takes. A
 * Julian Day, when the wheel prints one, is the Universal Time the offset
 * must agree with.
 *
 * @param {string} text
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "calendar-unsupported" | "apparent-time" }}
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

  const { date, time, zone, lng, lat, julianDay } = found;
  const chart = chartRecord("winstar", [
    readDate(date.text),
    readClock(time.clock),
    readZone(zone.text),
    // The label is printed after the time, not with the ZONE.
    { zoneLabel: time.zoneLabel ?? null },
    readLatitude(lat.text),
    readLongitude(lng.text),
  ]);
  // The name is the line above the date, and the place the one between the
  // date and the time, where nothing else this reader knows is.
  const dateAt = lines.findIndex((line) => FIELDS.date.test(line));
  const timeAt = lines.findIndex((line) => FIELDS.time.test(line));
  const known = (line) => Object.values(FIELDS).some((pattern) => pattern.test(line));
  const label = (at) => (at >= 0 && !known(lines[at]) ? lines[at] : null);
  const labelled = withLabels(chart, { name: label(dateAt - 1), place: timeAt === dateAt + 2 ? label(dateAt + 1) : null });
  if (labelled.kind === "refused" || !julianDay) return labelled;
  // Rounded to the second: five decimals of a day are 0.864 s.
  const ms = Math.round(((Number(julianDay.jd) - UNIX_EPOCH_JD) * 86_400_000) / 1000) * 1000;
  return { ...labelled, utc: isoUtc(ms) };
}
