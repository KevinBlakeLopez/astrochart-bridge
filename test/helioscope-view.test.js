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
// attributes the table's headings set and the weather button's listener.
globalThis.document = {
  createElement: (tag) => {
    const element = {
      tag,
      className: "",
      textContent: "",
      attributes: {},
      children: [],
      listeners: {},
      append: (...nodes) => element.children.push(...nodes),
      setAttribute: (name, value) => (element.attributes[name] = value),
      addEventListener: (type, listener) => (element.listeners[type] = listener),
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
function drawn(view, onWeather) {
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  drawScreen(container, view, onWeather);
  return container.parts;
}

// A chart's screen, drawn in a language: the New York chart's unless another
// is given, with the weather check in the state given, or offered.
async function drawnIn(code, chart = NEW_YORK, weather = undefined, onWeather = undefined) {
  setLanguage([code]);
  const engine = await createEngine();
  try {
    const { results } = visibilities(chart, engine, { elevation: null, underTheBeams: 15 });
    return drawn(viewForVisibility(chart, results, weather), onWeather);
  } finally {
    engine.dispose();
    setLanguage(["en"]);
  }
}

// That night's weather for the New York chart, as nightWeather reads Open-Meteo's answer.
const WEATHER = {
  kind: "weather",
  year: "2026",
  evening: { hour: "2025-01-10T23:00", cloud: { total: 90, low: 0, mid: 86, high: 88 }, air: { pressure: 1007, temperature: 1.4, humidity: 56 } },
  morning: { hour: "2025-01-10T12:00", cloud: { total: 0, low: 0, mid: 0, high: 0 }, air: { pressure: 1010.8, temperature: -2.8, humidity: 65 } },
};

// Tromsø at midsummer: no sunset and no sunrise, so no best moment and no link.
const TROMSO = { ...NEW_YORK, local: "2025-06-21T02:00:00", utc: "2025-06-21T00:00:00Z", lat: 69.6492, lng: 18.9553, offsetMinutes: 120 };

// A table cell's text: a heading's, or a data cell's two lines.
const cellText = (cell) => (cell.tag === "th" ? cell.textContent : cell.children.map(({ textContent }) => textContent));

// A details box's summary and its rows, as label and value pairs.
function box({ children: [summary, list] }) {
  const pairs = [];
  for (let i = 0; i < list.children.length; i += 2) pairs.push([list.children[i].textContent, list.children[i + 1].textContent]);
  return { summary: summary.textContent, rows: pairs };
}

test("a chart's screen: its rows, the weather check, the planets' table, each planet's details, the assumptions, then the notes", async () => {
  const parts = await drawnIn("en");
  assert.deepEqual(parts.map(({ tag, className }) => (className ? `${tag}.${className}` : tag)), [
    "dl",
    "div.weather",
    "table.planets",
    "h2",
    "details.planet",
    "details.planet",
    "details.planet",
    "details.planet",
    "details.planet",
    "details.assumptions",
    "details.how",
    "p.note",
    "p.note",
  ]);
  const [rows, , , heading, ...rest] = parts;
  assert.deepEqual(rows.children.map(({ tag, textContent }) => `${tag}: ${textContent}`).slice(0, 2), ["dt: Local time", "dd: 10 Jan 2025, 17:35"]);
  assert.equal(heading.textContent, "Details");
  assert.equal(rest.at(-2).textContent, "Times are at UTC-05:00, the chart's offset.");
  assert.match(rest.at(-1).textContent, /^See it in Stellarium Web sends that moment/);
});

test("the planets' table has a column heading for each result and a row heading for each planet", async () => {
  const [, , table] = await drawnIn("en");
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
    ["Visible", "At dusk, 18:15: about 4,000 times brighter than needed", "See it in Stellarium Web"],
  ]);
  assert.equal(body.children[1].children[2].children[1].className, "detail");
});

test("a planet's Stellarium Web link opens in a new tab, with nothing of the page sent with it, and says what it opens", async () => {
  const [, , table] = await drawnIn("en");
  const link = table.children[1].children[1].children[2].children[2];
  assert.equal(link.tag, "a");
  assert.equal(link.href, "https://stellarium-web.org/skysource/Venus?date=2025-01-10T23%3A14%3A32Z&lat=40.7128&lng=-74.006&elev=0&fov=60");
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
  assert.equal(link.attributes["aria-label"], "See Venus at 18:15 in Stellarium Web");
});

test("a planet with no best moment has no link, and a page with no links has no note about them", async () => {
  const parts = await drawnIn("en", TROMSO);
  const [, , table] = parts;
  assert.deepEqual(table.children[1].children[1].children.map(cellText)[2], ["No prediction", "The Sun doesn't set or rise that day"]);
  assert.deepEqual(parts.filter(({ tag }) => tag === "p").map(({ textContent }) => textContent), ["Times are at UTC+02:00, the chart's offset."]);
});

test("each planet's details and the assumptions are closed boxes with their rows", async () => {
  const parts = await drawnIn("en");
  const boxes = parts.filter(({ className }) => className === "planet" || className === "assumptions").map(box);
  assert.deepEqual(
    boxes.map(({ summary }) => summary),
    ["Mercury: Too faint", "Venus: Visible", "Mars: Visible", "Jupiter: Visible", "Saturn: Visible", "Assumptions"],
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
  const [, , table] = parts;
  assert.deepEqual(table.children[1].children[1].children.map(cellText), [
    "Venus",
    ["Libre de los rayos · vespertino", "47,2° al este del Sol"],
    ["Visible", "Al anochecer, a las 18:15: unas 4000 veces más brillante de lo necesario", "Ver en Stellarium Web"],
  ]);
  const venus = box(parts.filter(({ className }) => className === "planet")[1]);
  assert.deepEqual(venus.rows[0], [
    "Anochecer",
    "Desde la puesta del Sol a las 16:49 hasta el final del crepúsculo astronómico a las 18:26, sobre el horizonte en 50 de 50 muestras",
  ]);
  assert.equal(parts.at(-2).textContent, "Las horas están en UTC-05:00, la diferencia horaria de la carta.");
});

test("in Slovenian, the page's words, decimal commas and counts", async () => {
  const parts = await drawnIn("sl");
  const [, , table] = parts;
  assert.deepEqual(table.children[1].children[1].children.map(cellText), [
    "Venera",
    ["Zunaj žarkov · na večernem nebu", "47,2° vzhodno od Sonca"],
    ["Lahko se vidi", "Najbolje v mraku, ob 18:15: približno 4000-krat več svetlobe, kot je potrebno", "Odpri v Stellarium Web"],
  ]);
  const boxes = parts.filter(({ className }) => className === "planet" || className === "assumptions").map(box);
  assert.deepEqual(boxes[1].rows[0], [
    "Večer",
    "Od sončnega zahoda ob 16:49 do konca astronomskega somraka ob 18:26, nad obzorjem v 50 od 50 vzorcev",
  ]);
  assert.deepEqual(boxes.at(-1).rows.find(([label]) => label === "Opazovalec"), ["Opazovalec", "Star 36 let, Snellenovo razmerje 1, z obema očesoma"]);
  assert.deepEqual(boxes.at(-1).rows.find(([label]) => label === "Vzorci"), ["Vzorci", "Na 2 minuti"]);
});

test("each result's heading carries how it's judged, under its name", async () => {
  const [, , table] = await drawnIn("en");
  const [, moment, prediction] = table.children[0].children[0].children;
  assert.equal(moment.children[0].textContent, "The traditional condition, from the longitude gap alone: cazimi within 17′, combust 8°30′, under the beams 15°");
  assert.match(prediction.children[0].textContent, /^Whether it was bright enough to see/);
});

test("How this is worked out is a closed box of steps, then a link to the method and its checks", async () => {
  const how = (await drawnIn("en")).find(({ className }) => className === "how");
  const [summary, steps, line] = how.children;
  assert.equal(summary.textContent, "How this is worked out");
  assert.equal(steps.tag, "ol");
  assert.equal(steps.children.length, 5);
  assert.match(steps.children[0].textContent, /^Brightness is measured in magnitudes, which run backwards/);
  const [link] = line.children;
  assert.equal(link.href, "https://github.com/KevinBlakeLopez/astrochart-bridge/blob/main/docs/HELIOSCOPE_V1_FEASIBILITY.md");
  assert.equal(link.rel, "noopener noreferrer");
});

test("the weather check sits between the chart's rows and the table: a button, then what it sends, and its click goes to the page", async () => {
  const clicks = [];
  const [, weather, table] = await drawnIn("en", NEW_YORK, undefined, () => clicks.push("weather"));
  assert.equal(`${weather.tag}.${weather.className}`, "div.weather");
  assert.equal(table.className, "planets");
  const [button, note] = weather.children;
  assert.deepEqual([button.tag, button.type, button.className, button.textContent], ["button", "button", "secondary", "Check that night's weather"]);
  assert.deepEqual(
    [note.tag, note.className, note.textContent],
    ["p", "note", "Sends the chart's month and its place, rounded to about 25\u00a0km, to open-meteo.com, whose logs may keep them for up to 90 days."],
  );
  button.listeners.click();
  assert.deepEqual(clicks, ["weather"]);
});

// The weather section's elements, as class and text.
const said = (section) => section.children.map(({ tag, className, textContent }) => `${className ? `${tag}.${className}` : tag}: ${textContent}`);

test("while asking it says so; a check that failed says why, with its code, over the button; one that can't be made says why, with no button", async () => {
  const [, asking] = await drawnIn("en", NEW_YORK, { kind: "asking" });
  assert.deepEqual(said(asking), ["p.note: Asking Open-Meteo…"]);
  const [, failed] = await drawnIn("en", NEW_YORK, { kind: "failed", reason: "http-400" });
  assert.deepEqual(said(failed), [
    "p.warning: Couldn't get the weather.",
    "p.code: Code: http-400",
    "button.secondary: Check that night's weather",
    "p.note: Sends the chart's month and its place, rounded to about 25\u00a0km, to open-meteo.com, whose logs may keep them for up to 90 days.",
  ]);
  const [, unreached] = await drawnIn("en", NEW_YORK, { kind: "refused", reason: "not-yet" });
  assert.deepEqual(said(unreached), ["p.note: ERA5 doesn't have that night yet: it runs about 5 days behind."]);
});

test("with the weather in, the section has its heading, the cloud at each twilight, a note, and the credit with its two links", async () => {
  const [, weather] = await drawnIn("en", NEW_YORK, WEATHER);
  const [title, line, note, credit] = weather.children;
  assert.deepEqual([title.tag, title.textContent], ["h2", "That night's weather, from ERA5"]);
  assert.deepEqual([line.tag, line.textContent], ["p", "Dusk: 90\u00a0% cloud at 18:00 · Dawn: no cloud at 07:00"]);
  assert.equal(note.className, "note");
  assert.match(note.textContent, /^The planets below are worked out again with that night's air\./);
  assert.equal(credit.className, "note");
  const [data, open, licence, rest] = credit.children;
  assert.deepEqual([open, rest], [" (", "), generated using Copernicus Climate Change Service information 2026."]);
  for (const [link, label, href] of [
    [data, "Weather data by Open-Meteo.com", "https://open-meteo.com/"],
    [licence, "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  ]) {
    assert.deepEqual([link.tag, link.textContent, link.href, link.target, link.rel], ["a", label, href, "_blank", "noopener noreferrer"]);
  }
});

test("in Spanish and Slovenian, the weather in each language's words and decimal commas", async () => {
  const [, spanish] = await drawnIn("es", NEW_YORK, WEATHER);
  assert.equal(spanish.children[1].textContent, "Anochecer: 90\u00a0% de nubes a las 18:00 · Amanecer: sin nubes a las 07:00");
  const [, slovenian] = await drawnIn("sl", NEW_YORK, WEATHER);
  assert.equal(slovenian.children[1].textContent, "Mrak: 90\u00a0% oblačnosti ob 18:00 · Svit: brez oblakov ob 07:00");
  const assumptions = (await drawnIn("es", NEW_YORK, WEATHER)).find(({ className }) => className === "assumptions");
  assert.deepEqual(box(assumptions).rows[1], ["Atmósfera esa noche", "Anochecer: 1007\u00a0hPa, 1,4\u00a0°C, 56\u00a0% de humedad · Amanecer: 1010,8\u00a0hPa, −2,8\u00a0°C, 65\u00a0% de humedad"]);
});
