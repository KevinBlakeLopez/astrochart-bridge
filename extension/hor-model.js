// What the import page shows for a Morinus .hor file. The file is read in
// core/morinus-hor.js; this file turns its result into the views view.js
// draws, reusing the popup's screen for a chart and the AAF import's buttons.
import { chartFromHor, parseHor } from "./core/morinus-hor.js";
import { withAafExport } from "./aaf-model.js";
import { text } from "./messages/index.js";
import {
  astroComStepFor,
  astroSeekButtons,
  astroSeekNotes,
  astroSeekWarnings,
  genderRows,
  helioscopeButton,
  nameFromText,
  offsetText,
  viewFor,
  withAstroSeekSave,
} from "./popup-model.js";

// The words are the catalog's (messages/), read as each screen is built. Each
// refusal keeps its code on screen, like the AAF import's refusals, so a bug
// report says which check failed.

/**
 * The import page's list for a .hor file's bytes: its one chart, labelled by
 * what the file says, with the view to show for it and the chart itself, for
 * the link Which planets were visible opens. The same shape as
 * viewForAafText's, so the page lists both alike. A file or chart that can't
 * open has no chart.
 *
 * @param {Uint8Array} bytes
 * @param {{ timeZone?: string, onTheWeb?: boolean }} [options]  passed on to viewFor, and onTheWeb to withAstroSeekSave and astroComStepFor
 * @returns {{ state: "hor-file", items: { label: string, view: object, chart: object | null }[], message: string }}
 */
export function viewForHorFile(bytes, options) {
  const words = text();
  const record = parseHor(bytes);
  if (record.kind === "refused") {
    const { unreadable, fieldWords } = words.hor;
    const what = Object.hasOwn(unreadable, record.reason) ? unreadable[record.reason](fieldWords[record.field]) : words.hor.couldntReadFile;
    return {
      state: "hor-file",
      items: [{ label: words.hor.unreadableLabel, view: { state: "refused", message: what, code: record.reason }, chart: null }],
      message: words.hor.couldntReadMorinus,
    };
  }
  const chart = chartFromHor(record);
  return {
    state: "hor-file",
    items: [{ label: recordLabel(record.values), view: viewForHorChart(chart, options), chart: chart.kind === "refused" ? null : chart }],
    message: words.files.oneChart,
  };
}

/**
 * What to show for one chart: the popup's ready screen, with the name,
 * birthplace and the time as Morinus has it, or why it can't open. Its step
 * to enter the chart in astro.com takes Morinus's one name field as the first
 * name, as the paste page does, and the place as the town for astro.com's atlas.
 *
 * @param {ReturnType<typeof chartFromHor>} result
 * @param {{ timeZone?: string, onTheWeb?: boolean }} [options]  passed on to viewFor, and onTheWeb to withAstroSeekSave and astroComStepFor
 */
export function viewForHorChart(result, options) {
  const words = text();
  if (result.kind === "refused") {
    const { refusals } = words.hor;
    return {
      state: "refused",
      message: Object.hasOwn(refusals, result.reason) ? refusals[result.reason] : words.hor.cantOpen,
      code: result.reason,
    };
  }

  const { warnings = [], morinus, ...chart } = result;
  const view = viewFor(chart, options);
  // Found by the chosen language's labels: Entered as after the offset row,
  // the birthplace before the place row.
  const labels = words.popup.rows;
  const rows = view.rows.flatMap((row) => {
    if (row[0] === labels.offset) return [row, [words.hor.enteredAs, enteredAs(morinus)]];
    if (row[0] === labels.place && chart.place) return [[words.files.birthplace, chart.place], row];
    return [row];
  });
  const gender = horGender(morinus);
  const first = [
    ...(chart.name ? [[labels.name, chart.name]] : []),
    ...genderRows(gender),
    ...(morinus.chartType === "horary" ? [[words.hor.chartType, words.hor.horary]] : []),
  ];
  const withExport = withAafExport(
    withAstroSeekSave(
      {
        ...view,
        rows: [...first, ...rows],
        warnings: [
          ...warnings.map((code) => (Object.hasOwn(words.hor.warnings, code) ? words.hor.warnings[code] : code)),
          ...astroSeekWarnings(chart.lng),
        ],
        notes: [...view.notes, ...(morinus.timeBasis === "zone" ? [words.hor.zoneNote] : []), ...astroSeekNotes()],
        // As for an AAF chart: no Share… here, so Which planets were visible ends the buttons.
        buttons: [...astroSeekButtons(), helioscopeButton()],
        ...(view.sky ? { next: astroComStepFor(options)(view.sky, { local: chart.local, name: nameFromText(chart.name), town: chart.place, gender }) } : {}),
      },
      { town: chart.place, name: nameFromText(chart.name), gender },
      options,
    ),
    result,
  );
  // A Greenwich time is written as it is, so the AAF import's reason for UT doesn't apply.
  return withExport.download?.note ? { ...withExport, download: { ...withExport.download, note: words.hor.utDownloadNote } } : withExport;
}

// A Morinus chart's gender for astro.com's and Astro-Seek's forms. Morinus
// has one male box, ticked in all 57 files in fixtures/morinus, horary and
// solar return charts too. So only a horary chart, or a radix chart not
// ticked male, says anything: a ticked box may just never have been changed.
function horGender({ chartType, male }) {
  if (chartType === "horary") return "horary";
  return male ? null : "female";
}

// "UTC-05:00 zone, with daylight saving" or "Greenwich time".
function enteredAs({ timeBasis, zoneOffsetMinutes, daylightSaving }) {
  const words = text().hor;
  const basis = timeBasis === "zone" ? words.zone(offsetText(zoneOffsetMinutes)) : words.greenwich;
  return daylightSaving ? words.withDaylightSaving(basis) : basis;
}

// "Test: 17 Apr 2024, 08:00, New York", or "16 Nov 575 BC (Julian)", from the
// file as it is, so a chart that can't open is still recognisable.
function recordLabel({ name, bc, cal, year, month, day, hour, minute, place }) {
  const words = text();
  const date = words.hor.recordDate(day, month, year, bc, cal === 1);
  const clock = `${pad(hour)}:${pad(minute)}`;
  return `${name || words.files.unnamed}: ${date}, ${clock}${place ? `, ${place}` : ""}`;
}

const pad = (n) => String(n).padStart(2, "0");
