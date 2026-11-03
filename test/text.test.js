import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TEXT_LENGTH, readField, readText, separateLabels } from "../extension/core/text.js";

// Every sample uses invented birth data for an invented person.

// Each field's value, for tests that don't look at where a value came from.
const values = (result) => Object.fromEntries(Object.entries(result.fields).map(([field, read]) => [field, read.value]));

// The one field read from a single labelled line.
const field = (line, name) => readText(line).fields[name];

test("reads labelled fields", () => {
  const text = [
    "Name: Example Person",
    "Date of Birth: June 15, 1985",
    "Time of Birth: 10:30 AM",
    "Place: Seattle, Washington, USA",
    "Timezone: PDT (UTC-7)",
    "House System: Placidus",
    "Zodiac: Tropical",
  ].join("\n");
  assert.deepEqual(readText(text), {
    kind: "fields",
    fields: {
      name: { line: 1, text: "Example Person", value: "Example Person" },
      date: { line: 2, text: "June 15, 1985", value: "1985-06-15" },
      time: { line: 3, text: "10:30 AM", value: "10:30:00" },
      place: { line: 4, text: "Seattle, Washington, USA", value: "Seattle, Washington, USA" },
      zone: { line: 5, text: "PDT (UTC-7)", value: "PDT (UTC-7)" },
      offset: { line: 5, text: "PDT (UTC-7)", value: -420 },
      houses: { line: 6, text: "Placidus", value: "placidus" },
      zodiac: { line: 7, text: "Tropical", value: "tropical" },
    },
  });
});

test("reads key=value text", () => {
  const text = [
    "birth_date=1985-06-15",
    "birth_time=10:30",
    "latitude=47.6062",
    "longitude=-122.3321",
    "utc_offset=-07:00",
    "house_system=placidus",
    "zodiac=tropical",
  ].join("\n");
  assert.deepEqual(values(readText(text)), {
    date: "1985-06-15",
    time: "10:30:00",
    lat: 47.6062,
    lng: -122.3321,
    offset: -420,
    houses: "placidus",
    zodiac: "tropical",
  });
});

test("reads a report's Born line, coordinates and GMT zone", () => {
  const text = [
    "Natal Chart",
    "",
    "Born: 15 June 1985 at 10:30 AM",
    "Location: Seattle, Washington",
    "Coordinates: 47°36'N 122°19'W",
    "Time Zone: GMT -7",
    "House System: Placidus",
  ].join("\r\n");
  const { fields } = readText(text);
  assert.deepEqual(fields.date, { line: 3, text: "15 June 1985 at 10:30 AM", value: "1985-06-15" });
  assert.deepEqual(fields.time, { line: 3, text: "15 June 1985 at 10:30 AM", value: "10:30:00" });
  assert.deepEqual(values({ fields }), {
    date: "1985-06-15",
    time: "10:30:00",
    place: "Seattle, Washington",
    lat: 47.6,
    lng: -122.316667,
    zone: "GMT -7",
    offset: -420,
    houses: "placidus",
  });
});

test("dates in the usual English and ISO forms", () => {
  for (const date of [
    "1985-06-15",
    "1985/6/15",
    "15 June 1985",
    "15th Jun. 1985",
    "15-Jun-1985",
    "June 15, 1985",
    "Jun 15 1985",
    "Sept 15 1985",
    "Saturday, 15 June 1985",
    "15/06/1985",
    "15.6.1985",
  ]) {
    const expected = date.startsWith("Sept") ? "1985-09-15" : "1985-06-15";
    assert.equal(field(`Date of Birth: ${date}`, "date").value, expected, date);
  }
});

test("a numeric date that reads two ways is ambiguous, not guessed", () => {
  assert.deepEqual(field("Birth date: 04/05/1985", "date"), {
    line: 1,
    text: "04/05/1985",
    value: null,
    problem: "ambiguous",
    readings: ["1985-05-04", "1985-04-05"],
  });
  // The same either way round.
  assert.equal(field("Birth date: 05/05/1985", "date").value, "1985-05-05");
});

test("dates that aren't on the calendar, or have two-digit years, are unreadable", () => {
  for (const date of ["31 June 1985", "30/02/1985", "1985-13-01", "15 Juin 1985", "15/06/85", "yesterday"]) {
    assert.equal(field(`Date of Birth: ${date}`, "date").problem, "unreadable", date);
  }
});

test("12-hour and 24-hour times", () => {
  for (const [time, expected] of [
    ["10:30", "10:30:00"],
    ["22:30:15", "22:30:15"],
    ["10:30 PM", "22:30:00"],
    ["10:30pm", "22:30:00"],
    ["10 a.m.", "10:00:00"],
    ["12:05 AM", "00:05:00"],
    ["12:05 PM", "12:05:00"],
  ]) {
    assert.equal(field(`Time of Birth: ${time}`, "time").value, expected, time);
  }
  for (const time of ["13:00 PM", "0:30 AM", "24:00", "10:60", "10.30"]) {
    assert.equal(field(`Time of Birth: ${time}`, "time").problem, "unreadable", time);
  }
});

test("an unknown birth time stays unreadable, never noon or midnight", () => {
  const { fields } = readText("Date of Birth: 15 June 1985\nTime of Birth: unknown");
  assert.deepEqual(fields.time, { line: 2, text: "unknown", value: null, problem: "unreadable" });
});

test("fields the text doesn't mention are left out", () => {
  assert.deepEqual(Object.keys(readText("Date of Birth: 15 June 1985").fields), ["date"]);
});

test("an ISO date and time carry their offset", () => {
  assert.deepEqual(values(readText("Born: 1985-06-15T10:30:00-07:00")), {
    date: "1985-06-15",
    time: "10:30:00",
    offset: -420,
  });
  assert.equal(readText("Born: 1985-06-15T17:30:00Z").fields.offset.value, 0);
});

test("UTC offsets as programs write them", () => {
  for (const [offset, expected] of [
    ["-07:00", -420],
    ["-0700", -420],
    ["-7", -420],
    ["UTC-7", -420],
    ["GMT -7", -420],
    ["UTC−07:00", -420],
    ["+05:30", 330],
    ["UTC", 0],
    ["(GMT)", 0],
    // Local mean time, to the second, summed as the programs' readers sum it.
    ["-05:42:58", 0 - (5 * 60 + 42 + 58 / 60)],
    ["+01:24:00", 84],
  ]) {
    assert.equal(field(`UTC Offset: ${offset}`, "offset").value, expected, offset);
  }
  assert.ok(Object.is(field("UTC Offset: -00:00:00", "offset").value, 0));
  // No sign, out of range, seconds past 59 or seconds without minutes' colon,
  // or no offset at all.
  for (const offset of ["7", "+15:00", "-07:75", "+14:00:30", "-05:42:60", "-0542:58", "Pacific"]) {
    assert.equal(field(`UTC Offset: ${offset}`, "offset").problem, "unreadable", offset);
  }
});

test("a zone name gives no offset: Etc/GMT zones count westward", () => {
  for (const zone of ["America/Los_Angeles", "Etc/GMT+7", "PDT"]) {
    assert.deepEqual(Object.keys(readText(`Time Zone: ${zone}`).fields), ["zone"], zone);
  }
});

test("an offset after the time must follow it directly", () => {
  assert.equal(readText("Time of Birth: 10:30 UTC-7").fields.offset.value, -420);
  assert.equal(readText("Time of Birth: 10:30 (approx. -5 min)").fields.offset, undefined);
});

test("coordinates in decimal and in degrees and minutes", () => {
  for (const [lat, expected] of [
    ["47.6062", 47.6062],
    ["-33.8688", -33.8688],
    ["47.6062 N", 47.6062],
    ["33.8688S", -33.8688],
    ["47.6°N", 47.6],
    ["47°36'N", 47.6],
    ["47° 36' 15\" N", 47.604167],
    ["47º36′N", 47.6],
    ["47n36", 47.6],
    ["33s52'08", -33.868889],
  ]) {
    assert.equal(field(`Latitude: ${lat}`, "lat").value, expected, lat);
  }
  assert.equal(field("Longitude: 122w19", "lng").value, -122.316667);
  assert.equal(field("Longitude: 151°12'E", "lng").value, 151.2);
});

test("latitudes and longitudes that can't be right are unreadable", () => {
  for (const lat of ["95", "47°36'E", "-47°N", "47°75'N", "47 36 N", "47.6 north"]) {
    assert.equal(field(`Latitude: ${lat}`, "lat").problem, "unreadable", lat);
  }
  assert.equal(field("Longitude: 181", "lng").problem, "unreadable");
  assert.equal(field("Longitude: 47°36'N", "lng").problem, "unreadable");
});

test("a coordinate pair is read by its letters, else latitude first", () => {
  for (const pair of ["47°36'N 122°19'W", "122°19'W, 47°36'N", "47n36 122w19", "47.6, -122.316667", "47.6 / -122.316667"]) {
    assert.deepEqual(values(readText(`Coordinates: ${pair}`)), { lat: 47.6, lng: -122.316667 }, pair);
  }
  for (const pair of ["47°36'N 33°52'S", "122°19'W 151°12'E", "-122.3, 47.6", "47.6"]) {
    const { fields } = readText(`Coordinates: ${pair}`);
    assert.equal(fields.lat.problem, "unreadable", pair);
    assert.equal(fields.lng.problem, "unreadable", pair);
  }
});

test("house systems by their usual names; others stay as written", () => {
  for (const [houses, expected] of [
    ["Placidus", "placidus"],
    ["Koch houses", "koch"],
    ["Whole-Sign", "whole-sign"],
    ["Whole Signs", "whole-sign"],
  ]) {
    assert.equal(field(`House System: ${houses}`, "houses").value, expected, houses);
  }
  assert.deepEqual(field("Houses: Gauquelin sectors", "houses"), {
    line: 1,
    text: "Gauquelin sectors",
    value: null,
    problem: "unreadable",
  });
});

test("tropical or sidereal; the ayanamsa has its own field", () => {
  assert.deepEqual(values(readText("Zodiac: Sidereal (Lahiri)\nAyanamsa: Lahiri")), {
    zodiac: "sidereal",
    ayanamsa: "Lahiri",
  });
  assert.equal(field("Zodiac: Draconic", "zodiac").problem, "unreadable");
});

test("planet positions, transit dates and a report's own date are ignored", () => {
  const text = [
    "Report printed",
    "Date: 30 October 2026",
    "Time: 14:02",
    "Date of Birth: 15 June 1985",
    "Sun: 24°15' Gemini",
    "Moon = 12 Aries",
    "Ascendant: 3°02' Leo",
    "Transit Date: 1 November 2026",
    "Saturn 12°14' Scorpio R",
  ].join("\n");
  assert.deepEqual(values(readText(text)), { date: "1985-06-15" });
});

test("text with no birth data is refused", () => {
  for (const text of ["", "Sun: 24°15' Gemini\nMoon: 12°00' Aries", "Hello, world"]) {
    assert.deepEqual(readText(text), { kind: "refused", reason: "no-birth-data" }, text);
  }
});

test("two different birth dates or names mean two charts, and are refused", () => {
  for (const text of [
    "Date of Birth: 15 June 1985\nDate of Birth: 2 March 1990",
    "Name: Example Person\nName: Another Person",
  ]) {
    assert.deepEqual(readText(text), { kind: "refused", reason: "several-records" });
  }
});

test("a line repeated, or a value read twice the same, counts once", () => {
  const text = "Date of Birth: 15 June 1985\nBorn: 15 June 1985 at 10:30\nDate of Birth: 15 June 1985";
  assert.deepEqual(readText(text).fields.date, { line: 1, text: "15 June 1985", value: "1985-06-15" });
});

// An Astro-Seek chart's data as one copy gave it, its rows run together.
const RUN_ON =
  "Date of Birth (local time):15 June 1985 - 10:30  (PDT)Universal Time (UT/GMT):15 June 1985 - 17:30  " +
  "Local Sidereal Time (LST):10:05:12House system:Placidus systemLatitude, Longitude:47°36'N, 122°19'WCity:Seattle\n" +
  "Country:United States United States (US), WA";

test("labels run together on one line are read as lines of their own, at that line", () => {
  assert.deepEqual(readText(RUN_ON).fields, {
    date: { line: 1, text: "15 June 1985 - 10:30  (PDT)", value: "1985-06-15" },
    time: { line: 1, text: "15 June 1985 - 10:30  (PDT)", value: "10:30:00" },
    houses: { line: 1, text: "Placidus system", value: "placidus" },
    lat: { line: 1, text: "47°36'N, 122°19'W", value: 47.6 },
    lng: { line: 1, text: "47°36'N, 122°19'W", value: -122.316667 },
    place: { line: 1, text: "Seattle", value: "Seattle" },
    // Astro-Seek's Country row, now read: its US and WA help choose the town.
    country: { line: 2, text: "United States United States (US), WA", value: "United States United States (US), WA" },
  });
});

test("separateLabels puts each run-on label on a line of its own", () => {
  assert.equal(
    separateLabels(RUN_ON),
    [
      "Date of Birth (local time):15 June 1985 - 10:30  (PDT)",
      "Universal Time (UT/GMT):15 June 1985 - 17:30  ",
      "Local Sidereal Time (LST):10:05:12",
      "House system:Placidus system",
      "Latitude, Longitude:47°36'N, 122°19'W",
      "City:Seattle",
      "Country:United States United States (US), WA",
    ].join("\n"),
  );
});

test("a label is split off only where it starts with a capital and ends in a colon", () => {
  for (const line of ["Place: Velocity: 3", "notes=see city=Seattle", "Place: Mexico City"]) {
    assert.equal(separateLabels(line), line, line);
  }
  assert.equal(readText("Born: 15 June 1985 Time of Birth: 10:30").fields.time?.value, "10:30:00");
});

test("offsets that disagree are a conflict, with both kept", () => {
  const { fields } = readText("Timezone: PDT (UTC-7)\nUTC Offset: -08:00");
  assert.deepEqual(fields.offset, {
    value: null,
    problem: "conflict",
    sightings: [
      { line: 1, text: "PDT (UTC-7)", value: -420 },
      { line: 2, text: "-08:00", value: -480 },
    ],
  });
});

test("labels are matched however they're written", () => {
  for (const line of [
    "date of birth: 15 June 1985",
    "  - Date of Birth (local time): 15 June 1985",
    "BIRTH_DATE = 15 June 1985",
    "Birth-Date:15 June 1985",
  ]) {
    assert.equal(readText(line).fields.date?.value, "1985-06-15", line);
  }
});

test("text past the size limit is refused before it is read", () => {
  const text = `Date of Birth: 15 June 1985\n${"x".repeat(MAX_TEXT_LENGTH)}`;
  assert.deepEqual(readText(text), { kind: "refused", reason: "too-long" });
});

test("a form field reads what the same field reads in pasted text", () => {
  for (const [name, label, typed] of [
    ["date", "Date of Birth", "15 June 1985"],
    ["date", "Date of Birth", "1985-06-15"],
    ["date", "Date of Birth", "04/05/1985"],
    ["time", "Time of Birth", "10:30 PM"],
    ["time", "Time of Birth", "25:00"],
    ["lat", "Latitude", "47°36'N"],
    ["lat", "Latitude", "47º36′N"],
    ["lng", "Longitude", "122w19"],
    ["lng", "Longitude", "-122.3321"],
    ["offset", "UTC Offset", "UTC−7"],
    ["offset", "UTC Offset", "+05:30"],
  ]) {
    const { line, text, ...pasted } = field(`${label}: ${typed}`, name);
    assert.deepEqual(readField(name, typed), pasted, `${name} ${typed}`);
  }
});

test("a form field holds one value, with spaces around it ignored", () => {
  assert.deepEqual(readField("date", "  15 June 1985 "), { value: "1985-06-15" });
  assert.deepEqual(readField("time", " 10:30 "), { value: "10:30:00" });
  // A date and a time together belong in two fields.
  assert.deepEqual(readField("date", "15 June 1985 at 10:30"), { value: null, problem: "unreadable" });
  assert.deepEqual(readField("time", "10:30 PDT"), { value: null, problem: "unreadable" });
  assert.deepEqual(readField("lat", ""), { value: null, problem: "unreadable" });
});

test("readField refuses a field the form doesn't have", () => {
  assert.throws(() => readField("houses", "Placidus"), /can't read a houses field/);
});
