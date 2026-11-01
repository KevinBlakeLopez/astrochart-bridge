import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartFromRecord, parseAaf } from "../extension/core/aaf.js";
import { analyzePage } from "../extension/core/index.js";
import { decodeAafFile, viewForAafChart, viewForAafText, withAafExport } from "../extension/aaf-model.js";
import { ASTRO_SEEK_BUTTONS, ASTRO_SEEK_NOTES, viewFor, viewForSky } from "../extension/popup-model.js";

const LA = { timeZone: "America/Los_Angeles" };
const astroSeek = (name) =>
  analyzePage(JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8")));
const astrolog = readFileSync(new URL("../fixtures/aaf/astrolog-8.00-new-york.aaf", import.meta.url), "utf8");

const NY_TEXT = "#A93:Test,New York,*,17.4.2024,8:00,New York,NY (US)\n#B93:*,40n43,74w00,5hw00,1\n";
const SYDNEY_TEXT = "#A93:Test,Sydney,*,15.1.2024,8:00,Sydney,NSW (AU)\n#B93:*,33s52,151e12,10he00,1\n";
const UT_NOTE =
  "The AAF file gives this chart in Universal Time, since the page doesn't say how its offset splits into standard time and daylight saving.";

test("lists every chart in an AAF text by name, local date and time, and birthplace", () => {
  const list = viewForAafText(`${NY_TEXT}${SYDNEY_TEXT}`, LA);
  assert.equal(list.state, "aaf-list");
  assert.deepEqual(list.items.map((item) => item.label), [
    "New York Test: 17 Apr 2024, 08:00, New York, NY (US)",
    "Sydney Test: 15 Jan 2024, 08:00, Sydney, NSW (AU)",
  ]);
  assert.equal(list.message, "2 charts in this file. Choose one.");
});

test("a chart from AAF opens like an astro.com chart, with its name and birthplace", () => {
  const { view } = viewForAafText(NY_TEXT, LA).items[0];
  const chart = chartFromRecord(parseAaf(NY_TEXT)[0]);
  const plain = viewFor(chart, LA);
  assert.deepEqual(view.rows, [
    ["Name", "New York Test"],
    ["Local time", "17 Apr 2024, 08:00"],
    ["Offset", "UTC-04:00"],
    ["UTC", "2024-04-17 12:00"],
    ["Birthplace", "New York, NY (US)"],
    ["Place", "40°43'N, 74°0'W"],
  ]);
  assert.equal(view.state, "ready");
  assert.deepEqual(view.sky, { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 });
  assert.deepEqual(view.buttons, ASTRO_SEEK_BUTTONS);
  assert.deepEqual(view.notes, [...plain.notes, ...ASTRO_SEEK_NOTES]);
  assert.deepEqual(view.warnings, []);
  assert.equal(view.download.filename, "chart-2024-04-17.aaf");
});

test("an AAF chart's zone name is shown beside its local time", () => {
  const { view } = viewForAafText(`${NY_TEXT}#ZNAM:EDT\n`, LA).items[0];
  assert.deepEqual(view.rows[1], ["Local time", "17 Apr 2024, 08:00 (EDT)"]);
});

test("a time given only to the hour says so", () => {
  const { view } = viewForAafText(NY_TEXT.replace("8:00", "8h"), LA).items[0];
  assert.deepEqual(view.warnings, ["The AAF file gives this birth time to the hour only, so the chart is drawn for 08:00."]);
});

test("a chart without a name is listed as unnamed", () => {
  const list = viewForAafText(NY_TEXT.replace("Test,New York", "*,*").replace("New York,NY (US)", "*,*"), LA);
  assert.equal(list.items[0].label, "Unnamed chart: 17 Apr 2024, 08:00");
  assert.equal(list.message, "1 chart in this file.");
});

test("a chart that can't be opened is listed with why, and isn't filled in", () => {
  const list = viewForAafText(`${NY_TEXT.replace("8:00", "*")}${NY_TEXT.replace("40n43", "*")}`, LA);
  assert.deepEqual(list.items.map((item) => item.label), [
    "New York Test: 17 Apr 2024, time unknown, New York, NY (US)",
    "New York Test: 17 Apr 2024, 08:00, New York, NY (US)",
  ]);
  assert.deepEqual(list.items[0].view, {
    state: "refused",
    message: "This chart has no birth time: the file gives *. Chart Bridge doesn't guess one.",
    code: "no-birth-time",
  });
  assert.deepEqual(list.items[1].view, {
    state: "refused",
    message: "This chart has no coordinates, so there is no sky to open.",
    code: "no-coordinates",
  });
});

test("every refusal chartFromRecord can return has its own message", () => {
  const reasons = [
    "no-birth-date", "no-birth-time", "julian-calendar", "pre-gregorian-date", "no-coordinates", "local-mean-time",
    "meridian-time", "unknown-daylight-saving", "no-offset", "offset-seconds", "offset-out-of-range", "julian-day-mismatch",
  ];
  const messages = new Set();
  for (const reason of reasons) {
    const view = viewForAafChart({ kind: "refused", reason, line: 1 }, LA);
    assert.equal(view.state, "refused", reason);
    assert.equal(view.code, reason);
    assert.ok(!view.message.startsWith("Line"), reason);
    messages.add(view.message);
  }
  assert.equal(messages.size, reasons.length);
});

test("a record parseAaf couldn't read is listed with its line and value", () => {
  const list = viewForAafText(`${NY_TEXT.replace("17.4.2024", "31.4.2024")}${SYDNEY_TEXT}`, LA);
  assert.deepEqual(list.items[0], {
    label: "Line 1: unreadable record",
    view: { state: "refused", message: "Line 1: Chart Bridge couldn't read the date \"31.4.2024\".", code: "bad-date" },
  });
  assert.equal(list.items[1].view.state, "ready");
});

test("a text with no records says what an AAF file looks like", () => {
  assert.deepEqual(viewForAafText("Name: New York Test\n", LA), {
    state: "aaf-list",
    items: [],
    message: "Chart Bridge found no AAF records. Each record starts with a line beginning #A93:.",
  });
});

test("opens a file written by Astrolog 8.00", () => {
  const list = viewForAafText(astrolog, LA);
  assert.equal(list.items[0].label, "New York Test: 17 Apr 2024, 08:00, New York, NY (US)");
  assert.equal(list.items[0].view.state, "ready");
});

test("an Astro-Seek chart with a checked zone label saves its local time", () => {
  const chart = astroSeek("ny-2024-04-17");
  const view = withAafExport(viewFor(chart, LA), chart);
  assert.deepEqual(view, {
    ...viewFor(chart, LA),
    download: {
      label: "Save as AAF file",
      filename: "chart-2024-04-17.aaf",
      text: "#: Chart Bridge\n#A93:*,*,*,17.4.2024,8:00,*,*\n#B93:*,40n43,74w00,5hw00,1\n",
    },
  });
});

test("an astro.com chart saves in Universal Time and says why", () => {
  const chart = {
    kind: "natal",
    site: "astro-com",
    local: "2024-04-17T23:00:00",
    zoneLabel: null,
    lat: 40.716667,
    lng: -74,
    utc: "2024-04-18T03:00:00Z",
    utcSource: "declared",
    offsetMinutes: -240,
  };
  const { download } = withAafExport(viewFor(chart, LA), chart);
  assert.equal(download.filename, "chart-2024-04-18.aaf");
  assert.equal(download.note, UT_NOTE);
  assert.match(download.text, /#A93:\*,\*,\*,18\.4\.2024,3:00,\*,\*\n#B93:\*,40n43,74w00,0h,0\n/);
});

test("a Stellarium Web tab saves its sky in Universal Time", () => {
  const sky = { utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 };
  const { download } = withAafExport(viewForSky(sky, LA), sky);
  assert.equal(download.note, "The AAF file gives this moment in Universal Time, since Stellarium Web shows no birthplace time zone.");
  assert.match(download.text, /#B93:\*,33s52,151e12,0h,0\n/);
});

// Saving is offered only once the UTC is decided: not while a reading must be
// picked or an offset typed, and not on a refusal.
test("screens without a decided UTC offer no file", () => {
  for (const chart of [astroSeek("ny-2021-03-14-gap"), astroSeek("transit-sydney-2026-11-01")]) {
    const view = viewFor(chart, LA);
    assert.equal(withAafExport(view, chart), view);
  }
});

test("reads a UTF-8 file, with or without a byte order mark", () => {
  const bytes = new TextEncoder().encode("#A93:Müller,Jürgen,m,1.6.1980,8:00,Zürich,CH\n");
  assert.deepEqual(decodeAafFile(bytes), { text: "#A93:Müller,Jürgen,m,1.6.1980,8:00,Zürich,CH\n" });
  assert.equal(decodeAafFile(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes])).text.charCodeAt(0), 0xfeff);
});

// AAF'97 doesn't name an encoding, and older programs write a single-byte one.
test("a file that isn't UTF-8 is read as Windows-1252, with a warning", () => {
  const bytes = new Uint8Array([...new TextEncoder().encode("#A93:M"), 0xfc, ...new TextEncoder().encode("ller\n")]);
  assert.deepEqual(decodeAafFile(bytes), {
    text: "#A93:Müller\n",
    warning: "This file isn't UTF-8, so Chart Bridge read it as Windows-1252. Check that accented letters in names look right.",
  });
});
