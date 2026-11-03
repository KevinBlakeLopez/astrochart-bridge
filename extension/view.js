// Draws a view from popup-model.js. Shared by the toolbar popup and the
// screenshot page, which each pass their own way of opening a link. Text read
// from a page or a screenshot is only ever inserted with textContent.
import { astroSeekUrl } from "./core/astroseek.js";
import { stellariumUrl } from "./core/stellarium.js";
import { text } from "./messages/index.js";
import { NAME_LENGTH, actionGroups, nameWarning, offsetPreview, withName } from "./popup-model.js";

// What a button can open for the decided sky, by the name a view gives it.
const LINKS = { stellarium: stellariumUrl, "astro-seek": astroSeekUrl };

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
  if (view.steps) parts.push(stepList(view.steps));
  if (view.code) parts.push(paragraph(text().view.code(view.code), "code"));

  if (view.state !== "refused") {
    // The sky the buttons open: set from the start on a ready screen or a
    // Stellarium tab's, and only once a reading is picked or a valid offset is
    // typed on the others. A button with does names an action instead of a
    // link, for onButton to take.
    let sky = view.sky ?? null;
    // What the Name boxes hold: a button that keeps values for a tab keeps
    // this name in place of the one the view gave it.
    const typed = view.nameBoxes ? Object.fromEntries(view.nameBoxes.map(({ part, text }) => [part, text])) : null;
    const withTyped = (button) => (typed && button.holds ? { ...button, holds: withName(button.holds, typed) } : button);
    // The buttons that wait for the sky: the view's own and Send to Stellarium Desktop.
    const buttons = [];
    const waits = (button) => (buttons.push(button), button);
    const setSky = (next) => {
      sky = next;
      for (const button of buttons) button.disabled = sky === null;
    };

    // What each action from actionGroups draws.
    const draw = {
      button: ({ button: { label, opens, secondary, ...button } }) => {
        const element = linkButton(label, () => onButton(withTyped({ ...button, url: button.url ?? LINKS[opens]?.(sky) }), sky));
        if (secondary) element.className = "secondary";
        return [waits(element)];
      },
      // Sends the decided sky to Stellarium Desktop, for onButton to do, in the
      // main style when it is the user's default. The line about Stellarium
      // goes right under it, empty until the popup has checked Stellarium,
      // which may be after this is drawn.
      desktop: () => {
        const send = () => onButton({ does: "send-to-desktop" }, sky);
        const button = view.desktop.primary ? linkButton(view.desktop.label, send) : secondaryButton(view.desktop.label, send);
        return [waits(button), desktopHintLine()];
      },
      // Which app is the default, with a link to change it, right under the
      // buttons it affects. With no text, the change is offered as a button.
      "default-choice": () => {
        const { text, label, does } = view.defaultChoice;
        const change = () => onButton({ does }, sky);
        if (text === null) return [secondaryButton(label, change)];
        const line = paragraph(`${text} `, "note default-choice");
        const link = linkButton(label, change);
        link.className = "link";
        line.append(link);
        return [line];
      },
      // The chart as an AAF file, made by aaf-model.js. Saving it sends nothing
      // anywhere. Its note, such as why the file is in Universal Time, shows
      // once the file is saved, keeping the screen short enough for a popup.
      download: () => {
        const note = view.download.note ? paragraph(view.download.note, "note") : null;
        if (note) note.hidden = true;
        const save = () => {
          saveFile(view.download);
          if (note) note.hidden = false;
        };
        return [secondaryButton(view.download.label, save), ...(note ? [note] : [])];
      },
      // The share page's boxes for which of the chart's name and town go with
      // it. Ticking one tells onButton, which keeps the choice; nothing is
      // drawn again, so the box keeps its focus.
      includes: () => [includeBoxes(view.includes, (field, checked) => onButton({ does: "include", field, checked }, sky))],
      // A further screen, such as the values to enter in astro.com, is drawn in
      // place of this one, and Cancel draws this one again. Going there and back stores nothing.
      next: () => [secondaryButton(view.next.label, () => render(container, view.next.view, onButton, view))],
    };
    const actions = actionGroups(view).flatMap(({ label, actions }) => [
      ...(label ? [groupLabel(label)] : []),
      ...actions.flatMap((action) => draw[action.kind](action)),
    ]);

    if (view.state === "choose") parts.push(choiceList(view.choices, setSky));
    if (view.state === "enter-offset") parts.push(...offsetField(view, setSky));
    if (typed) parts.push(...nameFields(view.nameBoxes, typed));
    for (const note of view.notes) parts.push(paragraph(note, "note"));
    setSky(sky);
    parts.push(...actions);
    // The other ways to a chart, closed until opened, from withOtherWays. They
    // don't open this screen's sky, so they don't wait for it.
    if (view.more) parts.push(moreBox(view.more, (button) => onButton(button, sky)));
    if (back) parts.push(secondaryButton(text().view.cancel, () => render(container, back, onButton)));
  }

  container.replaceChildren(...parts);
}

// A link to the text with download set saves it under filename, with no
// downloads permission. The link is revoked a minute later, by when the
// browser has the file; a popup that closes first takes it with it.
function saveFile({ filename, text }) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

// The label over one of actionGroups' groups, or of the popup's other ways in.
export function groupLabel(text) {
  const element = document.createElement("h2");
  element.className = "group";
  element.textContent = text;
  return element;
}

/**
 * popup-model.js's otherWays() groups, each under its label. A click passes
 * the button, with the page it opens or what it does, to onChoose.
 *
 * @param {ReturnType<typeof import("./popup-model.js").otherWays>} groups
 * @param {(button: { label: string, page?: string, does?: string }) => void} onChoose
 * @returns {HTMLElement[]}
 */
export function wayGroups(groups, onChoose) {
  return groups.flatMap(({ label, buttons }) => [
    groupLabel(label),
    ...buttons.map((button) => secondaryButton(button.label, () => onChoose(button))),
  ]);
}

// A box of groups under a line that opens it, closed to begin with.
function moreBox({ label, groups }, onChoose) {
  const box = document.createElement("details");
  box.className = "more";
  const summary = document.createElement("summary");
  summary.textContent = label;
  box.append(summary, ...wayGroups(groups, onChoose));
  return box;
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

/**
 * The line under a Stellarium Desktop button that the popup fills in after
 * checking Stellarium. Hidden while empty.
 *
 * @returns {HTMLParagraphElement}
 */
export function desktopHintLine() {
  return paragraph("", "note desktop-hint");
}

function stepList(steps) {
  const list = document.createElement("ol");
  for (const step of steps) {
    const item = document.createElement("li");
    item.textContent = step;
    list.append(item);
  }
  return list;
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

function includeBoxes({ legend, boxes }, onChange) {
  const list = document.createElement("fieldset");
  list.className = "includes";
  const title = document.createElement("legend");
  title.textContent = legend;
  list.append(title);
  for (const { field, label, checked } of boxes) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(field, input.checked));
    const wrapper = document.createElement("label");
    wrapper.append(input, label);
    list.append(wrapper);
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

// One labelled box per name part, editing typed in place, and a line under
// them that says when a part is too long for astro.com.
function nameFields(boxes, typed) {
  const warning = paragraph("", "warning");
  const check = () => {
    warning.textContent = nameWarning(typed) ?? "";
    warning.hidden = warning.textContent === "";
  };
  const fields = boxes.map(({ part, label, text }) => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = text;
    input.maxLength = NAME_LENGTH;
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      typed[part] = input.value;
      check();
    });
    const wrapper = document.createElement("label");
    wrapper.className = "name-field";
    wrapper.append(label, input);
    return wrapper;
  });
  check();
  return [...fields, warning];
}

function offsetField(view, setSky) {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = text().view.offsetPlaceholder;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", text().view.offsetLabel);
  const preview = paragraph("", "preview");
  input.addEventListener("input", () => {
    const result = offsetPreview(view, input.value);
    preview.textContent = result ? text().view.offsetPreview(result.utcText) : "";
    setSky(result ? result.sky : null);
  });
  return [input, preview];
}
