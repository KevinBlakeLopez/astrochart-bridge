// What the receiving page shows for a Chart Bridge link. It is the popup's
// ready screen, from viewFor, for a chart that arrived in a link rather than
// from a page: it can open in Stellarium Web and Astro-Seek, and be copied on.
// Every decision is made here, so import.js only reads the link and renders.
import { fromFragment, skyFor, toFragment } from "./core/portable.js";
import { ASTRO_SEEK_NOTES, ASTRO_SEEK_BUTTONS, viewFor } from "./popup-model.js";

// The receiving page works without the extension, so the popup's
// "Enter in astro.com…" step, which keeps the values for the tab it opens,
// isn't offered: nothing here could keep them.
const BUTTONS = [...ASTRO_SEEK_BUTTONS, { label: "Copy link", does: "copy", secondary: true }];

const SITE_NAMES = { "astro-seek": "Astro-Seek", "astro-com": "astro.com" };

const SCREENSHOT_WARNING =
  "This chart was read from a screenshot by OCR on the device that made this link. Compare these rows with the chart before opening it: nothing checked the latitude.";

const DAMAGED = "This link's chart isn't valid. Copy the whole link again.";
const NEWER = "This chart was made by a newer version of Chart Bridge, which this page can't read.";

// Each refusal from fromFragment. Every one keeps its code on screen, like the
// popup's unreadable pages, so a bug report says which check failed.
const REFUSALS = {
  malformed: "This link is incomplete or damaged. Copy the whole link again.",
  "too-large": "This link is too long to be a Chart Bridge chart.",
  "not-chart-bridge": "This link doesn't hold a Chart Bridge chart.",
  "unsupported-version": NEWER,
  "unknown-field": NEWER,
  "unsupported-calendar": NEWER,
  "before-gregorian": "This chart's date is before 15 October 1582, which Chart Bridge can't open yet.",
};

const EMPTY = {
  state: "empty",
  message: "Open a Chart Bridge link to see its chart here.",
};

/**
 * The chart in a page's fragment, or null when there is no fragment at all.
 *
 * @param {string} hash  location.hash
 * @returns {ReturnType<typeof fromFragment> | null}
 */
export function readLink(hash) {
  return hash === "" || hash === "#" ? null : fromFragment(hash);
}

/**
 * What the receiving page shows for readLink's result.
 *
 * @param {ReturnType<typeof readLink>} result
 * @param {{ timeZone?: string }} [options]  passed on to viewFor
 */
export function viewForImport(result, options) {
  if (result === null) return { ...EMPTY, notes: [], buttons: [] };
  if (result.kind === "refused") {
    return { state: "refused", message: REFUSALS[result.reason] ?? DAMAGED, code: result.reason };
  }

  const { chart, source } = result.chart;
  const offsetSeconds = chart.utcOffsetSeconds;
  // The analyzePage result the chart was decided from, as far as the link
  // tells it. With no site, viewFor adds neither site's extras.
  const view = viewFor(
    {
      kind: "natal",
      site: null,
      local: chart.local,
      zoneLabel: source.zoneLabel ?? null,
      lat: chart.latitude,
      lng: chart.longitude,
      utc: skyFor(result.chart).utc,
      utcSource: "declared",
      offsetMinutes: offsetSeconds / 60,
    },
    options,
  );

  const from = [SITE_NAMES[source.site] ?? source.site, source.via].filter(Boolean).join(" ");
  return {
    ...view,
    rows: from === "" ? view.rows : [...view.rows, ["From", from]],
    warnings: source.via === "screenshot" ? [SCREENSHOT_WARNING] : [],
    notes: [...view.notes, ...ASTRO_SEEK_NOTES],
    buttons: BUTTONS.map((button) => ({ ...button })),
  };
}

/**
 * The link to copy for a chart: this page's own address, without its query
 * or fragment, and the chart's fragment.
 *
 * @param {string} pageUrl  location.href
 * @param {object} chart  a portable chart
 * @returns {string}
 */
export function linkFor(pageUrl, chart) {
  const url = new URL(pageUrl);
  return `${url.origin}${url.pathname}#${toFragment(chart)}`;
}
