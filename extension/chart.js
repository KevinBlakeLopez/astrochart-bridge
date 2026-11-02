// The receiving page for an AstroChart Bridge link or chart file. It works without
// the extension: the chart is read from the link's fragment, which the browser
// never sends to the server, or from a file chosen or dropped here, and
// nothing is stored or sent until a button is clicked. Every decision is made
// in chart-model.js and drawn by view.js.
import {
  MAX_IMPORT_BYTES,
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
import { RECEIVER_URL } from "./share-config.js";
import { paragraph, render } from "./view.js";

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
const canImport = location.protocol.endsWith("-extension:");

// Whether the browser's share sheet takes a link. Firefox on the desktop has
// no share sheet, and neither has every embedded browser.
const canShare = base !== null && typeof navigator.share === "function" && (navigator.canShare?.({ url: base }) ?? true);

// The chart on screen, for the buttons, and its file when the share sheet
// takes it. Kept only in these variables.
let chart = null;
let shareableFile = null;

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
  if (result.kind === "portable") status.textContent = `Opened ${file.name}.`;
}

// file is the one result was read from, which a Morinus or AAF file's
// button sends on to the import page.
function show(result, from, file = null) {
  chart = result?.kind === "portable" ? result.chart : null;
  shareableFile = chart === null ? null : fileForSharing(chart);
  status.textContent = "";
  linkField.hidden = true;
  linkField.value = "";
  hideQr();
  // The main action while there is no chart; one among several once there is.
  openFileButton.className = chart === null ? "" : "secondary";
  const options = { canCopy: base !== null, canShare, canShareFiles: shareableFile !== null, canImport, from };
  const view = viewForImport(result, options);
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
    else status.textContent = "AstroChart Bridge couldn't pass the file on. Click Open an AAF or Morinus file in the popup and choose it there.";
  });
  return button;
}

// The chart's file, when this browser's share sheet says it takes it. Asked
// of the real file, since browsers differ in the kinds of file they share.
function fileForSharing(chart) {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return null;
  const { name, text } = fileFor(chart);
  const file = new File([text], name, { type: "application/json" });
  try {
    return navigator.canShare({ files: [file] }) ? file : null;
  } catch {
    return null;
  }
}

// The click is the confirmation: the notes above the buttons say what each
// one sends where. Destinations open in a new tab with no opener or referrer.
async function onButton({ url, does }) {
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
    share(shareDataFor(base, chart));
    return;
  }
  if (does === "share-file") {
    share({ title: "AstroChart Bridge chart", files: [shareableFile] });
    return;
  }
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

// writeText is called before anything is awaited, so Safari still counts the
// click as the reason for it. A browser that refuses gets the link to select.
async function copyLink() {
  if (chart === null) return;
  const link = linkFor(base, chart);
  try {
    await navigator.clipboard.writeText(link);
    status.textContent = "Link copied.";
  } catch {
    status.textContent = "This browser didn't let AstroChart Bridge copy the link. Copy it from here instead:";
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
  const { name, text } = fileFor(chart);
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
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
function showQr() {
  if (chart === null || base === null) return;
  const view = qrViewFor(base, chart);
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
    hide.textContent = "Hide QR code";
    hide.addEventListener("click", hideQr);
    qrArea.replaceChildren(svg, paragraph(view.note, "note"), hide);
  }
  qrArea.hidden = false;
  qrArea.scrollIntoView({ block: "nearest" });
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
    status.textContent = "AstroChart Bridge couldn't open the share sheet. Use Copy link or Download file instead.";
  });
}
