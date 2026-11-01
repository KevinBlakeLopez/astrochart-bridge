// Draws a view from popup-model.js. Shared by the toolbar popup and the
// screenshot page, which each pass their own way of opening a link. Text read
// from a page or a screenshot is only ever inserted with textContent.
import { astroSeekUrl } from "./core/astroseek.js";
import { stellariumUrl } from "./core/stellarium.js";
import { offsetPreview } from "./popup-model.js";

// What a button can open for the decided sky, by the name a view gives it.
const LINKS = { stellarium: stellariumUrl, "astro-seek": astroSeekUrl };

// The button every screen with a sky has, unless the view lists its own.
const OPEN_SKY = [{ label: "Open sky", opens: "stellarium" }];

/**
 * @param {HTMLElement} container  its children are replaced
 * @param {ReturnType<typeof import("./popup-model.js").viewFor>} view
 * @param {(button: { url?: string, holds?: object, here?: boolean, does?: string }, sky: object | null) => void | Promise<void>} onButton
 *   called with the clicked button, its link worked out, and the sky the screen has decided
 * @param {object | null} [back]  the view a Cancel button goes back to, for a view reached through next
 */
export function render(container, view, onButton, back = null) {
  const parts = [];
  if (view.heading) parts.push(heading(view.heading));
  if (view.rows) parts.push(rowList(view.rows));
  for (const warning of view.warnings ?? []) parts.push(paragraph(warning, "warning"));
  if (view.message) parts.push(paragraph(view.message));
  if (view.code) parts.push(paragraph(`Code: ${view.code}`, "code"));

  if (view.state !== "refused") {
    // The sky the buttons open: set from the start on a ready screen, and only
    // once a reading is picked or a valid offset is typed on the others. A view
    // with its own url (the Astro-Seek chart from a Stellarium tab) opens that.
    // A button with does names an action instead of a link, for onButton to take.
    let sky = view.sky ?? null;
    const buttons = view.url
      ? [linkButton(view.button, () => onButton({ url: view.url }, sky))]
      : (view.buttons ?? OPEN_SKY).map(({ label, opens, secondary, ...button }) => {
          const element = linkButton(label, () => onButton({ ...button, url: button.url ?? LINKS[opens]?.(sky) }, sky));
          if (secondary) element.className = "secondary";
          return element;
        });
    const setSky = (next) => {
      sky = next;
      for (const button of buttons) button.disabled = !view.url && sky === null;
    };

    if (view.state === "choose") parts.push(choiceList(view.choices, setSky));
    if (view.state === "enter-offset") parts.push(...offsetField(view, setSky));
    for (const note of view.notes) parts.push(paragraph(note, "note"));
    setSky(sky);
    parts.push(...buttons);

    // A further screen, such as the values to enter in astro.com, is drawn in
    // place of this one, and Cancel draws this one again. Going there and back stores nothing.
    if (view.next) {
      parts.push(secondaryButton(view.next.label, () => render(container, view.next.view, onButton, view)));
    }
    if (back) parts.push(secondaryButton("Cancel", () => render(container, back, onButton)));
  }

  container.replaceChildren(...parts);
}

function secondaryButton(label, onClick) {
  const button = linkButton(label, onClick);
  button.className = "secondary";
  return button;
}

function heading(text) {
  const element = document.createElement("h1");
  element.textContent = text;
  return element;
}

export function paragraph(text, className) {
  const p = document.createElement("p");
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

function linkButton(label, onClick) {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
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
