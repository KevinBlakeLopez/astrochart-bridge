import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import { nameFromUrl, townFromUrl } from "../extension/core/astroseek.js";
import { NAME_LENGTH, nameFromText, nameWarning, viewFor, viewForAstroCom, viewForSky, withName } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const analyze = (name) => analyzePage(fixture(name));
const LA = { timeZone: "America/Los_Angeles" };
const NY_SKY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
// What each astro.com button keeps for the tab it opens: the sky and, when the
// chart names one, the town to fill in.
const NY_HELD = { ...NY_SKY, local: null, town: null, name: null, gender: null };

// AstroChart Bridge can't tell from this tab whether the browser is signed in to
// astro.com, so the sign-in advice is a note beside the form button, never a
// step before it. test/astro-com-form.test.js covers the astro.com tab itself.
const SIGN_IN_NOTE =
  "astro.com draws the chart only for a signed-in account. If it asks you to sign in or create a free account, do it in that tab: AstroChart Bridge keeps these values for it.";
const ACCESS_NOTE =
  "The first time, your browser asks to let AstroChart Bridge read and change www.astro.com pages. It uses that only to fill in the form in the tab it opens. If you say no, it shows the values to fill in yourself.";
const NAME_NOTE =
  "The name goes in astro.com's first and last name fields, and you can change it here first. A name in one piece goes in First name, which astro.com won't save a chart without.";
const EMPTY_BOXES = [
  { part: "first", label: "First name", text: "" },
  { part: "last", label: "Last name", text: "" },
];
const HOLD_NOTE =
  "AstroChart Bridge keeps them for 30 minutes, until it fills them in, or until you cancel or close the browser. Filling in puts them in astro.com's page, and its town search sends a town to astro.com at once; submitting sends the rest.";

test("the astro.com screen lists the form's values in Universal Time", () => {
  assert.deepEqual(viewForAstroCom(NY_SKY), {
    state: "to-astro-com",
    rows: [
      ["Birthday", "17 April 2024"],
      ["Hour, min", "12:00"],
      ["Time zone", "00:00 GMT / UT, under show / hide extended settings"],
      ["Place", "40°43'N, 74°0'W"],
    ],
    warnings: [],
    message: "AstroChart Bridge opens astro.com's form and fills it in as it opens. It doesn't submit the form.",
    // Empty boxes for a name, which a chart with none can still be given.
    nameBoxes: EMPTY_BOXES,
    notes: [
      "The date and time are Universal Time, so they can differ from the local birth date and time.",
      "astro.com asks for a country and town, not coordinates. Choose the town nearest this place and check the coordinates astro.com shows.",
      NAME_NOTE,
      SIGN_IN_NOTE,
      HOLD_NOTE,
      ACCESS_NOTE,
    ],
    sky: NY_SKY,
    buttons: [
      // Each keeps the values for the tab it opens, so the popup there can fill them in.
      // Only the form button fills in; it asks for access to www.astro.com first.
      { label: "Open astro.com's form", url: "https://www.astro.com/cgi/ade.cgi", holds: NY_HELD, fills: true },
      { label: "Sign in", url: "https://www.astro.com/cgi/awd.cgi?lang=e", holds: NY_HELD },
      { label: "Create account", url: "https://www.astro.com/cgi/scus.cgi?act=new&", holds: NY_HELD },
    ],
  });
});

test("a signed-in browser isn't held up: the form is the first button and needs nothing first", () => {
  const view = viewForAstroCom(NY_SKY);
  assert.equal(view.buttons[0].label, "Open astro.com's form");
  assert.notEqual(view.sky, null);
});

test("Sydney's morning is the previous UTC day", () => {
  const view = viewForAstroCom({ utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 });
  assert.deepEqual(view.rows.slice(0, 2), [["Birthday", "14 January 2024"], ["Hour, min", "21:00"]]);
  assert.deepEqual(view.rows[3], ["Place", "33°52'S, 151°12'E"]);
});

test("seconds the form can't take are named, not silently dropped", () => {
  const view = viewForAstroCom({ ...NY_SKY, utc: "2024-04-17T12:00:30Z" });
  assert.deepEqual(view.rows[1], ["Hour, min", "12:00"]);
  assert.deepEqual(view.warnings, ["astro.com takes whole minutes, so the 30 seconds are left out."]);
});

test("a chart's local time is listed with the automatic time zone and the offset it should have", () => {
  const local = "2024-04-17T08:00:00";
  const view = viewForAstroCom(NY_SKY, { local });
  assert.deepEqual(view.rows, [
    ["Birthday", "17 April 2024"],
    ["Hour, min", "08:00"],
    ["Time zone", "automatic time zone, the form's default"],
    ["Offset", "UTC-04:00"],
    ["Place", "40°43'N, 74°0'W"],
  ]);
  assert.equal(
    view.notes[0],
    "The date and time are the chart's local time, and astro.com's automatic time zone looks up the zone for the town you choose. " +
      "It should be 4 h west (UTC-04:00): AstroChart Bridge checks it on the page once you choose the town, and offers Universal Time there if it isn't.",
  );
  assert.equal(view.notes.some((note) => note.startsWith("The date and time are Universal Time")), false);
  assert.deepEqual(view.buttons[0].holds, { ...NY_HELD, local });
});

test("a chart with no UTC is listed with the automatic time zone and no offset, for the person to check", () => {
  const local = "2024-04-17T08:00:00";
  const view = viewForAstroCom({ ...NY_SKY, utc: null }, { local, town: "New York" });
  assert.deepEqual(view.rows, [
    ["Birthday", "17 April 2024"],
    ["Hour, min", "08:00"],
    ["Time zone", "automatic time zone, the form's default"],
    ["Place", "40°43'N, 74°0'W"],
    ["Town", "New York"],
  ]);
  assert.equal(
    view.notes[0],
    "The date and time are the chart's local time, and astro.com's automatic time zone looks up the zone for the town you choose. " +
      "AstroChart Bridge has no UTC offset to check it against, so check the time zone astro.com shows for the town and date.",
  );
  assert.deepEqual(view.buttons[0].holds, { ...NY_HELD, utc: null, local, town: "New York" });
});

test("a half-hour offset is named in astro.com's words, and a local time that is UT goes in with the automatic time zone", () => {
  const delhi = { utc: "2024-04-17T06:30:00Z", lat: 28.6, lng: 77.2 };
  assert.match(viewForAstroCom(delhi, { local: "2024-04-17T12:00:00" }).notes[0], /It should be 5 h 30 min east \(UTC\+05:30\):/);
  const ut = viewForAstroCom(NY_SKY, { local: "2024-04-17T12:00:00" });
  assert.deepEqual(ut.rows[2], ["Time zone", "automatic time zone, the form's default"]);
  assert.match(ut.notes[0], /It should be GMT\/UT \(UTC\+00:00\):/);
});

test("a chart that names its town shows it, says it will be filled in, and keeps it for the tab", () => {
  const view = viewForAstroCom(NY_SKY, { town: "New York" });
  assert.deepEqual(view.rows[4], ["Town", "New York"]);
  assert.equal(
    view.notes[1],
    "astro.com asks for a country and town, not coordinates. AstroChart Bridge fills in the town New York; choose the match nearest this place and check the coordinates astro.com shows.",
  );
  assert.deepEqual(view.buttons.map((button) => button.holds), Array(3).fill({ ...NY_SKY, local: null, town: "New York", name: null, gender: null }));
  assert.equal(viewForAstroCom(NY_SKY).rows.length, 4);
});

test("a chart's name fills the form's own two boxes, not the rows, and is kept for the tab", () => {
  const name = { first: "Example", last: "Person" };
  const view = viewForAstroCom(NY_SKY, { name });
  assert.deepEqual(view.nameBoxes.map((box) => box.text), ["Example", "Person"]);
  assert.equal(view.rows.length, 4);
  assert.deepEqual(view.buttons.map((button) => button.holds), Array(3).fill({ ...NY_HELD, name }));
  const event = viewForAstroCom(NY_SKY, { name: { first: "", last: "Moon landing" } });
  assert.deepEqual(event.nameBoxes.map((box) => box.text), ["", "Moon landing"]);
});

test("what is typed in the boxes replaces the kept name, trimmed, and empty boxes keep no name", () => {
  const holds = viewForAstroCom(NY_SKY, { name: { first: "Example", last: "Person" } }).buttons[0].holds;
  assert.deepEqual(withName(holds, { first: " Sam ", last: "Person" }), { ...NY_HELD, name: { first: "Sam", last: "Person" } });
  assert.deepEqual(withName(holds, { first: "", last: " " }), NY_HELD);
  // A chart with no name can be given one.
  assert.deepEqual(withName(NY_HELD, { first: "", last: "Moon landing" }).name, { first: "", last: "Moon landing" });
});

test(`a name part longer than astro.com's ${NAME_LENGTH} characters is warned about, not cut`, () => {
  const long = "x".repeat(NAME_LENGTH + 1);
  assert.equal(
    nameWarning({ first: "", last: long }),
    `astro.com's name fields take ${NAME_LENGTH} characters. Shorten Last name here, or astro.com may cut it short.`,
  );
  assert.equal(viewForAstroCom(NY_SKY, { name: { first: "", last: long } }).nameBoxes[1].text, long);
  assert.equal(nameWarning({ first: long, last: long }).includes("First name and Last name"), true);
  assert.equal(nameWarning({ first: "x".repeat(NAME_LENGTH), last: "" }), null);
});

test("an Astro-Seek chart's town, from its address, reaches the astro.com screen", () => {
  const view = viewFor(analyze("ny-2024-04-17"), { ...LA, town: "New York" });
  assert.deepEqual(view.next, {
    label: "Enter in astro.com…",
    view: viewForAstroCom(NY_SKY, { local: "2024-04-17T08:00:00", town: "New York" }),
  });
  // A Stellarium sky has no local time.
  assert.deepEqual(viewForSky(NY_SKY, { ...LA, town: "New York" }).next.view, viewForAstroCom(NY_SKY, { town: "New York" }));
});

test("a saved person's Astro-Seek chart has its name in the astro.com screen's boxes, as First name", () => {
  // The popup reads both from the chart's address, as popup.js does.
  const url = fixture("ny-2024-04-17").url.replace("#", "&nick=New%20York%20Test#");
  const view = viewFor(analyze("ny-2024-04-17"), { ...LA, town: townFromUrl(url), name: nameFromText(nameFromUrl(url)) });
  const name = { first: "New York Test", last: "" };
  assert.deepEqual(view.next, {
    label: "Enter in astro.com…",
    view: viewForAstroCom(NY_SKY, { local: "2024-04-17T08:00:00", town: "New York, NY, US", name }),
  });
  assert.deepEqual(view.next.view.nameBoxes.map(({ text }) => text), ["New York Test", ""]);
  assert.deepEqual(view.next.view.buttons[0].holds.name, name);
});

test("an Astro-Seek chart with a decided UTC leads to the astro.com screen", () => {
  const view = viewFor(analyze("ny-2024-04-17"), LA);
  assert.deepEqual(view.next, { label: "Enter in astro.com…", view: viewForAstroCom(NY_SKY, { local: "2024-04-17T08:00:00" }) });
});

test("an astro.com chart doesn't lead back to astro.com", () => {
  const result = {
    kind: "natal", site: "astro-com", local: "2024-04-17T08:00:00", zoneLabel: null, lat: 40.716667, lng: -74,
    utc: "2024-04-17T12:00:00Z", utcSource: "declared", offsetMinutes: -240,
  };
  assert.equal(viewFor(result, LA).next, undefined);
});

test("screens without a decided UTC don't lead to astro.com", () => {
  assert.equal(viewFor(analyze("ny-2021-03-14-gap")).next, undefined);
  const needsOffset = {
    kind: "natal", site: "astro-seek", local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", lat: 40.716667, lng: -74,
    utc: null, utcSource: "needs-offset", reason: "no-printed-ut",
  };
  assert.equal(viewFor(needsOffset).next, undefined);
});

test("a Stellarium sky leads to the astro.com screen", () => {
  assert.deepEqual(viewForSky(NY_SKY, LA).next, { label: "Enter in astro.com…", view: viewForAstroCom(NY_SKY) });
});

test("a screenshot's chart leads to the astro.com screen, as the popup's does", () => {
  const result = analyze("ny-2024-04-17");
  assert.deepEqual(viewForScreenshot(result, LA).next, viewFor(result, LA).next);
});
