import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartFromHor, HOR_FIELDS, isHorFile, parseHor } from "../extension/core/morinus-hor.js";

// The invented charts tools/make-hor-fixtures.py wrote with CPython's pickle,
// and the UT Morinus's own code gives for each (see the file's "about").
const SPEC = JSON.parse(readFileSync(new URL("../tools/hor-fixtures.json", import.meta.url), "utf8"));
const file = (key, protocol) => new Uint8Array(readFileSync(new URL(`../fixtures/morinus/${key}.p${protocol}.hor`, import.meta.url)));
const chartOf = (key, protocol = 2) => chartFromHor(parseHor(file(key, protocol)));
const bytes = (text) => Uint8Array.from(text, (char) => char.charCodeAt(0));
const concat = (...parts) => Uint8Array.from(parts.flatMap((part) => [...part]));

// Where the nth pickle (from 0) starts in a protocol 0 file: each one ends with
// a "." that starts a line.
function pickleStart(hor, n) {
  let at = 0;
  for (let i = 0; i < n; i += 1) {
    while (!(hor[at] === 0x2e && (at === 0 || hor[at - 1] === 0x0a))) at += 1;
    at += 1;
  }
  return at;
}
// A protocol 0 file with the nth pickle replaced.
const withPickle = (hor, n, text) => concat(hor.slice(0, pickleStart(hor, n)), bytes(text), hor.slice(pickleStart(hor, n + 1)));

test("reads the fields in the order Morinus's save() writes them", () => {
  assert.deepEqual(HOR_FIELDS, SPEC.fields);
});

test("reads every fixture in every protocol it was written with", () => {
  for (const [key, { protocols, values }] of Object.entries(SPEC.charts)) {
    for (const protocol of protocols) {
      assert.deepEqual(parseHor(file(key, protocol)), { kind: "record", values, protocol, warnings: [] }, `${key} p${protocol}`);
    }
  }
});

test("tells a .hor file by its name or its first byte", () => {
  assert.equal(isHorFile("Charles.hor", bytes("V")), true);
  assert.equal(isHorFile("CHARLES.HOR", bytes("V")), true);
  // Protocol 2 and later start with PROTO, which no text file does.
  assert.equal(isHorFile("download", Uint8Array.of(0x80, 0x02)), true);
  assert.equal(isHorFile("chart.aaf", bytes("#A93:")), false);
  assert.equal(isHorFile("chart.txt", new Uint8Array(0)), false);
});

test("refuses a file that would run Python, naming the field and the opcode", () => {
  const hor = file("ny-edt-as-zone-4", 0);
  assert.deepEqual(parseHor(withPickle(hor, 26, "cbuiltins\nprint\n(S'x'\ntR.")), {
    kind: "refused",
    reason: "unsupported-opcode",
    field: "notes",
    opcode: "GLOBAL",
    offset: pickleStart(hor, 26),
  });
});

test("refuses a file that stops early, runs on, or is far too big", () => {
  const hor = file("ny-edt-as-zone-4", 2);
  assert.deepEqual(parseHor(hor.slice(0, -1)), { kind: "refused", reason: "truncated", field: "notes" });
  assert.deepEqual(parseHor(new Uint8Array(0)), { kind: "refused", reason: "truncated", field: "name" });
  assert.deepEqual(parseHor(concat(hor, Uint8Array.of(0x80, 0x02, 0x88, 0x2e))), { kind: "refused", reason: "trailing-data" });
  assert.deepEqual(parseHor(new Uint8Array(300_000)), { kind: "refused", reason: "too-large" });
});

test("refuses a value of the wrong type or out of range, naming the field", () => {
  const hor = file("ny-edt-as-zone-4", 0);
  const read = (n, text) => parseHor(withPickle(hor, n, text));
  assert.deepEqual(read(0, "I7\n."), { kind: "refused", reason: "field-type", field: "name" });
  assert.deepEqual(read(5, "I13\n."), { kind: "refused", reason: "field-range", field: "month" });
  assert.deepEqual(read(11, "I4\n."), { kind: "refused", reason: "field-range", field: "zt" });
  assert.deepEqual(read(25, "F10.5\n."), { kind: "refused", reason: "field-type", field: "altitude" });
  assert.deepEqual(read(16, "N."), { kind: "refused", reason: "field-type", field: "place" });
  // Morinus reads any true value as yes, so 1 and 0 are booleans too.
  assert.equal(read(15, "I1\n.").values.daylightsaving, true);
  assert.deepEqual(read(15, "I2\n."), { kind: "refused", reason: "field-type", field: "daylightsaving" });
});

test("warns when a Python 2 name had to be read in a guessed code page", () => {
  const record = parseHor(withPickle(file("ny-edt-as-zone-4", 0), 0, "S'Nagy \\xf5'\np0\n."));
  assert.equal(record.values.name, "Nagy õ");
  assert.deepEqual(record.warnings, ["text-encoding-guessed"]);
  assert.deepEqual(chartFromHor(record).warnings, ["text-encoding-guessed"]);
});

// ---- chartFromHor ----------------------------------------------------------

test("gives a zone chart in the shape analyzePage returns", () => {
  assert.deepEqual(chartOf("ny-edt-as-zone-4"), {
    kind: "natal",
    site: "morinus",
    local: "2024-04-17T08:00:00",
    zoneLabel: null,
    lat: 40.716667,
    lng: -74,
    utc: "2024-04-17T12:00:00Z",
    utcSource: "declared",
    offsetMinutes: -240,
    name: "Test",
    place: "New York",
    morinus: {
      chartType: "radix",
      male: true,
      timeBasis: "zone",
      zoneOffsetMinutes: -240,
      daylightSaving: false,
      altitudeMeters: 10,
      coordinates: { deglon: 74, minlon: 0, seclon: 0, east: false, deglat: 40, minlat: 43, seclat: 0, north: true },
      hasNotes: false,
      protocol: 2,
    },
  });
});

test("every chart it opens has the UT Morinus itself gives", () => {
  let opened = 0;
  for (const [key, { protocols, morinusUtc }] of Object.entries(SPEC.charts)) {
    for (const protocol of protocols) {
      const chart = chartOf(key, protocol);
      if (chart.kind === "refused") continue;
      opened += 1;
      assert.equal(chart.utc, morinusUtc, `${key} p${protocol}`);
    }
  }
  // 12 of the 17 charts; the other five are refused below.
  assert.equal(opened, 12 * 3 + 2 * 3);
});

test("adds daylight saving to the zone, as Morinus takes an hour off", () => {
  const dst = chartOf("ny-est-plus-dst");
  assert.deepEqual([dst.offsetMinutes, dst.morinus.zoneOffsetMinutes, dst.morinus.daylightSaving], [-240, -300, true]);
  assert.equal(chartOf("kolkata-0530").offsetMinutes, 330);
  assert.equal(chartOf("kathmandu-0545").offsetMinutes, 345);
  const sydney = chartOf("sydney-south");
  assert.deepEqual([sydney.offsetMinutes, sydney.lat, sydney.lng], [660, -33.866667, 151.2]);
});

test("opens a Greenwich chart in UT, keeping the zone it ignores", () => {
  const chart = chartOf("greenwich");
  assert.deepEqual([chart.offsetMinutes, chart.zoneLabel, chart.morinus.timeBasis], [0, "UT", "greenwich"]);
  // Entered as +1:00, which Morinus doesn't use for a Greenwich time.
  assert.equal(chart.morinus.zoneOffsetMinutes, 60);
  assert.equal(chart.warnings, undefined);
});

test("warns when daylight saving is ticked on a Greenwich time", () => {
  const chart = chartOf("greenwich-with-dst");
  assert.deepEqual([chart.offsetMinutes, chart.zoneLabel, chart.utc], [60, null, "2024-04-17T07:00:00Z"]);
  assert.deepEqual(chart.warnings, ["daylight-saving-on-ut"]);
});

test("keeps the longitude seconds Morinus drops when it opens the file, and says so", () => {
  const chart = chartOf("seconds-in-coords");
  assert.deepEqual([chart.lng, chart.lat], [-12.582222, 48.1225]);
  assert.deepEqual(chart.warnings, ["longitude-seconds-ignored-by-morinus"]);
});

test("opens a horary chart and one just after the Gregorian reform", () => {
  assert.equal(chartOf("horary").morinus.chartType, "horary");
  assert.equal(chartOf("gregorian-1583").local, "1583-02-23T08:00:00");
  assert.equal(chartOf("unicode-text").name, "Nagy Róbert 東京 \\ test");
});

test("refuses what AstroChart Bridge can't open yet, without guessing", () => {
  const reason = (key) => chartOf(key).reason;
  assert.equal(reason("local-mean"), "local-mean-time");
  assert.equal(reason("local-apparent"), "local-apparent-time");
  assert.equal(reason("julian-1900"), "julian-calendar");
  assert.equal(reason("bce-julian"), "bce-date");
  assert.equal(reason("solar-return"), "chart-type-unsupported");

  const record = parseHor(file("ny-edt-as-zone-4", 2));
  const withValues = (changes) => chartFromHor({ ...record, values: { ...record.values, ...changes } });
  assert.equal(withValues({ year: 1500 }).reason, "pre-gregorian-date");
  assert.equal(withValues({ month: 2, day: 30 }).reason, "bad-date");
  assert.equal(withValues({ plus: true, zh: 15 }).reason, "offset-out-of-range");
  assert.equal(withValues({ deglat: 90, minlat: 30 }).reason, "bad-coordinates");
});

test("leaves an empty name or place out, and the notes always", () => {
  const record = parseHor(file("ny-edt-as-zone-4", 2));
  const chart = chartFromHor({ ...record, values: { ...record.values, name: "", place: "", notes: "private" } });
  assert.deepEqual([chart.name, chart.place, chart.morinus.hasNotes], [null, null, true]);
  assert.equal(JSON.stringify(chart).includes("private"), false);
});

test("passes a refusal through unchanged", () => {
  const refusal = parseHor(new Uint8Array(0));
  assert.equal(chartFromHor(refusal), refusal);
});
