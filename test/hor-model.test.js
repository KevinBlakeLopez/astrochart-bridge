import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartFromHor, parseHor } from "../extension/core/morinus-hor.js";
import { viewForHorFile } from "../extension/hor-model.js";
import { ASTRO_SEEK_BUTTONS, ASTRO_SEEK_NOTES, viewFor, viewForAstroCom } from "../extension/popup-model.js";

const LA = { timeZone: "America/Los_Angeles" };
const file = (key, protocol = 2) => new Uint8Array(readFileSync(new URL(`../fixtures/morinus/${key}.p${protocol}.hor`, import.meta.url)));
const viewOf = (key, protocol) => viewForHorFile(file(key, protocol), LA);
const ZONE_NOTE =
  "Morinus saves the offset entered for a chart, not its time zone, so nothing here checks that offset against the birthplace and date.";

test("a Morinus chart opens like an AAF chart, with its name, birthplace and the time as entered", () => {
  const list = viewOf("ny-est-plus-dst");
  assert.equal(list.state, "hor-file");
  assert.equal(list.message, "1 chart in this file.");
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].label, "Test: 17 Apr 2024, 08:00, New York");

  const { view } = list.items[0];
  const plain = viewFor(chartFromHor(parseHor(file("ny-est-plus-dst"))), LA);
  assert.equal(view.state, "ready");
  assert.deepEqual(view.rows, [
    ["Name", "Test"],
    ["Local time", "17 Apr 2024, 08:00"],
    ["Offset", "UTC-04:00"],
    ["Entered as", "UTC-05:00 zone, with daylight saving"],
    ["UTC", "2024-04-17 12:00"],
    ["Birthplace", "New York"],
    ["Place", "40°43'N, 74°0'W"],
  ]);
  assert.deepEqual(view.sky, { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 });
  assert.deepEqual(view.buttons, ASTRO_SEEK_BUTTONS);
  assert.deepEqual(view.notes, [...plain.notes, ZONE_NOTE, ...ASTRO_SEEK_NOTES]);
  assert.deepEqual(view.warnings, []);
});

test("saves a zone chart as AAF in its local time", () => {
  const { download } = viewOf("ny-est-plus-dst").items[0].view;
  assert.equal(download.filename, "chart-2024-04-17.aaf");
  assert.match(download.text, /#B93:\*,40n43,74w00,5hw00,1/);
  assert.equal(download.note, undefined);
});

test("a Greenwich chart says so, needs no zone note, and saves in Universal Time", () => {
  const { view } = viewOf("greenwich").items[0];
  assert.deepEqual(view.rows[1], ["Local time", "17 Apr 2024, 08:00 (UT)"]);
  assert.deepEqual(view.rows.find(([label]) => label === "Entered as"), ["Entered as", "Greenwich time"]);
  assert.equal(view.notes.includes(ZONE_NOTE), false);
  assert.ok(view.download.note);
});

test("a Morinus chart can be entered in astro.com, with its one name field as the last name", () => {
  const { view } = viewOf("ny-est-plus-dst").items[0];
  const name = { first: "", last: "Test" };
  assert.deepEqual(view.next, { label: "Enter in astro.com…", view: viewForAstroCom(view.sky, { local: "2024-04-17T08:00:00", name }) });
  // Accented and non-Latin letters reach the boxes as Morinus saved them.
  const unicode = viewOf("unicode-text").items[0].view;
  assert.deepEqual(unicode.next.view.nameBoxes.map((box) => box.text), ["", "Nagy Róbert 東京 \\ test"]);
});

test("a Morinus chart that can't open has no astro.com step", () => {
  assert.equal("next" in viewOf("solar-return").items[0].view, false);
});

test("a horary chart says what kind it is", () => {
  const { view } = viewOf("horary").items[0];
  assert.deepEqual(view.rows[1], ["Chart type", "Horary"]);
});

test("each warning is worded for the screen", () => {
  const warningsOf = (key) => viewOf(key).items[0].view.warnings;
  assert.deepEqual(warningsOf("greenwich-with-dst"), [
    "Morinus has this chart in Greenwich time with daylight saving ticked, so it takes an hour off the time entered, and so does AstroChart Bridge.",
  ]);
  assert.deepEqual(warningsOf("seconds-in-coords"), [
    "The file gives the longitude to the second, but Morinus leaves the seconds out when it opens the file, so its chart is drawn up to 59\" east or west of this one.",
  ]);
});

test("a chart that can't open yet is listed by what the file says, and says why", () => {
  const list = viewOf("julian-1900");
  assert.equal(list.items[0].label, "Julian 1900: 29 Feb 1900 (Julian), 08:00, St Petersburg");
  assert.deepEqual(list.items[0].view, {
    state: "refused",
    message: "This date is in the Julian calendar, which AstroChart Bridge can't open yet.",
    code: "julian-calendar",
  });
  assert.equal(viewOf("bce-julian").items[0].label, "Unnamed chart: 16 Nov 575 BC (Julian), 12:00, Baghdad");
  for (const [key, code] of [
    ["bce-julian", "bce-date"],
    ["local-mean", "local-mean-time"],
    ["local-apparent", "local-apparent-time"],
    ["solar-return", "chart-type-unsupported"],
  ]) {
    const { view } = viewOf(key).items[0];
    assert.equal(view.state, "refused", key);
    assert.equal(view.code, code, key);
    assert.ok(view.message.length > 20, key);
  }
});

test("a file that isn't a readable chart names the field it stopped at", () => {
  const hor = file("ny-edt-as-zone-4", 0);
  const list = viewForHorFile(hor.slice(0, -2), LA);
  assert.equal(list.message, "AstroChart Bridge couldn't read this Morinus file.");
  assert.equal(list.items[0].label, "Unreadable Morinus file");
  assert.deepEqual(list.items[0].view, {
    state: "refused",
    message: "This file stops partway through its notes, so it may have been cut short.",
    code: "truncated",
  });

  // The notes, empty, are the last six bytes: V, a newline, p0, a newline and STOP.
  const planted = Uint8Array.from([...hor.slice(0, -6), ...new TextEncoder().encode("cos\nsystem\n(S'x'\ntR.")]);
  const { view } = viewForHorFile(planted, LA).items[0];
  assert.equal(view.code, "unsupported-opcode");
  assert.equal(
    view.message,
    "At its notes, this file holds something other than text, a number or yes or no, which is all a Morinus chart holds. AstroChart Bridge didn't read it.",
  );
});

test("an encoding guess is worded for the screen", () => {
  // The name as Python 2 writes a byte string, with a byte that isn't ASCII.
  const hor = file("ny-edt-as-zone-4", 0);
  const rest = hor.slice(hor.indexOf(0x2e) + 1);
  const named = Uint8Array.from([...new TextEncoder().encode("S'Nagy \\xf5'\np0\n."), ...rest]);
  assert.deepEqual(viewForHorFile(named, LA).items[0].view.warnings, [
    "This file was saved by an older Morinus, which doesn't record how it wrote accented letters. Check that the name and place look right.",
  ]);
});
