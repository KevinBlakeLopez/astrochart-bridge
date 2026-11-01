import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import {
  MAX_FRAGMENT_LENGTH,
  MAX_TEXT_LENGTH,
  fromFragment,
  parse,
  serialize,
  skyFor,
  toFragment,
  toPortable,
} from "../extension/core/portable.js";

const NY = { local: "2024-04-17T08:00:00", utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const NY_SOURCE = { site: "astro-seek", via: "page", zoneLabel: "EDT, DST", utcBasis: "printed" };

// toPortable's chart, or a failed assertion naming the refusal.
function portable(sky, source = {}) {
  const result = toPortable(sky, source);
  assert.equal(result.kind, "portable", `refused: ${result.reason}`);
  return result.chart;
}

// chart → serialize → parse → the same chart, and the same sky for the destinations.
function assertRoundTrip(chart) {
  const parsed = parse(serialize(chart));
  assert.deepEqual(parsed, { kind: "portable", chart });
  const decoded = fromFragment(`#${toFragment(chart)}`);
  assert.deepEqual(decoded, { kind: "portable", chart });
}

const refusal = (reason) => ({ kind: "refused", reason });

// A serialized chart with one part replaced, for the parser's refusals.
function edited(change) {
  const document = JSON.parse(serialize(portable(NY, NY_SOURCE)));
  change(document);
  return JSON.stringify(document);
}

// --- Building and serializing ---

test("a chart keeps the local time and the offset, not the UTC", () => {
  assert.deepEqual(portable(NY, NY_SOURCE), {
    format: "astrochart",
    version: 1,
    chart: { calendar: "gregorian", local: "2024-04-17T08:00:00", utcOffsetSeconds: -14400, latitude: 40.716667, longitude: -74 },
    source: { site: "astro-seek", via: "page", zoneLabel: "EDT, DST", utcBasis: "printed" },
  });
});

test("serialize writes the same text whatever order the keys came in", () => {
  const chart = portable(NY, NY_SOURCE);
  const reordered = {
    source: { utcBasis: "printed", zoneLabel: "EDT, DST", via: "page", site: "astro-seek" },
    chart: { longitude: -74, latitude: 40.716667, utcOffsetSeconds: -14400, local: "2024-04-17T08:00:00", calendar: "gregorian" },
    version: 1,
    format: "astrochart",
  };
  assert.equal(serialize(reordered), serialize(chart));
  assert.equal(
    serialize(chart),
    '{"format":"astrochart","version":1,' +
      '"chart":{"calendar":"gregorian","local":"2024-04-17T08:00:00","utcOffsetSeconds":-14400,"latitude":40.716667,"longitude":-74},' +
      '"source":{"site":"astro-seek","via":"page","zoneLabel":"EDT, DST","utcBasis":"printed"}}',
  );
});

test("serialize can indent, for a file, and still writes the keys in one order", () => {
  const chart = portable(NY, NY_SOURCE);
  const indented = serialize(chart, 2);
  assert.equal(indented, JSON.stringify(JSON.parse(serialize(chart)), null, 2));
  assert.deepEqual(parse(indented), { kind: "portable", chart });
});

test("source fields that weren't given are left out, not written as null", () => {
  const chart = portable(NY, { site: "astro-com" });
  assert.deepEqual(chart.source, { site: "astro-com" });
  assert.ok(!serialize(chart).includes("null"));
});

test("a chart needs no source at all", () => {
  const chart = portable(NY);
  assert.deepEqual(chart.source, {});
  assertRoundTrip(chart);
});

test("skyFor gives the destinations the same UTC and place", () => {
  assert.deepEqual(skyFor(portable(NY, NY_SOURCE)), { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 });
});

// Every fixture the pipeline decides on its own must come back with the same
// sky after the trip, so the portable chart opens exactly what the popup opens.
const fixtures = new URL("../fixtures/astroseek/", import.meta.url);
for (const file of readdirSync(fixtures).filter((name) => name.endsWith(".json")).sort()) {
  const { url, input } = JSON.parse(readFileSync(new URL(file, fixtures), "utf8"));
  const result = analyzePage({ url, input });
  if (result.kind !== "natal" || result.utc === null) continue;
  test(`fixture astroseek/${file} survives the round trip with the same sky`, () => {
    const { local, utc, lat, lng, site, zoneLabel, utcSource } = result;
    const chart = portable({ local, utc, lat, lng }, { site, via: "page", zoneLabel: zoneLabel ?? undefined, utcBasis: utcSource });
    assertRoundTrip(chart);
    assert.deepEqual(skyFor(chart), { utc, lat, lng });
  });
}

// --- Round trips ---

test("an ordinary chart survives the round trip", () => {
  assertRoundTrip(portable(NY, NY_SOURCE));
});

test("a historical chart survives the round trip: New York, War Time 1944", () => {
  const chart = portable({ local: "1944-01-10T12:00:00", utc: "1944-01-10T16:00:00Z", lat: 40.716667, lng: -74 }, { zoneLabel: "EWT, DST" });
  assertRoundTrip(chart);
  assert.equal(chart.chart.utcOffsetSeconds, -14400);
});

test("a 17th-century local-mean-time chart keeps its offset to the second", () => {
  // London LMT, 0°10'W: 40 s behind Greenwich.
  const chart = portable({ local: "1645-07-26T07:30:03", utc: "1645-07-26T07:30:43Z", lat: 51.5, lng: -0.166667 });
  assert.equal(chart.chart.utcOffsetSeconds, -40);
  assertRoundTrip(chart);
  assert.equal(skyFor(chart).utc, "1645-07-26T07:30:43Z");
});

test("half-hour and quarter-hour offsets survive: India +05:30, Nepal +05:45", () => {
  const india = portable({ local: "1990-01-01T12:00:00", utc: "1990-01-01T06:30:00Z", lat: 28.6, lng: 77.2 });
  const nepal = portable({ local: "1990-01-01T12:00:00", utc: "1990-01-01T06:15:00Z", lat: 27.7, lng: 85.316667 });
  assert.equal(india.chart.utcOffsetSeconds, 19800);
  assert.equal(nepal.chart.utcOffsetSeconds, 20700);
  assertRoundTrip(india);
  assertRoundTrip(nepal);
});

test("a UTC offset of zero survives", () => {
  const chart = portable({ local: "2000-06-01T00:00:00", utc: "2000-06-01T00:00:00Z", lat: 51.476852, lng: 0 });
  assert.equal(chart.chart.utcOffsetSeconds, 0);
  assertRoundTrip(chart);
});

test("the southern hemisphere: Sydney, negative latitude, the UTC a day earlier", () => {
  const chart = portable({ local: "2024-01-15T08:00:00", utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 }, { zoneLabel: "AEDT, DST" });
  assert.equal(chart.chart.utcOffsetSeconds, 39600);
  assertRoundTrip(chart);
  assert.deepEqual(skyFor(chart), { utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 });
});

test("negative coordinates on both axes: Buenos Aires", () => {
  const chart = portable({ local: "1980-03-01T10:00:00", utc: "1980-03-01T13:00:00Z", lat: -34.6, lng: -58.383333 });
  assertRoundTrip(chart);
});

test("a local New Year's Eve that is New Year's Day in UTC", () => {
  const chart = portable({ local: "2023-12-31T20:00:00", utc: "2024-01-01T01:00:00Z", lat: 40.716667, lng: -74 });
  assertRoundTrip(chart);
  assert.equal(skyFor(chart).utc, "2024-01-01T01:00:00Z");
});

test("29 February survives, and the extreme coordinates are allowed", () => {
  assertRoundTrip(portable({ local: "2000-02-29T23:59:59", utc: "2000-02-29T23:59:59Z", lat: 90, lng: 180 }));
  assertRoundTrip(portable({ local: "2000-02-29T00:00:00", utc: "2000-02-29T00:00:00Z", lat: -90, lng: -180 }));
});

test("a Unicode zone label survives the trip through the link", () => {
  const chart = portable(NY, { zoneLabel: "Heure d'été, ×2 — 東京" });
  assertRoundTrip(chart);
});

test("markup in a zone label stays text: nothing is escaped or stripped", () => {
  const label = `<img src=x onerror="alert(1)">`;
  const chart = portable(NY, { zoneLabel: label });
  assertRoundTrip(chart);
  assert.equal(chart.source.zoneLabel, label);
});

test("-0 coordinates come back as 0", () => {
  const chart = portable({ ...NY, lat: -0, lng: -0 });
  assert.ok(Object.is(parse(serialize(chart)).chart.chart.longitude, 0));
});

// --- What the writer refuses ---

test("a date before the Gregorian calendar began is refused, not labelled Gregorian", () => {
  assert.deepEqual(
    toPortable({ local: "1582-10-14T23:59:59", utc: "1582-10-15T00:00:59Z", lat: 41.9, lng: 12.5 }),
    refusal("before-gregorian"),
  );
  assert.equal(toPortable({ local: "1582-10-15T00:00:00", utc: "1582-10-14T23:00:00Z", lat: 41.9, lng: 12.5 }).kind, "portable");
});

test("no decided UTC is refused: the user decides the offset before sharing", () => {
  assert.deepEqual(toPortable({ ...NY, utc: null }), refusal("invalid-offset"));
});

test("an offset outside -12:00 to +14:00 is refused", () => {
  assert.deepEqual(toPortable({ ...NY, utc: "2024-04-17T22:00:00Z" }), refusal("invalid-offset"));
  assert.deepEqual(toPortable({ ...NY, utc: "2024-04-16T17:00:00Z" }), refusal("invalid-offset"));
});

// --- What the parser refuses ---

test("unknown birth times can't be represented in version 1", () => {
  assert.deepEqual(parse(edited((d) => (d.chart.local = "1985-06-15"))), refusal("invalid-date"));
  assert.deepEqual(parse(edited((d) => (d.chart.local = null))), refusal("invalid-date"));
});

test("a field that would change the chart's meaning is refused, not ignored", () => {
  // An approximate time or an IANA zone from a later version must not be
  // read as an exact time at the stated offset.
  assert.deepEqual(parse(edited((d) => (d.chart.timePrecision = "approximate"))), refusal("unknown-field"));
  assert.deepEqual(parse(edited((d) => (d.chart.timezone = "America/New_York"))), refusal("unknown-field"));
  assert.deepEqual(parse(edited((d) => (d.place = { name: "New York" }))), refusal("unknown-field"));
});

test("an unknown source field is ignored and dropped", () => {
  const parsed = parse(edited((d) => (d.source.confidence = "high")));
  assert.deepEqual(parsed, { kind: "portable", chart: portable(NY, NY_SOURCE) });
});

test("a __proto__ key is an unknown field, and pollutes nothing", () => {
  const text = serialize(portable(NY)).replace('"calendar"', '"__proto__":{"polluted":1},"calendar"');
  assert.deepEqual(parse(text), refusal("unknown-field"));
  assert.equal({}.polluted, undefined);
});

test("another calendar is refused", () => {
  assert.deepEqual(parse(edited((d) => (d.chart.calendar = "julian"))), refusal("unsupported-calendar"));
});

test("another version is refused", () => {
  assert.deepEqual(parse(edited((d) => (d.version = 2))), refusal("unsupported-version"));
  assert.deepEqual(parse(edited((d) => (d.version = 0))), refusal("unsupported-version"));
  assert.deepEqual(parse(edited((d) => (d.version = "1"))), refusal("malformed"));
  assert.deepEqual(parse(edited((d) => (d.version = 1.5))), refusal("malformed"));
});

test("another format is refused", () => {
  assert.deepEqual(parse(edited((d) => (d.format = "chart-bridge"))), refusal("not-astrochart"));
  assert.deepEqual(parse(edited((d) => delete d.format)), refusal("not-astrochart"));
});

test("missing required fields are refused", () => {
  assert.deepEqual(parse(edited((d) => delete d.chart)), refusal("malformed"));
  assert.deepEqual(parse(edited((d) => delete d.chart.latitude)), refusal("invalid-coordinates"));
  assert.deepEqual(parse(edited((d) => delete d.chart.utcOffsetSeconds)), refusal("invalid-offset"));
  assert.deepEqual(parse(edited((d) => delete d.chart.calendar)), refusal("unsupported-calendar"));
});

test("invalid dates and times are refused", () => {
  for (const local of [
    "2023-02-29T12:00:00",
    "2024-13-01T12:00:00",
    "2024-04-31T12:00:00",
    "2024-04-17T24:00:00",
    "2024-04-17T12:60:00",
    "2024-04-17T12:00:60",
    "2024-04-17T12:00:00Z",
    "2024-04-17T12:00:00-04:00",
    "2024-04-17 12:00:00",
    "+002024-04-17T12:00:00",
    "１９８５-06-15T12:00:00",
  ]) {
    assert.deepEqual(parse(edited((d) => (d.chart.local = local))), refusal("invalid-date"), local);
  }
});

test("a date whose UTC would fall past year 9999 is refused", () => {
  const text = edited((d) => {
    d.chart.local = "9999-12-31T23:00:00";
    d.chart.utcOffsetSeconds = -18000;
  });
  assert.deepEqual(parse(text), refusal("invalid-date"));
});

test("invalid offsets are refused", () => {
  for (const offset of [-43201, 50401, 1.5, "-14400", null, Number.MAX_SAFE_INTEGER + 2]) {
    assert.deepEqual(parse(edited((d) => (d.chart.utcOffsetSeconds = offset))), refusal("invalid-offset"), String(offset));
  }
});

test("invalid coordinates are refused", () => {
  for (const [latitude, longitude] of [[90.000001, 0], [-91, 0], [0, 180.5], [0, -181], ["40.7", -74], [null, -74], [40.7, 1e999]]) {
    const text = edited((d) => Object.assign(d.chart, { latitude, longitude }));
    assert.deepEqual(parse(text), refusal("invalid-coordinates"), `${latitude}, ${longitude}`);
  }
  // JSON can't write Infinity, but a hand-written file can try.
  assert.deepEqual(parse(serialize(portable(NY)).replace("40.716667", "1e999")), refusal("invalid-coordinates"));
});

test("invalid source fields are refused", () => {
  for (const change of [
    (d) => (d.source = "astro-seek"),
    (d) => (d.source = null),
    (d) => (d.source = []),
    (d) => (d.source.site = "Astro Seek!"),
    (d) => (d.source.site = 3),
    (d) => (d.source.via = ""),
    (d) => (d.source.utcBasis = null),
    (d) => (d.source.zoneLabel = "x".repeat(65)),
    (d) => (d.source.zoneLabel = "EDT\u0000"),
    (d) => (d.source.zoneLabel = "EDT\n<script>"),
    (d) => (d.source.zoneLabel = "EDT‮"),
    (d) => (d.source.zoneLabel = "\ud800"),
  ]) {
    assert.deepEqual(parse(edited(change)), refusal("invalid-source"), change.toString());
  }
});

test("a missing source is an empty one", () => {
  const parsed = parse(edited((d) => delete d.source));
  assert.deepEqual(parsed, { kind: "portable", chart: portable(NY) });
});

test("text that isn't a JSON object is refused", () => {
  for (const text of ["", "not json", "null", "[]", '"chart"', "1", "{", '{"format":"astrochart"'] ) {
    assert.deepEqual(parse(text), refusal("malformed"), text);
  }
  assert.deepEqual(parse(null), refusal("malformed"));
  assert.deepEqual(parse(undefined), refusal("malformed"));
});

test("text longer than the limit is refused before it is parsed", () => {
  const padded = serialize(portable(NY)).replace("{", `{${" ".repeat(MAX_TEXT_LENGTH)}`);
  assert.deepEqual(parse(padded), refusal("too-large"));
});

test("deeply nested JSON within the limit is refused without a crash", () => {
  const deep = `${"[".repeat(8000)}${"]".repeat(8000)}`;
  assert.ok(deep.length <= MAX_TEXT_LENGTH);
  assert.deepEqual(parse(deep), refusal("malformed"));
});

// --- Fragments ---

test("a fragment is v1= then the serialized chart in base64url", () => {
  const chart = portable(NY, NY_SOURCE);
  const fragment = toFragment(chart);
  assert.match(fragment, /^v1=[A-Za-z0-9_-]+$/);
  const text = new TextDecoder().decode(Uint8Array.from(atob(fragment.slice(3).replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)));
  assert.equal(text, serialize(chart));
});

test("fromFragment takes the hash with or without its #", () => {
  const chart = portable(NY, NY_SOURCE);
  assert.deepEqual(fromFragment(toFragment(chart)), { kind: "portable", chart });
  assert.deepEqual(fromFragment(`#${toFragment(chart)}`), { kind: "portable", chart });
});

test("a fragment for a typical chart fits well inside the limit", () => {
  const fragment = toFragment(portable(NY, NY_SOURCE));
  assert.ok(fragment.length < 400, `${fragment.length} characters`);
  assert.ok(MAX_FRAGMENT_LENGTH >= 4 * fragment.length);
});

test("a truncated fragment is refused", () => {
  const fragment = toFragment(portable(NY, NY_SOURCE));
  for (const length of [3, 10, fragment.length - 1, fragment.length - 2, fragment.length - 3]) {
    const result = fromFragment(fragment.slice(0, length));
    assert.equal(result.kind, "refused", `cut at ${length}`);
  }
});

test("a corrupted fragment is refused", () => {
  const fragment = toFragment(portable(NY, NY_SOURCE));
  assert.deepEqual(fromFragment(fragment.replace(/.$/, "!")), refusal("malformed"));
  assert.deepEqual(fromFragment(`${fragment.slice(0, 20)}%${fragment.slice(21)}`), refusal("malformed"));
  // Valid base64url, "__4", whose bytes FF FE aren't UTF-8.
  assert.deepEqual(fromFragment("v1=__4"), refusal("malformed"));
  assert.deepEqual(fromFragment("v1=e30"), refusal("not-astrochart"));
});

test("a fragment under another key or none is refused", () => {
  const payload = toFragment(portable(NY)).slice(3);
  assert.deepEqual(fromFragment(`v2=${payload}`), refusal("unsupported-version"));
  assert.deepEqual(fromFragment(`v10=${payload}`), refusal("unsupported-version"));
  assert.deepEqual(fromFragment(payload), refusal("malformed"));
  assert.deepEqual(fromFragment(""), refusal("malformed"));
  assert.deepEqual(fromFragment("#"), refusal("malformed"));
  assert.deepEqual(fromFragment(`v1=${payload}&v1=${payload}`), refusal("malformed"));
});

test("a fragment longer than the limit is refused before it is decoded", () => {
  assert.deepEqual(fromFragment(`v1=${"A".repeat(MAX_FRAGMENT_LENGTH)}`), refusal("too-large"));
});
