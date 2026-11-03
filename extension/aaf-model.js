// What the import page and the Save as AAF button show. AAF is read and
// written in core/aaf.js; this file turns its results into views that
// view.js draws, reusing the popup's own screens for a chart.
import { chartFromRecord, exportRecord, parseAaf, writeAaf } from "./core/aaf.js";
import { ASTRO_SEEK_BUTTONS, ASTRO_SEEK_NOTES, astroComStep, genderRows, viewFor, withAstroSeekSave } from "./popup-model.js";

// Why chartFromRecord refused a record. Each keeps its code on screen, like
// the screenshot page's refusals, so a bug report says which check failed.
const REFUSALS = {
  "no-birth-date": "This chart has no birth date: the file gives *.",
  "no-birth-time": "This chart has no birth time: the file gives *. AstroChart Bridge doesn't guess one.",
  "julian-calendar": "This date is in the Julian calendar, which AstroChart Bridge can't open yet.",
  "pre-gregorian-date": "AstroChart Bridge opens dates from 15 October 1582 on, when the Gregorian calendar began.",
  "no-coordinates": "This chart has no coordinates, so there is no sky to open.",
  "local-mean-time": "This chart uses local mean time, which AstroChart Bridge can't open yet.",
  "meridian-time": "This chart uses a special meridian, such as a capital's local time, which AstroChart Bridge can't open yet.",
  "unknown-daylight-saving":
    "This chart doesn't say whether daylight saving was in effect: its time type is *. AstroChart Bridge doesn't guess.",
  "no-offset": "This chart gives no UTC offset, so its Universal Time can't be worked out. AstroChart Bridge doesn't guess one.",
  "offset-seconds": "This chart's offset has seconds in it, which AstroChart Bridge can't open yet.",
  "offset-out-of-range": "This chart's offset, daylight saving included, is outside -12:00 to +14:00.",
  "julian-day-mismatch":
    "The file's Julian Day doesn't match its date, time and offset, so AstroChart Bridge can't tell which is right.",
};

// What parseAaf couldn't read, named for the message "couldn't read <this>".
const UNREADABLE = {
  "a93-fields": "the #A93 line, which needs seven fields,",
  "b93-fields": "the #B93 line, which needs five fields,",
  "bad-date": "the date",
  "bad-time": "the time",
  "bad-julian-day": "the Julian Day",
  "bad-latitude": "the latitude",
  "bad-longitude": "the longitude",
  "bad-offset": "the offset",
  "bad-time-type": "the time type",
  "duplicate-b93": "a second #B93 line",
  "duplicate-znam": "a second #ZNAM line",
  "bad-chunk": "the line",
};

const WARNINGS = {
  "time-hour-only": ({ local }) =>
    `The AAF file gives this birth time to the hour only, so the chart is drawn for ${local.slice(11, 16)}.`,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The import page's list for an AAF text: one item per record, labelled by
 * what the file says, with the view to show when it is chosen.
 *
 * @param {string} text
 * @param {{ timeZone?: string }} [options]  passed on to viewFor
 * @returns {{ state: "aaf-list", items: { label: string, view: object }[], message: string }}
 */
export function viewForAafText(text, options) {
  const items = parseAaf(text).map((record) => ({
    label: record.kind === "refused" ? `Line ${record.line}: unreadable record` : recordLabel(record),
    view: viewForAafChart(chartFromRecord(record), options),
  }));
  const message =
    items.length === 0
      ? "AstroChart Bridge found no AAF records. Each record starts with a line beginning #A93:."
      : items.length === 1
        ? "1 chart in this file."
        : `${items.length} charts in this file. Choose one.`;
  return { state: "aaf-list", items, message };
}

/**
 * What to show for one record: the popup's ready screen for an astro.com
 * chart, with the name and birthplace the file gives, or why it can't open.
 * Its step to enter the chart in astro.com takes the name as the file splits
 * it, first and last, and the place without its country as the town, since
 * astro.com's form asks for the country apart.
 *
 * @param {ReturnType<typeof chartFromRecord>} result
 * @param {{ timeZone?: string }} [options]  passed on to viewFor
 */
export function viewForAafChart(result, options) {
  if (result.kind === "refused") {
    if (Object.hasOwn(REFUSALS, result.reason)) return { state: "refused", message: REFUSALS[result.reason], code: result.reason };
    const what = UNREADABLE[result.reason] ?? "this record";
    return { state: "refused", message: `Line ${result.line}: AstroChart Bridge couldn't read ${what} "${result.value}".`, code: result.reason };
  }

  const { warnings = [], ...chart } = result;
  const view = viewFor(chart, options);
  const rows = view.rows.flatMap((row) => (row[0] === "Place" && chart.place ? [["Birthplace", chart.place], row] : [row]));
  const gender = aafGender(chart.aaf);
  return withAafExport(
    withAstroSeekSave(
      {
        ...view,
        rows: [...(chart.name ? [["Name", chart.name]] : []), ...genderRows(gender), ...rows],
        warnings: warnings.map((code) => WARNINGS[code]?.(chart) ?? code),
        notes: [...view.notes, ...ASTRO_SEEK_NOTES],
        buttons: [...ASTRO_SEEK_BUTTONS],
        ...(view.sky ? { next: astroComStep(view.sky, { local: chart.local, name: aafName(chart.aaf), town: chart.aaf.place, gender }) } : {}),
      },
      { town: chart.aaf.place, name: aafName(chart.aaf), gender },
    ),
    result,
  );
}

// A record's gender for astro.com's and Astro-Seek's forms: its sex field's m
// or f. Anything else, such as the unknown "*", gives none.
function aafGender({ sex }) {
  return { m: "male", f: "female" }[sex?.toLowerCase()] ?? null;
}

// A record's name for astro.com's form, or null when the file gives neither part.
// A record with only a last name gives it as the first name, which astro.com's
// form needs, as nameFromText does.
function aafName({ firstName, lastName }) {
  if (firstName) return { first: firstName, last: lastName ?? "" };
  return lastName ? { first: lastName, last: "" } : null;
}

const UT_NOTES = {
  chart:
    "The AAF file gives this chart in Universal Time, since the page doesn't say how its offset splits into standard time and daylight saving.",
  sky: "The AAF file gives this moment in Universal Time, since Stellarium Web shows no birthplace time zone.",
};

/**
 * The view with a Save as AAF file button, once its UTC is decided: a ready
 * screen, or a Stellarium Web tab's. Any other view comes back unchanged.
 * A chart whose offset can't be split into standard time and daylight saving
 * is saved in Universal Time, and the note says so.
 *
 * @param {object} view  from viewFor or viewForSky
 * @param {object} chart  the analyzePage result or sky the view was made from
 */
export function withAafExport(view, chart) {
  if (view.state !== "ready" && view.state !== "to-astro-seek") return view;
  const record = exportRecord(chart);
  const download = { label: "Save as AAF file", filename: `chart-${record.local.slice(0, 10)}.aaf`, text: writeAaf([record]) };
  if (record.basis === "utc") download.note = chart.site ? UT_NOTES.chart : UT_NOTES.sky;
  return { ...view, download };
}

// "New York Test: 17 Apr 2024, 08:00, New York, NY (US)", from the record as
// written, so a chart that can't open is still recognisable.
function recordLabel({ firstName, lastName, date, time, place, country }) {
  const name = joined([firstName, lastName], " ") ?? "Unnamed chart";
  const day = date ? `${date.day} ${MONTHS[date.month - 1]} ${date.year}` : "date unknown";
  const clock = time
    ? `${pad(time.hour)}:${pad(time.minute)}${time.precision === "second" ? `:${pad(time.second)}` : ""}`
    : "time unknown";
  const where = joined([place, country], ", ");
  return `${name}: ${day}, ${clock}${where ? `, ${where}` : ""}`;
}

const joined = (parts, separator) => parts.filter((part) => part).join(separator) || null;

const pad = (n) => String(n).padStart(2, "0");

/**
 * The text of an AAF file's bytes. AAF'97 names no encoding: UTF-8 is tried
 * first, and anything else is read as Windows-1252, with a warning to check
 * the names. A byte order mark is kept for parseAaf to skip.
 *
 * @param {Uint8Array} bytes
 * @returns {{ text: string, warning?: string }}
 */
export function decodeAafFile(bytes) {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(bytes),
      warning: "This file isn't UTF-8, so AstroChart Bridge read it as Windows-1252. Check that accented letters in names look right.",
    };
  }
}
