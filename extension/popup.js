// The only file that talks to the browser. Every decision about what to show
// is made in popup-model.js; this file reads the tab, renders the view and
// opens the sky. Page text is only ever inserted with textContent.
import { analyzePage, classifyUrl, extractorFor } from "./core/index.js";
import { stellariumUrl } from "./core/stellarium.js";
import { viewFor, offsetPreview } from "./popup-model.js";

const app = document.getElementById("app");

main().catch((error) => {
  render({ state: "refused", message: "Chart Bridge couldn't read this tab.", code: String(error?.message ?? error) });
});

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

  // Pages Chart Bridge doesn't handle are refused before any script runs on them.
  const page = classifyUrl(url);
  if (page.kind === "refused") {
    render(viewFor(page));
    return;
  }

  // Each site's extractor reads only what that site's reader needs.
  const [{ result: input }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractorFor(url),
  });
  render(viewFor(analyzePage({ url, input })));
}

function render(view) {
  const parts = [];
  if (view.rows) parts.push(rowList(view.rows));
  for (const warning of view.warnings ?? []) parts.push(paragraph(warning, "warning"));
  if (view.message) parts.push(paragraph(view.message));
  if (view.code) parts.push(paragraph(`Code: ${view.code}`, "code"));

  if (view.state !== "refused") {
    // The sky to open: set from the start on a ready screen, and only once
    // a reading is picked or a valid offset is typed on the others.
    let sky = view.sky ?? null;
    const open = document.createElement("button");
    open.textContent = "Open sky";
    open.addEventListener("click", async () => {
      await chrome.tabs.create({ url: stellariumUrl(sky) });
      window.close();
    });
    const setSky = (next) => {
      sky = next;
      open.disabled = sky === null;
    };

    if (view.state === "choose") parts.push(choiceList(view.choices, setSky));
    if (view.state === "enter-offset") parts.push(...offsetField(view, setSky));
    for (const note of view.notes) parts.push(paragraph(note, "note"));
    setSky(sky);
    parts.push(open);
  }

  app.replaceChildren(...parts);
}

function rowList(rows) {
  const list = document.createElement("dl");
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    list.append(term, detail);
  }
  return list;
}

function choiceList(choices, setSky) {
  const list = document.createElement("fieldset");
  for (const choice of choices) {
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "reading";
    input.addEventListener("change", () => setSky(choice.sky));
    const label = document.createElement("label");
    label.append(input, choice.label);
    list.append(label);
  }
  return list;
}

function offsetField(view, setSky) {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "e.g. -04:00";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "UTC offset");
  const preview = paragraph("", "preview");
  input.addEventListener("input", () => {
    const result = offsetPreview(view, input.value);
    preview.textContent = result ? `UTC: ${result.utcText}` : "";
    setSky(result ? result.sky : null);
  });
  return [input, preview];
}

function paragraph(text, className) {
  const p = document.createElement("p");
  if (className) p.className = className;
  p.textContent = text;
  return p;
}
