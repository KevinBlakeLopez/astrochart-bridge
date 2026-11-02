import { test } from "node:test";
import assert from "node:assert/strict";
import { TOWN_LIMIT_KM, chooseTown, readTownList, showTownChoice } from "../extension/core/astrocom.js";

// astro.com's matches as its list showed them on 2026-11-01, abridged.
const NEW_YORK_LIST = [
  "New York, FL (US) = Florida, 30n50, 87w12",
  "New York, GA (US) = Georgia (US), 34n03, 85w03",
  "New York, NY (US) = New York, 40n43, 74w00",
  "New York, TX (US) = Texas, 32n10, 95w40",
  "New York City, NY (US) = New York, 40n43, 74w00",
  "New York & Greenwood Lak, NJ (US), 40n46, 74w09",
  "New York Hospital Bellevue, NY (US), 40n4423, 73w5834",
];
const LONDON_LIST = [
  "London (Conecuh County), AL (US) = Alabama, 31n18, 87w05",
  "London (Montgomery County), AL (US), 32n16, 86w03",
  "London, ENG (UK) = England (UK), 51n30, 0w10",
  "London, KIRI = Kiribati, 1n58, 157w28",
  "London Whittington Hospital, ENG (UK), 51n3359, 0w0822",
];
const NEW_YORK = { town: "New York", lat: 40.716667, lng: -74 };
const LONDON = { town: "London", lat: 51.507, lng: -0.128 };

test("the near match named as the chart's town is chosen, over another at the same place", () => {
  assert.deepEqual(chooseTown(NEW_YORK_LIST, NEW_YORK), {
    kind: "pick",
    match: { text: "New York, NY (US) = New York, 40n43, 74w00", away: "less than 1 km" },
  });
});

test("the chart's coordinates decide, not astro.com's order: London, England for a chart in London", () => {
  assert.deepEqual(chooseTown(LONDON_LIST, LONDON), {
    kind: "pick",
    match: { text: "London, ENG (UK) = England (UK), 51n30, 0w10", away: "3 km" },
  });
  const alabama = { town: "London", lat: 31.3, lng: -87.083333 };
  assert.equal(chooseTown(LONDON_LIST, alabama).match.text, LONDON_LIST[0]);
});

test("the town is compared without its case, accents or anything after its first comma", () => {
  const items = ["Guarulhos, BRAS = Brazil, 23s28, 46w32", "São Paulo, BRAS = Brazil, 23s3309, 46w3729"];
  for (const town of ["Sao Paulo", "SÃO  PAULO, Brazil"]) {
    const choice = chooseTown(items, { town, lat: -23.55, lng: -46.633333 });
    assert.equal(choice.kind, "pick", town);
    assert.equal(choice.match.text, items[1], town);
  }
});

test("with no match named as the town, the only near match is chosen", () => {
  const choice = chooseTown(LONDON_LIST, { town: "Westminster", lat: 51.5, lng: -0.166667 });
  // Whittington Hospital is 7.5 km away, inside the limit, so this asks; without it, the one near match is chosen.
  assert.equal(choice.kind, "ask");
  const alone = chooseTown(LONDON_LIST.slice(0, 4), { town: "Westminster", lat: 51.5, lng: -0.166667 });
  assert.deepEqual(alone, { kind: "pick", match: { text: LONDON_LIST[2], away: "less than 1 km" } });
});

test("several near matches and none named as the town: the person is asked, nearest first", () => {
  assert.deepEqual(chooseTown(NEW_YORK_LIST, { ...NEW_YORK, town: "Manhattan" }), {
    kind: "ask",
    matches: [
      // Two at the same place keep astro.com's order.
      { text: "New York, NY (US) = New York, 40n43, 74w00", away: "less than 1 km" },
      { text: "New York City, NY (US) = New York, 40n43, 74w00", away: "less than 1 km" },
      { text: "New York Hospital Bellevue, NY (US), 40n4423, 73w5834", away: "3 km" },
      { text: "New York & Greenwood Lak, NJ (US), 40n46, 74w09", away: "14 km" },
    ],
  });
});

test("two near matches both named as the town: the person is asked", () => {
  const twins = ["Springfield, XX, 40n00, 74w00", "Springfield, YY, 40n05, 74w00"];
  assert.equal(chooseTown(twins, { town: "Springfield", lat: 40, lng: -74 }).kind, "ask");
});

test(`no match within ${TOWN_LIMIT_KM} km chooses nothing, and says how many were listed`, () => {
  assert.deepEqual(chooseTown(LONDON_LIST.slice(0, 2), LONDON), { kind: "none", listed: 2 });
  // 0.25° of latitude is about 28 km.
  assert.equal(chooseTown(["London, ENG (UK), 51n45, 0w0740"], LONDON).kind, "none");
});

test("a match whose coordinates can't be read is left out", () => {
  const items = ["London, ENG (UK)", "London, ENG (UK), 51n30, 0x10", "London, ENG (UK), 51n30"];
  assert.deepEqual(chooseTown(items, LONDON), { kind: "none", listed: 3 });
});

// --- Choosing in a stand-in page ---------------------------------------------

// The browser sends the tab only the function's source, so it is rebuilt from
// its source here, as in test/astro-com-form.test.js.
function runInPage(func, document, ...args) {
  return new Function("document", "args", `return (${func})(...args);`)(document, args);
}

function element(tag, page) {
  const el = { tag, children: [], style: {}, listeners: {}, events: [], textContent: "" };
  el.append = (...children) => el.children.push(...children);
  el.replaceChildren = (...children) => (el.children = children);
  el.addEventListener = (type, listener) => (el.listeners[type] ??= []).push(listener);
  el.dispatchEvent = (event) => {
    el.events.push(event.type);
    for (const listener of el.listeners[event.type] ?? []) listener(event);
  };
  el.click = () => el.dispatchEvent({ type: "click" });
  el.focus = () => (el.focused = true);
  el.blur = () => (el.focused = false);
  el.after = (next) => (page.note = next);
  el.remove = () => page.note === el && (page.note = null);
  Object.defineProperty(el, "isConnected", { get: () => page.note === el });
  return el;
}

// ade.cgi's town field and astro.com's list of its matches, as seen on
// 2026-11-01. Clicking a match puts its text in the town field, as astro.com does.
function townPage({ scit = "New York", items = NEW_YORK_LIST, open = true } = {}) {
  const page = { note: null, clicked: [] };
  page.scit = element("input", page);
  page.scit.value = scit;
  page.items = items.map((text) => {
    const item = element("div", page);
    item.textContent = text;
    item.addEventListener("click", () => {
      page.clicked.push(text);
      page.scit.value = text;
    });
    return item;
  });
  const menu = { style: { display: open ? "" : "none" }, querySelectorAll: () => page.items };
  const form = { elements: { namedItem: (name) => (name === "scit" ? page.scit : null) } };
  page.document = {
    forms: { namedItem: (name) => (name === "start" ? form : null) },
    querySelectorAll: (selector) =>
      ({ "ul.ui-autocomplete": [menu], "ul.ui-autocomplete .ui-menu-item-wrapper": page.items })[selector] ?? [],
    getElementById: (id) => (id === "astrochart-bridge-town" ? page.note : null),
    createElement: (tag) => element(tag, page),
  };
  page.buttons = () => page.note.children[1].children;
  page.say = () => page.note.children[0].textContent;
  return page;
}

test("the list is read once it opens, and only while the town field holds the town filled in", () => {
  assert.deepEqual(runInPage(readTownList, townPage({ open: false }).document, "New York"), { state: "waiting" });
  assert.deepEqual(runInPage(readTownList, townPage().document, "New York"), { state: "listed", items: NEW_YORK_LIST });
  assert.deepEqual(runInPage(readTownList, townPage({ scit: "Brooklyn" }).document, "New York"), { state: "changed" });
});

test("a chosen match is clicked, and the box says which and how far, with Choose another", () => {
  const page = townPage();
  const choice = chooseTown(NEW_YORK_LIST, NEW_YORK);
  assert.deepEqual(runInPage(showTownChoice, page.document, choice, "New York", TOWN_LIMIT_KM), { shown: true });
  assert.deepEqual(page.clicked, [NEW_YORK_LIST[2]]);
  assert.equal(
    page.say(),
    `AstroChart Bridge: chose "${NEW_YORK_LIST[2]}" from astro.com's list, less than 1 km from the chart's coordinates.`,
  );
  assert.equal(page.note.style.cssText.includes("#888"), true);
  assert.deepEqual(page.buttons().map((button) => button.textContent), ["Choose another"]);
  // A chosen match leaves the cursor where fillForm put it.
  assert.equal(page.scit.focused, undefined);

  // Choose another types the town again for astro.com to list its matches, and the box goes.
  page.buttons()[0].click();
  assert.equal(page.note, null);
  assert.equal(page.scit.value, "New York");
  assert.equal(page.scit.focused, true);
  assert.deepEqual(page.scit.events, ["input"]);
});

test("asked, the box lists the near matches as buttons, and a button chooses its match", () => {
  const page = townPage({ scit: "Manhattan" });
  runInPage(showTownChoice, page.document, chooseTown(NEW_YORK_LIST, { ...NEW_YORK, town: "Manhattan" }), "Manhattan", 25);
  assert.deepEqual(page.clicked, []);
  assert.match(page.say(), /more than one of astro.com's matches for "Manhattan" is within 25 km/);
  assert.equal(page.note.style.cssText.includes("#b00020"), true);
  assert.equal(page.buttons()[2].textContent, `${NEW_YORK_LIST[6]} (3 km)`);
  // The town field loses focus, so astro.com closes its list, which would cover the box.
  assert.equal(page.scit.focused, false);

  page.buttons()[2].click();
  assert.deepEqual(page.clicked, [NEW_YORK_LIST[6]]);
  assert.match(page.say(), /chose "New York Hospital Bellevue[^"]*" from astro.com's list, 3 km from the chart's coordinates\.$/);
  assert.deepEqual(page.buttons().map((button) => button.textContent), ["Choose another"]);
});

test("a match no longer in astro.com's list isn't clicked, and the box says so", () => {
  const page = townPage({ scit: "Manhattan" });
  runInPage(showTownChoice, page.document, chooseTown(NEW_YORK_LIST, { ...NEW_YORK, town: "Manhattan" }), "Manhattan", 25);
  page.items = [];
  page.buttons()[0].click();
  assert.deepEqual(page.clicked, []);
  assert.match(page.say(), /astro.com's list no longer has "New York, NY/);
  assert.deepEqual(page.buttons().map((button) => button.textContent), ["List the matches again"]);
});

test("with no near match, the box says so, chooses nothing, and can list the matches again", () => {
  const page = townPage({ scit: "London", items: LONDON_LIST.slice(0, 2) });
  runInPage(showTownChoice, page.document, { kind: "none", listed: 2 }, "London", 25);
  assert.deepEqual(page.clicked, []);
  assert.equal(
    page.say(),
    `AstroChart Bridge: none of astro.com's 2 matches for "London" is within 25 km of the chart's coordinates. Choose the town from astro.com's list, or type a nearer one.`,
  );
  assert.deepEqual(page.buttons().map((button) => button.textContent), ["List the matches again"]);
  assert.equal(page.scit.focused, false);
  page.buttons()[0].click();
  assert.equal(page.note, null);
  assert.equal(page.scit.focused, true);
  assert.deepEqual(page.scit.events, ["input"]);
  runInPage(showTownChoice, page.document, { kind: "none", listed: 1 }, "London", 25);
  assert.match(page.say(), /astro.com's one match for "London" isn't within 25 km/);
});

test("the box goes once the person types in the town field, not when the script does", () => {
  const page = townPage();
  runInPage(showTownChoice, page.document, chooseTown(NEW_YORK_LIST, NEW_YORK), "New York", 25);
  page.scit.dispatchEvent({ type: "input", isTrusted: false });
  assert.notEqual(page.note, null);
  page.scit.dispatchEvent({ type: "input", isTrusted: true });
  assert.equal(page.note, null);
});

test("nothing is shown or chosen once the town field holds anything but the town filled in", () => {
  const page = townPage({ scit: "Brooklyn" });
  const choice = chooseTown(NEW_YORK_LIST, NEW_YORK);
  assert.deepEqual(runInPage(showTownChoice, page.document, choice, "New York", 25), { shown: false });
  assert.deepEqual(page.clicked, []);
  assert.equal(page.note, null);
});
