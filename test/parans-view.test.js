// The parans page as parans-view.js draws it, from real results. The preview
// can't serve a worktree's extension, so this is where the drawn page is
// checked: what each element says, and in which order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../extension/helioscope-engine.js";
import { setLanguage } from "../extension/messages/index.js";
import { DEFAULT_SETTINGS, paransFor, viewForFailure, viewForParans, viewForRefusal } from "../extension/parans-model.js";
import { drawScreen } from "../extension/parans-view.js";

// Just enough of a page to draw into, as test/helioscope-view.test.js has it.
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

// test/parans-reference.json's London case, at British Summer Time.
const LONDON = {
  kind: "natal", site: null, local: "2024-04-10T15:30:00", zoneLabel: null, lat: 51.5074, lng: -0.1278,
  utc: "2024-04-10T14:30:00Z", utcSource: "declared", offsetMinutes: 60,
};
const SETTINGS = { ...DEFAULT_SETTINGS, bodies: [...DEFAULT_SETTINGS.bodies] };

// What the page draws for a view: the container's new children.
function drawn(view) {
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  drawScreen(container, view);
  return container.parts;
}

// The London screen, drawn in a language, with the settings given.
async function drawnIn(code, settings = SETTINGS) {
  setLanguage([code]);
  const engine = await createEngine();
  try {
    return drawn(viewForParans(LONDON, paransFor(LONDON, engine, settings), settings));
  } finally {
    engine.dispose();
    setLanguage(["en"]);
  }
}

// An element's text and its children's, depth first, as a screen reader
// would come to them.
const said = (node) => (typeof node === "string" ? [node] : [node.textContent, ...node.children.flatMap(said)].filter(Boolean));
const tags = (parts) => parts.map(({ tag, className }) => (className ? `${tag}.${className}` : tag));

test("drawScreen: the chart's rows, the parans' heading and table, every event and the assumptions closed, then the notes", async () => {
  const parts = await drawnIn("en");
  assert.deepEqual(tags(parts), ["dl", "h2", "table.parans", "details.events", "details.assumptions", "p.note", "p.note"]);
  assert.equal(parts[1].textContent, "Parans within 1° of ARMC");
  const [head, body] = parts[2].children;
  assert.deepEqual(said(head), ["Paran", "Apart"]);
  assert.deepEqual(head.children[0].children.map((cell) => cell.attributes.scope), ["col", "col"]);
  assert.equal(body.children.length, 7);
  // The closest first: each event on its own line, and the time under the ARMC.
  assert.deepEqual(said(body.children[0]), ["Saturn sets at 16:11", "Mars sets at 16:11", "0.14° of ARMC", "33 s"]);
  assert.deepEqual(body.children[0].children.map((cell) => cell.children.map(({ className }) => className)), [["", "detail"], ["", "detail"]]);
  assert.deepEqual(said(body.children[6]), ["Mars rises at 05:26", "Saturn rises at 05:30", "0.89° of ARMC", "3 min 33 s"]);
  assert.equal(parts[5].textContent, "Times are at UTC+01:00, the chart's offset.");
});

test("drawScreen: every event is closed until opened, with what it lists, the events in time order, then what didn't happen", async () => {
  const parts = await drawnIn("en");
  const [summary, note, list] = parts[3].children;
  assert.equal(summary.tag, "summary");
  assert.equal(summary.textContent, "Every event");
  assert.equal(note.textContent, "Every rising, setting and culmination in the 24 hours around the chart's moment");
  assert.equal(list.tag, "dl");
  assert.deepEqual(said(list).slice(0, 4), ["04:11", "Pluto rises · ARMC 246.54°", "05:26", "Mars rises · ARMC 265.27°"]);
  // London has nothing missing, so nothing follows the list.
  assert.equal(parts[3].children.length, 3);
  const [assumptions, rows] = parts[4].children;
  assert.equal(assumptions.textContent, "Assumptions");
  assert.deepEqual(said(rows).slice(0, 2), ["Ephemeris", "Swiss Ephemeris 2.10.03, Moshier"]);
});

test("drawScreen: with no parans in the orb, a line saying so takes the table's place, in Slovenian", async () => {
  const parts = await drawnIn("sl", { ...SETTINGS, orb: 0.25, bodies: ["sun", "moon"] });
  assert.deepEqual(tags(parts), ["dl", "h2", "p.note", "details.events", "details.assumptions", "p.note", "p.note"]);
  assert.equal(parts[1].textContent, "Parani znotraj 0,25° ARMC");
  assert.equal(
    parts[2].textContent,
    "Nobeni dve od teh teles nista na kotih znotraj 0,25° ARMC drugo od drugega v 24 urah okoli trenutka horoskopa.",
  );
});

test("drawScreen: the risings and settings that didn't happen follow the events", () => {
  const view = viewForParans(
    LONDON,
    {
      events: {
        events: [],
        noRiseOrSet: [{ point: "sun", event: "set" }],
        window: { start: { utc: "2024-04-10T02:30:00Z" }, end: { utc: "2024-04-11T02:30:00Z" } },
        assumptions: { swissEphemeris: "2.10.03", refineLeadMinutes: 3, elevation: { metres: 0, source: "default" } },
      },
      parans: [],
    },
    SETTINGS,
  );
  const box = drawn(view)[3];
  assert.deepEqual(said(box.children.at(-1)), ["The Sun doesn't set that day"]);
  assert.equal(box.children.at(-1).className, "note");
});

test("drawScreen: a refusal or a failure is its message with its code, and no chart is the message alone", () => {
  assert.deepEqual(said({ children: drawn(viewForRefusal("at-pole")) }), [
    "At the poles there's no meridian for the bodies to culminate on, so there are no parans.",
    "Code: at-pole",
  ]);
  const failed = drawn(viewForFailure({ point: "venus", event: "upper-transit", failure: { reason: "not-finite" } }));
  assert.deepEqual(said({ children: failed }), [
    "Swiss Ephemeris couldn't work out when Venus culminates, so the parans can't be worked out.",
    "Code: not-finite",
  ]);
  assert.deepEqual(tags(drawn(viewForRefusal(null))), ["p"]);
});
