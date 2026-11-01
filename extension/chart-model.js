// What the receiving page shows for an AstroChart Bridge link or chart file. It is
// the popup's ready screen, from viewFor, for a chart that arrived in a link
// or a file rather than from a page: it can open in Stellarium Web and
// Astro-Seek, and be passed on. Every decision is made here, so chart.js only
// reads the link or file and renders.
import { fromFragment, parse, serialize, skyFor, toFragment } from "./core/portable.js";
import { ASTRO_SEEK_NOTES, ASTRO_SEEK_BUTTONS, viewFor } from "./popup-model.js";
import { qrFor } from "./qr.js";

// The receiving page works without the extension, so the popup's
// "Enter in astro.com…" step, which keeps the values for the tab it opens,
// isn't offered: nothing here could keep them.
const COPY_LINK = { label: "Copy link", does: "copy", secondary: true };
// The same link as Copy link, so it is offered only with it.
const SHOW_QR = { label: "Show QR code", does: "qr", secondary: true };
const DOWNLOAD_FILE = { label: "Download file", does: "download", secondary: true };
// The system share sheet, each only where the browser says it can share that
// thing: browsers differ, and some take links but not files.
const SHARE_LINK = { label: "Share link…", does: "share-link", secondary: true };
const SHARE_FILE = { label: "Share file…", does: "share-file", secondary: true };
const SHARE_NOTE = "Share link… and Share file… send the chart to the app you choose.";

const SITE_NAMES = { "astro-seek": "Astro-Seek", "astro-com": "astro.com" };

const SCREENSHOT_WARNING =
  "This chart was read from a screenshot by OCR on the device that shared it. Compare these rows with the chart before opening it: nothing checked the latitude.";

// How a chart reached the device that shared it, where the code alone doesn't say it in words.
const VIA_NAMES = { paste: "pasted text" };

const VIA_WARNINGS = {
  screenshot: SCREENSHOT_WARNING,
  paste:
    "This chart was read from pasted text and checked by hand on the device that shared it. Nothing checked its UTC offset against the birthplace and date.",
};

// source fields are any lower-case codes, so a lookup must not reach
// Object.prototype: a link with site "constructor" would print its source code.
const nameFor = (names, code) => (Object.hasOwn(names, code) ? names[code] : code);

const NEWER = "This chart was made by a newer version of AstroChart Bridge, which this page can't read.";
const NEWER_FILE = "This file was made by a newer version of AstroChart Bridge, which this page can't read.";
const BEFORE_GREGORIAN = "This chart's date is before 15 October 1582, which AstroChart Bridge can't open yet.";

// Each refusal from fromFragment or readChartFile, worded for where the chart
// came from. Every one keeps its code on screen, like the popup's unreadable
// pages, so a bug report says which check failed.
const REFUSALS = {
  link: {
    malformed: "This link is incomplete or damaged. Copy the whole link again.",
    "too-large": "This link is too long to be an AstroChart Bridge chart.",
    "not-chart-bridge": "This link doesn't hold an AstroChart Bridge chart.",
    "unsupported-version": NEWER,
    "unknown-field": NEWER,
    "unsupported-calendar": NEWER,
    "before-gregorian": BEFORE_GREGORIAN,
  },
  file: {
    malformed: "This file isn't an AstroChart Bridge chart, or it is damaged.",
    "too-large": "This file is too large to be an AstroChart Bridge chart.",
    "not-chart-bridge": "This file isn't an AstroChart Bridge chart.",
    "unsupported-version": NEWER_FILE,
    "unknown-field": NEWER_FILE,
    "unsupported-calendar": NEWER_FILE,
    "before-gregorian": BEFORE_GREGORIAN,
  },
};
const DAMAGED = {
  link: "This link's chart isn't valid. Copy the whole link again.",
  file: "This file's chart isn't valid.",
};

const EMPTY = {
  state: "empty",
  message: "Open an AstroChart Bridge link or chart file to see its chart here.",
};

// A chart file is under 1 KB; parse's own limit is 16,384 characters.
export const MAX_FILE_BYTES = 16_384;

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
 * The chart in a .astrochart.json file's bytes. Only UTF-8 is read, and bytes
 * that aren't are refused rather than replaced; a byte-order mark is dropped.
 *
 * @param {Uint8Array} bytes
 * @returns {ReturnType<typeof parse>}
 */
export function readChartFile(bytes) {
  if (bytes.length > MAX_FILE_BYTES) return { kind: "refused", reason: "too-large" };
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { kind: "refused", reason: "malformed" };
  }
  return parse(text);
}

/**
 * What the receiving page shows for readLink's or readChartFile's result.
 *
 * @param {ReturnType<typeof readLink>} result
 * @param {{ timeZone?: string, canCopy?: boolean, canShare?: boolean, canShareFiles?: boolean, from?: "link" | "file" }} [options]
 *   timeZone is passed on to viewFor; canCopy is false when linkBase has
 *   nowhere to point; canShare and canShareFiles say whether the browser's
 *   share sheet takes a link and this chart's file; from words a refusal
 */
export function viewForImport(result, { canCopy = true, canShare = false, canShareFiles = false, from = "link", ...options } = {}) {
  if (result === null) return { ...EMPTY, notes: [], buttons: [] };
  if (result.kind === "refused") {
    return { state: "refused", message: REFUSALS[from][result.reason] ?? DAMAGED[from], code: result.reason };
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

  // Where the chart was first read, not how it travelled here.
  const origin = [nameFor(SITE_NAMES, source.site), nameFor(VIA_NAMES, source.via)].filter(Boolean).join(" ");
  const shareLink = canCopy && canShare;
  const buttons = [
    ...ASTRO_SEEK_BUTTONS,
    ...(shareLink ? [SHARE_LINK] : []),
    ...(canCopy ? [COPY_LINK, SHOW_QR] : []),
    DOWNLOAD_FILE,
    ...(canShareFiles ? [SHARE_FILE] : []),
  ];
  return {
    ...view,
    rows: origin === "" ? view.rows : [...view.rows, ["From", origin]],
    warnings: Object.hasOwn(VIA_WARNINGS, source.via) ? [VIA_WARNINGS[source.via]] : [],
    notes: [...view.notes, ...ASTRO_SEEK_NOTES, ...(shareLink || canShareFiles ? [SHARE_NOTE] : [])],
    buttons: buttons.map((button) => ({ ...button })),
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

/**
 * What Share link… gives the share sheet: the copied link, under a title with
 * no birth data in it.
 *
 * @param {string} base  linkBase's address
 * @param {object} chart  a portable chart
 * @returns {{ title: string, url: string }}
 */
export function shareDataFor(base, chart) {
  return { title: "AstroChart Bridge chart", url: linkFor(base, chart) };
}
