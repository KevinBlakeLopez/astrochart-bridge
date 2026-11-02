// The import page. Reads a chosen, dropped or pasted AAF file, or a chosen or
// dropped Morinus .hor file, on this computer, lists its charts and shows the
// popup's screen for the one chosen. Every decision about a chart is made in
// core/aaf.js and aaf-model.js, or core/morinus-hor.js and hor-model.js; this
// file handles the file and the page. Text from the file is only ever
// inserted with textContent.
import { decodeAafFile, viewForAafText } from "./aaf-model.js";
import { openLink as openPageLink } from "./astro-com-page.js";
import { takeFileForImport } from "./chart-model.js";
import { renderChart } from "./desktop-page.js";
import { isHorFile } from "./core/morinus-hor.js";
import { viewForHorFile } from "./hor-model.js";
import { paragraph, render } from "./view.js";

const fileInput = document.getElementById("file");
const textInput = document.getElementById("text");
const list = document.getElementById("list");
const app = document.getElementById("app");

fileInput.addEventListener("change", () => readFile(fileInput.files[0] ?? null));
document.getElementById("read").addEventListener("click", () => show(viewForAafText(textInput.value)));
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
    show(viewForHorFile(bytes));
    return;
  }
  const { text, warning } = decodeAafFile(bytes);
  show(viewForAafText(text), warning);
}

// A list from viewForAafText or viewForHorFile: one chart is shown at once,
// several as choices.
function show(view, warning) {
  const parts = [];
  if (warning) parts.push(paragraph(warning, "warning"));
  parts.push(paragraph(view.message));
  app.replaceChildren();

  if (view.items.length === 1) {
    showChart(view.items[0].view);
  } else if (view.items.length > 1) {
    const choices = document.createElement("fieldset");
    for (const item of view.items) {
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "chart";
      input.addEventListener("change", () => showChart(item.view));
      const label = document.createElement("label");
      label.append(input, item.label);
      choices.append(label);
    }
    parts.push(choices);
  }
  list.replaceChildren(...parts);
}

// A chart, with Send to Stellarium Desktop, as in the popup; without it,
// should Stellarium's side fail. A refusal is drawn as it is.
function showChart(chart) {
  renderChart(app, chart, openLink).catch(() => render(app, chart, openLink));
}

// Links, and the astro.com buttons, as on the screenshot and paste pages.
const openLink = (button) => openPageLink(app, button);

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
