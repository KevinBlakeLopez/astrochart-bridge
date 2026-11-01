import { ASTRO_SEEK_NOTES, viewFor } from "./popup-model.js";

// Each refusal analyzeScreenshot can return. They keep their code on screen,
// like the popup's unreadable pages, so a bug report says which check failed.
const REFUSALS = {
  "unreadable-screenshot":
    "Chart Bridge couldn't find the birth data in this screenshot. Include everything from Date of Birth to Latitude, Longitude, at full size.",
  "ambiguous-screenshot": "This screenshot shows more than one chart. Chart Bridge opens natal charts only.",
  "sidereal-mismatch":
    "The sidereal time in this screenshot doesn't match its Universal Time and longitude, so one of them was probably misread. Try a larger screenshot.",
  "offset-out-of-range":
    "The local time in this screenshot is too far from its Universal Time, so one of them was probably misread. Try a larger screenshot.",
};

// First on every screen that opens the sky: OCR can misread, and the latitude is the one number no check covers.
const COMPARE_NOTE = "Read from a screenshot. Compare these rows with it before opening the sky: nothing checks the latitude.";

// Both open the same decided UTC and place: Astro-Seek's chart in UT/GMT, as from a Stellarium tab.
const BUTTONS = [
  { label: "Open sky", opens: "stellarium" },
  { label: "Open chart in Astro-Seek", opens: "astro-seek" },
];

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
  const view = viewFor(result, options);
  if (view.state === "refused") return view;
  return { ...view, notes: [COMPARE_NOTE, ...view.notes, ...ASTRO_SEEK_NOTES], buttons: BUTTONS };
}
