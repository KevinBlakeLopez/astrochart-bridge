// The paste page. Reads birth data from pasted text, shows it on a form to
// check and correct, then the popup's ready screen for it. Every decision is
// made in core/ and paste-model.js; this file handles the page. The text is
// only ever inserted with textContent or an input's value, never as HTML.
import { openLink as openPageLink } from "./astro-com-page.js";
import { linkFor } from "./chart-model.js";
import { readText } from "./core/text.js";
import { chartForEntry, checkField, entryFor, formFor, viewForEntry } from "./paste-model.js";
import { viewForShareRefusal } from "./popup-model.js";
import { paragraph, render } from "./view.js";

const textArea = document.getElementById("text");
const app = document.getElementById("app");

const CLIPBOARD_REFUSED =
  "Your browser didn't let AstroChart Bridge read the clipboard. Click the box above and paste with ⌘V or Ctrl+V instead.";

document.getElementById("read").addEventListener("click", read);
// A paste is read at once; typing waits for the button, so a half-typed line
// doesn't redraw the form.
textArea.addEventListener("input", (event) => {
  if (event.inputType === "insertFromPaste") read();
});
// The clipboard is read only on this click, never when the page opens. A
// browser that refuses still leaves pasting into the box.
document.getElementById("from-clipboard").addEventListener("click", async () => {
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    app.replaceChildren(paragraph(CLIPBOARD_REFUSED, "warning"));
    return;
  }
  textArea.value = text;
  read();
});

function read() {
  const form = formFor(readText(textArea.value));
  if (form.state === "refused") render(app, form, openLink);
  else app.replaceChildren(formElement(form));
}

// The form, kept while the ready screen is shown so Back returns to it as it was left.
function formElement(form) {
  const element = document.createElement("form");
  element.noValidate = true;
  const values = {};
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Continue";
  // The form is the only gate: Continue stays off until all five boxes read.
  const update = () => {
    submit.disabled = entryFor(values) === null;
  };

  for (const field of form.fields) {
    element.append(
      fieldElement(field, (value) => {
        values[field.name] = value;
        update();
      }),
    );
  }
  for (const warning of form.warnings) element.append(paragraph(warning, "warning"));
  if (form.rows.length > 0) element.append(paragraph("Also in the text, not sent anywhere:", "note"), rowList(form.rows));
  for (const note of form.notes) element.append(paragraph(note, "note"));
  element.append(submit);
  update();

  element.addEventListener("submit", (event) => {
    event.preventDefault();
    const entry = entryFor(values);
    if (entry) showReady(element, entry, form);
  });
  return element;
}

function fieldElement(field, onValue) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const id = `field-${field.name}`;

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = field.label;
  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.value = field.text;
  input.placeholder = field.placeholder;
  input.autocomplete = "off";
  input.spellcheck = false;
  const status = paragraph("", "preview");

  const check = () => {
    const { value, message } = checkField(field.name, input.value);
    status.textContent = message;
    status.className = value === null && message !== "" ? "preview warning" : "preview";
    onValue(value);
  };
  input.addEventListener("input", check);

  wrapper.append(label, input, status, paragraph(field.source, "note"));
  if (field.choices) {
    const choices = document.createElement("p");
    choices.className = "choices";
    for (const choice of field.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = choice.label;
      button.addEventListener("click", () => {
        input.value = choice.text;
        check();
      });
      choices.append(button);
    }
    wrapper.append(choices);
  }
  check();
  return wrapper;
}

// As on the screenshot page: Share… opens the receiving page in a tab with the
// chart in its link, and a chart the format can't carry says why, with Cancel
// back to this screen.
function showReady(formElementToKeep, entry, form) {
  const screen = document.createElement("div");
  const view = viewForEntry(entry, { warnings: form.warnings, name: form.name });
  const onButton = async (button) => {
    // Links, and the astro.com buttons of the step after this screen, as on the screenshot page.
    if (button.does !== "share") return openPageLink(screen, button);
    const shared = chartForEntry(entry, form.statedOffsets);
    if (shared.kind === "refused") {
      render(screen, viewForShareRefusal(shared.reason), onButton, view);
      return;
    }
    await chrome.tabs.create({ url: linkFor(chrome.runtime.getURL("chart.html"), shared.chart) });
  };
  render(screen, view, onButton);
  const back = document.createElement("button");
  back.className = "secondary";
  back.textContent = "Back to the form";
  back.addEventListener("click", () => app.replaceChildren(formElementToKeep));
  app.replaceChildren(screen, back);
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

function openLink({ url }) {
  window.open(url, "_blank", "noopener");
}
