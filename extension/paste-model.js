import { analyzeEntry, analyzeProgramText } from "./core/index.js";
import { toPortable } from "./core/portable.js";
import { MAX_TEXT_LENGTH, readField, readText } from "./core/text.js";
import { ASTRO_SEEK_BUTTONS, ASTRO_SEEK_NOTES, SHARE_BUTTON, viewFor } from "./popup-model.js";
import { PROGRAMS } from "./screenshot-model.js";

// Each refusal readText can return. They keep their code on screen, like the
// screenshot page's, so a bug report says which check failed.
const REFUSALS = {
  "too-long": `This text is too long. Paste only the part with the birth data, up to ${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters.`,
  "no-birth-data":
    'AstroChart Bridge found no birth data in this text. It reads labelled lines such as "Date of Birth: 15 June 1985" or "latitude=47.6062".',
  "several-records":
    "This text has more than one birth date or name, so it may hold more than one chart. Paste one chart at a time.",
};

// The form's fields, in order: the name readText and readField give each one,
// its label, and what to type.
export const ENTRY_FIELDS = [
  { name: "date", label: "Date", example: "1985-06-15 or 15 June 1985" },
  { name: "time", label: "Local time", example: "10:30 or 10:30 AM" },
  { name: "lat", label: "Latitude", example: "47.6062 or 47°36'N" },
  { name: "lng", label: "Longitude", example: "-122.3321 or 122°19'W" },
  { name: "offset", label: "UTC offset", example: "-07:00, daylight saving included" },
];

// The other fields readText finds. They are shown as written and sent nowhere.
const INFO_FIELDS = [
  ["name", "Name"],
  ["place", "Place"],
  ["zone", "Time zone"],
  ["houses", "Houses"],
  ["zodiac", "Zodiac"],
  ["ayanamsa", "Ayanamsa"],
];

const FORM_NOTE = "Check each value against the text. Nothing is sent until you open the sky or the chart.";
const PLACE_NOTE = "AstroChart Bridge doesn't look places up: it uses the latitude and longitude, not the place name.";

// First on the screen that opens the sky. The offset is the one value the form
// can't check: that needs the zone's history at the birthplace.
const OFFSET_NOTE = "Nothing checks that this offset was in use at the birthplace on that date.";

// Why a desktop program's reader turned down text laid out as its program's,
// after "but". A layout that turned out not to be the program's,
// "unreadable-screenshot", is most likely ordinary labelled text, so it gets
// no warning. A code not listed here still gets one, worded generally.
const PROGRAM_REFUSALS = {
  "no-coordinates": "it has no coordinates",
  "ambiguous-screenshot": "it can be read as more than one program's, or more than one chart",
  "sidereal-mismatch": "its sidereal time doesn't fit its time, offset and longitude",
  "offset-out-of-range": "its local time is too far from its Universal Time",
  "weekday-mismatch": "its weekday doesn't fall on its date",
  "zone-offset-mismatch": "its time zone doesn't match its UTC offset",
  "calendar-unsupported":
    "it's dated before the Gregorian calendar began on 15 October 1582, or Old Style or BC, and AstroChart Bridge reads Gregorian dates only",
  "apparent-time": "it uses local apparent time, which AstroChart Bridge can't open yet",
  "local-time-ambiguous": "its time is marked LC, which can mean local mean or local apparent time",
  "chart-type-unsupported": "it's a return, progression or other chart that isn't the birth",
  "offset-off-quarter-hour": "its sidereal time gives a UTC offset that isn't on a quarter hour",
  "true-local-time-mismatch": "its true local time doesn't fit its sidereal time and longitude",
};
const PROGRAM_REFUSED = "it doesn't pass that program's checks";

// The programs that write an offset west of Greenwich with a plus sign, as
// their readers read it.
const WEST_PLUS = new Set(["solar-fire", "astro-gold", "solar-fire-or-astro-gold", "janus", "winstar"]);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The review form for pasted text, as readText and the desktop programs'
 * readers read it.
 *
 * @param {string} text
 */
export function formForText(text) {
  const result = readText(text);
  // Text too long to read is too long for the programs' readers too.
  const tooLong = result.kind === "refused" && result.reason === "too-long";
  return formFor(result, tooLong ? null : analyzeProgramText(text));
}

/**
 * The review form for a readText result: each of the five values filled in
 * from the text, with the line it came from or why it couldn't be read, and
 * the other fields readText found.
 *
 * When the text is laid out as a desktop program's, program is what that
 * program's reader made of it, and its values fill the boxes too. A box fills
 * only when every reading of its value agrees: where readText read the value
 * differently, both are offered to pick from. A program reader that turned the
 * text down adds a warning, and the form has readText's values alone.
 *
 * @param {ReturnType<typeof import("./core/text.js").readText>} result
 * @param {ReturnType<typeof import("./core/index.js").analyzeProgramText>} [program]
 */
export function formFor(result, program = null) {
  const read = program?.kind === "natal" ? program : null;
  const turnedDown = program?.kind === "refused" && program.reason !== "unreadable-screenshot" ? program.reason : null;
  // A program's text has none of readText's labels, so readText finds nothing in it.
  const noLabels = result.kind === "refused" && result.reason === "no-birth-data" && (read || turnedDown);
  if (result.kind === "refused" && !noLabels) return { state: "refused", message: REFUSALS[result.reason], code: result.reason };
  const fields = noLabels ? {} : result.fields;
  const values = read ? programValues(read) : {};
  const name = read ? PROGRAMS[read.site] : null;

  const warnings = settingWarnings(fields);
  if (turnedDown) {
    warnings.unshift(
      `This text is laid out like a desktop astrology program's, but ${Object.hasOwn(PROGRAM_REFUSALS, turnedDown) ? PROGRAM_REFUSALS[turnedDown] : PROGRAM_REFUSED}, so AstroChart Bridge didn't use that program's reading (${turnedDown}). Check each value against the text.`,
    );
  }
  if (read?.warnings?.includes("offset-unchecked")) {
    warnings.push(`Nothing in this ${name} text checks its UTC offset. Compare the offset with the text.`);
  }
  const notes = [FORM_NOTE];
  if (read) notes.push(`Read as ${name}'s text: its birth data is laid out the way ${name} prints it.`);
  if (read && WEST_PLUS.has(read.site)) {
    notes.push(`${name} writes offsets west of Greenwich with a plus sign, so its +7:00 is UTC-07:00 here.`);
  }
  if (fields.place) notes.push(PLACE_NOTE);

  return {
    state: "form",
    fields: ENTRY_FIELDS.map((field) => ({
      name: field.name,
      label: field.label,
      placeholder: field.example,
      ...merged(field.name, fields, values[field.name] ?? null, read),
    })),
    rows: INFO_FIELDS.filter(([field]) => fields[field]).map(([field, label]) => [label, asWritten(fields[field])]),
    warnings,
    notes,
    statedOffsets: [...statedOffsets(fields.offset), ...(values.offset == null ? [] : [values.offset])],
  };
}

// A program reader's result as the form's five values: what readField gives
// for each. A program that prints no offset gives none.
function programValues({ local, lat, lng, utcSource, offsetMinutes }) {
  return { date: local.slice(0, 10), time: local.slice(11, 19), lat, lng, offset: utcSource === "needs-offset" ? null : offsetMinutes };
}

// prefill, with a program reader's value for the field, or null.
function merged(name, fields, value, program) {
  const read = fields[name];
  if (!program) return prefill(name, fields);
  const programName = PROGRAMS[program.site];
  if (value === null) {
    // Only the offset can be missing, from a program that doesn't print it.
    if (read) return prefill(name, fields);
    return {
      text: "",
      source: `${programName} doesn't print the UTC offset. Enter the offset at the birthplace on that date, including daylight saving.`,
    };
  }
  const fromProgram = { value, label: `${boxText(name, value)} (as ${programName}'s text)` };
  if (!read) return { text: boxText(name, value), source: `Read as ${programName}'s text.` };
  // readText found the line but couldn't read it, as with Jagannatha Hora's
  // "8:00:00 (West of GMT)": the program's reader could.
  if (read.problem === "unreadable") {
    return { text: boxText(name, value), source: `Line ${read.line}: ${read.text}, read as ${programName}'s text.` };
  }
  if (!read.problem) {
    if (meaning(name, read.value) === meaning(name, value)) return prefill(name, fields);
    return {
      text: "",
      source: `Line ${read.line} reads differently from ${programName}'s layout. Pick the one the text means.`,
      choices: distinct(name, [{ value: read.value, label: `${boxText(name, read.value)} (line ${read.line})` }, fromProgram]),
    };
  }
  // An ambiguous date or lines that disagree: the program's reading joins
  // theirs, and the box stays empty.
  const own = prefill(name, fields);
  const choices = distinct(name, [
    ...own.choices.map((choice) => ({ value: readField(name, choice.text).value, label: choice.label })),
    fromProgram,
  ]);
  return { ...own, choices };
}

// Choices with the same meaning shown once, the first label kept.
function distinct(name, readings) {
  const seen = new Set();
  return readings
    .filter(({ value }) => {
      const key = meaning(name, value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ value, label }) => ({ label, text: boxText(name, value) }));
}

// The offsets the text itself gives, in minutes, so a shared chart can say
// whether its offset came from the text or was typed on the form.
function statedOffsets(read) {
  if (!read) return [];
  const values = read.problem === "conflict" ? read.sightings.map((s) => s.value) : [read.value];
  return values.filter((value) => value !== null);
}

// What a field's box starts with (text), where that came from (source), and
// readings to pick from (choices) when the text gives more than one.
function prefill(name, fields) {
  const read = fields[name];
  if (!read) {
    const zone = name === "offset" ? fields.zone : undefined;
    return {
      text: "",
      source: zone?.value
        ? `The text names the zone "${zone.value}" but gives no offset. Enter the offset at the birthplace on that date.`
        : "Not in the pasted text.",
    };
  }
  if (read.problem === "conflict") {
    return {
      text: "",
      source: `The text gives different values on lines ${read.sightings.map((s) => s.line).join(" and ")}.`,
      choices: read.sightings
        .filter((s) => s.value !== null)
        .map((s) => ({ label: `${boxText(name, s.value)} (line ${s.line})`, text: boxText(name, s.value) })),
    };
  }
  const source = `Line ${read.line}: ${read.text}`;
  if (read.problem === "ambiguous") {
    return {
      text: "",
      source: `${source}. This could be either date.`,
      choices: read.readings.map((date) => ({ label: dateText(date), text: date })),
    };
  }
  // An unreadable value is left in its box, so it can be corrected there.
  if (read.problem === "unreadable") return { text: read.text, source };
  return { text: boxText(name, read.value), source };
}

/**
 * What the text in one of the form's boxes means, for the line under it: the
 * value when it reads, else why not. Empty boxes say nothing.
 *
 * @param {string} name  one of ENTRY_FIELDS' names
 * @param {string} text
 * @returns {{ value: string | number | null, message: string }}
 */
export function checkField(name, text) {
  if (text.trim() === "") return { value: null, message: "" };
  const read = readField(name, text);
  if (read.problem === "ambiguous") {
    return {
      value: null,
      message: `This could be ${read.readings.map(dateText).join(" or ")}. Write the month's name, or the year first.`,
    };
  }
  if (read.value === null) {
    const { example } = ENTRY_FIELDS.find((field) => field.name === name);
    return { value: null, message: `AstroChart Bridge can't read this. Try ${example}.` };
  }
  return { value: read.value, message: meaning(name, read.value) };
}

/**
 * The entry analyzeEntry takes, once every box has a value, else null. The
 * form's button stays disabled until there is one.
 *
 * @param {Record<string, string | number | null>} values  checkField's value for each box, by name
 */
export function entryFor({ date, time, lat, lng, offset }) {
  if ([date, time, lat, lng, offset].some((value) => value === null || value === undefined)) return null;
  return { date, time, lat, lng, offsetMinutes: offset };
}

/**
 * The screen that opens the sky or the chart for a confirmed entry: the
 * popup's ready screen, with the form's warnings, a note that nothing checks
 * the offset, a second button that opens the chart in Astro-Seek, and Share….
 *
 * @param {ReturnType<typeof entryFor>} entry
 * @param {{ warnings?: string[], timeZone?: string }} [options]  timeZone is passed on to viewFor
 */
export function viewForEntry(entry, { warnings = [], timeZone } = {}) {
  const view = viewFor(analyzeEntry(entry), { timeZone });
  return {
    ...view,
    warnings: [...view.warnings, ...warnings],
    notes: [OFFSET_NOTE, ...view.notes, ...ASTRO_SEEK_NOTES],
    buttons: [...ASTRO_SEEK_BUTTONS, SHARE_BUTTON].map((button) => ({ ...button })),
  };
}

/**
 * The portable chart Share… sends for a confirmed entry. Pasted text has no
 * site, so its source names only how it came, "paste", and whether the offset
 * is one the text stated ("declared") or one typed on the form ("entered").
 * No name, place or zone goes with it.
 *
 * @param {ReturnType<typeof entryFor>} entry
 * @param {number[]} statedOffsets  formFor's, the offsets the text gives
 * @returns {ReturnType<typeof toPortable>}
 */
export function chartForEntry(entry, statedOffsets) {
  const { local, utc, lat, lng } = analyzeEntry(entry);
  // To the second: an offset with seconds is a fraction of a minute.
  const stated = statedOffsets.some((offset) => Math.round(offset * 60) === Math.round(entry.offsetMinutes * 60));
  const utcBasis = stated ? "declared" : "entered";
  return toPortable({ local, utc, lat, lng }, { via: "paste", utcBasis });
}

// Astro-Seek's chart opens with the house system astroSeekUrl names, Placidus,
// and no ayanamsa. Stellarium Web shows the sky, which has neither.
function settingWarnings({ houses, zodiac }) {
  const warnings = [];
  if (houses?.value && houses.value !== "placidus") {
    warnings.push(`The text uses ${houses.text} houses, but Astro-Seek's chart will open with Placidus houses.`);
  }
  if (zodiac?.value === "sidereal") {
    warnings.push("The text uses the sidereal zodiac. AstroChart Bridge doesn't pass it on, so set it in Astro-Seek's chart.");
  }
  return warnings;
}

// A field as the text wrote it, or each way it did when its lines disagree.
const asWritten = (read) => read.text ?? read.sightings.map((s) => s.text).join(" or ");

// A value as it goes back into its box: in a form readField reads as the same value.
function boxText(name, value) {
  if (name === "time") return value.endsWith(":00") ? value.slice(0, 5) : value;
  if (name === "offset") return offsetText(value).slice(3);
  return String(value);
}

// The line under a box, so a misread is easy to see: a sign that put the place
// in the wrong hemisphere, or a 12-hour time read the wrong side of noon.
function meaning(name, value) {
  if (name === "date") return dateText(value);
  if (name === "time") return `${value.slice(0, 5)}${value.endsWith(":00") ? "" : value.slice(5)} at the birthplace`;
  if (name === "lat") return angleText(value, "N", "S");
  if (name === "lng") return angleText(value, "E", "W");
  return offsetText(value);
}

// "1985-06-15" → "15 June 1985"
function dateText(date) {
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

// -420 → "UTC-07:00". A local-mean-time offset runs to the second and shows
// them, as the popup's Offset row does: "UTC-05:42:58".
function offsetText(minutes) {
  const size = Math.round(Math.abs(minutes) * 60);
  const pad = (n) => String(n).padStart(2, "0");
  const text = `UTC${minutes < 0 ? "-" : "+"}${pad(Math.floor(size / 3600))}:${pad(Math.floor(size / 60) % 60)}`;
  return size % 60 === 0 ? text : `${text}:${pad(size % 60)}`;
}

// -122.3321 → 122°19'56"W. To the second, finer than the popup's place row,
// since this is where a typed value is checked.
function angleText(value, positive, negative) {
  const seconds = Math.round(Math.abs(value) * 3600);
  const deg = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  return `${deg}°${min}'${seconds % 60}"${value < 0 ? negative : positive}`;
}
