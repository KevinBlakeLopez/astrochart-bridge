// Draws Helioscope's page from helioscope-model.js's views: the chart's
// rows, a table of the five planets, each planet's details and the
// assumptions, closed until opened, then the notes. Everything shown is set
// with textContent.
import { text } from "./messages/index.js";
import { paragraph, rowList } from "./view.js";

// Where the method and its checks are written up.
const METHOD_URL = "https://github.com/KevinBlakeLopez/astrochart-bridge/blob/main/docs/HELIOSCOPE_V1_FEASIBILITY.md";

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
    planetTable(view.planets, view.method),
    element("h2", "", words.detailsHeading),
    ...view.planets.map(({ name, prediction, details }) => closed(words.detailsSummary(name, prediction.label), details, "planet")),
    closed(words.assumptionsHeading, view.assumptions, "assumptions"),
    howBox(),
    ...view.notes.map((note) => paragraph(note, "note")),
  );
}

// A row for each planet: its name, the moment's condition and side of the
// Sun, and the prediction, each with its detail under it, and the
// prediction with its Stellarium Web link when it has a best moment. Each
// result's heading says how it's judged.
function planetTable(planets, method) {
  const { columns } = text().helioscope;
  const table = element("table", "planets");
  const head = element("thead");
  const momentHeading = heading(columns.moment, "col");
  momentHeading.append(element("span", "detail", method.moment));
  const predictionHeading = heading(columns.prediction, "col");
  predictionHeading.append(element("span", "detail", method.prediction));
  head.append(tableRow([heading(columns.planet, "col"), momentHeading, predictionHeading]));
  const body = element("tbody");
  for (const { name, moment, prediction, link } of planets) {
    const predicted = twoLines(prediction.label, prediction.detail);
    if (link) predicted.append(skyLink(link));
    body.append(tableRow([heading(name, "row"), twoLines(moment.text, moment.angle), predicted]));
  }
  table.append(head, body);
  return table;
}

// A planet in Stellarium Web, opened in a new tab with nothing of this page
// sent with it: no opener and no referrer. A screen reader says the planet
// and the time, which the short text leaves to the row.
function skyLink(link) {
  const anchor = element("a", "sky-link", link.text);
  anchor.href = link.url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.setAttribute("aria-label", link.label);
  return anchor;
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

// How this is worked out, closed until opened: only what the column
// headings don't say, then where the method and its checks are written up.
function howBox() {
  const { how } = text().helioscope;
  const box = element("details", "how");
  const steps = element("ol");
  steps.append(...how.steps.map((step) => element("li", "", step)));
  const more = element("a", "", how.more);
  more.href = METHOD_URL;
  more.target = "_blank";
  more.rel = "noopener noreferrer";
  const line = element("p", "note");
  line.append(more);
  box.append(element("summary", "", how.title), steps, line);
  return box;
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
