// The receiving page for an AstroChart Bridge link or chart file. It works without
// the extension: the chart is read from the link's fragment, which the browser
// never sends to the server, or from a file chosen or dropped here, and
// nothing is stored or sent until a button is clicked. Every decision is made
// in chart-model.js and drawn by view.js.
import {
  MAX_IMPORT_BYTES,
  chartToPassOn,
  fileFor,
  keepFileForImport,
  linkBase,
  linkFor,
  qrViewFor,
  readChartFile,
  readLink,
  shareDataFor,
  viewForImport,
} from "./chart-model.js";
import { isExtensionCopy } from "./extension-copy.js";
import { RECEIVER_URL } from "./share-config.js";
import { localizePage, text } from "./messages/index.js";
import { paragraph, render } from "./view.js";
import { openPage, showHomeLink } from "./web-page.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

// The way back to the home page, on the web.
showHomeLink(document, location.href);

const app = document.getElementById("app");
const status = document.getElementById("status");
const linkField = document.getElementById("link");
const qrArea = document.getElementById("qr");
const openFileButton = document.getElementById("open-file");
const fileInput = document.getElementById("file");

// Where a copied link points: this page on the web, the receiving page when
// this is the extension's copy, or nowhere, which hides Copy link.
const base = linkBase(location.href, RECEIVER_URL);

// The extension's copy has the import page, for Morinus and AAF files, next to it.
const canImport = isExtensionCopy(location.href);

// The extension's copy can also fill in astro.com's form, with the code the
// extension's other pages use, which the web's copy doesn't publish. It is
// loaded now, not on the click, so the click asks for access to www.astro.com
// at once: a browser grants it only while the click is still being handled.
const canFill = canImport;
let fillAstroCom = null;
if (canFill) import("./astro-com-page.js").then(({ openLink }) => (fillAstroCom = openLink));

// Whether the browser's share sheet takes a link. Firefox on the desktop has
// no share sheet, and neither has every embedded browser.
const canShare = base !== null && typeof navigator.share === "function" && (navigator.canShare?.({ url: base }) ?? true);

// Which of a chart's name and town its link, QR code and file carry. The
// extension's copy remembers the choice in the extension's storage on this
// computer, with code the web's copy doesn't publish; the web's copy keeps
// nothing, so there both start unticked.
const remembered = canImport ? chrome.storage.local : null;
const preference = remembered && (await import("./preference.js"));
let include = { name: false, town: false };
if (preference) include = await preference.shareIncludes(remembered).catch(() => include);

// The chart on screen, for the buttons, and its file when the share sheet
// takes it. Kept only in these variables.
let chart = null;
let shareableFile = null;
// The view drawn for it, which Cancel on Enter in astro.com… draws again.
let shownView = null;

// The chart as the share buttons pass it on, with only the labels ticked.
const passedOn = () => chartToPassOn(chart, include);

// Counts the links and files read, so a slow file read that finishes after a
// newer link or file is dropped.
let latest = 0;

showLink();
// A link pasted into this tab's address bar changes only the fragment, which
// doesn't reload the page.
window.addEventListener("hashchange", showLink);

openFileButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const [file] = fileInput.files;
  // Cleared so choosing the same file again reads it again.
  fileInput.value = "";
  openFile(file);
});
// A file dropped anywhere on the page opens, instead of the browser leaving
// the page to show it.
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
  event.preventDefault();
  openFile(event.dataTransfer?.files[0]);
});

function showLink() {
  latest++;
  const result = readLink(location.hash);
  // The chart comes out of the address and this history entry as soon as it
  // is read, whether or not it was valid: a damaged link can still be read.
  // replaceState doesn't fire hashchange.
  if (location.hash !== "") history.replaceState(null, "", `${location.pathname}${location.search}`);
  show(result, "link");
}

// A file never touches the address, so it never reaches the browser's history.
async function openFile(file) {
  if (!file) return;
  const id = ++latest;
  // Read up to the import page's limit, to tell a Morinus or AAF file;
  // readChartFile refuses a chart file past its own.
  const bytes = file.size > MAX_IMPORT_BYTES ? null : new Uint8Array(await file.arrayBuffer());
  const result = bytes === null ? { kind: "refused", reason: "too-large" } : readChartFile(bytes, file.name);
  if (id !== latest) return;
  show(result, "file", bytes && { name: file.name, bytes });
  if (result.kind === "portable") status.textContent = text().pages.chart.opened(file.name);
}

// file is the one result was read from, which a Morinus or AAF file's
// button sends on to the import page.
function show(result, from, file = null) {
  chart = result?.kind === "portable" ? result.chart : null;
  shareableFile = chart === null ? null : fileForSharing(passedOn());
  status.textContent = "";
  linkField.hidden = true;
  linkField.value = "";
  hideQr();
  // The main action while there is no chart; one among several once there is.
  openFileButton.className = chart === null ? "" : "secondary";
  const options = {
    canCopy: base !== null,
    canShare,
    canShareFiles: shareableFile !== null,
    canImport,
    canFill,
    from,
    include,
    remembers: preference !== null,
  };
  const view = viewForImport(result, options);
  shownView = view;
  render(app, view, onButton);
  if (view.importButton && file) app.append(importButton(view.importButton, file));
}

// Goes to the import page in this tab, with the file kept for it there.
function importButton(label, { name, bytes }) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => {
    let kept = false;
    try {
      kept = keepFileForImport(sessionStorage, name, bytes);
    } catch {
      kept = false;
    }
    if (kept) location.assign("import.html");
    else status.textContent = text().pages.chart.couldntPass;
  });
  return button;
}

// The chart's file, when this browser's share sheet says it takes it. Asked
// of the real file, since browsers differ in the kinds of file they share.
function fileForSharing(chart) {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return null;
  const { name, text: contents } = fileFor(chart);
  const file = new File([contents], name, { type: "application/json" });
  try {
    return navigator.canShare({ files: [file] }) ? file : null;
  } catch {
    return null;
  }
}

// The click is the confirmation: the notes above the buttons say what each
// one sends where. Destinations open in a new tab with no opener or referrer.
async function onButton(button) {
  const { url, does } = button;
  // astro.com's form button, in the extension's copy: it fills in the form.
  if (button.fills && fillAstroCom) return fillAstroCom(app, button);
  if (does === "include") {
    await setInclude(button.field, button.checked);
    return;
  }
  if (does === "copy") {
    await copyLink();
    return;
  }
  if (does === "download") {
    download();
    return;
  }
  if (does === "qr") {
    showQr();
    return;
  }
  if (does === "share-link") {
    share(shareDataFor(base, passedOn()));
    return;
  }
  if (does === "share-file") {
    share({ title: text().chart.shareTitle, files: [shareableFile] });
    return;
  }
  // Helioscope's page beside this one, in either copy, with the chart in its
  // link but not its name or town. Opened before anything is awaited, so
  // Safari still counts the click.
  if (does === "helioscope") {
    if (chart !== null) openPage("helioscope.html", chartToPassOn(chart, {}), location.href);
    return;
  }
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

// A box ticked or cleared. The buttons pass the chart on with the new choice
// from now on, and a link or QR code already on screen is made again to match.
async function setInclude(field, checked) {
  include = { ...include, [field]: checked };
  // The drawn view's boxes follow, so drawing it again, as Cancel on Enter in
  // astro.com… does, shows them as they are, not as they were.
  for (const box of shownView?.includes?.boxes ?? []) box.checked = include[box.field] === true;
  status.textContent = "";
  if (chart === null) return;
  shareableFile = fileForSharing(passedOn());
  if (!linkField.hidden) linkField.value = linkFor(base, passedOn());
  if (!qrArea.hidden) showQr({ scroll: false });
  if (preference) await preference.setShareIncludes(remembered, include).catch(() => {});
}

// writeText is called before anything is awaited, so Safari still counts the
// click as the reason for it. A browser that refuses gets the link to select.
async function copyLink() {
  if (chart === null) return;
  const link = linkFor(base, passedOn());
  try {
    await navigator.clipboard.writeText(link);
    status.textContent = text().pages.chart.linkCopied;
  } catch {
    status.textContent = text().pages.chart.copyRefused;
    linkField.value = link;
    linkField.hidden = false;
    linkField.select();
  }
}

// The file is made here, from the chart on screen, and saved by the browser
// like any download. Its address is let go after a wait rather than at once,
// in case a browser starts saving only after the click has returned.
function download() {
  if (chart === null) return;
  const { name, text: contents } = fileFor(passedOn());
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const SVG = "http://www.w3.org/2000/svg";

// The code is built element by element, with no markup parsed and no image
// loaded, so the page's policy needs nothing more. It is always black on
// white, even in dark mode: many scanners can't read a light code on dark.
// Made again in place when a box changes what the link carries.
function showQr({ scroll = true } = {}) {
  if (chart === null || base === null) return;
  const view = qrViewFor(base, passedOn());
  if (view.state === "qr-refused") {
    qrArea.replaceChildren(paragraph(view.message, "warning"));
  } else {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", `0 0 ${view.size} ${view.size}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", view.label);
    svg.setAttribute("shape-rendering", "crispEdges");
    const background = document.createElementNS(SVG, "rect");
    background.setAttribute("width", String(view.size));
    background.setAttribute("height", String(view.size));
    background.setAttribute("fill", "#fff");
    const modules = document.createElementNS(SVG, "path");
    modules.setAttribute("d", view.path);
    modules.setAttribute("fill", "#000");
    svg.append(background, modules);

    const hide = document.createElement("button");
    hide.className = "secondary";
    hide.textContent = text().pages.chart.hideQr;
    hide.addEventListener("click", hideQr);
    qrArea.replaceChildren(svg, paragraph(view.note, "note"), hide);
  }
  qrArea.hidden = false;
  if (scroll) qrArea.scrollIntoView({ block: "nearest" });
}

function hideQr() {
  qrArea.hidden = true;
  qrArea.replaceChildren();
}

// Called straight from the click, with nothing awaited first, so the browser
// counts the click as the reason for the share sheet. Closing the sheet
// without sharing is no error.
function share(data) {
  navigator.share(data).catch((error) => {
    if (error?.name === "AbortError") return;
    status.textContent = text().pages.chart.shareSheetFailed;
  });
}
