// The import page. Reads a chosen, dropped or pasted AAF file, or a chosen or
// dropped Morinus .hor file, on this computer, lists its charts and shows the
// popup's screen for the one chosen. Every decision about a chart is made in
// core/aaf.js and aaf-model.js, or core/morinus-hor.js and hor-model.js; this
// file handles the file and the page. Text from the file is only ever
// inserted with textContent.
import { decodeAafFile, viewForAafText } from "./aaf-model.js";
import { linkFor, takeFileForImport } from "./chart-model.js";
import { isHorFile } from "./core/morinus-hor.js";
import { isExtensionCopy } from "./extension-copy.js";
import { viewForHorFile } from "./hor-model.js";
import { localizePage } from "./messages/index.js";
import { chartToShare, viewForHelioscopeRefusal } from "./popup-model.js";
import { paragraph, render } from "./view.js";
import { openPage, openLink as openWebLink } from "./web-page.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

// The extension's copy fills in astro.com's and Astro-Seek's forms and sends
// to Stellarium Desktop; the web's copy can't, and the site doesn't publish
// that code. Loaded now, not on a click, so a click that asks for access to a
// site still counts as the user's.
const onTheWeb = !isExtensionCopy(location.href);
const extensionLinks = onTheWeb ? null : await import("./astro-com-page.js");
const desktop = onTheWeb ? null : await import("./desktop-page.js");

const fileInput = document.getElementById("file");
const textInput = document.getElementById("text");
const list = document.getElementById("list");
const app = document.getElementById("app");

fileInput.addEventListener("change", () => readFile(fileInput.files[0] ?? null));
document.getElementById("read").addEventListener("click", () => show(viewForAafText(textInput.value, { onTheWeb })));
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
  event.preventDefault();
  readFile(event.dataTransfer?.files[0] ?? null);
});

async function readFile(file) {
  if (!file) return;
  readBytes(file.name, new Uint8Array(await file.arrayBuffer()));
}

function readBytes(name, bytes) {
  if (isHorFile(name, bytes)) {
    show(viewForHorFile(bytes, { onTheWeb }));
    return;
  }
  const { text, warning } = decodeAafFile(bytes);
  show(viewForAafText(text, { onTheWeb }), warning);
}

// A list from viewForAafText or viewForHorFile: one chart is shown at once,
// several as choices.
function show(view, warning) {
  const parts = [];
  if (warning) parts.push(paragraph(warning, "warning"));
  parts.push(paragraph(view.message));
  app.replaceChildren();

  if (view.items.length === 1) {
    showChart(view.items[0]);
  } else if (view.items.length > 1) {
    const choices = document.createElement("fieldset");
    for (const item of view.items) {
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "chart";
      input.addEventListener("change", () => showChart(item));
      const label = document.createElement("label");
      label.append(input, item.label);
      choices.append(label);
    }
    parts.push(choices);
  }
  list.replaceChildren(...parts);
}

// A chart, with Send to Stellarium Desktop in the extension, as in the popup;
// without it on the web, or should Stellarium's side fail. A refusal is drawn
// as it is. Which planets were visible opens Helioscope's page in a tab with
// the chart in its link, but not its name or town, as on the screenshot and
// paste pages, and a chart the link can't carry says why, with Cancel back to
// the chart.
function showChart({ view, chart }) {
  const onButton = async (button, sky, screen) => {
    if (button.does !== "helioscope") return openLink(button, sky);
    const shared = chartToShare(chart, sky, "file");
    if (shared.kind === "refused") {
      // renderChart passes its screen; the plain render below, without the
      // desktop button, doesn't, and then this page's own are the way back.
      render(app, viewForHelioscopeRefusal(shared.reason), screen?.onButton ?? onButton, screen?.view ?? view);
      return;
    }
    if (onTheWeb) openPage("helioscope.html", shared.chart, location.href);
    else await chrome.tabs.create({ url: linkFor(chrome.runtime.getURL("helioscope.html"), shared.chart) });
  };
  if (desktop) desktop.renderChart(app, view, onButton).catch(() => render(app, view, onButton));
  else render(app, view, onButton);
}

// Links, the astro.com buttons and Save in Astro-Seek…, as on the screenshot and paste pages.
const openLink = (button, sky) => (extensionLinks?.openLink ?? openWebLink)(app, button, sky);

// A file the receiving page sent here, when it was given one it doesn't
// read. Last, once openLink is defined. sessionStorage itself can throw when
// the browser blocks storage.
let handed = null;
try {
  handed = takeFileForImport(sessionStorage);
} catch {
  handed = null;
}
if (handed) readBytes(handed.name, handed.bytes);
