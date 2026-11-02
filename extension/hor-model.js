// What the import page shows for a Morinus .hor file. The file is read in
// core/morinus-hor.js; this file turns its result into the views view.js
// draws, reusing the popup's screen for a chart and the AAF import's buttons.
import { chartFromHor, parseHor } from "./core/morinus-hor.js";
import { withAafExport } from "./aaf-model.js";
import { ASTRO_SEEK_BUTTONS, ASTRO_SEEK_NOTES, astroComStep, nameFromText, offsetText, viewFor, withAstroSeekSave } from "./popup-model.js";

// Why chartFromHor refused a chart. Each keeps its code on screen, like the
// AAF import's refusals, so a bug report says which check failed.
const REFUSALS = {
  "chart-type-unsupported":
    "This is a Morinus chart of another kind, such as a solar return or a transit. AstroChart Bridge opens radix and horary charts only.",
  "bce-date": "This chart's date is BC, which AstroChart Bridge can't open yet.",
  "julian-calendar": "This date is in the Julian calendar, which AstroChart Bridge can't open yet.",
  "pre-gregorian-date": "AstroChart Bridge opens dates from 15 October 1582 on, when the Gregorian calendar began.",
  "bad-date": "This chart's date isn't on the calendar, such as 30 February.",
  "local-mean-time": "This chart is in local mean time, which AstroChart Bridge can't open yet.",
  "local-apparent-time": "This chart is in local apparent time, sundial time, which AstroChart Bridge can't open yet.",
  "bad-coordinates": "This chart's coordinates are past 90° of latitude or 180° of longitude.",
  "offset-out-of-range": "This chart's offset, daylight saving included, is outside -12:00 to +14:00.",
};

// Why parseHor couldn't read the file, given the words for the field it stopped at.
const UNREADABLE = {
  "too-large": () => "This file is far bigger than a Morinus chart, so AstroChart Bridge didn't read it.",
  truncated: (field) => `This file stops partway through its ${field}, so it may have been cut short.`,
  "trailing-data": () => "This file goes on after the chart, which a Morinus chart file doesn't, so it may not be one.",
  "unsupported-opcode": (field) =>
    `At its ${field}, this file holds something other than text, a number or yes or no, which is all a Morinus chart holds. AstroChart Bridge didn't read it.`,
  malformed: (field) => `AstroChart Bridge couldn't read this file at its ${field}. It may not be a Morinus chart file.`,
  "bad-text": (field) => `At its ${field}, this file has text that can't be read. It may not be a Morinus chart file.`,
  "field-type": (field) => `At its ${field}, this file has a kind of value Morinus doesn't save there, so it may not be a Morinus chart file.`,
  "field-range": (field) => `At its ${field}, this file has a value outside what Morinus allows, so it may not be a Morinus chart file.`,
};

// The fields in words, for "its notes" or "this file's zone hours".
const FIELD_WORDS = {
  name: "name", male: "sex", htype: "chart type", bc: "BC box", year: "year", month: "month", day: "day",
  hour: "hour", minute: "minute", second: "second", cal: "calendar", zt: "time type", plus: "zone direction",
  zh: "zone hours", zm: "zone minutes", daylightsaving: "daylight saving box", place: "place",
  deglon: "longitude", minlon: "longitude", seclon: "longitude", east: "longitude",
  deglat: "latitude", minlat: "latitude", seclat: "latitude", north: "latitude", altitude: "altitude", notes: "notes",
};

const WARNINGS = {
  "text-encoding-guessed":
    "This file was saved by an older Morinus, which doesn't record how it wrote accented letters. Check that the name and place look right.",
  "daylight-saving-on-ut":
    "Morinus has this chart in Greenwich time with daylight saving ticked, so it takes an hour off the time entered, and so does AstroChart Bridge.",
  "longitude-seconds-ignored-by-morinus":
    "The file gives the longitude to the second, but Morinus leaves the seconds out when it opens the file, so its chart is drawn up to 59\" east or west of this one.",
};

const ZONE_NOTE =
  "Morinus saves the offset entered for a chart, not its time zone, so nothing here checks that offset against the birthplace and date.";
const UT_DOWNLOAD_NOTE = "The AAF file gives this chart in Universal Time, the time Morinus works out from the time entered.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The import page's list for a .hor file's bytes: its one chart, labelled by
 * what the file says, with the view to show for it. The same shape as
 * viewForAafText's, so the page lists both alike.
 *
 * @param {Uint8Array} bytes
 * @param {{ timeZone?: string }} [options]  passed on to viewFor
 * @returns {{ state: "hor-file", items: { label: string, view: object }[], message: string }}
 */
export function viewForHorFile(bytes, options) {
  const record = parseHor(bytes);
  if (record.kind === "refused") {
    const what = UNREADABLE[record.reason]?.(FIELD_WORDS[record.field]) ?? "AstroChart Bridge couldn't read this file.";
    return {
      state: "hor-file",
      items: [{ label: "Unreadable Morinus file", view: { state: "refused", message: what, code: record.reason } }],
      message: "AstroChart Bridge couldn't read this Morinus file.",
    };
  }
  return {
    state: "hor-file",
    items: [{ label: recordLabel(record.values), view: viewForHorChart(chartFromHor(record), options) }],
    message: "1 chart in this file.",
  };
}

/**
 * What to show for one chart: the popup's ready screen, with the name,
 * birthplace and the time as Morinus has it, or why it can't open. Its step
 * to enter the chart in astro.com takes Morinus's one name field as the first
 * name, as the paste page does, and the place as the town for astro.com's atlas.
 *
 * @param {ReturnType<typeof chartFromHor>} result
 * @param {{ timeZone?: string }} [options]  passed on to viewFor
 */
export function viewForHorChart(result, options) {
  if (result.kind === "refused") {
    return { state: "refused", message: REFUSALS[result.reason] ?? "AstroChart Bridge can't open this chart.", code: result.reason };
  }

  const { warnings = [], morinus, ...chart } = result;
  const view = viewFor(chart, options);
  const rows = view.rows.flatMap((row) => {
    if (row[0] === "Offset") return [row, ["Entered as", enteredAs(morinus)]];
    if (row[0] === "Place" && chart.place) return [["Birthplace", chart.place], row];
    return [row];
  });
  const first = [
    ...(chart.name ? [["Name", chart.name]] : []),
    ...(morinus.chartType === "horary" ? [["Chart type", "Horary"]] : []),
  ];
  const withExport = withAafExport(
    withAstroSeekSave(
      {
        ...view,
        rows: [...first, ...rows],
        warnings: warnings.map((code) => WARNINGS[code] ?? code),
        notes: [...view.notes, ...(morinus.timeBasis === "zone" ? [ZONE_NOTE] : []), ...ASTRO_SEEK_NOTES],
        buttons: [...ASTRO_SEEK_BUTTONS],
        ...(view.sky ? { next: astroComStep(view.sky, { local: chart.local, name: nameFromText(chart.name), town: chart.place }) } : {}),
      },
      { town: chart.place, name: nameFromText(chart.name) },
    ),
    result,
  );
  // A Greenwich time is written as it is, so the AAF import's reason for UT doesn't apply.
  return withExport.download?.note ? { ...withExport, download: { ...withExport.download, note: UT_DOWNLOAD_NOTE } } : withExport;
}

// "UTC-05:00 zone, with daylight saving" or "Greenwich time".
function enteredAs({ timeBasis, zoneOffsetMinutes, daylightSaving }) {
  const basis = timeBasis === "zone" ? `${offsetText(zoneOffsetMinutes)} zone` : "Greenwich time";
  return daylightSaving ? `${basis}, with daylight saving` : basis;
}

// "Test: 17 Apr 2024, 08:00, New York", or "16 Nov 575 BC (Julian)", from the
// file as it is, so a chart that can't open is still recognisable.
function recordLabel({ name, bc, cal, year, month, day, hour, minute, place }) {
  const date = `${day} ${MONTHS[month - 1]} ${year}${bc ? " BC" : ""}${cal === 1 ? " (Julian)" : ""}`;
  const clock = `${pad(hour)}:${pad(minute)}`;
  return `${name || "Unnamed chart"}: ${date}, ${clock}${place ? `, ${place}` : ""}`;
}

const pad = (n) => String(n).padStart(2, "0");
