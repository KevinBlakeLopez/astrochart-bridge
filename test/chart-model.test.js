import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromFragment, parse, toFragment, toPortable } from "../extension/core/portable.js";
import {
  MAX_FILE_BYTES,
  chartToPassOn,
  fileFor,
  linkBase,
  linkFor,
  qrViewFor,
  readChartFile,
  readLink,
  keepFileForImport,
  shareDataFor,
  takeFileForImport,
  viewForImport,
} from "../extension/chart-model.js";
import { astroSeekNotes, viewForAstroCom, viewForAstroComByHand } from "../extension/popup-model.js";

const PRIVACY_NOTE =
  "Opening the sky sends this date, time and place to stellarium-web.org, and its page passes the link on to Google's advertising tags.";
const RUNNING = "The clock starts running at once; its pause button stops it.";
const LOS_ANGELES = { timeZone: "America/Los_Angeles" };

const NY = { local: "2024-04-17T08:00:00", utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const NY_SKY = { utc: NY.utc, lat: NY.lat, lng: NY.lng };
const NY_SOURCE = { site: "astro-seek", via: "page", zoneLabel: "EDT, DST", utcBasis: "printed" };

// What readLink gives for a chart's link.
function received(sky, source, labels) {
  const built = toPortable(sky, source, labels);
  assert.equal(built.kind, "portable", `refused: ${built.reason}`);
  return fromFragment(`#${toFragment(built.chart)}`);
}

const BUTTONS = [
  { label: "Open Stellarium Web", opens: "stellarium" },
  { label: "Open chart in Astro-Seek", opens: "astro-seek" },
  { label: "Copy link", does: "copy", secondary: true, shares: true },
  { label: "Show QR code", does: "qr", secondary: true, shares: true },
  { label: "Download file", does: "download", secondary: true, shares: true },
];

// --- Reading the link ---

test("no fragment, or a bare #, is no link at all", () => {
  assert.equal(readLink(""), null);
  assert.equal(readLink("#"), null);
});

test("a fragment is read as a portable chart", () => {
  const result = received(NY, NY_SOURCE);
  const hash = `#${toFragment(result.chart)}`;
  assert.deepEqual(readLink(hash), result);
});

test("a fragment that isn't a chart is a refusal, not no link", () => {
  assert.deepEqual(readLink("#v1=e30"), { kind: "refused", reason: "not-astrochart" });
  assert.deepEqual(readLink("#top"), { kind: "refused", reason: "malformed" });
});

// --- The chart screen ---

test("New York from an Astro-Seek page, seen from Los Angeles", () => {
  assert.deepEqual(viewForImport(received(NY, NY_SOURCE), LOS_ANGELES), {
    state: "ready",
    rows: [
      ["Local time", "17 Apr 2024, 08:00 (EDT, DST)"],
      ["Offset", "UTC-04:00"],
      ["UTC", "2024-04-17 12:00"],
      ["Place", "40°43'N, 74°0'W"],
      ["From", "Astro-Seek page"],
    ],
    warnings: [],
    notes: [
      `Stellarium Web's clock will show 05:00 on 17 Apr, your computer's time. That's 08:00 on 17 Apr at the birthplace. ${RUNNING}`,
      PRIVACY_NOTE,
      ...astroSeekNotes(),
    ],
    sky: { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
    buttons: BUTTONS,
    next: { label: "Enter in astro.com…", view: viewForAstroComByHand(NY_SKY, { local: NY.local }) },
  });
});

test("on the web, Enter in astro.com… leads to the values to type in; the extension's copy fills in the form", () => {
  for (const site of ["astro-seek", "astro-com", undefined]) {
    const web = viewForImport(received(NY, { site }), LOS_ANGELES);
    assert.deepEqual(web.next, { label: "Enter in astro.com…", view: viewForAstroComByHand(NY_SKY, { local: NY.local }) }, String(site));
    const extension = viewForImport(received(NY, { site }), { ...LOS_ANGELES, canFill: true });
    assert.deepEqual(extension.next, { label: "Enter in astro.com…", view: viewForAstroCom(NY_SKY, { local: NY.local }) }, String(site));
    assert.deepEqual(web.buttons, BUTTONS, String(site));
  }
});

test("the values to type in are the form's, with a plain link to it and nothing kept", () => {
  const view = viewForAstroComByHand(NY_SKY, { local: NY.local });
  assert.equal(view.state, "astro-com-by-hand");
  assert.equal(view.message, "Type these into astro.com's form. This page can't fill it in for you.");
  assert.deepEqual(view.rows, viewForAstroCom(NY_SKY, { local: NY.local }).rows);
  assert.deepEqual(view.buttons, [{ label: "Open astro.com's form", url: "https://www.astro.com/cgi/ade.cgi" }]);
  // Nothing checks the zone on the page, so the note says what to check, and how to enter it in UT instead.
  assert.match(view.notes[0], /Check that it's 4 h west \(UTC-04:00\)\. If it isn't, choose 00:00 GMT \/ UT under show \/ hide extended settings and enter 17 April 2024, 12:00 instead\./);
  assert.match(view.notes[1], /^astro\.com asks for a country and town, not coordinates\. Choose the town nearest this place/);
  assert.equal(view.nameBoxes, undefined);
});

test("Sydney: the UTC is the day before, and the place is south and east", () => {
  const view = viewForImport(
    received({ local: "2024-01-15T08:00:00", utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 }, { zoneLabel: "AEDT, DST" }),
    { timeZone: "Australia/Sydney" },
  );
  assert.deepEqual(view.rows, [
    ["Local time", "15 Jan 2024, 08:00 (AEDT, DST)"],
    ["Offset", "UTC+11:00"],
    ["UTC", "2024-01-14 21:00"],
    ["Place", "33°52'S, 151°12'E"],
  ]);
  assert.equal(
    view.notes[0],
    `Stellarium Web's clock will show 08:00 on 15 Jan, the same as the birthplace. ${RUNNING}`,
  );
  assert.deepEqual(view.sky, { utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 });
});

test("a local-mean-time offset shows its seconds", () => {
  const view = viewForImport(
    received({ local: "1645-07-26T07:30:03", utc: "1645-07-26T07:30:43Z", lat: 51.5, lng: -0.166667 }, { site: "astro-com", via: "screenshot" }),
    LOS_ANGELES,
  );
  assert.deepEqual(view.rows.slice(0, 3), [
    ["Local time", "26 Jul 1645, 07:30"],
    ["Offset", "UTC-00:00:40"],
    ["UTC", "1645-07-26 07:30"],
  ]);
  assert.deepEqual(view.sky, { utc: "1645-07-26T07:30:43Z", lat: 51.5, lng: -0.166667 });
});

test("a chart read from a screenshot carries a warning to compare it", () => {
  const view = viewForImport(received(NY, { site: "astro-com", via: "screenshot" }), LOS_ANGELES);
  assert.deepEqual(view.rows.at(-1), ["From", "astro.com screenshot"]);
  assert.deepEqual(view.warnings, [
    "This chart was read from a screenshot by OCR on the device that shared it. Compare these rows with the chart before opening it: nothing checked the latitude.",
  ]);
});

test("the From row names what the source gives, and is left out when it gives nothing", () => {
  const from = (source) => viewForImport(received(NY, source), LOS_ANGELES).rows.find(([label]) => label === "From");
  assert.deepEqual(from({ site: "astro-com", via: "page" }), ["From", "astro.com page"]);
  assert.deepEqual(from({ site: "astro-seek" }), ["From", "Astro-Seek"]);
  assert.deepEqual(from({ via: "screenshot" }), ["From", "screenshot"]);
  // A site a later version adds is shown by its code rather than dropped.
  assert.deepEqual(from({ site: "clipboard-text", via: "page" }), ["From", "clipboard-text page"]);
  assert.equal(from({}), undefined);
});

test("a chart from pasted text names it in words, and warns that nothing checked its offset", () => {
  const view = viewForImport(received(NY, { via: "paste", utcBasis: "entered" }), LOS_ANGELES);
  assert.deepEqual(view.rows.at(-1), ["From", "pasted text"]);
  assert.deepEqual(view.warnings, [
    "This chart was read from pasted text and checked by hand on the device that shared it. Nothing checked its UTC offset against the birthplace and date.",
  ]);
});

// Any lower-case code is a valid site or via, and "constructor" is the one
// that names a member of Object.prototype: a plain lookup printed its source.
test("a site or via of constructor is shown as its code", () => {
  const view = viewForImport(received(NY, { site: "constructor", via: "constructor" }), LOS_ANGELES);
  assert.deepEqual(view.rows.at(-1), ["From", "constructor constructor"]);
  assert.deepEqual(view.warnings, []);
});

test("markup in a zone label comes through as the same text", () => {
  const label = `<img src=x onerror="alert(1)">`;
  const view = viewForImport(received(NY, { zoneLabel: label }), LOS_ANGELES);
  assert.deepEqual(view.rows[0], ["Local time", `17 Apr 2024, 08:00 (${label})`]);
});

// --- Other screens ---

test("no link explains what the page is for, with no buttons", () => {
  assert.deepEqual(viewForImport(null), {
    state: "empty",
    message: "Open an AstroChart Bridge link or chart file to see its chart here.",
    notes: [],
    buttons: [],
  });
});

test("every refusal has a message and keeps its code", () => {
  const expected = {
    malformed: "This link is incomplete or damaged. Copy the whole link again.",
    "too-large": "This link is too long to be an AstroChart Bridge chart.",
    "not-astrochart": "This link doesn't hold an AstroChart Bridge chart.",
    "unsupported-version": "This chart was made by a newer version of AstroChart Bridge, which this page can't read.",
    "unknown-field": "This chart was made by a newer version of AstroChart Bridge, which this page can't read.",
    "unsupported-calendar": "This chart was made by a newer version of AstroChart Bridge, which this page can't read.",
    "before-gregorian": "This chart's date is before 15 October 1582, which AstroChart Bridge can't open yet.",
    "invalid-date": "This link's chart isn't valid. Copy the whole link again.",
    "invalid-offset": "This link's chart isn't valid. Copy the whole link again.",
    "invalid-coordinates": "This link's chart isn't valid. Copy the whole link again.",
    "invalid-source": "This link's chart isn't valid. Copy the whole link again.",
  };
  for (const [reason, message] of Object.entries(expected)) {
    assert.deepEqual(viewForImport({ kind: "refused", reason }), { state: "refused", message, code: reason }, reason);
  }
});

test("a refusal the page doesn't know still shows its code", () => {
  assert.deepEqual(viewForImport({ kind: "refused", reason: "something-new" }), {
    state: "refused",
    message: "This link's chart isn't valid. Copy the whole link again.",
    code: "something-new",
  });
});

// --- Copy link ---

test("the copied link is this page's address and the chart's fragment", () => {
  const { chart } = received(NY, NY_SOURCE);
  assert.equal(
    linkFor("http://127.0.0.1:8766/chart.html", chart),
    `http://127.0.0.1:8766/chart.html#${toFragment(chart)}`,
  );
});

test("the copied link drops the address's own query and fragment", () => {
  const { chart } = received(NY, NY_SOURCE);
  assert.equal(
    linkFor("https://example.org/astrochart-bridge/chart.html?utm=x#v1=old", chart),
    `https://example.org/astrochart-bridge/chart.html#${toFragment(chart)}`,
  );
});

test("a received link is copied back exactly", () => {
  const { chart } = received(NY, NY_SOURCE);
  const link = `https://example.org/chart.html#${toFragment(chart)}`;
  const again = readLink(new URL(link).hash);
  assert.equal(linkFor(link, again.chart), link);
});

// --- Where Copy link points ---

test("on the web, a copied link points at the page it was copied from", () => {
  assert.equal(linkBase("https://example.org/chart.html", "https://other.example/chart.html"), "https://example.org/chart.html");
  assert.equal(linkBase("http://127.0.0.1:8766/chart.html", null), "http://127.0.0.1:8766/chart.html");
});

test("in the extension, a copied link points at the receiving page", () => {
  const extensionPage = "chrome-extension://abcdefghijklmnop/chart.html";
  assert.equal(linkBase(extensionPage, "https://example.org/chart.html"), "https://example.org/chart.html");
  assert.equal(linkBase("moz-extension://1234-5678/chart.html", "https://example.org/chart.html"), "https://example.org/chart.html");
  assert.equal(linkBase(extensionPage, null), null);
});

test("with nowhere to point a link, there is no Copy link and no QR code", () => {
  const view = viewForImport(received(NY, NY_SOURCE), { ...LOS_ANGELES, canCopy: false });
  assert.deepEqual(view.buttons, BUTTONS.filter((button) => button.does !== "copy" && button.does !== "qr"));
});

// --- Download file ---

test("the file is named for the local birth date", () => {
  assert.equal(fileFor(received(NY, NY_SOURCE).chart).name, "chart-2024-04-17.astrochart.json");
  const sydney = received({ local: "2024-01-15T08:00:00", utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 });
  assert.equal(fileFor(sydney.chart).name, "chart-2024-01-15.astrochart.json");
});

test("the file is the link's JSON, indented, and reads back as the same chart", () => {
  const { chart } = received(NY, NY_SOURCE);
  const { text } = fileFor(chart);
  assert.equal(
    text,
    `{
  "format": "astrochart",
  "version": 1,
  "chart": {
    "calendar": "gregorian",
    "local": "2024-04-17T08:00:00",
    "utcOffsetSeconds": -14400,
    "latitude": 40.716667,
    "longitude": -74
  },
  "source": {
    "site": "astro-seek",
    "via": "page",
    "zoneLabel": "EDT, DST",
    "utcBasis": "printed"
  }
}
`,
  );
  assert.deepEqual(parse(text), { kind: "portable", chart });
});

// --- QR code ---

test("the QR code is the copied link's, with a note on who can read it", () => {
  const { chart } = received(NY, NY_SOURCE);
  const view = qrViewFor("https://example.org/chart.html", chart);
  assert.equal(view.state, "qr");
  assert.equal(view.link, `https://example.org/chart.html#${toFragment(chart)}`);
  assert.equal(view.label, "QR code for the link to this chart");
  assert.equal(
    view.note,
    "Scan this with a phone or tablet's camera to open the chart there. Anyone who can see the code can read the chart.",
  );
  assert.ok(view.size > 0 && view.path.length > 0);
});

test("a link too long for a QR code points to the other ways to share", () => {
  const { chart } = received(NY, NY_SOURCE);
  assert.deepEqual(qrViewFor(`https://example.org/${"x".repeat(700)}.html`, chart), {
    state: "qr-refused",
    message: "This link is too long for a QR code that scans reliably. Use Copy link or Download file instead.",
  });
});

// --- Opening a chart file ---

const encode = (text) => new TextEncoder().encode(text);

test("a downloaded file opens as the same chart", () => {
  const { chart } = received(NY, NY_SOURCE);
  assert.deepEqual(readChartFile(encode(fileFor(chart).text)), { kind: "portable", chart });
});

test("a byte-order mark before the JSON is allowed", () => {
  const { chart } = received(NY, NY_SOURCE);
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode(fileFor(chart).text)]);
  assert.deepEqual(readChartFile(bytes), { kind: "portable", chart });
});

test("bytes that aren't UTF-8 are refused, not replaced", () => {
  const { chart } = received(NY, { zoneLabel: "été" });
  const bytes = encode(fileFor(chart).text);
  // é is C3 A9 in UTF-8; a lone A9 is invalid.
  const at = bytes.indexOf(0xc3);
  const broken = new Uint8Array([...bytes.slice(0, at), 0xa9, ...bytes.slice(at + 2)]);
  assert.deepEqual(readChartFile(broken), { kind: "refused", reason: "malformed" });
});

test("a file over the limit is refused before it is decoded", () => {
  assert.equal(MAX_FILE_BYTES, 16_384);
  assert.deepEqual(readChartFile(new Uint8Array(MAX_FILE_BYTES + 1)), { kind: "refused", reason: "too-large" });
});

test("a file that isn't a chart is refused with the parser's reason", () => {
  assert.deepEqual(readChartFile(encode("hello")), { kind: "refused", reason: "malformed" });
  assert.deepEqual(readChartFile(encode("{}")), { kind: "refused", reason: "not-astrochart" });
  assert.deepEqual(readChartFile(new Uint8Array(0)), { kind: "refused", reason: "malformed" });
  const newer = fileFor(received(NY).chart).text.replace('"version": 1', '"version": 2');
  assert.deepEqual(readChartFile(encode(newer)), { kind: "refused", reason: "unsupported-version" });
});

test("a file's refusals are worded for a file and keep their code", () => {
  const expected = {
    malformed: "This file isn't an AstroChart Bridge chart, or it is damaged.",
    "too-large": "This file is too large to be an AstroChart Bridge chart.",
    "not-astrochart": "This file isn't an AstroChart Bridge chart.",
    "unsupported-version": "This file was made by a newer version of AstroChart Bridge, which this page can't read.",
    "unknown-field": "This file was made by a newer version of AstroChart Bridge, which this page can't read.",
    "unsupported-calendar": "This file was made by a newer version of AstroChart Bridge, which this page can't read.",
    "before-gregorian": "This chart's date is before 15 October 1582, which AstroChart Bridge can't open yet.",
    "invalid-date": "This file's chart isn't valid.",
    "something-new": "This file's chart isn't valid.",
  };
  for (const [reason, message] of Object.entries(expected)) {
    assert.deepEqual(viewForImport({ kind: "refused", reason }, { from: "file" }), { state: "refused", message, code: reason }, reason);
  }
});

test("a chart from a file shows as it would from a link", () => {
  const result = received(NY, NY_SOURCE);
  assert.deepEqual(viewForImport(result, { ...LOS_ANGELES, from: "file" }), viewForImport(result, LOS_ANGELES));
});

// --- The system share sheet ---

const SHARE_LINK = { label: "Share link…", does: "share-link", secondary: true, shares: true };
const SHARE_FILE = { label: "Share file…", does: "share-file", secondary: true, shares: true };
const SHARE_NOTE = "Share link… and Share file… send the chart to the app you choose.";

test("Share link… comes before Copy link, where the browser can share links", () => {
  const view = viewForImport(received(NY, NY_SOURCE), { ...LOS_ANGELES, canShare: true });
  assert.deepEqual(view.buttons, [...BUTTONS.slice(0, 2), SHARE_LINK, ...BUTTONS.slice(2)]);
  assert.equal(view.notes.at(-1), SHARE_NOTE);
});

test("Share file… comes last, where the browser can share this file", () => {
  const view = viewForImport(received(NY, NY_SOURCE), { ...LOS_ANGELES, canShareFiles: true });
  assert.deepEqual(view.buttons, [...BUTTONS, SHARE_FILE]);
  assert.equal(view.notes.at(-1), SHARE_NOTE);
});

test("neither share button, and no note, where the browser can't share", () => {
  const view = viewForImport(received(NY, NY_SOURCE), LOS_ANGELES);
  assert.deepEqual(view.buttons, BUTTONS);
  assert.ok(!view.notes.includes(SHARE_NOTE));
});

test("with nowhere to point a link, Share link… goes too, but Share file… stays", () => {
  const view = viewForImport(received(NY, NY_SOURCE), { ...LOS_ANGELES, canCopy: false, canShare: true, canShareFiles: true });
  assert.deepEqual(view.buttons.map((button) => button.label), [
    "Open Stellarium Web", "Open chart in Astro-Seek", "Download file", "Share file…",
  ]);
});

test("the link is shared under a title with no birth data in it", () => {
  const { chart } = received(NY, NY_SOURCE);
  assert.deepEqual(shareDataFor("https://example.org/chart.html", chart), {
    title: "AstroChart Bridge chart",
    url: `https://example.org/chart.html#${toFragment(chart)}`,
  });
});

// --- Files for the import page ---

const morinus = () => new Uint8Array(readFileSync(new URL("../fixtures/morinus/ny-est-plus-dst.p2.hor", import.meta.url)));
const aafText = readFileSync(new URL("../fixtures/aaf/astrolog-8.00-new-york.aaf", import.meta.url));

test("a Morinus or AAF file is told apart from a chart file, by its name or its start", () => {
  assert.deepEqual(readChartFile(morinus(), "Test.hor"), { kind: "refused", reason: "morinus-file" });
  // Protocol 2 and later start with PROTO, which no JSON does.
  assert.deepEqual(readChartFile(morinus(), "download"), { kind: "refused", reason: "morinus-file" });
  assert.deepEqual(readChartFile(new Uint8Array(aafText), "chart.AAF"), { kind: "refused", reason: "aaf-file" });
  assert.deepEqual(readChartFile(new Uint8Array(aafText), "chart.txt"), { kind: "refused", reason: "aaf-file" });
  // Even past the chart file limit, since a Morinus file's notes can be long.
  assert.deepEqual(readChartFile(new Uint8Array(MAX_FILE_BYTES + 1), "long.hor"), { kind: "refused", reason: "morinus-file" });
  const { chart } = received(NY, NY_SOURCE);
  assert.deepEqual(readChartFile(encode(fileFor(chart).text), "chart-2024-04-17.astrochart.json"), { kind: "portable", chart });
});

test("in the extension, a Morinus or AAF file is offered to the import page", () => {
  assert.deepEqual(viewForImport({ kind: "refused", reason: "morinus-file" }, { from: "file", canImport: true }), {
    state: "refused",
    message: "This is a Morinus chart file (.hor), not an AstroChart Bridge chart. It opens on the page for AAF and Morinus files.",
    code: "morinus-file",
    importButton: "Open it there",
  });
  assert.deepEqual(viewForImport({ kind: "refused", reason: "aaf-file" }, { from: "file", canImport: true }), {
    state: "refused",
    message: "This is an AAF file, not an AstroChart Bridge chart. It opens on the page for AAF and Morinus files.",
    code: "aaf-file",
    importButton: "Open it there",
  });
});

test("on the web, a Morinus or AAF file is sent to the extension, which has the import page", () => {
  assert.deepEqual(viewForImport({ kind: "refused", reason: "morinus-file" }, { from: "file" }), {
    state: "refused",
    message:
      "This is a Morinus chart file (.hor), not an AstroChart Bridge chart. The AstroChart Bridge extension opens it: click Open an AAF or Morinus file in its popup.",
    code: "morinus-file",
  });
});

// A stand-in for sessionStorage.
function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    get size() {
      return items.size;
    },
  };
}

test("a file kept for the import page is taken back once, as it was", () => {
  const storage = memoryStorage();
  const bytes = morinus();
  assert.equal(keepFileForImport(storage, "Test.hor", bytes), true);
  assert.deepEqual(takeFileForImport(storage), { name: "Test.hor", bytes });
  assert.equal(takeFileForImport(storage), null);
  assert.equal(storage.size, 0);
});

test("nothing kept, or something else under the key, gives nothing", () => {
  const storage = memoryStorage();
  assert.equal(takeFileForImport(storage), null);
  storage.setItem("astrochart-bridge:file-for-import", "not json");
  assert.equal(takeFileForImport(storage), null);
  assert.equal(storage.size, 0);
  storage.setItem("astrochart-bridge:file-for-import", JSON.stringify({ name: 3, base64: "%%" }));
  assert.equal(takeFileForImport(storage), null);
});

test("a file too big to keep, or storage that refuses, is reported, not thrown", () => {
  assert.equal(keepFileForImport(memoryStorage(), "big.hor", new Uint8Array(300_000)), false);
  const refusing = { setItem() { throw new Error("QuotaExceededError"); }, getItem() { throw new Error("SecurityError"); }, removeItem() {} };
  assert.equal(keepFileForImport(refusing, "Test.hor", morinus()), false);
  assert.equal(takeFileForImport(refusing), null);
});


// --- A chart's name and town ---

const NY_LABELS = { name: "Jane Doe", town: "New York, NY, USA" };
const INCLUDES_NOTE = "The name and town go in the link, QR code and file only when ticked, and anyone with them can read them.";
const REMEMBERS_NOTE = "AstroChart Bridge remembers what you tick, on this computer.";

test("a chart with no name or town has no boxes, rows or notes for them", () => {
  const view = viewForImport(received(NY, NY_SOURCE), LOS_ANGELES);
  assert.equal(view.includes, undefined);
  assert.ok(!view.rows.some(([label]) => label === "Name" || label === "Town"));
  assert.ok(!view.notes.includes(INCLUDES_NOTE));
});

test("a chart's name comes first and its town after Place, as on the screenshot page", () => {
  const view = viewForImport(received(NY, NY_SOURCE, NY_LABELS), LOS_ANGELES);
  assert.deepEqual(view.rows, [
    ["Name", "Jane Doe"],
    ["Local time", "17 Apr 2024, 08:00 (EDT, DST)"],
    ["Offset", "UTC-04:00"],
    ["UTC", "2024-04-17 12:00"],
    ["Place", "40°43'N, 74°0'W"],
    ["Town", "New York, NY, USA"],
    ["From", "Astro-Seek page"],
  ]);
});

test("each of the chart's labels has a box, unticked until the user ticks it", () => {
  const view = viewForImport(received(NY, NY_SOURCE, NY_LABELS), LOS_ANGELES);
  assert.deepEqual(view.includes, {
    legend: "Include in the link, QR code and file",
    boxes: [
      { field: "name", label: "Name: Jane Doe", checked: false },
      { field: "town", label: "Town: New York, NY, USA", checked: false },
    ],
  });
  assert.equal(view.notes.at(-1), INCLUDES_NOTE);
});

test("the boxes are ticked as the remembered choice says, and say it is remembered where it is", () => {
  const view = viewForImport(received(NY, NY_SOURCE, NY_LABELS), { ...LOS_ANGELES, include: { name: true }, remembers: true });
  assert.deepEqual(view.includes.boxes.map(({ field, checked }) => [field, checked]), [["name", true], ["town", false]]);
  assert.deepEqual(view.notes.slice(-2), [INCLUDES_NOTE, REMEMBERS_NOTE]);
});

test("a chart with a town alone has only the town's box", () => {
  const view = viewForImport(received(NY, NY_SOURCE, { town: "New York, NY, USA" }), { ...LOS_ANGELES, include: { name: true } });
  assert.deepEqual(view.includes.boxes, [{ field: "town", label: "Town: New York, NY, USA", checked: false }]);
  assert.equal(view.rows[0][0], "Local time");
});

test("a name is only ever text on the page: markup isn't parsed", () => {
  const name = `<img src=x onerror="alert(1)">`;
  const view = viewForImport(received(NY, NY_SOURCE, { name }), LOS_ANGELES);
  assert.deepEqual(view.rows[0], ["Name", name]);
  assert.equal(view.includes.boxes[0].label, `Name: ${name}`);
});

test("the link, file and QR code carry only the labels ticked", () => {
  const { chart } = received(NY, NY_SOURCE, NY_LABELS);
  const plain = received(NY, NY_SOURCE).chart;
  const base = "https://example.invalid/chart.html";
  assert.equal(linkFor(base, chartToPassOn(chart, {})), linkFor(base, plain));
  assert.equal(fileFor(chartToPassOn(chart, { name: false, town: false })).text, fileFor(plain).text);
  const townOnly = fromFragment(new URL(linkFor(base, chartToPassOn(chart, { town: true }))).hash);
  assert.deepEqual(townOnly.chart.labels, { town: "New York, NY, USA" });
  const both = JSON.parse(fileFor(chartToPassOn(chart, { name: true, town: true })).text);
  assert.deepEqual(both.labels, NY_LABELS);
  assert.equal(qrViewFor(base, chartToPassOn(chart, {})).link, linkFor(base, plain));
});

test("the file's name and the share sheet's title never carry the chart's name", () => {
  const passed = chartToPassOn(received(NY, NY_SOURCE, NY_LABELS).chart, { name: true, town: true });
  assert.equal(fileFor(passed).name, "chart-2024-04-17.astrochart.json");
  assert.equal(shareDataFor("https://example.invalid/chart.html", passed).title, "AstroChart Bridge chart");
});

test("a link with labels opens on this page, and one a reader before labels made still does", () => {
  const view = viewForImport(received(NY, NY_SOURCE, NY_LABELS), LOS_ANGELES);
  assert.equal(view.state, "ready");
  assert.deepEqual(view.sky, viewForImport(received(NY, NY_SOURCE), LOS_ANGELES).sky);
});

test("labels that aren't valid are refused as a damaged link or file", () => {
  const text = JSON.stringify({ ...JSON.parse(fileFor(received(NY, NY_SOURCE).chart).text), labels: { name: "" } });
  const result = readChartFile(new TextEncoder().encode(text), "chart.astrochart.json");
  assert.deepEqual(result, { kind: "refused", reason: "invalid-labels" });
  assert.deepEqual(viewForImport(result, { from: "file" }), { state: "refused", message: "This file's chart isn't valid.", code: "invalid-labels" });
});

test("Enter in astro.com… gets the chart's name and town, ticked or not, the name as a first name", () => {
  const result = received(NY, NY_SOURCE, NY_LABELS);
  const name = { first: "Jane Doe", last: "" };
  const extension = viewForImport(result, { ...LOS_ANGELES, canFill: true });
  assert.deepEqual(extension.next.view, viewForAstroCom(NY_SKY, { local: NY.local, town: "New York, NY, USA", name }));
  assert.deepEqual(extension.next.view.buttons[0].holds.town, "New York, NY, USA");
  assert.deepEqual(extension.next.view.buttons[0].holds.name, name);
  const ticked = viewForImport(result, { ...LOS_ANGELES, canFill: true, include: { name: true, town: true } });
  assert.deepEqual(ticked.next, extension.next);
});

test("on the web, the name and town are among the values to type in", () => {
  const view = viewForImport(received(NY, NY_SOURCE, NY_LABELS), LOS_ANGELES).next.view;
  assert.equal(view.state, "astro-com-by-hand");
  assert.deepEqual(view.rows.slice(-2), [["Town", "New York, NY, USA"], ["First name", "Jane Doe"]]);
  assert.match(view.notes.at(-1), /^astro\.com asks for a country and town, not coordinates\. Type the town New York, choose the match nearest this place/);
  // No buttons keep anything: the web's copy fills nothing in.
  assert.deepEqual(view.buttons, [{ label: "Open astro.com's form", url: "https://www.astro.com/cgi/ade.cgi" }]);
});

test("a link a long name and town make too long for a QR code says unticking them shortens it", () => {
  const { chart } = received(NY, { ...NY_SOURCE, via: "screenshot" }, { name: "x".repeat(100), town: "y".repeat(100) });
  const base = "https://kevinblakelopez.github.io/astrochart-bridge/chart.html";
  assert.deepEqual(qrViewFor(base, chartToPassOn(chart, { name: true, town: true })), {
    state: "qr-refused",
    message: "This link is too long for a QR code that scans reliably. Untick the name or town to shorten it, or use Copy link or Download file instead.",
  });
  assert.equal(qrViewFor(base, chartToPassOn(chart, {})).state, "qr");
});
