import { analyzeEntry } from "./core/index.js";
import { MAX_TEXT_LENGTH, readField } from "./core/text.js";
import { ASTRO_SEEK_BUTTONS, ASTRO_SEEK_NOTES, viewFor } from "./popup-model.js";

// Each refusal readText can return. They keep their code on screen, like the
// screenshot page's, so a bug report says which check failed.
const REFUSALS = {
  "too-long": `This text is too long. Paste only the part with the birth data, up to ${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters.`,
  "no-birth-data":
    'Chart Bridge found no birth data in this text. It reads labelled lines such as "Date of Birth: 15 June 1985" or "latitude=47.6062".',
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
const PLACE_NOTE = "Chart Bridge doesn't look places up: it uses the latitude and longitude, not the place name.";

// First on the screen that opens the sky. The offset is the one value the form
// can't check: that needs the zone's history at the birthplace.
const OFFSET_NOTE = "Nothing checks that this offset was in use at the birthplace on that date.";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The review form for a readText result: each of the five values filled in
 * from the text, with the line it came from or why it couldn't be read, and
 * the other fields readText found.
 *
 * @param {ReturnType<typeof import("./core/text.js").readText>} result
 */
export function formFor(result) {
  if (result.kind === "refused") return { state: "refused", message: REFUSALS[result.reason], code: result.reason };
  const { fields } = result;
  return {
    state: "form",
    fields: ENTRY_FIELDS.map(({ name, label, example }) => ({
      name,
      label,
      placeholder: example,
      ...prefill(name, fields),
    })),
    rows: INFO_FIELDS.filter(([name]) => fields[name]).map(([name, label]) => [label, asWritten(fields[name])]),
    warnings: settingWarnings(fields),
    notes: fields.place ? [FORM_NOTE, PLACE_NOTE] : [FORM_NOTE],
  };
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
    return { value: null, message: `Chart Bridge can't read this. Try ${example}.` };
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
 * the offset, and a second button that opens the chart in Astro-Seek.
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
    buttons: [...ASTRO_SEEK_BUTTONS],
  };
}

// Astro-Seek's chart opens with the house system astroSeekUrl names, Placidus,
// and no ayanamsa. Stellarium Web shows the sky, which has neither.
function settingWarnings({ houses, zodiac }) {
  const warnings = [];
  if (houses?.value && houses.value !== "placidus") {
    warnings.push(`The text uses ${houses.text} houses, but Astro-Seek's chart will open with Placidus houses.`);
  }
  if (zodiac?.value === "sidereal") {
    warnings.push("The text uses the sidereal zodiac. Chart Bridge doesn't pass it on, so set it in Astro-Seek's chart.");
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

// -420 → "UTC-07:00"
function offsetText(minutes) {
  const size = Math.abs(minutes);
  const pad = (n) => String(n).padStart(2, "0");
  return `UTC${minutes < 0 ? "-" : "+"}${pad(Math.floor(size / 60))}:${pad(size % 60)}`;
}

// -122.3321 → 122°19'56"W. To the second, finer than the popup's place row,
// since this is where a typed value is checked.
function angleText(value, positive, negative) {
  const seconds = Math.round(Math.abs(value) * 3600);
  const deg = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  return `${deg}°${min}'${seconds % 60}"${value < 0 ? negative : positive}`;
}
