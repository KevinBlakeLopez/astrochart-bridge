import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartFromRecord, parseAaf } from "../extension/core/aaf.js";

const fixture = (name) => readFileSync(new URL(`../fixtures/aaf/${name}`, import.meta.url), "utf8");

const NY_A93 = "#A93:Test,New York,*,17.4.2024,8:00,New York,NY (US)";
const NY_B93 = "#B93:*,40n43,74w00,5hw00,1";

// The chart for the first record of an AAF text, with an #A93 or #B93 field
// replaced by its position from 0, and any further chunks.
function chart({ a = {}, b = {}, more = "" } = {}) {
  const a93 = NY_A93.slice(5).split(",");
  const b93 = NY_B93.slice(5).split(",");
  for (const [position, value] of Object.entries(a)) a93[position] = value;
  for (const [position, value] of Object.entries(b)) b93[position] = value;
  return chartFromRecord(parseAaf(`#A93:${a93.join(",")}\n#B93:${b93.join(",")}\n${more}`)[0]);
}

const NY_CHART = {
  kind: "natal",
  site: "aaf",
  local: "2024-04-17T08:00:00",
  zoneLabel: null,
  lat: 40.716667,
  lng: -74,
  utc: "2024-04-17T12:00:00Z",
  utcSource: "declared",
  offsetMinutes: -240,
  name: "New York Test",
  place: "New York, NY (US)",
  aaf: { lastName: "Test", firstName: "New York", sex: null, place: "New York", country: "NY (US)", standardOffsetMinutes: -300, timeType: "1" },
};

test("a record's UTC is its local time less the offset and daylight saving", () => {
  assert.deepEqual(chart(), NY_CHART);
});

test("#ZNAM becomes the zone label, which nothing checks", () => {
  assert.deepEqual(chart({ more: "#ZNAM:EDT\n" }), { ...NY_CHART, zoneLabel: "EDT" });
});

test("each time type adds its daylight saving", () => {
  const offset = (type) => chart({ b: { 4: type } }).offsetMinutes;
  assert.equal(offset("0"), -300);
  assert.equal(offset("1"), -240);
  assert.equal(offset("w"), -240);
  assert.equal(offset("2"), -180);
  assert.equal(offset("h"), -270);
});

test("east of Greenwich and south of the equator, as in Sydney", () => {
  const sydney = chartFromRecord(
    parseAaf("#A93:Test,Sydney,*,15.1.2024,8:00,Sydney,NSW (AU)\n#B93:*,33s52,151e12,10he00,1\n")[0],
  );
  assert.equal(sydney.utc, "2024-01-14T21:00:00Z");
  assert.equal(sydney.offsetMinutes, 660);
  assert.equal(sydney.lat, -33.866667);
  assert.equal(sydney.lng, 151.2);
});

test("a half-hour offset, as in India", () => {
  const result = chart({ b: { 1: "28n36", 2: "77e12", 3: "5he30", 4: "0" } });
  assert.equal(result.utc, "2024-04-17T02:30:00Z");
  assert.equal(result.offsetMinutes, 330);
});

test("a time with seconds keeps them", () => {
  assert.equal(chart({ a: { 4: "8:00:30" } }).utc, "2024-04-17T12:00:30Z");
});

test("a time given only to the hour is opened at the hour, with a warning", () => {
  const result = chart({ a: { 4: "8h" } });
  assert.equal(result.utc, "2024-04-17T12:00:00Z");
  assert.deepEqual(result.warnings, ["time-hour-only"]);
});

test("the UTC date can differ from the local date", () => {
  assert.equal(chart({ a: { 4: "23:30" }, b: { 4: "0" } }).utc, "2024-04-18T04:30:00Z");
});

test("a leap day and a date from the 1940s", () => {
  assert.equal(chart({ a: { 3: "29.2.2024" }, b: { 4: "0" } }).utc, "2024-02-29T13:00:00Z");
  assert.equal(chart({ a: { 3: "10.1.1944", 4: "12:00" }, b: { 4: "w" } }).utc, "1944-01-10T16:00:00Z");
});

test("the name and place leave out unknown or empty parts", () => {
  const result = chart({ a: { 0: "*", 1: "Event", 5: "*", 6: "" } });
  assert.equal(result.name, "Event");
  assert.equal(result.place, null);
  assert.equal(chart({ a: { 0: "*", 1: "" } }).name, null);
});

test("a Julian Day that agrees with the date, time and offset is accepted", () => {
  assert.deepEqual(chart({ b: { 0: "2460418.000000" } }), NY_CHART);
  // Within a minute is agreement: Astrolog writes six decimals, about 0.1 s.
  assert.equal(chart({ b: { 0: "2460418.0006" } }).kind, "natal");
});

// The specification gives the Julian Day precedence. A record whose fields
// disagree with it is refused rather than opened at either time.
test("a Julian Day that disagrees by more than a minute is refused", () => {
  assert.deepEqual(chart({ b: { 0: "2460418.041667" } }), { kind: "refused", reason: "julian-day-mismatch", line: 1 });
});

test("refuses what can't be opened without inventing it", () => {
  const cases = [
    [{ a: { 4: "*" } }, "no-birth-time"],
    [{ a: { 4: "*" }, b: { 0: "2460418.0" } }, "no-birth-time"],
    [{ a: { 3: "*" } }, "no-birth-date"],
    [{ b: { 1: "*" } }, "no-coordinates"],
    [{ b: { 2: "*" } }, "no-coordinates"],
    [{ b: { 3: "*" } }, "no-offset"],
    [{ b: { 4: "*" } }, "unknown-daylight-saving"],
    [{ b: { 3: "*", 4: "L" } }, "local-mean-time"],
    [{ b: { 3: "0he21:48", 4: "m" } }, "meridian-time"],
    [{ b: { 3: "0he21:48", 4: "0" } }, "offset-seconds"],
    [{ b: { 3: "14he", 4: "1" } }, "offset-out-of-range"],
    [{ b: { 3: "12hw", 4: "0" } }, "offset-out-of-range", true],
    [{ a: { 3: "17.4.2024j" } }, "julian-calendar"],
    [{ a: { 3: "4.10.1582" } }, "julian-calendar"],
    [{ a: { 3: "4.10.1582g" } }, "pre-gregorian-date"],
  ];
  for (const [change, reason, accepted] of cases) {
    const result = chart(change);
    if (accepted) assert.equal(result.kind, "natal", JSON.stringify(change));
    else assert.deepEqual(result, { kind: "refused", reason, line: 1 }, JSON.stringify(change));
  }
});

test("a record with no #B93 has no coordinates", () => {
  assert.deepEqual(chartFromRecord(parseAaf(`${NY_A93}\n`)[0]), { kind: "refused", reason: "no-coordinates", line: 1 });
});

test("a refused record comes back unchanged", () => {
  const record = parseAaf(`${NY_A93}\n#B93:*,40n43\n`)[0];
  assert.equal(chartFromRecord(record), record);
});

// The AAF'97 documentation's sample record: 19.1.1839, 1:00 at a meridian
// 0he21:48, Julian Day 2392758.526528, which is 00:38:12 UT.
test("the documentation's sample is refused for its meridian time", () => {
  const record = parseAaf("#A93:Cezanne,Paul,m,19.1.1839,1:00,Aix-En-Provence,F\n#B93:2392758.526528,43n31,5e27,0he21:48,m\n#ZNAM:LMT\n")[0];
  assert.equal(record.kind, "record");
  assert.deepEqual(chartFromRecord(record), { kind: "refused", reason: "meridian-time", line: 1 });
});

test("opens the files written by Astrolog 8.00, and their Julian Days agree", () => {
  assert.deepEqual(chartFromRecord(parseAaf(fixture("astrolog-8.00-new-york.aaf"))[0]), {
    ...NY_CHART,
    name: "New York Test",
    aaf: { ...NY_CHART.aaf, lastName: null, firstName: "New York Test" },
  });
  const delhi = chartFromRecord(parseAaf(fixture("astrolog-8.00-delhi-seconds.aaf"))[0]);
  assert.equal(delhi.local, "1990-03-01T06:15:30");
  assert.equal(delhi.utc, "1990-03-01T00:45:30Z");
  assert.equal(delhi.offsetMinutes, 330);
});
