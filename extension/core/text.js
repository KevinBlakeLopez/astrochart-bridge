// Reads birth data from text the user pasted: copied from a desktop astrology
// program, a report, a PDF or a note. Unlike the site readers there is no page
// or URL to check it against, so nothing here is decided for the user. readText
// returns each field it found with the line it came from, and whatever it
// couldn't settle, such as both readings of 04/05/1985 or two offsets that
// disagree, as a problem for the review form to show.
//
// Only "Label: value" and "key=value" lines with a known label are read. Lines
// with any other label, such as planet positions, transit dates or the date a
// report was printed, are ignored.
import { parseOffset } from "./civiltime.js";

const refused = (reason) => ({ kind: "refused", reason });

// Long enough for a full natal report, and splitting it into lines is instant.
export const MAX_TEXT_LENGTH = 100_000;

// "Date of Birth: June 15, 1985", "birth_date=1985-06-15". The label stops at
// the first colon or equals sign, so a time in the value stays in the value.
const LINE = /^\s*([^:=]{1,40}?)\s*[:=]\s*(.*?)\s*$/;

// Each reader, and the labels it reads, as labelKey writes them. A bare "Date"
// or "Time" isn't read: reports use them for when the report was made.
const LABELS = new Map(
  Object.entries({
    name: ["name", "chart name"],
    born: ["born", "date of birth", "birth date", "birthdate", "dob", "date and time of birth", "birth date and time"],
    time: ["time of birth", "birth time"],
    place: ["place", "place of birth", "birth place", "birthplace", "location", "city"],
    country: ["country", "country of birth", "birth country"],
    gender: ["gender", "sex"],
    coordinates: ["coordinates", "coords", "latitude longitude"],
    latitude: ["latitude", "lat"],
    longitude: ["longitude", "long", "lng", "lon"],
    offset: ["utc offset", "gmt offset", "offset"],
    zone: ["time zone", "timezone", "zone", "tz"],
    houses: ["house system", "houses"],
    zodiac: ["zodiac"],
    ayanamsa: ["ayanamsa", "ayanamsha"],
  }).flatMap(([reader, labels]) => labels.map((label) => [label, reader])),
);

// Labels that aren't read but end the value before them, when a copy runs a
// page's rows together on one line, as one of Astro-Seek's did:
// "…00:00  (PST)Universal Time (UT/GMT):1 January 1970 - 08:00  Local Sidereal Time (LST):22:35:14House system:…".
const SKIPPED_LABELS = ["universal time", "local sidereal time", "sidereal time"];

// Any label, read or skipped, that ends in a colon or equals sign, with a
// bracketed note before it as in "Universal Time (UT/GMT):". Longer labels
// come first, so "Chart Name" is found before "Name". The separators are the
// ones labelKey turns into spaces.
const RUN_ON_LABEL = new RegExp(
  `(?:${[...LABELS.keys(), ...SKIPPED_LABELS]
    .sort((a, b) => b.length - a.length)
    .map((label) => label.split(" ").join("[\\s_\\-.,/]+"))
    .join("|")})(?:\\s*\\([^)]*\\))?\\s*[:=]`,
  "gi",
);

/**
 * One line of pasted text as the labelled lines run together in it: split
 * before each label after its first that starts with a capital letter, as a
 * page's labels do. "Velocity:" has no "City:" in it, and a lower-case
 * "key=value" is never split, since nothing marks where its key starts.
 *
 * @param {string} line
 * @returns {string[]}
 */
function runOnLines(line) {
  const starts = [...line.matchAll(RUN_ON_LABEL)].map((match) => match.index).filter((at) => at > 0 && /[A-Z]/.test(line[at]));
  return [0, ...starts].map((start, i, all) => line.slice(start, all[i + 1]));
}

// The labels runOnLines splits at, as labelKey writes them.
const KNOWN_LABELS = new Set([...LABELS.keys(), ...SKIPPED_LABELS]);

// "City:" with nothing after it, for a label read or skipped.
function isLabelAlone(text) {
  const match = LINE.exec(text);
  return match !== null && match[2] === "" && KNOWN_LABELS.has(labelKey(match[1]));
}

// Whether a line can be the value of the label alone on the line before it:
// not blank, not a label alone of any kind, such as a report's "Planets:"
// heading, and not a label read or skipped with its value, as in
// "Name:" above "Date of Birth: 15 June 1985".
function isValue(text) {
  const match = LINE.exec(text);
  return text.trim() !== "" && !(match && (match[2] === "" || KNOWN_LABELS.has(labelKey(match[1]))));
}

/**
 * Pasted text as "Label: value" lines, each with the number of the line its
 * value is on, counting from 1. Labels run together on one line are split
 * apart, at the line they share. A label alone on its line, as a copy of
 * Astro-Seek's page in Firefox puts it, is joined to the value on the next.
 *
 * @param {string[]} lines
 * @returns {{ line: number, text: string }[]}
 */
function labelledLines(lines) {
  const pieces = lines.flatMap((line, index) => runOnLines(line).map((text) => ({ line: index + 1, text })));
  const joined = [];
  for (let i = 0; i < pieces.length; i++) {
    const [piece, next] = [pieces[i], pieces[i + 1]];
    // The next piece starts the next line, so this one ends its own line.
    if (next && next.line === piece.line + 1 && isLabelAlone(piece.text) && isValue(next.text)) {
      joined.push({ line: next.line, text: `${piece.text.trimEnd()} ${next.text.trimStart()}` });
      i++;
    } else {
      joined.push(piece);
    }
  }
  return joined;
}

/**
 * Pasted text with each labelled line on a line of its own, its label and
 * value together, for Astro-Seek's screenshot reader, which reads whole lines.
 *
 * @param {string} text
 */
export function separateLabels(text) {
  return labelledLines(text.split(/\r\n|\r|\n/))
    .map((piece) => piece.text)
    .join("\n");
}

// "Date of Birth (local time)" → "date of birth", "birth_date" → "birth date"
const labelKey = (label) =>
  label
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[_\-.,/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Characters word processors and PDFs put in place of the ASCII ones the
// patterns below expect.
const normalize = (line) =>
  line
    .replace(/−/g, "-")
    .replace(/[º˚]/g, "°")
    .replace(/[′‘’]/g, "'")
    .replace(/[″“”]/g, '"');

// Frozen because readField returns it as is.
const UNREADABLE = Object.freeze({ value: null, problem: "unreadable" });
const orUnreadable = (value) => (value === null ? UNREADABLE : { value });

// Each reader takes a label's value and returns [field, reading] pairs: one
// line can give several fields, as "Born: 15 June 1985 at 10:30 AM" does.
const READERS = {
  name: (text) => [["name", { value: text }]],
  place: (text) => [["place", { value: text }]],
  // As written; it helps choose the town among astro.com's and Astro-Seek's matches.
  country: (text) => [["country", { value: text }]],
  gender: (text) => [["gender", orUnreadable(GENDERS[text.toLowerCase()] ?? null)]],
  ayanamsa: (text) => [["ayanamsa", { value: text }]],
  born: readBorn,
  time: readTimeAndOffset,
  coordinates: readCoordinates,
  latitude: (text) => [["lat", angleField(text, "lat")]],
  longitude: (text) => [["lng", angleField(text, "lng")]],
  offset: (text) => [["offset", orUnreadable(findOffset(text))]],
  // The zone is kept as written, for the review form; only an offset in it is used.
  zone: (text) => {
    const offset = findOffset(text);
    return [["zone", { value: text }], ...(offset === null ? [] : [["offset", { value: offset }]])];
  },
  houses: (text) => [["houses", orUnreadable(houseSystem(text))]],
  zodiac: (text) => [["zodiac", orUnreadable(ZODIAC.exec(text)?.[1].toLowerCase() ?? null)]],
};

// A Gender or Sex line's value, as astro.com's and Astro-Seek's forms take
// it. Anything else is unreadable, not guessed.
const GENDERS = { female: "female", f: "female", woman: "female", male: "male", m: "male", man: "male", event: "event" };

// Two different birth dates or names mean the text holds more than one chart.
// Any other field read twice with different values is a conflict to resolve.
const RECORD_FIELDS = new Set(["date", "name"]);

/**
 * The birth data in pasted text, field by field. A field is left out when the
 * text doesn't mention it. Each one found is
 *   { line, text, value }  line counts from 1; text is the label's value
 *   { line, text, value: null, problem: "unreadable" }
 *   { line, text, value: null, problem: "ambiguous", readings }  a date like 04/05/1985
 *   { value: null, problem: "conflict", sightings }  sightings are the forms above
 * Values: date "1985-06-15", time "10:30:00", lat and lng in signed degrees,
 * offset in minutes east of UTC, houses an id such as "placidus", zodiac
 * "tropical" or "sidereal"; name, place, zone and ayanamsa as written.
 *
 * @param {string} text
 * @returns {{ kind: "fields", fields: Record<string, object> }
 *   | { kind: "refused", reason: "too-long" | "no-birth-data" | "several-records" }}
 */
export function readText(text) {
  if (text.length > MAX_TEXT_LENGTH) return refused("too-long");

  const sightings = new Map();
  for (const { line, text: piece } of labelledLines(text.split(/\r\n|\r|\n/).map(normalize))) {
    const match = LINE.exec(piece);
    const reader = match && match[2] !== "" ? LABELS.get(labelKey(match[1])) : undefined;
    if (!reader) continue;
    for (const [field, reading] of READERS[reader](match[2])) {
      if (!sightings.has(field)) sightings.set(field, []);
      sightings.get(field).push({ line, text: match[2], ...reading });
    }
  }
  if (sightings.size === 0) return refused("no-birth-data");

  const fields = {};
  for (const [field, list] of sightings) {
    // A repeated line, or an offset given by both the zone and the time, counts
    // once, at the first line that gave it.
    const distinct = list.filter(
      (s, i) => list.findIndex((t) => JSON.stringify([s.value, s.problem, s.readings]) === JSON.stringify([t.value, t.problem, t.readings])) === i,
    );
    if (distinct.length === 1) fields[field] = distinct[0];
    else if (RECORD_FIELDS.has(field)) return refused("several-records");
    else fields[field] = { value: null, problem: "conflict", sightings: distinct };
  }
  return { kind: "fields", fields };
}

// The review form's fields, each read as one value and nothing after it.
const FIELD_READERS = {
  date: (text) => {
    const date = matchDate(text);
    return date && date.rest.trim() === "" ? dateReading(date.readings) : UNREADABLE;
  },
  time: (text) => {
    const time = matchTime(text);
    return time && time.rest.trim() === "" ? { value: time.value } : UNREADABLE;
  },
  lat: (text) => angleField(text, "lat"),
  lng: (text) => angleField(text, "lng"),
  offset: (text) => orUnreadable(findOffset(text)),
};

/**
 * One value typed into the review form, read the way readText reads the same
 * field in pasted text, so a correction can be written in any form a paste can.
 *
 * @param {"date" | "time" | "lat" | "lng" | "offset"} field
 * @param {string} text
 * @returns {{ value: string | number } | { value: null, problem: "unreadable" }
 *   | { value: null, problem: "ambiguous", readings: string[] }}
 */
export function readField(field, text) {
  if (!Object.hasOwn(FIELD_READERS, field)) throw new Error(`readField can't read a ${field} field`);
  return FIELD_READERS[field](normalize(text).trim());
}

// What may come between the date and the time: "15 June 1985 at 10:30",
// "June 15, 1985, 10:30", "17 April 2024 - 08:00", "1985-06-15T10:30".
const DATE_TIME_GAP = /^\s*(?:,|\bat\b|[-–—]|T(?=\d))?\s*/i;

// A date, and the time and offset after it when the rest starts with a digit.
// Anything else after the date, such as "(Saturday)", is ignored.
function readBorn(text) {
  const date = matchDate(text);
  if (!date) return [["date", UNREADABLE]];
  const read = [["date", dateReading(date.readings)]];
  const rest = date.rest.replace(DATE_TIME_GAP, "");
  return /^\d/.test(rest) ? [...read, ...readTimeAndOffset(rest)] : read;
}

function dateReading(readings) {
  if (readings.length === 0) return UNREADABLE;
  if (readings.length === 1) return { value: readings[0] };
  return { value: null, problem: "ambiguous", readings };
}

// A time, and the offset right after it, as in "10:30 UTC-7" or ISO 8601's
// "10:30:00-07:00". A zone name after the time, such as "PDT", is ignored:
// zones are read from their own field.
function readTimeAndOffset(text) {
  const time = matchTime(text);
  if (!time) return [["time", UNREADABLE]];
  const offset = findOffset(time.rest);
  return [["time", { value: time.value }], ...(offset === null ? [] : [["offset", { value: offset }]])];
}

const WEEKDAY = /^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i;
// "1985-06-15", "1985/6/15": with the year first, the month always comes next.
const YEAR_FIRST = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/;
// "15 June 1985", "15th Jun. 1985", "15-Jun-1985"
const DAY_FIRST = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+)\.?,?[\s-]+(\d{4})(?!\d)/i;
// "June 15, 1985", "Jun 15 1985"
const MONTH_FIRST = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)/i;
// "04/05/1985", "4.5.1985": the day and month could be either way round.
const NUMERIC = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?!\d)/;

// The calendar dates the start of text can mean, as "1985-06-15", and the
// text after it; null when it doesn't start with a date. Only four-digit
// years are read, so "85" is never taken for 1985 or 2085.
function matchDate(text) {
  const start = text.replace(WEEKDAY, "");
  let match;
  let candidates;
  if ((match = YEAR_FIRST.exec(start))) candidates = [[match[1], match[2], match[3]]];
  else if ((match = DAY_FIRST.exec(start))) candidates = [[match[3], monthNumber(match[2]), match[1]]];
  else if ((match = MONTH_FIRST.exec(start))) candidates = [[match[3], monthNumber(match[1]), match[2]]];
  else if ((match = NUMERIC.exec(start))) candidates = [[match[3], match[2], match[1]], [match[3], match[1], match[2]]];
  else return null;

  const dates = candidates
    .map(([year, month, day]) => ({ year: Number(year), month: Number(month), day: Number(day) }))
    .filter(isCalendarDate)
    .map(isoDate);
  // 05/05/1985 reads the same both ways round.
  return { readings: [...new Set(dates)], rest: start.slice(match[0].length) };
}

// "10:30 AM", "10:30:15 pm", "10 a.m."
const TIME_12 = /^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*([ap])\.?\s?m\.?(?![a-z])/i;
// "10:30", "22:30:15"
const TIME_24 = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?!\d)/;

// The time at the start of text, as "10:30:00", and the text after it, or null.
function matchTime(text) {
  const twelve = TIME_12.exec(text);
  const match = twelve ?? TIME_24.exec(text);
  if (!match) return null;
  let [hour, minute, second] = [match[1], match[2] ?? "0", match[3] ?? "0"].map(Number);
  if (twelve) {
    if (hour < 1 || hour > 12) return null;
    // 12 AM is midnight and 12 PM is noon.
    hour = (hour % 12) + (twelve[4].toLowerCase() === "p" ? 12 : 0);
  }
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { value: `${pad(hour)}:${pad(minute)}:${pad(second)}`, rest: text.slice(match[0].length) };
}

// "UTC", "GMT", "UT" or "Z" alone, with or without brackets.
const ZERO_OFFSET = /^\(?\s*(?:UTC|GMT|UT|Z)\s*\)?$/i;
// "-07:00", "-0700", "UTC-7", "GMT -7", "(+05:30)", and a local-mean-time
// offset to the second, "-05:42:58". The sign must start the text or follow
// UTC, GMT, UT or a bracket, so "approx. -5 min" has no offset.
const OFFSET = /(?:^|\b(?:UTC|GMT|UT)|\()\s*([+-])\s*(\d{1,2})(?::(\d{2})(?::(\d{2}))?|(\d{2}))?(?![\d:])/i;
// "America/Los_Angeles", "Etc/GMT+7". Etc/GMT zones count their sign the
// other way round, westward, so no offset is read from a zone name like these.
const ZONE_NAME = /[a-z]\/[a-z]/i;

// Minutes east of UTC for an offset in text, through civiltime's parseOffset,
// or null when there's none or it's out of range. Seconds make a fraction,
// as the desktop programs' readers give them.
function findOffset(text) {
  if (ZONE_NAME.test(text)) return null;
  if (ZERO_OFFSET.test(text.trim())) return 0;
  const match = OFFSET.exec(text);
  if (!match) return null;
  const [, sign, hours, colonMinutes, seconds, bareMinutes] = match;
  const minutes = parseOffset(`${sign}${hours.padStart(2, "0")}:${colonMinutes ?? bareMinutes ?? "00"}`);
  if (minutes === null || seconds === undefined) return minutes;
  if (Number(seconds) > 59) return null;
  // The same sum as the readers', hours * 60 + minutes + seconds / 60, so the
  // same offset compares equal. "0 - size" keeps -00:00:00 at 0.
  const size = Math.abs(minutes) + Number(seconds) / 60;
  const offset = sign === "-" ? 0 - size : size;
  return offset >= -720 && offset <= 840 ? offset : null;
}

// "47n36", "122w19'30": the direction between the degrees and the minutes, as
// astro.com and some astrology programs write it.
const COMPACT = /^(\d{1,3})([nsew])(\d{1,2})(?:'?(\d{1,2})"?)?(?!\d)/i;
// "47°36'N", "47° 36' 15\" N", "-122°19'"
const DMS = /^([+-])?(\d{1,3})\s*°\s*(?:(\d{1,2})\s*'\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*"\s*)?([nsew])?/i;
// "47.6062", "-122.3321", "47.6062 N", "47.6°N"
const DECIMAL = /^([+-])?(\d{1,3}(?:\.\d+)?)\s*°?\s*([nsew])?(?![\d.])/i;

function angleParts(text) {
  let match = COMPACT.exec(text);
  if (match) return { match, deg: match[1], letter: match[2], min: match[3], sec: match[4] };
  match = DMS.exec(text);
  if (match) return { match, sign: match[1], deg: match[2], min: match[3], sec: match[4], letter: match[5] };
  match = DECIMAL.exec(text);
  if (match) return { match, sign: match[1], deg: match[2], letter: match[3] };
  return null;
}

// The angle at the start of text in signed degrees, which axis its direction
// letter names (null when it has none), and the text after it; or null. A
// signed decimal is read as ISO 6709 does: north and east are positive.
function matchAngle(text) {
  const parts = angleParts(text);
  if (!parts) return null;
  const { match, sign, letter } = parts;
  // A sign and a direction letter together, as in -47°N, contradict or repeat each other.
  if (sign && letter) return null;
  const [deg, min, sec] = [parts.deg, parts.min ?? "0", parts.sec ?? "0"].map(Number);
  if (min >= 60 || sec >= 60) return null;

  const direction = letter?.toLowerCase();
  const axis = direction === undefined ? null : "ns".includes(direction) ? "lat" : "lng";
  // Rounded to 6 decimals, like the site readers.
  const size = Math.round((deg + min / 60 + sec / 3600) * 1e6) / 1e6;
  if (size > (axis === "lat" ? 90 : 180)) return null;
  // "0 - size" rather than "-size" keeps 0°0'W at 0 instead of -0.
  const negative = sign === "-" || direction === "s" || direction === "w";
  return { value: negative ? 0 - size : size, axis, rest: text.slice(match[0].length) };
}

// A Latitude or Longitude field: one angle and nothing else, with no letter
// for the other axis.
function angleField(text, axis) {
  const angle = matchAngle(text);
  if (!angle || angle.rest.trim() !== "" || (angle.axis ?? axis) !== axis) return UNREADABLE;
  if (axis === "lat" && Math.abs(angle.value) > 90) return UNREADABLE;
  return { value: angle.value };
}

// A Coordinates field: two angles in either order when they have direction
// letters, else latitude first, as in ISO 6709.
function readCoordinates(text) {
  const unreadable = [["lat", UNREADABLE], ["lng", UNREADABLE]];
  const first = matchAngle(text);
  const second = first && matchAngle(first.rest.replace(/^[\s,;/]+/, ""));
  if (!first || !second || second.rest.trim() !== "") return unreadable;

  const firstAxis = first.axis ?? (second.axis === "lat" ? "lng" : "lat");
  const secondAxis = second.axis ?? (firstAxis === "lat" ? "lng" : "lat");
  if (firstAxis === secondAxis) return unreadable;
  const [lat, lng] = firstAxis === "lat" ? [first, second] : [second, first];
  if (Math.abs(lat.value) > 90) return unreadable;
  return [["lat", { value: lat.value }], ["lng", { value: lng.value }]];
}

// The usual names of the house systems, by the id readText gives them. Any
// other name is unreadable, and the review form shows it as written.
const HOUSE_SYSTEMS = new Map([
  ["placidus", "placidus"],
  ["koch", "koch"],
  ["whole sign", "whole-sign"],
  ["whole signs", "whole-sign"],
  ["equal", "equal"],
  ["porphyry", "porphyry"],
  ["regiomontanus", "regiomontanus"],
  ["campanus", "campanus"],
  ["topocentric", "topocentric"],
  ["alcabitius", "alcabitius"],
  ["morinus", "morinus"],
  ["meridian", "meridian"],
]);

// "Placidus", "Whole-Sign Houses", "koch house system"
function houseSystem(text) {
  const name = text
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\b(?:house|houses|system)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return HOUSE_SYSTEMS.get(name) ?? null;
}

// "Tropical", "Sidereal (Lahiri)". The ayanamsa is read from its own field.
const ZODIAC = /^(tropical|sidereal)\b/i;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// A month's English name or its first three letters or more, as in "Sept"; 0 when unknown.
function monthNumber(word) {
  const lower = word.toLowerCase();
  return lower.length < 3 ? 0 : MONTHS.findIndex((name) => name.startsWith(lower)) + 1;
}

function isCalendarDate({ year, month, day }) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pad = (n, width = 2) => String(n).padStart(width, "0");

const isoDate = ({ year, month, day }) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
