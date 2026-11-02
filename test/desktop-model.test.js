import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import { BUSY, SETUP_STEPS, desktopHint, viewForDesktopImport, viewForDesktopSend, withDesktopSend } from "../extension/desktop-model.js";
import { viewFor, viewForSky } from "../extension/popup-model.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const analyze = (name) => {
  const { url, input } = fixture(name);
  return analyzePage({ url, input });
};

const NY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const SEND = { label: "Send to Stellarium Desktop" };

test("a ready chart screen gets the Send to Stellarium Desktop button", () => {
  const view = viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" });
  assert.deepEqual(withDesktopSend(view), { ...view, desktop: SEND });
});

// The button stays off until a reading is picked or an offset typed, like Open Stellarium Web.
test("the choose and enter-offset screens get it too", () => {
  const choose = viewFor(analyze("ny-2021-03-14-gap"));
  assert.equal(choose.state, "choose");
  assert.deepEqual(withDesktopSend(choose).desktop, SEND);

  const local = "2024-04-17T08:00:00";
  const enterOffset = viewFor({ kind: "natal", site: "astro-seek", local, zoneLabel: null, lat: 40.716667, lng: -74, utc: null, utcSource: "needs-offset", reason: "no-printed-ut" });
  assert.equal(enterOffset.state, "enter-offset");
  assert.deepEqual(withDesktopSend(enterOffset).desktop, SEND);
});

test("a Stellarium Web tab's screen gets it, so a sky can move to the desktop app", () => {
  assert.deepEqual(withDesktopSend(viewForSky(NY)).desktop, SEND);
});

test("a refusal or an astro.com screen doesn't", () => {
  const refused = viewFor({ kind: "refused", reason: "transit" });
  assert.equal(withDesktopSend(refused), refused);
  const astroCom = { state: "astro-com-fill", sky: NY, notes: [] };
  assert.equal(withDesktopSend(astroCom), astroCom);
});

test("sent: says what Stellarium was given, that its clock is paused, and about its time zone", () => {
  assert.deepEqual(viewForDesktopSend({ state: "sent" }, NY), {
    state: "desktop-sent",
    heading: "Sent to Stellarium Desktop",
    rows: [
      ["UTC", "2024-04-17 12:00"],
      ["Place", "40°43'N, 74°0'W"],
    ],
    notes: [
      "Stellarium's clock is paused at this moment. Its play button, or K, starts it again.",
      "Stellarium shows the time in its own time zone, which this doesn't change, so its clock may not show the birthplace's local time. The UTC above is the moment it was given.",
      "Stellarium names the place by its coordinates.",
    ],
    sky: NY,
    buttons: [{ label: "Done", does: "close" }],
    defaultChoice: { text: null, label: "Use Stellarium Desktop by default", does: "prefer-desktop" },
  });
});

// Choosing the default happens where it has just worked; the confirmation
// says where to change it back.
test("sent: choosing Stellarium Desktop as the default, then changing it back", () => {
  assert.deepEqual(viewForDesktopSend({ state: "sent" }, NY, { preferred: true, changed: true }).defaultChoice, {
    text: "Stellarium Desktop is now your default for charts. Every chart screen has a link to change it back.",
    label: "Undo",
    does: "prefer-web",
  });
  assert.deepEqual(viewForDesktopSend({ state: "sent" }, NY, { preferred: true }).defaultChoice, {
    text: "Stellarium Desktop is your default for charts.",
    label: "Make Stellarium Web the default",
    does: "prefer-web",
  });
  assert.deepEqual(viewForDesktopSend({ state: "sent" }, NY, { preferred: false, changed: true }).defaultChoice, {
    text: "Stellarium Web is the default again.",
    label: "Undo",
    does: "prefer-desktop",
  });
});

test("with Stellarium Desktop the default, a ready screen leads with it and Open Stellarium Web follows", () => {
  const view = viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" });
  const preferred = withDesktopSend(view, { preferred: true });
  assert.deepEqual(preferred.desktop, { ...SEND, primary: true });
  // Share… stays where viewFor put it, after Open Stellarium Web.
  assert.deepEqual(preferred.buttons, [
    { label: "Open Stellarium Web", opens: "stellarium", secondary: true },
    { label: "Share…", does: "share", secondary: true },
  ]);
  assert.deepEqual(preferred.defaultChoice, {
    text: "Stellarium Desktop is your default for charts.",
    label: "Make Stellarium Web the default",
    does: "prefer-web",
  });
});

test("an astro.com chart keeps Open chart in Astro-Seek as it was, and only Open Stellarium Web steps back", () => {
  const view = { state: "ready", sky: NY, notes: [], buttons: [{ label: "Open Stellarium Web", opens: "stellarium" }, { label: "Open chart in Astro-Seek", opens: "astro-seek" }] };
  assert.deepEqual(withDesktopSend(view, { preferred: true }).buttons, [
    { label: "Open Stellarium Web", opens: "stellarium", secondary: true },
    { label: "Open chart in Astro-Seek", opens: "astro-seek" },
  ]);
});

// Its main action is the Astro-Seek chart, so nothing moves; the line to
// change the default is there anyway, wherever the desktop button is.
test("a Stellarium Web tab keeps its buttons but shows the default line", () => {
  const view = withDesktopSend(viewForSky(NY), { preferred: true });
  assert.deepEqual(view.desktop, SEND);
  assert.equal(view.defaultChoice.does, "prefer-web");
});

test("just after switching back to Stellarium Web, the chart screen offers Undo", () => {
  const view = viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" });
  const switched = withDesktopSend(view, { preferred: false, changed: true });
  assert.deepEqual(switched.desktop, SEND);
  assert.equal(switched.buttons, view.buttons);
  assert.deepEqual(switched.defaultChoice, { text: "Stellarium Web is the default again.", label: "Undo", does: "prefer-desktop" });
});

test("with Stellarium Web the default, a chart screen has no default line", () => {
  const view = viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" });
  assert.equal(withDesktopSend(view).defaultChoice, undefined);
});

test("unreachable: the requested message, every setup step, and Try again", () => {
  const view = viewForDesktopSend({ state: "unavailable" }, NY);
  assert.equal(view.state, "desktop-problem");
  assert.equal(view.heading, "Stellarium Desktop isn't reachable");
  assert.equal(view.message, "Stellarium Desktop could not be reached. Open Stellarium and enable its Remote Control plugin.");
  assert.deepEqual(view.steps, SETUP_STEPS);
  assert.deepEqual(view.buttons, [{ label: "Try again", does: "send-to-desktop" }]);
  assert.equal(view.sky, NY);
});

// Checked against Stellarium 25.1's Remote Control settings window: its
// labels are "Server enabled", "Enable automatically on startup", "Port
// Number", "Access requires authentication" and "Save settings".
test("the setup steps name the plugin's own labels, in order", () => {
  const text = SETUP_STEPS.join("\n");
  const order = ["F2", "Plugins", "Remote Control", "Load at startup", "Quit Stellarium", "Configure", "Server enabled", "Enable automatically on startup", "8090", "Access requires authentication", "Save settings", "Try again"];
  let from = 0;
  for (const label of order) {
    const at = text.indexOf(label, from);
    assert.ok(at >= 0, `"${label}" after position ${from}`);
    from = at;
  }
});

test("unreachable: a note that the server is open to the network while it's on", () => {
  const { notes } = viewForDesktopSend({ state: "unavailable" }, NY);
  assert.ok(notes.some((note) => note.includes("other devices on your network")));
});

test("no permission: says what AstroChart Bridge asks for and where it connects", () => {
  const view = viewForDesktopSend({ state: "no-permission" }, NY);
  assert.equal(view.heading, "AstroChart Bridge needs your permission");
  assert.match(view.message, /127\.0\.0\.1/);
  assert.deepEqual(view.buttons, [{ label: "Try again", does: "send-to-desktop" }]);
  assert.equal(view.steps, undefined);
});

test("auth-required: how to turn the password off, since AstroChart Bridge doesn't use one", () => {
  const view = viewForDesktopSend({ state: "auth-required" }, NY);
  assert.equal(view.heading, "Stellarium asks for a password");
  for (const label of ["Access requires authentication", "Save settings", "Server enabled"]) assert.ok(view.message.includes(label), label);
});

test("another program on the port: nothing was sent", () => {
  const view = viewForDesktopSend({ state: "invalid-response" }, NY);
  assert.equal(view.heading, "Something else is using port 8090");
  assert.match(view.message, /sent nothing/);
});

test("a failed request keeps its code on screen", () => {
  const view = viewForDesktopSend({ state: "request-failed", code: "timeout" }, NY);
  assert.equal(view.heading, "Stellarium didn't finish the request");
  assert.equal(view.code, "timeout");
});

test("a mismatch names what Stellarium shows differently, and keeps the codes", () => {
  const view = viewForDesktopSend({ state: "mismatch", mismatches: ["time", "clock-running", "latitude"] }, NY);
  assert.equal(view.heading, "Stellarium didn't take the whole chart");
  assert.equal(view.message, "After sending, Stellarium's time, paused clock and latitude didn't match the chart. Try again, and check Stellarium isn't busy with a script.");
  assert.equal(view.code, "time,clock-running,latitude");
});

test("refusals: another planet, and dates AstroChart Bridge doesn't send", () => {
  assert.equal(
    viewForDesktopSend({ state: "refused", reason: "stellarium-not-earth" }, NY).message,
    "Stellarium's observer is on another planet. Choose a place on Earth in its Location window (F6), then try again.",
  );
  assert.equal(
    viewForDesktopSend({ state: "refused", reason: "stellarium-date-out-of-range" }, NY).message,
    "AstroChart Bridge sends Stellarium dates from 15 October 1582 to the year 9999.",
  );
});

test("an unknown state still shows a screen with its code", () => {
  const view = viewForDesktopSend({ state: "refused", reason: "something-new" }, NY);
  assert.equal(view.state, "desktop-problem");
  assert.equal(view.code, "something-new");
});

test("import: the sky Stellarium shows, opening in Astro-Seek or Stellarium Web, or entered in astro.com", () => {
  const view = viewForDesktopImport({ state: "connected", sky: NY });
  assert.equal(view.state, "from-desktop");
  assert.deepEqual(view.rows, [
    ["UTC", "2024-04-17 12:00"],
    ["Place", "40°43'N, 74°0'W"],
  ]);
  assert.deepEqual(view.buttons, [
    { label: "Open chart in Astro-Seek", opens: "astro-seek" },
    { label: "Save in Astro-Seek…", saves: { town: null, name: null }, secondary: true },
    { label: "Open Stellarium Web", opens: "stellarium", secondary: true },
  ]);
  assert.equal(view.sky, NY);
  assert.equal(view.next.label, "Enter in astro.com…");
  assert.ok(view.notes.some((note) => note.startsWith("If Stellarium's clock is running")));
  assert.ok(view.notes.some((note) => note.includes("stellarium-web.org")));
});

test("desktopHint: one line under the button for each probe result", () => {
  assert.equal(desktopHint({ state: "connected" }), "Stellarium Desktop is open and ready.");
  assert.equal(desktopHint({ state: "unavailable" }), "Stellarium Desktop isn't reachable right now. The button shows how to set it up.");
  assert.equal(desktopHint({ state: "auth-required" }), "Stellarium asks for a password, which AstroChart Bridge doesn't use. The button shows how to turn it off.");
  assert.equal(desktopHint({ state: "invalid-response" }), "Something other than Stellarium is answering on port 8090.");
  assert.equal(desktopHint({ state: "refused", reason: "stellarium-not-earth" }), "Stellarium's observer is on another planet.");
  assert.equal(desktopHint({ state: "request-failed", code: "timeout" }), "Stellarium Desktop didn't answer.");
});

// Before access is granted the popup doesn't check, so it has nothing to say.
test("desktopHint: no line without a check", () => {
  assert.equal(desktopHint(null), null);
});

test("the busy screens have no buttons", () => {
  for (const view of Object.values(BUSY)) assert.deepEqual(view.buttons, []);
});

test("import problems retry the import, and an out-of-range date reads as Stellarium's", () => {
  const view = viewForDesktopImport({ state: "unavailable" });
  assert.deepEqual(view.buttons, [{ label: "Try again", does: "import-from-desktop" }]);
  assert.deepEqual(view.steps, SETUP_STEPS);
  assert.equal(view.sky, null);
  assert.equal(
    viewForDesktopImport({ state: "refused", reason: "stellarium-date-out-of-range" }).message,
    "Stellarium is showing a date before 15 October 1582 or after the year 9999, which AstroChart Bridge can't read.",
  );
});
