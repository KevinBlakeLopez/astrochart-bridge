import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseCity } from "../extension/core/astroseek.js";
import { TOWN_LIMIT_KM } from "../extension/core/towns.js";

// The labels Astro-Seek's city search listed for "New York" on 2026-11-01, in its order.
const NEW_YORK_LIST = [
  "New York, USA, New York (40n43, 74w0)",
  "New York Mills, USA, New York (43n6, 75w17)",
  "New York Mills, USA, Minnesota (46n31, 95w23)",
  "New York, USA, Iowa (40n51, 93w16)",
  "New York City, USA, New York (40n43, 74w0)",
  "New York, UK, England (53n5, 0w8)",
  "New York, USA, Missouri (39n41, 93w56)",
  "New York, USA, Florida (30n50, 87w12)",
  "New York, USA, Kentucky (36n59, 88w57)",
];
const NEW_YORK = { town: "New York", lat: 40.716667, lng: -74 };

test("a chart's town chooses the city named as it over New York City at the same place", () => {
  assert.deepEqual(chooseCity(NEW_YORK_LIST, NEW_YORK), {
    kind: "pick",
    match: { text: NEW_YORK_LIST[0], away: "less than 1 km" },
  });
});

test("only the town's name before its first comma is compared", () => {
  assert.equal(chooseCity(NEW_YORK_LIST, { ...NEW_YORK, town: "New York, NY" }).match.text, NEW_YORK_LIST[0]);
});

test("the coordinates decide between towns of the same name", () => {
  assert.deepEqual(chooseCity(NEW_YORK_LIST, { town: "New York", lat: 40.85, lng: -93.266667 }), {
    kind: "pick",
    match: { text: NEW_YORK_LIST[3], away: "less than 1 km" },
  });
  assert.equal(chooseCity(NEW_YORK_LIST, { town: "New York", lat: 53.083333, lng: -0.133333 }).match.text, NEW_YORK_LIST[5]);
});

test("a town named as none of the near matches asks, nearest first", () => {
  assert.deepEqual(chooseCity(NEW_YORK_LIST, { ...NEW_YORK, town: "Manhattan" }), {
    kind: "ask",
    matches: [
      { text: NEW_YORK_LIST[0], away: "less than 1 km" },
      { text: NEW_YORK_LIST[4], away: "less than 1 km" },
    ],
  });
});

test(`no match within ${TOWN_LIMIT_KM} km chooses nothing, and says how many were listed`, () => {
  assert.deepEqual(chooseCity(NEW_YORK_LIST, { town: "New York", lat: -33.866667, lng: 151.2 }), { kind: "none", listed: 9 });
});

test("a label whose coordinates can't be read is left out, but still counts as listed", () => {
  const unreadable = [
    "New York",
    "New York, USA, New York",
    "New York, USA, New York (40n43)",
    "New York, USA, New York (91n0, 74w0)",
    "New York, USA, New York (40n60, 74w0)",
    "New York, USA, New York (40n43, 181w0)",
    "New York, USA, New York (40e43, 74n0)",
  ];
  assert.deepEqual(chooseCity(unreadable, NEW_YORK), { kind: "none", listed: unreadable.length });
  assert.deepEqual(chooseCity([...unreadable, NEW_YORK_LIST[4]], NEW_YORK), {
    kind: "pick",
    match: { text: NEW_YORK_LIST[4], away: "less than 1 km" },
  });
});

// Only north and west labels have been seen; s and e are assumed to be written
// the same way, as astro.com writes them.
test("a label south and east reads as a negative latitude and a positive longitude", () => {
  const sydney = "Sydney, Australia, New South Wales (33s52, 151e12)";
  assert.deepEqual(chooseCity([sydney], { town: "Sydney", lat: -33.866667, lng: 151.2 }), {
    kind: "pick",
    match: { text: sydney, away: "less than 1 km" },
  });
});
