import { viewFor } from "./popup-model.js";

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

/**
 * What the screenshot page shows for an analyzeScreenshot result: the popup's
 * screens, with the screenshot's own refusals and a note to compare the rows.
 *
 * @param {ReturnType<typeof import("./core/index.js").analyzeScreenshot>} result
 * @param {{ timeZone?: string }} [options]  passed on to viewFor
 */
export function viewForScreenshot(result, options) {
  if (result.kind === "refused" && Object.hasOwn(REFUSALS, result.reason)) {
    return { state: "refused", message: REFUSALS[result.reason], code: result.reason };
  }
  const view = viewFor(result, options);
  return view.state === "refused" ? view : { ...view, notes: [COMPARE_NOTE, ...view.notes] };
}
