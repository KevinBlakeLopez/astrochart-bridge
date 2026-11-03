import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseTown, formValues } from "../extension/core/astrocom.js";
import { chooseCity } from "../extension/core/astroseek.js";
import { placeAgrees, placeKeys, placeParts } from "../extension/core/places.js";
import { searchTown } from "../extension/core/towns.js";

test("a place is its town, and the states and countries after it the tables know", () => {
  for (const [place, town, qualifiers] of [
    ["Brooklyn, New York", "Brooklyn", ["New York"]],
    ["Hodgenville KY, USA", "Hodgenville", ["KY", "USA"]],
    ["Los Angeles,CA", "Los Angeles", ["CA"]],
    ["Seattle, Washington, USA", "Seattle", ["Washington", "USA"]],
    ["New York, NY (US)", "New York", ["NY", "US"]],
    ["Toronto ON", "Toronto", ["ON"]],
    ["Sydney NSW", "Sydney", ["NSW"]],
    ["Saint John, NB, Canada", "Saint John", ["NB", "Canada"]],
    ["Eisenach, Germany", "Eisenach", ["Germany"]],
    // A county the tables don't know is left out.
    ["Brooklyn, Kings County, New York", "Brooklyn", ["New York"]],
    // The first word always stays the town's.
    ["Washington, DC", "Washington", ["DC"]],
    ["New York", "New York", []],
    ["Kansas City", "Kansas City", []],
    ["Buckingham Palace", "Buckingham Palace", []],
  ]) {
    assert.deepEqual(placeParts(place), { town, qualifiers }, place);
  }
});

test("a code counts only as written, in capitals; a name whatever its case and accents", () => {
  assert.deepEqual([...placeKeys("OR")], ["US-OR"]);
  assert.deepEqual([...placeKeys("Or")], []);
  assert.deepEqual(placeParts("Lake Or"), { town: "Lake Or", qualifiers: [] });
  assert.deepEqual([...placeKeys("québec")], ["CA-QC"]);
  assert.deepEqual([...placeKeys("Côte d'Ivoire")], ["CI"]);
  // A code or name can stand for more than one: CA for Canada and California, Georgia for both.
  assert.deepEqual([...placeKeys("CA")].sort(), ["CA", "US-CA"]);
  assert.deepEqual([...placeKeys("Georgia")].sort(), ["GE", "US-GA"]);
  assert.deepEqual([...placeKeys("UK")], ["GB"]);
  assert.deepEqual([...placeKeys("USA")], ["US"]);
});

test("the country table has every ISO 3166-1 country once", () => {
  const source = readFileSync(new URL("../extension/core/places.js", import.meta.url), "utf8");
  const rows = source.split("const COUNTRY_ROWS = `")[1].split("`")[0].split(/[|\n]/).map((row) => row.trim()).filter(Boolean);
  assert.equal(rows.length, 249);
  for (const column of [0, 1]) {
    const codes = rows.map((row) => row.split(" ")[column]);
    assert.equal(new Set(codes).size, codes.length);
  }
});

test("a match agrees when each qualifier is its state or country, however each is written", () => {
  assert.equal(placeAgrees(["MO"], ["MO", "US", "Missouri"]), true);
  assert.equal(placeAgrees(["Missouri", "USA"], ["MO", "US", "Missouri"]), true);
  assert.equal(placeAgrees(["MO"], ["KS", "US", "Kansas"]), false);
  assert.equal(placeAgrees(["UK"], ["ENG", "UK", "England", "UK"]), true);
  assert.equal(placeAgrees([], ["anything"]), true);
});

// Kansas City in Missouri and in Kansas, about 5 km apart, as each site lists them.
const ASTRO_COM_KC = ["Kansas City, MO (US) = Missouri, 39n06, 94w35", "Kansas City, KS (US) = Kansas, 39n07, 94w38"];
const ASTRO_SEEK_KC = ["Kansas City, USA, Missouri (39n6, 94w35)", "Kansas City, USA, Kansas (39n7, 94w38)"];
const KC = { lat: 39.1, lng: -94.583333 };

test("the state chooses between two towns of the same name close together", () => {
  for (const [town, picked] of [
    ["Kansas City, MO", 0],
    ["Kansas City, Missouri, USA", 0],
    ["Kansas City KS", 1],
  ]) {
    assert.equal(chooseTown(ASTRO_COM_KC, { ...KC, town }).match.text, ASTRO_COM_KC[picked], town);
    assert.equal(chooseCity(ASTRO_SEEK_KC, { ...KC, town }).match.text, ASTRO_SEEK_KC[picked], town);
  }
  // Without a state, both are near and named alike, so the person is asked.
  assert.equal(chooseTown(ASTRO_COM_KC, { ...KC, town: "Kansas City" }).kind, "ask");
  // A state that agrees with neither is no reason to choose; it doesn't refuse either.
  assert.equal(chooseCity(ASTRO_SEEK_KC, { ...KC, town: "Kansas City, Ohio" }).kind, "ask");
});

test("only the town is typed into a town search", () => {
  assert.equal(searchTown("Brooklyn, New York"), "Brooklyn");
  assert.equal(searchTown("Hodgenville KY, USA"), "Hodgenville");
  assert.equal(formValues({ utc: "2024-04-17T12:00:00Z", town: "New York, NY (US)" }).scit, "New York");
});
