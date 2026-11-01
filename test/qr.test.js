import { test } from "node:test";
import assert from "node:assert/strict";
import { correction, generate } from "../extension/vendor/lean-qr/index.mjs";
import { toFragment, toPortable } from "../extension/core/portable.js";
import { linkFor } from "../extension/import-model.js";
import { MAX_QR_VERSION, QR_OPTIONS, QUIET_ZONE, qrFor } from "../extension/qr.js";
import { RECEIVER_URL } from "../extension/share-config.js";

const NY = { local: "2024-04-17T08:00:00", utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const NY_SOURCE = { site: "astro-seek", via: "page", zoneLabel: "EDT, DST", utcBasis: "printed" };

const linkOf = (sky, source) => linkFor(RECEIVER_URL, toPortable(sky, source).chart);
const NY_LINK = linkOf(NY, NY_SOURCE);

// The dark modules a path draws, as "x,y" in the path's own coordinates.
// qrFor writes each run of dark modules in a row as "M x,y h n v1 h-n z".
function darkIn(path) {
  const dark = new Set();
  for (const [, x, y, run] of path.matchAll(/M(\d+),(\d+)h(\d+)v1h-\3z/g)) {
    for (let i = 0; i < Number(run); i++) dark.add(`${Number(x) + i},${y}`);
  }
  return dark;
}

test("a typical link is a version 15 code, 77 modules and the quiet zone", () => {
  assert.ok(NY_LINK.length > 390 && NY_LINK.length < 410, `${NY_LINK.length} characters`);
  const qr = qrFor(NY_LINK);
  assert.equal(qr.kind, "qr");
  assert.equal(qr.version, 15);
  assert.equal(qr.size, 77 + 2 * QUIET_ZONE);
});

test("error correction is at least M: at L the same link would be version 13", () => {
  assert.equal(generate(NY_LINK, { ...QR_OPTIONS, minCorrectionLevel: correction.L, maxCorrectionLevel: correction.L }).size, 13 * 4 + 17);
  assert.equal(QR_OPTIONS.minCorrectionLevel, correction.M);
});

test("the longest link a chart can make today still fits", () => {
  const worst = linkOf(
    { local: "2024-04-17T08:00:00", utc: "2024-04-17T12:00:00Z", lat: -33.866667, lng: -151.216667 },
    { site: "astro-seek", via: "screenshot", zoneLabel: "x".repeat(64), utcBasis: "zone-label" },
  );
  const qr = qrFor(worst);
  assert.equal(qr.kind, "qr");
  assert.ok(qr.version <= 17, `version ${qr.version}`);
});

test("a link too long for a code that scans reliably is refused, not drawn", () => {
  const long = `${RECEIVER_URL}#v1=${"A".repeat(700)}`;
  assert.deepEqual(qrFor(long), { kind: "refused", reason: "too-long" });
  assert.equal(MAX_QR_VERSION, 20);
});

test("the path draws exactly the code's dark modules, inside the quiet zone", () => {
  const qr = qrFor(NY_LINK);
  const code = generate(NY_LINK, QR_OPTIONS);
  const expected = new Set();
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) if (code.get(x, y)) expected.add(`${x + QUIET_ZONE},${y + QUIET_ZONE}`);
  }
  assert.deepEqual(darkIn(qr.path), expected);
  for (const cell of darkIn(qr.path)) {
    const [x, y] = cell.split(",").map(Number);
    assert.ok(x >= QUIET_ZONE && y >= QUIET_ZONE && x < qr.size - QUIET_ZONE && y < qr.size - QUIET_ZONE, cell);
  }
});

test("the path is only moves and runs, nothing else", () => {
  assert.match(qrFor(NY_LINK).path, /^(M\d+,\d+h\d+v1h-\d+z)+$/);
});

test("the top-left finder pattern is where a scanner looks for it", () => {
  const dark = darkIn(qrFor(NY_LINK).path);
  const at = (x, y) => dark.has(`${x + QUIET_ZONE},${y + QUIET_ZONE}`);
  for (let i = 0; i < 7; i++) {
    assert.ok(at(i, 0) && at(i, 6) && at(0, i) && at(6, i), `ring at ${i}`);
  }
  assert.ok(!at(1, 1) && !at(5, 5), "the ring's inside is light");
  assert.ok(at(3, 3), "the centre is dark");
});

test("the same link always gives the same code", () => {
  assert.deepEqual(qrFor(NY_LINK), qrFor(NY_LINK));
});

test("a link from the web page encodes the same way", () => {
  const chart = toPortable(NY, NY_SOURCE).chart;
  const qr = qrFor(`http://127.0.0.1:8766/import.html#${toFragment(chart)}`);
  assert.equal(qr.kind, "qr");
});
