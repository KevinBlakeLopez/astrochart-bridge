import { utcFromOffset } from "./civiltime.js";
import { readPickles } from "./pickle.js";
import { angle, localIso } from "./printed-chart.js";

// Morinus's .hor chart file, as every version from the Python 2 originals to
// Morinus 9.6 and Morinus SE 8.0 writes it: 27 Python pickles, one after
// another, each holding one str, int or bool (morin.py, save and subLoad).
// core/pickle.js reads them without running anything; this knows what the
// fields mean. docs/morinus-hor.md has the field list and its sources.
//
// The file holds the time as entered, its calendar, how the time was given
// (in a zone, at Greenwich, or in local mean or apparent time), a fixed zone
// offset with a daylight-saving box that is always one hour, the place's
// coordinates and altitude, and the name, chart type and notes. It holds no
// time zone, no house system and no other setting: Morinus keeps those for
// all charts alike, apart from the files.

const refused = (reason, extra = {}) => ({ kind: "refused", reason, ...extra });

/** The fields in the order Morinus writes them. */
export const HOR_FIELDS = Object.freeze([
  "name", "male", "htype", "bc", "year", "month", "day", "hour", "minute", "second",
  "cal", "zt", "plus", "zh", "zm", "daylightsaving",
  "place", "deglon", "minlon", "seclon", "east", "deglat", "minlat", "seclat", "north",
  "altitude", "notes",
]);

// A file is about 150 bytes plus its notes.
export const MAX_HOR_BYTES = 256 * 1024;

const text = { type: "string" };
const yesNo = { type: "boolean" };
const whole = (min, max) => ({ type: "integer", min, max });

// What each field may hold: the personal data dialog's ranges
// (personaldatadlg.py), except zone hours to 23 rather than 12, since a file
// can come from elsewhere and an offset past +14:00 is refused with a reason.
const SHAPES = {
  name: text, male: yesNo, htype: whole(0, 7), bc: yesNo,
  year: whole(0, 9999), month: whole(1, 12), day: whole(1, 31),
  hour: whole(0, 23), minute: whole(0, 59), second: whole(0, 59),
  cal: whole(0, 1), zt: whole(0, 3), plus: yesNo, zh: whole(0, 23), zm: whole(0, 59), daylightsaving: yesNo,
  place: text, deglon: whole(0, 180), minlon: whole(0, 59), seclon: whole(0, 59), east: yesNo,
  deglat: whole(0, 90), minlat: whole(0, 59), seclat: whole(0, 59), north: yesNo,
  altitude: whole(-1_000_000, 1_000_000), notes: text,
};

// Every byte a .hor can start with: PROTO, from protocol 2 on. Protocols 0 and
// 1 start with the name's string opcode, a letter a text file can start with
// too, so those are told by their name.
const PROTO = 0x80;

/**
 * Whether a chosen file is a Morinus chart rather than AAF text.
 *
 * @param {string} name  the file's name
 * @param {Uint8Array} bytes
 */
export function isHorFile(name, bytes) {
  return /\.hor$/i.test(name) || bytes[0] === PROTO;
}

/**
 * The 27 values of a .hor file, or why it can't be read: the field a
 * refusal stopped at, and for an opcode outside the few plain values need,
 * its name and byte offset.
 *
 * @param {Uint8Array} bytes
 * @returns {{ kind: "record", values: Record<string, string | number | boolean>, protocol: number,
 *     warnings: "text-encoding-guessed"[] }
 *   | { kind: "refused", reason: "too-large" | "truncated" | "trailing-data" | "unsupported-opcode" | "malformed"
 *       | "bad-text" | "field-type" | "field-range", field?: string, opcode?: string, offset?: number }}
 */
export function parseHor(bytes) {
  if (bytes.length > MAX_HOR_BYTES) return refused("too-large");
  const read = readPickles(bytes, HOR_FIELDS.length);
  if (read.kind === "refused") {
    const { reason, index, ...rest } = read;
    return reason === "trailing-data" ? refused(reason) : refused(reason, { field: HOR_FIELDS[index], ...rest });
  }

  const values = {};
  for (const [index, field] of HOR_FIELDS.entries()) {
    const value = fitted(SHAPES[field], read.values[index]);
    if (value === undefined) return refused("field-type", { field });
    if (value === null) return refused("field-range", { field });
    values[field] = value;
  }
  return { kind: "record", values, protocol: read.protocol, warnings: read.guessedText ? ["text-encoding-guessed"] : [] };
}

// The value as its field holds it: undefined for the wrong type, null for one
// out of range. Morinus reads any true value as yes, so 0 and 1 are booleans.
function fitted(shape, value) {
  if (shape.type === "string") return typeof value === "string" ? value : undefined;
  if (shape.type === "boolean") {
    if (typeof value === "boolean") return value;
    return value === 0 || value === 1 ? value === 1 : undefined;
  }
  if (!Number.isSafeInteger(value)) return undefined;
  return value >= shape.min && value <= shape.max ? value : null;
}

const CHART_TYPES = { 0: "radix", 5: "horary" };
const TIME_BASES = ["zone", "greenwich", "local-mean", "local-apparent"];

/**
 * The chart for a record parseHor returned, in the shape analyzePage returns
 * for a chart page, or why it can't be opened. Like chartFromRecord for AAF,
 * nothing missing is filled in.
 *
 * The UTC is the one Morinus works out (chart.py, Time): the time as entered,
 * an hour earlier when the daylight-saving box is ticked, whatever the time
 * basis, then less the zone's offset for a time in a zone. Local mean and
 * local apparent time, the Julian calendar and dates BC are refused for now,
 * as the AAF and screenshot readers refuse them. So are chart types other
 * than a radix or a horary chart, as the screenshot reader refuses them.
 *
 * morinus carries what the file states and the chart doesn't, such as the
 * offset as entered and the altitude, so the screen can show where the chart
 * came from. The notes are left out: only whether there are any.
 *
 * @param {ReturnType<typeof parseHor>} record
 * @returns {ReturnType<typeof parseHor> & { kind: "refused" }
 *   | { kind: "refused", reason: "chart-type-unsupported" | "bce-date" | "julian-calendar" | "bad-date"
 *       | "pre-gregorian-date" | "local-mean-time" | "local-apparent-time" | "bad-coordinates" | "offset-out-of-range" }
 *   | { kind: "natal", site: "morinus", local: string, zoneLabel: "UT" | null, lat: number, lng: number,
 *       utc: string, utcSource: "declared", offsetMinutes: number,
 *       warnings?: ("text-encoding-guessed" | "daylight-saving-on-ut" | "longitude-seconds-ignored-by-morinus")[],
 *       name: string | null, place: string | null,
 *       morinus: { chartType: "radix" | "horary", male: boolean, timeBasis: "zone" | "greenwich", zoneOffsetMinutes: number,
 *         daylightSaving: boolean, altitudeMeters: number, coordinates: object, hasNotes: boolean, protocol: number } }}
 */
export function chartFromHor(record) {
  if (record.kind === "refused") return record;
  const v = record.values;

  const chartType = CHART_TYPES[v.htype];
  if (chartType === undefined) return refused("chart-type-unsupported");
  if (v.bc) return refused("bce-date");
  if (v.cal === 1) return refused("julian-calendar");
  const local = localIso({ year: v.year, month: v.month, day: v.day, hour: v.hour, minute: v.minute, second: v.second });
  if (local === null) return refused("bad-date");
  // Morinus runs its Gregorian calendar back before 15 October 1582, when it began.
  if (local < "1582-10-15") return refused("pre-gregorian-date");
  const timeBasis = TIME_BASES[v.zt];
  if (timeBasis === "local-mean") return refused("local-mean-time");
  if (timeBasis === "local-apparent") return refused("local-apparent-time");

  const lat = angle({ deg: v.deglat, min: v.minlat, sec: v.seclat, negative: !v.north, limit: 90 });
  const lng = angle({ deg: v.deglon, min: v.minlon, sec: v.seclon, negative: !v.east, limit: 180 });
  if (lat === null || lng === null) return refused("bad-coordinates");

  // plus is east of Greenwich. "+ 0" keeps an offset of 0 from being -0.
  const zoneOffsetMinutes = (v.plus ? 1 : -1) * (v.zh * 60 + v.zm) + 0;
  const offsetMinutes = (timeBasis === "zone" ? zoneOffsetMinutes : 0) + (v.daylightsaving ? 60 : 0);
  // -12:00 to +14:00, the range parseOffset accepts.
  if (offsetMinutes < -720 || offsetMinutes > 840) return refused("offset-out-of-range");

  const warnings = [...record.warnings];
  if (timeBasis === "greenwich" && v.daylightsaving) warnings.push("daylight-saving-on-ut");
  // Every Morinus opens a file with 0 for these (subLoad: morin.py:983 in
  // 9.6.4), so the chart it draws is up to 59" further east or west.
  if (v.seclon !== 0) warnings.push("longitude-seconds-ignored-by-morinus");

  return {
    kind: "natal",
    site: "morinus",
    local,
    zoneLabel: timeBasis === "greenwich" && !v.daylightsaving ? "UT" : null,
    lat,
    lng,
    utc: utcFromOffset(local, offsetMinutes),
    utcSource: "declared",
    offsetMinutes,
    ...(warnings.length ? { warnings } : {}),
    name: v.name || null,
    place: v.place || null,
    morinus: {
      chartType,
      male: v.male,
      timeBasis,
      zoneOffsetMinutes,
      daylightSaving: v.daylightsaving,
      altitudeMeters: v.altitude,
      coordinates: {
        deglon: v.deglon, minlon: v.minlon, seclon: v.seclon, east: v.east,
        deglat: v.deglat, minlat: v.minlat, seclat: v.seclat, north: v.north,
      },
      hasNotes: v.notes !== "",
      protocol: record.protocol,
    },
  };
}
