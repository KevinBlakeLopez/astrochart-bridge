import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fillForm,
  formTime,
  formValues,
  isAstroComPage,
  isBirthDataForm,
  readFormPage,
  watchZone,
  zoneCheck,
  zoneWords,
} from "../extension/core/astrocom.js";
import { HOLD_MINUTES, heldForTab, holdForTab, releaseTab } from "../extension/pending.js";
import { viewForAstroComTab } from "../extension/popup-model.js";

// What the astro.com screens keep for a tab: the sky, and a local time, town and name or null.
const NY_SKY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74, local: null, town: null, name: null };
const SYDNEY_SKY = { utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2, local: null, town: "Sydney", name: null };
const NAMED_SKY = { ...NY_SKY, name: { first: "Example", last: "Person" } };
const FORM_URL = "https://www.astro.com/cgi/ade.cgi";
const SIGN_IN_URL = "https://www.astro.com/cgi/awd.cgi?lang=e";
const CREATE_ACCOUNT_URL = "https://www.astro.com/cgi/scus.cgi?act=new&";

// A stand-in for chrome.storage.session: get(null) returns everything, get(key)
// only that key, and every call answers asynchronously.
function fakeStorage() {
  const items = {};
  return {
    items,
    async get(keys) {
      if (keys === null) return { ...items };
      return Object.fromEntries([keys].flat().filter((key) => key in items).map((key) => [key, items[key]]));
    },
    async set(more) {
      Object.assign(items, structuredClone(more));
    },
    async remove(keys) {
      for (const key of [keys].flat()) delete items[key];
    },
  };
}

const MINUTE = 60_000;
const T0 = Date.parse("2026-11-01T12:00:00Z");

test("only www.astro.com pages count, and only ade.cgi is the birth data form", () => {
  assert.equal(isAstroComPage(SIGN_IN_URL), true);
  assert.equal(isBirthDataForm(FORM_URL), true);
  assert.equal(isBirthDataForm(`${FORM_URL}?lang=e`), true);
  assert.equal(isBirthDataForm(SIGN_IN_URL), false);
  for (const url of ["https://astro.com.example.com/cgi/ade.cgi", "http://www.astro.com/cgi/ade.cgi", "not a url"]) {
    assert.equal(isAstroComPage(url), false, url);
    assert.equal(isBirthDataForm(url), false, url);
  }
});

test("the form's values are the UTC date and time, in the option values ade.cgi uses", () => {
  // Seen on 2026-11-01: imon's values are 1 to 12, ihou's 0 to 23 (after "" and "u"),
  // and "h0w" is the first " 00:00 GMT / UT" time zone.
  assert.deepEqual(formValues(NY_SKY), { sday: "17", imon: "4", syar: "2024", ihou: "12", smin: "00", szon: "h0w" });
  assert.deepEqual(formValues({ ...NY_SKY, utc: "2024-01-04T05:07:30Z" }), {
    sday: "4", imon: "1", syar: "2024", ihou: "5", smin: "07", szon: "h0w",
  });
});

test("a chart's local time goes in with astro.com's automatic time zone, au", () => {
  const local = "2024-04-17T08:00:00";
  assert.deepEqual(formTime({ utc: NY_SKY.utc, local }), { time: local, szon: "au" });
  assert.deepEqual(formValues({ ...NY_SKY, local }), { sday: "17", imon: "4", syar: "2024", ihou: "8", smin: "00", szon: "au" });
  // The local date is the one filled in, where it differs from the UTC date.
  const late = formValues({ ...NY_SKY, utc: "2024-04-18T02:30:00Z", local: "2024-04-17T22:30:00" });
  assert.deepEqual([late.sday, late.ihou, late.smin], ["17", "22", "30"]);
});

test("a sky with no local time, or a local time that is UT, goes in as UT with h0w", () => {
  assert.deepEqual(formTime({ utc: NY_SKY.utc }), { time: "2024-04-17T12:00:00", szon: "h0w" });
  assert.deepEqual(formTime({ utc: NY_SKY.utc, local: null }), { time: "2024-04-17T12:00:00", szon: "h0w" });
  // A chart entered in UT, as AstroChart Bridge opens Astro-Seek's: with au,
  // astro.com would read 12:00 as the chosen town's local time.
  assert.deepEqual(formTime({ utc: NY_SKY.utc, local: "2024-04-17T12:00:00" }), { time: "2024-04-17T12:00:00", szon: "h0w" });
});

test("a town goes in the birth town field, scit", () => {
  assert.equal(formValues(SYDNEY_SKY).scit, "Sydney");
  assert.equal("scit" in formValues(NY_SKY), false);
});

test("a name goes in the first and last name fields, sfnm and snam", () => {
  assert.equal(formValues(NAMED_SKY).sfnm, "Example");
  assert.equal(formValues(NAMED_SKY).snam, "Person");
  // A name read as one string, such as an event's, is all last name, as astro.com's own records keep it.
  const event = formValues({ ...NY_SKY, name: { first: "", last: "Moon landing" } });
  assert.deepEqual([event.sfnm, event.snam], ["", "Moon landing"]);
  assert.equal("sfnm" in formValues(NY_SKY), false);
  assert.equal("snam" in formValues(NY_SKY), false);
});

// --- Values kept for the astro.com tab -------------------------------------

test("the values survive the tab's navigation: what was kept for a tab comes back for it", async () => {
  const storage = fakeStorage();
  await holdForTab(storage, 7, NY_SKY, T0);
  // Signing in navigates the tab but keeps its id; nothing else touches the storage.
  assert.deepEqual(await heldForTab(storage, 7, T0 + 10 * MINUTE), NY_SKY);
  assert.equal(await heldForTab(storage, 8, T0), null);
});

test("only the decided UTC, place and town are kept, with the time they were kept", async () => {
  const storage = fakeStorage();
  await holdForTab(storage, 7, { ...SYDNEY_SKY, extra: "not kept" }, T0);
  assert.deepEqual(Object.values(storage.items), [{ values: SYDNEY_SKY, heldAt: T0 }]);
});

test("a chart's local time is kept, and anything but a local time comes back as none", async () => {
  const storage = fakeStorage();
  const local = "2024-04-17T08:00:00";
  await holdForTab(storage, 7, { ...NY_SKY, local }, T0);
  assert.deepEqual(await heldForTab(storage, 7, T0), { ...NY_SKY, local });
  for (const bad of ["2024-04-17 08:00", "2024-04-17T08:00:00Z", 8, {}]) {
    await holdForTab(storage, 7, { ...NY_SKY, local: bad }, T0);
    assert.equal((await heldForTab(storage, 7, T0)).local, null, JSON.stringify(bad));
  }
});

test("a name is kept as its two parts, and anything else with it is dropped", async () => {
  const storage = fakeStorage();
  await holdForTab(storage, 7, { ...NAMED_SKY, name: { ...NAMED_SKY.name, sex: "e" } }, T0);
  assert.deepEqual(await heldForTab(storage, 7, T0), NAMED_SKY);
});

test("a name with both parts empty, or not two strings, comes back as no name", async () => {
  const storage = fakeStorage();
  for (const name of [{ first: "", last: "" }, { first: "Example" }, "Example Person", { first: 1, last: "Person" }]) {
    await holdForTab(storage, 7, { ...NY_SKY, name }, T0);
    assert.deepEqual(await heldForTab(storage, 7, T0), NY_SKY, JSON.stringify(name));
  }
});

test("values kept with no town come back with a null town", async () => {
  const storage = fakeStorage();
  const { town, ...sky } = NY_SKY;
  await holdForTab(storage, 7, sky, T0);
  assert.deepEqual(await heldForTab(storage, 7, T0), NY_SKY);
});

test("a cancelled conversion doesn't come back", async () => {
  const storage = fakeStorage();
  await holdForTab(storage, 7, NY_SKY, T0);
  await releaseTab(storage, 7);
  assert.equal(await heldForTab(storage, 7, T0), null);
  assert.deepEqual(storage.items, {});
});

test(`values kept longer than ${HOLD_MINUTES} minutes don't come back, and are removed`, async () => {
  const storage = fakeStorage();
  await holdForTab(storage, 7, NY_SKY, T0);
  assert.deepEqual(await heldForTab(storage, 7, T0 + HOLD_MINUTES * MINUTE - 1), NY_SKY);
  assert.equal(await heldForTab(storage, 7, T0 + HOLD_MINUTES * MINUTE), null);
  assert.deepEqual(storage.items, {});
});

test("values from a later clock time, or a malformed entry, don't come back", async () => {
  const storage = fakeStorage();
  await holdForTab(storage, 7, NY_SKY, T0);
  const [key] = Object.keys(storage.items);
  assert.equal(await heldForTab(storage, 7, T0 - 1), null);
  await storage.set({ [key]: { values: { utc: 5 }, heldAt: T0 } });
  assert.equal(await heldForTab(storage, 7, T0), null);
  assert.deepEqual(storage.items, {});
});

test("two conversions in two tabs keep their own values", async () => {
  const storage = fakeStorage();
  await holdForTab(storage, 7, NY_SKY, T0);
  await holdForTab(storage, 9, SYDNEY_SKY, T0 + MINUTE);
  assert.deepEqual(await heldForTab(storage, 7, T0 + 2 * MINUTE), NY_SKY);
  assert.deepEqual(await heldForTab(storage, 9, T0 + 2 * MINUTE), SYDNEY_SKY);
});

test("keeping values for one tab clears expired values of others, and leaves other keys alone", async () => {
  const storage = fakeStorage();
  await storage.set({ unrelated: 1 });
  await holdForTab(storage, 7, NY_SKY, T0);
  await holdForTab(storage, 9, SYDNEY_SKY, T0 + HOLD_MINUTES * MINUTE);
  assert.equal(Object.keys(storage.items).length, 2);
  assert.equal(storage.items.unrelated, 1);
});

// --- Reading and filling astro.com's form, in a stand-in page ---------------

// The browser sends the tab only the function's source, so it is rebuilt from
// its source here, as in test/index.test.js. A page that watches for changes
// brings its own MutationObserver.
function runInPage(func, document, ...args) {
  const rebuilt = new Function("document", "MutationObserver", "args", `return (${func})(...args);`);
  return rebuilt(document, document.MutationObserver, args);
}

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
const SELECT_OPTIONS = {
  imon: range(1, 12),
  ihou: ["", "u", ...range(0, 23)],
  szon: ["au", "au", "h0w", "h1w", "h4w", "h0e", "h1e", "lmt", "lat"],
};

function field(name, value = "", options = null) {
  const element = { name, events: [], dispatchEvent: (event) => element.events.push(event.type) };
  element.focus = () => (element.focused = true);
  if (!options) return Object.assign(element, { value });
  // A select keeps a value only when one of its options has it, as in a browser.
  let current = value;
  Object.defineProperty(element, "value", {
    get: () => current,
    set: (next) => (current = options.includes(next) ? next : ""),
  });
  return element;
}

// The parts of ade.cgi's page that AstroChart Bridge reads, as seen signed out on
// 2026-11-01. Signed in, the same blank form has the same fields, a cid 25
// characters long, and a greeting other than "Hello [not logged in]".
const SIGNED_IN = { hello: ["Hello Test User"], cid: "x".repeat(25) };

function formPage({ hello = ["Hello [not logged in]"], cid = "", typed = {}, missing = [], options = SELECT_OPTIONS } = {}) {
  const fields = [
    field("cid", cid),
    field("sday", typed.sday ?? ""),
    field("imon", "1", options.imon),
    field("syar", typed.syar ?? ""),
    field("ihou", "", options.ihou),
    field("smin", typed.smin ?? ""),
    field("scit", typed.scit ?? ""),
    field("sfnm", typed.sfnm ?? ""),
    field("snam", typed.snam ?? ""),
    field("extset", "close"),
    field("szon", "au", options.szon),
  ].filter((element) => !missing.includes(element.name));
  const form = { elements: { namedItem: (name) => fields.find((element) => element.name === name) ?? null } };
  const extended = { style: { display: "none" } };
  return {
    field: (name) => fields.find((element) => element.name === name),
    extended,
    forms: { namedItem: (name) => (name === "start" && !missing.includes("form") ? form : null) },
    querySelectorAll: (selector) => (selector === "li.hello" ? hello.map((text) => ({ textContent: ` ${text} ` })) : []),
    getElementById: (id) => (id === "extended" ? extended : null),
  };
}

test("astro.com's signed-out greeting is read as signed out", () => {
  assert.deepEqual(runInPage(readFormPage, formPage()), { auth: "signed-out", form: "blank" });
});

test("any other greeting, or none, is unknown: AstroChart Bridge never decides a browser is signed in", () => {
  for (const hello of [["Hello Test User"], [], ["Hallo [nicht angemeldet]"]]) {
    assert.deepEqual(runInPage(readFormPage, formPage({ hello })), { auth: "unknown", form: "blank" }, String(hello));
  }
});

test("a signed-in browser's blank form is blank, whatever its cid, and its greeting is unknown", () => {
  assert.deepEqual(runInPage(readFormPage, formPage(SIGNED_IN)), { auth: "unknown", form: "blank" });
});

test("a form with a date or time typed in, or missing fields, isn't blank", () => {
  assert.equal(runInPage(readFormPage, formPage({ typed: { sday: "3" } })).form, "typed");
  assert.equal(runInPage(readFormPage, formPage({ typed: { smin: "15" } })).form, "typed");
  assert.equal(runInPage(readFormPage, formPage({ missing: ["form"] })).form, "unrecognised");
  assert.equal(runInPage(readFormPage, formPage({ missing: ["szon"] })).form, "unrecognised");
});

test("filling a blank form sets the date, time and time zone, opens the extended settings, and leaves the town", () => {
  const page = formPage();
  assert.deepEqual(runInPage(fillForm, page, formValues(NY_SKY)), { filled: true });
  assert.deepEqual(
    ["sday", "imon", "syar", "ihou", "smin", "szon"].map((name) => page.field(name).value),
    ["17", "4", "2024", "12", "00", "h0w"],
  );
  // The toggle sets extset to "open" and shows #extended, as seen on 2026-11-01.
  assert.equal(page.field("extset").value, "open");
  assert.equal(page.extended.style.display, "");
  assert.equal(page.field("scit").value, "");
  assert.equal(page.field("scit").focused, true);
  // The page's own scripts hear about each change, as if typed.
  assert.ok(page.field("szon").events.includes("change"));
});

test("a local time is filled in with the automatic time zone the form starts with", () => {
  const page = formPage();
  assert.deepEqual(runInPage(fillForm, page, formValues({ ...NY_SKY, local: "2024-04-17T08:00:00" })), { filled: true });
  assert.deepEqual(
    ["sday", "imon", "syar", "ihou", "smin", "szon"].map((name) => page.field(name).value),
    ["17", "4", "2024", "8", "00", "au"],
  );
});

test("a town is filled in too, and the cursor is left in it to pick astro.com's match", () => {
  const page = formPage(SIGNED_IN);
  assert.deepEqual(runInPage(fillForm, page, formValues(SYDNEY_SKY)), { filled: true });
  assert.equal(page.field("scit").value, "Sydney");
  assert.equal(page.field("scit").focused, true);
  assert.ok(page.field("scit").events.includes("input"));
});

test("a town typed in already is kept, and the rest is still filled in", () => {
  const page = formPage({ ...SIGNED_IN, typed: { scit: "Parramatta" } });
  assert.deepEqual(runInPage(fillForm, page, formValues(SYDNEY_SKY)), { filled: true });
  assert.equal(page.field("scit").value, "Parramatta");
  assert.equal(page.field("sday").value, "14");
});

test("a name is filled in too, as typed, and the cursor still goes to the town", () => {
  const page = formPage(SIGNED_IN);
  assert.deepEqual(runInPage(fillForm, page, formValues(NAMED_SKY)), { filled: true });
  assert.deepEqual([page.field("sfnm").value, page.field("snam").value], ["Example", "Person"]);
  assert.ok(page.field("snam").events.includes("input"));
  assert.equal(page.field("scit").focused, true);
});

test("a name typed in already is kept part by part, and the rest is still filled in", () => {
  const page = formPage({ ...SIGNED_IN, typed: { sfnm: "Sam" } });
  assert.deepEqual(runInPage(fillForm, page, formValues(NAMED_SKY)), { filled: true });
  assert.deepEqual([page.field("sfnm").value, page.field("snam").value], ["Sam", "Person"]);
  assert.equal(page.field("sday").value, "17");
});

test("a form without the name fields is unrecognised when there is a name, and filled in when there isn't", () => {
  for (const missing of [["sfnm"], ["snam"]]) {
    const page = formPage({ ...SIGNED_IN, missing });
    assert.deepEqual(runInPage(fillForm, page, formValues(NAMED_SKY)), { filled: false, form: "unrecognised" }, missing[0]);
    assert.equal(page.field("sday").value, "");
    assert.deepEqual(runInPage(fillForm, formPage({ ...SIGNED_IN, missing }), formValues(NY_SKY)), { filled: true });
  }
});

test("a signed-in browser's blank form is filled in, and its cid is left alone", () => {
  const page = formPage(SIGNED_IN);
  assert.deepEqual(runInPage(fillForm, page, formValues(NY_SKY)), { filled: true });
  assert.equal(page.field("sday").value, "17");
  assert.equal(page.field("cid").value, SIGNED_IN.cid);
});

// A saved chart's form is assumed to show its date and time, so this check is
// also what keeps a saved chart from being changed.
test("filling never overwrites: a form with a date or time in it is left as it was", () => {
  const page = formPage({ typed: { syar: "1990" } });
  assert.deepEqual(runInPage(fillForm, page, formValues(NY_SKY)), { filled: false, form: "typed" });
  assert.equal(page.field("syar").value, "1990");
  assert.equal(page.field("sday").value, "");
  assert.equal(page.field("szon").value, "au");
  assert.equal(page.field("extset").value, "close");
});

test("a value the form has no option for fills in nothing", () => {
  const page = formPage({ options: { ...SELECT_OPTIONS, szon: ["au", "lmt"] } });
  assert.deepEqual(runInPage(fillForm, page, formValues(NY_SKY)), { filled: false, form: "unrecognised" });
  assert.equal(page.field("sday").value, "");
  assert.equal(page.field("szon").value, "au");
});

// --- What the popup shows on the astro.com tab -----------------------------

const ROWS = [
  ["Birthday", "17 April 2024"],
  ["Hour, min", "12:00"],
  ["Time zone", "00:00 GMT / UT, under show / hide extended settings"],
  ["Place", "40°43'N, 74°0'W"],
];
const CANCEL = { label: "Cancel", does: "release", secondary: true };
const OPEN_FORM_HERE = { label: "Open astro.com's form", url: FORM_URL, here: true };

test("a browser not seen signed out goes straight to filling in, with no sign-in prompt", () => {
  // A signed-in browser and one whose state is unknown look the same to AstroChart Bridge.
  assert.deepEqual(viewForAstroComTab(NY_SKY, { kind: "form", auth: "unknown", form: "blank" }), {
    state: "astro-com-fill",
    rows: ROWS,
    warnings: [],
    message: "Fill in astro.com's form with these values?",
    notes: [
      "AstroChart Bridge fills in the birthday, hour, minute and the 00:00 GMT / UT time zone. Choose the town nearest this place yourself, and check the coordinates astro.com shows.",
      "AstroChart Bridge doesn't submit the form, and forgets these values once it has filled them in.",
    ],
    sky: NY_SKY,
    buttons: [{ label: "Fill in the form", does: "fill" }, CANCEL],
  });
});

test("a signed-out browser is asked to sign in or create an account, and can still fill in", () => {
  assert.deepEqual(viewForAstroComTab(NY_SKY, { kind: "form", auth: "signed-out", form: "blank" }), {
    state: "astro-com-sign-in",
    heading: "Sign in to astro.com",
    rows: ROWS,
    warnings: [],
    message:
      "astro.com requires an account to generate charts. Sign in to your existing account or create a free account to continue.",
    notes: [
      "AstroChart Bridge keeps these values for the astro.com tab while you sign in. Afterwards, open astro.com's form there and click the AstroChart Bridge icon in the toolbar again.",
    ],
    sky: NY_SKY,
    buttons: [
      { label: "Sign in", url: SIGN_IN_URL, here: true },
      { label: "Create account", url: CREATE_ACCOUNT_URL, here: true },
      { label: "Fill in anyway", does: "fill", secondary: true },
      CANCEL,
    ],
  });
});

test("a form with a date or time in it is never filled: the popup offers a blank one instead", () => {
  const typed = viewForAstroComTab(NY_SKY, { kind: "form", auth: "unknown", form: "typed" });
  assert.equal(typed.message, "This form already has a date or time in it. AstroChart Bridge fills in only a blank form, so it won't change what's there.");
  assert.deepEqual(typed.buttons, [{ label: "Open a blank form", url: FORM_URL, here: true }, CANCEL]);


  // Even signed out: the sign-in prompt would offer to fill in a form that mustn't be filled.
  assert.equal(viewForAstroComTab(NY_SKY, { kind: "form", auth: "signed-out", form: "typed" }).state, typed.state);
});

test("an unrecognised form shows the values to type, with its code", () => {
  const view = viewForAstroComTab(NY_SKY, { kind: "form", auth: "unknown", form: "unrecognised" });
  assert.equal(view.message, "AstroChart Bridge doesn't recognise this astro.com form, so it can't fill it in. Enter the values above yourself.");
  assert.equal(view.code, "unrecognised-form");
  assert.deepEqual(view.rows, ROWS);
  assert.deepEqual(view.buttons, [CANCEL]);
});

test("on any other astro.com page, such as after a failed sign-in, the values wait and nothing opens by itself", () => {
  const view = viewForAstroComTab(NY_SKY, { kind: "other" });
  assert.deepEqual(view, {
    state: "astro-com-waiting",
    rows: ROWS,
    warnings: [],
    message: "AstroChart Bridge is keeping these values for this tab.",
    notes: ["When you're signed in, open astro.com's birth data form in this tab and click the AstroChart Bridge icon in the toolbar again to fill it in."],
    sky: NY_SKY,
    buttons: [OPEN_FORM_HERE, CANCEL],
  });
  // Nothing in the view navigates on its own: there is no redirect for a failed sign-in to loop through.
  assert.deepEqual(Object.keys(view).filter((key) => !["state", "rows", "warnings", "message", "notes", "sky", "buttons"].includes(key)), []);
});

test("a kept name is shown on the astro.com tab and named in what gets filled in", () => {
  const view = viewForAstroComTab({ ...SYDNEY_SKY, name: { first: "Example", last: "Person" } }, { kind: "form", auth: "unknown", form: "blank" });
  assert.deepEqual(view.rows.slice(-2), [["First name", "Example"], ["Last name", "Person"]]);
  assert.equal(
    view.notes[0],
    "AstroChart Bridge fills in the birthday, hour, minute, the 00:00 GMT / UT time zone, the name and the town Sydney. Choose astro.com's match nearest this place, and check the coordinates it shows.",
  );
});

test("a kept town is shown on the astro.com tab and named in what gets filled in", () => {
  const view = viewForAstroComTab(SYDNEY_SKY, { kind: "form", auth: "unknown", form: "blank" });
  assert.deepEqual(view.rows[4], ["Town", "Sydney"]);
  assert.equal(
    view.notes[0],
    "AstroChart Bridge fills in the birthday, hour, minute, the 00:00 GMT / UT time zone and the town Sydney. Choose astro.com's match nearest this place, and check the coordinates it shows.",
  );
});

test("a kept local time is shown on the astro.com tab, which leaves the automatic time zone as it is and says what to check", () => {
  const view = viewForAstroComTab({ ...SYDNEY_SKY, local: "2024-01-15T08:00:00" }, { kind: "form", auth: "unknown", form: "blank" });
  assert.deepEqual(view.rows.slice(1, 4), [["Hour, min", "08:00"], ["Time zone", "automatic time zone, the form's default"], ["Offset", "UTC+11:00"]]);
  assert.equal(view.notes[0].startsWith("AstroChart Bridge fills in the birthday, hour, minute and the town Sydney."), true);
  assert.match(view.notes[1], /It should be 11 h east \(UTC\+11:00\): AstroChart Bridge checks it on the page/);
});

test("a form filled in by hand says what time zone to check for, and what to enter instead", () => {
  const sky = { ...SYDNEY_SKY, local: "2024-01-15T08:00:00" };
  for (const form of ["typed", "unrecognised"]) {
    const view = viewForAstroComTab(sky, { kind: "form", auth: "unknown", form });
    assert.match(
      view.notes[0],
      /Check that it's 11 h east \(UTC\+11:00\)\. If it isn't, choose 00:00 GMT \/ UT under show \/ hide extended settings and enter 14 January 2024, 21:00 instead\.$/,
      form,
    );
  }
  // In Universal Time there is nothing to check.
  assert.deepEqual(viewForAstroComTab(SYDNEY_SKY, { kind: "form", auth: "unknown", form: "typed" }).notes, []);
});

test("seconds dropped from the form are named on the astro.com tab too", () => {
  const view = viewForAstroComTab({ ...NY_SKY, utc: "2024-04-17T12:00:30Z" }, { kind: "form", auth: "unknown", form: "blank" });
  assert.deepEqual(view.warnings, ["astro.com takes whole minutes, so the 30 seconds are left out."]);
});

// --- Checking astro.com's automatic time zone --------------------------------

const NY_LOCAL = { ...NY_SKY, local: "2024-04-17T08:00:00" };

test("an offset is named in the words of astro.com's time zone line", () => {
  assert.equal(zoneWords(-240), "4 h west");
  assert.equal(zoneWords(-210), "3 h 30 min west");
  assert.equal(zoneWords(345), "5 h 45 min east");
  assert.equal(zoneWords(0), "GMT/UT");
  // A local-mean-time offset, to the nearest minute.
  assert.equal(zoneWords(-295.97), "4 h 56 min west");
});

test("the check holds the chart's offset, what was filled in, and the Universal Time to enter instead", () => {
  assert.deepEqual(zoneCheck(NY_LOCAL), {
    offsetMinutes: -240,
    zone: "4 h west",
    filled: { sday: "17", imon: "4", syar: "2024", ihou: "8", smin: "00", szon: "au" },
    ut: { sday: "17", imon: "4", syar: "2024", ihou: "12", smin: "00", szon: "h0w" },
    utText: "2024-04-17 12:00",
  });
  // A form filled in as Universal Time has nothing to check.
  assert.equal(zoneCheck(NY_SKY), null);
  assert.equal(zoneCheck({ ...NY_SKY, local: "2024-04-17T12:00:00" }), null);
});

// A filled-in form with ade.cgi's time zone line, #zz, which the page fills
// in once a town is chosen. pickTown sets its text the way the page does.
function zonePage(values = NY_LOCAL) {
  const page = formPage();
  runInPage(fillForm, page, formValues(values));
  let observer = null;
  const element = (tag) => {
    const node = {
      tag, id: "", style: {}, children: [], textContent: "", isConnected: false, listeners: {},
      append: (...nodes) => node.children.push(...nodes),
      remove: () => ((node.isConnected = false), (node.removed = true)),
      addEventListener: (type, listener) => (node.listeners[type] = listener),
    };
    return node;
  };
  const zone = { textContent: "", dataset: {} };
  page.field("szon").after = (node) => ((node.isConnected = true), (page.note = node));
  page.createElement = element;
  const getElementById = page.getElementById;
  page.getElementById = (id) => (id === "zz" ? zone : getElementById(id));
  page.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      if (target === zone) observer = this;
    }
    disconnect() {
      if (observer === this) observer = null;
    }
  };
  page.pickTown = (html) => {
    // textContent of astro.com's HTML: tags dropped, &nbsp; kept as U+00A0, and no space for <br>.
    zone.textContent = html.replace(/<[^>]+>/g, "").replaceAll("&nbsp;", " ");
    observer?.callback([]);
  };
  page.watching = () => observer !== null;
  page.message = () => (page.note?.isConnected ? page.note.children[0].textContent : null);
  page.button = () => page.note.children[1];
  return page;
}

// #zz as adejs.cgi gave it on 2026-11-01, for New York on 17 April 2024 at 08:00 and others.
const ZZ = {
  nyDaylight: "<strong>time zone:</strong><br/>4 h west,&nbsp; Daylight Saving T.",
  nyStandard: "<strong>time zone:</strong><br/>5 h west,&nbsp; Standard Time",
  alabama: "<strong>time zone:</strong><br/>5 h west,&nbsp; Daylight Saving T.",
  lmt: "<strong>time zone:</strong><br/>Local Mean Time",
  london: "<strong>time zone:</strong><br/>GMT/UT,&nbsp; Standard Time",
  newfoundland: "<strong>time zone:</strong><br/>3 h 30 min west,&nbsp; Standard Time",
  repeated:
    "<strong>time zone:</strong><br/>4 h west,&nbsp; Daylight Saving T.<br><span style=\"color:#CC0000;\"><blink>ATTENTION:</blink>  Same hour occurs twice, could be daylight time or standard time.</span>",
};

test("nothing shows until a town is chosen, nor when astro.com's zone is the chart's", () => {
  const page = zonePage();
  assert.deepEqual(runInPage(watchZone, page, zoneCheck(NY_LOCAL)), { watching: true });
  assert.equal(page.message(), null);
  page.pickTown(ZZ.nyDaylight);
  assert.equal(page.message(), null);
  // astro.com's warning about a repeated hour doesn't matter when its choice is the chart's.
  page.pickTown(ZZ.repeated);
  assert.equal(page.message(), null);
  assert.equal(page.watching(), true);
});

test("a town whose zone differs gets a note under the line, which goes when a right town is chosen", () => {
  const page = zonePage();
  runInPage(watchZone, page, zoneCheck(NY_LOCAL));
  // London, AL comes first when "London" is typed.
  page.pickTown(ZZ.alabama);
  assert.equal(
    page.message(),
    "AstroChart Bridge: this chart is 4 h west of Universal Time, but astro.com's automatic time zone for this town is 5 h west. Check that the town is right. If it is, enter the chart in Universal Time instead.",
  );
  assert.equal(page.button().textContent, "Enter in Universal Time");
  page.pickTown(ZZ.nyDaylight);
  assert.equal(page.message(), null);
});

test("half-hour and GMT/UT zones are read too", () => {
  const stJohns = { utc: "2024-01-15T11:30:00Z", lat: 47.57, lng: -52.72, local: "2024-01-15T08:00:00" };
  const page = zonePage(stJohns);
  runInPage(watchZone, page, zoneCheck(stJohns));
  page.pickTown(ZZ.newfoundland);
  assert.equal(page.message(), null);
  page.pickTown(ZZ.london);
  assert.match(page.message(), /this chart is 3 h 30 min west of Universal Time, but astro\.com's automatic time zone for this town is GMT\/UT\./);
});

test("a zone with no offset, such as local mean time, can't be checked and says so", () => {
  const page = zonePage();
  runInPage(watchZone, page, zoneCheck(NY_LOCAL));
  page.pickTown(ZZ.lmt);
  assert.equal(
    page.message(),
    "AstroChart Bridge: astro.com's time zone here is \"Local Mean Time\", which can't be checked against this chart's 4 h west. Check that the town is right. If it is, you can enter the chart in Universal Time instead.",
  );
});

test("the button enters the chart's Universal Time with 00:00 GMT / UT, and the watching stops", () => {
  const page = zonePage();
  runInPage(watchZone, page, zoneCheck(NY_LOCAL));
  page.pickTown(ZZ.alabama);
  page.button().listeners.click();
  assert.deepEqual(
    ["sday", "imon", "syar", "ihou", "smin", "szon"].map((name) => page.field(name).value),
    ["17", "4", "2024", "12", "00", "h0w"],
  );
  assert.ok(page.field("ihou").events.includes("change"));
  assert.match(page.message(), /^AstroChart Bridge entered 2024-04-17 12:00 with the 00:00 GMT \/ UT time zone\. That is the chart's own Universal Time/);
  assert.equal(page.button().removed, true);
  assert.equal(page.watching(), false);
});

test("once the person changes the date, time or time zone, the check is theirs: the note goes and the watching stops", () => {
  for (const [name, value] of [["ihou", "9"], ["sday", "18"], ["szon", "h4w"]]) {
    const page = zonePage();
    runInPage(watchZone, page, zoneCheck(NY_LOCAL));
    page.pickTown(ZZ.alabama);
    page.field(name).value = value;
    page.pickTown(ZZ.nyStandard);
    assert.equal(page.message(), null, name);
    assert.equal(page.watching(), false, name);
  }
});

test("a page without the time zone line, or already watched, isn't watched again", () => {
  const page = zonePage();
  const getElementById = page.getElementById;
  page.getElementById = (id) => (id === "zz" ? null : getElementById(id));
  assert.deepEqual(runInPage(watchZone, page, zoneCheck(NY_LOCAL)), { watching: false });

  // Watched with no note showing, as before a town is chosen.
  const watched = zonePage();
  runInPage(watchZone, watched, zoneCheck(NY_LOCAL));
  assert.deepEqual(runInPage(watchZone, watched, zoneCheck(NY_LOCAL)), { watching: false });
});
