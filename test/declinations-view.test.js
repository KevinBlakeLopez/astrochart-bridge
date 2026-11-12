// The declinations page as declinations-view.js draws it, from real results.
// The preview can't serve a worktree's extension, so this is where the drawn
// page is checked: what each element says, and in which order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ANGLES, DWARF_PLANETS, PLANETS } from "../extension/core/declinations.js";
import { createEngine } from "../extension/helioscope-engine.js";
import { setLanguage } from "../extension/messages/index.js";
import {
  EPHEMERIS_FILES,
  declinationsFor,
  viewForDeclinations,
  viewForFailure,
  viewForRefusal,
} from "../extension/declinations-model.js";
import { drawScreen } from "../extension/declinations-view.js";

// Just enough of a page to draw into, as test/parans-view.test.js has it.
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

const LONDON = {
  kind: "natal", site: null, local: "2024-04-10T15:30:00", zoneLabel: null, lat: 51.5074, lng: -0.1278,
  utc: "2024-04-10T14:30:00Z", utcSource: "declared", offsetMinutes: 60,
};

function drawn(view) {
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  drawScreen(container, view);
  return container.parts;
}

async function drawnIn(code, orb = 1) {
  setLanguage([code]);
  const files = Object.fromEntries(EPHEMERIS_FILES.map((name) => [
    name,
    new Uint8Array(readFileSync(new URL(`../extension/vendor/swisseph/ephe/${name}`, import.meta.url))),
  ]));
  const engine = await createEngine({ ephemerisFiles: files });
  try {
    return drawn(viewForDeclinations(LONDON, declinationsFor(LONDON, engine, { orb }), { orb }));
  } finally {
    engine.dispose();
    setLanguage(["en"]);
  }
}

const said = (node) => (typeof node === "string" ? [node] : [node.textContent, ...node.children.flatMap(said)].filter(Boolean));
const tags = (parts) => parts.map(({ tag, className }) => (className ? `${tag}.${className}` : tag));

test("drawScreen: the chart's rows, the contacts' heading and table, every declination and the assumptions closed, then the note", async () => {
  const parts = await drawnIn("en");
  assert.deepEqual(tags(parts), ["dl", "h2", "table.contacts", "details.declinations", "details.assumptions", "p.note"]);
  assert.equal(parts[1].textContent, "Parallels and contra-parallels within 1°");
  const [head, body] = parts[2].children;
  assert.deepEqual(said(head), ["Contact", "Orb"]);
  assert.deepEqual(head.children[0].children.map((cell) => cell.attributes.scope), ["col", "col"]);
  assert.equal(body.children.length, 6);
  // The pair over its kind, and the orb over both declinations.
  assert.deepEqual(said(body.children[4]), ["Sedna – Sun", "Parallel", "0°20′", "8°36′ N and 8°16′ N"]);
  assert.deepEqual(body.children[4].children.map((cell) => cell.children.map(({ className }) => className)), [["", "detail"], ["", "detail"]]);
});

test("drawScreen: every declination and the assumptions are closed until opened", async () => {
  const parts = await drawnIn("en");
  const [summary, list] = parts[3].children;
  assert.equal(summary.tag, "summary");
  assert.equal(summary.textContent, "Every declination");
  assert.deepEqual(said(list).slice(0, 4), ["Ceres", "23°36′ S", "Eris", "0°28′ S"]);
  const [assumptions, rows] = parts[4].children;
  assert.equal(assumptions.textContent, "Assumptions");
  assert.deepEqual(said(rows).slice(0, 2), ["Ephemeris", "Swiss Ephemeris 2.10.03, Moshier"]);
});

// Every point at 1°, made by hand, with no contacts.
const NO_CONTACTS = {
  result: {
    kind: "declinations",
    points: Object.fromEntries([...DWARF_PLANETS, ...ANGLES, ...PLANETS].map((point) => [point, { declination: 1 }])),
    obliquity: 23.44,
    assumptions: { swissEphemeris: "2.10.03" },
  },
  contacts: [],
};

test("drawScreen: with no contacts in the orb, a line saying so takes the table's place, in Spanish", () => {
  setLanguage(["es"]);
  try {
    const view = viewForDeclinations(LONDON, NO_CONTACTS, { orb: 0.5 });
    const shown = drawn(view);
    assert.deepEqual(tags(shown), ["dl", "h2", "p.note", "details.declinations", "details.assumptions", "p.note"]);
    assert.equal(shown[2].textContent,
      "Ningún planeta enano está en paralelo ni en contraparalelo con el Ascendente, el MC, el Vértex o un planeta a menos de 0,5°.");
  } finally {
    setLanguage(["en"]);
  }
});

test("drawScreen: a refusal or a failure is its message with its code, and no chart is the message alone", () => {
  assert.deepEqual(said({ children: drawn(viewForRefusal("at-pole")) }), [
    "At the poles the Ascendant, MC and Vertex aren't defined, so the contacts can't be worked out.",
    "Code: at-pole",
  ]);
  assert.deepEqual(said({ children: drawn(viewForFailure({ point: "sedna", failure: { reason: "no-ephemeris-file" } })) }), [
    "Swiss Ephemeris couldn't work out Sedna's declination, so the contacts can't be worked out.",
    "Code: no-ephemeris-file",
  ]);
  assert.deepEqual(tags(drawn(viewForRefusal(null))), ["p"]);
});
