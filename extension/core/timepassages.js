import { isoUtc } from "./civiltime.js";
import { chartRecord, readClock, readDate } from "./esotech.js";
import { withLabels } from "./names.js";
import { angle, linesOf } from "./printed-chart.js";
import { localSiderealSeconds } from "./sidereal.js";

const refused = (reason) => ({ kind: "refused", reason });

// TimePassages, by AstroGraph, prints a chart's data in the corners of its
// wheel, as the screenshots on astrograph.com show them:
//   Brad Pitt                              (top left)
//   Dec 18, 1963, 6:31:00 AM CST
//   Shawnee, OK                            (bottom left)
//   35N20, 96W55
//   TLT 6:03                               (bottom right)
//   ST 11:48:57
//   Placidus
// It prints a zone label but no offset or Universal Time. ST is the local
// sidereal time and TLT, True Local Time, the local mean time cut to the
// minute: for that chart, at UTC-06:00, ST is 0.3 s from localSiderealSeconds
// and local mean time is 6:03:20. So the Universal Time comes from ST, and
// TLT checks it.
// Both are local times, so a longitude misread by whole degrees moves the UT
// 4 minutes a degree and both still fit. Zone offsets are on the quarter hour,
// so an offset off it is taken for a misread longitude, unless the chart is
// in LMT. That also refuses the few zones that weren't, such as Amsterdam's
// +00:19:32 before 1940.
const FIELDS = {
  when: /^(?<date>[A-Z][a-z]{2,8} \d{1,2}, \d{1,4}), (?<clock>\d{1,2}:\d{2}(?::\d{2})? [AP]M)(?: (?<zoneLabel>[A-Z]{2,5}))?$/,
  // Latitude first. A screenshot of a sidereal chart shows "-10E00", which
  // doesn't say which way, so a sign isn't read.
  coords: /^(?<latDeg>\d{1,2})(?<latSide>[NS])(?<latMin>\d{2}), (?<lngDeg>\d{1,3})(?<lngSide>[EW])(?<lngMin>\d{2})$/,
  tlt: /^TLT (?<hour>\d{1,2}):(?<minute>\d{2})$/,
  sidereal: /^ST (?<hour>\d{1,2}):(?<minute>\d{2}):(?<second>\d{2})$/,
};
const REQUIRED = ["when", "coords"];
// The wheel's corner lines that name a sign: "Cancer Rising", "Pisces Sun".
const SIGN_LINE = /^[A-Z][a-z]+ (?:Rising|Sun|Moon)$/;
// A chart of two people or two moments, whose corners don't all describe one birth.
const NOT_NATAL = /\b(?:Biwheel|Comparison|Transits?|Progressed)\b/;

// Sidereal seconds in a solar second, and a sidereal day in solar seconds.
const SIDEREAL_RATE = 1.00273790935;
const SIDEREAL_DAY_SECONDS = 86_400 / SIDEREAL_RATE;
const DAY_MINUTES = 1440;

/**
 * Whether a screenshot's text has TimePassages's TLT or ST line.
 *
 * @param {string} text
 */
export function detect(text) {
  return linesOf(text).some((line) => FIELDS.tlt.test(line) || FIELDS.sidereal.test(line));
}

/**
 * Reads the corners of a TimePassages wheel: a reading for resolvePrinted for
 * each offset at which ST fits, rounded to the minute (to the second for
 * LMT), that TLT agrees with and, but for LMT, falls on a quarter hour.
 * Without ST there is nothing to work the offset out from, so the user enters
 * it.
 *
 * @param {string} text
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | Parameters<typeof import("./printed-chart.js").resolvePrinted>[0][]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "chart-type-unsupported"
 *       | "true-local-time-mismatch" | "offset-off-quarter-hour" | "sidereal-mismatch" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const found = {};
  for (const [name, pattern] of Object.entries(FIELDS)) {
    const matches = lines.map((line) => pattern.exec(line)).filter(Boolean);
    // Two charts' corners, as on a bi-wheel.
    if (matches.length > 1) return refused("ambiguous-screenshot");
    if (matches.length === 1) found[name] = matches[0].groups;
  }
  if (REQUIRED.some((name) => !found[name])) return refused("unreadable-screenshot");
  if (lines.some((line) => NOT_NATAL.test(line))) return refused("chart-type-unsupported");

  const { when, coords, tlt, sidereal } = found;
  const lat = angle({ deg: Number(coords.latDeg), min: Number(coords.latMin), negative: coords.latSide === "S", limit: 90 });
  const lng = angle({ deg: Number(coords.lngDeg), min: Number(coords.lngMin), negative: coords.lngSide === "W", limit: 180 });
  const chart = chartRecord("timepassages", [
    readDate(when.date),
    readClock(when.clock),
    { zoneLabel: when.zoneLabel ?? null },
    lat === null ? refused("unreadable-screenshot") : { lat },
    lng === null ? refused("unreadable-screenshot") : { lng },
  ]);
  if (chart.kind === "refused") return chart;
  const siderealSeconds = sidereal && clockSeconds([sidereal.hour, sidereal.minute, sidereal.second]);
  const tltSeconds = tlt && clockSeconds([tlt.hour, tlt.minute, "0"]);
  if (siderealSeconds === null || tltSeconds === null) return refused("unreadable-screenshot");
  // Top left, the name is above the date and time; bottom left, the place is
  // above the coordinates. A line this reader knows, or a sign's, is neither.
  const at = (name) => lines.findIndex((line) => FIELDS[name].test(line));
  const label = (index) => {
    const line = lines[index] ?? "";
    return Object.values(FIELDS).some((pattern) => pattern.test(line)) || SIGN_LINE.test(line) ? null : line;
  };
  const labels = { name: label(at("when") - 1), place: label(at("coords") - 1) };
  if (siderealSeconds === undefined) return withLabels(chart, labels);

  const offsets = siderealOffsets(chart.local, lng, siderealSeconds, chart.zoneLabel === "LMT");
  if (offsets.length === 0) return refused("sidereal-mismatch");
  const fitting = tltSeconds === undefined ? offsets : offsets.filter((offset) => tltFits(chart.local, offset, lng, tltSeconds / 60));
  if (fitting.length === 0) return refused("true-local-time-mismatch");
  // Two offsets a sidereal day apart are 4 minutes off whole days, so this
  // also chooses between them.
  const zoned = chart.zoneLabel === "LMT" ? fitting : fitting.filter((offset) => Math.abs(offset) % 15 === 0);
  if (zoned.length === 0) return refused("offset-off-quarter-hour");
  return withLabels(
    zoned.map((offsetMinutes) => ({ ...chart, offsetMinutes, siderealSeconds })),
    labels,
  );
}

// The offsets, in minutes east of UTC and inside -12:00 to +14:00, at which
// the wall-clock time local has the sidereal time printed. They come a
// sidereal day apart, so at most two fit.
function siderealOffsets(local, lng, printed, toTheSecond) {
  const wallMs = Date.parse(`${local}Z`);
  const ahead = (((printed - localSiderealSeconds(isoUtc(wallMs), lng)) % 86_400) + 86_400) % 86_400;
  const seconds = ahead / SIDEREAL_RATE;
  return [-1, 0, 1]
    .map((days) => -(seconds + days * SIDEREAL_DAY_SECONDS) / 60)
    .filter((offset) => offset >= -720 && offset <= 840)
    .map((offset) => (toTheSecond ? Math.round(offset * 60) / 60 : Math.round(offset)));
}

// Whether TLT, cut to the minute, is the local mean time at an offset.
function tltFits(local, offsetMinutes, lng, tltClockMinutes) {
  const wallMinutes = Date.parse(`${local}Z`) / 60_000;
  const lmtClock = (((wallMinutes - offsetMinutes + lng * 4) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const gap = Math.abs(Math.floor(lmtClock) - tltClockMinutes) % DAY_MINUTES;
  // A minute either way, for TLT rounded rather than cut, or a time rounded to the minute.
  return Math.min(gap, DAY_MINUTES - gap) <= 1;
}

function clockSeconds(parts) {
  const [h, m, s] = parts.map(Number);
  return h > 23 || m > 59 || s > 59 ? null : h * 3600 + m * 60 + s;
}
