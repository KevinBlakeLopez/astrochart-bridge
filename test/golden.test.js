import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { chartFromRecord, exportRecord, parseAaf, writeAaf } from "../extension/core/aaf.js";
import { formValues, zoneCheck } from "../extension/core/astrocom.js";
import { astroSeekUrl, onAstroSeekDateLine } from "../extension/core/astroseek.js";
import { analyzeEntry, analyzePage } from "../extension/core/index.js";
import { readText } from "../extension/core/text.js";
import { fromFragment, skyFor, toFragment, toPortable } from "../extension/core/portable.js";
import { checkApplied, transferRequests } from "../extension/core/stellarium-desktop.js";
import { stellariumUrl } from "../extension/core/stellarium.js";

// The golden charts in fixtures/golden/: reference cases whose expected
// values tools/make-golden.py works out from the IANA time zone database and
// Meeus's Julian Day formula, apart from anything in extension/. Every way a
// chart leaves AstroChart Bridge must carry each one's instant and place to
// within what its destination holds:
//
//   Stellarium Web link   the second; the coordinates exactly
//   Astro-Seek link       the second, as UT; the coordinates to the nearest minute of arc
//   astro.com's form      the minute, as UT, or as the local time with its offset to the minute
//   Stellarium Desktop    the Julian Day to 1e-8 of a day, under a millisecond; the coordinates exactly
//   AAF file              the second; the coordinates to the nearest second of arc
//   Shared link           the local time and its offset to the second; the coordinates exactly
//
// Each destination's output is read back here on its own terms, by the
// destination's rules, rather than with the code that wrote it, so a route
// can't pass by sharing that code's mistake.

const root = new URL("../fixtures/golden/", import.meta.url);
const cases = readdirSync(root)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => ({ name, ...JSON.parse(readFileSync(new URL(name, root), "utf8")) }));

const SECOND_MS = 1000;
const ARCMINUTE = 1 / 60;
const ARCSECOND = 1 / 3600;
// Room for floating point when comparing degrees or days.
const EPSILON = 1e-9;
const JULIAN_DAY_TOLERANCE = 1e-8;

// "2024-04-17T12:00:00Z" or "2024-04-17T08:00:00" as numbers.
function parts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z?$/.exec(iso);
  assert.ok(match, `not a date and time: ${iso}`);
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  return { year, month, day, hour, minute, second };
}

const msOf = ({ year, month, day, hour, minute, second = 0 }) => Date.UTC(year, month - 1, day, hour, minute, second);

// astro.com's time zone line: "GMT/UT", "4 h west", "5 h 45 min east".
function minutesFromZoneWords(words) {
  if (words === "GMT/UT") return 0;
  const match = /^(\d+) h(?: (\d+) min)? (east|west)$/.exec(words);
  assert.ok(match, `not a zone line: ${words}`);
  const minutes = Number(match[1]) * 60 + Number(match[2] ?? 0);
  return match[3] === "west" ? -minutes : minutes;
}

// AAF'97's angles: "40n43", "15s53:03", "180w00".
function aafAngle(text, positive, negative) {
  const match = new RegExp(`^(\\d+)([${positive}${negative}])(\\d{2})(?::(\\d{2}))?$`).exec(text);
  assert.ok(match, `not an AAF angle: ${text}`);
  const [, deg, direction, min, sec = "0"] = match;
  assert.ok(Number(min) < 60 && Number(sec) < 60, `minutes or seconds out of range: ${text}`);
  const size = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return direction === negative ? -size : size;
}

// A chart as someone might type it into the paste page: the date written out,
// the time with seconds only when it has them, signed decimal degrees, and the
// offset as UTC±HH:MM, with seconds for a local mean time.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n) => String(n).padStart(2, "0");
function typedNote({ local, lat, lng, offsetSeconds }) {
  const { year, month, day } = parts(local);
  const clock = local.slice(11);
  const size = Math.abs(offsetSeconds);
  const offset = `UTC${offsetSeconds < 0 ? "-" : "+"}${pad(Math.floor(size / 3600))}:${pad(Math.floor((size % 3600) / 60))}${size % 60 ? `:${pad(size % 60)}` : ""}`;
  return [
    `Born: ${day} ${MONTHS[month - 1]} ${year} at ${clock.endsWith(":00") ? clock.slice(0, 5) : clock}`,
    `Latitude: ${lat}`,
    `Longitude: ${lng}`,
    `Time Zone: ${offset}`,
  ].join("\n");
}

const near = (actual, expected, tolerance, what) =>
  assert.ok(Math.abs(actual - expected) <= tolerance + EPSILON, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

// A well-known person's case whose Astro-Databank record hasn't been copied in
// yet: see docs/golden-charts.md.
const waiting = ({ kind, astroDatabank }) => kind === "public-record" && astroDatabank === null;

test("the golden charts are there, each with its expected values worked out", () => {
  assert.ok(cases.filter((c) => !waiting(c)).length >= 20, "fewer than 20 golden charts ready");
  for (const { name, id, record, expected, ...rest } of cases) {
    assert.equal(`${id}.json`, name, "id must match the file name");
    assert.ok(record, `${name} has no record`);
    if (waiting(rest)) continue;
    assert.ok(expected, `${name} has no expected block: run python3 -I tools/make-golden.py --write`);
  }
});

for (const { id, person, expected, ...rest } of cases) {
  if (waiting(rest)) {
    test(`golden ${id}: ${person}`, { todo: "waiting for the Astro-Databank record" }, () => {});
    continue;
  }
  // The record as every route must carry it: for a public record, as the
  // script read it from the copied Astro-Databank rows.
  const record = { local: expected.local, lat: expected.lat, lng: expected.lng };
  const sky = { utc: expected.utc, lat: record.lat, lng: record.lng };

  // The oracle's arithmetic, done again with JavaScript's clock: a check on
  // the case file, not on AstroChart Bridge.
  test(`golden ${id}: the case's offset, UTC and Julian Day agree`, () => {
    assert.equal(msOf(parts(record.local)) - expected.offsetSeconds * SECOND_MS, msOf(parts(expected.utc)));
    near((msOf(parts(expected.utc)) - Date.UTC(2000, 0, 1, 12)) / 86_400_000 + 2451545, expected.julianDay, JULIAN_DAY_TOLERANCE, "Julian Day");
  });

  // The one way in that needs no site's page: whatever a person types is real
  // input, so the note can be written here.
  test(`golden ${id}: typed into the paste page, it reads as the same chart`, () => {
    const read = readText(typedNote(expected));
    assert.equal(read.kind, "fields", read.reason);
    const value = (field) => read.fields[field]?.value;
    const chart = analyzeEntry({ date: value("date"), time: value("time"), lat: value("lat"), lng: value("lng"), offsetMinutes: value("offset") });
    assert.deepEqual(
      { local: chart.local, utc: chart.utc, lat: chart.lat, lng: chart.lng },
      { local: expected.local, utc: expected.utc, lat: expected.lat, lng: expected.lng },
    );
  });

  if (rest.kind === "public-record") {
    // Astro-Databank's rows pasted as they are, or tidied with a colon after
    // each label: the paste page needn't read their forms ("51n29", "h0e"),
    // but anything it does read must be right.
    test(`golden ${id}: Astro-Databank's rows pasted in are never misread`, () => {
      const { born, place, timezone } = rest.astroDatabank;
      const want = { date: expected.local.slice(0, 10), time: expected.local.slice(11), lat: expected.lat, lng: expected.lng, offset: expected.offsetSeconds / 60 };
      for (const text of [[born, place, timezone].join("\n"), [born, place, timezone].map((row) => row.replace("\t", ": ")).join("\n")]) {
        const read = readText(text);
        if (read.kind !== "fields") continue;
        for (const [field, right] of Object.entries(want)) {
          const got = read.fields[field]?.value;
          if (got !== null && got !== undefined) assert.equal(got, right, `${field} read from ${JSON.stringify(text)}`);
        }
      }
    });
  }

  test(`golden ${id}: Stellarium Web gets the UTC to the second and the coordinates exactly`, () => {
    const url = new URL(stellariumUrl(sky));
    assert.equal(`${url.origin}${url.pathname}`, "https://stellarium-web.org/");
    assert.deepEqual([...url.searchParams.keys()].sort(), ["date", "lat", "lng"]);
    assert.equal(url.searchParams.get("date"), expected.utc);
    assert.equal(Number(url.searchParams.get("lat")), record.lat);
    assert.equal(Number(url.searchParams.get("lng")), record.lng);
  });

  test(`golden ${id}: Astro-Seek gets the UTC to the second as UT, and the coordinates to the minute of arc`, () => {
    const params = new URL(astroSeekUrl(sky)).searchParams;
    const field = (name) => params.get(`narozeni_${name}`);
    // Universal Time with no daylight saving, so the form's date and time are the UTC's.
    assert.equal(field("timezone_form"), "0");
    assert.equal(field("timezone_dst_form"), "0");
    const sent = ["rok", "mesic", "den", "hodina", "minuta", "sekunda"].map((name) => Number(field(name)));
    const { year, month, day, hour, minute, second } = parts(expected.utc);
    assert.deepEqual(sent, [year, month, day, hour, minute, second]);
    // Whole degrees and minutes, with 0 for north or east and 1 for south or west.
    const angle = (axis, limit) => {
      const [deg, min, direction] = ["stupne", "minuty", "smer"].map((part) => field(`${axis}_${part}`));
      assert.ok(Number(min) < 60 && Number(deg) <= limit && ["0", "1"].includes(direction), `${axis}: ${deg}° ${min}' ${direction}`);
      return (Number(deg) + Number(min) / 60) * (direction === "1" ? -1 : 1);
    };
    near(angle("sirka", 90), record.lat, ARCMINUTE / 2, "latitude");
    // Never 180°: Astro-Seek draws 180°0', east or west, at 0°0'
    // (fixtures/astroseek/golden-fiji-180-*.json). A longitude that rounds to
    // it goes in as 179°59' on the same side, at most 1' away, and the screen
    // says so.
    const sentLng = angle("delka", 179);
    if (onAstroSeekDateLine(record.lng)) {
      near(sentLng, Math.sign(record.lng) * (179 + 59 / 60), 1e-9, "longitude on the date line");
      near(sentLng, record.lng, ARCMINUTE, "longitude on the date line");
    } else {
      near(sentLng, record.lng, ARCMINUTE / 2, "longitude");
    }
  });

  test(`golden ${id}: astro.com's form gets the UTC to the minute as GMT/UT`, () => {
    const values = formValues({ utc: expected.utc });
    assert.equal(values.szon, "h0w");
    const sent = msOf({ year: Number(values.syar), month: Number(values.imon), day: Number(values.sday), hour: Number(values.ihou), minute: Number(values.smin) });
    assert.ok(Math.abs(msOf(parts(expected.utc)) - sent) < 60 * SECOND_MS, `sent ${new Date(sent).toISOString()} for ${expected.utc}`);
  });

  test(`golden ${id}: astro.com's form gets the local time to the minute, checked against the offset`, () => {
    const values = formValues({ utc: expected.utc, local: record.local });
    // astro.com's automatic zone, which watchZone checks against the chart's offset.
    assert.equal(values.szon, "au");
    const { year, month, day, hour, minute } = parts(record.local);
    assert.deepEqual([values.syar, values.imon, values.sday, values.ihou, values.smin].map(Number), [year, month, day, hour, minute]);
    const check = zoneCheck({ utc: expected.utc, local: record.local });
    const offsetMinutes = Math.round(expected.offsetSeconds / 60);
    assert.equal(check.offsetMinutes, offsetMinutes);
    assert.equal(minutesFromZoneWords(check.zone), offsetMinutes);
  });

  test(`golden ${id}: Stellarium Desktop gets the Julian Day and the coordinates, and accepts its status showing them`, () => {
    const result = transferRequests(sky);
    assert.equal(result.kind, "requests", result.reason);
    const sent = Object.fromEntries(result.requests.flatMap(({ params }) => [...params]));
    assert.equal(sent.timerate, "0");
    near(Number(sent.time), expected.julianDay, JULIAN_DAY_TOLERANCE, "Julian Day");
    assert.equal(Number(sent.latitude), record.lat);
    assert.equal(Number(sent.longitude), record.lng);
    const shown = { jday: expected.julianDay, timerate: 0, lat: record.lat, lng: record.lng };
    assert.deepEqual(checkApplied(sky, shown), []);
  });

  test(`golden ${id}: an AAF file holds the UTC to the second and the coordinates to the second of arc`, () => {
    const text = writeAaf([exportRecord(sky)]);
    // The record as AAF'97 lays it out: names, date and time, place and country;
    // then Julian Day, latitude, longitude, standard offset and daylight saving.
    const a93 = /^#A93:(.*)$/m.exec(text)[1].split(",");
    const b93 = /^#B93:(.*)$/m.exec(text)[1].split(",");
    const [day, month, year] = a93[3].split(".").map(Number);
    const [hour, minute, second = 0] = a93[4].split(":").map(Number);
    assert.deepEqual({ year, month, day, hour, minute, second }, parts(expected.utc));
    assert.deepEqual(b93.slice(3), ["0h", "0"], "Universal Time, no daylight saving");
    near(aafAngle(b93[1], "n", "s"), record.lat, ARCSECOND / 2, "latitude");
    near(aafAngle(b93[2], "e", "w"), record.lng, ARCSECOND / 2, "longitude");

    // And AstroChart Bridge reads its own file back as the same sky.
    const [read] = parseAaf(text);
    const chart = chartFromRecord(read);
    assert.equal(chart.kind, "natal", chart.reason);
    assert.equal(chart.utc, expected.utc);
    near(chart.lat, record.lat, ARCSECOND / 2, "latitude read back");
    near(chart.lng, record.lng, ARCSECOND / 2, "longitude read back");
  });

  test(`golden ${id}: a shared link holds the local time, the offset to the second and the coordinates`, () => {
    const shared = toPortable({ local: record.local, utc: expected.utc, lat: record.lat, lng: record.lng });
    assert.equal(shared.kind, "portable", shared.reason);
    const fragment = toFragment(shared.chart);
    // The link's payload is base64url JSON, read here without portable.js.
    const { chart } = JSON.parse(Buffer.from(fragment.replace(/^v1=/, ""), "base64url").toString("utf8"));
    assert.deepEqual(chart, {
      calendar: "gregorian",
      local: record.local,
      utcOffsetSeconds: expected.offsetSeconds,
      latitude: record.lat,
      longitude: record.lng,
    });
    // And the receiving page opens the same sky from it.
    const opened = fromFragment(`#${fragment}`);
    assert.equal(opened.kind, "portable", opened.reason);
    assert.deepEqual(skyFor(opened.chart), sky);
  });
}

// Astro-Seek pages of golden charts, captured from the site: the fixtures in
// fixtures/astroseek/ that name the case they show in "golden". Reading the
// page must give the case's instant to the second, and its place to the minute
// of arc that Astro-Seek prints. See docs/golden-charts.md for capturing one.
const seekRoot = new URL("../fixtures/astroseek/", import.meta.url);
const byId = new Map(cases.map((c) => [c.id, c]));
for (const name of readdirSync(seekRoot).filter((file) => file.endsWith(".json")).sort()) {
  const { url, input, golden } = JSON.parse(readFileSync(new URL(name, seekRoot), "utf8"));
  if (golden === undefined) continue;
  test(`golden ${golden}: Astro-Seek's page (fixtures/astroseek/${name}) reads as the same chart`, () => {
    const { expected } = byId.get(golden) ?? assert.fail(`no golden chart ${golden}`);
    const chart = analyzePage({ url, input });
    assert.equal(chart.kind, "natal", chart.reason);
    assert.equal(chart.utc, expected.utc);
    near(chart.lat, expected.lat, ARCMINUTE / 2, "latitude");
    // On the date line Astro-Seek was sent 179°59' on the same side, 1' off
    // (test/date-line.test.js), and its page reads back as that, to the
    // reader's six decimals.
    if (onAstroSeekDateLine(expected.lng)) near(chart.lng, Math.sign(expected.lng) * (179 + 59 / 60), 1e-6, "longitude on the date line");
    else near(chart.lng, expected.lng, ARCMINUTE / 2, "longitude");
  });
}
