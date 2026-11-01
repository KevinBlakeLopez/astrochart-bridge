import { classifyUrl, readChart, readScreenshot } from "./astroseek.js";
import { resolveUtc } from "./civiltime.js";
import { SIDEREAL_TOLERANCE_SECONDS, siderealGap } from "./sidereal.js";

/**
 * Everything Chart Bridge needs from one Astro-Seek page, in the shape of a
 * fixture's expected block. Stops at the first refusal and returns it as is.
 *
 * @param {{ url: string, text: string }} page  text is document.body.innerText
 * @returns {{ kind: "refused", reason: string }
 *   | { kind: "natal", local: string, zoneLabel: string | null, lat: number, lng: number }
 *     & ReturnType<typeof resolveUtc>}
 */
export function analyzePage({ url, text }) {
  const page = classifyUrl(url);
  if (page.kind === "refused") return page;

  const chart = readChart({ url, text });
  if (chart.kind === "refused") return chart;

  // printedUt only feeds resolveUtc; the result carries the decided utc instead.
  const { local, zoneLabel, lat, lng } = chart;
  return { kind: "natal", local, zoneLabel, lat, lng, ...resolveUtc(chart) };
}

/**
 * The same as analyzePage, for the OCR text of a screenshot of an Astro-Seek
 * chart page. With no URL to check the text against, two checks stand in for
 * it: the printed sidereal time must fit the UT and longitude, and the local
 * time must be a real UTC offset away from the UT. Nothing checks the latitude.
 *
 * @param {string} text  OCR output
 * @returns {ReturnType<typeof analyzePage>}
 */
export function analyzeScreenshot(text) {
  const chart = readScreenshot(text);
  if (chart.kind === "refused") return chart;

  if (siderealGap(chart.printedUt, chart.lng, chart.siderealSeconds) > SIDEREAL_TOLERANCE_SECONDS) {
    return { kind: "refused", reason: "sidereal-mismatch" };
  }
  // A misread local date would otherwise show up as an offset of days or years.
  // -12:00 to +14:00 is the range parseOffset accepts.
  const offsetMinutes = (Date.parse(`${chart.local}Z`) - Date.parse(chart.printedUt)) / 60_000;
  if (offsetMinutes < -720 || offsetMinutes > 840) return { kind: "refused", reason: "offset-out-of-range" };

  const { local, zoneLabel, lat, lng } = chart;
  return { kind: "natal", local, zoneLabel, lat, lng, ...resolveUtc(chart) };
}
