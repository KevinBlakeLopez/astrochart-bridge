// The paste page. Reads birth data from pasted text, shows it on a form to
// check and correct, then the popup's ready screen for it. Every decision is
// made in core/ and paste-model.js; this file handles the page. The text is
// only ever inserted with textContent or an input's value, never as HTML.
import { linkFor } from "./chart-model.js";
import { isExtensionCopy } from "./extension-copy.js";
import { chartForEntry, checkField, entryFor, formForText, localEntryFor, viewForEntry, viewForLocalEntry } from "./paste-model.js";
import { viewForShareRefusal } from "./popup-model.js";
import { localizePage, text } from "./messages/index.js";
import { paragraph, render } from "./view.js";
import { openChartPage, openLink as openWebLink } from "./web-page.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

// The extension's copy fills in astro.com's and Astro-Seek's forms and sends
// to Stellarium Desktop; the web's copy can't, and the site doesn't publish
// that code. Loaded now, not on a click, so a click that asks for access to a
// site still counts as the user's.
const onTheWeb = !isExtensionCopy(location.href);
const extensionLinks = onTheWeb ? null : await import("./astro-com-page.js");
const desktop = onTheWeb ? null : await import("./desktop-page.js");
const openPageLink = (container, button, sky) => (extensionLinks?.openLink ?? openWebLink)(container, button, sky);

const textArea = document.getElementById("text");
const app = document.getElementById("app");

document.getElementById("read").addEventListener("click", read);
// A paste is read at once; typing waits for the button, so a half-typed line
// doesn't redraw the form.
textArea.addEventListener("input", (event) => {
  if (event.inputType === "insertFromPaste") read();
});
// The clipboard is read only on this click, never when the page opens. A
// browser that refuses still leaves pasting into the box.
document.getElementById("from-clipboard").addEventListener("click", async () => {
  let pasted;
  try {
    pasted = await navigator.clipboard.readText();
  } catch {
    app.replaceChildren(paragraph(text().pages.paste.clipboardRefused, "warning"));
    return;
  }
  textArea.value = pasted;
  read();
});

function read() {
  const form = formForText(textArea.value);
  if (form.state === "refused") render(app, form, openLink);
  else app.replaceChildren(formElement(form));
}

// The form, kept while the ready screen is shown so Back returns to it as it was left.
function formElement(form) {
  const element = document.createElement("form");
  element.noValidate = true;
  const values = {};
  let offsetText = "";
  const submit = document.createElement("button");
  submit.type = "submit";
  // The form is the only gate: Continue stays off until all five boxes read,
  // or all but an empty offset box, which leads to astro.com alone.
  const chosen = () => {
    const entry = entryFor(values);
    if (entry) return { entry };
    const local = localEntryFor(values, offsetText);
    return local && { local };
  };
  const update = () => {
    const next = chosen();
    submit.disabled = next === null;
    submit.textContent = next?.local ? text().pages.paste.continueToAstroCom : text().pages.paste.continue;
  };

  for (const field of form.fields) {
    element.append(
      fieldElement(field, (value, text) => {
        values[field.name] = value;
        if (field.name === "offset") offsetText = text;
        update();
      }),
    );
  }
  for (const warning of form.warnings) element.append(paragraph(warning, "warning"));
  if (form.rows.length > 0) element.append(paragraph(text().pages.paste.alsoInText, "note"), rowList(form.rows));
  for (const note of form.notes) element.append(paragraph(note, "note"));
  element.append(submit);
  update();

  element.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = chosen();
    if (next?.entry) showReady(element, next.entry, form);
    else if (next?.local) showLocal(element, next.local, form);
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
    onValue(value, input.value);
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
  const view = viewForEntry(entry, { warnings: form.warnings, name: form.name, town: form.town, gender: form.gender, onTheWeb });
  const onButton = async (button, sky, drawn) => {
    // Links, Save in Astro-Seek…, and the astro.com buttons of the step after
    // this screen, as on the screenshot page.
    if (button.does !== "share") return openPageLink(screen, button, sky);
    const shared = chartForEntry(entry, form.statedOffsets, { town: form.town, name: form.name });
    if (shared.kind === "refused") {
      render(screen, viewForShareRefusal(shared.reason), drawn.onButton, drawn.view);
      return;
    }
    if (onTheWeb) openChartPage(shared.chart, location.href);
    else await chrome.tabs.create({ url: linkFor(chrome.runtime.getURL("chart.html"), shared.chart) });
  };
  // With Send to Stellarium Desktop in the extension, as in the popup;
  // without it on the web, or should Stellarium's side fail.
  if (desktop) desktop.renderChart(screen, view, onButton).catch(() => render(screen, view, onButton));
  else render(screen, view, onButton);
  app.replaceChildren(screen, backButton(formElementToKeep));
}

// A form left without an offset goes straight to the astro.com screen, whose
// buttons work as on the ready screen's astro.com step.
function showLocal(formElementToKeep, local, form) {
  const screen = document.createElement("div");
  render(screen, viewForLocalEntry(local, { name: form.name, town: form.town, gender: form.gender, onTheWeb }), (button) =>
    openPageLink(screen, button),
  );
  app.replaceChildren(screen, backButton(formElementToKeep));
}

function backButton(formElementToKeep) {
  const back = document.createElement("button");
  back.className = "secondary";
  back.textContent = text().pages.paste.back;
  back.addEventListener("click", () => app.replaceChildren(formElementToKeep));
  return back;
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
