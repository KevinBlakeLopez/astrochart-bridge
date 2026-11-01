import { ASTRO_SEEK_BUTTONS, ASTRO_SEEK_NOTES, viewFor } from "./popup-model.js";

// Each refusal analyzeScreenshot can return. They keep their code on screen,
// like the popup's unreadable pages, so a bug report says which check failed.
const REFUSALS = {
  "unreadable-screenshot":
    "Chart Bridge couldn't find the birth data in this screenshot. From Astro-Seek, include everything from Date of Birth to Latitude, Longitude; from astro.com, the chart's header from the date to Sid. Time; from Solar Fire or Astro Gold, the chart details from the date to the coordinates; from Morinus, its status bar or the middle of its square chart; from Valens, the middle of its wheel. Take it at full size.",
  "no-coordinates":
    "This screenshot has no coordinates. Astro Gold's chart wheel doesn't print them: take its Chart Details panel or Edit Chart screen instead. From Solar Fire, include the chart details down to the coordinates.",
  "ambiguous-screenshot": "This screenshot shows more than one chart. Chart Bridge opens natal charts only.",
  "sidereal-mismatch":
    "The sidereal time in this screenshot doesn't match its Universal Time and longitude, so one of them was probably misread. Try a larger screenshot.",
  "offset-out-of-range":
    "The local time in this screenshot is too far from its Universal Time, so one of them was probably misread. Try a larger screenshot.",
  "weekday-mismatch":
    "The weekday in this screenshot doesn't fall on its date, so the date was probably misread. Try a larger screenshot.",
  "zone-offset-mismatch":
    "The time zone in this screenshot doesn't match its UTC offset, so one of them was probably misread. Try a larger screenshot.",
  "calendar-unsupported": "This chart is dated Old Style or BC. Chart Bridge reads Gregorian dates only.",
  "apparent-time": "This chart uses local apparent time, which Chart Bridge can't open yet.",
  "local-time-ambiguous":
    "This chart's time is marked LC, which Morinus and Valens print for both local mean time and local apparent time. Chart Bridge can't tell which, so it can't open it yet.",
  "chart-type-unsupported": "This is a return, profection or direction chart. Chart Bridge opens natal and horary charts only.",
};

// The name each desktop program's reader gives as its site.
// Solar Fire and Astro Gold print the same block, so a screenshot without its
// type line could be either.
const PROGRAMS = {
  "solar-fire": "Solar Fire",
  "astro-gold": "Astro Gold",
  "solar-fire-or-astro-gold": "Solar Fire or Astro Gold",
  morinus: "Morinus",
  valens: "Valens",
};

// Warnings only a screenshot's chart can have, shown in place of their codes.
const WARNINGS = {
  "offset-unchecked": ({ site }) =>
    `${PROGRAMS[site]} prints no Universal Time or sidereal time to check its UTC offset against. Compare the Offset row with the screenshot.`,
};

// First on every screen that opens the sky: OCR can misread, and the latitude is the one number no check covers.
const COMPARE_NOTE = "Read from a screenshot. Compare these rows with it before opening the sky: nothing checks the latitude.";

/**
 * What the screenshot page shows for an analyzeScreenshot result: the popup's
 * screens, with the screenshot's own refusals, a note to compare the rows, and
 * a second button that opens the chart in Astro-Seek.
 *
 * @param {ReturnType<typeof import("./core/index.js").analyzeScreenshot>} result
 * @param {{ timeZone?: string }} [options]  passed on to viewFor
 */
export function viewForScreenshot(result, options) {
  if (result.kind === "refused" && Object.hasOwn(REFUSALS, result.reason)) {
    return { state: "refused", message: REFUSALS[result.reason], code: result.reason };
  }
  // viewFor words the warnings it knows; this page words its own, after them.
  const isOwn = (code) => Object.hasOwn(WARNINGS, code);
  const own = (result.warnings ?? []).filter(isOwn);
  const view = viewFor(own.length === 0 ? result : { ...result, warnings: result.warnings.filter((code) => !isOwn(code)) }, options);
  if (view.state === "refused") return view;
  const warnings = own.length === 0 ? {} : { warnings: [...view.warnings, ...own.map((code) => WARNINGS[code](result))] };
  // viewFor's prompt names Astro-Seek. A program's time is its clock, so the
  // offset to enter takes in daylight saving.
  const message =
    view.state === "enter-offset" && Object.hasOwn(PROGRAMS, result.site)
      ? { message: `${PROGRAMS[result.site]} doesn't print the UTC offset. Enter the offset at the birth place, including daylight saving, as ±HH:MM.` }
      : {};
  // viewFor already gives an astro.com chart Astro-Seek's notes and buttons.
  const notes = result.site === "astro-com" ? view.notes : [...view.notes, ...ASTRO_SEEK_NOTES];
  return { ...view, ...warnings, ...message, notes: [COMPARE_NOTE, ...notes], buttons: [...ASTRO_SEEK_BUTTONS] };
}
