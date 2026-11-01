// The screenshot page. Reads a pasted, dropped or chosen screenshot of an
// Astro-Seek chart page, an astro.com chart image or a desktop astrology
// program's chart with Tesseract.js, on this computer, and shows
// the popup's screens for it. Every decision about the chart is made in core/
// and screenshot-model.js; this file handles the image and the page.
import Tesseract from "./vendor/tesseract/tesseract.esm.min.js";
import { openLink as openPageLink } from "./astro-com-page.js";
import { analyzeScreenshot } from "./core/index.js";
import { linkFor } from "./chart-model.js";
import { chartToShare, viewForShareRefusal } from "./popup-model.js";
import { viewForScreenshot } from "./screenshot-model.js";
import { paragraph, render } from "./view.js";

// Every file Tesseract.js loads comes from the extension, never a CDN.
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
    // The language data is already in the extension, so there's nothing to cache.
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
  app.replaceChildren(paragraph("Reading the screenshot…", "note"));
  try {
    const text = await recognize(file);
    if (id !== latest) return;
    readText.textContent = text;
    readDetails.hidden = false;
    showChart(analyzeScreenshot(text));
  } catch (error) {
    if (id !== latest) return;
    const view = { state: "refused", message: "AstroChart Bridge couldn't read this image.", code: String(error?.message ?? error) };
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

// As in the popup: Share… opens the receiving page in a tab with the chart in
// its link, and a chart the format can't carry says why.
function showChart(result) {
  const view = viewForScreenshot(result);
  const onButton = async (button, sky) => {
    if (button.does !== "share") return openLink(button);
    const shared = chartToShare(result, sky, "screenshot");
    if (shared.kind === "refused") {
      render(app, viewForShareRefusal(shared.reason), onButton, view);
      return;
    }
    await chrome.tabs.create({ url: linkFor(chrome.runtime.getURL("chart.html"), shared.chart) });
  };
  render(app, view, onButton);
}

// Links, and the astro.com buttons, as on the paste page.
const openLink = (button) => openPageLink(app, button);
