import { analyzeEntry, analyzeProgramText } from "./core/index.js";
import { toPortable } from "./core/portable.js";
import { MAX_TEXT_LENGTH, readField, readText } from "./core/text.js";
import {
  astroComStepFor,
  astroSeekButtons,
  astroSeekNotes,
  astroSeekWarnings,
  chartButtons,
  genderRows,
  labelsToShare,
  nameFromText,
  viewFor,
  viewForAstroCom,
  viewForAstroComByHand,
  withAstroSeekSave,
} from "./popup-model.js";
// Imported as messages, since the pasted text is text here.
import { text as messages } from "./messages/index.js";
import { programNames } from "./screenshot-model.js";

// The page's words are the catalog's (messages/), read as each form or screen is
// built. Each refusal readText can return keeps its code on screen, like the
// screenshot page's, so a bug report says which check failed.

// The form's fields, in order, by the name readText and readField give each.
const ENTRY_FIELDS = ["date", "time", "lat", "lng", "offset"];

// The other fields readText finds. They are shown as written, and only the
// name, place, country and gender go anywhere: into astro.com's form and
// Astro-Seek's, by the step after the form, the place as the town for their
// lists to look up and the country to help choose among them.
const INFO_FIELDS = ["name", "place", "country", "gender", "zone", "houses", "zodiac", "ayanamsa"];

// A place written as coordinates, such as Jagannatha Hora's "Place: 122 W 20'
// 30", 47 N 36' 32"", "40N43" or "47°36'N": a number, perhaps a degree or
// minute mark, then a compass letter that doesn't start a word, as N in
// "5 North St" would. It names no town for astro.com's or Astro-Seek's town search.
const COORDINATES = /\d\s*[°'′"]?\s*[NSEW](?![a-z])/i;

// The notes, in the catalog: noOffsetNote on a form whose text gives no
// offset, as astro.com's form takes the local time and looks the zone up for
// the town, and everything else needs the UTC; localOnlyNote atop the
// astro.com screen for a form left without one; offsetNote first on the screen
// that opens the sky, as the offset is the one value the form can't check:
// that needs the zone's history at the birthplace.

// Why a desktop program's reader turned down text laid out as its program's
// is the catalog's programRefusals. A layout that turned out not to be the
// program's, "unreadable-screenshot", is most likely ordinary labelled text,
// so it gets no warning. A code not listed there still gets one, worded generally.

// The name each reader on the paste page gives as its site: the desktop
// programs', and Astro-Seek's for text copied from its chart page.
const sources = () => ({ ...programNames(), "astro-seek": "Astro-Seek" });

// The programs that write an offset west of Greenwich with a plus sign, as
// their readers read it.
const WEST_PLUS = new Set(["solar-fire", "astro-gold", "solar-fire-or-astro-gold", "janus", "winstar"]);

/**
 * The review form for pasted text, as readText, the desktop programs' readers
 * and Astro-Seek's read it.
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
  const words = messages().paste;
  if (result.kind === "refused" && !noLabels) {
    const message = result.reason === "too-long" ? words.tooLong(MAX_TEXT_LENGTH) : words.refusals[result.reason];
    return { state: "refused", message, code: result.reason };
  }
  const fields = noLabels ? {} : result.fields;
  const values = read ? programValues(read) : {};
  const name = read ? sources()[read.site] : null;

  const warnings = settingWarnings(fields);
  if (turnedDown) {
    const why = Object.hasOwn(words.programRefusals, turnedDown) ? words.programRefusals[turnedDown] : words.programRefused;
    warnings.unshift(words.turnedDown(why, turnedDown));
  }
  if (read?.warnings?.includes("offset-unchecked")) warnings.push(words.offsetUnchecked(name));
  const notes = [words.formNote];
  if (read) notes.push(words.readAs(name));
  if (read && WEST_PLUS.has(read.site)) notes.push(words.westPlus(name));
  // The program's reader finds a name and town by where its program prints
  // them, so they go before readText's labels; a labelled place that is only
  // coordinates names no town.
  const labelledPlace = fields.place?.value ?? null;
  const place = labelledPlace !== null && !COORDINATES.test(labelledPlace) ? labelledPlace : null;
  // A Country line goes after the town, where it helps choose among the
  // forms' matches; only the town is typed. A country alone names no town. A
  // program's or Astro-Seek's reader gives its town with its country already.
  const country = fields.country?.value ?? null;
  const town = read?.town ?? (place === null ? null : [place, country].filter(Boolean).join(", "));
  const chartName = read?.name ?? nameFromText(fields.name?.value);
  if (town !== null) notes.push(words.placeNote);
  const boxes = ENTRY_FIELDS.map((field) => ({
    name: field,
    label: words.fields[field].label,
    placeholder: words.fields[field].example,
    ...merged(field, fields, values[field] ?? null, read),
  }));
  // An offset box left empty with nothing to pick from.
  const offset = boxes.find((box) => box.name === "offset");
  if (offset.text === "" && !offset.choices) notes.push(words.noOffsetNote);

  const rowLabels = messages().popup.rows;
  return {
    state: "form",
    fields: boxes,
    rows: [
      ...INFO_FIELDS.filter((field) => fields[field]).map((field) => [words.info[field], asWritten(fields[field])]),
      ...(read?.name && !fields.name ? [[rowLabels.name, read.name.first]] : []),
      ...(read?.town ? [[rowLabels.town, read.town]] : []),
      ...(read?.gender && !fields.gender ? genderRows(read.gender) : []),
    ],
    warnings,
    notes,
    statedOffsets: [...statedOffsets(fields.offset), ...(values.offset == null ? [] : [values.offset])],
    name: chartName,
    // Null when the text gives two places.
    town,
    // "female", "male" or "event", or null when the text gives none it can
    // read: a program's, from where it prints the chart's type, before a
    // Gender line's, as for the name and town.
    gender: read?.gender ?? fields.gender?.value ?? null,
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
  const words = messages().paste;
  const programName = sources()[program.site];
  if (value === null) {
    // Only the offset can be missing, from a program that doesn't print it.
    if (read) return prefill(name, fields);
    return { text: "", source: words.programNoOffset(programName) };
  }
  const fromProgram = { value, label: words.asProgram(boxText(name, value), programName) };
  if (!read) return { text: boxText(name, value), source: words.readAsSource(programName) };
  // readText found the line but couldn't read it, as with Jagannatha Hora's
  // "8:00:00 (West of GMT)": the program's reader could.
  if (read.problem === "unreadable") {
    return { text: boxText(name, value), source: words.lineReadAs(read.line, read.text, programName) };
  }
  if (!read.problem) {
    if (meaning(name, read.value) === meaning(name, value)) return prefill(name, fields);
    return {
      text: "",
      source: words.readsDifferently(read.line, programName),
      choices: distinct(name, [{ value: read.value, label: words.onLine(boxText(name, read.value), read.line) }, fromProgram]),
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
  const words = messages().paste;
  const read = fields[name];
  if (!read) {
    const zone = name === "offset" ? fields.zone : undefined;
    return { text: "", source: zone?.value ? words.zoneNoOffset(zone.value) : words.notInText };
  }
  if (read.problem === "conflict") {
    return {
      text: "",
      source: words.differentLines(read.sightings.map((s) => s.line)),
      choices: read.sightings
        .filter((s) => s.value !== null)
        .map((s) => ({ label: words.onLine(boxText(name, s.value), s.line), text: boxText(name, s.value) })),
    };
  }
  const source = words.line(read.line, read.text);
  if (read.problem === "ambiguous") {
    return {
      text: "",
      source: words.eitherDate(source),
      choices: read.readings.map((date) => ({ label: dateText(date), text: date })),
    };
  }
  // An unreadable value is left in its box, so it can be corrected there.
  if (read.problem === "unreadable") return { text: read.text, source };
  return { text: boxText(name, read.value), source };
}

// The Gregorian calendar's first day. Pasted text never says which calendar an
// earlier date is in, and records from before then are usually Julian, so the
// form refuses one, as every other reader does, rather than read it as
// Gregorian. The fixed-width form sorts like the dates it writes.
const GREGORIAN_START = "1582-10-15";

/**
 * What the text in one of the form's boxes means, for the line under it: the
 * value when it reads, else why not. A date before 15 October 1582 reads but
 * has no value, so Continue stays off. Empty boxes say nothing.
 *
 * @param {string} name  one of ENTRY_FIELDS
 * @param {string} text
 * @returns {{ value: string | number | null, message: string }}
 */
export function checkField(name, text) {
  if (text.trim() === "") return { value: null, message: "" };
  const words = messages().paste;
  const read = readField(name, text);
  if (read.problem === "ambiguous") return { value: null, message: words.couldBe(read.readings.map(dateText)) };
  if (read.value === null) return { value: null, message: words.cantRead(words.fields[name].example) };
  if (name === "date" && read.value < GREGORIAN_START) return { value: null, message: words.preGregorian };
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
 * The chart astro.com alone can take, once the date, time and place boxes
 * have values and the offset box is empty, else null: astro.com's form takes
 * the local time and looks the zone up for the town, so it needs no offset.
 * An offset box with text that doesn't read keeps the button disabled, as it
 * does with entryFor.
 *
 * @param {Record<string, string | number | null>} values  as for entryFor
 * @param {string} offsetText  the offset box's text
 * @returns {{ local: string, lat: number, lng: number } | null}  local is YYYY-MM-DDTHH:MM:SS
 */
export function localEntryFor({ date, time, lat, lng }, offsetText) {
  if (offsetText.trim() !== "") return null;
  if ([date, time, lat, lng].some((value) => value === null || value === undefined)) return null;
  return { local: `${date}T${time}`, lat, lng };
}

/**
 * The astro.com screen for a localEntryFor chart: its local time and place,
 * with no UTC, so astro.com's automatic time zone decides the moment.
 * On the web, it is the values to type in instead (viewForAstroComByHand).
 *
 * @param {NonNullable<ReturnType<typeof localEntryFor>>} chart
 * @param {{ name?: { first: string, last: string } | null, town?: string | null, gender?: string | null,
 *   onTheWeb?: boolean }} [options]  name, town and gender are formFor's; onTheWeb is for the web's copy of the page
 */
export function viewForLocalEntry({ local, lat, lng }, { name = null, town = null, gender = null, onTheWeb = false } = {}) {
  const view = (onTheWeb ? viewForAstroComByHand : viewForAstroCom)({ utc: null, lat, lng }, { local, name, town, gender });
  return { ...view, notes: [messages().paste.localOnlyNote, ...view.notes] };
}

/**
 * The screen that opens the sky or the chart for a confirmed entry: the
 * popup's ready screen, with the form's warnings, a note that nothing checks
 * the offset, a second button that opens the chart in Astro-Seek, Share…, and
 * the step to enter it in astro.com with the text's name and place.
 *
 * @param {ReturnType<typeof entryFor>} entry
 * @param {{ warnings?: string[], timeZone?: string, name?: { first: string, last: string } | null, town?: string | null,
 *   gender?: string | null, onTheWeb?: boolean }} [options]  timeZone and onTheWeb are passed on to viewFor; name,
 *   town and gender are formFor's
 */
export function viewForEntry(entry, { warnings = [], timeZone, name = null, town = null, gender = null, onTheWeb = false } = {}) {
  const result = analyzeEntry(entry);
  const view = viewFor(result, { timeZone, onTheWeb });
  return withAstroSeekSave(
    {
      ...view,
      ...(view.rows ? { rows: [...genderRows(gender), ...view.rows] } : {}),
      warnings: [...view.warnings, ...warnings, ...astroSeekWarnings(result.lng)],
      notes: [messages().paste.offsetNote, ...view.notes, ...astroSeekNotes()],
      buttons: chartButtons(astroSeekButtons()),
      next: astroComStepFor({ onTheWeb })(view.sky, { local: result.local, name, town, gender }),
    },
    { town, name, gender },
    { onTheWeb },
  );
}

/**
 * The portable chart Share… sends for a confirmed entry. Pasted text has no
 * site, so its source names only how it came, "paste", and whether the offset
 * is one the text stated ("declared") or one typed on the form ("entered").
 * No zone goes with it. The chart's name and town go as labels, which the
 * share page offers to include.
 *
 * @param {ReturnType<typeof entryFor>} entry
 * @param {number[]} statedOffsets  formFor's, the offsets the text gives
 * @param {{ town?: string | null, name?: { first: string, last: string } | null }} [chart]  formFor's town and name
 * @returns {ReturnType<typeof toPortable>}
 */
export function chartForEntry(entry, statedOffsets, chart = {}) {
  const { local, utc, lat, lng } = analyzeEntry(entry);
  // To the second: an offset with seconds is a fraction of a minute.
  const stated = statedOffsets.some((offset) => Math.round(offset * 60) === Math.round(entry.offsetMinutes * 60));
  const utcBasis = stated ? "declared" : "entered";
  return toPortable({ local, utc, lat, lng }, { via: "paste", utcBasis }, labelsToShare(chart));
}

// Astro-Seek's chart opens with the house system astroSeekUrl names, Placidus,
// and no ayanamsa. Stellarium Web shows the sky, which has neither.
function settingWarnings({ houses, zodiac }) {
  const words = messages().paste;
  const warnings = [];
  if (houses?.value && houses.value !== "placidus") warnings.push(words.houses(houses.text));
  if (zodiac?.value === "sidereal") warnings.push(words.sidereal);
  return warnings;
}

// A field as the text wrote it, or each way it did when its lines disagree.
const asWritten = (read) => read.text ?? messages().paste.or(read.sightings.map((s) => s.text));

// A value as it goes back into its box: in a form readField reads as the same value.
function boxText(name, value) {
  if (name === "time") return value.endsWith(":00") ? value.slice(0, 5) : value;
  if (name === "offset") return offsetText(value).slice(3);
  return String(value);
}

// The line under a box, so a misread is easy to see: a sign that put the place
// in the wrong hemisphere, or a 12-hour time read the wrong side of noon. The
// compass letters are the ones readField reads, whatever the language, so the
// line shows the box's own way of writing west: W, where Spanish writes O.
function meaning(name, value) {
  if (name === "date") return dateText(value);
  if (name === "time") return messages().paste.atBirthplace(`${value.slice(0, 5)}${value.endsWith(":00") ? "" : value.slice(5)}`);
  if (name === "lat") return angleText(value, "N", "S");
  if (name === "lng") return angleText(value, "E", "W");
  return offsetText(value);
}

// "1985-06-15" → "15 June 1985"
function dateText(date) {
  const [year, month, day] = date.split("-").map(Number);
  return messages().popup.longDate(day, month, year);
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
