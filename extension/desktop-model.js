// What the popup shows for Stellarium Desktop: the button that sends a chart
// there, and a screen for each result of stellarium-desktop.js's sendSky and
// readSky. Nothing connects until a button is clicked, so a screen that can't
// reach Stellarium explains how to set it up instead. The text is the chosen
// language's (messages/), read as each screen is built.
import { text } from "./messages/index.js";
import { astroComStep, astroSeekNotes, placeText, privacyNote, utcText, withAstroSeekSave } from "./popup-model.js";

// Every screen with a sky to open: a chart page's, once its UTC can be
// decided, and a Stellarium Web tab's. view.js keeps the button off until the
// sky is decided, like Open Stellarium Web.
const SENDS = new Set(["ready", "choose", "enter-offset", "to-astro-seek"]);

// The screens whose main button is Open Stellarium Web, which Stellarium Desktop takes
// over as the default. A Stellarium Web tab's main button is Astro-Seek's.
const OPENS_SKY = new Set(["ready", "choose", "enter-offset"]);

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
  const sends = { ...view, desktop: { label: text().desktop.send } };
  if (choice) sends.defaultChoice = choice;
  if (preferred && OPENS_SKY.has(view.state)) {
    sends.desktop.primary = true;
    sends.buttons = (view.buttons ?? [{ label: text().popup.buttons.openSky, opens: "stellarium" }]).map((button) =>
      button.opens === "stellarium" ? { ...button, secondary: true } : button,
    );
  }
  return sends;
}

// The line that says which is the default and changes it, or null where
// there's nothing to say: Stellarium Web as the default, unchanged, on a
// chart screen. The sent screen offers the change even then, as a button.
function defaultChoice({ preferred, changed, offer = false }) {
  const words = text().desktop;
  if (preferred && changed) return { text: words.nowDefault, label: words.undo, does: "prefer-web" };
  if (preferred) return { text: words.isDefault, label: words.makeWebDefault, does: "prefer-web" };
  if (changed) return { text: words.webDefaultAgain, label: words.undo, does: "prefer-desktop" };
  return offer ? { text: null, label: words.useByDefault, does: "prefer-desktop" } : null;
}

/**
 * The line to show under the desktop buttons once the popup has checked
 * Stellarium on opening, or null when the popup didn't check: it checks only
 * once AstroChart Bridge has access to 127.0.0.1. Every button stays
 * clickable: a click shows the full screen for whatever is wrong.
 *
 * @param {Awaited<ReturnType<typeof import("./stellarium-desktop.js").probe>> | null} result
 * @returns {string | null}
 */
export function desktopHint(result) {
  if (result === null) return null;
  const { hints, noAnswer } = text().desktop;
  const key = result.state === "refused" ? result.reason : result.state;
  return Object.hasOwn(hints, key) ? hints[key] : noAnswer;
}

// Shown while a request is on its way, without buttons. The plugin answers
// within milliseconds, or the request times out after three seconds.
export function busy() {
  const words = text().desktop;
  return {
    send: { state: "desktop-busy", message: words.sending, notes: [], buttons: [] },
    import: { state: "desktop-busy", message: words.reading, notes: [], buttons: [] },
  };
}

// How to turn on Stellarium's Remote Control plugin, in the settings window's own words.
export const setupSteps = () => [...text().desktop.setupSteps];

// Which failures show the setup steps and the network note.
const SETS_UP = new Set(["unavailable"]);

/**
 * What the popup shows after Send to Stellarium Desktop.
 *
 * @param {Awaited<ReturnType<typeof import("./stellarium-desktop.js").sendSky>> | { state: "no-permission" }} result
 * @param {{ utc: string, lat: number, lng: number }} sky  the sky that was sent
 * @param {{ preferred?: boolean, changed?: boolean }} [default_]  as for withDesktopSend
 */
export function viewForDesktopSend(result, sky, { preferred = false, changed = false } = {}) {
  if (result.state !== "sent") return problem(result, { retry: "send-to-desktop", direction: "send", sky });
  const words = text();
  return {
    state: "desktop-sent",
    heading: words.desktop.sentHeading,
    rows: [
      [words.popup.rows.utc, utcText(sky.utc)],
      [words.popup.rows.place, placeText(sky.lat, sky.lng)],
    ],
    notes: [...words.desktop.sentNotes],
    sky,
    buttons: [{ label: words.desktop.done, does: "close" }],
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
  const words = text();
  // The name of Stellarium's place, when it has one, goes to astro.com's and
  // Astro-Seek's forms as their town (townFromStatus).
  const { sky, town = null } = result;
  return withAstroSeekSave({
    state: "from-desktop",
    heading: words.desktop.fromHeading,
    rows: [
      [words.popup.rows.utc, utcText(sky.utc)],
      [words.popup.rows.place, placeText(sky.lat, sky.lng)],
      ...(town === null ? [] : [[words.popup.rows.town, town]]),
    ],
    notes: [words.desktop.pauseNote, ...astroSeekNotes(), privacyNote()],
    sky,
    buttons: [
      { label: words.popup.buttons.openInAstroSeek, opens: "astro-seek" },
      { label: words.popup.buttons.openSky, opens: "stellarium", secondary: true },
    ],
    next: astroComStep(sky, { town }),
  }, { town });
}

// A failure's screen, with Try again repeating what was clicked. A state
// with no text of its own shows the request-failed text and its code.
function problem(result, { retry, direction, sky }) {
  const words = text().desktop;
  const key = result.state === "refused" ? result.reason : result.state;
  const said = words.problems[key] ?? words.problems["request-failed"];
  const view = {
    state: "desktop-problem",
    heading: said.heading,
    message: typeof said.message === "object" ? said.message[direction] : said.message,
    notes: SETS_UP.has(key) ? [words.networkNote] : [],
    sky,
    buttons: [{ label: words.tryAgain, does: retry }],
  };
  if (SETS_UP.has(key)) view.steps = setupSteps();
  if (key === "mismatch") {
    view.message = words.mismatch(result.mismatches.map((code) => words.mismatchNames[code] ?? code));
    view.code = result.mismatches.join(",");
  } else if (result.code) {
    view.code = result.code;
  } else if (!Object.hasOwn(words.problems, key)) {
    view.code = key;
  }
  return view;
}
