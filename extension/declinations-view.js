// Draws the declinations page from declinations-model.js's views: the
// chart's rows, the contacts in a table, then every declination and the
// assumptions, each closed until opened, then the notes. Everything shown is
// set with textContent, and every word comes from the view.
import { text } from "./messages/index.js";
import { paragraph, rowList } from "./view.js";

/**
 * @param {{ replaceChildren: (...nodes: Node[]) => void }} container  its children are replaced
 * @param {ReturnType<typeof import("./declinations-model.js").viewForDeclinations>
 *   | ReturnType<typeof import("./declinations-model.js").viewForRefusal>} view
 */
export function drawScreen(container, view) {
  if (view.state !== "ready") {
    const parts = [paragraph(view.message)];
    if (view.code) parts.push(paragraph(text().view.code(view.code), "code"));
    container.replaceChildren(...parts);
    return;
  }
  const { contacts, declinations, assumptions } = view;
  container.replaceChildren(
    rowList(view.rows),
    element("h2", "", contacts.heading),
    contacts.none === null ? contactTable(contacts) : paragraph(contacts.none, "note"),
    closed(declinations.heading, "declinations", rowList(declinations.rows)),
    closed(assumptions.heading, "assumptions", rowList(assumptions.rows)),
    ...view.notes.map((note) => paragraph(note, "note")),
  );
}

// A row for each contact: the two points and the kind of contact, then how
// far from exact, over both declinations.
function contactTable({ columns, rows }) {
  const table = element("table", "contacts");
  const head = element("thead");
  head.append(tableRow([heading(columns.contact), heading(columns.orb)]));
  const body = element("tbody");
  for (const { pair, contact, orb, declinations } of rows) {
    body.append(tableRow([twoLines(pair, contact), twoLines(orb, declinations)]));
  }
  table.append(head, body);
  return table;
}

function tableRow(cells) {
  const row = element("tr");
  row.append(...cells);
  return row;
}

function heading(label) {
  const cell = element("th", "", label);
  cell.setAttribute("scope", "col");
  return cell;
}

function twoLines(main, detail) {
  const cell = element("td");
  cell.append(element("span", "", main), element("span", "detail", detail));
  return cell;
}

// A details box, closed until opened.
function closed(summary, className, ...parts) {
  const box = element("details", className);
  box.append(element("summary", "", summary), ...parts);
  return box;
}

function element(tag, className = "", content = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}
