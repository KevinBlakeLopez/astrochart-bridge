import { classifyUrl, readChart } from "./astroseek.js";
import { resolveUtc } from "./civiltime.js";

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
