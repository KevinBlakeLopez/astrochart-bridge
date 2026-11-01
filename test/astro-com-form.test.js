import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fillForm,
  formValues,
  isAstroComPage,
  isBirthDataForm,
  readFormPage,
} from "../extension/core/astrocom.js";
import { HOLD_MINUTES, heldForTab, holdForTab, releaseTab } from "../extension/pending.js";
import { viewForAstroComTab } from "../extension/popup-model.js";

// What the astro.com screens keep for a tab: the sky, and a town or null.
const NY_SKY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74, town: null };
const SYDNEY_SKY = { utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2, town: "Sydney" };
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

test("a town goes in the birth town field, scit", () => {
  assert.equal(formValues(SYDNEY_SKY).scit, "Sydney");
  assert.equal("scit" in formValues(NY_SKY), false);
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
// its source here, as in test/index.test.js.
function runInPage(func, document, ...args) {
  const rebuilt = new Function("document", "args", `return (${func})(...args);`);
  return rebuilt(document, args);
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

// The parts of ade.cgi's page that Chart Bridge reads, as seen signed out on
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

test("any other greeting, or none, is unknown: Chart Bridge never decides a browser is signed in", () => {
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
  // A signed-in browser and one whose state is unknown look the same to Chart Bridge.
  assert.deepEqual(viewForAstroComTab(NY_SKY, { kind: "form", auth: "unknown", form: "blank" }), {
    state: "astro-com-fill",
    rows: ROWS,
    warnings: [],
    message: "Fill in astro.com's form with these values?",
    notes: [
      "Chart Bridge fills in the birthday, hour, minute and the 00:00 GMT / UT time zone. Choose the town nearest this place yourself, and check the coordinates astro.com shows.",
      "Chart Bridge doesn't submit the form, and forgets these values once it has filled them in.",
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
      "Chart Bridge keeps these values for the astro.com tab while you sign in. Afterwards, open astro.com's form there and click the Chart Bridge icon in the toolbar again.",
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
  assert.equal(typed.message, "This form already has a date or time in it. Chart Bridge fills in only a blank form, so it won't change what's there.");
  assert.deepEqual(typed.buttons, [{ label: "Open a blank form", url: FORM_URL, here: true }, CANCEL]);


  // Even signed out: the sign-in prompt would offer to fill in a form that mustn't be filled.
  assert.equal(viewForAstroComTab(NY_SKY, { kind: "form", auth: "signed-out", form: "typed" }).state, typed.state);
});

test("an unrecognised form shows the values to type, with its code", () => {
  const view = viewForAstroComTab(NY_SKY, { kind: "form", auth: "unknown", form: "unrecognised" });
  assert.equal(view.message, "Chart Bridge doesn't recognise this astro.com form, so it can't fill it in. Enter the values above yourself.");
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
    message: "Chart Bridge is keeping these values for this tab.",
    notes: ["When you're signed in, open astro.com's birth data form in this tab and click the Chart Bridge icon in the toolbar again to fill it in."],
    sky: NY_SKY,
    buttons: [OPEN_FORM_HERE, CANCEL],
  });
  // Nothing in the view navigates on its own: there is no redirect for a failed sign-in to loop through.
  assert.deepEqual(Object.keys(view).filter((key) => !["state", "rows", "warnings", "message", "notes", "sky", "buttons"].includes(key)), []);
});

test("a kept town is shown on the astro.com tab and named in what gets filled in", () => {
  const view = viewForAstroComTab(SYDNEY_SKY, { kind: "form", auth: "unknown", form: "blank" });
  assert.deepEqual(view.rows[4], ["Town", "Sydney"]);
  assert.equal(
    view.notes[0],
    "Chart Bridge fills in the birthday, hour, minute, the 00:00 GMT / UT time zone and the town Sydney. Choose astro.com's match nearest this place, and check the coordinates it shows.",
  );
});

test("seconds dropped from the form are named on the astro.com tab too", () => {
  const view = viewForAstroComTab({ ...NY_SKY, utc: "2024-04-17T12:00:30Z" }, { kind: "form", auth: "unknown", form: "blank" });
  assert.deepEqual(view.warnings, ["astro.com takes whole minutes, so the 30 seconds are left out."]);
});
