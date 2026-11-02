import { formTime, localOffset, zoneWords } from "./core/astrocom.js";
import { astroSeekSaveUrl, astroSeekUrl } from "./core/astroseek.js";
import { parseOffset, utcFromOffset } from "./core/civiltime.js";
import { toPortable } from "./core/portable.js";
import { HOLD_MINUTES } from "./pending.js";

const CLOCK_NOTE = "Stellarium Web's clock shows your computer's time zone and keeps running.";

// Seen on 2026-10-31: stellarium-web.org's Google Ads tag sent the full link,
// date and coordinates included, as its url= parameter.
export const PRIVACY_NOTE =
  "Opening the sky sends this date, time and place to stellarium-web.org, and its page passes the link on to Google's advertising tags.";

// Shown on the choose and enter-offset screens, the privacy note last, just above
// Open Stellarium Web. The ready screen knows its UTC, so it names the exact clock time instead.
const NOTES = [CLOCK_NOTE, PRIVACY_NOTE];

const RUNNING = "The clock starts running at once; its pause button stops it.";

// A refusal's code says which site it came from (transit and synastry only
// from Astro-Seek; databank and the four after it only from astro.com), so
// each message can name its site without being told it.
const REFUSALS = {
  transit: "This is a transit chart. AstroChart Bridge opens natal charts only.",
  synastry: "This is a synastry or compatibility chart. AstroChart Bridge opens natal charts only.",
  unsupported: "Open an Astro-Seek or astro.com birth chart to use AstroChart Bridge.",
  databank: "Astro-Databank charts aren't supported yet. AstroChart Bridge opens charts saved in your astro.com account.",
  "unsupported-chart": "AstroChart Bridge can't read this kind of astro.com chart yet.",
  "no-drawing-link":
    "This astro.com page has no \"Drawing (for subscribers)\" link, which is where AstroChart Bridge reads the birth data.",
  "local-mean-time": "This chart uses local mean time, which AstroChart Bridge can't open yet.",
  "calendar-unsupported":
    "This astro.com chart is dated before the Gregorian calendar began on 15 October 1582. AstroChart Bridge reads Gregorian dates only.",
  "page-url-mismatch": "The page doesn't match its address. Reload the chart and try again.",
  "stellarium-unreadable": "AstroChart Bridge couldn't read the sky from this Stellarium Web tab.",
};

// Every other refusal means the chart page couldn't be read. They share one
// message and show their code, so a bug report says which check failed.
const UNREADABLE = "AstroChart Bridge couldn't read this chart page.";

// A transit or compatibility chart isn't a birth chart, so a screenshot or
// copy of it wouldn't help.
const NOT_A_BIRTH_CHART = new Set(["transit", "synastry"]);

/**
 * Whether a refused page's screen also offers the other ways in: a
 * screenshot, pasted text, a chart file or Stellarium Desktop. A chart page
 * AstroChart Bridge couldn't read still has its birth data on screen.
 *
 * @param {{ kind: "refused", reason: string }} result
 */
export function offersOtherWays(result) {
  return !NOT_A_BIRTH_CHART.has(result.reason);
}

// The other ways in, in labelled groups as a chart screen's actions are. Each
// button opens one of the extension's pages in a tab, or names what it does.
// The buttons keep their verbs, so each says what it does without its label.
export const OTHER_WAYS = [
  {
    label: "Read a chart you have",
    buttons: [
      { label: "Read a screenshot", page: "screenshot.html" },
      { label: "Paste chart text", page: "paste.html" },
      { label: "Open an AAF or Morinus file", page: "import.html" },
      { label: "Open an AstroChart Bridge file", page: "chart.html" },
    ],
  },
  {
    label: "Or use the sky in Stellarium Desktop",
    buttons: [{ label: "Import from Stellarium Desktop", does: "import-from-desktop" }],
  },
];

// The popup's chart screens offer the other ways in too, for a different
// chart than the page's, in a box that stays closed until it's opened.
export function withOtherWays(view) {
  return { ...view, more: { label: "Read a different chart", groups: OTHER_WAYS } };
}

const WARNINGS = {
  "zone-label-unknown": ({ zoneLabel }) =>
    zoneLabel === null
      ? "Astro-Seek printed no zone label, so its Universal Time is used as printed."
      : `Astro-Seek's zone label "${abbreviation(zoneLabel)}" isn't one AstroChart Bridge can check, so its Universal Time is used as printed.`,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * What the popup shows for an analyzePage result. Every decision about the
 * screen is made here, so popup.js only renders it.
 *
 * @param {ReturnType<typeof import("./core/index.js").analyzePage>} result
 * @param {{ timeZone?: string, town?: string | null }} [options]  timeZone is the
 *   computer's time zone; when left out, Intl uses the one this code runs in,
 *   which the popup shares with the Stellarium tab. Tests pass it so they give
 *   the same result anywhere. town is the one the chart's page names, for
 *   astro.com's form.
 */
export function viewFor(result, { timeZone, town = null } = {}) {
  if (result.kind === "refused") {
    return Object.hasOwn(REFUSALS, result.reason)
      ? { state: "refused", message: REFUSALS[result.reason] }
      : { state: "refused", message: UNREADABLE, code: result.reason };
  }

  const { local, zoneLabel, lat, lng } = result;
  const localRow = ["Local time", localText(local, zoneLabel)];
  const placeRow = ["Place", placeText(lat, lng)];
  const sky = (utc) => ({ utc, lat, lng });

  if (result.utcSource === "needs-choice") {
    const label = abbreviation(zoneLabel);
    const printed = result.candidates.find((candidate) => candidate.basis === "printed UT");
    return {
      state: "choose",
      rows: [localRow, placeRow],
      message:
        `Astro-Seek's page contradicts itself: it labels ${local.slice(11, 16)} as ${label}, ` +
        `but its Universal Time implies ${offsetText(printed.offsetMinutes)}.`,
      choices: result.candidates.map((candidate) => ({
        label:
          `${utcText(candidate.utc)} UTC, ` +
          `${candidate === printed ? "as Astro-Seek printed" : `as the label ${label} says`} ` +
          `(${offsetText(candidate.offsetMinutes)})`,
        sky: sky(candidate.utc),
      })),
      notes: [...NOTES],
      buttons: chartButtons([OPEN_SKY_BUTTON]),
    };
  }

  if (result.utcSource === "needs-offset") {
    return {
      state: "enter-offset",
      rows: [localRow, placeRow],
      message: "Astro-Seek didn't print a Universal Time. Enter the UTC offset at the birth place, as ±HH:MM.",
      notes: [...NOTES],
      chart: { local, lat, lng },
      buttons: chartButtons([OPEN_SKY_BUTTON]),
    };
  }

  const ready = {
    state: "ready",
    rows: [localRow, ["Offset", offsetText(result.offsetMinutes)], ["UTC", utcText(result.utc)], placeRow],
    warnings: (result.warnings ?? []).map((code) => WARNINGS[code]?.(result) ?? code),
    notes: [clockNote(result.utc, local, timeZone), PRIVACY_NOTE],
    sky: sky(result.utc),
    buttons: chartButtons([OPEN_SKY_BUTTON]),
  };
  // An astro.com chart can also open in Astro-Seek, and be saved there with the
  // name and town its page's record gives. An Astro-Seek page already shows
  // its chart there, and leads to the values to enter in astro.com instead.
  if (result.site === "astro-com") {
    return withAstroSeekSave(
      { ...ready, notes: [...ready.notes, ...ASTRO_SEEK_NOTES], buttons: chartButtons(ASTRO_SEEK_BUTTONS) },
      { town: result.town ?? null, name: result.name ?? null },
    );
  }
  return result.site === "astro-seek" ? { ...ready, next: astroComStep(ready.sky, { town, local }) } : ready;
}

/**
 * The UTC preview for what the user typed in the offset field, or null while
 * it isn't a valid ±HH:MM offset.
 *
 * @param {{ chart: { local: string, lat: number, lng: number } }} view  an enter-offset view
 * @param {string} text
 */
export function offsetPreview(view, text) {
  const minutes = parseOffset(text.trim());
  if (minutes === null) return null;
  const { local, lat, lng } = view.chart;
  const utc = utcFromOffset(local, minutes);
  return { utcText: utcText(utc), sky: { utc, lat, lng } };
}

// Shown wherever a button opens an Astro-Seek chart: here and on the screenshot page.
export const ASTRO_SEEK_NOTES = [
  "Astro-Seek will draw this chart in UT/GMT at these coordinates, rounded to the minute, with no city.",
  "Opening the chart sends this date, time and place to astro-seek.com.",
];

// The buttons of a screen whose chart can also open in Astro-Seek. Both open the
// same decided UTC and place: Astro-Seek's chart in UT/GMT, as from a Stellarium tab.
export const ASTRO_SEEK_BUTTONS = [
  { label: "Open Stellarium Web", opens: "stellarium" },
  { label: "Open chart in Astro-Seek", opens: "astro-seek" },
];

const OPEN_SKY_BUTTON = { label: "Open Stellarium Web", opens: "stellarium" };

export const ASTRO_SEEK_SAVE_LABEL = "Save in Astro-Seek…";

// Shown wherever Save in Astro-Seek… is offered, in place of Open chart in
// Astro-Seek's note on what it sends. One note for both keeps the popup's
// astro.com screen under the 600px a popup is shown at. For a chart without a
// name or town it takes one line, as Open chart in Astro-Seek's did; an
// astro.com chart's record usually has both, and its two lines bring that
// screen to 598px at 440px wide, measured 2026-11-02 with main's spacing. The
// browser's own prompt says that saving asks for access, and the box under
// Birth city that Gender and Add person are the person's.
export const ASTRO_SEEK_SAVE_NOTE = "Opening or saving sends this date, time and place to astro-seek.com.";
export const ASTRO_SEEK_SAVE_NAMED_NOTE =
  "Opening or saving sends this date, time and place to astro-seek.com; saving also sends the chart's name and town, if it has them.";
const ASTRO_SEEK_OPEN_NOTE = ASTRO_SEEK_NOTES[1];

/**
 * A screen with Open chart in Astro-Seek, with Save in Astro-Seek… right
 * after it, and its note in place of Open chart in Astro-Seek's, or last.
 * The button saves the chart in the signed-in account's private astro
 * database (astro-seek-open.js), so only the popup and the extension's own
 * pages offer it, not the shared chart page, which is also a website. Like
 * Open chart in Astro-Seek, it waits for the screen to decide the sky. A
 * screen built on one that has them, such as a screenshot of an astro.com
 * chart on the popup's astro.com screen, isn't given them twice.
 *
 * @param {object} view  with a button that opens "astro-seek"
 * @param {{ town?: string | null, name?: { first: string, last: string } | null }} [chart]
 *   the chart's town and name, for the form's Birth city and Name
 */
export function withAstroSeekSave(view, { town = null, name = null } = {}) {
  const saves = { town, name: nickFor(name) };
  const button = { label: ASTRO_SEEK_SAVE_LABEL, saves, secondary: true };
  const at = view.buttons.findIndex(({ opens }) => opens === "astro-seek") + 1;
  const note = saves.town === null && saves.name === null ? ASTRO_SEEK_SAVE_NOTE : ASTRO_SEEK_SAVE_NAMED_NOTE;
  const notes = view.notes.includes(ASTRO_SEEK_OPEN_NOTE)
    ? view.notes.map((each) => (each === ASTRO_SEEK_OPEN_NOTE ? note : each))
    : [...view.notes, note];
  const noted = view.notes.includes(ASTRO_SEEK_SAVE_NOTE) || view.notes.includes(ASTRO_SEEK_SAVE_NAMED_NOTE);
  return {
    ...view,
    notes: noted ? view.notes : notes,
    buttons: view.buttons.some(({ saves }) => saves) ? view.buttons : [...view.buttons.slice(0, at), button, ...view.buttons.slice(at)],
  };
}

// Astro-Seek's form has one Name field, so a name's two parts go in it as one.
function nickFor(name) {
  const nick = [name?.first ?? "", name?.last ?? ""].map((part) => part.trim()).filter(Boolean).join(" ");
  return nick === "" ? null : nick;
}

// Shown while Astro-Seek's form opens behind the popup.
export const ASTRO_SEEK_SAVE_BUSY = { state: "astro-seek-busy", message: "Opening Astro-Seek's Add person form…", notes: [], buttons: [] };

// What the screen says when the form isn't left filled in, by openAndSave's
// outcome, or its page for "not-filled".
const SAVE_MESSAGES = {
  "signed-out": "Astro-Seek shows you signed out, and saves a chart only in an account. Sign in in its tab, then click Save in Astro-Seek… again.",
  elsewhere: "Astro-Seek didn't show its Add person form. If it asks you to sign in, sign in, then click Save in Astro-Seek… again.",
  "not-loaded": "Astro-Seek's form didn't finish opening in time, so AstroChart Bridge didn't choose its town.",
  "city-typed": "Astro-Seek's form already had a Birth city, so AstroChart Bridge left it as it was.",
  unrecognised: "AstroChart Bridge didn't recognise Astro-Seek's form, so it didn't choose its town.",
};

// What the person checks before Add person in a form AstroChart Bridge
// didn't finish: choosing a city may change the coordinates and time zone.
const CHECK_NOTE = "Before Add person, choose the Birth city in Astro-Seek's list if it isn't, then check that the coordinates and UT/GMT are still the chart's.";

/**
 * Save in Astro-Seek… when it didn't leave the form filled in: declined
 * access to www.astro-seek.com, a signed-out browser, or a form it couldn't
 * finish. Declined, a button opens the form anyway, filled in as far as its
 * address goes; otherwise a button goes to the tab it opened.
 *
 * @param {{ outcome: "declined" | "signed-out" } | { outcome: "not-filled", page: keyof typeof SAVE_MESSAGES }} result
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {{ town: string | null, name: string | null }} saves  the button's
 */
export function viewForAstroSeekSave(result, sky, saves) {
  if (result.outcome === "declined") {
    return {
      state: "astro-seek-manual",
      message: "AstroChart Bridge can't choose the town in Astro-Seek's form without access to www.astro-seek.com.",
      notes: [`The form opens with this date, time and place in UT/GMT${saves.name ? ", and the name" : ""}. ${CHECK_NOTE}`],
      sky,
      buttons: [{ label: "Open Astro-Seek's form", url: astroSeekSaveUrl(sky, { name: saves.name }) }],
    };
  }
  const page = result.outcome === "signed-out" ? "signed-out" : result.page;
  const signIn = page === "signed-out" || page === "elsewhere";
  return {
    state: "astro-seek-not-filled",
    message: SAVE_MESSAGES[page] ?? SAVE_MESSAGES.unrecognised,
    notes: signIn ? [] : [CHECK_NOTE],
    sky,
    buttons: [{ label: "Go to the Astro-Seek tab", does: "show-tab" }],
  };
}

// Opens the receiving page in a tab, with the chart in its link, to copy the
// link or download the file. Offered on every screen with a chart of its own;
// like Open Stellarium Web, it waits for a reading or offset to decide the UTC. A
// Stellarium tab has no birthplace time, so its screen doesn't offer it.
export const SHARE_BUTTON = { label: "Share…", does: "share", secondary: true };

// A screen's buttons, then Share…, as copies the caller can change.
const chartButtons = (buttons) => [...buttons, SHARE_BUTTON].map((button) => ({ ...button }));

// The labels over a screen's two kinds of action, when it has both.
export const GROUP_LABELS = { sky: "See the sky", elsewhere: "Take the chart elsewhere" };

/**
 * The order view.js draws a screen's actions in, in labelled groups. The ways
 * to see the sky, Open Stellarium Web and Send to Stellarium Desktop, go under
 * See the sky, with the line that says which is the default. Every other
 * action goes under Take the chart elsewhere: Share…, Open chart in
 * Astro-Seek, the AAF file and the astro.com step among them. The group with
 * the screen's main button comes first.
 *
 * A screen without both kinds is one group with no label, in the order it
 * always had. The default line alone doesn't count as a way to see the sky:
 * the sent screen has it beside Done.
 *
 * Send to Stellarium Desktop comes first when it is the user's default, and
 * otherwise right after Open Stellarium Web, or last on a screen without it.
 *
 * @param {object} view  from viewFor, viewForSky and the like, with withDesktopSend's desktop
 * @returns {{ label: string | null, actions: object[] }[]}  each action is
 *   { kind: "button", button } for one of the view's buttons, or { kind } of
 *   "url" (the view's own link), "desktop", "default-choice", "download" or "next"
 */
export function actionGroups(view) {
  const actions = view.url ? [{ kind: "url" }] : (view.buttons ?? [OPEN_SKY_BUTTON]).map((button) => ({ kind: "button", button }));
  if (view.desktop) {
    const send = { kind: "desktop" };
    const web = actions.findIndex(({ button }) => button?.opens === "stellarium");
    if (view.desktop.primary) actions.unshift(send);
    else actions.splice(web === -1 ? actions.length : web + 1, 0, send);
  }
  if (view.defaultChoice) actions.push({ kind: "default-choice" });
  if (view.download) actions.push({ kind: "download" });
  if (view.next) actions.push({ kind: "next" });

  const sky = actions.filter((action) => opensSky(action) || action.kind === "default-choice");
  const elsewhere = actions.filter((action) => !sky.includes(action));
  if (!actions.some(opensSky) || elsewhere.length === 0) return [{ label: null, actions }];
  const groups = [
    { label: GROUP_LABELS.sky, actions: sky },
    { label: GROUP_LABELS.elsewhere, actions: elsewhere },
  ];
  return opensSky(actions[0]) ? groups : groups.reverse();
}

const opensSky = ({ kind, button }) => kind === "desktop" || button?.opens === "stellarium";

// How each candidate on the choose screen was worked out, by its basis.
const CHOICE_BASES = { "printed UT": "printed" };

/**
 * The portable chart for a screen's result and the sky its buttons open: the
 * result's, or the one decided by a reading or an offset.
 *
 * @param {ReturnType<typeof import("./core/index.js").analyzePage>} result  a natal result
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {"page" | "screenshot"} via
 * @returns {ReturnType<typeof toPortable>}
 */
export function chartToShare(result, sky, via) {
  return toPortable(
    { local: result.local, utc: sky.utc, lat: sky.lat, lng: sky.lng },
    { site: result.site, via, zoneLabel: result.zoneLabel ?? undefined, utcBasis: utcBasis(result, sky) },
  );
}

// "printed" or "declared" as the result says, "printed" or "zone-label" for
// the reading picked, "entered" for a typed offset.
function utcBasis(result, sky) {
  if (result.utcSource === "needs-offset") return "entered";
  if (result.utcSource === "needs-choice") {
    const choice = result.candidates.find((candidate) => candidate.utc === sky.utc);
    return choice && (CHOICE_BASES[choice.basis] ?? "zone-label");
  }
  return result.utcSource;
}

/**
 * What the popup shows when chartToShare refuses. Cancel goes back to the
 * chart, which still opens as before.
 *
 * @param {string} reason
 */
export function viewForShareRefusal(reason) {
  return {
    state: "share-refused",
    message:
      reason === "before-gregorian"
        ? "AstroChart Bridge can't share a chart dated before 15 October 1582 yet: it can't tell which calendar the date is in."
        : "AstroChart Bridge can't share this chart.",
    code: reason,
    notes: [],
    buttons: [],
  };
}

/**
 * What the popup shows on a Stellarium Web tab: the sky it is showing, and a
 * button that opens the same moment and place as an Astro-Seek chart.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky  from skyFromEngine
 * @param {{ timeZone?: string, town?: string | null }} [options]  as for viewFor
 */
export function viewForSky(sky, { timeZone, town = null } = {}) {
  const clock = clockParts(sky.utc, timeZone);
  return {
    state: "to-astro-seek",
    rows: [
      [
        "Stellarium time",
        `${timeOnDay(`${clock.hour}:${clock.minute}`, clock.month, clock.day)} ${clock.year}, your computer's time`,
      ],
      ["UTC", utcText(sky.utc)],
      ["Place", placeText(sky.lat, sky.lng)],
    ],
    notes: [...ASTRO_SEEK_NOTES],
    button: "Open chart in Astro-Seek",
    url: astroSeekUrl(sky),
    next: astroComStep(sky, { town }),
  };
}

// astro.com's pages, as seen signed out on 2026-11-01. Its birth data form
// (ade.cgi) is posted, asks for a country and town for its atlas to look up,
// has no coordinate fields, and offers "00:00 GMT / UT" among the time zones
// in its extended settings. This screen can't tell whether the browser is
// signed in. Each button keeps the values for the tab it opens. The form
// button also asks for access to www.astro.com and, given it, fills the form
// in as it opens (astro-com-open.js); without it, the popup on that tab fills
// it in: viewForAstroComTab.
const FORM_URL = "https://www.astro.com/cgi/ade.cgi";
const SIGN_IN_URL = "https://www.astro.com/cgi/awd.cgi?lang=e";
const CREATE_ACCOUNT_URL = "https://www.astro.com/cgi/scus.cgi?act=new&";

// holds is what each keeps for the tab it opens; fills asks for access and fills it in.
const ASTRO_COM_BUTTONS = [
  { label: "Open astro.com's form", url: FORM_URL, fills: true },
  { label: "Sign in", url: SIGN_IN_URL },
  { label: "Create account", url: CREATE_ACCOUNT_URL },
];

// astro.com's form has no coordinate fields: its atlas looks up a typed town.
const townNote = (town) =>
  town === null
    ? "astro.com asks for a country and town, not coordinates. Choose the town nearest this place and check the coordinates astro.com shows."
    : `astro.com asks for a country and town, not coordinates. AstroChart Bridge fills in the town ${town}; choose the match nearest this place and check the coordinates astro.com shows.`;

// The sign-in advice is a note, not a step before the form: a signed-in browser
// goes straight on.
const ASTRO_COM_NOTES = [
  "astro.com draws the chart only for a signed-in account. If it asks you to sign in or create a free account, do it in that tab: AstroChart Bridge keeps these values for it.",
  `AstroChart Bridge keeps them for ${HOLD_MINUTES} minutes, until it fills them in, or until you cancel or close the browser. Filling in puts them in astro.com's page, and its town search sends a town to astro.com at once; submitting sends the rest.`,
  "The first time, your browser asks to let AstroChart Bridge read and change www.astro.com pages. It uses that only to fill in the form in the tab it opens. If you say no, it shows the values to fill in yourself.",
];

// The step after the form button that both ways back to the toolbar icon name.
const TOOLBAR_STEP = "click the AstroChart Bridge icon in the toolbar again to fill in the form.";

// Shown while the form opens behind the popup.
export const ASTRO_COM_BUSY = { state: "astro-com-busy", message: "Opening astro.com's form to fill it in…", notes: [], buttons: [] };

/**
 * The two-click way, when the user declined access to www.astro.com: the
 * values, and a button that only keeps them for the tab it opens.
 *
 * @param {{ utc: string | null, lat: number, lng: number, local: string | null, town: string | null }} values
 */
export function viewForAstroComManual(values) {
  return {
    state: "astro-com-manual",
    ...astroComValues(values),
    message: "AstroChart Bridge can't fill in the form without access to www.astro.com.",
    notes: [...zoneNotes(values), `After the astro.com tab opens, ${TOOLBAR_STEP}`],
    sky: { utc: values.utc, lat: values.lat, lng: values.lng },
    buttons: [{ label: "Open astro.com's form", url: FORM_URL, holds: { ...values } }],
  };
}

/**
 * The form opened but couldn't be filled in: it didn't load in time, or ended
 * up on another page. On the screenshot page, also a form that needs a choice
 * first, which the popup on its tab offers. Its values are kept for its tab.
 *
 * @param {{ utc: string | null, lat: number, lng: number, local: string | null, town: string | null }} values
 * @param {"not-filled" | "choose"} [outcome]  openAndFill's
 */
export function viewForAstroComNotFilled(values, outcome = "not-filled") {
  return {
    state: "astro-com-not-filled",
    ...astroComValues(values),
    message:
      outcome === "choose"
        ? "astro.com's form is open, but something needs your choice first, such as signing in."
        : "astro.com's form didn't finish opening, so AstroChart Bridge couldn't fill it in yet.",
    notes: [...zoneNotes(values), `Switch to the astro.com tab, then ${TOOLBAR_STEP}`],
    sky: { utc: values.utc, lat: values.lat, lng: values.lng },
    buttons: [{ label: "Go to the astro.com tab", does: "show-tab" }],
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// astro.com's first and last name fields, sfnm and snam, each have a maxlength
// of 40, as seen signed out on 2026-11-01.
export const NAME_LENGTH = 40;

const NAME_NOTE =
  "The name goes in astro.com's first and last name fields, and you can change it here first. A name in one piece goes in First name, which astro.com won't save a chart without.";

/**
 * The name for astro.com's form from a chart that keeps it as one string, as
 * pasted text and Morinus do: all of it is the first name, since astro.com's
 * form refuses a chart with no first name ("Please write something as 'first
 * name'", seen on 2026-11-01). Runs of spaces become one, as a person would type it.
 *
 * @param {string | null | undefined} text
 * @returns {{ first: string, last: "" } | null}
 */
export function nameFromText(text) {
  const first = text?.replace(/\s+/g, " ").trim() ?? "";
  return first === "" ? null : { first, last: "" };
}

/**
 * The name the boxes on the astro.com screen give, in place of the one the
 * buttons kept: each part trimmed, and no name when both are empty.
 *
 * @param {object} holds  a button's holds
 * @param {{ first: string, last: string }} typed  the boxes' text
 */
export function withName(holds, { first, last }) {
  const name = { first: first.trim(), last: last.trim() };
  return { ...holds, name: name.first === "" && name.last === "" ? null : name };
}

/**
 * Why the boxes' text won't fit astro.com's name fields, or null, for the line
 * under the boxes. A box can't take more than NAME_LENGTH characters typed,
 * but a name read from a chart can arrive longer.
 *
 * @param {{ first: string, last: string }} typed
 */
export function nameWarning({ first, last }) {
  const long = [["First name", first], ["Last name", last]].filter(([, text]) => text.trim().length > NAME_LENGTH);
  if (long.length === 0) return null;
  return `astro.com's name fields take ${NAME_LENGTH} characters. Shorten ${long.map(([label]) => label).join(" and ")} here, or astro.com may cut it short.`;
}

// The secondary button on a screen whose chart can be entered in astro.com.
export const astroComStep = (sky, chart = {}) => ({ label: "Enter in astro.com…", view: viewForAstroCom(sky, chart) });

/**
 * The values to enter in astro.com's birth data form for a decided UTC and
 * place, in the form's own terms, and links to the form and to signing in.
 *
 * @param {{ utc: string | null, lat: number, lng: number }} sky
 * @param {{ local?: string | null, town?: string | null, name?: { first: string, last: string } | null }} [chart]
 *   the local time, town and name the chart gives, filled in with the rest. A
 *   sky with no local time, such as Stellarium's, goes in as Universal Time.
 *   One with no UTC, pasted with no offset, has a local time for astro.com's
 *   automatic time zone.
 */
export function viewForAstroCom({ utc, lat, lng }, { local = null, town = null, name = null } = {}) {
  const sky = { utc, lat, lng };
  const held = { ...sky, local, town, name };
  return {
    state: "to-astro-com",
    // The name is in its boxes, not the rows, so it shows once.
    ...astroComValues({ ...held, name: null }),
    message: "AstroChart Bridge opens astro.com's form and fills it in as it opens. It doesn't submit the form.",
    nameBoxes: [
      { part: "first", label: "First name", text: name?.first ?? "" },
      { part: "last", label: "Last name", text: name?.last ?? "" },
    ],
    notes: [
      // A local time that is Universal Time needs no note.
      ...(local === null ? ["The date and time are Universal Time, so they can differ from the local birth date and time."] : []),
      ...zoneNotes(held),
      townNote(town),
      NAME_NOTE,
      ...ASTRO_COM_NOTES,
    ],
    sky,
    buttons: ASTRO_COM_BUTTONS.map((button) => ({ ...button, holds: { ...held } })),
  };
}

// The buttons of the screens on an astro.com tab. A button with does is an
// action popup.js takes on the tab; one with here opens its link in the tab
// itself, so the values kept for the tab stay with it.
const CANCEL = { label: "Cancel", does: "release", secondary: true };
const BLANK_FORM = { label: "Open a blank form", url: FORM_URL, here: true };

// What the popup shows on a form it won't fill in, by readFormPage's form.
// Every one keeps the values on screen to type in by hand.
const UNFILLABLE = {
  typed: {
    state: "astro-com-typed",
    message: "This form already has a date or time in it. AstroChart Bridge fills in only a blank form, so it won't change what's there.",
    buttons: [BLANK_FORM, CANCEL],
  },
  unrecognised: {
    state: "astro-com-unrecognised",
    message: "AstroChart Bridge doesn't recognise this astro.com form, so it can't fill it in. Enter the values above yourself.",
    code: "unrecognised-form",
    buttons: [CANCEL],
  },
};

/**
 * What the popup shows on an astro.com tab AstroChart Bridge keeps values for.
 * Nothing here happens without a click: the form is filled in only by its
 * button, and no page is opened on the tab's behalf, so a failed sign-in can't
 * start a loop. A browser not seen signed out may be signed in, so it is never
 * held up by a sign-in prompt.
 *
 * @param {{ utc: string | null, lat: number, lng: number, local: string | null, town: string | null,
 *   name: { first: string, last: string } | null }} sky  from heldForTab
 * @param {{ kind: "form" } & ReturnType<typeof import("./core/astrocom.js").readFormPage> | { kind: "other" }} page
 */
export function viewForAstroComTab(sky, page) {
  const values = astroComValues(sky);
  const copy = (buttons) => buttons.map((button) => ({ ...button }));

  if (page.kind !== "form") {
    return {
      state: "astro-com-waiting",
      ...values,
      message: "AstroChart Bridge is keeping these values for this tab.",
      notes: ["When you're signed in, open astro.com's birth data form in this tab and click the AstroChart Bridge icon in the toolbar again to fill it in."],
      sky,
      buttons: copy([{ label: "Open astro.com's form", url: FORM_URL, here: true }, CANCEL]),
    };
  }

  if (Object.hasOwn(UNFILLABLE, page.form)) {
    const { buttons, ...screen } = UNFILLABLE[page.form];
    return { ...screen, ...values, notes: zoneNotes(sky, { filled: false }), sky, buttons: copy(buttons) };
  }

  if (page.auth === "signed-out") {
    return {
      state: "astro-com-sign-in",
      heading: "Sign in to astro.com",
      ...values,
      message:
        "astro.com requires an account to generate charts. Sign in to your existing account or create a free account to continue.",
      notes: [
        "AstroChart Bridge keeps these values for the astro.com tab while you sign in. Afterwards, open astro.com's form there and click the AstroChart Bridge icon in the toolbar again.",
      ],
      sky,
      buttons: copy([
        { label: "Sign in", url: SIGN_IN_URL, here: true },
        { label: "Create account", url: CREATE_ACCOUNT_URL, here: true },
        { label: "Fill in anyway", does: "fill", secondary: true },
        CANCEL,
      ]),
    };
  }

  return {
    state: "astro-com-fill",
    ...values,
    message: "Fill in astro.com's form with these values?",
    notes: [
      `AstroChart Bridge fills in ${filledText(sky)}. ` +
        (sky.town === null
          ? "Choose the town nearest this place yourself, and check the coordinates astro.com shows."
          : "Choose astro.com's match nearest this place, and check the coordinates it shows."),
      ...zoneNotes(sky),
      "AstroChart Bridge doesn't submit the form, and forgets these values once it has filled them in.",
    ],
    sky,
    buttons: copy([{ label: "Fill in the form", does: "fill" }, CANCEL]),
  };
}

// What filling in sets: "the birthday, hour, minute, the 00:00 GMT / UT time zone and the town Sydney".
// The automatic time zone is the form's default, so it isn't named.
function filledText({ utc, local = null, town = null, name = null }) {
  const parts = ["the birthday", "hour", "minute"];
  if (formTime({ utc, local }).szon === "h0w") parts.push("the 00:00 GMT / UT time zone");
  if (name !== null) parts.push("the name");
  if (town !== null) parts.push(`the town ${town}`);
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

// The rows and warnings every astro.com screen shows: the form's values in its own terms.
// An empty name part, such as the first name of an event, has no row. With the
// automatic time zone, the Offset row is the chart's, to check astro.com's against.
function astroComValues({ utc, lat, lng, local = null, town = null, name = null }) {
  const { time, szon } = formTime({ utc, local });
  const [year, month, day] = time.slice(0, 10).split("-");
  const seconds = Number(time.slice(17, 19));
  return {
    rows: [
      ["Birthday", `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`],
      ["Hour, min", time.slice(11, 16)],
      ...(szon === "h0w"
        ? [["Time zone", "00:00 GMT / UT, under show / hide extended settings"]]
        : [["Time zone", "automatic time zone, the form's default"], ...(utc === null ? [] : [["Offset", offsetText(localOffset(utc, local))]])]),
      ["Place", placeText(lat, lng)],
      ...(town === null ? [] : [["Town", town]]),
      ...(name === null || name.first === "" ? [] : [["First name", name.first]]),
      ...(name === null || name.last === "" ? [] : [["Last name", name.last]]),
    ],
    warnings: seconds === 0 ? [] : [`astro.com takes whole minutes, so the ${seconds} seconds are left out.`],
  };
}

// What an astro.com screen says about the automatic time zone, which is
// astro.com's to decide: the zone it should pick, who checks it, and how to
// enter the chart in Universal Time instead. Every way of filling in the form
// checks it on the page (watchZone); a form filled in by hand is checked by
// the person. Nothing for Universal Time. A chart with no UTC has no zone to
// check it against: the person checks the zone astro.com picks.
function zoneNotes({ utc, local = null }, { filled = true } = {}) {
  if (formTime({ utc, local }).szon === "h0w") return [];
  if (utc === null) {
    return [
      "The date and time are the chart's local time, and astro.com's automatic time zone looks up the zone for the town you choose. " +
        "AstroChart Bridge has no UTC offset to check it against, so check the time zone astro.com shows for the town and date.",
    ];
  }
  const offset = localOffset(utc, local);
  const [year, month, day] = utc.slice(0, 10).split("-");
  const zone = `${zoneWords(offset)} (${offsetText(offset)})`;
  return [
    "The date and time are the chart's local time, and astro.com's automatic time zone looks up the zone for the town you choose. " +
      (filled
        ? `It should be ${zone}: AstroChart Bridge checks it on the page once you choose the town, and offers Universal Time there if it isn't.`
        : `Check that it's ${zone}. If it isn't, choose 00:00 GMT / UT under show / hide extended settings and enter ${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}, ${utc.slice(11, 16)} instead.`),
  ];
}

// "EDT, DST" → "EDT"
const abbreviation = (zoneLabel) => zoneLabel.split(",")[0].trim();

// "2024-04-17T08:00:00" with "EDT, DST" → "17 Apr 2024, 08:00 (EDT, DST)"
function localText(local, zoneLabel) {
  const [year, month, day] = local.slice(0, 10).split("-");
  const text = `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}, ${local.slice(11, 16)}`;
  return zoneLabel === null ? text : `${text} (${zoneLabel})`;
}

// "2024-04-17T12:00:00Z" → "2024-04-17 12:00"
export const utcText = (utc) => `${utc.slice(0, 10)} ${utc.slice(11, 16)}`;

// What Stellarium Web's clock will show (the UTC instant in the computer's time
// zone) next to the birth time. Both carry their date, since they can differ.
function clockNote(utc, local, timeZone) {
  const parts = clockParts(utc, timeZone);
  const clock = timeOnDay(`${parts.hour}:${parts.minute}`, parts.month, parts.day);
  const birth = timeOnDay(local.slice(11, 16), local.slice(5, 7), local.slice(8, 10));
  return clock === birth
    ? `Stellarium Web's clock will show ${clock}, the same as the birthplace. ${RUNNING}`
    : `Stellarium Web's clock will show ${clock}, your computer's time. That's ${birth} at the birthplace. ${RUNNING}`;
}

// A UTC instant as the computer's clock shows it, which is also how Stellarium
// Web's clock shows it: { year, month, day, hour, minute } as strings.
function clockParts(utc, timeZone) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(utc))
      .map(({ type, value }) => [type, value]),
  );
}

// "05:00", "4", "17" → "05:00 on 17 Apr". The month name comes from MONTHS, not
// the locale, so it always matches the Local time row.
const timeOnDay = (time, month, day) => `${time} on ${Number(day)} ${MONTHS[Number(month) - 1]}`;

// -240 → "UTC-04:00"
// A local-mean-time offset runs to the second, as from an astro.com chart
// image, and shows them: -40 s is "UTC-00:00:40".
export function offsetText(minutes) {
  const size = Math.round(Math.abs(minutes) * 60);
  const pad = (n) => String(n).padStart(2, "0");
  const text = `UTC${minutes < 0 ? "-" : "+"}${pad(Math.floor(size / 3600))}:${pad(Math.floor(size / 60) % 60)}`;
  return size % 60 === 0 ? text : `${text}:${pad(size % 60)}`;
}

// 40.716667, -74 → "40°43'N, 74°0'W", the way the Astro-Seek page writes it.
export const placeText = (lat, lng) => `${angleText(lat, "N", "S")}, ${angleText(lng, "E", "W")}`;

function angleText(value, positive, negative) {
  // Rounding the total in minutes lets 59.99' carry into the next degree.
  const minutes = Math.round(Math.abs(value) * 60);
  return `${Math.floor(minutes / 60)}°${minutes % 60}'${value < 0 ? negative : positive}`;
}
