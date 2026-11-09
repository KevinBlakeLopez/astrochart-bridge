// Draws Helioscope's page from helioscope-model.js's views: the chart's
// rows, a table of the five planets, each planet's details and the
// assumptions, closed until opened, then the notes. Everything shown is set
// with textContent.
import { text } from "./messages/index.js";
import { paragraph, rowList } from "./view.js";

/**
 * @param {{ replaceChildren: (...nodes: Node[]) => void }} container  its children are replaced
 * @param {ReturnType<typeof import("./helioscope-model.js").viewForVisibility>
 *   | ReturnType<typeof import("./helioscope-model.js").viewForRefusal>} view
 */
export function drawScreen(container, view) {
  if (view.state !== "ready") {
    const parts = [paragraph(view.message)];
    if (view.code) parts.push(paragraph(text().view.code(view.code), "code"));
    container.replaceChildren(...parts);
    return;
  }
  const words = text().helioscope;
  container.replaceChildren(
    rowList(view.rows),
    planetTable(view.planets),
    element("h2", "", words.detailsHeading),
    ...view.planets.map(({ name, prediction, details }) => closed(words.detailsSummary(name, prediction.label), details, "planet")),
    closed(words.assumptionsHeading, view.assumptions, "assumptions"),
    ...view.notes.map((note) => paragraph(note, "note")),
  );
}

// A row for each planet: its name, the moment's condition and side of the
// Sun, and the prediction, each with its detail under it.
function planetTable(planets) {
  const { columns } = text().helioscope;
  const table = element("table", "planets");
  const head = element("thead");
  head.append(tableRow([columns.planet, columns.moment, columns.prediction].map((label) => heading(label, "col"))));
  const body = element("tbody");
  for (const { name, moment, prediction } of planets) {
    body.append(tableRow([heading(name, "row"), twoLines(moment.text, moment.angle), twoLines(prediction.label, prediction.detail)]));
  }
  table.append(head, body);
  return table;
}

function tableRow(cells) {
  const row = element("tr");
  row.append(...cells);
  return row;
}

function heading(label, scope) {
  const cell = element("th", "", label);
  cell.setAttribute("scope", scope);
  return cell;
}

function twoLines(main, detail) {
  const cell = element("td");
  cell.append(element("span", "", main), element("span", "detail", detail));
  return cell;
}

// A details box with its rows, closed until opened.
function closed(summary, rows, className) {
  const box = element("details", className);
  box.append(element("summary", "", summary), rowList(rows));
  return box;
}

function element(tag, className = "", content = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}
