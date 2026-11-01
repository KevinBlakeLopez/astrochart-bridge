// What the receiving page shows for a Chart Bridge link. It is the popup's
// ready screen, from viewFor, for a chart that arrived in a link rather than
// from a page: it can open in Stellarium Web and Astro-Seek, and be copied on.
// Every decision is made here, so import.js only reads the link and renders.
import { fromFragment, serialize, skyFor, toFragment } from "./core/portable.js";
import { ASTRO_SEEK_NOTES, ASTRO_SEEK_BUTTONS, viewFor } from "./popup-model.js";
import { qrFor } from "./qr.js";

// The receiving page works without the extension, so the popup's
// "Enter in astro.com…" step, which keeps the values for the tab it opens,
// isn't offered: nothing here could keep them.
const COPY_LINK = { label: "Copy link", does: "copy", secondary: true };
// The same link as Copy link, so it is offered only with it.
const SHOW_QR = { label: "Show QR code", does: "qr", secondary: true };
const DOWNLOAD_FILE = { label: "Download file", does: "download", secondary: true };

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
 * @param {{ timeZone?: string, canCopy?: boolean }} [options]  timeZone is
 *   passed on to viewFor; canCopy is false when linkBase has nowhere to point
 */
export function viewForImport(result, { canCopy = true, ...options } = {}) {
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
    buttons: [...ASTRO_SEEK_BUTTONS, ...(canCopy ? [COPY_LINK, SHOW_QR] : []), DOWNLOAD_FILE].map((button) => ({ ...button })),
  };
}

/**
 * The address a copied link starts with. On the web, the page links to
 * itself; the extension's copy of the page links to the receiving page on the
 * web, since its own address opens only in this browser. null when the
 * extension has no receiving page configured.
 *
 * @param {string} pageUrl  location.href
 * @param {string | null} receiverUrl  share-config.js's RECEIVER_URL
 * @returns {string | null}
 */
export function linkBase(pageUrl, receiverUrl) {
  const { protocol } = new URL(pageUrl);
  return protocol === "https:" || protocol === "http:" ? pageUrl : receiverUrl;
}

/**
 * The link to copy for a chart: an address from linkBase, without its query
 * or fragment, and the chart's fragment.
 *
 * @param {string} pageUrl  linkBase's address
 * @param {object} chart  a portable chart
 * @returns {string}
 */
export function linkFor(pageUrl, chart) {
  const url = new URL(pageUrl);
  return `${url.origin}${url.pathname}#${toFragment(chart)}`;
}

/**
 * The .astrochart.json file for a chart: the link's JSON, indented to be read,
 * named for the local birth date so several can be told apart.
 *
 * @param {object} chart  a portable chart
 * @returns {{ name: string, text: string }}
 */
export function fileFor(chart) {
  return { name: `chart-${chart.chart.local.slice(0, 10)}.astrochart.json`, text: `${serialize(chart, 2)}\n` };
}

/**
 * What the page draws for Show QR code: the copied link's code, or why there
 * is none.
 *
 * @param {string} base  linkBase's address
 * @param {object} chart  a portable chart
 */
export function qrViewFor(base, chart) {
  const link = linkFor(base, chart);
  const qr = qrFor(link);
  if (qr.kind === "refused") {
    return {
      state: "qr-refused",
      message: "This link is too long for a QR code that scans reliably. Use Copy link or Download file instead.",
    };
  }
  return {
    state: "qr",
    link,
    size: qr.size,
    path: qr.path,
    label: "QR code for the link to this chart",
    note: "Scan this with a phone or tablet's camera to open the chart there. Anyone who can see the code can read the chart.",
  };
}
