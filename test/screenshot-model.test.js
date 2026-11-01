import { test } from "node:test";
import assert from "node:assert/strict";
import { viewFor } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

const NY = {
  kind: "natal",
  local: "2024-04-17T08:00:00",
  zoneLabel: "EDT, DST",
  utc: "2024-04-17T12:00:00Z",
  utcSource: "printed",
  offsetMinutes: -240,
  lat: 40.716667,
  lng: -74,
};
const LA = { timeZone: "America/Los_Angeles" };

test("a ready screenshot shows the popup's screen with the compare note first", () => {
  const popup = viewFor(NY, LA);
  const view = viewForScreenshot(NY, LA);
  assert.deepEqual({ ...view, notes: popup.notes }, popup);
  assert.equal(view.notes.length, popup.notes.length + 1);
  assert.match(view.notes[0], /nothing checks the latitude/);
  assert.deepEqual(view.notes.slice(1), popup.notes);
});

test("the compare note comes first on the choose screen too", () => {
  const choose = {
    ...NY,
    utc: null,
    utcSource: "needs-choice",
    reason: "zone-label-mismatch",
    candidates: [
      { utc: "2024-04-17T07:00:00Z", offsetMinutes: -240, basis: "printed UT" },
      { utc: "2024-04-17T08:00:00Z", offsetMinutes: -300, basis: "zone label EST" },
    ],
  };
  const view = viewForScreenshot(choose, LA);
  assert.equal(view.state, "choose");
  assert.match(view.notes[0], /^Read from a screenshot/);
});

for (const reason of ["unreadable-screenshot", "ambiguous-screenshot", "sidereal-mismatch", "offset-out-of-range"]) {
  test(`${reason} has its own message and keeps its code`, () => {
    const view = viewForScreenshot({ kind: "refused", reason });
    assert.equal(view.state, "refused");
    assert.equal(view.code, reason);
    assert.match(view.message, /screenshot/);
  });
}
