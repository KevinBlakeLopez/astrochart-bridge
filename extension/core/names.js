// A chart's name and place as a program or a person wrote them, for
// astro.com's and Astro-Seek's forms. Neither is checked: both forms show
// them to change before anything is saved.

/**
 * The name for astro.com's form from a chart that keeps it as one string, as
 * pasted text, Morinus and the desktop programs do: all of it is the first
 * name, since astro.com's form refuses a chart with no first name ("Please
 * write something as 'first name'", seen on 2026-11-01). Runs of spaces
 * become one, as a person would type it.
 *
 * @param {string | null | undefined} text
 * @returns {{ first: string, last: "" } | null}
 */
export function nameFromText(text) {
  const first = text?.replace(/\s+/g, " ").trim() ?? "";
  return first === "" ? null : { first, last: "" };
}

/**
 * A program reader's record, or each of its readings, with the chart's name
 * and place as printed: each line with its runs of spaces made one, and left
 * out when the program printed none. A refusal is returned as it is.
 *
 * @template T
 * @param {T} chart  a reader's record, readings or refusal
 * @param {{ name?: string | null, place?: string | null }} lines
 * @returns {T}
 */
export function withLabels(chart, lines) {
  if (Array.isArray(chart)) return chart.map((reading) => withLabels(reading, lines));
  if (chart.kind === "refused") return chart;
  const labels = Object.entries(lines)
    .map(([key, line]) => [key, line?.replace(/\s+/g, " ").trim() ?? ""])
    .filter(([, text]) => text !== "");
  return { ...chart, ...Object.fromEntries(labels) };
}
