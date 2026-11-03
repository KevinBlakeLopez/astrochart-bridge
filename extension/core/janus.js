import { chartRecord, readClock, readDate, readZone } from "./esotech.js";
import { withLabels } from "./names.js";
import { angle, linesOf } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Janus, by Astrology House, prints a chart's data in the middle of its wheel,
// as the screenshots on astrology-house.com show it:
//   Abraham Lincoln
//   Natal Chart
//   12 Feb 1809
//   6:57:53 AM
//   LMT +05:42:58
//   Hodgenville KY
//   USA
//   85w44'24 37n34'26
//   Geocentric / Tropical / Whole Signs / True Node, one a line
// Its Janus Light reports put the date, time and zone on one line:
//   15 Sep 1984 4:20:00 PM BST -01:00:00
// The date, time and zone are written as Solar Fire writes them, west of
// Greenwich as +, so esotech.js reads them. The zone's offset runs to the
// second. The coordinates give the longitude first, with lower-case letters.

const ZONE_LINE = /^(?:[A-Z]{2,5} )?[+-]\d{2}:\d{2}:\d{2}$/;
const REPORT_LINE = /^(?<date>\d{1,2} [A-Za-z]{3,9} \d{1,4}) (?<clock>\d{1,2}:\d{2}(?::\d{2})? [AP]M) (?<zone>(?:[A-Z]{2,5} )?[+-]\d{2}:\d{2}:\d{2})$/;
const COORDS = /\b(?<lngDeg>\d{1,3})(?<lngSide>[ew])(?<lngMin>\d{2})'(?<lngSec>\d{2})? (?<latDeg>\d{1,2})(?<latSide>[ns])(?<latMin>\d{2})'(?<latSec>\d{2})?(?!\S)/;
// The line above the date names the chart. A transit or progression prints
// a moment that isn't the birth.
const CHART_LINE = /\bChart$/;
const OPENS = new Set(["Natal Chart", "Event Chart", "Horary Chart"]);

/**
 * Whether a screenshot's text has a Janus zone, offset to the second, on a
 * line of its own or after a report's time, and Janus's coordinates.
 *
 * @param {string} text
 */
export function detect(text) {
  const lines = linesOf(text);
  return lines.some((line) => ZONE_LINE.test(line) || REPORT_LINE.test(line)) && lines.some((line) => COORDS.test(line));
}

/**
 * Reads the data in the middle of a Janus wheel, or a Janus Light report's:
 * the record resolvePrinted takes. Janus prints no Universal Time or sidereal
 * time, so a zone label is all there is to check.
 *
 * @param {string} text
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "chart-type-unsupported"
 *       | "calendar-unsupported" | "apparent-time" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const zoneAt = lines.flatMap((line, index) => (ZONE_LINE.test(line) ? [index] : []));
  const reports = lines.flatMap((line, index) => (REPORT_LINE.test(line) ? [index] : []));
  const coords = lines.map((line) => COORDS.exec(line)).filter(Boolean);
  // Two blocks mean two charts, as on a bi-wheel.
  if (zoneAt.length + reports.length > 1 || coords.length > 1) return refused("ambiguous-screenshot");
  if (zoneAt.length + reports.length === 0 || coords.length === 0) return refused("unreadable-screenshot");

  // The wheel's date, time and zone are three lines; a report's are one.
  let dateAt;
  let parts;
  if (zoneAt.length === 1) {
    dateAt = zoneAt[0] - 2;
    parts = [readDate(lines[dateAt] ?? ""), readClock(lines[zoneAt[0] - 1] ?? ""), readZone(lines[zoneAt[0]])];
  } else {
    dateAt = reports[0];
    const { date, clock, zone } = REPORT_LINE.exec(lines[dateAt]).groups;
    parts = [readDate(date), readClock(clock), readZone(zone)];
  }
  const above = lines[dateAt - 1] ?? "";
  if (CHART_LINE.test(above) && !OPENS.has(above)) return refused("chart-type-unsupported");

  const place = coords[0].groups;
  const lng = angle({ deg: Number(place.lngDeg), min: Number(place.lngMin), sec: Number(place.lngSec ?? 0), negative: place.lngSide === "w", limit: 180 });
  const lat = angle({ deg: Number(place.latDeg), min: Number(place.latMin), sec: Number(place.latSec ?? 0), negative: place.latSide === "s", limit: 90 });
  const chart = chartRecord("janus", [
    ...parts,
    lat === null ? refused("unreadable-screenshot") : { lat },
    lng === null ? refused("unreadable-screenshot") : { lng },
  ]);
  // Only the wheel's layout is known: the name above Natal Chart, and the
  // town and country between the zone and the coordinates.
  if (zoneAt.length === 0) return chart;
  const coordsAt = lines.findIndex((line) => COORDS.test(line));
  const placeLines = coordsAt > zoneAt[0] ? lines.slice(zoneAt[0] + 1, coordsAt) : [];
  return withLabels(chart, {
    name: OPENS.has(above) ? (lines[dateAt - 2] ?? null) : null,
    place: placeLines.length === 1 || placeLines.length === 2 ? placeLines.join(", ") : null,
  });
}
