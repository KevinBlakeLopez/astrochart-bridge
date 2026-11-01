import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAaf } from "../extension/core/aaf.js";

const fixture = (name) => readFileSync(new URL(`../fixtures/aaf/${name}`, import.meta.url), "utf8");

// The invented New York birth data of the Astro-Seek fixtures, written the way
// the AAF'97 documentation's examples are.
const NY_A93 = "#A93:Test,New York,*,17.4.2024,8:00,New York,NY (US)";
const NY_B93 = "#B93:*,40n43,74w00,5hw00,1";
const NY = `${NY_A93}\n${NY_B93}\n`;

const NY_RECORD = {
  kind: "record",
  line: 1,
  lastName: "Test",
  firstName: "New York",
  sex: null,
  date: { year: 2024, month: 4, day: 17, calendar: "gregorian" },
  time: { hour: 8, minute: 0, second: 0, precision: "minute" },
  place: "New York",
  country: "NY (US)",
  julianDay: null,
  lat: 40.716667,
  lng: -74,
  offsetSeconds: -18000,
  timeType: "1",
  zoneName: null,
  chunks: [
    { id: "A93", text: "Test,New York,*,17.4.2024,8:00,New York,NY (US)" },
    { id: "B93", text: "*,40n43,74w00,5hw00,1" },
  ],
};

// The NY record with one #A93 or #B93 field replaced, by its position from 0.
const a93 = (position, value) => {
  const fields = NY_A93.slice(5).split(",");
  fields[position] = value;
  return `#A93:${fields.join(",")}\n${NY_B93}\n`;
};
const b93 = (position, value) => {
  const fields = NY_B93.slice(5).split(",");
  fields[position] = value;
  return `${NY_A93}\n#B93:${fields.join(",")}\n`;
};
const only = (text) => {
  const records = parseAaf(text);
  assert.equal(records.length, 1);
  return records[0];
};

test("reads a record written as the AAF'97 examples are", () => {
  assert.deepEqual(parseAaf(NY), [NY_RECORD]);
});

test("reads every record in a file, each with the line its #A93 starts on", () => {
  const sydney = "#A93:Test,Sydney,*,15.1.2024,8:00,Sydney,NSW (AU)\n#B93:*,33s52,151e12,10he00,1\n";
  const records = parseAaf(`${NY}\n${sydney}`);
  assert.deepEqual(records.map((record) => [record.line, record.firstName]), [[1, "New York"], [4, "Sydney"]]);
  assert.equal(records[1].lat, -33.866667);
  assert.equal(records[1].lng, 151.2);
  assert.equal(records[1].offsetSeconds, 36000);
});

test("ignores everything before the first #A93, and #: comment lines", () => {
  const text = `Saved from somewhere\n#: header\n${NY_A93}\n#: between\n${NY_B93}\n#: AAF end\n`;
  assert.deepEqual(only(text), { ...NY_RECORD, line: 3 });
});

test("an empty or comment-only text has no records", () => {
  assert.deepEqual(parseAaf(""), []);
  assert.deepEqual(parseAaf("#: nothing here\n"), []);
});

test("reads CRLF and CR line endings and a byte order mark", () => {
  assert.deepEqual(parseAaf(`﻿${NY_A93}\r\n${NY_B93}\r\n`), [NY_RECORD]);
  assert.deepEqual(parseAaf(`${NY_A93}\r${NY_B93}\r`), [NY_RECORD]);
});

test("ignores white space around fields, as the specification requires", () => {
  const text = "#A93: Test , New York ,*, 17.4.2024 ,\t8:00,New York,NY (US)\n#B93: * , 40n43 , 74w00 , 5hw00 , 1 \n";
  const record = only(text);
  assert.equal(record.lastName, "Test");
  assert.deepEqual(record.time, NY_RECORD.time);
  assert.equal(record.timeType, "1");
});

// Field 0 is the Julian Day, which takes precedence when it isn't *.
test("reads a Julian Day", () => {
  assert.equal(only(b93(0, "2460418.000000")).julianDay, 2460418);
});

test("an asterisk in any field means unknown and reads as null", () => {
  const record = only("#A93:*,*,*,*,*,*,*\n#B93:*,*,*,*,*\n");
  for (const key of ["lastName", "firstName", "sex", "date", "time", "place", "country", "julianDay", "lat", "lng", "offsetSeconds", "timeType"]) {
    assert.equal(record[key], null, key);
  }
});

test("an empty name field stays empty rather than unknown", () => {
  assert.equal(only(a93(1, "")).firstName, "");
});

test("a record with no #B93 has no coordinates, offset or time type", () => {
  const record = only(`${NY_A93}\n`);
  assert.equal(record.kind, "record");
  for (const key of ["julianDay", "lat", "lng", "offsetSeconds", "timeType"]) assert.equal(record[key], null, key);
});

test("keeps #ZNAM as the zone name and every chunk as it was written", () => {
  const record = only(`${NY}#ZNAM:EDT\n#SRC:Invented\n#COM:Line one,\nline two\n#LPOS:SO27AR38,\nMO12LE59\n`);
  assert.equal(record.zoneName, "EDT");
  assert.deepEqual(record.chunks.slice(2), [
    { id: "ZNAM", text: "EDT" },
    { id: "SRC", text: "Invented" },
    // Text chunks keep their line breaks; a chunk of fields continues where it broke.
    { id: "COM", text: "Line one,\nline two" },
    { id: "LPOS", text: "SO27AR38,MO12LE59" },
  ]);
});

test("chunk names are read in any case", () => {
  assert.deepEqual(parseAaf(NY.replace("#A93", "#a93").replace("#B93", "#b93")), [
    { ...NY_RECORD, chunks: NY_RECORD.chunks },
  ]);
});

// Dates are day.month.year, with an optional g or j for the calendar. Without
// one, dates before 15 October 1582 are Julian.
test("reads the calendar of a date", () => {
  assert.deepEqual(only(a93(3, "14.10.1582")).date, { year: 1582, month: 10, day: 14, calendar: "julian" });
  assert.deepEqual(only(a93(3, "15.10.1582")).date, { year: 1582, month: 10, day: 15, calendar: "gregorian" });
  assert.deepEqual(only(a93(3, "7.10.1582j")).date, { year: 1582, month: 10, day: 7, calendar: "julian" });
  assert.deepEqual(only(a93(3, "24.12.-6g")).date, { year: -6, month: 12, day: 24, calendar: "gregorian" });
  assert.deepEqual(only(a93(3, "1.3.1990j")).date, { year: 1990, month: 3, day: 1, calendar: "julian" });
  assert.deepEqual(only(a93(3, "08.02.0120")).date, { year: 120, month: 2, day: 8, calendar: "julian" });
});

test("leap days follow the date's calendar", () => {
  assert.equal(only(a93(3, "29.2.2024")).date.day, 29);
  assert.equal(only(a93(3, "29.2.2000")).date.day, 29);
  assert.deepEqual(only(a93(3, "29.2.1900")), { kind: "refused", reason: "bad-date", line: 1, value: "29.2.1900" });
  // 1500 was a leap year in the Julian calendar only.
  assert.equal(only(a93(3, "29.2.1500")).date.calendar, "julian");
  assert.equal(only(a93(3, "29.2.1500g")).kind, "refused");
});

test("refuses dates that aren't on the calendar or aren't day.month.year", () => {
  for (const value of ["31.4.2024", "0.1.2024", "1.13.2024", "2024-04-17", "17.4.24x", "17/4/2024", "17.4"]) {
    assert.deepEqual(only(a93(3, value)), { kind: "refused", reason: "bad-date", line: 1, value }, value);
  }
});

// Times are hour:min:sec, with h allowed in place of the first colon, and the
// minutes and seconds optional.
test("reads each documented time form and how precise it is", () => {
  const time = (value) => only(a93(4, value)).time;
  assert.deepEqual(time("16:55"), { hour: 16, minute: 55, second: 0, precision: "minute" });
  assert.deepEqual(time("22h30:12"), { hour: 22, minute: 30, second: 12, precision: "second" });
  assert.deepEqual(time("19h"), { hour: 19, minute: 0, second: 0, precision: "hour" });
  assert.deepEqual(time("23:59:59"), { hour: 23, minute: 59, second: 59, precision: "second" });
  assert.deepEqual(time("7"), { hour: 7, minute: 0, second: 0, precision: "hour" });
  // Astrolog pads the hour with a space, which is white space around the field.
  assert.deepEqual(time(" 8:00"), { hour: 8, minute: 0, second: 0, precision: "minute" });
});

test("refuses times that aren't a time of day", () => {
  for (const value of ["24:00", "12:60", "12:30:60", "8.00", "8:00pm", "noon", ""]) {
    assert.deepEqual(only(a93(4, value)), { kind: "refused", reason: "bad-time", line: 1, value }, value);
  }
});

test("refuses an #A93 without seven fields, since fields can't contain commas", () => {
  assert.deepEqual(only(`#A93:Test,New York,*,17.4.2024,8:00,New York\n${NY_B93}\n`), {
    kind: "refused",
    reason: "a93-fields",
    line: 1,
    value: "Test,New York,*,17.4.2024,8:00,New York",
  });
  assert.equal(only(a93(0, "Test, Jr.")).reason, "a93-fields");
});

test("refuses a #B93 without five fields", () => {
  assert.deepEqual(only(`${NY_A93}\n#B93:*,40n43,74w00,5hw00\n`), {
    kind: "refused",
    reason: "b93-fields",
    line: 2,
    value: "*,40n43,74w00,5hw00",
  });
});

test("reads each documented coordinate form", () => {
  assert.equal(only(b93(1, "48n46")).lat, 48.766667);
  assert.equal(only(b93(1, "15s53:03")).lat, -15.884167);
  assert.equal(only(b93(1, "0:00")).lat, 0);
  assert.equal(only(b93(2, "9e10")).lng, 9.166667);
  assert.equal(only(b93(2, "74w54:45")).lng, -74.9125);
  assert.equal(only(b93(2, "0:00")).lng, 0);
  assert.ok(Object.is(only(b93(2, "0w00")).lng, 0));
});

// Astrolog 8.00 writes the direction in capitals, as in the fixtures.
test("reads capital direction letters", () => {
  assert.equal(only(b93(1, "40N43")).lat, 40.716667);
  assert.equal(only(b93(2, "74W00")).lng, -74);
});

test("refuses coordinates out of range or with the other axis's letter", () => {
  const cases = [
    [1, "91n00", "bad-latitude"],
    [1, "40e43", "bad-latitude"],
    [1, "40n60", "bad-latitude"],
    [1, "1:00", "bad-latitude"],
    [1, "40.7", "bad-latitude"],
    [2, "181w00", "bad-longitude"],
    [2, "74n00", "bad-longitude"],
    [2, "74w00:60", "bad-longitude"],
    [2, "", "bad-longitude"],
  ];
  for (const [position, value, reason] of cases) {
    assert.deepEqual(only(b93(position, value)), { kind: "refused", reason, line: 2, value }, value);
  }
});

// The offset excludes daylight saving. he and hw are east and west of Greenwich.
test("reads each documented offset form, in seconds east of Greenwich", () => {
  const offset = (value) => only(b93(3, value)).offsetSeconds;
  assert.equal(offset("1he"), 3600);
  assert.equal(offset("5hw00"), -18000);
  assert.ok(Object.is(offset("0h"), 0));
  assert.equal(offset("0he32:06"), 1926);
  assert.equal(offset("5he30"), 19800);
  assert.equal(offset("3hw30"), -12600);
});

// Astrolog 8.00 writes the offset as hours and minutes followed by E or W.
test("reads Astrolog's offset form", () => {
  const offset = (value) => only(b93(3, value)).offsetSeconds;
  assert.equal(offset("5W"), -18000);
  assert.equal(offset("5:30E"), 19800);
  assert.ok(Object.is(offset("0W"), 0));
});

test("refuses offsets it can't read", () => {
  for (const value of ["5h", "5hx", "5hw60", "-5", "+05:00", "EST", "25he"]) {
    assert.deepEqual(only(b93(3, value)), { kind: "refused", reason: "bad-offset", line: 2, value }, value);
  }
});

test("reads every documented time type", () => {
  for (const type of ["0", "1", "w", "2", "h", "L", "m"]) assert.equal(only(b93(4, type)).timeType, type);
});

test("refuses a time type that isn't documented", () => {
  for (const value of ["D", "3", "l", "M", "11", "yes"]) {
    assert.deepEqual(only(b93(4, value)), { kind: "refused", reason: "bad-time-type", line: 2, value }, value);
  }
});

test("refuses a Julian Day that isn't a number", () => {
  assert.deepEqual(only(b93(0, "2460418,5")), { kind: "refused", reason: "b93-fields", line: 2, value: "2460418,5,40n43,74w00,5hw00,1" });
  assert.deepEqual(only(b93(0, "today")), { kind: "refused", reason: "bad-julian-day", line: 2, value: "today" });
});

test("refuses a record with two #B93 or two #ZNAM chunks", () => {
  assert.deepEqual(only(`${NY}${NY_B93}\n`), { kind: "refused", reason: "duplicate-b93", line: 3, value: "*,40n43,74w00,5hw00,1" });
  assert.equal(only(`${NY}#ZNAM:EDT\n#ZNAM:EST\n`).reason, "duplicate-znam");
});

test("refuses a record with a line that isn't a chunk", () => {
  assert.deepEqual(only(`${NY}#ZNAM EDT\n`), { kind: "refused", reason: "bad-chunk", line: 3, value: "#ZNAM EDT" });
});

test("a refused record doesn't stop the next one being read", () => {
  const records = parseAaf(`${a93(3, "31.4.2024")}${NY}`);
  assert.deepEqual(records, [
    { kind: "refused", reason: "bad-date", line: 1, value: "31.4.2024" },
    { ...NY_RECORD, line: 3 },
  ]);
});

test("keeps names and places in Unicode as they are", () => {
  const record = only(a93(0, "Müller-Lüdenscheidt").replace("New York,NY (US)", "Zürich,CH"));
  assert.equal(record.lastName, "Müller-Lüdenscheidt");
  assert.equal(record.place, "Zürich");
});

test("reads files written by Astrolog 8.00", () => {
  const [ny] = parseAaf(fixture("astrolog-8.00-new-york.aaf"));
  assert.deepEqual(ny, {
    kind: "record",
    line: 2,
    lastName: null,
    firstName: "New York Test",
    sex: null,
    date: { year: 2024, month: 4, day: 17, calendar: "gregorian" },
    time: { hour: 8, minute: 0, second: 0, precision: "minute" },
    place: "New York",
    country: "NY (US)",
    julianDay: 2460418,
    lat: 40.716667,
    lng: -74,
    offsetSeconds: -18000,
    timeType: "1",
    zoneName: null,
    chunks: [
      { id: "A93", text: "*,New York Test,*,17.4.2024, 8:00,New York,NY (US)" },
      { id: "B93", text: "2460418.000000,40N43,74W00,5W,1" },
    ],
  });
  const [delhi] = parseAaf(fixture("astrolog-8.00-delhi-seconds.aaf"));
  assert.deepEqual(delhi.time, { hour: 6, minute: 15, second: 30, precision: "second" });
  assert.equal(delhi.lat, 28.613889);
  assert.equal(delhi.lng, 77.208333);
  assert.equal(delhi.offsetSeconds, 19800);
  assert.equal(delhi.timeType, "0");
  assert.equal(delhi.julianDay, 2447951.531597);
});
