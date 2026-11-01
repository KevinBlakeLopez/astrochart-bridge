import { test } from "node:test";
import assert from "node:assert/strict";
import { fromFragment, parse, toFragment, toPortable } from "../extension/core/portable.js";
import { fileFor, linkBase, linkFor, readLink, viewForImport } from "../extension/import-model.js";
import { ASTRO_SEEK_NOTES } from "../extension/popup-model.js";

const PRIVACY_NOTE =
  "Opening the sky sends this date, time and place to stellarium-web.org, and its page passes the link on to Google's advertising tags.";
const RUNNING = "The clock starts running at once; its pause button stops it.";
const LOS_ANGELES = { timeZone: "America/Los_Angeles" };

const NY = { local: "2024-04-17T08:00:00", utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const NY_SOURCE = { site: "astro-seek", via: "page", zoneLabel: "EDT, DST", utcBasis: "printed" };

// What readLink gives for a chart's link.
function received(sky, source) {
  const built = toPortable(sky, source);
  assert.equal(built.kind, "portable", `refused: ${built.reason}`);
  return fromFragment(`#${toFragment(built.chart)}`);
}

const BUTTONS = [
  { label: "Open sky", opens: "stellarium" },
  { label: "Open chart in Astro-Seek", opens: "astro-seek" },
  { label: "Copy link", does: "copy", secondary: true },
  { label: "Download file", does: "download", secondary: true },
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
  assert.deepEqual(readLink("#v1=e30"), { kind: "refused", reason: "not-chart-bridge" });
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
      ...ASTRO_SEEK_NOTES,
    ],
    sky: { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
    buttons: BUTTONS,
  });
});

test("there is no astro.com step: it needs the extension to keep the values", () => {
  for (const site of ["astro-seek", "astro-com", undefined]) {
    const view = viewForImport(received(NY, { site }), LOS_ANGELES);
    assert.equal(view.next, undefined, String(site));
    assert.deepEqual(view.buttons, BUTTONS, String(site));
  }
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
    "This chart was read from a screenshot by OCR on the device that made this link. Compare these rows with the chart before opening it: nothing checked the latitude.",
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

test("markup in a zone label comes through as the same text", () => {
  const label = `<img src=x onerror="alert(1)">`;
  const view = viewForImport(received(NY, { zoneLabel: label }), LOS_ANGELES);
  assert.deepEqual(view.rows[0], ["Local time", `17 Apr 2024, 08:00 (${label})`]);
});

// --- Other screens ---

test("no link explains what the page is for, with no buttons", () => {
  assert.deepEqual(viewForImport(null), {
    state: "empty",
    message: "Open a Chart Bridge link to see its chart here.",
    notes: [],
    buttons: [],
  });
});

test("every refusal has a message and keeps its code", () => {
  const expected = {
    malformed: "This link is incomplete or damaged. Copy the whole link again.",
    "too-large": "This link is too long to be a Chart Bridge chart.",
    "not-chart-bridge": "This link doesn't hold a Chart Bridge chart.",
    "unsupported-version": "This chart was made by a newer version of Chart Bridge, which this page can't read.",
    "unknown-field": "This chart was made by a newer version of Chart Bridge, which this page can't read.",
    "unsupported-calendar": "This chart was made by a newer version of Chart Bridge, which this page can't read.",
    "before-gregorian": "This chart's date is before 15 October 1582, which Chart Bridge can't open yet.",
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
    linkFor("http://127.0.0.1:8766/import.html", chart),
    `http://127.0.0.1:8766/import.html#${toFragment(chart)}`,
  );
});

test("the copied link drops the address's own query and fragment", () => {
  const { chart } = received(NY, NY_SOURCE);
  assert.equal(
    linkFor("https://example.org/chart-bridge/import.html?utm=x#v1=old", chart),
    `https://example.org/chart-bridge/import.html#${toFragment(chart)}`,
  );
});

test("a received link is copied back exactly", () => {
  const { chart } = received(NY, NY_SOURCE);
  const link = `https://example.org/import.html#${toFragment(chart)}`;
  const again = readLink(new URL(link).hash);
  assert.equal(linkFor(link, again.chart), link);
});

// --- Where Copy link points ---

test("on the web, a copied link points at the page it was copied from", () => {
  assert.equal(linkBase("https://example.org/import.html", "https://other.example/import.html"), "https://example.org/import.html");
  assert.equal(linkBase("http://127.0.0.1:8766/import.html", null), "http://127.0.0.1:8766/import.html");
});

test("in the extension, a copied link points at the receiving page", () => {
  const extensionPage = "chrome-extension://abcdefghijklmnop/import.html";
  assert.equal(linkBase(extensionPage, "https://example.org/import.html"), "https://example.org/import.html");
  assert.equal(linkBase("moz-extension://1234-5678/import.html", "https://example.org/import.html"), "https://example.org/import.html");
  assert.equal(linkBase(extensionPage, null), null);
});

test("with nowhere to point a link, there is no Copy link", () => {
  const view = viewForImport(received(NY, NY_SOURCE), { ...LOS_ANGELES, canCopy: false });
  assert.deepEqual(view.buttons, BUTTONS.filter((button) => button.does !== "copy"));
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
  "format": "chart-bridge",
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
