import { utcFromOffset } from "./civiltime.js";

// AAF, the Astrologisches Austauschformat, as AAF'97 documents it (read from
// the extract at https://www.astro.com/astrowiki/en/AAF on 2026-11-01), plus
// the forms Astrolog 8.00 writes, read from its own output. A file is a stream
// of records. Each starts with an #A93 chunk (name, date, local time, place)
// and may go on with #B93 (Julian Day, coordinates, offset, time type), #ZNAM
// (a zone name) and other chunks. "*" in any field means unknown.

const refused = (reason, line, value) => ({ kind: "refused", reason, line, value });

// "#A93:..." starts a chunk; "#:" is a comment that readers ignore.
const CHUNK = /^#([A-Za-z0-9]*):(.*)$/;

// Chunks that hold free text rather than comma-separated fields. When one runs
// onto further lines, its line breaks are kept; any other chunk continues
// where it broke, as the documentation's #LPOS example does after a comma.
const TEXT_CHUNKS = new Set(["SRC", "VIA", "COM"]);

/**
 * Every record in an AAF text, in order. Each is read on its own, so one
 * malformed record is returned as refused, naming the line and the value it
 * couldn't read, and the rest are still read. Nothing here decides whether a
 * record can be opened: that is chartFromRecord's job.
 *
 * @param {string} text
 * @returns {(AafRecord | { kind: "refused", reason: string, line: number, value: string })[]}
 *
 * @typedef {{
 *   kind: "record",
 *   line: number,
 *   lastName: string | null, firstName: string | null, sex: string | null,
 *   date: { year: number, month: number, day: number, calendar: "gregorian" | "julian" } | null,
 *   time: { hour: number, minute: number, second: number, precision: "hour" | "minute" | "second" } | null,
 *   place: string | null, country: string | null,
 *   julianDay: number | null,
 *   lat: number | null, lng: number | null,
 *   offsetSeconds: number | null,
 *   timeType: "0" | "1" | "w" | "2" | "h" | "L" | "m" | null,
 *   zoneName: string | null,
 *   chunks: { id: string, text: string }[],
 * }} AafRecord
 *   Strings are trimmed; null is a field written as "*". offsetSeconds is east
 *   of Greenwich and excludes daylight saving, which timeType gives.
 */
export function parseAaf(text) {
  // Each record's chunks, with the line each started on, or the line that
  // broke the record. Text before the first #A93 is ignored.
  const groups = [];
  let chunk = null;
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  lines.forEach((content, index) => {
    const line = index + 1;
    if (content.trim() === "") return;
    if (!content.startsWith("#")) {
      // A continuation of the chunk above; before any record, ignored.
      if (chunk) chunk.text += (TEXT_CHUNKS.has(chunk.id) ? "\n" : "") + content;
      return;
    }
    const match = CHUNK.exec(content);
    const id = match?.[1].toUpperCase();
    if (id === "") {
      chunk = null;
      return;
    }
    if (id === "A93") groups.push({ line, chunks: [] });
    const group = groups.at(-1);
    if (!group) return;
    if (!match) {
      group.broken ??= refused("bad-chunk", line, content);
      chunk = null;
      return;
    }
    chunk = { id, text: match[2], line };
    group.chunks.push(chunk);
  });
  return groups.map((group) => group.broken ?? readRecord(group));
}

function readRecord({ line, chunks }) {
  const [a, ...rest] = chunks;
  const b = rest.filter((chunk) => chunk.id === "B93");
  const znam = rest.filter((chunk) => chunk.id === "ZNAM");
  if (b.length > 1) return refused("duplicate-b93", b[1].line, b[1].text);
  if (znam.length > 1) return refused("duplicate-znam", znam[1].line, znam[1].text);

  const fields = a.text.split(",").map((field) => field.trim());
  if (fields.length !== 7) return refused("a93-fields", a.line, a.text);
  const [lastName, firstName, sex, dateText, timeText, place, country] = fields.map(unknownAsNull);

  const date = dateText === null ? null : parseDate(dateText);
  if (date === undefined) return refused("bad-date", a.line, dateText);
  const time = timeText === null ? null : parseTime(timeText);
  if (time === undefined) return refused("bad-time", a.line, timeText);

  const machine = b.length ? readB93(b[0]) : NO_B93;
  if (machine.kind === "refused") return machine;

  return {
    kind: "record",
    line,
    lastName,
    firstName,
    sex,
    date,
    time,
    place,
    country,
    ...machine,
    zoneName: znam.length ? unknownAsNull(znam[0].text.trim()) : null,
    chunks: chunks.map(({ id, text }) => ({ id, text })),
  };
}

const NO_B93 = { julianDay: null, lat: null, lng: null, offsetSeconds: null, timeType: null };

function readB93({ line, text }) {
  const fields = text.split(",").map((field) => field.trim());
  if (fields.length !== 5) return refused("b93-fields", line, text);
  const [jdText, latText, lngText, offsetText, typeText] = fields.map(unknownAsNull);

  // Each field is read only when it isn't *; undefined means unreadable.
  const read = (value, parse) => (value === null ? null : parse(value));
  const julianDay = read(jdText, parseJulianDay);
  if (julianDay === undefined) return refused("bad-julian-day", line, jdText);
  const lat = read(latText, (value) => parseAngle(value, "n", "s", 90));
  if (lat === undefined) return refused("bad-latitude", line, latText);
  const lng = read(lngText, (value) => parseAngle(value, "e", "w", 180));
  if (lng === undefined) return refused("bad-longitude", line, lngText);
  const offsetSeconds = read(offsetText, parseOffset);
  if (offsetSeconds === undefined) return refused("bad-offset", line, offsetText);
  if (typeText !== null && !TIME_TYPES.has(typeText)) return refused("bad-time-type", line, typeText);

  return { julianDay, lat, lng, offsetSeconds, timeType: typeText };
}

const unknownAsNull = (field) => (field === "*" ? null : field);

// "23.10.1966", "24.12.-6g", "7.10.1582j": day.month.year, the year with its
// century, and g or j to name the calendar. Without one, dates before 15
// October 1582 are Julian.
const DATE = /^(\d{1,2})\.(\d{1,2})\.(-?\d{1,5})([gj])?$/;

function parseDate(text) {
  const match = DATE.exec(text);
  if (!match) return undefined;
  const [day, month, year] = match.slice(1, 4).map(Number);
  const before = year < 1582 || (year === 1582 && (month < 10 || (month === 10 && day < 15)));
  const calendar = match[4] === "g" ? "gregorian" : match[4] === "j" || before ? "julian" : "gregorian";
  return month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month, calendar)
    ? { year, month, day, calendar }
    : undefined;
}

function daysIn(year, month, calendar) {
  if (month !== 2) return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const leap = calendar === "julian"
    ? mod(year, 4) === 0
    : (mod(year, 4) === 0 && mod(year, 100) !== 0) || mod(year, 400) === 0;
  return leap ? 29 : 28;
}

// The remainder with the divisor's sign, so year -4 is a leap year.
const mod = (a, b) => ((a % b) + b) % b;

// "16:55", "22h30:12", "19h", "23:59:59": hour, then optional minutes and
// seconds. h may stand in for the first colon.
const TIME = /^(\d{1,2})(?:h|(?:[:h](\d{1,2})(?::(\d{1,2}))?))?$/;

function parseTime(text) {
  const match = TIME.exec(text);
  if (!match) return undefined;
  const [hour, minute, second] = [match[1], match[2] ?? "0", match[3] ?? "0"].map(Number);
  if (hour > 23 || minute > 59 || second > 59) return undefined;
  const precision = match[3] !== undefined ? "second" : match[2] !== undefined ? "minute" : "hour";
  return { hour, minute, second, precision };
}

const JULIAN_DAY = /^-?\d+(?:\.\d+)?$/;
const parseJulianDay = (text) => (JULIAN_DAY.test(text) ? Number(text) : undefined);

// "48n46", "15s53:03", "74w54:45": degrees, a direction letter, minutes and
// optional seconds. Astrolog writes the letter in capitals. "0:00" is the
// documentation's form for zero, which has no direction.
const ANGLE = /^(\d{1,3})([nsewNSEW])(\d{1,2})(?::(\d{1,2}))?$/;
const ZERO_ANGLE = /^0+:0+(?::0+)?$/;

// positive and negative are the two letters the field may use, so a latitude
// written with e or w is refused. Rounded to 6 decimals like the site readers.
function parseAngle(text, positive, negative, limit) {
  if (ZERO_ANGLE.test(text)) return 0;
  const match = ANGLE.exec(text);
  if (!match) return undefined;
  const side = match[2].toLowerCase();
  if (side !== positive && side !== negative) return undefined;
  const [deg, min, sec] = [match[1], match[3], match[4] ?? "0"].map(Number);
  if (min > 59 || sec > 59) return undefined;
  const value = Math.round((deg + min / 60 + sec / 3600) * 1e6) / 1e6;
  if (value > limit) return undefined;
  // "0 - value" rather than "-value" keeps 0°0' west at 0 instead of -0.
  return side === negative ? 0 - value : value;
}

// "1he", "5hw00", "0h", "0he32:06": hours, h, then e or w and optional minutes
// and seconds. Only a zero offset may leave out the direction.
const OFFSET = /^(\d{1,2})h(?:([ew])(\d{1,2})?(?::(\d{1,2}))?)?$/;
// "5W", "5:30E": Astrolog 8.00's form, hours and optional minutes, then E or W.
const ASTROLOG_OFFSET = /^(\d{1,2})(?::(\d{2}))?([EW])$/;

function parseOffset(text) {
  let hours, minutes, seconds, side;
  const match = OFFSET.exec(text);
  const astrolog = ASTROLOG_OFFSET.exec(text);
  if (match) [hours, side, minutes, seconds] = [match[1], match[2], match[3], match[4]];
  else if (astrolog) [hours, minutes, side] = [astrolog[1], astrolog[2], astrolog[3].toLowerCase()];
  else return undefined;

  const [h, m, s] = [hours, minutes ?? "0", seconds ?? "0"].map(Number);
  if (h > 24 || m > 59 || s > 59) return undefined;
  const size = h * 3600 + m * 60 + s;
  if (side === undefined) return size === 0 ? 0 : undefined;
  // "0 - size" rather than "-size" keeps 0hw at 0 instead of -0.
  return side === "e" ? size : 0 - size;
}

// 0 standard time, 1 daylight saving, w war time (the same as 1), 2 double
// daylight saving, h half an hour of daylight saving, L local mean time, m a
// special meridian such as the capital's local time (the same as 0).
const TIME_TYPES = new Set(["0", "1", "w", "2", "h", "L", "m"]);

// Minutes of daylight saving for each time type chartFromRecord opens.
const DAYLIGHT_MINUTES = { 0: 0, 1: 60, w: 60, 2: 120, h: 30 };

// A Julian Day and the record's own date, time and offset agree within this.
// Astrolog writes six decimals, about a tenth of a second.
const JULIAN_DAY_TOLERANCE_MS = 60_000;

// Julian Day 2440587.5 is 1970-01-01T00:00:00Z, the start of JavaScript's clock.
const JD_UNIX_EPOCH = 2440587.5;

/**
 * The chart for a record parseAaf returned, in the shape analyzePage returns
 * for a chart page, or why it can't be opened. Nothing missing is filled in:
 * a record without a birth time, coordinates, offset or time type is refused,
 * and so is one whose Julian Day disagrees with its date, time and offset.
 *
 * Local mean time, a special meridian, the Julian calendar and offsets with
 * seconds are refused for now, as the astro.com reader refuses local mean time.
 *
 * aaf carries what an AAF file states and a chart page doesn't, so the chart
 * can be written back without losing it.
 *
 * @param {ReturnType<typeof parseAaf>[number]} record
 * @returns {{ kind: "refused", reason: string, line: number }
 *   | { kind: "natal", site: "aaf", local: string, zoneLabel: string | null, lat: number, lng: number,
 *       utc: string, utcSource: "declared", offsetMinutes: number, warnings?: ["time-hour-only"],
 *       name: string | null, place: string | null,
 *       aaf: { lastName: string | null, firstName: string | null, sex: string | null,
 *         place: string | null, country: string | null,
 *         standardOffsetMinutes: number, timeType: "0" | "1" | "w" | "2" | "h" } }}
 */
export function chartFromRecord(record) {
  if (record.kind === "refused") return record;
  const { line, date, time, lat, lng, offsetSeconds, timeType } = record;
  const no = (reason) => ({ kind: "refused", reason, line });

  if (date === null) return no("no-birth-date");
  if (time === null) return no("no-birth-time");
  if (date.calendar === "julian") return no("julian-calendar");
  if (date.year < 1582 || (date.year === 1582 && (date.month < 10 || (date.month === 10 && date.day < 15)))) {
    return no("pre-gregorian-date");
  }
  if (lat === null || lng === null) return no("no-coordinates");
  if (timeType === "L") return no("local-mean-time");
  if (timeType === "m") return no("meridian-time");
  if (timeType === null) return no("unknown-daylight-saving");
  if (offsetSeconds === null) return no("no-offset");
  if (offsetSeconds % 60 !== 0) return no("offset-seconds");

  const standardOffsetMinutes = offsetSeconds / 60;
  const offsetMinutes = standardOffsetMinutes + DAYLIGHT_MINUTES[timeType];
  // -12:00 to +14:00, the range of offsets in use today, as parseOffset accepts.
  if (offsetMinutes < -720 || offsetMinutes > 840) return no("offset-out-of-range");

  const local = `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}T${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`;
  const utc = utcFromOffset(local, offsetMinutes);
  if (record.julianDay !== null) {
    const julianMs = (record.julianDay - JD_UNIX_EPOCH) * 86_400_000;
    if (Math.abs(julianMs - Date.parse(utc)) > JULIAN_DAY_TOLERANCE_MS) return no("julian-day-mismatch");
  }

  const { lastName, firstName, sex, place, country } = record;
  return {
    kind: "natal",
    site: "aaf",
    local,
    zoneLabel: record.zoneName,
    lat,
    lng,
    utc,
    utcSource: "declared",
    offsetMinutes,
    ...(time.precision === "hour" ? { warnings: ["time-hour-only"] } : {}),
    name: joined([firstName, lastName], " "),
    place: joined([place, country], ", "),
    aaf: { lastName, firstName, sex, place, country, standardOffsetMinutes, timeType },
  };
}

// Astro-Seek zone labels whose offset splits into a standard offset and
// daylight saving: the labels of ZONE_OFFSETS. EWT, war time, is written as
// 1: AAF'97 calls w and 1 the same, and Astrolog 8.00 reads 1 but not w.
const ZONE_SPLITS = {
  EST: { standardOffsetMinutes: -300, timeType: "0" },
  EDT: { standardOffsetMinutes: -300, timeType: "1" },
  EWT: { standardOffsetMinutes: -300, timeType: "1" },
  AEST: { standardOffsetMinutes: 600, timeType: "0" },
  AEDT: { standardOffsetMinutes: 600, timeType: "1" },
};

/**
 * The AAF record for a chart whose UTC is decided: a natal result from
 * analyzePage, analyzeScreenshot or chartFromRecord, or the sky of a
 * Stellarium Web tab. AAF wants the standard offset and the daylight saving
 * apart, so the local time is kept only where the source states both: an AAF
 * chart, or an Astro-Seek chart whose zone label Chart Bridge has checked.
 * Every other chart is written in Universal Time, which is never wrong, and
 * basis says so. Nothing else is filled in: unknown names and places stay null.
 *
 * Throws when there is no decided UTC: that means the caller ran too early.
 *
 * @param {{ utc: string, lat: number, lng: number, site?: string } & object} chart
 * @returns {{ basis: "local" | "utc", lastName: string | null, firstName: string | null, sex: string | null,
 *   place: string | null, country: string | null, local: string, standardOffsetMinutes: number,
 *   timeType: "0" | "1" | "2" | "h", lat: number, lng: number, zoneName: string | null }}
 */
export function exportRecord(chart) {
  const { utc, lat, lng } = chart;
  if (typeof utc !== "string" || !UTC_INSTANT.test(utc)) {
    throw new Error(`exportRecord needs a decided UTC like 2024-04-17T12:00:00Z, got ${utc}`);
  }
  const unnamed = { lastName: null, firstName: null, sex: null, place: null, country: null };
  const inUt = { ...unnamed, basis: "utc", local: utc.slice(0, -1), standardOffsetMinutes: 0, timeType: "0", lat, lng, zoneName: null };

  if (chart.site === "aaf") {
    const { lastName, firstName, sex, place, country, standardOffsetMinutes, timeType } = chart.aaf;
    return {
      basis: "local",
      lastName,
      firstName,
      sex,
      place,
      country,
      local: chart.local,
      standardOffsetMinutes,
      timeType: timeType === "w" ? "1" : timeType,
      lat,
      lng,
      zoneName: chart.zoneLabel,
    };
  }

  // Only a label resolveUtc checked against the printed UT, with no warning.
  if (chart.site === "astro-seek" && chart.utcSource === "printed" && !chart.warnings?.length) {
    const split = ZONE_SPLITS[chart.zoneLabel?.split(",")[0].trim()];
    if (split && split.standardOffsetMinutes + (split.timeType === "1" ? 60 : 0) === chart.offsetMinutes) {
      return { ...unnamed, basis: "local", local: chart.local, ...split, lat, lng, zoneName: null };
    }
  }
  return inUt;
}

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * An AAF file of the records exportRecord returned, in the AAF'97 forms, with
 * only #A93 and #B93 chunks: Astrolog 8.00 refuses a file with any other,
 * #ZNAM included, so a zone name goes in a #: comment, which every reader
 * skips. The Julian Day is written as *, as AAF'97 recommends.
 *
 * @param {ReturnType<typeof exportRecord>[]} records
 * @returns {string}
 */
export function writeAaf(records) {
  const lines = ["#: Chart Bridge"];
  for (const record of records) {
    if (record.basis === "utc") {
      lines.push("#: Universal Time: the source doesn't say how its offset splits into standard time and daylight saving.");
    }
    const [date, clock] = record.local.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute, second] = clock.split(":").map(Number);
    const time = `${hour}:${pad(minute)}${second ? `:${pad(second)}` : ""}`;
    const text = [record.lastName, record.firstName, record.sex].map(fieldText);
    lines.push(`#A93:${text.join(",")},${day}.${month}.${year},${time},${fieldText(record.place)},${fieldText(record.country)}`);
    lines.push(
      `#B93:*,${angleText(record.lat, "n", "s")},${angleText(record.lng, "e", "w")},` +
        `${offsetText(record.standardOffsetMinutes)},${record.timeType}`,
    );
    if (record.zoneName) lines.push(`#: Zone name: ${record.zoneName}`);
  }
  return `${lines.join("\n")}\n`;
}

// A field can't hold a comma or a line break, and AAF has no escape for
// either: a comma becomes a semicolon, as Astrolog 8.00 writes it, and a line
// break a space. null, unknown, is "*".
const fieldText = (value) =>
  value === null ? "*" : value.replaceAll(",", ";").replace(/[\r\n\t\v\f]+/g, " ").trim();

// 40.716667 → "40n43", -15.884167 → "15s53:03". Rounding the total in seconds
// lets 59.99" carry into the next minute.
function angleText(value, positive, negative) {
  const total = Math.round(Math.abs(value) * 3600);
  const [deg, min, sec] = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
  return `${deg}${value < 0 && total > 0 ? negative : positive}${pad(min)}${sec ? `:${pad(sec)}` : ""}`;
}

// -300 → "5hw00", 330 → "5he30", 0 → "0h".
function offsetText(minutes) {
  if (minutes === 0) return "0h";
  const size = Math.abs(minutes);
  return `${Math.floor(size / 60)}h${minutes < 0 ? "w" : "e"}${pad(size % 60)}`;
}

// The parts that are known and not empty, joined, or null when none is.
const joined = (parts, separator) => parts.filter((part) => part).join(separator) || null;

const pad = (n, width = 2) => String(n).padStart(width, "0");
