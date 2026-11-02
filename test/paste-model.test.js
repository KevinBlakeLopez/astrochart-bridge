import { test } from "node:test";
import assert from "node:assert/strict";
import { readText } from "../extension/core/text.js";
import { ASTRO_SEEK_BUTTONS, ASTRO_SEEK_NOTES, SHARE_BUTTON, viewFor, viewForAstroCom } from "../extension/popup-model.js";
import { analyzeEntry } from "../extension/core/index.js";
import { serialize, skyFor } from "../extension/core/portable.js";
import { linkFor, readLink, viewForImport } from "../extension/chart-model.js";
import { chartForEntry, checkField, entryFor, formFor, viewForEntry } from "../extension/paste-model.js";

// Invented birth data, as a desktop program's labelled text might give it.
const LABELLED = [
  "Name: Example Person",
  "Date of Birth: June 15, 1985",
  "Time of Birth: 10:30 AM",
  "Place: Seattle, Washington, USA",
  "Timezone: PDT (UTC-7)",
  "House System: Placidus",
  "Zodiac: Tropical",
].join("\n");

const LA = { timeZone: "America/Los_Angeles" };

const formOf = (text) => formFor(readText(text));
const box = (form, name) => form.fields.find((field) => field.name === name);

test("the form fills each box from the text and says which line it came from", () => {
  const form = formOf(LABELLED);
  assert.equal(form.state, "form");
  assert.deepEqual(
    form.fields.map(({ name, text, source }) => [name, text, source]),
    [
      ["date", "1985-06-15", "Line 2: June 15, 1985"],
      ["time", "10:30", "Line 3: 10:30 AM"],
      ["lat", "", "Not in the pasted text."],
      ["lng", "", "Not in the pasted text."],
      ["offset", "-07:00", "Line 5: PDT (UTC-7)"],
    ],
  );
});

test("the other fields are shown as written, with a note that places aren't looked up", () => {
  const form = formOf(LABELLED);
  assert.deepEqual(form.rows, [
    ["Name", "Example Person"],
    ["Place", "Seattle, Washington, USA"],
    ["Time zone", "PDT (UTC-7)"],
    ["Houses", "Placidus"],
    ["Zodiac", "Tropical"],
  ]);
  assert.deepEqual(form.warnings, []);
  assert.match(form.notes.at(-1), /doesn't look places up/);
});

test("each box's text reads back as the value it was filled from", () => {
  const text = "Born: 1985-06-15T10:30:15+05:30\nCoordinates: 47°36'N 122°19'56\"W";
  const { fields } = readText(text);
  for (const { name, text: boxed } of formOf(text).fields) {
    assert.equal(checkField(name, boxed).value, fields[name].value, name);
  }
});

test("a zone with no offset asks for the offset by name, and never guesses it", () => {
  const offset = box(formOf("Date of Birth: 15 June 1985\nTime Zone: PDT"), "offset");
  assert.equal(offset.text, "");
  assert.match(offset.source, /names the zone "PDT" but gives no offset/);
});

test("a missing time stays empty", () => {
  assert.equal(box(formOf("Date of Birth: 15 June 1985"), "time").text, "");
});

test("an ambiguous date leaves its box empty and offers both readings", () => {
  const date = box(formOf("Birth date: 04/05/1985"), "date");
  assert.equal(date.text, "");
  assert.equal(date.source, "Line 1: 04/05/1985. This could be either date.");
  assert.deepEqual(date.choices, [
    { label: "4 May 1985", text: "1985-05-04" },
    { label: "5 April 1985", text: "1985-04-05" },
  ]);
});

test("offsets that disagree leave the box empty and offer each, with its line", () => {
  const offset = box(formOf("Timezone: PDT (UTC-7)\nUTC Offset: -08:00"), "offset");
  assert.equal(offset.text, "");
  assert.equal(offset.source, "The text gives different values on lines 1 and 2.");
  assert.deepEqual(offset.choices, [
    { label: "-07:00 (line 1)", text: "-07:00" },
    { label: "-08:00 (line 2)", text: "-08:00" },
  ]);
});

test("an unreadable value stays in its box to be corrected", () => {
  const time = box(formOf("Date of Birth: 15 June 1985\nTime of Birth: about 10:30"), "time");
  assert.deepEqual([time.text, time.source], ["about 10:30", "Line 2: about 10:30"]);
});

test("house systems and zodiacs Astro-Seek won't get are warned about", () => {
  const form = formOf("Date of Birth: 15 June 1985\nHouses: Whole Sign\nZodiac: Sidereal (Lahiri)");
  assert.deepEqual(form.warnings, [
    "The text uses Whole Sign houses, but Astro-Seek's chart will open with Placidus houses.",
    "The text uses the sidereal zodiac. AstroChart Bridge doesn't pass it on, so set it in Astro-Seek's chart.",
  ]);
});

test("readText's refusals show a message and their code", () => {
  for (const [text, code] of [
    ["Hello", "no-birth-data"],
    ["Date of Birth: 15 June 1985\nDate of Birth: 2 March 1990", "several-records"],
    ["x".repeat(100_001), "too-long"],
  ]) {
    const form = formOf(text);
    assert.equal(form.state, "refused");
    assert.equal(form.code, code);
    assert.ok(form.message.length > 0, code);
  }
});

test("the line under a box shows what its text means", () => {
  assert.deepEqual(checkField("date", "1985-06-15"), { value: "1985-06-15", message: "15 June 1985" });
  assert.deepEqual(checkField("time", "10:30 PM"), { value: "22:30:00", message: "22:30 at the birthplace" });
  assert.deepEqual(checkField("lat", "-33.8688"), { value: -33.8688, message: "33°52'8\"S" });
  assert.deepEqual(checkField("lng", "-122.3321"), { value: -122.3321, message: "122°19'56\"W" });
  assert.deepEqual(checkField("offset", "+5:30"), { value: 330, message: "UTC+05:30" });
});

test("a box that doesn't read says why, and an empty one says nothing", () => {
  assert.deepEqual(checkField("lat", ""), { value: null, message: "" });
  assert.match(checkField("lat", "95").message, /can't read this\. Try 47\.6062 or 47°36'N/);
  assert.deepEqual(checkField("date", "04/05/1985"), {
    value: null,
    message: "This could be 4 May 1985 or 5 April 1985. Write the month's name, or the year first.",
  });
});

test("the entry exists only once every box reads", () => {
  const values = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offset: -420 };
  assert.deepEqual(entryFor(values), {
    date: "1985-06-15",
    time: "10:30:00",
    lat: 47.6062,
    lng: -122.3321,
    offsetMinutes: -420,
  });
  for (const name of Object.keys(values)) assert.equal(entryFor({ ...values, [name]: null }), null, name);
  // 0 is a value: UTC, or the equator, or the prime meridian.
  assert.notEqual(entryFor({ ...values, lat: 0, lng: 0, offset: 0 }), null);
});

test("a confirmed entry opens the sky or the Astro-Seek chart, from the popup's ready screen", () => {
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };
  const popup = viewFor(analyzeEntry(entry), LA);
  const view = viewForEntry(entry, { warnings: ["a form warning"], ...LA });
  assert.deepEqual(view.rows, popup.rows);
  assert.deepEqual(view.sky, popup.sky);
  assert.deepEqual(view.warnings, ["a form warning"]);
  assert.match(view.notes[0], /Nothing checks that this offset/);
  assert.deepEqual(view.notes.slice(1), [...popup.notes, ...ASTRO_SEEK_NOTES]);
  assert.deepEqual(view.buttons, [...ASTRO_SEEK_BUTTONS, SHARE_BUTTON]);
});

test("a confirmed entry can be entered in astro.com, with the text's name as its last name", () => {
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };
  const { name } = formOf(LABELLED);
  assert.deepEqual(name, { first: "", last: "Example Person" });
  const view = viewForEntry(entry, { name, ...LA });
  assert.deepEqual(view.next, { label: "Enter in astro.com…", view: viewForAstroCom(view.sky, { local: "1985-06-15T10:30:00", name }) });
  assert.equal(view.next.view.buttons[0].holds.name, name);
});

test("text with no name, or a blank one, enters astro.com with no name", () => {
  assert.equal(formOf("Date of Birth: 15 June 1985").name, null);
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };
  assert.equal(viewForEntry(entry, LA).next.view.buttons[0].holds.name, null);
});

test("a name's runs of spaces become one, as a person would type it", () => {
  assert.deepEqual(formOf("Name: Example   Person\nDate of Birth: 15 June 1985").name, { first: "", last: "Example Person" });
});

// --- Share… ---

const ENTRY = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };

test("the form knows which offsets the text itself gave", () => {
  assert.deepEqual(formOf(LABELLED).statedOffsets, [-420]);
  assert.deepEqual(formOf("Timezone: PDT (UTC-7)\nUTC Offset: -08:00").statedOffsets, [-420, -480]);
  assert.deepEqual(formOf("Date of Birth: 15 June 1985\nTime Zone: PDT").statedOffsets, []);
});

test("a shared chart says it came from pasted text, with the offset as the text stated it", () => {
  const shared = chartForEntry(ENTRY, [-420]);
  assert.equal(shared.kind, "portable");
  assert.deepEqual(shared.chart.chart, {
    calendar: "gregorian",
    local: "1985-06-15T10:30:00",
    utcOffsetSeconds: -25200,
    latitude: 47.6062,
    longitude: -122.3321,
  });
  assert.deepEqual(shared.chart.source, { via: "paste", utcBasis: "declared" });
  assert.deepEqual(skyFor(shared.chart), { utc: "1985-06-15T17:30:00Z", lat: 47.6062, lng: -122.3321 });
});

test("an offset typed on the form, or one the text didn't give, is shared as entered", () => {
  assert.equal(chartForEntry(ENTRY, []).chart.source.utcBasis, "entered");
  assert.equal(chartForEntry({ ...ENTRY, offsetMinutes: -480 }, [-420]).chart.source.utcBasis, "entered");
  // Picking one of two offsets the text gave keeps it as the text's.
  assert.equal(chartForEntry({ ...ENTRY, offsetMinutes: -480 }, [-420, -480]).chart.source.utcBasis, "declared");
});

test("nothing but the chart and where it came from is shared: no name, place or zone", () => {
  const form = formOf(LABELLED);
  const text = serialize(chartForEntry(ENTRY, form.statedOffsets).chart);
  for (const kept of ["Example Person", "Seattle", "PDT", "Placidus", "Tropical"]) {
    assert.ok(!text.includes(kept), kept);
  }
});

test("the receiving page opens the shared link as the same sky, from pasted text", () => {
  const link = linkFor("https://example.invalid/chart.html", chartForEntry(ENTRY, [-420]).chart);
  const view = viewForImport(readLink(new URL(link).hash), LA);
  assert.deepEqual(view.sky, viewForEntry(ENTRY, LA).sky);
  assert.deepEqual(view.rows.at(-1), ["From", "pasted text"]);
  assert.match(view.warnings[0], /read from pasted text and checked by hand/);
});

test("a date before 15 October 1582 opens the sky but isn't shared", () => {
  const early = { ...ENTRY, date: "1500-06-15" };
  assert.equal(viewForEntry(early, LA).state, "ready");
  assert.deepEqual(chartForEntry(early, [-420]), { kind: "refused", reason: "before-gregorian" });
});
