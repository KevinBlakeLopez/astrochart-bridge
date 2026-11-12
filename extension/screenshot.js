// The screenshot page. Reads a pasted, dropped or chosen screenshot of an
// Astro-Seek chart page, an astro.com chart image or a desktop astrology
// program's chart with Tesseract.js, on this computer, and shows
// the popup's screens for it. Every decision about the chart is made in core/
// and screenshot-model.js; this file handles the image and the page.
import Tesseract from "./vendor/tesseract/tesseract.esm.min.js";
import { analyzeScreenshot } from "./core/index.js";
import { linkFor } from "./chart-model.js";
import { isExtensionCopy } from "./extension-copy.js";
import { chartToShare, viewForHelioscopeRefusal, viewForParansRefusal, viewForShareRefusal } from "./popup-model.js";
import { viewForScreenshot } from "./screenshot-model.js";
import { localizePage, text } from "./messages/index.js";
import { paragraph, render } from "./view.js";
import { openPage, openLink as openWebLink, showHomeLink } from "./web-page.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

// The way back to the home page, on the web.
showHomeLink(document, location.href);

// The extension's copy fills in astro.com's and Astro-Seek's forms and sends
// to Stellarium Desktop; the web's copy can't, and the site doesn't publish
// that code. Loaded now, not on a click, so a click that asks for access to a
// site still counts as the user's.
const onTheWeb = !isExtensionCopy(location.href);
const extensionLinks = onTheWeb ? null : await import("./astro-com-page.js");
const desktop = onTheWeb ? null : await import("./desktop-page.js");

// Every file Tesseract.js loads comes from this page's own copy, the
// extension's or the site's, never a CDN.
const VENDOR = new URL("vendor/tesseract/", import.meta.url).href;

// OCR lost whole lines of a half-size screenshot (723 px wide). Scaled up on
// this canvas, it read every value at 3x and 4x but garbled the zone label at
// 2x, so narrower images are scaled up 3x before they are read. A 1344 px
// screenshot of an astro.com chart image lost the "n" of its latitude unless
// scaled up 2x; a full-size Astro-Seek screenshot (1446 px) read the same
// either way, so images up to 2000 px are scaled up 2x.
const SCALES = [
  { below: 1200, scale: 3 },
  { below: 2000, scale: 2 },
];

const app = document.getElementById("app");
const fileInput = document.getElementById("file");
const readDetails = document.getElementById("read");
const readText = document.getElementById("read-text");

// Created on the first screenshot and kept for the next. A failed start is
// forgotten, so the next screenshot tries again.
let worker = null;
const getWorker = () =>
  (worker ??= Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
    workerPath: `${VENDOR}worker.min.js`,
    corePath: `${VENDOR}tesseract-core-simd-lstm.wasm.js`,
    langPath: VENDOR,
    // Start the worker from its file; a blob: worker would need a looser script policy.
    workerBlobURL: false,
    // The language data comes with the page, the extension's or the site's, so
    // Tesseract.js has nothing to cache.
    cacheMethod: "none",
  }).catch((error) => {
    worker = null;
    throw error;
  }));

document.addEventListener("paste", (event) => readImage(imageIn(event.clipboardData)));
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
  event.preventDefault();
  readImage(imageIn(event.dataTransfer));
});
fileInput.addEventListener("change", () => readImage(fileInput.files[0] ?? null));

function imageIn(transfer) {
  return [...(transfer?.files ?? [])].find((file) => file.type.startsWith("image/")) ?? null;
}

// Counts reads, so a slow one finishing after a newer screenshot arrived is dropped.
let latest = 0;

async function readImage(file) {
  if (!file) return;
  const id = ++latest;
  readDetails.hidden = true;
  app.replaceChildren(paragraph(text().pages.screenshot.reading, "note"));
  try {
    const recognized = await recognize(file);
    if (id !== latest) return;
    readText.textContent = recognized;
    readDetails.hidden = false;
    showChart(analyzeScreenshot(recognized));
  } catch (error) {
    if (id !== latest) return;
    const view = { state: "refused", message: text().pages.screenshot.unreadable, code: String(error?.message ?? error) };
    render(app, view, openLink);
  }
}

async function recognize(file) {
  const bitmap = await createImageBitmap(file);
  const scale = SCALES.find(({ below }) => bitmap.width < below)?.scale ?? 1;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const { data } = await (await getWorker()).recognize(canvas);
  return data.text;
}

// As in the popup: Send to Stellarium Desktop; Share…, which opens the
// receiving page in a tab with the chart in its link; and Which planets were
// visible and Parans, which open Helioscope's page and the parans page the
// same way, without the chart's name or town. A chart the format can't carry
// says why, with Cancel back to the chart.
function showChart(result) {
  const view = viewForScreenshot(result, { onTheWeb });
  const pages = {
    share: { page: "chart.html", labels: { town: result.town, name: result.name }, refusal: viewForShareRefusal },
    helioscope: { page: "helioscope.html", labels: {}, refusal: viewForHelioscopeRefusal },
    parans: { page: "parans.html", labels: {}, refusal: viewForParansRefusal },
  };
  const onButton = async (button, sky, screen) => {
    if (!Object.hasOwn(pages, button.does)) return openLink(button, sky);
    const { page, labels, refusal } = pages[button.does];
    const shared = chartToShare(result, sky, "screenshot", labels);
    if (shared.kind === "refused") {
      // renderChart passes its screen; the plain render below, without the
      // desktop button, doesn't, and then this page's own are the way back.
      render(app, refusal(shared.reason), screen?.onButton ?? onButton, screen?.view ?? view);
      return;
    }
    if (onTheWeb) openPage(page, shared.chart, location.href);
    else await chrome.tabs.create({ url: linkFor(chrome.runtime.getURL(page), shared.chart) });
  };
  // With Send to Stellarium Desktop in the extension, as in the popup;
  // without it on the web, or should Stellarium's side fail.
  if (desktop) desktop.renderChart(app, view, onButton).catch(() => render(app, view, onButton));
  else render(app, view, onButton);
}

// Links, the astro.com buttons and Save in Astro-Seek…, as on the paste page.
const openLink = (button, sky) => (extensionLinks?.openLink ?? openWebLink)(app, button, sky);
