import { test } from "node:test";
import assert from "node:assert/strict";
import { astroSeekUrl } from "../extension/core/astroseek.js";
import { ASTRO_SEEK_NOTES, viewFor, viewForSky } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

const NY = {
  kind: "natal",
  site: "astro-seek",
  local: "2024-04-17T08:00:00",
  zoneLabel: "EDT, DST",
  utc: "2024-04-17T12:00:00Z",
  utcSource: "printed",
  offsetMinutes: -240,
  lat: 40.716667,
  lng: -74,
};
const LA = { timeZone: "America/Los_Angeles" };

test("a ready screenshot shows the popup's screen, with the compare note first and Astro-Seek's notes last", () => {
  const popup = viewFor(NY, LA);
  const { notes, buttons, ...rest } = viewForScreenshot(NY, LA);
  assert.deepEqual({ ...rest, notes: popup.notes }, popup);
  assert.match(notes[0], /nothing checks the latitude/);
  assert.deepEqual(notes.slice(1), [...popup.notes, ...ASTRO_SEEK_NOTES]);
});

test("a screenshot opens the sky or the Astro-Seek chart", () => {
  assert.deepEqual(viewForScreenshot(NY, LA).buttons, [
    { label: "Open sky", opens: "stellarium" },
    { label: "Open chart in Astro-Seek", opens: "astro-seek" },
  ]);
});

// The button's link is astroSeekUrl of the view's sky (view.js maps "astro-seek" to it).
test("the screenshot's Astro-Seek chart is the one a Stellarium tab at that sky opens", () => {
  const { sky } = viewForScreenshot(NY, LA);
  assert.equal(astroSeekUrl(sky), viewForSky(sky, LA).url);
  const sent = Object.fromEntries(new URL(astroSeekUrl(sky)).searchParams);
  assert.deepEqual(
    [sent.narozeni_den, sent.narozeni_mesic, sent.narozeni_rok, sent.narozeni_hodina, sent.narozeni_minuta],
    ["17", "4", "2024", "12", "00"],
  );
  assert.deepEqual([sent.narozeni_timezone_form, sent.narozeni_timezone_dst_form], ["0", "0"]);
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
