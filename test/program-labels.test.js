import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeScreenshot } from "../extension/core/index.js";
import { formForText } from "../extension/paste-model.js";
import { viewForAstroCom } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

// The chart's name and place as the desktop programs print them, read by
// where each program puts them, and passed on to astro.com's and
// Astro-Seek's forms. The programs' own samples, as in their readers' tests;
// the JHora block with a place name is invented.
const SOLAR_FIRE = ["Barbra Streisand", "Natal Chart (9)", "24 Apr 1942", "5:04 am  +4:00", "Brooklyn, New York", "40°N38' 073°W56'"];
const JHORA = [
  "Example Person",
  "Natal Chart",
  "Date:          October 26, 1955",
  "Time:          9:17:59 pm",
  "Time Zone:     8:00:00 (West of GMT)",
  "Place:         122 W 20' 30\", 47 N 36' 32\"",
  "               Seattle, Washington, USA",
  "Altitude:      0.00 meters",
  "Sidereal Time: 23:27:48",
];
const JANUS_REPORT = ["4 Aug 1981 4:46:00 AM PDT +07:00:00", "Los Angeles CA", "118w14'34 34n03'08"];
const WINSTAR = ["Jodie Foster", "Nov 19, 1962", "Los Angeles,CA", "08:14:00 AM PST", "ZONE: +08:00", "118W15'00\"", "34N03'00\""];
const TIMEPASSAGES = ["Brad Pitt", "Dec 18, 1963, 6:31:00 AM CST", "Cancer Rising", "Shawnee, OK", "35N20, 96W55", "TLT 6:03", "ST 11:48:57"];
const LA = { timeZone: "America/Los_Angeles" };
const ocr = (lines) => lines.join("\n");
const labels = (lines) => {
  const { name = null, town = null } = analyzeScreenshot(ocr(lines));
  return { name: name?.first ?? null, town };
};

test("Jagannatha Hora's place name, under its coordinates, is the town; --, -- is none", () => {
  assert.deepEqual(labels(JHORA), { name: "Example Person", town: "Seattle, Washington, USA" });
  const unnamed = JHORA.map((line) => (line.includes("Seattle") ? "               --, --" : line));
  assert.deepEqual(labels(unnamed), { name: "Example Person", town: null });
  // A derived chart's own type line, or none, isn't Natal Chart: the line above isn't its name.
  assert.deepEqual(labels(JHORA.slice(1)), { name: null, town: "Seattle, Washington, USA" });
});

test("a Janus report prints no known name or place layout, so none is read", () => {
  assert.deepEqual(labels(JANUS_REPORT), { name: null, town: null });
});

test("Win*Star's name and place are read only where its layout puts them", () => {
  assert.deepEqual(labels(WINSTAR), { name: "Jodie Foster", town: "Los Angeles,CA" });
  // With the place line gone, the time follows the date and nothing is a place.
  assert.deepEqual(labels(WINSTAR.filter((line) => line !== "Los Angeles,CA")), { name: "Jodie Foster", town: null });
  assert.deepEqual(labels(WINSTAR.slice(1)), { name: null, town: "Los Angeles,CA" });
});

test("a TimePassages corner line that names a sign is neither name nor place", () => {
  assert.deepEqual(labels(TIMEPASSAGES), { name: "Brad Pitt", town: "Shawnee, OK" });
  const signAbove = TIMEPASSAGES.filter((line) => line !== "Shawnee, OK");
  assert.deepEqual(labels(signAbove), { name: "Brad Pitt", town: null });
});

test("a screenshot's name and place show as rows and go to both forms", () => {
  const view = viewForScreenshot(analyzeScreenshot(ocr(SOLAR_FIRE)), LA);
  const name = { first: "Barbra Streisand", last: "" };
  assert.deepEqual(view.rows[0], ["Name", "Barbra Streisand"]);
  assert.deepEqual(view.rows.slice(-2), [["Place", "40°38'N, 73°56'W"], ["Town", "Brooklyn, New York"]]);
  assert.deepEqual(view.next.view, viewForAstroCom(view.sky, { local: "1942-04-24T05:04:00", name, town: "Brooklyn, New York" }));
  const save = view.buttons.find(({ saves }) => saves);
  assert.deepEqual(save.saves, { town: "Brooklyn, New York", name: "Barbra Streisand", gender: null });
});

test("pasted program text gives its name and town to the paste page, not its coordinates", () => {
  // Before, JHora's "Place:" line, which holds coordinates, became the town.
  const jhora = formForText(ocr(JHORA));
  assert.deepEqual([jhora.name, jhora.town], [{ first: "Example Person", last: "" }, "Seattle, Washington, USA"]);
  assert.deepEqual(jhora.rows.at(-1), ["Town", "Seattle, Washington, USA"]);
  const solarFire = formForText(ocr(SOLAR_FIRE));
  assert.deepEqual([solarFire.name, solarFire.town], [{ first: "Barbra Streisand", last: "" }, "Brooklyn, New York"]);
  assert.deepEqual(solarFire.rows, [["Name", "Barbra Streisand"], ["Town", "Brooklyn, New York"]]);
});
