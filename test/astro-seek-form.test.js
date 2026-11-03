import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ASTRO_SEEK_GENDERS,
  astroSeekSaveUrl,
  chooseGender,
  guardChartPlace,
  readCityList,
  savePlace,
  showCityChoice,
  typeCity,
} from "../extension/core/astroseek.js";

const NY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const NY_CITY = "New York, USA, New York (40n43, 74w0)";
const NYC_CITY = "New York City, USA, New York (40n43, 74w0)";

// Runs a page function from its source alone, as chrome.scripting does, with
// the page's document, Event and timers.
function runInPage(func, page, ...args) {
  const rebuilt = new Function("document", "Event", "setInterval", "clearInterval", "setTimeout", "args", `return (${func})(...args);`);
  return rebuilt(page.document, Event, page.timers.setInterval, page.timers.clearInterval, page.timers.setTimeout, args);
}

// A field that records what the page's scripts would hear.
function field(name, value = "") {
  const listeners = [];
  const element = {
    name,
    value,
    events: [],
    focused: false,
    parentElement: null,
    focus: () => (element.focused = true),
    blur: () => (element.focused = false),
    addEventListener: (type, listener) => listeners.push({ type, listener }),
    dispatchEvent: (event) => {
      element.events.push(event.type);
      for (const { type, listener } of listeners) if (type === event.type) listener(event);
    },
    // What the person typing does: a trusted event.
    personTypes: (text) => {
      element.value = text;
      for (const { type, listener } of listeners) if (type === "input") listener({ type: "input", isTrusted: true });
    },
    after: (node) => page.insert(node, name),
  };
  let page;
  element.attach = (owner) => (page = owner);
  return element;
}

// The Add person form's Gender, c_pohlavi, as seen signed in on 2026-11-01:
// Male 1, where it starts, Female 2, Nonbinary 3, Event 4, Davison rel. chart
// 5 and Horary question 6. A select keeps a value only when an option has it.
function genderSelect(value) {
  const element = field("c_pohlavi");
  let current = value;
  Object.defineProperty(element, "value", {
    get: () => current,
    set: (next) => (current = ["1", "2", "3", "4", "5", "6"].includes(next) ? next : ""),
  });
  return element;
}

// Timers the test advances by hand.
function fakeTimers() {
  const intervals = new Map();
  const timeouts = [];
  let next = 1;
  return {
    setInterval: (f) => (intervals.set(next, f), next++),
    clearInterval: (id) => intervals.delete(id),
    setTimeout: (f) => timeouts.push(f),
    tick: () => [...intervals.values()].forEach((f) => f()),
    runTimeouts: () => timeouts.splice(0).forEach((f) => f()),
    running: () => intervals.size,
  };
}

// The parts of the save page these functions use: the Add person form with
// the fields they touch, the list jQuery UI would add for Birth city, and the
// elements AstroChart Bridge adds.
function savePage({ city = "", place = savePlace(NY).values, missing = [], list = null, wrapper = true, gender = "1" } = {}) {
  const page = { inserted: [], clicked: [], timers: fakeTimers() };
  const names = ["narozeni_city", ...Object.keys(place)].filter((name) => !missing.includes(name));
  const fields = names.map((name) => field(name, name === "narozeni_city" ? city : place[name]));
  if (!missing.includes("c_pohlavi")) fields.push(genderSelect(gender));
  fields.forEach((element) => element.attach(page));
  const formListeners = [];
  const form = {
    dataset: {},
    elements: { namedItem: (name) => fields.find((element) => element.name === name) ?? null },
    addEventListener: (type, listener) => formListeners.push({ type, listener }),
    submit: () => formListeners.filter(({ type }) => type === "submit").forEach(({ listener }) => listener({ type: "submit" })),
  };
  const items = (list?.labels ?? []).map((text) => {
    const item = { textContent: ` ${text} `, click: () => page.clicked.push({ text, on: "li" }) };
    const inner = { click: () => page.clicked.push({ text, on: "wrapper" }) };
    item.querySelector = (selector) => (wrapper && selector === ".ui-menu-item-wrapper" ? inner : null);
    return item;
  });
  const menu = {
    style: { display: list?.open === false ? "none" : "" },
    querySelector: (selector) => (selector === "li.ui-menu-item" ? items[0] ?? null : null),
    querySelectorAll: (selector) => (selector === "li.ui-menu-item" ? items : []),
  };
  page.insert = (node, after) => {
    node.isConnected = true;
    node.after = after;
    page.inserted.push(node);
  };
  page.field = (name) => form.elements.namedItem(name);
  page.form = form;
  page.note = (id) => page.inserted.find((node) => node.id === id && node.isConnected) ?? null;
  page.document = {
    getElementById: (id) => (id === "form_jina_osoba" && !missing.includes("form") ? form : page.note(id)),
    querySelectorAll: (selector) => {
      if (!list) return [];
      if (selector === "ul.ui-autocomplete") return [menu];
      if (selector === "ul.ui-autocomplete li.ui-menu-item") return items;
      return [];
    },
    createElement: (tag) => {
      const children = [];
      const listeners = [];
      const element = {
        tag,
        id: "",
        style: {},
        textContent: "",
        children,
        isConnected: false,
        append: (...nodes) => children.push(...nodes),
        replaceChildren: (...nodes) => children.splice(0, children.length, ...nodes),
        addEventListener: (type, listener) => listeners.push({ type, listener }),
        click: () => listeners.filter(({ type }) => type === "click").forEach(({ listener }) => listener({ type: "click" })),
        remove: () => (element.isConnected = false),
      };
      return element;
    },
  };
  return page;
}

const message = (note) => note.children[0].textContent;
const buttons = (note) => note.children[1].children;

test("the chart's place is the save link's coordinates and UT/GMT, field by field", () => {
  for (const sky of [NY, { utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 }]) {
    const sent = Object.fromEntries(new URL(astroSeekSaveUrl(sky)).searchParams);
    const { values } = savePlace(sky);
    for (const [name, value] of Object.entries(values)) assert.equal(value, sent[name], name);
  }
  assert.equal(savePlace(NY).text, "40°43'N, 74°0'W");
  assert.equal(savePlace({ lat: -33.866667, lng: 151.2 }).text, "33°52'S, 151°12'E");
});

test("the town is typed into an empty Birth city, the way a person types it", () => {
  const page = savePage();
  assert.deepEqual(runInPage(typeCity, page, "New York"), { typed: true });
  const city = page.field("narozeni_city");
  assert.equal(city.value, "New York");
  assert.equal(city.focused, true);
  assert.deepEqual(city.events, ["input"]);
});

test("a Birth city with anything in it is left alone, and no form is unrecognised", () => {
  const typed = savePage({ city: "Boston" });
  assert.deepEqual(runInPage(typeCity, typed, "New York"), { typed: false, form: "city-typed" });
  assert.equal(typed.field("narozeni_city").value, "Boston");
  assert.deepEqual(runInPage(typeCity, savePage({ missing: ["form"] }), "New York"), { typed: false, form: "unrecognised" });
});

test("the list is read once it is open with matches, by each match's text", () => {
  const page = savePage({ city: "New York", list: { labels: [NY_CITY, NYC_CITY] } });
  assert.deepEqual(runInPage(readCityList, page, "New York"), { state: "listed", labels: [NY_CITY, NYC_CITY] });
});

test("no list, a closed one or an empty one is still waiting; another Birth city has changed", () => {
  assert.deepEqual(runInPage(readCityList, savePage({ city: "New York" }), "New York"), { state: "waiting" });
  assert.deepEqual(runInPage(readCityList, savePage({ city: "New York", list: { labels: [NY_CITY], open: false } }), "New York"), { state: "waiting" });
  assert.deepEqual(runInPage(readCityList, savePage({ city: "New York", list: { labels: [] } }), "New York"), { state: "waiting" });
  assert.deepEqual(runInPage(readCityList, savePage({ city: "Boston", list: { labels: [NY_CITY] } }), "New York"), { state: "changed" });
});

const PICK = { kind: "pick", match: { text: NY_CITY, away: "less than 1 km" } };

test("a pick is chosen in Astro-Seek's list, and the box says which, how far, and to check Gender", () => {
  const page = savePage({ city: "New York", list: { labels: [NYC_CITY, NY_CITY] } });
  assert.deepEqual(runInPage(showCityChoice, page, PICK, "New York", 25), { shown: true });
  assert.deepEqual(page.clicked, [{ text: NY_CITY, on: "wrapper" }]);
  const note = page.note("astrochart-bridge-city");
  assert.equal(note.after, "narozeni_city");
  assert.equal(
    message(note),
    `AstroChart Bridge: chose "${NY_CITY}" from Astro-Seek's list, less than 1 km from the chart's coordinates. Check Gender, which Astro-Seek starts at Male, then press Add person.`,
  );
  assert.deepEqual(buttons(note).map((button) => button.textContent), ["Choose another"]);
  assert.equal(page.field("narozeni_city").focused, false);
});

test("a chart's gender is Astro-Seek's option of the same name; a horary chart is a Horary question", () => {
  assert.deepEqual(ASTRO_SEEK_GENDERS, {
    male: { value: "1", label: "Male" },
    female: { value: "2", label: "Female" },
    event: { value: "4", label: "Event" },
    horary: { value: "6", label: "Horary question" },
  });
});

test("Gender is set to the chart's while it's still at Male, and the page hears it", () => {
  const page = savePage();
  assert.deepEqual(runInPage(chooseGender, page, ASTRO_SEEK_GENDERS.female.value), { set: true });
  assert.equal(page.field("c_pohlavi").value, "2");
  assert.deepEqual(page.field("c_pohlavi").events, ["change"]);
});

test("a Gender the person changed, a value with no option, or no Gender field, is left as it is", () => {
  const changed = savePage({ gender: "3" });
  assert.deepEqual(runInPage(chooseGender, changed, "2"), { set: false });
  assert.equal(changed.field("c_pohlavi").value, "3");
  const unknown = savePage();
  assert.deepEqual(runInPage(chooseGender, unknown, "9"), { set: false });
  assert.equal(unknown.field("c_pohlavi").value, "1");
  assert.deepEqual(unknown.field("c_pohlavi").events, []);
  assert.deepEqual(runInPage(chooseGender, savePage({ missing: ["c_pohlavi"] }), "2"), { set: false });
  assert.deepEqual(runInPage(chooseGender, savePage({ missing: ["form"] }), "2"), { set: false });
});

test("with the chart's Gender set, the box says so instead of that Astro-Seek starts at Male", () => {
  const page = savePage({ city: "New York", list: { labels: [NY_CITY] } });
  runInPage(showCityChoice, page, PICK, "New York", 25, "Female");
  assert.match(message(page.note("astrochart-bridge-city")), /coordinates\. Gender is Female, from the chart\. Check it, then press Add person\.$/);
  const noTown = savePage();
  runInPage(showCityChoice, noTown, { kind: "no-town" }, null, 25, "Horary question");
  assert.match(message(noTown.note("astrochart-bridge-city")), /stay as they are\. Gender is Horary question, from the chart\./);
});

test("a list with no .ui-menu-item-wrapper takes the click on its match itself", () => {
  const page = savePage({ city: "New York", list: { labels: [NY_CITY] }, wrapper: false });
  runInPage(showCityChoice, page, PICK, "New York", 25);
  assert.deepEqual(page.clicked, [{ text: NY_CITY, on: "li" }]);
});

test("asked, each near match is a button that chooses it", () => {
  const page = savePage({ city: "New York", list: { labels: [NY_CITY, NYC_CITY] } });
  const ask = { kind: "ask", matches: [{ text: NY_CITY, away: "less than 1 km" }, { text: NYC_CITY, away: "less than 1 km" }] };
  runInPage(showCityChoice, page, ask, "New York", 25);
  const note = page.note("astrochart-bridge-city");
  assert.match(message(note), /more than one of Astro-Seek's matches for "New York" is within 25 km/);
  assert.deepEqual(buttons(note).map((button) => button.textContent), [`${NY_CITY} (less than 1 km)`, `${NYC_CITY} (less than 1 km)`]);
  buttons(note)[1].click();
  assert.deepEqual(page.clicked, [{ text: NYC_CITY, on: "wrapper" }]);
  assert.match(message(note), /^AstroChart Bridge: chose "New York City/);
});

test("no near match, or no list in time, lists the matches again on request", () => {
  for (const [choice, words] of [
    [{ kind: "none", listed: 9 }, `none of Astro-Seek's 9 matches for "New York" is within 25 km of the chart's coordinates`],
    [{ kind: "none", listed: 1 }, `Astro-Seek's one match for "New York" isn't within 25 km of the chart's coordinates`],
    [{ kind: "no-list" }, `Astro-Seek didn't list its matches for "New York" in time`],
  ]) {
    const page = savePage({ city: "New York", list: { labels: [] } });
    runInPage(showCityChoice, page, choice, "New York", 25);
    const note = page.note("astrochart-bridge-city");
    assert.ok(message(note).includes(words), message(note));
    const city = page.field("narozeni_city");
    city.value = "New Yor";
    buttons(note)[0].click();
    assert.equal(note.isConnected, false);
    assert.equal(city.value, "New York");
    assert.equal(city.events.at(-1), "input");
  }
});

test("a chart with no town asks the person to type one, keeping its coordinates and UT/GMT", () => {
  const page = savePage();
  assert.deepEqual(runInPage(showCityChoice, page, { kind: "no-town" }, null, 25), { shown: true });
  assert.match(message(page.note("astrochart-bridge-city")), /the chart names no town.*the chart's coordinates and UT\/GMT stay as they are\. Check Gender/);
});

test("the box goes when the person types in Birth city, and isn't shown once it holds another town", () => {
  const page = savePage({ city: "New York", list: { labels: [NY_CITY] } });
  runInPage(showCityChoice, page, PICK, "New York", 25);
  page.field("narozeni_city").personTypes("Boston");
  assert.equal(page.note("astrochart-bridge-city"), null);
  assert.deepEqual(runInPage(showCityChoice, savePage({ city: "Boston" }), PICK, "New York", 25), { shown: false });
});

test("the guard leaves the chart's place alone while nothing changes it", () => {
  const page = savePage();
  assert.deepEqual(runInPage(guardChartPlace, page, savePlace(NY)), { guarding: true });
  page.timers.tick();
  assert.equal(page.note("astrochart-bridge-place"), null);
});

test("coordinates or a time zone the page changes are set back, quietly, with a note", () => {
  const page = savePage();
  runInPage(guardChartPlace, page, savePlace(NY));
  // What choosing a city might do: the city's coordinates and Astro-Seek's automatic zone.
  page.field("narozeni_sirka_minuty").value = "42";
  page.field("narozeni_timezone_form").value = "auto";
  page.field("narozeni_timezone_dst_form").value = "auto";
  page.timers.tick();
  assert.deepEqual(
    ["narozeni_sirka_minuty", "narozeni_timezone_form", "narozeni_timezone_dst_form"].map((name) => page.field(name).value),
    ["43", "0", "0"],
  );
  assert.deepEqual(page.field("narozeni_timezone_form").events, []);
  const note = page.note("astrochart-bridge-place");
  assert.equal(note.after, "narozeni_timezone_dst_form");
  assert.equal(
    note.textContent,
    "AstroChart Bridge: Astro-Seek changed the latitude, longitude or time zone, so the chart's are back: 40°43'N, 74°0'W, UT/GMT with no daylight saving. Change them here yourself if you mean to.",
  );
});

test("a field the person changes is theirs", () => {
  const page = savePage();
  runInPage(guardChartPlace, page, savePlace(NY));
  page.field("narozeni_timezone_form").personTypes("-5");
  page.timers.tick();
  assert.equal(page.field("narozeni_timezone_form").value, "-5");
  assert.equal(page.note("astrochart-bridge-place"), null);
});

test("the guard starts once, and stops when the form is submitted or after its time", () => {
  const page = savePage();
  runInPage(guardChartPlace, page, savePlace(NY));
  assert.deepEqual(runInPage(guardChartPlace, page, savePlace(NY)), { guarding: true });
  assert.equal(page.timers.running(), 1);
  page.form.submit();
  assert.equal(page.timers.running(), 0);

  const later = savePage();
  runInPage(guardChartPlace, later, savePlace(NY));
  later.timers.runTimeouts();
  assert.equal(later.timers.running(), 0);
});

test("a form missing a field the guard keeps isn't guarded", () => {
  assert.deepEqual(runInPage(guardChartPlace, savePage({ missing: ["narozeni_timezone_dst_form"] }), savePlace(NY)), { guarding: false });
  assert.deepEqual(runInPage(guardChartPlace, savePage({ missing: ["form"] }), savePlace(NY)), { guarding: false });
});
