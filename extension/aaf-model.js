// What the import page and the Save as AAF button show. AAF is read and
// written in core/aaf.js; this file turns its results into views that
// view.js draws, reusing the popup's own screens for a chart.
import { chartFromRecord, exportRecord, parseAaf, writeAaf } from "./core/aaf.js";
// Imported as messages, since an AAF file is read as text here.
import { text as messages } from "./messages/index.js";
import {
  astroComStepFor,
  astroSeekButtons,
  astroSeekNotes,
  astroSeekWarnings,
  genderRows,
  helioscopeButton,
  paransButton,
  viewFor,
  withAstroSeekSave,
} from "./popup-model.js";

// The words are the catalog's (messages/), read as each screen is built. Each
// refusal keeps its code on screen, like the screenshot page's refusals, so a
// bug report says which check failed.

const WARNINGS = {
  "time-hour-only": ({ local }) => messages().aaf.hourOnly(local.slice(11, 16)),
};

/**
 * The import page's list for an AAF text: one item per record, labelled by
 * what the file says, with the view to show when it is chosen and the chart
 * itself, for the link Which planets were visible opens. A record that can't
 * open has no chart.
 *
 * @param {string} text
 * @param {{ timeZone?: string, onTheWeb?: boolean }} [options]  passed on to viewFor, and onTheWeb to withAstroSeekSave and astroComStepFor
 * @returns {{ state: "aaf-list", items: { label: string, view: object, chart: object | null }[], message: string }}
 */
export function viewForAafText(text, options) {
  const words = messages();
  const items = parseAaf(text).map((record) => {
    const chart = chartFromRecord(record);
    return {
      label: record.kind === "refused" ? words.aaf.unreadableRecord(record.line) : recordLabel(record),
      view: viewForAafChart(chart, options),
      chart: chart.kind === "refused" ? null : chart,
    };
  });
  const message =
    items.length === 0 ? words.aaf.noRecords : items.length === 1 ? words.files.oneChart : words.aaf.charts(items.length);
  return { state: "aaf-list", items, message };
}

/**
 * What to show for one record: the popup's ready screen for an astro.com
 * chart, with the name and birthplace the file gives, or why it can't open.
 * Its step to enter the chart in astro.com takes the name as the file splits
 * it, first and last, and the place with its country as the town: the form
 * gets the place alone, and the country helps choose among its matches.
 *
 * @param {ReturnType<typeof chartFromRecord>} result
 * @param {{ timeZone?: string, onTheWeb?: boolean }} [options]  passed on to viewFor, and onTheWeb to withAstroSeekSave and astroComStepFor
 */
export function viewForAafChart(result, options) {
  const words = messages();
  if (result.kind === "refused") {
    const { refusals, unreadable } = words.aaf;
    if (Object.hasOwn(refusals, result.reason)) return { state: "refused", message: refusals[result.reason], code: result.reason };
    const what = Object.hasOwn(unreadable, result.reason) ? unreadable[result.reason] : words.aaf.thisRecord;
    return { state: "refused", message: words.aaf.couldntRead(result.line, what, result.value), code: result.reason };
  }

  const { warnings = [], ...chart } = result;
  const view = viewFor(chart, options);
  // The birthplace goes right before the place row, found by the chosen language's label.
  const rows = view.rows.flatMap((row) =>
    row[0] === words.popup.rows.place && chart.place ? [[words.files.birthplace, chart.place], row] : [row],
  );
  const gender = aafGender(chart.aaf);
  // The place with its country, which helps choose among a town search's
  // matches; only the place is typed (searchTown). A country alone names no town.
  const town = chart.aaf.place === null ? null : joined([chart.aaf.place, chart.aaf.country], ", ");
  return withAafExport(
    withAstroSeekSave(
      {
        ...view,
        rows: [...(chart.name ? [[words.popup.rows.name, chart.name]] : []), ...genderRows(gender), ...rows],
        warnings: [...warnings.map((code) => WARNINGS[code]?.(chart) ?? code), ...astroSeekWarnings(chart.lng)],
        notes: [...view.notes, ...astroSeekNotes()],
        // The import page has no Share…, so Which planets were visible and
        // Parans end the buttons on their own.
        buttons: [...astroSeekButtons(), helioscopeButton(), paransButton()],
        ...(view.sky ? { next: astroComStepFor(options)(view.sky, { local: chart.local, name: aafName(chart.aaf), town, gender }) } : {}),
      },
      { town, name: aafName(chart.aaf), gender },
      options,
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
  const words = messages().aaf;
  const record = exportRecord(chart);
  const download = { label: words.save, filename: `chart-${record.local.slice(0, 10)}.aaf`, text: writeAaf([record]) };
  if (record.basis === "utc") download.note = chart.site ? words.utNotes.chart : words.utNotes.sky;
  return { ...view, download };
}

// "New York Test: 17 Apr 2024, 08:00, New York, NY (US)", from the record as
// written, so a chart that can't open is still recognisable.
function recordLabel({ firstName, lastName, date, time, place, country }) {
  const words = messages();
  const name = joined([firstName, lastName], " ") ?? words.files.unnamed;
  const day = date ? words.files.recordDate(date.day, date.month, date.year) : words.aaf.dateUnknown;
  const clock = time
    ? `${pad(time.hour)}:${pad(time.minute)}${time.precision === "second" ? `:${pad(time.second)}` : ""}`
    : words.aaf.timeUnknown;
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
      warning: messages().aaf.notUtf8,
    };
  }
}
