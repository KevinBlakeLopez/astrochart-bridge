import { test } from "node:test";
import assert from "node:assert/strict";
import { readText } from "../extension/core/text.js";
import { astroSeekButtons, astroSeekNotes, astroSeekSaveNote, shareButton, viewFor, viewForAstroCom } from "../extension/popup-model.js";
import { analyzeEntry } from "../extension/core/index.js";
import { serialize, skyFor } from "../extension/core/portable.js";
import { linkFor, readLink, viewForImport } from "../extension/chart-model.js";
import { chartForEntry, checkField, entryFor, formFor, formForText, localEntryFor, viewForEntry, viewForLocalEntry } from "../extension/paste-model.js";

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

test("the other fields are shown as written, with a note that only the forms get the town", () => {
  const form = formOf(LABELLED);
  assert.deepEqual(form.rows, [
    ["Name", "Example Person"],
    ["Place", "Seattle, Washington, USA"],
    ["Time zone", "PDT (UTC-7)"],
    ["Houses", "Placidus"],
    ["Zodiac", "Tropical"],
  ]);
  assert.deepEqual(form.warnings, []);
  assert.match(form.notes.at(-1), /doesn't look places up\..*astro\.com's form and Save in Astro-Seek… get the town/);
  assert.equal(form.town, "Seattle, Washington, USA");
});

test("a labelled place that is only coordinates names no town for the forms", () => {
  for (const place of [`122 W 20' 30", 47 N 36' 32"`, "40N43 74W00", "47°36'N 122°20'W"]) {
    const form = formOf(`Name: Example Person\nDate: 2024-04-17\nTime: 08:00\nOffset: -04:00\nPlace: ${place}\nLatitude: 40°43'N\nLongitude: 74°0'W`);
    assert.equal(form.town, null, place);
    assert.ok(!form.notes.some((note) => note.includes("doesn't look places up")), place);
  }
  for (const place of ["5 North Street, Springfield", "Route 66 East, Tulsa"]) {
    const form = formOf(`Date: 2024-04-17\nTime: 08:00\nOffset: -04:00\nPlace: ${place}\nLatitude: 40°43'N\nLongitude: 74°0'W`);
    assert.equal(form.town, place);
  }
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
  assert.deepEqual(view.notes.slice(1), [...popup.notes, astroSeekNotes()[0], astroSeekSaveNote()]);
  assert.deepEqual(view.buttons, [
    ...astroSeekButtons(),
    { label: "Save in Astro-Seek…", saves: { town: null, name: null, gender: null }, secondary: true },
    { label: "Which planets were visible", does: "helioscope", secondary: true },
    { label: "Parans", does: "parans", secondary: true },
    { label: "Declinations", does: "declinations", secondary: true },
    shareButton(),
  ]);
});

test("a confirmed entry can be entered in astro.com, with the text's name as its first name", () => {
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };
  const { name } = formOf(LABELLED);
  assert.deepEqual(name, { first: "Example Person", last: "" });
  const view = viewForEntry(entry, { name, ...LA });
  assert.deepEqual(view.next, { label: "Enter in astro.com…", view: viewForAstroCom(view.sky, { local: "1985-06-15T10:30:00", name }) });
  assert.equal(view.next.view.buttons[0].holds.name, name);
});

test("a Gender or Sex line is read as female, male or event, and anything else isn't guessed", () => {
  const gender = (line) => readText(`Date of Birth: June 15, 1985\n${line}`).fields.gender;
  for (const [line, value] of [
    ["Gender: Female", "female"],
    ["Sex: F", "female"],
    ["Gender: woman", "female"],
    ["Sex: M", "male"],
    ["Gender: Male", "male"],
    ["Gender: Event", "event"],
  ]) {
    assert.equal(gender(line).value, value, line);
  }
  assert.equal(gender("Gender: unknown").problem, "unreadable");
});

test("a Country line and a Gender line go to both forms, the country after the town", () => {
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 39.1, lng: -94.583333, offsetMinutes: -300 };
  const form = formOf("Name: Example Person\nDate of Birth: June 15, 1985\nTime of Birth: 10:30 AM\nPlace: Kansas City\nCountry: USA\nGender: F");
  assert.equal(form.town, "Kansas City, USA");
  assert.equal(form.gender, "female");
  assert.deepEqual(form.rows.slice(0, 4), [["Name", "Example Person"], ["Place", "Kansas City"], ["Country", "USA"], ["Gender", "F"]]);
  const view = viewForEntry(entry, { name: form.name, town: form.town, gender: form.gender, ...LA });
  assert.deepEqual(view.next.view, viewForAstroCom(view.sky, { local: "1985-06-15T10:30:00", name: form.name, town: "Kansas City, USA", gender: "female" }));
  assert.equal(view.buttons.find(({ saves }) => saves).saves.gender, "female");
  // A country with no place names no town.
  assert.equal(formOf("Date of Birth: June 15, 1985\nCountry: USA").town, null);
});

test("text copied from a saved Astro-Seek chart gives its name, and its town with its country once", () => {
  const copied = [
    "Example Person",
    "Date of Birth (local time):17 April 2024 - 08:00  (EDT, DST)",
    "Universal Time (UT/GMT):17 April 2024 - 12:00",
    "Local Sidereal Time (LST):20:48:26",
    "House system:Placidus system",
    "Latitude, Longitude:40°43'N, 74°0'W",
    "City:New York",
    "Country:United States United States (US), NY",
  ].join("\n");
  const form = formForText(copied);
  assert.deepEqual(form.name, { first: "Example Person", last: "" });
  assert.equal(form.town, "New York, United States United States (US), NY");
});

test("text copied from an Astro-Seek chart with each label above its value fills every box", () => {
  const copied = [
    "Example Chart",
    "Date of Birth (local time):",
    "5 January 2022 - 15:28  (PST)",
    "Universal Time (UT/GMT):",
    "5 January 2022 - 23:28  ",
    "Local Sidereal Time (LST):",
    "22:20:31",
    "House system:",
    "Placidus system",
    "Latitude, Longitude:",
    "47°39'N, 122°24'W",
    "City:",
    "Seattle",
    "Country:",
    "United States (US), WA",
  ].join("\n");
  const form = formForText(copied);
  assert.equal(form.state, "form");
  assert.deepEqual(
    form.fields.map(({ name, text, source }) => [name, text, source]),
    [
      ["date", "2022-01-05", "Line 3: 5 January 2022 - 15:28  (PST)"],
      ["time", "15:28", "Line 3: 5 January 2022 - 15:28  (PST)"],
      ["lat", "47.65", "Line 11: 47°39'N, 122°24'W"],
      ["lng", "-122.4", "Line 11: 47°39'N, 122°24'W"],
      ["offset", "-08:00", "Read as Astro-Seek's text."],
    ],
  );
  assert.deepEqual(form.name, { first: "Example Chart", last: "" });
  assert.equal(form.town, "Seattle, United States (US), WA");
});

test("the text's place goes in astro.com's town field", () => {
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };
  const { town } = formOf(LABELLED);
  assert.equal(town, "Seattle, Washington, USA");
  const view = viewForEntry(entry, { town, ...LA });
  assert.deepEqual(view.next.view, viewForAstroCom(view.sky, { local: "1985-06-15T10:30:00", town }));
  assert.equal(view.next.view.buttons[0].holds.town, town);
});

test("text with no place, or two, enters astro.com with no town", () => {
  assert.equal(formOf("Date of Birth: 15 June 1985").town, null);
  assert.equal(formOf("Date of Birth: 15 June 1985\nPlace: Seattle\nCity: Tacoma").town, null);
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };
  assert.equal(viewForEntry(entry, LA).next.view.buttons[0].holds.town, null);
});

test("a form whose text gives no offset says only astro.com can open it; one with an offset doesn't", () => {
  const form = formOf("Date of Birth: 15 June 1985 10:30\nLatitude: 47.6062\nLongitude: -122.3321\nCity: Seattle");
  assert.match(form.notes.at(-1), /^With the UTC offset left empty, the chart can open only in astro\.com/);
  assert.equal(formOf(LABELLED).notes.some((note) => note.startsWith("With the UTC offset left empty")), false);
});

test("with the offset box empty, the other four boxes give a chart for astro.com alone", () => {
  const values = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offset: null };
  assert.equal(entryFor(values), null);
  assert.deepEqual(localEntryFor(values, ""), { local: "1985-06-15T10:30:00", lat: 47.6062, lng: -122.3321 });
  assert.deepEqual(localEntryFor(values, "  "), localEntryFor(values, ""));
  // Text in the offset box that doesn't read keeps the button disabled.
  assert.equal(localEntryFor(values, "soon"), null);
  for (const name of ["date", "time", "lat", "lng"]) assert.equal(localEntryFor({ ...values, [name]: null }, ""), null, name);
});

test("a chart for astro.com alone opens its screen with no UTC, the text's name and town, and says why", () => {
  const chart = { local: "1985-06-15T10:30:00", lat: 47.6062, lng: -122.3321 };
  const name = { first: "Example Person", last: "" };
  const view = viewForLocalEntry(chart, { name, town: "Seattle" });
  const astroCom = viewForAstroCom({ utc: null, lat: chart.lat, lng: chart.lng }, { local: chart.local, name, town: "Seattle" });
  assert.equal(view.state, "to-astro-com");
  assert.match(view.notes[0], /^No UTC offset was entered, so this chart can open only in astro\.com\./);
  assert.deepEqual(view.notes.slice(1), astroCom.notes);
  assert.deepEqual(view.buttons, astroCom.buttons);
  assert.equal(view.buttons[0].holds.utc, null);
});

test("text with no name, or a blank one, enters astro.com with no name", () => {
  assert.equal(formOf("Date of Birth: 15 June 1985").name, null);
  const entry = { date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 };
  assert.equal(viewForEntry(entry, LA).next.view.buttons[0].holds.name, null);
});

test("a name's runs of spaces become one, as a person would type it", () => {
  assert.deepEqual(formOf("Name: Example   Person\nDate of Birth: 15 June 1985").name, { first: "Example Person", last: "" });
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

test("nothing but the chart and where it came from is shared without a name and town: no zone", () => {
  const form = formOf(LABELLED);
  const text = serialize(chartForEntry(ENTRY, form.statedOffsets).chart);
  for (const kept of ["Example Person", "Seattle", "PDT", "Placidus", "Tropical"]) {
    assert.ok(!text.includes(kept), kept);
  }
});

test("the form's name and town go with the chart as labels, for the share page to offer", () => {
  const form = formOf(LABELLED);
  const shared = chartForEntry(ENTRY, form.statedOffsets, { town: form.town, name: form.name });
  assert.deepEqual(shared.chart.labels, { name: "Example Person", town: "Seattle, Washington, USA" });
  const text = serialize(shared.chart);
  for (const kept of ["PDT", "Placidus", "Tropical"]) assert.ok(!text.includes(kept), kept);
});

test("the receiving page opens the shared link as the same sky, from pasted text", () => {
  const link = linkFor("https://example.invalid/chart.html", chartForEntry(ENTRY, [-420]).chart);
  const view = viewForImport(readLink(new URL(link).hash), LA);
  assert.deepEqual(view.sky, viewForEntry(ENTRY, LA).sky);
  assert.deepEqual(view.rows.at(-1), ["From", "pasted text"]);
  assert.match(view.warnings[0], /read from pasted text and checked by hand/);
});

// Pasted text never says which calendar an earlier date is in, so the form
// refuses it as every other reader does, rather than read it as Gregorian.
test("a date before 15 October 1582 stays in its box, says why, and goes no further", () => {
  const form = formOf(["Date of Birth: 1 June 1500", "Time of Birth: 12:00", "Latitude: 40.7", "Longitude: -74", "UTC Offset: -04:56"].join("\n"));
  assert.deepEqual([box(form, "date").text, box(form, "date").source], ["1500-06-01", "Line 1: 1 June 1500"]);
  const refusal = { value: null, message: "AstroChart Bridge opens dates from 15 October 1582 on, when the Gregorian calendar began." };
  for (const typed of ["1500-06-01", "1582-10-14", "14 October 1582"]) assert.deepEqual(checkField("date", typed), refusal, typed);
  assert.deepEqual(checkField("date", "15 October 1582"), { value: "1582-10-15", message: "15 October 1582" });
  // The date alone keeps Continue off, and Continue to astro.com with it.
  const values = Object.fromEntries(form.fields.map(({ name, text }) => [name, checkField(name, text).value]));
  assert.deepEqual(Object.keys(values).filter((name) => values[name] === null), ["date"]);
  assert.equal(entryFor(values), null);
  assert.equal(localEntryFor(values, ""), null);
});

test("an entry dated before 15 October 1582 is a bug in the form, and opens nothing", () => {
  const early = { ...ENTRY, date: "1582-10-14" };
  assert.throws(() => viewForEntry(early, LA), /15 October 1582/);
  assert.throws(() => chartForEntry(early, [-420]), /15 October 1582/);
});
