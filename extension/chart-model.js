// What the receiving page shows for an AstroChart Bridge link or chart file. It is
// the popup's ready screen, from viewFor, for a chart that arrived in a link
// or a file rather than from a page: it can open in Stellarium Web and
// Astro-Seek, be entered in astro.com, and be passed on. Every decision is made here, so chart.js only
// reads the link or file and renders.
import { fromFragment, keepLabels, parse, serialize, skyFor, toFragment } from "./core/portable.js";
import {
  astroComStep,
  astroComStepByHand,
  astroSeekButtons,
  astroSeekNotes,
  astroSeekWarnings,
  helioscopeButton,
  nameFromText,
  declinationsButton,
  paransButton,
  viewFor,
} from "./popup-model.js";
import { text } from "./messages/index.js";
import { qrFor } from "./qr.js";

// The page's own buttons. shares marks the buttons that pass the chart on,
// which carry its name and town only as the boxes above them say. Show QR
// code is the same link as Copy link, so it is offered only with it. The
// system share sheet's two are each offered only where the browser says it
// can share that thing: browsers differ, and some take links but not files.
function pageButtons() {
  const words = text().chart;
  const button = (label, does) => ({ label, does, secondary: true, shares: true });
  return {
    copyLink: button(words.copyLink, "copy"),
    showQr: button(words.showQr, "qr"),
    downloadFile: button(words.downloadFile, "download"),
    shareLink: button(words.shareLink, "share-link"),
    shareFile: button(words.shareFile, "share-file"),
  };
}

// The chart's labels, each a box that says whether it goes with the chart.
const LABEL_FIELDS = ["name", "town"];

const SITE_NAMES = { "astro-seek": "Astro-Seek", "astro-com": "astro.com" };

// source fields are any lower-case codes, so a lookup must not reach
// Object.prototype: a link with site "constructor" would print its source code.
const nameFor = (names, code) => (Object.hasOwn(names, code) ? names[code] : code);

// A chart file is under 1 KB; parse's own limit is 16,384 characters.
export const MAX_FILE_BYTES = 16_384;

// The largest file read to tell what it is, and kept for the import page: its
// own limit for a Morinus file, whose notes can be long.
export const MAX_IMPORT_BYTES = 256 * 1024;

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
 * A Morinus or AAF file is refused as what it is, so the page can point to
 * the one that opens it: told by its name, or by how it starts. A .hor from
 * Python 3 starts with pickle's PROTO byte; an AAF file has a line that
 * starts #A93:.
 *
 * @param {Uint8Array} bytes
 * @param {string} [name]  the file's name
 * @returns {ReturnType<typeof parse> | { kind: "refused", reason: "morinus-file" | "aaf-file" }}
 */
export function readChartFile(bytes, name = "") {
  if (/\.hor$/i.test(name) || bytes[0] === 0x80) return { kind: "refused", reason: "morinus-file" };
  const start = String.fromCharCode(...bytes.subarray(0, 4096));
  if (/\.aaf$/i.test(name) || /(?:^|[\r\n])#A93:/i.test(start)) return { kind: "refused", reason: "aaf-file" };
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
 * @param {{ timeZone?: string, canCopy?: boolean, canShare?: boolean, canShareFiles?: boolean, canImport?: boolean,
 *   canFill?: boolean, from?: "link" | "file", include?: { name?: boolean, town?: boolean }, remembers?: boolean }} [options]
 *   timeZone is passed on to viewFor; canCopy is false when linkBase has
 *   nowhere to point; canShare and canShareFiles say whether the browser's
 *   share sheet takes a link and this chart's file; canImport, that this is
 *   the extension's copy, with an import page; canFill, that it can fill in
 *   astro.com's form, as the extension's copy can; from words a refusal;
 *   include, which of the chart's name and town go with it when it is passed
 *   on; remembers, that the page keeps that choice, as the extension's copy does
 */
export function viewForImport(
  result,
  {
    canCopy = true,
    canShare = false,
    canShareFiles = false,
    canImport = false,
    canFill = false,
    from = "link",
    include = {},
    remembers = false,
    ...options
  } = {},
) {
  const words = text().chart;
  if (result === null) return { state: "empty", message: words.empty, notes: [], buttons: [] };
  // importButton is drawn by the page: a view's own buttons wait for a sky.
  if (result.kind === "refused" && Object.hasOwn(words.otherFiles, result.reason)) {
    const message = `${words.otherFiles[result.reason]} ${canImport ? words.inExtension : words.onTheWeb}`;
    return { state: "refused", message, code: result.reason, ...(canImport ? { importButton: words.openItThere } : {}) };
  }
  // Every refusal keeps its code on screen, like the popup's unreadable
  // pages, so a bug report says which check failed.
  if (result.kind === "refused") {
    const refusals = words.refusals[from];
    return {
      state: "refused",
      message: Object.hasOwn(refusals, result.reason) ? refusals[result.reason] : words.damaged[from],
      code: result.reason,
    };
  }

  const { chart, source, labels = {} } = result.chart;
  const view = viewFor(natalChartFor(result.chart), options);

  // Where the chart was first read, not how it travelled here.
  const origin = words.origin(nameFor(SITE_NAMES, source.site), nameFor(words.viaNames, source.via));
  const rows = labelRows(origin === "" ? view.rows : [...view.rows, [words.from, origin]], labels);
  const rowLabels = text().popup.rows;
  const boxes = LABEL_FIELDS.filter((field) => Object.hasOwn(labels, field)).map((field) => ({
    field,
    label: `${rowLabels[field]}: ${labels[field]}`,
    checked: include[field] === true,
  }));
  const includes = boxes.length === 0 ? {} : { includes: { legend: words.includesLegend, boxes } };
  const includesNotes = boxes.length === 0 ? [] : [words.includesNote, ...(remembers ? [words.remembersNote] : [])];
  const shareLink = canCopy && canShare;
  const own = pageButtons();
  // Which planets were visible, Parans and Declinations, as on the other chart screens: they
  // go under See the sky, and their links never carry the name or town,
  // whatever the boxes say, since they don't pass the chart on.
  const buttons = [
    ...astroSeekButtons(),
    helioscopeButton(),
    paransButton(),
    declinationsButton(),
    ...(shareLink ? [own.shareLink] : []),
    ...(canCopy ? [own.copyLink, own.showQr] : []),
    own.downloadFile,
    ...(canShareFiles ? [own.shareFile] : []),
  ];
  // Enter in astro.com… fills in astro.com's form where the page can, as the
  // extension's copy can; on the web, it leads to the values to type in. The
  // chart's name and town go to the form whether or not their boxes are
  // ticked: the boxes say only what the chart takes with it when passed on.
  // The name arrives in one piece, so all of it is astro.com's first name.
  const step = canFill ? astroComStep : astroComStepByHand;
  const named = { local: chart.local, town: labels.town ?? null, name: nameFromText(labels.name) };
  return {
    ...view,
    rows,
    warnings: [
      ...(Object.hasOwn(words.viaWarnings, source.via) ? [words.viaWarnings[source.via]] : []),
      ...astroSeekWarnings(chart.longitude),
    ],
    notes: [...view.notes, ...astroSeekNotes(), ...(shareLink || canShareFiles ? [words.shareNote] : []), ...includesNotes],
    buttons,
    ...includes,
    next: step(view.sky, named),
  };
}

/**
 * The analyzePage result a portable chart was decided from, as far as the
 * chart tells it: natal, with its UTC worked out from its local time and
 * offset, and no site, so viewFor adds neither site's extras. The receiving
 * page and Helioscope's page both read their link this way.
 *
 * @param {object} portable  a portable chart, from fromFragment or parse
 * @returns {object}  a normalized chart, as analyzePage gives it
 */
export function natalChartFor(portable) {
  const { chart, source } = portable;
  return {
    kind: "natal",
    site: null,
    local: chart.local,
    zoneLabel: source.zoneLabel ?? null,
    lat: chart.latitude,
    lng: chart.longitude,
    utc: skyFor(portable).utc,
    utcSource: "declared",
    offsetMinutes: chart.utcOffsetSeconds / 60,
  };
}

// The rows with Name first and Town after Place, as the screenshot page has them.
function labelRows(rows, { name, town }) {
  const labels = text().popup.rows;
  const at = rows.findIndex(([label]) => label === labels.place) + 1 || rows.length;
  const nameRow = name ? [[labels.name, name]] : [];
  const townRow = town ? [[labels.town, town]] : [];
  return [...nameRow, ...rows.slice(0, at), ...townRow, ...rows.slice(at)];
}

/**
 * The chart as the share buttons pass it on: with only the labels ticked.
 *
 * @param {object} chart  a portable chart
 * @param {{ name?: boolean, town?: boolean }} include
 * @returns {object}
 */
export const chartToPassOn = (chart, include) => keepLabels(chart, include);

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
  const words = text().chart;
  const link = linkFor(base, chart);
  const qr = qrFor(link);
  // A long name or town can be what makes it too long.
  if (qr.kind === "refused") return { state: "qr-refused", message: words.qrTooLong(Boolean(chart.labels)) };
  return { state: "qr", link, size: qr.size, path: qr.path, label: words.qrLabel, note: words.qrNote };
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
  return { title: text().chart.shareTitle, url: linkFor(base, chart) };
}

// The file kept between the receiving page and the import page, in the tab's
// own sessionStorage, which goes with the tab when the page changes and goes
// away when it closes. The import page takes it out as soon as it reads it.
const IMPORT_KEY = "astrochart-bridge:file-for-import";

/**
 * Keeps a chosen or dropped file for the import page this tab goes to next.
 * false when it is too big or the storage refuses it, as in a private window.
 *
 * @param {Pick<Storage, "setItem">} storage  sessionStorage
 * @param {string} name
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
export function keepFileForImport(storage, name, bytes) {
  if (bytes.length > MAX_IMPORT_BYTES) return false;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  try {
    storage.setItem(IMPORT_KEY, JSON.stringify({ name, base64: btoa(binary) }));
    return true;
  } catch {
    return false;
  }
}

/**
 * The file keepFileForImport kept, taken out of storage so it is read once,
 * or null when there is none, or what is there isn't one.
 *
 * @param {Pick<Storage, "getItem" | "removeItem">} storage  sessionStorage
 * @returns {{ name: string, bytes: Uint8Array } | null}
 */
export function takeFileForImport(storage) {
  let text;
  try {
    text = storage.getItem(IMPORT_KEY);
    storage.removeItem(IMPORT_KEY);
  } catch {
    return null;
  }
  if (text === null) return null;
  try {
    const { name, base64 } = JSON.parse(text);
    if (typeof name !== "string" || typeof base64 !== "string") return null;
    return { name, bytes: Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)) };
  } catch {
    return null;
  }
}
