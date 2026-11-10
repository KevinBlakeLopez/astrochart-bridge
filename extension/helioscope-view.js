// Draws Helioscope's page from helioscope-model.js's views: the chart's
// rows, the weather check, a table of the five planets, each planet's
// details and the assumptions, closed until opened, then the notes.
// Everything shown is set with textContent.
import { text } from "./messages/index.js";
import { paragraph, rowList } from "./view.js";

// Where the method and its checks are written up.
const METHOD_URL = "https://github.com/KevinBlakeLopez/astrochart-bridge/blob/main/docs/HELIOSCOPE_V1_FEASIBILITY.md";

// Where the weather's credit links: Open-Meteo, as its licence asks, and the
// licence itself.
const OPEN_METEO_URL = "https://open-meteo.com/";
const LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";

/**
 * @param {{ replaceChildren: (...nodes: Node[]) => void }} container  its children are replaced
 * @param {ReturnType<typeof import("./helioscope-model.js").viewForVisibility>
 *   | ReturnType<typeof import("./helioscope-model.js").viewForRefusal>} view
 * @param {() => void} [onWeather]  for a click on Check that night's weather
 */
export function drawScreen(container, view, onWeather = () => {}) {
  if (view.state !== "ready") {
    const parts = [paragraph(view.message)];
    if (view.code) parts.push(paragraph(text().view.code(view.code), "code"));
    container.replaceChildren(...parts);
    return;
  }
  const words = text().helioscope;
  container.replaceChildren(
    rowList(view.rows),
    weatherSection(view.weather, onWeather),
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

// The weather check, in one place before and after: the button and what it
// sends, with why the last try failed over it; what it's doing, or why it
// can't be done; or, once it's in, that night's weather and its credit.
function weatherSection(weather, onWeather) {
  const section = element("div", "weather");
  if (weather.kind === "shown") {
    section.append(element("h2", "", weather.title), element("p", "", weather.line), paragraph(weather.note, "note"), creditLine(weather.credit));
    return section;
  }
  if (weather.kind !== "offer") {
    section.append(paragraph(weather.message, "note"));
    return section;
  }
  if (weather.message) section.append(paragraph(weather.message, "warning"));
  if (weather.code) section.append(paragraph(text().view.code(weather.code), "code"));
  const button = element("button", "secondary", weather.button);
  button.type = "button";
  button.addEventListener("click", onWeather);
  section.append(button, paragraph(weather.note, "note"));
  return section;
}

// "Weather data by Open-Meteo.com (CC BY 4.0), generated using …": the
// credit's first part links to Open-Meteo and its licence to the licence.
function creditLine({ data, licence, source }) {
  const line = element("p", "note");
  line.append(outLink(data, OPEN_METEO_URL), " (", outLink(licence, LICENCE_URL), `), ${source}.`);
  return line;
}

// A planet in Stellarium Web, opened in a new tab with nothing of this page
// sent with it: no opener and no referrer. A screen reader says the planet
// and the time, which the short text leaves to the row.
function skyLink(link) {
  const anchor = outLink(link.text, link.url, "sky-link");
  anchor.setAttribute("aria-label", link.label);
  return anchor;
}

// A link that opens in a new tab with nothing of this page sent with it.
function outLink(label, url, className = "") {
  const anchor = element("a", className, label);
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
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
  const line = element("p", "note");
  line.append(outLink(how.more, METHOD_URL));
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
