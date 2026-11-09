// Helioscope's page as helioscope-view.js draws it, from real results. The
// preview can't serve a worktree's extension, so this is where the drawn
// page is checked: what each element says, and in which order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../extension/helioscope-engine.js";
import { viewForRefusal, viewForVisibility, visibilities } from "../extension/helioscope-model.js";
import { drawScreen } from "../extension/helioscope-view.js";
import { setLanguage } from "../extension/messages/index.js";

// Just enough of a page to draw into, as test/view.test.js has it, with the
// attributes the table's headings set.
globalThis.document = {
  createElement: (tag) => {
    const element = {
      tag,
      className: "",
      textContent: "",
      attributes: {},
      children: [],
      append: (...nodes) => element.children.push(...nodes),
      setAttribute: (name, value) => (element.attributes[name] = value),
    };
    return element;
  },
};

// The feasibility doc's reference chart (§10): New York, 10 January 2025 at 17:35, UTC-05:00.
const NEW_YORK = {
  kind: "natal",
  site: null,
  local: "2025-01-10T17:35:00",
  zoneLabel: null,
  lat: 40.7128,
  lng: -74.006,
  utc: "2025-01-10T22:35:00Z",
  utcSource: "declared",
  offsetMinutes: -300,
};

// What the page draws for a view: the container's new children.
function drawn(view) {
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  drawScreen(container, view);
  return container.parts;
}

// The New York chart's screen, drawn in a language.
async function drawnIn(code) {
  setLanguage([code]);
  const engine = await createEngine();
  try {
    const { results } = visibilities(NEW_YORK, engine, { elevation: null, underTheBeams: 15 });
    return drawn(viewForVisibility(NEW_YORK, results));
  } finally {
    engine.dispose();
    setLanguage(["en"]);
  }
}

// A table cell's text: a heading's, or a data cell's two lines.
const cellText = (cell) => (cell.tag === "th" ? cell.textContent : cell.children.map(({ textContent }) => textContent));

// A details box's summary and its rows, as label and value pairs.
function box({ children: [summary, list] }) {
  const pairs = [];
  for (let i = 0; i < list.children.length; i += 2) pairs.push([list.children[i].textContent, list.children[i + 1].textContent]);
  return { summary: summary.textContent, rows: pairs };
}

test("a chart's screen: its rows, the planets' table, each planet's details, the assumptions, then the notes", async () => {
  const parts = await drawnIn("en");
  assert.deepEqual(parts.map(({ tag, className }) => (className ? `${tag}.${className}` : tag)), [
    "dl",
    "table.planets",
    "h2",
    "details.planet",
    "details.planet",
    "details.planet",
    "details.planet",
    "details.planet",
    "details.assumptions",
    "p.note",
  ]);
  const [rows, , heading, ...rest] = parts;
  assert.deepEqual(rows.children.map(({ tag, textContent }) => `${tag}: ${textContent}`).slice(0, 2), ["dt: Local time", "dd: 10 Jan 2025, 17:35"]);
  assert.equal(heading.textContent, "Details");
  assert.equal(rest.at(-1).textContent, "Times are at UTC-05:00, the chart's offset.");
});

test("the planets' table has a column heading for each result and a row heading for each planet", async () => {
  const [, table] = await drawnIn("en");
  const [head, body] = table.children;
  assert.deepEqual(
    head.children[0].children.map((cell) => [cell.tag, cell.textContent, cell.attributes.scope]),
    [
      ["th", "Planet", "col"],
      ["th", "At the chart's moment", "col"],
      ["th", "Predicted in the twilight around it", "col"],
    ],
  );
  assert.deepEqual(body.children.map((row) => row.children[0].attributes.scope), ["row", "row", "row", "row", "row"]);
  assert.deepEqual(body.children[1].children.map(cellText), [
    "Venus",
    ["Clear · evening", "47.2° east of the Sun"],
    ["Detectable", "Best at dusk, 18:15: +9.01"],
  ]);
  assert.equal(body.children[1].children[2].children[1].className, "detail");
});

test("each planet's details and the assumptions are closed boxes with their rows", async () => {
  const parts = await drawnIn("en");
  const boxes = parts.filter(({ tag }) => tag === "details").map(box);
  assert.deepEqual(
    boxes.map(({ summary }) => summary),
    ["Mercury: Not detectable", "Venus: Detectable", "Mars: Detectable", "Jupiter: Detectable", "Saturn: Detectable", "Assumptions"],
  );
  assert.deepEqual(boxes[1].rows[0], ["Evening", "From sunset at 16:49 to the end of astronomical twilight at 18:26, above the horizon in 50 of 50 samples"]);
  assert.deepEqual(boxes.at(-1).rows[0], ["Ephemeris", "Swiss Ephemeris 2.10.03, Moshier"]);
});

test("a refusal draws its message and its code, and a page with no chart only its message", () => {
  assert.deepEqual(
    drawn(viewForRefusal("engine-failed")).map(({ className, textContent }) => [className, textContent]),
    [
      ["", "Swiss Ephemeris couldn't start in this browser, so the planets can't be worked out."],
      ["code", "Code: engine-failed"],
    ],
  );
  assert.deepEqual(
    drawn(viewForRefusal(null)).map(({ textContent }) => textContent),
    ["This page works out which planets were visible for a chart. Open it from a chart in AstroChart Bridge."],
  );
});

test("in Spanish, the page's words and decimal commas", async () => {
  const parts = await drawnIn("es");
  const [, table] = parts;
  assert.deepEqual(table.children[1].children[1].children.map(cellText), [
    "Venus",
    ["Libre de los rayos · vespertino", "47,2° al este del Sol"],
    ["Detectable", "Mejor al anochecer, a las 18:15: +9,01"],
  ]);
  const venus = box(parts.filter(({ tag }) => tag === "details")[1]);
  assert.deepEqual(venus.rows[0], [
    "Anochecer",
    "Desde la puesta del Sol a las 16:49 hasta el final del crepúsculo astronómico a las 18:26, sobre el horizonte en 50 de 50 muestras",
  ]);
  assert.equal(parts.at(-1).textContent, "Las horas están en UTC-05:00, la diferencia horaria de la carta.");
});

test("in Slovenian, the page's words, decimal commas and counts", async () => {
  const parts = await drawnIn("sl");
  const [, table] = parts;
  assert.deepEqual(table.children[1].children[1].children.map(cellText), [
    "Venera",
    ["Zunaj žarkov · na večernem nebu", "47,2° vzhodno od Sonca"],
    ["Lahko se vidi", "Najbolje v mraku, ob 18:15: +9,01"],
  ]);
  const boxes = parts.filter(({ tag }) => tag === "details").map(box);
  assert.deepEqual(boxes[1].rows[0], [
    "Večer",
    "Od sončnega zahoda ob 16:49 do konca astronomskega somraka ob 18:26, nad obzorjem v 50 od 50 vzorcev",
  ]);
  assert.deepEqual(boxes.at(-1).rows.find(([label]) => label === "Opazovalec"), ["Opazovalec", "Star 36 let, Snellenovo razmerje 1, z obema očesoma"]);
  assert.deepEqual(boxes.at(-1).rows.find(([label]) => label === "Vzorci"), ["Vzorci", "Na 2 minuti"]);
});
