// Draws a view from popup-model.js. Shared by the toolbar popup and the
// screenshot page, which each pass their own way of opening a link. Text read
// from a page or a screenshot is only ever inserted with textContent.
import { stellariumUrl } from "./core/stellarium.js";
import { offsetPreview } from "./popup-model.js";

/**
 * @param {HTMLElement} container  its children are replaced
 * @param {ReturnType<typeof import("./popup-model.js").viewFor>} view
 * @param {(url: string) => void | Promise<void>} openLink  called with the link the button opens
 */
export function render(container, view, openLink) {
  const parts = [];
  if (view.rows) parts.push(rowList(view.rows));
  for (const warning of view.warnings ?? []) parts.push(paragraph(warning, "warning"));
  if (view.message) parts.push(paragraph(view.message));
  if (view.code) parts.push(paragraph(`Code: ${view.code}`, "code"));

  if (view.state !== "refused") {
    // The sky to open: set from the start on a ready screen, and only once
    // a reading is picked or a valid offset is typed on the others. A view
    // with its own url (the Astro-Seek chart from a Stellarium tab) opens that.
    let sky = view.sky ?? null;
    const open = document.createElement("button");
    open.textContent = view.button ?? "Open sky";
    open.addEventListener("click", () => openLink(view.url ?? stellariumUrl(sky)));
    const setSky = (next) => {
      sky = next;
      open.disabled = !view.url && sky === null;
    };

    if (view.state === "choose") parts.push(choiceList(view.choices, setSky));
    if (view.state === "enter-offset") parts.push(...offsetField(view, setSky));
    for (const note of view.notes) parts.push(paragraph(note, "note"));
    setSky(sky);
    parts.push(open);
  }

  container.replaceChildren(...parts);
}

export function paragraph(text, className) {
  const p = document.createElement("p");
  if (className) p.className = className;
  p.textContent = text;
  return p;
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
