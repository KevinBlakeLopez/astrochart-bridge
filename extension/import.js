// The import page. Reads a chosen, dropped or pasted AAF file on this
// computer, lists its charts and shows the popup's screen for the one chosen.
// Every decision about a chart is made in core/aaf.js and aaf-model.js; this
// file handles the file and the page. Text from the file is only ever
// inserted with textContent.
import { decodeAafFile, viewForAafText } from "./aaf-model.js";
import { paragraph, render } from "./view.js";

const fileInput = document.getElementById("file");
const textInput = document.getElementById("text");
const list = document.getElementById("list");
const app = document.getElementById("app");

fileInput.addEventListener("change", () => readFile(fileInput.files[0] ?? null));
document.getElementById("read").addEventListener("click", () => show(textInput.value));
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
  event.preventDefault();
  readFile(event.dataTransfer?.files[0] ?? null);
});

async function readFile(file) {
  if (!file) return;
  const { text, warning } = decodeAafFile(new Uint8Array(await file.arrayBuffer()));
  show(text, warning);
}

function show(text, warning) {
  const view = viewForAafText(text);
  const parts = [];
  if (warning) parts.push(paragraph(warning, "warning"));
  parts.push(paragraph(view.message));
  app.replaceChildren();

  if (view.items.length === 1) {
    render(app, view.items[0].view, openLink);
  } else if (view.items.length > 1) {
    const choices = document.createElement("fieldset");
    for (const item of view.items) {
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "chart";
      input.addEventListener("change", () => render(app, item.view, openLink));
      const label = document.createElement("label");
      label.append(input, item.label);
      choices.append(label);
    }
    parts.push(choices);
  }
  list.replaceChildren(...parts);
}

function openLink({ url }) {
  window.open(url, "_blank", "noopener");
}
