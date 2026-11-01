import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNd } from "../extension/core/astrocom.js";

// The nd= record of a captured astro.com account chart, "Test", which uses the
// invented New York birth data of the Astro-Seek fixtures.
const TEST = ",Test,e,17,4,2024,8:00,h4w,gad,0,New York,NY (US),74w00,40n43,f,45,-24500,61";
const TEST_RESULT = {
  local: "2024-04-17T08:00:00",
  zone: { kind: "offset", offsetMinutes: -240 },
  field9: "gad",
  lat: 40.716667,
  lng: -74,
};

// The Test record with some fields replaced, by position counting from 1:
// 4-6 date, 7 time, 8 zone, 9 field 9, 13 longitude, 14 latitude.
const variant = (changes) => {
  const fields = TEST.split(",");
  for (const [position, value] of Object.entries(changes)) fields[position - 1] = value;
  return fields.join(",");
};

test("reads the captured account chart record", () => {
  assert.deepEqual(parseNd(TEST), TEST_RESULT);
});

test("one-digit minutes read like two, as Astro-Databank writes 74w0", () => {
  assert.deepEqual(parseNd(variant({ 13: "74w0" })), TEST_RESULT);
});

test("four digits after the direction are minutes and seconds", () => {
  assert.deepEqual(parseNd(variant({ 13: "73w4859" })), { ...TEST_RESULT, lng: -73.816389 });
});

test("a time with seconds keeps them", () => {
  assert.deepEqual(parseNd(variant({ 7: "7:30:03" })), { ...TEST_RESULT, local: "2024-04-17T07:30:03" });
});

test("east and south are positive and negative, as in Sydney", () => {
  assert.deepEqual(parseNd(variant({ 8: "h11e", 13: "151e12", 14: "33s52" })), {
    ...TEST_RESULT,
    zone: { kind: "offset", offsetMinutes: 660 },
    lat: -33.866667,
    lng: 151.2,
  });
});

test("a local-mean-time zone is returned with its meridian", () => {
  assert.deepEqual(parseNd(variant({ 8: "m10e0", 9: "gal" })), {
    ...TEST_RESULT,
    zone: { kind: "local-mean-time", meridian: 10 },
    field9: "gal",
  });
  assert.deepEqual(parseNd(variant({ 8: "m0w10", 9: "gal" })).zone, { kind: "local-mean-time", meridian: -0.166667 });
});

test("0°0' west is 0, not -0", () => {
  assert.ok(Object.is(parseNd(variant({ 13: "0w0" })).lng, 0));
  assert.ok(Object.is(parseNd(variant({ 8: "h0w" })).zone.offsetMinutes, 0));
});

test("the edges of each range are accepted", () => {
  assert.equal(parseNd(variant({ 14: "90n0" })).lat, 90);
  assert.equal(parseNd(variant({ 13: "180w0" })).lng, -180);
  assert.equal(parseNd(variant({ 8: "h12w" })).zone.offsetMinutes, -720);
  assert.equal(parseNd(variant({ 8: "h14e" })).zone.offsetMinutes, 840);
});

test("a record without exactly 18 fields is refused", () => {
  assert.equal(parseNd(TEST.replace("New York", "New York, Manhattan")), null);
  assert.equal(parseNd(TEST.slice(0, TEST.lastIndexOf(","))), null);
  assert.equal(parseNd(""), null);
});

test("zone codes not seen before are refused", () => {
  for (const code of ["h5e30", "h13w", "h15e", "h4", "x4w", "m10e0030", "m181e0", "m10e60", ""]) {
    assert.equal(parseNd(variant({ 8: code })), null, JSON.stringify(code));
  }
});

test("field 9 values not seen before are refused", () => {
  for (const value of ["gas", "jul", ""]) {
    assert.equal(parseNd(variant({ 9: value })), null, JSON.stringify(value));
  }
});

test("coordinates out of range or in an unseen form are refused", () => {
  const cases = [
    [14, "40n60"], [14, "40n4360"], [14, "40n435"], [14, "90n1"], [14, "40e43"], [14, "40n"],
    [13, "180w1"], [13, "74n00"], [13, "74w0060"], [13, "-74w0"],
  ];
  for (const [position, code] of cases) {
    assert.equal(parseNd(variant({ [position]: code })), null, `field ${position}: ${code}`);
  }
});

test("times and dates that don't exist are refused", () => {
  const cases = [
    [7, "24:00"], [7, "8:60"], [7, "8:00:60"], [7, "8"], [7, "8:0"],
    [4, "31"], [4, "0"], [4, "1a"], [5, "13"], [5, "0"], [6, ""], [6, "12345"],
  ];
  for (const [position, value] of cases) {
    assert.equal(parseNd(variant({ [position]: value })), null, `field ${position}: ${value}`);
  }
});
