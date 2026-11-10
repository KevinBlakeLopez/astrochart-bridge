import { text } from "./messages/index.js";
import { astroComStepFor, astroSeekButtons, astroSeekNotes, astroSeekWarnings, chartButtons, genderRows, viewFor, withAstroSeekSave } from "./popup-model.js";

// Each refusal analyzeScreenshot can return keeps its code on screen, like the
// popup's unreadable pages, so a bug report says which check failed. The
// words are the catalog's (messages/), read as each screen is built.

/**
 * The name each desktop program's reader gives as its site. Solar Fire and
 * Astro Gold print the same block, so a screenshot without its type line
 * could be either. The paste page names them too.
 *
 * @returns {Record<string, string>}
 */
export function programNames() {
  const { either } = text().screenshot;
  return {
    "solar-fire": "Solar Fire",
    "astro-gold": "Astro Gold",
    "solar-fire-or-astro-gold": either("Solar Fire", "Astro Gold"),
    morinus: "Morinus",
    valens: "Valens",
    planetdance: "Planetdance",
    jhora: "Jagannatha Hora",
    kepler: "Kepler",
    sirius: "Sirius",
    "kepler-or-sirius": either("Kepler", "Sirius"),
    janus: "Janus",
    winstar: "Win*Star",
    timepassages: "TimePassages",
    astrolog: "Astrolog",
  };
}

// Warnings only a screenshot's chart can have, shown in place of their codes.
const WARNINGS = {
  "offset-unchecked": ({ site }) => text().screenshot.offsetUnchecked(programNames()[site]),
};

/**
 * What the screenshot page shows for an analyzeScreenshot result: the popup's
 * screens, with the screenshot's own refusals, a note to compare the rows, and
 * a second button that opens the chart in Astro-Seek.
 *
 * @param {ReturnType<typeof import("./core/index.js").analyzeScreenshot>} result
 * @param {{ timeZone?: string, onTheWeb?: boolean }} [options]  passed on to viewFor, and onTheWeb to withAstroSeekSave and astroComStepFor
 */
export function viewForScreenshot(result, options) {
  const words = text().screenshot;
  if (result.kind === "refused" && Object.hasOwn(words.refusals, result.reason)) {
    return { state: "refused", message: words.refusals[result.reason], code: result.reason };
  }
  // viewFor words the warnings it knows; this page words its own, after them.
  const isOwn = (code) => Object.hasOwn(WARNINGS, code);
  const own = (result.warnings ?? []).filter(isOwn);
  const view = viewFor(own.length === 0 ? result : { ...result, warnings: result.warnings.filter((code) => !isOwn(code)) }, options);
  if (view.state === "refused") return view;
  // viewFor already warns an astro.com chart that Astro-Seek gets it 1' off.
  const added = [...own.map((code) => WARNINGS[code](result)), ...(result.site === "astro-com" ? [] : astroSeekWarnings(result.lng))];
  const warnings = added.length === 0 ? {} : { warnings: [...(view.warnings ?? []), ...added] };
  // viewFor's prompt names Astro-Seek, so a program's chart names the program.
  const programs = programNames();
  const message =
    view.state === "enter-offset" && Object.hasOwn(programs, result.site) ? { message: words.noOffset(programs[result.site]) } : {};
  // viewFor already gives an astro.com chart Astro-Seek's notes and buttons.
  const notes = result.site === "astro-com" ? view.notes : [...view.notes, ...astroSeekNotes()];
  const buttons = chartButtons(astroSeekButtons());
  // viewFor leads only an Astro-Seek chart on to astro.com, since the popup
  // is on an astro.com chart's own page, with the town its address names. A
  // screenshot can be any chart, so every chart with a decided sky can be
  // entered there, at its own local time, and with what its screenshot
  // prints: a program's or Astro-Seek page's name, place and gender, where
  // its reader found them, which go on to both forms and show as rows to
  // compare with the screenshot like the others.
  const { name = null, town = null, gender = null } = result;
  const next = view.sky ? { next: astroComStepFor(options)(view.sky, { local: result.local, name, town, gender }) } : {};
  const rows = view.rows && (name || town || gender) ? { rows: labelRows(view.rows, { name, town, gender }) } : {};
  // The compare note comes first on every screen that opens the sky.
  return withAstroSeekSave(
    { ...view, ...rows, ...warnings, ...message, ...next, notes: [words.compareNote, ...notes], buttons },
    { name, town, gender },
    options,
  );
}

// The screen's rows with Name and Gender first and Town after Place, as printed.
function labelRows(rows, { name, town, gender }) {
  const labels = text().popup.rows;
  const at = rows.findIndex(([label]) => label === labels.place) + 1 || rows.length;
  const nameRow = name ? [[labels.name, [name.first, name.last].filter(Boolean).join(" ")]] : [];
  const townRow = town ? [[labels.town, town]] : [];
  return [...nameRow, ...genderRows(gender), ...rows.slice(0, at), ...townRow, ...rows.slice(at)];
}
