import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOffset, utcFromOffset } from "../extension/core/civiltime.js";

test("±HH:MM becomes minutes east of UTC", () => {
  assert.equal(parseOffset("-04:00"), -240);
  assert.equal(parseOffset("+11:00"), 660);
  assert.equal(parseOffset("+05:30"), 330);
  assert.equal(parseOffset("+00:00"), 0);
  assert.equal(parseOffset("-00:00"), 0);
});

test("the range is -12:00 to +14:00", () => {
  assert.equal(parseOffset("-12:00"), -720);
  assert.equal(parseOffset("+14:00"), 840);
  assert.equal(parseOffset("-13:00"), null);
  assert.equal(parseOffset("+14:30"), null);
});

test("anything not written as ±HH:MM is not an offset", () => {
  for (const text of ["4", "+4:00", "04:00", "+05:60", "UTC-4", ""]) {
    assert.equal(parseOffset(text), null, JSON.stringify(text));
  }
});

test("local time minus the offset gives UTC", () => {
  assert.equal(utcFromOffset("2021-03-14T02:30:00", -300), "2021-03-14T07:30:00Z");
});

test("a positive offset can put UTC on the previous day", () => {
  assert.equal(utcFromOffset("2024-01-15T08:00:00", 660), "2024-01-14T21:00:00Z");
});

test("local seconds carry through to UTC", () => {
  assert.equal(utcFromOffset("2024-04-17T08:00:30", -240), "2024-04-17T12:00:30Z");
});
