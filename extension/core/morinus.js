import { withLabels } from "./names.js";
import { angle, linesOf, localIso, monthNumber } from "./printed-chart.js";

const refused = (reason) => ({ kind: "refused", reason });

// Morinus and Valens, both by Robert Nagy, print a chart's data in three
// layouts. Morinus's status bar (morin.py, handleStatusBar, in the Python 3
// forks of Morinus 8):
//   Prince Charles | Radix | 1948.november.14. 21:14:39ZN | Long.: 00°10'W Lat.: 51°30'N
// Morinus's square chart, in its centre (squarechart.py), with " J" after a
// Julian date:
//   1948.november.14
//   21:14:39 ZN
//   London
//   00°10'W  51°30'N
//   Prince Charles
//   Radix
//   Placidus
// Valens's wheels, in their centre, as the screenshots on its site show them:
//   November 14, 1948
//   21:14:39 UT
//   Buckingham Palace
//   00°10'W  51°30'N
//   Prince Charles
//   Radix
//   Tropical
//   Porphyrius
// The time is the one the user entered. Its tag says what kind it is: UT,
// ZN for the time in a zone, or LC for local mean or local apparent time,
// which Morinus prints alike. Neither the zone's offset nor daylight saving
// is printed. The coordinates are printed to the minute, longitude first.
// English only: other languages translate the months and the tags.

const TYPES = String.raw`Radix|Solar|Lunar|Revolution|Transit|Horary|Profections|PDs in chart`;
const CLOCK = String.raw`(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})`;
const TAG = String.raw`(?<tag>ZN|UT|LC)`;
const COORDS = String.raw`(?<lngDeg>\d{2,3})°(?<lngMin>\d{2})'(?<lngSide>[EW]) +(?<latDeg>\d{2})°(?<latMin>\d{2})'(?<latSide>[NS])`;

// The status bar's fields as OCR joins them on one line, or each on its own,
// with spaces or bars between them. A "-" before the year means BC.
const STATUS_TIME = new RegExp(
  String.raw`(?:(?<type>${TYPES})[\s|]+)?(?<![\w.])(?<bc>-?)(?<year>\d{1,4})\.(?<month>[a-z]+)\.(?<day>\d{2})\. ${CLOCK}${TAG}(?!\w)`,
);
const STATUS_COORDS = new RegExp(
  String.raw`Long\.: (?<lngDeg>\d{2,3})°(?<lngMin>\d{2})'(?<lngSide>[EW]) Lat\.: (?<latDeg>\d{2})°(?<latMin>\d{2})'(?<latSide>[NS])`,
);
// The square chart's and Valens's lines.
const BLOCK_TIME = new RegExp(String.raw`^${CLOCK} ${TAG}$`);
const BLOCK_COORDS = new RegExp(`^${COORDS}$`);
const MORINUS_DATE = /^(?<year>\d{1,4})\.(?<month>[a-z]+)\.(?<day>\d{2})(?<julian> J)?$/;
const VALENS_DATE = /^(?<month>[A-Z][a-z]+) (?<day>\d{1,2}), (?<year>\d{1,4})$/;
const TYPE_LINE = new RegExp(`^(?<type>${TYPES})$`);

// The Gregorian calendar began on 15 October 1582. Only the square chart
// marks a Julian date, so an earlier one elsewhere could be either. The square
// chart's unmarked one is Gregorian, but is refused too, as resolvePrinted
// refuses every program's date before then.
const GREGORIAN_START = "1582-10-15";

/**
 * Whether a screenshot's text has a Morinus or Valens time: two-digit hours,
 * minutes and seconds with ZN, UT or LC after them.
 *
 * @param {string} text
 */
export function detect(text) {
  return linesOf(text).some((line) => STATUS_TIME.test(line) || BLOCK_TIME.test(line));
}

/**
 * Reads a Morinus status bar or square chart, or a Valens wheel: the record
 * resolvePrinted takes. A UT time is the UTC; a ZN time comes without an
 * offset, for the user to enter. A screenshot can show the status bar and the
 * square chart together, so every layout found is read and they must agree.
 *
 * @param {string} text
 * @returns {Parameters<typeof import("./printed-chart.js").resolvePrinted>[0]
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" | "calendar-unsupported"
 *       | "local-time-ambiguous" | "transit" | "chart-type-unsupported" }}
 */
export function read(text) {
  const lines = linesOf(text);
  const readings = [...statusBar(lines), ...blocks(lines)];
  if (readings.length === 0) return refused("unreadable-screenshot");
  const [first, ...rest] = readings;
  // Two charts that differ, as in a transit window over a radix.
  if (rest.some((reading) => JSON.stringify(reading) !== JSON.stringify(first))) return refused("ambiguous-screenshot");
  return withLabels(first, labelsOf(lines));
}

// The chart's name and place, which the status bar and the blocks print
// differently, so they are read apart from the readings that must agree. A
// block's place is between its time and coordinates, and its name between
// the coordinates and the chart's type; the status bar's name is before the
// type on its line, as "Prince Charles | Radix | 1948.november.14. …", or
// above it when OCR puts each field on a line of its own.
function labelsOf(lines) {
  for (const [index, line] of lines.entries()) {
    if (!BLOCK_TIME.test(line)) continue;
    const coordsAt = [index + 1, index + 2].find((at) => BLOCK_COORDS.test(lines[at] ?? ""));
    if (coordsAt === undefined) continue;
    return {
      name: TYPE_LINE.test(lines[coordsAt + 2] ?? "") ? lines[coordsAt + 1] : null,
      place: coordsAt === index + 2 ? lines[index + 1] : null,
    };
  }
  const statusAt = lines.findIndex((line) => STATUS_TIME.test(line));
  if (statusAt === -1) return {};
  const status = STATUS_TIME.exec(lines[statusAt]);
  if (status.groups.type) return { name: status.input.slice(0, status.index).replace(/[\s|]+$/, "") };
  return { name: TYPE_LINE.test(lines[statusAt - 1] ?? "") ? (lines[statusAt - 2] ?? null) : null };
}

function statusBar(lines) {
  const times = lines.map((line) => STATUS_TIME.exec(line)).filter(Boolean);
  if (times.length === 0) return [];
  const coords = lines.map((line) => STATUS_COORDS.exec(line)).filter(Boolean);
  if (times.length > 1 || coords.length > 1) return [refused("ambiguous-screenshot")];
  if (coords.length === 0) return [refused("unreadable-screenshot")];
  const { bc, type, ...date } = times[0].groups;
  if (bc === "-") return [refused("calendar-unsupported")];
  return [chart({ site: "morinus", ...date, type }, coords[0].groups)];
}

function blocks(lines) {
  return lines.flatMap((line, index) => {
    const time = BLOCK_TIME.exec(line);
    if (!time) return [];
    const above = lines[index - 1] ?? "";
    const morinus = MORINUS_DATE.exec(above);
    const valens = VALENS_DATE.exec(above);
    if (!morinus && !valens) return [refused("unreadable-screenshot")];
    if (morinus?.groups.julian) return [refused("calendar-unsupported")];

    // The place comes between the time and the coordinates, and can be blank.
    const coordsAt = [index + 1, index + 2].find((at) => BLOCK_COORDS.test(lines[at] ?? ""));
    if (coordsAt === undefined) return [refused("unreadable-screenshot")];
    // Then the name, the type and, on Valens, the zodiac.
    const type = lines
      .slice(coordsAt + 1, coordsAt + 4)
      .map((next) => TYPE_LINE.exec(next)?.groups.type)
      .find(Boolean);

    const { year, month, day } = (morinus ?? valens).groups;
    return [
      chart(
        { site: morinus ? "morinus" : "valens", year, month, day, ...time.groups, type },
        BLOCK_COORDS.exec(lines[coordsAt]).groups,
      ),
    ];
  });
}

function chart({ site, year, month, day, hour, minute, second, tag, type }, place) {
  // A screenshot without its type is taken for a radix, the chart Morinus opens.
  if (type === "Transit") return refused("transit");
  if (type !== undefined && type !== "Radix" && type !== "Horary") return refused("chart-type-unsupported");
  // LC is local mean or local apparent time, which run up to 16 minutes apart.
  if (tag === "LC") return refused("local-time-ambiguous");

  const local = localIso({
    year: Number(year),
    month: monthNumber(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  });
  const lat = angle({ deg: Number(place.latDeg), min: Number(place.latMin), negative: place.latSide === "S", limit: 90 });
  const lng = angle({ deg: Number(place.lngDeg), min: Number(place.lngMin), negative: place.lngSide === "W", limit: 180 });
  if (local === null || lat === null || lng === null) return refused("unreadable-screenshot");
  if (local < GREGORIAN_START) return refused("calendar-unsupported");

  // A UT time is its own UTC. A ZN time is the clock in a zone Morinus doesn't print.
  return tag === "UT"
    ? { site, local, lat, lng, zoneLabel: "UT", offsetMinutes: 0 }
    : { site, local, lat, lng, zoneLabel: null };
}
