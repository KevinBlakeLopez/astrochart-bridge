// What the popup shows for Stellarium Desktop: the button that sends a chart
// there, and a screen for each result of stellarium-desktop.js's sendSky and
// readSky. Nothing connects until a button is clicked, so a screen that can't
// reach Stellarium explains how to set it up instead.
import { astroComStep, astroSeekNotes, placeText, privacyNote, utcText, withAstroSeekSave } from "./popup-model.js";

// Every screen with a sky to open: a chart page's, once its UTC can be
// decided, and a Stellarium Web tab's. view.js keeps the button off until the
// sky is decided, like Open Stellarium Web.
const SENDS = new Set(["ready", "choose", "enter-offset", "to-astro-seek"]);

// The screens whose main button is Open Stellarium Web, which Stellarium Desktop takes
// over as the default. A Stellarium Web tab's main button is Astro-Seek's.
const OPENS_SKY = new Set(["ready", "choose", "enter-offset"]);

const DESKTOP_SEND = { label: "Send to Stellarium Desktop" };

/**
 * The view with a Send to Stellarium Desktop button, or the view unchanged.
 * With Stellarium Desktop the default, the button comes first in the main
 * style and Open Stellarium Web follows in the secondary one. Wherever it is the
 * default, a line under the buttons says so with a link to change it back;
 * just after a change, the line confirms it with Undo.
 *
 * @param {object} view  from viewFor or viewForSky
 * @param {{ preferred?: boolean, changed?: boolean }} [default_]
 *   preferred: Stellarium Desktop is the default; changed: the user has just switched
 */
export function withDesktopSend(view, { preferred = false, changed = false } = {}) {
  if (!SENDS.has(view.state)) return view;
  const choice = defaultChoice({ preferred, changed });
  const sends = { ...view, desktop: { ...DESKTOP_SEND } };
  if (choice) sends.defaultChoice = choice;
  if (preferred && OPENS_SKY.has(view.state)) {
    sends.desktop.primary = true;
    sends.buttons = (view.buttons ?? [{ label: "Open Stellarium Web", opens: "stellarium" }]).map((button) =>
      button.opens === "stellarium" ? { ...button, secondary: true } : button,
    );
  }
  return sends;
}

// The line that says which is the default and changes it, or null where
// there's nothing to say: Stellarium Web as the default, unchanged, on a
// chart screen. The sent screen offers the change even then, as a button.
function defaultChoice({ preferred, changed, offer = false }) {
  if (preferred && changed) {
    return {
      text: "Stellarium Desktop is now your default for charts. Every chart screen has a link to change it back.",
      label: "Undo",
      does: "prefer-web",
    };
  }
  if (preferred) return { text: "Stellarium Desktop is your default for charts.", label: "Make Stellarium Web the default", does: "prefer-web" };
  if (changed) return { text: "Stellarium Web is the default again.", label: "Undo", does: "prefer-desktop" };
  return offer ? { text: null, label: "Use Stellarium Desktop by default", does: "prefer-desktop" } : null;
}

// The line under the desktop buttons once the popup has checked Stellarium
// on opening, by probe's result. Every button stays clickable: a click shows
// the full screen for whatever is wrong.
const HINTS = {
  connected: "Stellarium Desktop is open and ready.",
  unavailable: "Stellarium Desktop isn't reachable right now. The button shows how to set it up.",
  "auth-required": "Stellarium asks for a password, which AstroChart Bridge doesn't use. The button shows how to turn it off.",
  "invalid-response": "Something other than Stellarium is answering on port 8090.",
  "stellarium-not-earth": "Stellarium's observer is on another planet.",
};

/**
 * The line to show under the desktop buttons, or null when the popup didn't
 * check: it checks only once AstroChart Bridge has access to 127.0.0.1.
 *
 * @param {Awaited<ReturnType<typeof import("./stellarium-desktop.js").probe>> | null} result
 * @returns {string | null}
 */
export function desktopHint(result) {
  if (result === null) return null;
  const key = result.state === "refused" ? result.reason : result.state;
  return HINTS[key] ?? "Stellarium Desktop didn't answer.";
}

// Shown while a request is on its way, without buttons. The plugin answers
// within milliseconds, or the request times out after three seconds.
export const BUSY = {
  send: { state: "desktop-busy", message: "Sending to Stellarium Desktop…", notes: [], buttons: [] },
  import: { state: "desktop-busy", message: "Reading Stellarium Desktop…", notes: [], buttons: [] },
};

// Stellarium 25.1, seen on 2026-11-01. The plugin loads only when Stellarium
// starts, which is why it has to be quit and opened again, and its server is
// off until ticked. The labels are the settings window's own.
export const SETUP_STEPS = [
  "Open Stellarium and press F2 (fn+F2 on many Mac keyboards) for its Configuration window.",
  "On the Plugins tab, select Remote Control and tick Load at startup.",
  "Quit Stellarium and open it again: the plugin loads only when Stellarium starts.",
  "Press F2 again, select Remote Control on the Plugins tab and click Configure.",
  "Tick Server enabled, and Enable automatically on startup so you don't have to next time. Leave Port Number at 8090 and Access requires authentication unticked, then click Save settings.",
  "Come back here and click Try again.",
];

// Stellarium's settings window shows the address it listens on, which is the
// computer's network address, not only this computer.
const NETWORK_NOTE =
  "While its server is on, other devices on your network can control Stellarium too. Untick Server enabled when you're done if that matters on this network.";

// What each failure says. Text with a direction differs between sending and importing.
const PROBLEMS = {
  unavailable: {
    heading: "Stellarium Desktop isn't reachable",
    message: "Stellarium Desktop could not be reached. Open Stellarium and enable its Remote Control plugin.",
    steps: SETUP_STEPS,
    notes: [NETWORK_NOTE],
  },
  "no-permission": {
    heading: "AstroChart Bridge needs your permission",
    message:
      "To reach Stellarium, AstroChart Bridge needs permission to connect to this computer at 127.0.0.1. It doesn't connect anywhere else, and only when you click.",
  },
  "auth-required": {
    heading: "Stellarium asks for a password",
    message:
      "AstroChart Bridge doesn't use Remote Control's password. In Stellarium's Remote Control settings, untick Access requires authentication and click Save settings, then untick and tick Server enabled to restart the server.",
  },
  "invalid-response": {
    heading: "Something else is using port 8090",
    message:
      "The program answering on port 8090 isn't Stellarium's Remote Control, so AstroChart Bridge sent nothing. Quit that program, then untick and tick Server enabled in Stellarium's Remote Control settings.",
  },
  "request-failed": {
    heading: "Stellarium didn't finish the request",
    message: "Stellarium's Remote Control didn't answer as expected. Check Stellarium is open and responding, then try again.",
  },
  "stellarium-not-earth": {
    heading: "Stellarium isn't on Earth",
    message: "Stellarium's observer is on another planet. Choose a place on Earth in its Location window (F6), then try again.",
  },
  "stellarium-date-out-of-range": {
    heading: "This date can't go to Stellarium",
    message: {
      send: "AstroChart Bridge sends Stellarium dates from 15 October 1582 to the year 9999.",
      import: "Stellarium is showing a date before 15 October 1582 or after the year 9999, which AstroChart Bridge can't read.",
    },
  },
  mismatch: {
    heading: "Stellarium didn't take the whole chart",
  },
};

const MISMATCH_NAMES = { time: "time", "clock-running": "paused clock", latitude: "latitude", longitude: "longitude" };

/**
 * What the popup shows after Send to Stellarium Desktop.
 *
 * @param {Awaited<ReturnType<typeof import("./stellarium-desktop.js").sendSky>> | { state: "no-permission" }} result
 * @param {{ utc: string, lat: number, lng: number }} sky  the sky that was sent
 * @param {{ preferred?: boolean, changed?: boolean }} [default_]  as for withDesktopSend
 */
export function viewForDesktopSend(result, sky, { preferred = false, changed = false } = {}) {
  if (result.state !== "sent") return problem(result, { retry: "send-to-desktop", direction: "send", sky });
  return {
    state: "desktop-sent",
    heading: "Sent to Stellarium Desktop",
    rows: [
      ["UTC", utcText(sky.utc)],
      ["Place", placeText(sky.lat, sky.lng)],
    ],
    notes: [
      "Stellarium's clock is paused at this moment. Its play button, or K, starts it again.",
      "Stellarium shows the time in its own time zone, which this doesn't change, so its clock may not show the birthplace's local time. The UTC above is the moment it was given.",
      "Stellarium names the place by its coordinates.",
    ],
    sky,
    buttons: [{ label: "Done", does: "close" }],
    defaultChoice: defaultChoice({ preferred, changed, offer: true }),
  };
}

/**
 * What the popup shows after Import from Stellarium Desktop: the sky it is
 * showing, to open in Astro-Seek or Stellarium Web or enter in astro.com.
 *
 * @param {Awaited<ReturnType<typeof import("./stellarium-desktop.js").readSky>> | { state: "no-permission" }} result
 */
export function viewForDesktopImport(result) {
  if (result.state !== "connected") return problem(result, { retry: "import-from-desktop", direction: "import", sky: null });
  // The name of Stellarium's place, when it has one, goes to astro.com's and
  // Astro-Seek's forms as their town (townFromStatus).
  const { sky, town = null } = result;
  return withAstroSeekSave({
    state: "from-desktop",
    heading: "From Stellarium Desktop",
    rows: [
      ["UTC", utcText(sky.utc)],
      ["Place", placeText(sky.lat, sky.lng)],
      ...(town === null ? [] : [["Town", town]]),
    ],
    notes: [
      "If Stellarium's clock is running, pause it and import again, so the chart is the moment you chose.",
      ...astroSeekNotes(),
      privacyNote(),
    ],
    sky,
    buttons: [
      { label: "Open chart in Astro-Seek", opens: "astro-seek" },
      { label: "Open Stellarium Web", opens: "stellarium", secondary: true },
    ],
    next: astroComStep(sky, { town }),
  }, { town });
}

// A failure's screen, with Try again repeating what was clicked. A state
// with no text of its own shows the request-failed text and its code.
function problem(result, { retry, direction, sky }) {
  const key = result.state === "refused" ? result.reason : result.state;
  const text = PROBLEMS[key] ?? PROBLEMS["request-failed"];
  const view = {
    state: "desktop-problem",
    heading: text.heading,
    message: typeof text.message === "object" ? text.message[direction] : text.message,
    notes: [...(text.notes ?? [])],
    sky,
    buttons: [{ label: "Try again", does: retry }],
  };
  if (text.steps) view.steps = [...text.steps];
  if (key === "mismatch") {
    view.message = `After sending, Stellarium's ${listed(result.mismatches.map((code) => MISMATCH_NAMES[code] ?? code))} didn't match the chart. Try again, and check Stellarium isn't busy with a script.`;
    view.code = result.mismatches.join(",");
  } else if (result.code) {
    view.code = result.code;
  } else if (!Object.hasOwn(PROBLEMS, key)) {
    view.code = key;
  }
  return view;
}

// ["time", "latitude", "longitude"] → "time, latitude and longitude"
const listed = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
