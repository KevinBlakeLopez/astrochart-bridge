import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readChart } from "../extension/core/astroseek.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));

const refused = (reason) => ({ kind: "refused", reason });

test("reads the natal, traditional and asteroids fixtures", () => {
  const cases = {
    "ny-2024-04-17": { local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", printedUt: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
    "sydney-2024-01-15": { local: "2024-01-15T08:00:00", zoneLabel: "AEDT, DST", printedUt: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 },
    "ny-1944-01-10": { local: "1944-01-10T12:00:00", zoneLabel: "EWT, DST", printedUt: "1944-01-10T16:00:00Z", lat: 40.716667, lng: -74 },
    "ny-2021-03-14-gap": { local: "2021-03-14T02:30:00", zoneLabel: "EST", printedUt: "2021-03-14T06:30:00Z", lat: 40.716667, lng: -74 },
    "traditional-ny-2024-04-17": { local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", printedUt: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
    "traditional-ny-2021-03-14-gap": { local: "2021-03-14T02:30:00", zoneLabel: "EST", printedUt: "2021-03-14T06:30:00Z", lat: 40.716667, lng: -74 },
    "asteroids-ny-2024-04-17": { local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", printedUt: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
  };
  for (const [name, expected] of Object.entries(cases)) {
    const { url, input } = fixture(name);
    assert.deepEqual(readChart({ url, text: input.text }), expected, name);
  }
});

// Made-up variations on the New York header block, one change per test.
const NY = fixture("ny-2024-04-17");
const NY_RESULT = { local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", printedUt: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const LOCAL_LINE = "17 April 2024 - 08:00  (EDT, DST)";
const UT_BLOCK = "Universal Time (UT/GMT):\n17 April 2024 - 12:00  \n";
const TEXT = [
  "Date of Birth (local time):",
  LOCAL_LINE,
  "Universal Time (UT/GMT):",
  "17 April 2024 - 12:00  ",
  "Local Sidereal Time (LST):",
  "20:48:26",
  "Latitude, Longitude:",
  "40°43'N, 74°0'W",
  "City:",
  "New York",
].join("\n");

const withParams = (changes) => {
  const url = new URL(NY.url);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  return url.href;
};

test("the made-up header reads like the real page", () => {
  assert.deepEqual(readChart({ url: NY.url, text: TEXT }), NY_RESULT);
});

test("a URL missing a birth field is incomplete", () => {
  assert.deepEqual(readChart({ url: withParams({ narozeni_hodina: null }), text: TEXT }), refused("incomplete-url"));
});

test("an unknown direction code is incomplete", () => {
  assert.deepEqual(readChart({ url: withParams({ narozeni_sirka_smer: "2" }), text: TEXT }), refused("incomplete-url"));
});

test("a missing seconds field counts as zero", () => {
  assert.deepEqual(readChart({ url: withParams({ narozeni_sekunda: null }), text: TEXT }), NY_RESULT);
});

test("a page local time that disagrees with the URL is a mismatch", () => {
  assert.deepEqual(readChart({ url: NY.url, text: TEXT.replace("08:00", "09:00") }), refused("page-url-mismatch"));
});

test("page coordinates that disagree with the URL are a mismatch", () => {
  assert.deepEqual(readChart({ url: NY.url, text: TEXT.replace("40°43'N", "40°43'S") }), refused("page-url-mismatch"));
});

test("a second Universal Time line makes the page ambiguous", () => {
  assert.deepEqual(readChart({ url: NY.url, text: `${TEXT}\n${UT_BLOCK}` }), refused("ambiguous-page"));
});

test("a page without the Date of Birth line is unreadable", () => {
  const text = TEXT.replace(`Date of Birth (local time):\n${LOCAL_LINE}\n`, "");
  assert.deepEqual(readChart({ url: NY.url, text }), refused("unreadable-page"));
});

test("a page without a Universal Time line has no printed UT", () => {
  assert.deepEqual(readChart({ url: NY.url, text: TEXT.replace(UT_BLOCK, "") }), { ...NY_RESULT, printedUt: null });
});

test("short month names read like full ones", () => {
  assert.deepEqual(readChart({ url: NY.url, text: TEXT.replaceAll("April", "Apr") }), NY_RESULT);
});

// Traditional chart pages print seconds: "08:00:00" where the natal page prints "08:00".
const WITH_SECONDS = TEXT.replace("08:00  (", "08:00:00  (").replace("12:00  ", "12:00:00  ");

test("printed seconds that disagree with the URL are a mismatch", () => {
  const text = WITH_SECONDS.replace("08:00:00", "08:00:30");
  assert.deepEqual(readChart({ url: NY.url, text }), refused("page-url-mismatch"));
});

test("printed seconds carry into the local time and the printed UT", () => {
  const text = WITH_SECONDS.replace("08:00:00", "08:00:30").replace("12:00:00", "12:00:30");
  assert.deepEqual(readChart({ url: withParams({ narozeni_sekunda: "30" }), text }), {
    ...NY_RESULT,
    local: "2024-04-17T08:00:30",
    printedUt: "2024-04-17T12:00:30Z",
  });
});

// Safari's innerText runs the header block into one line, with a space, or
// nothing, between a value and the next label.
const ONE_LINE =
  "Date of Birth (local time):17 April 2024 - 08:00  (EDT, DST) Universal Time (UT/GMT):17 April 2024 - 12:00  " +
  "Local Sidereal Time (LST):20:48:26House system:Placidus system Latitude, Longitude:40°43'N, 74°0'W City:New York";

test("Safari's one-line header reads like the lines Chrome gives", () => {
  assert.deepEqual(readChart({ url: NY.url, text: `\n${ONE_LINE}\nCountry:  United States (US), NY\n` }), NY_RESULT);
});

test("a value run into a label readChart doesn't know is unreadable", () => {
  const text = ONE_LINE.replace(" City:", " Country:");
  assert.deepEqual(readChart({ url: NY.url, text }), refused("unreadable-page"));
});

test("a second Universal Time on Safari's one line makes the page ambiguous", () => {
  const text = ONE_LINE.replace(" Local", " Universal Time (UT/GMT):17 April 2024 - 12:00 Local");
  assert.deepEqual(readChart({ url: NY.url, text }), refused("ambiguous-page"));
});

test("a local line without a zone label has no zoneLabel", () => {
  assert.deepEqual(readChart({ url: NY.url, text: TEXT.replace("  (EDT, DST)", "") }), { ...NY_RESULT, zoneLabel: null });
});
