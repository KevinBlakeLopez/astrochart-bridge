import { test } from "node:test";
import assert from "node:assert/strict";
import { astroSeekUrl } from "../extension/core/astroseek.js";
import { astroSeekButtons, astroSeekNotes, astroSeekSaveNote, shareButton, viewFor, viewForAstroCom, viewForSky } from "../extension/popup-model.js";
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
  assert.deepEqual({ ...rest, notes: popup.notes, buttons: popup.buttons }, popup);
  assert.match(notes[0], /nothing checks the latitude/);
  assert.deepEqual(notes.slice(1), [...popup.notes, astroSeekNotes()[0], astroSeekSaveNote()]);
});

test("a screenshot opens the sky or the Astro-Seek chart, or shares it", () => {
  assert.deepEqual(viewForScreenshot(NY, LA).buttons, [
    { label: "Open Stellarium Web", opens: "stellarium" },
    { label: "Open chart in Astro-Seek", opens: "astro-seek" },
    { label: "Save in Astro-Seek…", saves: { town: null, name: null, gender: null }, secondary: true },
    { label: "Which planets were visible", does: "helioscope", secondary: true },
    { label: "Parans", does: "parans", secondary: true },
    { label: "Share…", does: "share", secondary: true },
  ]);
});

// Each button's link is astroSeekUrl of its view's sky (view.js maps "astro-seek" to it).
test("the screenshot's Astro-Seek chart is the one a Stellarium tab at that sky opens", () => {
  const { sky } = viewForScreenshot(NY, LA);
  const tab = viewForSky(sky, LA);
  assert.deepEqual(tab.sky, sky);
  assert.ok(tab.buttons.some(({ opens }) => opens === "astro-seek"));
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

test("an astro.com chart image's screen lists Astro-Seek's notes once", () => {
  const lilly = {
    ...NY,
    site: "astro-com",
    local: "1645-07-26T07:30:03",
    zoneLabel: null,
    utc: "1645-07-26T07:30:43Z",
    offsetMinutes: -40 / 60,
    lat: 51.5,
    lng: -0.166667,
  };
  const popup = viewFor(lilly, LA);
  const view = viewForScreenshot(lilly, LA);
  assert.deepEqual(view.notes.slice(1), popup.notes);
  assert.deepEqual(view.notes.slice(-2), [astroSeekNotes()[0], astroSeekSaveNote()]);
  assert.deepEqual(view.buttons, popup.buttons);
});

test("a Solar Fire chart with nothing to check its offset says so, after the popup's warnings", () => {
  const streisand = {
    kind: "natal",
    site: "solar-fire",
    local: "1942-04-24T05:04:00",
    zoneLabel: null,
    lat: 40.633333,
    lng: -73.933333,
    utc: "1942-04-24T09:04:00Z",
    utcSource: "declared",
    offsetMinutes: -240,
    warnings: ["offset-unchecked"],
  };
  const view = viewForScreenshot(streisand, LA);
  assert.equal(view.state, "ready");
  assert.deepEqual(view.warnings, [
    "Nothing in this Solar Fire screenshot checks its UTC offset. Compare the Offset row with the screenshot.",
  ]);
  assert.deepEqual(view.buttons, [
    ...astroSeekButtons(),
    { label: "Save in Astro-Seek…", saves: { town: null, name: null, gender: null }, secondary: true },
    { label: "Which planets were visible", does: "helioscope", secondary: true },
    { label: "Parans", does: "parans", secondary: true },
    shareButton(),
  ]);
  assert.deepEqual(view.notes.slice(-2), [astroSeekNotes()[0], astroSeekSaveNote()]);
  const either = viewForScreenshot({ ...streisand, site: "solar-fire-or-astro-gold" }, LA);
  assert.match(either.warnings[0], /^Nothing in this Solar Fire or Astro Gold screenshot/);
});

test("any program's screenshot can be entered in astro.com, at the local time it prints", () => {
  for (const site of ["solar-fire", "astro-gold", "astro-com", "kepler"]) {
    const view = viewForScreenshot({ ...NY, site, zoneLabel: null }, LA);
    assert.equal(view.next?.label, "Enter in astro.com…", site);
    assert.deepEqual(view.next.view, viewForAstroCom(view.sky, { local: NY.local }), site);
  }
});

test("an Astro-Seek screenshot keeps the step viewFor gives it, and one with no UTC yet has none", () => {
  assert.deepEqual(viewForScreenshot(NY, LA).next, viewFor(NY, LA).next);
  const needsOffset = viewForScreenshot({ ...NY, site: "solar-fire", utc: null, utcSource: "needs-offset", offsetMinutes: null }, LA);
  assert.equal(needsOffset.state, "enter-offset");
  assert.equal(needsOffset.next, undefined);
});

const REASONS = [
  "unreadable-screenshot",
  "ambiguous-screenshot",
  "sidereal-mismatch",
  "offset-out-of-range",
  "weekday-mismatch",
  "zone-offset-mismatch",
  "no-coordinates",
  "true-local-time-mismatch",
  "offset-off-quarter-hour",
];
for (const reason of REASONS) {
  test(`${reason} has its own message and keeps its code`, () => {
    const view = viewForScreenshot({ kind: "refused", reason });
    assert.equal(view.state, "refused");
    assert.equal(view.code, reason);
    assert.match(view.message, /screenshot/);
  });
}

for (const reason of ["calendar-unsupported", "apparent-time"]) {
  test(`${reason} has its own message and keeps its code`, () => {
    const view = viewForScreenshot({ kind: "refused", reason });
    assert.equal(view.code, reason);
    assert.match(view.message, /AstroChart Bridge/);
  });
}
