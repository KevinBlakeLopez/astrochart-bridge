// Draws the parans page from parans-model.js's views: the chart's rows, the
// parans in a table, closest first, then every event and the assumptions,
// each closed until opened, then the notes. Everything shown is set with
// textContent, and every word comes from the view.
import { text } from "./messages/index.js";
import { paragraph, rowList } from "./view.js";

/**
 * @param {{ replaceChildren: (...nodes: Node[]) => void }} container  its children are replaced
 * @param {ReturnType<typeof import("./parans-model.js").viewForParans>
 *   | ReturnType<typeof import("./parans-model.js").viewForRefusal>} view
 */
export function drawScreen(container, view) {
  if (view.state !== "ready") {
    const parts = [paragraph(view.message)];
    if (view.code) parts.push(paragraph(text().view.code(view.code), "code"));
    container.replaceChildren(...parts);
    return;
  }
  const { parans, events, assumptions } = view;
  container.replaceChildren(
    rowList(view.rows),
    element("h2", "", parans.heading),
    parans.none === null ? paranTable(parans) : paragraph(parans.none, "note"),
    eventsBox(events),
    closed(assumptions.heading, "assumptions", rowList(assumptions.rows)),
    ...view.notes.map((note) => paragraph(note, "note")),
  );
}

// A row for each paran: its two events, each with its time, and how far
// apart they were, in ARMC and in time.
function paranTable({ columns, rows }) {
  const table = element("table", "parans");
  const head = element("thead");
  head.append(tableRow([heading(columns.paran), heading(columns.apart)]));
  const body = element("tbody");
  for (const { first, second, armc, time } of rows) body.append(tableRow([twoLines(first, second), twoLines(armc, time)]));
  table.append(head, body);
  return table;
}

// Every event, in time order, then the risings and settings that didn't happen.
function eventsBox({ heading, summary, rows, missing }) {
  return closed(heading, "events", paragraph(summary, "note"), rowList(rows), ...missing.map((line) => paragraph(line, "note")));
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
