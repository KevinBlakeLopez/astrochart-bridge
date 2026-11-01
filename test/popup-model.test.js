import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import { viewFor, offsetPreview } from "../extension/popup-model.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const analyze = (name) => {
  const { url, input } = fixture(name);
  return analyzePage({ url, input });
};

const CLOCK_NOTE = "Stellarium Web's clock shows your computer's time zone and keeps running.";
const PRIVACY_NOTE =
  "Opening the sky sends this date, time and place to stellarium-web.org, and its page passes the link on to Google's advertising tags.";
// The choose and enter-offset screens show both, the privacy note last, just above Open sky.
// The ready screen replaces the general clock note with the exact time Stellarium will show.
const NOTES = [CLOCK_NOTE, PRIVACY_NOTE];
const RUNNING = "The clock starts running at once; its pause button stops it.";
const LOS_ANGELES = { timeZone: "America/Los_Angeles" };
const NY_PLACE = ["Place", "40°43'N, 74°0'W"];

test("ready: New York, seen from Los Angeles", () => {
  assert.deepEqual(viewFor(analyze("ny-2024-04-17"), LOS_ANGELES), {
    state: "ready",
    rows: [
      ["Local time", "17 Apr 2024, 08:00 (EDT, DST)"],
      ["Offset", "UTC-04:00"],
      ["UTC", "2024-04-17 12:00"],
      NY_PLACE,
    ],
    warnings: [],
    notes: [
      `Stellarium Web's clock will show 05:00 on 17 Apr, your computer's time. That's 08:00 on 17 Apr at the birthplace. ${RUNNING}`,
      PRIVACY_NOTE,
    ],
    sky: { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
  });
});

test("ready: the clock note gives both dates when they differ", () => {
  assert.equal(
    viewFor(analyze("sydney-2024-01-15"), LOS_ANGELES).notes[0],
    `Stellarium Web's clock will show 13:00 on 14 Jan, your computer's time. That's 08:00 on 15 Jan at the birthplace. ${RUNNING}`,
  );
});

test("ready: seen from the birthplace's own time zone, the clock matches", () => {
  assert.equal(
    viewFor(analyze("ny-2024-04-17"), { timeZone: "America/New_York" }).notes[0],
    `Stellarium Web's clock will show 08:00 on 17 Apr, the same as the birthplace. ${RUNNING}`,
  );
});

test("ready: Sydney, with a positive offset and UTC on the previous day", () => {
  assert.deepEqual(viewFor(analyze("sydney-2024-01-15")).rows, [
    ["Local time", "15 Jan 2024, 08:00 (AEDT, DST)"],
    ["Offset", "UTC+11:00"],
    ["UTC", "2024-01-14 21:00"],
    ["Place", "33°52'S, 151°12'E"],
  ]);
});

test("ready: an unknown zone label adds a warning", () => {
  const paris = {
    kind: "natal", local: "2024-01-15T09:00:00", zoneLabel: "CET", lat: 48.85, lng: 2.35,
    utc: "2024-01-15T08:00:00Z", utcSource: "printed", offsetMinutes: 60, warnings: ["zone-label-unknown"],
  };
  assert.deepEqual(viewFor(paris).warnings, [
    `Astro-Seek's zone label "CET" isn't one Chart Bridge can check, so its Universal Time is used as printed.`,
  ]);
});

test("ready: no zone label adds a warning and drops the brackets", () => {
  const view = viewFor({ ...analyze("ny-2024-04-17"), zoneLabel: null, warnings: ["zone-label-unknown"] });
  assert.deepEqual(view.rows[0], ["Local time", "17 Apr 2024, 08:00"]);
  assert.deepEqual(view.warnings, ["Astro-Seek printed no zone label, so its Universal Time is used as printed."]);
});

test("choose: the skipped time offers both readings and opens nothing yet", () => {
  assert.deepEqual(viewFor(analyze("ny-2021-03-14-gap")), {
    state: "choose",
    rows: [["Local time", "14 Mar 2021, 02:30 (EST)"], NY_PLACE],
    message: "Astro-Seek's page contradicts itself: it labels 02:30 as EST, but its Universal Time implies UTC-04:00.",
    choices: [
      {
        label: "2021-03-14 06:30 UTC, as Astro-Seek printed (UTC-04:00)",
        sky: { utc: "2021-03-14T06:30:00Z", lat: 40.716667, lng: -74 },
      },
      {
        label: "2021-03-14 07:30 UTC, as the label EST says (UTC-05:00)",
        sky: { utc: "2021-03-14T07:30:00Z", lat: 40.716667, lng: -74 },
      },
    ],
    notes: NOTES,
  });
});

test("enter-offset: no printed UT asks for the offset and previews the UTC", () => {
  const view = viewFor({
    kind: "natal", local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", lat: 40.716667, lng: -74,
    utc: null, utcSource: "needs-offset", reason: "no-printed-ut",
  });
  assert.equal(view.state, "enter-offset");
  assert.deepEqual(view.rows, [["Local time", "17 Apr 2024, 08:00 (EDT, DST)"], NY_PLACE]);
  assert.equal(view.message, "Astro-Seek didn't print a Universal Time. Enter the UTC offset at the birth place, as ±HH:MM.");
  assert.deepEqual(view.notes, NOTES);
  assert.deepEqual(offsetPreview(view, " -04:00 "), {
    utcText: "2024-04-17 12:00",
    sky: { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
  });
  assert.equal(offsetPreview(view, "4"), null);
});

test("refused: pages Chart Bridge doesn't open", () => {
  assert.deepEqual(viewFor(analyze("transit-sydney-2026-11-01")), {
    state: "refused",
    message: "This is a transit chart. Chart Bridge opens natal charts only.",
  });
  assert.deepEqual(viewFor(analyze("compatibility-sydney-ny")), {
    state: "refused",
    message: "This is a synastry or compatibility chart. Chart Bridge opens natal charts only.",
  });
  assert.deepEqual(viewFor(analyzePage({ url: "https://example.com/", input: { text: "" } })), {
    state: "refused",
    message: "Open an Astro-Seek birth chart to use Chart Bridge.",
  });
});

test("refused: chart pages Chart Bridge couldn't read show their code", () => {
  const { url } = fixture("ny-2024-04-17");
  assert.deepEqual(viewFor(analyzePage({ url, input: { text: "" } })), {
    state: "refused",
    message: "Chart Bridge couldn't read this chart page.",
    code: "unreadable-page",
  });
  for (const reason of ["incomplete-url", "ambiguous-page"]) {
    assert.deepEqual(viewFor({ kind: "refused", reason }), {
      state: "refused",
      message: "Chart Bridge couldn't read this chart page.",
      code: reason,
    });
  }
});

test("refused: a page that doesn't match its address", () => {
  assert.deepEqual(viewFor({ kind: "refused", reason: "page-url-mismatch" }), {
    state: "refused",
    message: "The page doesn't match its address. Reload the chart and try again.",
  });
});
