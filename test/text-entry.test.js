import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeEntry } from "../extension/core/index.js";
import { readText } from "../extension/core/text.js";
import { astroSeekUrl } from "../extension/core/astroseek.js";
import { stellariumUrl } from "../extension/core/stellarium.js";
import { viewFor } from "../extension/popup-model.js";

// Invented birth data, as key=value text.
const PASTED = [
  "birth_date=1985-06-15",
  "birth_time=10:30",
  "latitude=47.6062",
  "longitude=-122.3321",
  "utc_offset=-07:00",
].join("\n");

// What the review form passes on when it is confirmed unchanged.
function confirmed(text) {
  const { fields } = readText(text);
  return {
    date: fields.date.value,
    time: fields.time.value,
    lat: fields.lat.value,
    lng: fields.lng.value,
    offsetMinutes: fields.offset.value,
  };
}

const ENTRY = confirmed(PASTED);

const RESULT = {
  kind: "natal",
  site: "text",
  local: "1985-06-15T10:30:00",
  zoneLabel: null,
  lat: 47.6062,
  lng: -122.3321,
  utc: "1985-06-15T17:30:00Z",
  utcSource: "declared",
  offsetMinutes: -420,
};

test("pasted text, confirmed unchanged, gives the chart result every reader gives", () => {
  assert.deepEqual(analyzeEntry(ENTRY), RESULT);
});

test("an offset can move the UTC to the day before", () => {
  const result = analyzeEntry({ ...ENTRY, date: "1985-06-16", time: "00:30:00", offsetMinutes: 330 });
  assert.equal(result.utc, "1985-06-15T19:00:00Z");
});

test("the result opens in Stellarium Web at its UTC and place", () => {
  const sent = Object.fromEntries(new URL(stellariumUrl(analyzeEntry(ENTRY))).searchParams);
  assert.deepEqual(sent, { date: "1985-06-15T17:30:00Z", lat: "47.6062", lng: "-122.3321" });
});

test("the result opens in Astro-Seek in UT, at the coordinates rounded to the minute", () => {
  const sent = new URL(astroSeekUrl(analyzeEntry(ENTRY))).searchParams;
  const names = [
    "den", "mesic", "rok", "hodina", "minuta", "sekunda",
    "sirka_stupne", "sirka_minuty", "sirka_smer", "delka_stupne", "delka_minuty", "delka_smer",
    "timezone_form", "timezone_dst_form",
  ];
  assert.deepEqual(Object.fromEntries(names.map((name) => [name, sent.get(`narozeni_${name}`)])), {
    den: "15", mesic: "6", rok: "1985", hodina: "17", minuta: "30", sekunda: "00",
    sirka_stupne: "47", sirka_minuty: "36", sirka_smer: "0",
    delka_stupne: "122", delka_minuty: "20", delka_smer: "1",
    timezone_form: "0", timezone_dst_form: "0",
  });
});

test("the popup's ready screen shows it, with the offset it states", () => {
  const view = viewFor(analyzeEntry(ENTRY), { timeZone: "America/Los_Angeles" });
  assert.equal(view.state, "ready");
  assert.deepEqual(view.rows, [
    ["Local time", "15 Jun 1985, 10:30"],
    ["Offset", "UTC-07:00"],
    ["UTC", "1985-06-15 17:30"],
    ["Place", "47°36'N, 122°20'W"],
  ]);
  assert.deepEqual(view.sky, { utc: "1985-06-15T17:30:00Z", lat: 47.6062, lng: -122.3321 });
});

test("a missing or malformed value is a bug in the form, and throws naming the field", () => {
  for (const [field, value] of [
    ["date", null],
    ["date", "15 June 1985"],
    ["time", null],
    ["time", "10:30"],
    ["lat", null],
    ["lat", 91],
    ["lng", Number.NaN],
    ["lng", -181],
    ["offsetMinutes", null],
    ["offsetMinutes", 900],
    ["offsetMinutes", 30.5],
  ]) {
    assert.throws(() => analyzeEntry({ ...ENTRY, [field]: value }), new RegExp(`valid ${field}$`), `${field} ${value}`);
  }
});

// Checked in Node 24: Date.parse reads both of these as a later day.
test("a day past the month's end, or 24:00, throws instead of rolling over", () => {
  for (const change of [{ date: "1985-02-30" }, { date: "1985-02-29" }, { time: "24:00:00" }]) {
    assert.throws(() => analyzeEntry({ ...ENTRY, ...change }), /valid date and time$/, JSON.stringify(change));
  }
});

test("the error never repeats the birth data", () => {
  assert.throws(() => analyzeEntry({ ...ENTRY, lat: 91 }), (error) => !/1985|47\.6|122\.3/.test(error.message));
});
