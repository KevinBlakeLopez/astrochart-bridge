import { chartRecord, readClock, readDate, readLatitude, readLongitude, readZone } from "./esotech.js";
import { withLabels } from "./names.js";
import { linesOf } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Astro Gold's Edit Chart screen, as its iOS user guide shows it, one field a
// row with its label first:
//   Date        23 Nov 1963
//   Time        7:12 AM
//   Place       Melbourne
//   Latitude    37°S49'
//   Longitude   144°E58'
//   Timezone    AEST -10:00
// The values are written as in the chart details block, so esotech.js reads
// them. The macOS dialog's Timezone is the offset alone, "-12:00".
const FIELDS = {
  date: [/^Date:? (.+)$/, readDate],
  time: [/^Time:? (.+)$/, readClock],
  zone: [/^Timezone:? (.+)$/, readZone],
  lat: [/^Latitude:? (.+)$/, readLatitude],
  lng: [/^Longitude:? (.+)$/, readLongitude],
};
const PLACE = /^Place:? (.+)$/;

/**
 * Whether a screenshot's text has Astro Gold's Edit Chart fields: a Latitude
 * row and a Timezone row.
 *
 * @param {string} text
 */
export function detect(text) {
  const lines = linesOf(text);
  return lines.some((line) => FIELDS.lat[0].test(line)) && lines.some((line) => FIELDS.zone[0].test(line));
}

/**
 * Reads Astro Gold's Edit Chart screen: the record resolvePrinted takes. It
 * prints no weekday, so a zone label is all there is to check.
 *
 * @param {string} text
 * @returns {ReturnType<typeof chartRecord> | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const parts = [];
  for (const [pattern, readValue] of Object.values(FIELDS)) {
    const matches = lines.map((line) => pattern.exec(line)).filter(Boolean);
    if (matches.length > 1) return refused("ambiguous-screenshot");
    if (matches.length === 0) return refused("unreadable-screenshot");
    parts.push(readValue(matches[0][1]));
  }
  // The Place row names the town; the screen has no name.
  const place = lines.map((line) => PLACE.exec(line)).filter(Boolean);
  return withLabels(chartRecord("astro-gold", parts), { place: place.length === 1 ? place[0][1] : null });
}
