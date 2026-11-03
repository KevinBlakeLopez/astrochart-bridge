import { test } from "node:test";
import assert from "node:assert/strict";
import { astroSeekSaveUrl, astroSeekUrl } from "../extension/core/astroseek.js";
import { fromFragment, toFragment, toPortable } from "../extension/core/portable.js";
import { viewForImport } from "../extension/chart-model.js";
import {
  actionGroups,
  astroSeekNotes,
  astroSeekSaveBusy,
  astroSeekSaveNamedNote,
  astroSeekSaveNote,
  viewFor,
  viewForAstroSeekSave,
  withAstroSeekSave,
} from "../extension/popup-model.js";

const NY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const SCREEN = {
  notes: ["a note"],
  buttons: [
    { label: "Open Stellarium Web", opens: "stellarium" },
    { label: "Open chart in Astro-Seek", opens: "astro-seek" },
    { label: "Share…", does: "share", secondary: true },
  ],
};

test("Save in Astro-Seek… comes right after Open chart in Astro-Seek, with its note last", () => {
  const view = withAstroSeekSave(SCREEN);
  assert.deepEqual(
    view.buttons.map(({ label }) => label),
    ["Open Stellarium Web", "Open chart in Astro-Seek", "Save in Astro-Seek…", "Share…"],
  );
  assert.deepEqual(view.buttons[2], { label: "Save in Astro-Seek…", saves: { town: null, name: null, gender: null }, secondary: true });
  assert.deepEqual(view.notes, ["a note", astroSeekSaveNote()]);
  assert.equal(astroSeekSaveNote(), "Opening or saving sends this date, time and place to astro-seek.com.");
});

test("its note takes the place of Open chart in Astro-Seek's, keeping a popup screen short", () => {
  const view = withAstroSeekSave({ ...SCREEN, notes: ["a note", ...astroSeekNotes(), "a last note"] });
  assert.deepEqual(view.notes, ["a note", astroSeekNotes()[0], astroSeekSaveNote(), "a last note"]);
  // Open chart in Astro-Seek's note took one line of the popup, and so does this one.
  assert.ok(astroSeekSaveNote().length <= astroSeekNotes()[1].length);
});

test("the chart's town goes in as it is, and its name in one piece, as Astro-Seek's single Name field takes it", () => {
  const saves = (name) => withAstroSeekSave(SCREEN, { town: "New York", name }).buttons[2].saves;
  assert.deepEqual(saves({ first: "Example", last: "Person" }), { town: "New York", name: "Example Person", gender: null });
  assert.deepEqual(saves({ first: " Example ", last: "" }), { town: "New York", name: "Example", gender: null });
  assert.deepEqual(saves({ first: "", last: "" }), { town: "New York", name: null, gender: null });
  assert.deepEqual(saves(null), { town: "New York", name: null, gender: null });
});

test("a chart with a name or a town has the note say saving sends them too", () => {
  const note = (chart) => withAstroSeekSave(SCREEN, chart).notes.at(-1);
  assert.equal(note({ town: "New York" }), astroSeekSaveNamedNote());
  assert.equal(note({ name: { first: "Example", last: "" } }), astroSeekSaveNamedNote());
  assert.equal(note({ name: { first: " ", last: "" } }), astroSeekSaveNote());
  assert.match(astroSeekSaveNamedNote(), /^Opening or saving sends this date, time and place to astro-seek\.com; saving also sends the chart's name and town/);
});

test("a screen that already has the button and its note isn't given them twice", () => {
  const once = withAstroSeekSave(SCREEN);
  assert.deepEqual(withAstroSeekSave(once), once);
});

test("it goes under Take the chart elsewhere, with Open chart in Astro-Seek", () => {
  const groups = actionGroups(withAstroSeekSave(SCREEN)).map(({ label, actions }) => [label, ...actions.map(({ button }) => button.label)]);
  assert.deepEqual(groups, [
    ["See the sky", "Open Stellarium Web"],
    ["Take the chart elsewhere", "Open chart in Astro-Seek", "Save in Astro-Seek…", "Share…"],
  ]);
});

test("an astro.com chart is saved with the name and town its record gives", () => {
  const result = {
    kind: "natal",
    site: "astro-com",
    local: "2024-04-17T08:00:00",
    zoneLabel: null,
    ...NY,
    utcSource: "declared",
    offsetMinutes: -240,
    name: { first: "Test", last: "" },
    town: "New York",
  };
  const view = viewFor(result, { timeZone: "America/Los_Angeles" });
  assert.deepEqual(view.buttons.find(({ saves }) => saves).saves, { town: "New York", name: "Test", gender: null });
  assert.equal(view.notes.at(-1), astroSeekSaveNamedNote());
  const unnamed = viewFor({ ...result, name: null, town: null }, { timeZone: "America/Los_Angeles" });
  assert.deepEqual(unnamed.buttons.find(({ saves }) => saves).saves, { town: null, name: null, gender: null });
  assert.equal(unnamed.notes.at(-1), astroSeekSaveNote());
});

test("the shared chart page, which is also a website, doesn't offer it", () => {
  const built = toPortable({ ...NY, local: "2024-04-17T08:00:00" }, { site: "astro-seek", via: "page", zoneLabel: "EDT, DST", utcBasis: "printed" });
  const view = viewForImport(fromFragment(`#${toFragment(built.chart)}`), { timeZone: "America/Los_Angeles" });
  assert.ok(view.buttons.some(({ opens }) => opens === "astro-seek"));
  assert.equal(view.buttons.some(({ saves }) => saves), false);
  assert.equal(view.notes.includes(astroSeekSaveNote()), false);
});

test("while the form opens, the popup says so and offers nothing to click", () => {
  assert.deepEqual(astroSeekSaveBusy(), { state: "astro-seek-busy", message: "Opening Astro-Seek's Add person form…", notes: [], buttons: [] });
});

test("declined, the form opens filled in by its address alone, with what to check", () => {
  const view = viewForAstroSeekSave({ outcome: "declined" }, NY, { town: "New York", name: "Example Person", gender: null });
  assert.equal(view.message, "AstroChart Bridge can't choose the town in Astro-Seek's form without access to www.astro-seek.com.");
  assert.deepEqual(view.buttons, [{ label: "Open Astro-Seek's form", url: astroSeekSaveUrl(NY, { name: "Example Person" }) }]);
  assert.deepEqual(view.notes, [
    "The form opens with this date, time and place in UT/GMT, and the name. Before Add person, choose the Birth city in Astro-Seek's list if it isn't, then check that the coordinates and UT/GMT are still the chart's.",
  ]);
  assert.equal(view.sky, NY);
  assert.doesNotMatch(viewForAstroSeekSave({ outcome: "declined" }, NY, { town: null, name: null, gender: null }).notes[0], /and the name/);
});

test("signed out, or sent elsewhere, the popup asks for a sign-in and leads to the tab", () => {
  const signedOut = viewForAstroSeekSave({ outcome: "signed-out", tabId: 70 }, NY, { town: null, name: null, gender: null });
  assert.equal(signedOut.message, "Astro-Seek shows you signed out, and saves a chart only in an account. Sign in in its tab, then click Save in Astro-Seek… again.");
  assert.deepEqual(signedOut.notes, []);
  assert.deepEqual(signedOut.buttons, [{ label: "Go to the Astro-Seek tab", does: "show-tab" }]);
  const elsewhere = viewForAstroSeekSave({ outcome: "not-filled", tabId: 70, page: "elsewhere" }, NY, { town: null, name: null, gender: null });
  assert.match(elsewhere.message, /^Astro-Seek didn't show its Add person form\. If it asks you to sign in/);
});

test("a form it couldn't finish says why, and what to check before Add person", () => {
  for (const [page, message] of [
    ["not-loaded", "Astro-Seek's form didn't finish opening in time, so AstroChart Bridge didn't choose its town."],
    ["city-typed", "Astro-Seek's form already had a Birth city, so AstroChart Bridge left it as it was."],
    ["unrecognised", "AstroChart Bridge didn't recognise Astro-Seek's form, so it didn't choose its town."],
  ]) {
    const view = viewForAstroSeekSave({ outcome: "not-filled", tabId: 70, page }, NY, { town: "New York", name: null, gender: null });
    assert.equal(view.message, message, page);
    assert.match(view.notes[0], /^Before Add person, choose the Birth city/, page);
    assert.deepEqual(view.buttons, [{ label: "Go to the Astro-Seek tab", does: "show-tab" }], page);
  }
});

// Just enough of a page for view.js to draw into, keeping each element's click listener.
globalThis.document = {
  createElement: (tag) => {
    const element = {
      tag, className: "", textContent: "", disabled: false, children: [], style: {},
      append: (...nodes) => element.children.push(...nodes),
      addEventListener: (type, listener) => type === "click" && (element.click = listener),
    };
    return element;
  },
};

test("clicking it hands the popup its town and name, with the sky the screen decided", async () => {
  const { render } = await import("../extension/view.js");
  const view = withAstroSeekSave({ ...SCREEN, state: "ready", sky: NY }, { town: "New York", name: { first: "Example", last: "Person" }, gender: null });
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  const clicks = [];
  render(container, view, (button, sky) => clicks.push([button, sky]));
  const save = container.parts.find(({ tag, textContent }) => tag === "button" && textContent === "Save in Astro-Seek…");
  assert.equal(save.className, "secondary");
  save.click();
  assert.deepEqual(clicks, [[{ saves: { town: "New York", name: "Example Person", gender: null }, url: undefined }, NY]]);

  // Open chart in Astro-Seek hands over what to keep for its tab, with the same sky.
  const open = container.parts.find(({ tag, textContent }) => tag === "button" && textContent === "Open chart in Astro-Seek");
  open.click();
  assert.deepEqual(clicks[1], [{ keeps: { town: "New York", name: { first: "Example", last: "Person" }, gender: null }, url: astroSeekUrl(NY) }, NY]);
});
