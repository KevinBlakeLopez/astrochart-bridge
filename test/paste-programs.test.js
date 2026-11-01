import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeEntry, analyzeProgramText, analyzeScreenshot } from "../extension/core/index.js";
import { readText } from "../extension/core/text.js";
import { chartForEntry, checkField, entryFor, formFor, formForText } from "../extension/paste-model.js";

// Each program's text as its reader's tests give it, without OCR's misreads.
// Jagannatha Hora's is the block its author pasted into his blog posts.
const JHORA = [
  "Bill Gates",
  "Natal Chart",
  "Date:          October 26, 1955",
  "Time:          9:17:59 pm",
  "Time Zone:     8:00:00 (West of GMT)",
  "Place:         122 W 20' 30\", 47 N 36' 32\"",
  "               Seattle, Washington, USA",
  "Altitude:      0.00 meters",
  "Sidereal Time: 23:27:48",
];
const PROGRAM_TEXTS = {
  "Jagannatha Hora": JHORA,
  "Solar Fire": ["Chart 1", "July 5 2015", "Natal Chart", "Jul 4 2015, Sat", "11:15 am  MDT +6:00", "Denver, Colorado", "39°N44'21\" 104°W59'03\""],
  "Astro Gold's Edit Chart": ["Date        23 Nov 1963", "Time        7:12 AM", "Place       Melbourne", "Latitude    37°S49'", "Longitude   144°E58'", "Timezone    AEST -10:00"],
  Valens: ["November 14, 1948", "21:14:39 UT", "Buckingham Palace", "00°10'W  51°30'N", "Prince Charles", "Radix", "Tropical", "Porphyrius"],
  Planetdance: ["Startup", "03/02/2021 18:56:37 EET +02:00", "Helsinki, Finland, 24e56, 60n10", "Whole Sign St:3:32:41"],
  Kepler: ["Johann Sebastian Bach", "March 31, 1685", "12:00 PM", "Standard Time", "Eisenach, Germany", "50 N 59   10 E 19", "Time Zone: 1 hours East"],
  "Janus, local mean time": ["Abraham Lincoln", "Natal Chart", "12 Feb 1809", "6:57:53 AM", "LMT +05:42:58", "Hodgenville KY", "USA", "85w44'24 37n34'26"],
  "Win*Star": ["Jodie Foster", "Nov 19, 1962", "Los Angeles,CA", "08:14:00 AM PST", "ZONE: +08:00", "118W15'00\"", "34N03'00\""],
  TimePassages: ["Brad Pitt", "Dec 18, 1963, 6:31:00 AM CST", "Shawnee, OK", "35N20, 96W55", "TLT 6:03", "ST 11:48:57", "Placidus"],
  Astrolog: ["Astrolog 8.00", "Kevin", "Mon July 19, 1971", "11:01am (DT Zone 8W)", "Seattle, WA", "122°20W  47°36N", "Placidus houses", "Julian Day: 2441152.25069"],
};

const lines = (...rows) => rows.join("\n");
const box = (form, name) => form.fields.find((field) => field.name === name);
// The entry the form gives once each box's text is read as the page reads it,
// with the program's reading picked where the box offers a choice.
const programChoice = ({ text, choices }) => (text === "" && choices ? choices.find((choice) => choice.label.includes("'s text)")).text : text);
const entryOf = (form) => entryFor(Object.fromEntries(form.fields.map((field) => [field.name, checkField(field.name, programChoice(field)).value])));

test("Jagannatha Hora's pasted block fills all five boxes, read as its text", () => {
  const form = formForText(lines(...JHORA));
  assert.deepEqual(
    form.fields.map(({ name, text, source }) => [name, text, source]),
    [
      ["date", "1955-10-26", "Read as Jagannatha Hora's text."],
      ["time", "21:17:59", "Read as Jagannatha Hora's text."],
      ["lat", "47.608889", "Read as Jagannatha Hora's text."],
      ["lng", "-122.341667", "Read as Jagannatha Hora's text."],
      ["offset", "-08:00", "Read as Jagannatha Hora's text."],
    ],
  );
  assert.equal(form.notes[1], "Read as Jagannatha Hora's text: its birth data is laid out the way Jagannatha Hora prints it.");
  assert.deepEqual(form.warnings, []);
});

for (const [program, text] of Object.entries(PROGRAM_TEXTS)) {
  test(`${program}'s text opens at the UTC its screenshot does`, () => {
    const form = formForText(lines(...text));
    const entry = entryOf(form);
    assert.ok(entry, JSON.stringify(form.fields));
    assert.equal(analyzeEntry(entry).utc, analyzeScreenshot(lines(...text)).utc);
  });
}

test("an offset to the second goes in its box to the second", () => {
  const form = formForText(lines(...PROGRAM_TEXTS["Janus, local mean time"]));
  assert.equal(box(form, "offset").text, "-05:42:58");
  assert.equal(checkField("offset", "-05:42:58").message, "UTC-05:42:58");
  // The text gave that offset, so a shared chart says so.
  assert.equal(chartForEntry(entryOf(form), form.statedOffsets).chart.source.utcBasis, "declared");
});

test("a program that prints no offset leaves the offset box empty, and says so", () => {
  const form = formForText(lines("1948.november.14", "21:14:39 ZN", "London", "00°10'W  51°30'N", "Prince Charles", "Radix"));
  assert.deepEqual(box(form, "offset"), {
    name: "offset",
    label: "UTC offset",
    placeholder: "-07:00, daylight saving included",
    text: "",
    source: "Morinus doesn't print the UTC offset. Enter the offset at the birthplace on that date, including daylight saving.",
  });
  assert.equal(box(form, "date").text, "1948-11-14");
});

test("a value both readers read alike keeps its line", () => {
  const form = formForText(lines(...JHORA, "Coordinates: 47°36'32\"N 122°20'30\"W"));
  assert.equal(box(form, "lat").source, "Line 10: 47°36'32\"N 122°20'30\"W");
  assert.equal(box(form, "lat").text, String(readText("Coordinates: 47°36'32\"N 122°20'30\"W").fields.lat.value));
});

test("a value the readers read differently leaves the box empty and offers both", () => {
  const form = formForText(lines(...JHORA, "Latitude: 47.5"));
  assert.deepEqual(box(form, "lat"), {
    name: "lat",
    label: "Latitude",
    placeholder: "47.6062 or 47°36'N",
    text: "",
    source: "Line 10 reads differently from Jagannatha Hora's layout. Pick the one the text means.",
    choices: [
      { label: "47.5 (line 10)", text: "47.5" },
      { label: "47.608889 (as Jagannatha Hora's text)", text: "47.608889" },
    ],
  });
});

test("an offset with the plus sign west, as Astro Gold writes it, is offered both ways round", () => {
  // Ordinary labelled text with Astro Gold's Latitude and Timezone rows. readText
  // reads -07:00 as west of UTC; Astro Gold's reader as east.
  const text = lines("Date: 15 Jun 1985", "Time: 10:30 AM", "Latitude: 47°N36'", "Longitude: 122°W19'", "Timezone: -07:00");
  assert.equal(analyzeProgramText(text).offsetMinutes, 420);
  const form = formForText(text);
  assert.equal(box(form, "offset").text, "");
  assert.deepEqual(box(form, "offset").choices, [
    { label: "-07:00 (line 5)", text: "-07:00" },
    { label: "+07:00 (as Astro Gold's text)", text: "+07:00" },
  ]);
  assert.ok(form.notes.includes("Astro Gold writes offsets west of Greenwich with a plus sign, so its +7:00 is UTC-07:00 here."));
});

test("an offset only Astro Gold's reader finds fills its box, with the note and warning to check it", () => {
  // readText reads no offset after a zone abbreviation, so only Astro Gold's
  // reading is left. The box shows it, and the line under it says UTC+07:00.
  const form = formForText(lines("Date: 15 Jun 1985", "Time: 10:30 AM", "Latitude: 47°N36'", "Longitude: 122°W19'", "Timezone: PDT -07:00"));
  assert.equal(box(form, "offset").text, "+07:00");
  assert.equal(checkField("offset", "+07:00").message, "UTC+07:00");
  assert.ok(form.notes.includes("Astro Gold writes offsets west of Greenwich with a plus sign, so its +7:00 is UTC-07:00 here."));
  assert.ok(form.warnings.includes("Nothing in this Astro Gold text checks its UTC offset. Compare the offset with the text."));
});

test("an ambiguous date stays ambiguous, with the program's reading among the choices", () => {
  const form = formForText(lines(...PROGRAM_TEXTS.Planetdance, "Date of Birth: 03/02/2021"));
  assert.equal(box(form, "date").text, "");
  assert.deepEqual(box(form, "date").choices.map((choice) => choice.text), ["2021-02-03", "2021-03-02"]);
});

test("a program's text its reader turns down gives the form with a warning and the code, and none of its values", () => {
  const east = JHORA.map((line) => line.replace("West of GMT", "East of GMT"));
  const form = formForText(lines(...east));
  assert.equal(form.state, "form");
  assert.deepEqual(form.warnings, [
    "This text is laid out like a desktop astrology program's, but its sidereal time doesn't fit its time, offset and longitude, so AstroChart Bridge didn't use that program's reading (sidereal-mismatch). Check each value against the text.",
  ]);
  assert.ok(form.fields.every((field) => field.text === ""));
});

test("Win*Star's plus-west ZONE is offered both ways round, with the note", () => {
  // readText reads its "ZONE:" label too, the usual way round.
  const form = formForText(lines(...PROGRAM_TEXTS["Win*Star"]));
  assert.deepEqual(box(form, "offset").choices, [
    { label: "+08:00 (line 5)", text: "+08:00" },
    { label: "-08:00 (as Win*Star's text)", text: "-08:00" },
  ]);
  assert.ok(form.notes.includes("Win*Star writes offsets west of Greenwich with a plus sign, so its +7:00 is UTC-07:00 here."));
});

test("TimePassages's own refusals are warned about too", () => {
  const misread = PROGRAM_TEXTS.TimePassages.map((line) => (line === "TLT 6:03" ? "TLT 6:13" : line));
  assert.match(formForText(lines(...misread)).warnings[0], /true local time doesn't fit .*\(true-local-time-mismatch\)/);
});

test("a refusal code the form doesn't know still gets a warning", () => {
  const form = formFor(readText("Place: Seattle"), { kind: "refused", reason: "some-new-check" });
  assert.match(form.warnings[0], /it doesn't pass that program's checks, .*\(some-new-check\)/);
});

test("a turned-down program's text with no labels still gives the form, to fill in by hand", () => {
  const form = formForText(lines("24 Apr 1942, Sat", "5:04 am  +4:00", "Brooklyn, New York", "40°N38' 073°W56'"));
  assert.equal(form.state, "form");
  assert.match(form.warnings[0], /\(weekday-mismatch\)/);
});

test("ordinary text that only looks like a program's has no warning, and readText's form", () => {
  const text = lines("Date: 1985-06-15", "Time: 10:30", "Latitude: 47.6062", "Longitude: -122.3321", "Timezone: -07:00");
  assert.equal(analyzeProgramText(text).reason, "unreadable-screenshot");
  assert.deepEqual(formForText(text), formFor(readText(text)));
});

test("text with no program's layout and no labels is still refused", () => {
  assert.equal(analyzeProgramText("Some notes about a chart"), null);
  assert.equal(formForText("Some notes about a chart").code, "no-birth-data");
});

test("text too long to read is refused before any program's reader sees it", () => {
  assert.equal(formForText(lines(...JHORA, "x".repeat(100_001))).code, "too-long");
});

test("Astro-Seek's and astro.com's labels don't count as a program's", () => {
  assert.equal(analyzeProgramText("Date of Birth: June 15, 1985\nUniv.Time: 17:30"), null);
});
