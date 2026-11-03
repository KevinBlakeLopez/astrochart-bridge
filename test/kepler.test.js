import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { detect, read } from "../extension/core/kepler.js";

// Kepler's and Sirius's data blocks as the screenshots of Kepler 9.26 and
// Sirius 2.0 on astrosoftware.com show them. The Modern style's two columns
// are joined across, as OCR reads them; the Bach style is one column.
const CHOPIN = [
  "Frederic Chopin Tropical Placidus",
  "March 1, 1810 Time Zone: 0 hours West",
  "6:00 PM Local Mean Time",
  "Warsaw, Poland 52 N 15 21 E 00",
  "NATAL CHART",
];
// The table beside Kepler 9.26's wheel for the same chart.
const CHOPIN_TABLE = ["Sidereal Time 4:35:17", "G.M.T. 16:36:00", "Delta t (ET-UT) 0:00:12"];
const BACH = ["Johann Sebastian Bach", "March 31, 1685", "12:00 PM", "Standard Time", "Eisenach, Germany", "50 N 59   10 E 19", "Time Zone: 1 hours East", "Tropical Placidus", "Mean Node"];

const ocr = (lines) => lines.join("\n");
// lines with the line that starts with `start` replaced.
const swap = (lines, start, line) => lines.map((current) => (current.startsWith(start) ? line : current));

test("a local-mean-time chart takes its offset from the longitude, not its 0 hours West", () => {
  assert.deepEqual(analyzeScreenshot(ocr(CHOPIN)), {
    kind: "natal",
    site: "kepler-or-sirius",
    local: "1810-03-01T18:00:00",
    zoneLabel: null,
    lat: 52.25,
    lng: 21,
    utc: "1810-03-01T16:36:00Z",
    utcSource: "declared",
    offsetMinutes: 84,
    warnings: ["offset-unchecked"],
    // Above the date, less the zodiac and house system beside it, and before the coordinates.
    name: { first: "Frederic Chopin", last: "" },
    town: "Warsaw, Poland",
  });
});

test("the Bach style's name and place are lines of their own", () => {
  const labels = (lines) => {
    const { name, place } = read(ocr(lines));
    return { name, place };
  };
  assert.deepEqual(labels(BACH), { name: "Johann Sebastian Bach", place: "Eisenach, Germany" });
  // A block that starts at its date has no name; the zodiac line alone isn't one.
  assert.deepEqual(labels(BACH.slice(1)), { name: undefined, place: "Eisenach, Germany" });
  assert.deepEqual(labels(["Tropical Placidus", ...CHOPIN.slice(1)]).name, undefined);
  // With the place line gone, the line above the coordinates is the time type, which this reader knows.
  assert.deepEqual(labels(BACH.filter((line) => line !== "Eisenach, Germany")).place, undefined);
});

test("the table's G.M.T. and sidereal time check the chart", () => {
  const chart = analyzeScreenshot(ocr(["Kepler 9.26", ...CHOPIN, ...CHOPIN_TABLE]));
  assert.equal(chart.site, "kepler");
  assert.equal(chart.utc, "1810-03-01T16:36:00Z");
  assert.equal(chart.utcSource, "printed");
  assert.equal(chart.offsetMinutes, 84);
  assert.equal(chart.warnings, undefined);
});

test("a G.M.T. that doesn't fit the offset, or a misread sidereal time, is refused", () => {
  assert.deepEqual(analyzeScreenshot(ocr([...CHOPIN, ...swap(CHOPIN_TABLE, "G.M.T.", "G.M.T. 17:36:00")])), {
    kind: "refused",
    reason: "zone-offset-mismatch",
  });
  assert.deepEqual(analyzeScreenshot(ocr([...CHOPIN, ...swap(CHOPIN_TABLE, "Sidereal", "Sidereal Time 4:45:17")])), {
    kind: "refused",
    reason: "sidereal-mismatch",
  });
});

test("a standard-time chart in one column takes its offset from the Time Zone", () => {
  const chart = analyzeScreenshot(ocr(["Sirius 2.0", ...BACH]));
  assert.equal(chart.site, "sirius");
  assert.equal(chart.local, "1685-03-31T12:00:00");
  assert.equal(chart.utc, "1685-03-31T11:00:00Z");
  assert.deepEqual([chart.lat, chart.lng], [50.983333, 10.316667]);
  assert.deepEqual(chart.warnings, ["offset-unchecked"]);
});

test("a zone in hours West is UTC minus, and a half hour reads", () => {
  const west = swap(swap(BACH, "Time Zone", "Time Zone: 5 hours West"), "50 N", "40 N 43 74 W 00");
  assert.equal(analyzeScreenshot(ocr(west)).utc, "1685-03-31T17:00:00Z");
  const india = swap(swap(BACH, "Time Zone", "Time Zone: 5.5 hours East"), "50 N", "28 N 36 77 E 12");
  assert.equal(analyzeScreenshot(ocr(india)).offsetMinutes, 330);
});

test("a daylight-time chart asks for its offset, unless a G.M.T. gives it", () => {
  const summer = swap(swap(BACH, "Standard Time", "Daylight Saving Time"), "Time Zone", "Time Zone: 5 hours West");
  const asked = analyzeScreenshot(ocr(summer));
  assert.equal(asked.utcSource, "needs-offset");
  const given = analyzeScreenshot(ocr([...summer, "G.M.T. 16:00:00"]));
  assert.equal(given.utc, "1685-03-31T16:00:00Z");
  assert.equal(given.offsetMinutes, -240);
});

test("a G.M.T. that fits two days, with nothing to choose, is refused", () => {
  // 1:00 PM with 00:00:00 G.M.T. is UTC+13 or UTC-11, as in Samoa.
  const samoa = swap(swap(BACH, "Standard Time", "Daylight Saving Time"), "12:00 PM", "1:00 PM");
  assert.deepEqual(analyzeScreenshot(ocr([...samoa, "G.M.T. 00:00:00"])), { kind: "refused", reason: "ambiguous-screenshot" });
});

test("a chart other than a natal one is refused", () => {
  assert.deepEqual(read(ocr(swap(CHOPIN, "NATAL", "TRANSIT CHART"))), { kind: "refused", reason: "chart-type-unsupported" });
});

test("two blocks, or one missing a field, are refused", () => {
  assert.deepEqual(read(ocr([...CHOPIN, ...BACH])), { kind: "refused", reason: "ambiguous-screenshot" });
  assert.deepEqual(read(ocr(CHOPIN.filter((line) => !line.startsWith("Warsaw")))), { kind: "refused", reason: "unreadable-screenshot" });
});

test("values that don't fit are refused, not guessed", () => {
  const unreadable = { kind: "refused", reason: "unreadable-screenshot" };
  assert.deepEqual(read(ocr(swap(CHOPIN, "March", "March 30, 1810 Time Zone: 0 hours West").map((l) => l.replace("March 30", "February 30")))), unreadable);
  assert.deepEqual(read(ocr(swap(CHOPIN, "6:00", "13:00 PM Local Mean Time"))), unreadable);
  assert.deepEqual(read(ocr(swap(CHOPIN, "Warsaw", "Warsaw, Poland 52 N 75 21 E 00"))), unreadable);
  assert.deepEqual(read(ocr([...CHOPIN, "G.M.T. 16:66:00"])), unreadable);
});

test("a block is recognised by its Time Zone in hours", () => {
  assert.equal(detect(ocr(CHOPIN)), true);
  assert.equal(detect(ocr(CHOPIN.map((line) => line.replace(/ Time Zone.*/, "")))), false);
});

test("a Time Zone that agrees with the G.M.T. counts as checked, without a sidereal time", () => {
  const chart = analyzeScreenshot(ocr([...BACH, "G.M.T. 11:00:00"]));
  assert.equal(chart.utc, "1685-03-31T11:00:00Z");
  assert.equal(chart.warnings, undefined);
});
