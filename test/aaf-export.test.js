import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { chartFromRecord, exportRecord, parseAaf, writeAaf } from "../extension/core/aaf.js";
import { ZONE_OFFSETS } from "../extension/core/civiltime.js";
import { analyzePage } from "../extension/core/index.js";

const root = new URL("../fixtures/", import.meta.url);
const astroSeek = (name) => analyzePage(JSON.parse(readFileSync(new URL(`astroseek/${name}`, root), "utf8")));
const aaf = (name) => readFileSync(new URL(`aaf/${name}`, root), "utf8");
const charts = (text) => parseAaf(text).map(chartFromRecord);

const HEADER = "#: AstroChart Bridge";
const UT_NOTE =
  "#: Universal Time: the source doesn't say how its offset splits into standard time and daylight saving.";

// What any chart must keep through AAF and back: the instant and the place.
const sky = ({ utc, lat, lng }) => ({ utc, lat, lng });

const NY_TEXT = "#A93:Test,New York,*,17.4.2024,8:00,New York,NY (US)\n#B93:*,40n43,74w00,5hw00,1\n";

test("an AAF chart is written back with its names, local time, offset and time type", () => {
  const [chart] = charts(NY_TEXT);
  assert.equal(writeAaf([exportRecord(chart)]), `${HEADER}\n${NY_TEXT}`);
});

test("a #ZNAM zone name is kept as a comment, since Astrolog 8.00 refuses files with #ZNAM", () => {
  const [chart] = charts(`${NY_TEXT}#ZNAM:EDT\n`);
  assert.equal(writeAaf([exportRecord(chart)]), `${HEADER}\n${NY_TEXT}#: Zone name: EDT\n`);
});

test("war time is written as 1, which AAF'97 says is the same and Astrolog 8.00 reads", () => {
  const [chart] = charts(NY_TEXT.replace("5hw00,1", "5hw00,w"));
  assert.equal(exportRecord(chart).timeType, "1");
});

test("an Astrolog 8.00 file comes back in the AAF'97 forms with the same chart", () => {
  for (const name of ["astrolog-8.00-new-york.aaf", "astrolog-8.00-delhi-seconds.aaf"]) {
    const [before] = charts(aaf(name));
    const [after] = charts(writeAaf([exportRecord(before)]));
    assert.deepEqual(after, before, name);
  }
  const [delhi] = charts(aaf("astrolog-8.00-delhi-seconds.aaf"));
  assert.equal(
    writeAaf([exportRecord(delhi)]),
    `${HEADER}\n#A93:*,Delhi Test,*,1.3.1990,6:15:30,New Delhi,IN\n#B93:*,28n36:50,77e12:30,5he30,0\n`,
  );
});

// An Astro-Seek label whose split is known: EDT is EST, -05:00, plus an hour.
test("an Astro-Seek chart with a known zone label keeps its local time", () => {
  const record = exportRecord(astroSeek("ny-2024-04-17.json"));
  assert.equal(writeAaf([record]), `${HEADER}\n#A93:*,*,*,17.4.2024,8:00,*,*\n#B93:*,40n43,74w00,5hw00,1\n`);
});

test("an Astro-Seek chart in standard time, south of the equator and in war time", () => {
  assert.match(writeAaf([exportRecord(astroSeek("sydney-2024-01-15.json"))]), /#B93:\*,33s52,151e12,10he00,1\n/);
  assert.match(writeAaf([exportRecord(astroSeek("ny-1944-01-10.json"))]), /#A93:\*,\*,\*,10\.1\.1944,12:00,\*,\*\n#B93:\*,40n43,74w00,5hw00,1\n/);
});

test("each zone label's standard offset and daylight saving add up to its offset", () => {
  for (const [label, offset] of Object.entries(ZONE_OFFSETS)) {
    const chart = { kind: "natal", site: "astro-seek", local: "2024-04-17T08:00:00", zoneLabel: label, lat: 0, lng: 0, utc: "2024-04-17T12:00:00Z", utcSource: "printed", offsetMinutes: offset };
    const record = exportRecord(chart);
    assert.equal(record.basis, "local", label);
    assert.equal(record.standardOffsetMinutes + (record.timeType === "1" ? 60 : 0), offset, label);
  }
});

// Astro-Seek's printed UT is used, with a warning, when its label isn't one
// AstroChart Bridge can check; the split is unknown, so the file is in UT.
test("an Astro-Seek chart whose zone label can't be checked is written in Universal Time", () => {
  const chart = astroSeek("manual-ut-2024-04-17-0000.json");
  assert.deepEqual(chart.warnings, ["zone-label-unknown"]);
  const date = chart.utc.slice(0, 10).split("-").map(Number);
  assert.equal(
    writeAaf([exportRecord(chart)]),
    `${HEADER}\n${UT_NOTE}\n#A93:*,*,*,${date[2]}.${date[1]}.${date[0]},${Number(chart.utc.slice(11, 13))}:${chart.utc.slice(14, 16)},*,*\n#B93:*,40n43,74w00,0h,0\n`,
  );
});

// astro.com states only the total offset, daylight saving included.
test("an astro.com chart is written in Universal Time", () => {
  const chart = {
    kind: "natal",
    site: "astro-com",
    local: "2024-04-17T08:00:00",
    zoneLabel: null,
    lat: 40.716667,
    lng: -74,
    utc: "2024-04-17T12:00:00Z",
    utcSource: "declared",
    offsetMinutes: -240,
  };
  assert.equal(writeAaf([exportRecord(chart)]), `${HEADER}\n${UT_NOTE}\n#A93:*,*,*,17.4.2024,12:00,*,*\n#B93:*,40n43,74w00,0h,0\n`);
});

test("the sky of a Stellarium Web tab is written in Universal Time", () => {
  const record = exportRecord({ utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 });
  assert.equal(writeAaf([record]), `${HEADER}\n${UT_NOTE}\n#A93:*,*,*,14.1.2024,21:00,*,*\n#B93:*,33s52,151e12,0h,0\n`);
});

test("every chart keeps its instant and place through AAF and back", () => {
  const sources = [
    ...readdirSync(new URL("astroseek/", root)).map(astroSeek),
    ...charts(NY_TEXT),
    ...charts(aaf("astrolog-8.00-new-york.aaf")),
    ...charts(aaf("astrolog-8.00-delhi-seconds.aaf")),
    { utc: "2024-04-17T12:00:30Z", lat: 0, lng: -0.5 },
  ].filter((chart) => typeof chart.utc === "string");
  assert.ok(sources.length >= 10);
  for (const chart of sources) {
    const [back] = charts(writeAaf([exportRecord(chart)]));
    assert.deepEqual(sky(back), sky(chart), JSON.stringify(sky(chart)));
  }
});

test("writes coordinates in degrees, minutes and any seconds", () => {
  const line = (lat, lng) => writeAaf([exportRecord({ utc: "2024-04-17T12:00:00Z", lat, lng })]).split("\n").at(-2);
  assert.equal(line(0, 0), "#B93:*,0n00,0e00,0h,0");
  assert.equal(line(-15.884167, -74.9125), "#B93:*,15s53:03,74w54:45,0h,0");
  assert.equal(line(89.999999, 179.999999), "#B93:*,90n00,180e00,0h,0");
});

test("writes offsets in the AAF'97 form", () => {
  const offset = (standardOffsetMinutes) =>
    writeAaf([{ ...exportRecord({ utc: "2024-04-17T12:00:00Z", lat: 0, lng: 0 }), standardOffsetMinutes }])
      .split("\n").at(-2).split(",")[3];
  assert.equal(offset(0), "0h");
  assert.equal(offset(60), "1he00");
  assert.equal(offset(-300), "5hw00");
  assert.equal(offset(345), "5he45");
  assert.equal(offset(-570), "9hw30");
});

// AAF has no way to escape a comma or a line break in a field. Astrolog 8.00
// writes a semicolon for a comma; AstroChart Bridge does the same.
test("a comma or line break in a name or place can't be written, so it is replaced", () => {
  const [chart] = charts(NY_TEXT);
  const record = { ...exportRecord(chart), lastName: "Test, Jr.", place: "New\nYork" };
  const text = writeAaf([record]);
  assert.match(text, /^#A93:Test; Jr\.,New York,\*,17\.4\.2024,8:00,New York,NY \(US\)$/m);
  assert.equal(charts(text)[0].name, "New York Test; Jr.");
});

test("names and places in Unicode are written as they are", () => {
  const [chart] = charts(NY_TEXT.replace("Test,New York", "Müller,Jürgen"));
  assert.equal(charts(writeAaf([exportRecord(chart)]))[0].name, "Jürgen Müller");
});

test("writes several records in one file", () => {
  const [ny] = charts(NY_TEXT);
  const [delhi] = charts(aaf("astrolog-8.00-delhi-seconds.aaf"));
  const back = charts(writeAaf([exportRecord(ny), exportRecord(delhi)]));
  assert.deepEqual(back.map((chart) => chart.name), ["New York Test", "Delhi Test"]);
  assert.deepEqual(back.map((chart) => chart.utc), [ny.utc, delhi.utc]);
});

test("throws for a chart whose UTC isn't decided yet, which is a bug in the caller", () => {
  const chart = astroSeek("ny-2021-03-14-gap.json");
  assert.equal(chart.utc, null);
  assert.throws(() => exportRecord(chart), /decided UTC/);
});
