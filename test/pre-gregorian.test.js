import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeProgramText, analyzeScreenshot } from "../extension/core/index.js";
import { localSiderealSeconds } from "../extension/core/sidereal.js";

// Every screenshot reader refuses a birth dated before 15 October 1582, when
// the Gregorian calendar began. No program's layout says reliably which
// calendar such a date is in: Solar Fire and Astro Gold take an unmarked one
// as Julian, and Planetdance and Jagannatha Hora let the user choose.
//
// Each layout below is dated 1 June 1500, noon in Rome (12°30'E, local mean
// time +0:50), and comes in two versions. In one, the program worked out its
// sidereal time, weekday and Julian Day on the proleptic Gregorian calendar;
// in the other on the Julian, whose 1 June 1500 is Gregorian 11 June. A
// layout that prints none of them reads the same in both. The Julian version
// would fail a sidereal, weekday or Julian Day check as a misreading, so the
// calendar is refused before those checks run.

// The day a program counts noon from, on Date's Gregorian calendar.
const DAY = { gregorian: Date.UTC(1500, 5, 1), julian: Date.UTC(1500, 5, 11) };
const noon = (calendar, offsetMinutes) => DAY[calendar] + 12 * 3_600_000 - offsetMinutes * 60_000;
const isoUtc = (ms) => new Date(ms).toISOString().replace(".000Z", "Z");
const pad = (n) => String(n).padStart(2, "0");
// "04:35:17" for seconds after midnight.
const hms = (seconds) => `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(Math.floor(seconds) % 60)}`;
// What the program prints for noon at an offset east of UTC.
const sidereal = (calendar, offsetMinutes) => hms(localSiderealSeconds(isoUtc(noon(calendar, offsetMinutes)), 12.5));
const julianDay = (calendar, offsetMinutes) => (noon(calendar, offsetMinutes) / 86_400_000 + 2440587.5).toFixed(5);
const weekday = (calendar) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(DAY[calendar]).getUTCDay()];

// Each reader's layout, as its own tests give it, with this chart's values.
const KEPLER = ["Test", "June 1, 1500", "12:00 PM", "Standard Time", "Rome, Italy", "41 N 54   12 E 30", "Time Zone: 1 hours East"];
const WINSTAR = ["Test", "Jun 1, 1500", "Rome,Italy", "12:00:00 PM LMT", "ZONE: -00:50", "012E30'00\"", "41N54'00\""];
const TIMEPASSAGES = ["Test", "Jun 1, 1500, 12:00:00 PM", "Rome, Italy", "41N54, 12E30", "TLT 11:50", "Placidus"];
const LAYOUTS = {
  "Astro-Seek's chart page": (calendar) => [
    "Date of Birth (local time): 1 June 1500 - 12:00 (LMT)",
    "Universal Time (UT/GMT): 1 June 1500 - 11:10",
    `Local Sidereal Time (LST): ${sidereal(calendar, 50)}`,
    "Latitude, Longitude: 41°54'N, 12°30'E",
  ],
  "astro.com's chart image": (calendar) => [
    "Test",
    `${weekday(calendar).slice(0, 2)}., 1 June 1500 Time: 12:00 p.m. LMT`,
    "Rome, ITA Univ.Time: 11:10",
    `12e30, 41n54 Sid. Time: ${sidereal(calendar, 50)}`,
  ],
  "Solar Fire's chart details": () => ["Test", "Natal Chart", "1 Jun 1500", "12:00 pm  LMT -0:50", "Rome, Italy", "41°N54' 012°E30'"],
  "Solar Fire's chart details with a weekday": (calendar) =>
    ["Test", "Natal Chart", `1 Jun 1500, ${weekday(calendar).slice(0, 3)}`, "12:00 pm  LMT -0:50", "Rome, Italy", "41°N54' 012°E30'"],
  // NS says the date is Gregorian, but astro.com, Astro-Seek and Stellarium
  // could still take its digits as Julian.
  "Solar Fire's chart details marked NS": () => ["Test", "Natal Chart", "1 Jun 1500 NS", "12:00 pm  LMT -0:50", "Rome, Italy", "41°N54' 012°E30'"],
  "Astro Gold's chart details": (calendar) =>
    ["1 - Chart", "Test", "Female - Equal", `1 Jun 1500, ${weekday(calendar).slice(0, 3)}`, "12:00 PM LMT -0:50", "Rome, Italy", "41°N54' 012°E30'"],
  "Astro Gold's Edit Chart screen": () => ["Date 1 Jun 1500", "Time 12:00 PM", "Place Rome", "Latitude 41°N54'", "Longitude 012°E30'", "Timezone LMT -0:50"],
  "Morinus's status bar": () => ["Test | Radix | 1500.june.01. 12:00:00ZN | Long.: 12°30'E Lat.: 41°54'N"],
  // Without " J" the square chart's date is Gregorian, refused as NS is.
  "Morinus's square chart": () => ["1500.june.01", "12:00:00 ZN", "Rome", "12°30'E  41°54'N", "Test", "Radix", "Placidus"],
  "Valens's wheel": () => ["June 1, 1500", "12:00:00 UT", "Rome", "12°30'E  41°54'N", "Test", "Radix", "Tropical", "Porphyrius"],
  "Planetdance's wheel": (calendar) => ["Test", "01/06/1500 12:00:00 LMT +00:50", "Rome, Italy, 12e30, 41n54", `Whole Sign St:${sidereal(calendar, 50)}`],
  "Planetdance's data screen": (calendar) => [
    "Test 01/06/1500 12:00:00 Rome, Italy, 12e30, 41n54, Europe/Rome",
    `UT:01/06/1500 11:10:00 Julian: ${julianDay(calendar, 50)} Sidereal Time  ${sidereal(calendar, 50).replace(/(\d+):(\d+):(\d+)/, "$1°$2'$3\"")} ${weekday(calendar)}`,
  ],
  "Planetdance's Vedic screen": () => ["Classical North Indian Chart for:  Test", "01/06/1500 ,  12:00:00", "Rome, Italy, 12e30, 41n54, Europe/Rome"],
  "Jagannatha Hora's birth data": (calendar) => [
    "Test",
    "Natal Chart",
    "Date:          June 1, 1500",
    "Time:          12:00:00 pm",
    "Time Zone:     0:50:00 (East of GMT)",
    "Place:         12 E 30' 00\", 41 N 54' 00\"",
    "               Rome, Italy",
    "Altitude:      0.00 meters",
    `Sidereal Time: ${sidereal(calendar, 50)}`,
  ],
  "Kepler's data block": () => KEPLER,
  "Kepler's data block with its table": (calendar) => [...KEPLER, `Sidereal Time ${sidereal(calendar, 60)}`, "G.M.T. 11:00:00"],
  "Janus's wheel": () => ["Test", "Natal Chart", "1 Jun 1500", "12:00:00 PM", "LMT -00:50:00", "Rome", "Italy", "12e30'00 41n54'00"],
  "Win*Star's wheel": () => WINSTAR,
  "Win*Star's Tech 1 wheel": (calendar) => [...WINSTAR, `Julian Day: ${julianDay(calendar, 50)}`],
  "TimePassages's wheel without ST": () => TIMEPASSAGES,
  "TimePassages's wheel": (calendar) => [...TIMEPASSAGES.slice(0, 5), `ST ${sidereal(calendar, 60)}`, "Placidus"],
  "Astrolog's sidebar": (calendar) =>
    ["Astrolog 8.00", "Test", `${weekday(calendar).slice(0, 3)} June 1, 1500`, "12:00pm (ST Zone 1E)", "Rome", "12°30E  41°54N", `Julian Day: ${julianDay(calendar, 60)}`],
};

const CALENDAR = { kind: "refused", reason: "calendar-unsupported" };

for (const [layout, linesFor] of Object.entries(LAYOUTS)) {
  test(`${layout} dated 1 June 1500 is refused for its calendar, whichever calendar the program used`, () => {
    for (const calendar of ["gregorian", "julian"]) {
      const text = linesFor(calendar).join("\n");
      assert.deepEqual(analyzeScreenshot(text), CALENDAR, calendar);
      // The paste page reads the same text with the same readers, all but
      // astro.com's, whose labels turn up in ordinary text too.
      if (layout !== "astro.com's chart image") assert.deepEqual(analyzeProgramText(text), CALENDAR, `${calendar}, pasted`);
    }
  });
}

test("14 October 1582 is refused, and 15 October 1582, the Gregorian calendar's first day, opens", () => {
  // Solar Fire's block prints no weekday or sidereal time here, so only the date decides.
  const solarFire = (date) => ["Test", "Natal Chart", date, "12:00 pm  LMT -0:50", "Rome, Italy", "41°N54' 012°E30'"].join("\n");
  assert.deepEqual(analyzeScreenshot(solarFire("14 Oct 1582")), CALENDAR);
  assert.equal(analyzeScreenshot(solarFire("15 Oct 1582")).utc, "1582-10-15T11:10:00Z");
  // Astro-Seek's reader refuses the date itself, before its sidereal time is checked.
  const astroSeek = (day) =>
    [
      `Date of Birth (local time): ${day} October 1582 - 12:00 (LMT)`,
      `Universal Time (UT/GMT): ${day} October 1582 - 11:10`,
      `Local Sidereal Time (LST): ${hms(localSiderealSeconds(`1582-10-${day}T11:10:00Z`, 12.5))}`,
      "Latitude, Longitude: 41°54'N, 12°30'E",
    ].join("\n");
  assert.deepEqual(analyzeScreenshot(astroSeek(14)), CALENDAR);
  assert.equal(analyzeScreenshot(astroSeek(15)).utc, "1582-10-15T11:10:00Z");
});
