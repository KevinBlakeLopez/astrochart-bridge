import { formTime, localOffset, zoneWords } from "./core/astrocom.js";
import { astroSeekSaveUrl, onAstroSeekDateLine } from "./core/astroseek.js";
import { parseOffset, utcFromOffset } from "./core/civiltime.js";
import { nameFromText } from "./core/names.js";
import { searchTown } from "./core/towns.js";
import { isLabelText, toPortable } from "./core/portable.js";
import { HELIOSCOPE_URL } from "./helioscope-config.js";
import { text } from "./messages/index.js";
import { HOLD_MINUTES } from "./pending.js";

// Every text here comes from the chosen language's catalog (messages/), read
// when a screen is built. What other modules use is a function for the same
// reason: a constant would keep the language chosen when this module loaded.

export const privacyNote = () => text().popup.privacyNote;

/**
 * Said wherever Which planets were visible is offered, in a build that leaves
 * Helioscope out, such as the App Store's Safari app, where the button opens
 * the website's copy of Helioscope's page: which website, and that the chart
 * doesn't reach it. Nothing in the extension or on the site, which open their
 * own copy. It comes right after the privacy note, as the button comes after
 * the Stellarium buttons.
 *
 * @param {string | null} [url]  helioscope-config.js's HELIOSCOPE_URL
 * @returns {string[]}
 */
export const helioscopeNotes = (url = HELIOSCOPE_URL) => (url === null ? [] : [text().popup.helioscopeOnTheWeb(new URL(url).host)]);

// Shown on the choose and enter-offset screens, the privacy note last, just above
// Open Stellarium Web. The ready screen knows its UTC, so it names the exact clock time instead.
const skyNotes = () => [text().popup.clockNote, privacyNote()];

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
export function otherWays() {
  const words = text().popup.otherWays;
  return [
    {
      label: words.read,
      buttons: [
        { label: words.screenshot, page: "screenshot.html" },
        { label: words.paste, page: "paste.html" },
        { label: words.file, page: "import.html" },
        { label: words.bridgeFile, page: "chart.html" },
      ],
    },
    {
      label: words.desktop,
      buttons: [{ label: words.importFromDesktop, does: "import-from-desktop" }],
    },
  ];
}

// The popup's chart screens offer the other ways in too, for a different
// chart than the page's, in a box that stays closed until it's opened.
export function withOtherWays(view) {
  return { ...view, more: { label: text().popup.otherWays.more, groups: otherWays() } };
}

const WARNINGS = {
  "zone-label-unknown": ({ zoneLabel }) => text().popup.zoneLabelUnknown(zoneLabel === null ? null : abbreviation(zoneLabel)),
};

/**
 * What the popup shows for an analyzePage result. Every decision about the
 * screen is made here, so popup.js only renders it.
 *
 * @param {ReturnType<typeof import("./core/index.js").analyzePage>} result
 * @param {{ timeZone?: string, town?: string | null, name?: { first: string, last: string } | null,
 *   kept?: { town: string | null, name: { first: string, last: string } | null, gender?: string | null } | null,
 *   onTheWeb?: boolean }} [options]
 *   timeZone is the computer's time zone; when left out, Intl uses the one
 *   this code runs in, which the popup shares with the Stellarium tab. Tests
 *   pass it so they give the same result anywhere. town and name are the ones
 *   the chart's page names, for astro.com's form. kept is the town, name and
 *   gender Open chart in Astro-Seek kept for an Astro-Seek tab whose page
 *   still shows its chart, used where the page names none. The page never
 *   gives a gender. onTheWeb is for the web's copy of an import page, which
 *   the import models pass on: nothing on the screen asks for what only the
 *   extension can do (withAstroSeekSave's, astroComStepFor's).
 */
export function viewFor(result, { timeZone, town = null, name = null, kept = null, onTheWeb = false } = {}) {
  const words = text().popup;
  if (result.kind === "refused") {
    // Every refusal without a message of its own means the chart page couldn't
    // be read. They share one and show their code, so a bug report says which check failed.
    return Object.hasOwn(words.refusals, result.reason)
      ? { state: "refused", message: words.refusals[result.reason] }
      : { state: "refused", message: words.unreadable, code: result.reason };
  }

  const { local, zoneLabel, lat, lng } = result;
  const localRow = [words.rows.localTime, localText(local, zoneLabel)];
  const placeRow = [words.rows.place, placeText(lat, lng)];
  const sky = (utc) => ({ utc, lat, lng });

  if (result.utcSource === "needs-choice") {
    const label = abbreviation(zoneLabel);
    const printed = result.candidates.find((candidate) => candidate.basis === "printed UT");
    return {
      state: "choose",
      rows: [localRow, placeRow],
      message: words.contradicts(local.slice(11, 16), label, offsetText(printed.offsetMinutes)),
      choices: result.candidates.map((candidate) => ({
        label:
          candidate === printed
            ? words.asPrinted(utcText(candidate.utc), offsetText(candidate.offsetMinutes))
            : words.asLabelled(utcText(candidate.utc), label, offsetText(candidate.offsetMinutes)),
        sky: sky(candidate.utc),
      })),
      notes: [...skyNotes(), ...helioscopeNotes()],
      buttons: chartButtons([openSkyButton()]),
    };
  }

  if (result.utcSource === "needs-offset") {
    return {
      state: "enter-offset",
      rows: [localRow, placeRow],
      message: words.needsOffset,
      notes: [...skyNotes(), ...helioscopeNotes()],
      chart: { local, lat, lng },
      buttons: chartButtons([openSkyButton()]),
    };
  }

  const ready = {
    state: "ready",
    rows: [localRow, [words.rows.offset, offsetText(result.offsetMinutes)], [words.rows.utc, utcText(result.utc)], placeRow],
    warnings: (result.warnings ?? []).map((code) => WARNINGS[code]?.(result) ?? code),
    notes: [clockNote(result.utc, local, timeZone), privacyNote(), ...helioscopeNotes()],
    sky: sky(result.utc),
    buttons: chartButtons([openSkyButton()]),
  };
  // An astro.com chart can also open in Astro-Seek, and be saved there with the
  // name and town its page's record gives. An Astro-Seek page already shows
  // its chart there, and leads to the values to enter in astro.com instead.
  if (result.site === "astro-com") {
    return withAstroSeekSave(
      {
        ...ready,
        warnings: [...ready.warnings, ...astroSeekWarnings(lng)],
        notes: [...ready.notes, ...astroSeekNotes()],
        buttons: chartButtons(astroSeekButtons()),
      },
      townAndName(result),
      { onTheWeb },
    );
  }
  if (result.site !== "astro-seek") return ready;
  // A chart Astro-Seek placed by coordinates, such as one AstroChart Bridge
  // opens, names no town, and Astro-Seek's own save link leaves its Birth city
  // to be typed. Save in Astro-Seek… chooses it instead, first under Take the
  // chart elsewhere. A chart with a town saves well from Astro-Seek's own
  // link, in its own time zone. No note: the chart is already on astro-seek.com.
  // The page's own town and name, or else those kept for the tab, go to
  // Astro-Seek's form and astro.com's alike.
  const chart = { ...townAndName(result, { town, name, kept }), gender: kept?.gender ?? null };
  const buttons = town === null ? chartButtons([openSkyButton(), astroSeekSaveButton(chart, { onTheWeb })]) : ready.buttons;
  return { ...ready, buttons, next: astroComStepFor({ onTheWeb })(ready.sky, { ...chart, local }) };
}

/**
 * The town and name a chart screen has for its chart, for astro.com's and
 * Astro-Seek's forms and for Share…: an astro.com page's own record; an
 * Astro-Seek page's, from its address, or else those kept for its tab.
 *
 * @param {ReturnType<typeof import("./core/index.js").analyzePage>} result  a natal result
 * @param {{ town?: string | null, name?: { first: string, last: string } | null,
 *   kept?: { town: string | null, name: { first: string, last: string } | null } | null }} [options]  as viewFor's
 * @returns {{ town: string | null, name: { first: string, last: string } | null }}
 */
export function townAndName(result, { town = null, name = null, kept = null } = {}) {
  if (result.site === "astro-com") return { town: result.town ?? null, name: result.name ?? null };
  return { town: town ?? kept?.town ?? null, name: name ?? kept?.name ?? null };
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
export const astroSeekNotes = () => [...text().popup.astroSeekNotes];

// Shown with them as a warning when Astro-Seek gets the chart 1' off: at a
// longitude that rounds to 180°, which goes in as 179°59'.
export const astroSeekWarnings = (lng) => (onAstroSeekDateLine(lng) ? [text().popup.astroSeekDateLine] : []);

// The buttons of a screen whose chart can also open in Astro-Seek. Both open the
// same decided UTC and place: Astro-Seek's chart in UT/GMT, as from a Stellarium tab.
export const astroSeekButtons = () => [openSkyButton(), { label: text().popup.buttons.openInAstroSeek, opens: "astro-seek" }];

const openSkyButton = () => ({ label: text().popup.buttons.openSky, opens: "stellarium" });

// Shown wherever Save in Astro-Seek… is offered, in place of Open chart in
// Astro-Seek's note on what it sends. One note for both keeps the popup's
// astro.com screen under the 600px a popup is shown at. For a chart without a
// name or town it takes one line, as Open chart in Astro-Seek's did; an
// astro.com chart's record usually has both, and its two lines bring that
// screen to 598px at 440px wide, measured 2026-11-02 with main's spacing. The
// browser's own prompt says that saving asks for access, and the box under
// Birth city that Gender and Add person are the person's.
export const astroSeekSaveNote = () => text().popup.astroSeekSaveNote;
export const astroSeekSaveNamedNote = () => text().popup.astroSeekSaveNamedNote;

/**
 * A screen with Open chart in Astro-Seek, with Save in Astro-Seek… right
 * after it, and its note in place of Open chart in Astro-Seek's, or last.
 * The button saves the chart in the signed-in account's private astro
 * database (astro-seek-open.js), so only the popup and the extension's own
 * pages offer it, not the shared chart page, which is also a website. Like
 * Open chart in Astro-Seek, it waits for the screen to decide the sky. A
 * screen built on one that has them, such as a screenshot of an astro.com
 * chart on the popup's astro.com screen, isn't given them twice. A chart
 * with a town, name or gender has Open chart in Astro-Seek keep them for the
 * tab it opens (pending.js's astroSeekTabs), for Save in Astro-Seek… in the
 * popup on that tab: someone may look at the chart first and save it after.
 *
 * The notes are found by their text, which is the same language's throughout:
 * the screen and this are built in one go.
 *
 * On the web, which has no extension to fill in the form or keep anything
 * for a tab, the button is savesByHand: it leads to the form filled in by its
 * address alone (viewForAstroSeekSave's by hand), and nothing is kept.
 *
 * @param {object} view  with a button that opens "astro-seek"
 * @param {{ town?: string | null, name?: { first: string, last: string } | null,
 *   gender?: "female" | "male" | "event" | "horary" | null }} [chart]
 *   the chart's town, name and gender, for the form's Birth city, Name and Gender
 * @param {{ onTheWeb?: boolean }} [options]  onTheWeb for the web's copy of a page
 */
export function withAstroSeekSave(view, chart = {}, { onTheWeb = false } = {}) {
  const button = astroSeekSaveButton(chart, { onTheWeb });
  const saves = button.saves ?? button.savesByHand;
  const keeps =
    onTheWeb || (saves.town === null && saves.name === null && saves.gender === null)
      ? null
      : { town: saves.town, name: chart.name ?? null, gender: saves.gender };
  const opener = (each) => (keeps && each.opens === "astro-seek" ? { ...each, keeps } : each);
  const at = view.buttons.findIndex(({ opens }) => opens === "astro-seek") + 1;
  const [saveNote, namedNote, openNote] = [astroSeekSaveNote(), astroSeekSaveNamedNote(), astroSeekNotes()[1]];
  const note = saves.town === null && saves.name === null ? saveNote : namedNote;
  const notes = view.notes.includes(openNote)
    ? view.notes.map((each) => (each === openNote ? note : each))
    : [...view.notes, note];
  const noted = view.notes.includes(saveNote) || view.notes.includes(namedNote);
  return {
    ...view,
    notes: noted ? view.notes : notes,
    buttons: view.buttons.some(({ saves, savesByHand }) => saves || savesByHand)
      ? view.buttons
      : [...view.buttons.slice(0, at).map(opener), button, ...view.buttons.slice(at)],
  };
}

// Save in Astro-Seek… for a chart's town, name and gender, which popup.js and
// astro-com-page.js pass to astro-seek-open.js with the sky the screen decided.
// On the web it is savesByHand, for viewForAstroSeekSave's by hand instead.
function astroSeekSaveButton({ town = null, name = null, gender = null } = {}, { onTheWeb = false } = {}) {
  const saves = { town, name: nickFor(name), gender };
  return { label: text().popup.buttons.saveInAstroSeek, ...(onTheWeb ? { savesByHand: saves } : { saves }), secondary: true };
}

// Astro-Seek's form has one Name field, so a name's two parts go in it as one.
function nickFor(name) {
  const nick = [name?.first ?? "", name?.last ?? ""].map((part) => part.trim()).filter(Boolean).join(" ");
  return nick === "" ? null : nick;
}

// Shown while Astro-Seek's form opens behind the popup.
export const astroSeekSaveBusy = () => ({ state: "astro-seek-busy", message: text().popup.astroSeekSaveBusy, notes: [], buttons: [] });

/**
 * Save in Astro-Seek… when it didn't leave the form filled in: declined
 * access to www.astro-seek.com, a signed-out browser, or a form it couldn't
 * finish. Declined, a button opens the form anyway, filled in as far as its
 * address goes; otherwise a button goes to the tab it opened. The check note
 * is what the person checks before Add person in a form AstroChart Bridge
 * didn't finish: choosing a city may change the coordinates and time zone.
 *
 * By hand is the web copy's Save in Astro-Seek…: the same as declined, but
 * there is no access to give, so it says this page can't choose the town.
 *
 * @param {{ outcome: "declined" | "by-hand" | "signed-out" } | { outcome: "not-filled", page: string }} result
 *   page is one of the catalog's saveMessages
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {{ town: string | null, name: string | null }} saves  the button's saves, or savesByHand
 */
export function viewForAstroSeekSave(result, sky, saves) {
  const words = text().popup;
  if (result.outcome === "declined" || result.outcome === "by-hand") {
    return {
      state: "astro-seek-manual",
      message: result.outcome === "declined" ? words.saveDeclined : words.saveByHand,
      notes: [`${words.saveDeclinedNote(Boolean(saves.name))} ${words.checkNote}`],
      sky,
      buttons: [{ label: words.buttons.openAstroSeekForm, url: astroSeekSaveUrl(sky, { name: saves.name }) }],
    };
  }
  const page = result.outcome === "signed-out" ? "signed-out" : result.page;
  const signIn = page === "signed-out" || page === "elsewhere";
  return {
    state: "astro-seek-not-filled",
    message: words.saveMessages[page] ?? words.saveMessages.unrecognised,
    notes: signIn ? [] : [words.checkNote],
    sky,
    buttons: [{ label: words.buttons.astroSeekTab, does: "show-tab" }],
  };
}

// Opens the receiving page in a tab, with the chart in its link, to copy the
// link or download the file. Offered on every screen with a chart of its own;
// like Open Stellarium Web, it waits for a reading or offset to decide the UTC. A
// Stellarium tab has no birthplace time, so its screen doesn't offer it.
export const shareButton = () => ({ label: text().popup.buttons.share, does: "share", secondary: true });

// Opens Helioscope's page in a tab, with the chart in its link but not its
// name or town, to see which planets could be seen with the naked eye around
// the chart's moment. It goes wherever Share… goes, right before it, and
// waits for the UTC as Share… does. A horary chart, which is natal to the
// readers with horary as its gender, gets it too.
export const helioscopeButton = () => ({ label: text().popup.buttons.helioscope, does: "helioscope", secondary: true });

// A screen's buttons, then Which planets were visible and Share…: every
// screen with a chart of its own ends with these.
export const chartButtons = (buttons) => [...buttons, helioscopeButton(), shareButton()];

// The labels over a screen's two kinds of action, when it has both.
export const groupLabels = () => ({ ...text().popup.groups });

/**
 * The order view.js draws a screen's actions in, in labelled groups. The ways
 * to see the sky, Open Stellarium Web and Send to Stellarium Desktop, go under
 * See the sky, with the line that says which is the default, then Which
 * planets were visible, so that line stays beside the buttons it's about.
 * Every other action goes under Take the chart elsewhere: Share…, Open chart in
 * Astro-Seek, the AAF file and the astro.com step among them. The group with
 * the screen's main button comes first.
 *
 * A screen without both kinds is one group with no label, in the order it
 * always had. The default line alone doesn't count as a way to see the sky:
 * the sent screen has it beside Done.
 *
 * Send to Stellarium Desktop comes first when it is the user's default, and
 * otherwise right after Open Stellarium Web, or last on a screen without it.
 * The share page's boxes for a chart's name and town go right before the
 * first button that passes the chart on.
 *
 * @param {object} view  from viewFor, viewForSky and the like, with withDesktopSend's desktop
 * @returns {{ label: string | null, actions: object[] }[]}  each action is
 *   { kind: "button", button } for one of the view's buttons, or { kind } of
 *   "url" (the view's own link), "desktop", "default-choice", "download",
 *   "includes" or "next"
 */
export function actionGroups(view) {
  const actions = (view.buttons ?? [openSkyButton()]).map((button) => ({ kind: "button", button }));
  if (view.desktop) {
    const send = { kind: "desktop" };
    const web = actions.findIndex(({ button }) => button?.opens === "stellarium");
    if (view.desktop.primary) actions.unshift(send);
    else actions.splice(web === -1 ? actions.length : web + 1, 0, send);
  }
  if (view.includes) {
    const shares = actions.findIndex(({ button }) => button?.shares);
    if (shares !== -1) actions.splice(shares, 0, { kind: "includes" });
  }
  if (view.defaultChoice) actions.push({ kind: "default-choice" });
  if (view.download) actions.push({ kind: "download" });
  if (view.next) actions.push({ kind: "next" });

  const sky = [
    ...actions.filter((action) => opensSky(action) || action.kind === "default-choice"),
    ...actions.filter(({ button }) => button?.does === "helioscope"),
  ];
  const elsewhere = actions.filter((action) => !sky.includes(action));
  if (!actions.some(opensSky) || elsewhere.length === 0) return [{ label: null, actions }];
  const labels = groupLabels();
  const groups = [
    { label: labels.sky, actions: sky },
    { label: labels.elsewhere, actions: elsewhere },
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
 * @param {{ town?: string | null, name?: { first: string, last: string } | null }} [chart]
 *   the chart's town and name, which the share page offers to include
 * @returns {ReturnType<typeof toPortable>}
 */
export function chartToShare(result, sky, via, chart = {}) {
  return toPortable(
    { local: result.local, utc: sky.utc, lat: sky.lat, lng: sky.lng },
    { site: result.site, via, zoneLabel: result.zoneLabel ?? undefined, utcBasis: utcBasis(result, sky) },
    labelsToShare(chart),
  );
}

/**
 * A chart's town and name as a portable chart's labels: the name's two parts
 * as one, as Astro-Seek's Name field takes them. One the format can't carry,
 * such as a name over 100 characters, is left out rather than stopping the
 * share; the share page shows what is included.
 *
 * @param {{ town?: string | null, name?: { first: string, last: string } | null }} chart
 * @returns {{ name?: string, town?: string }}
 */
export function labelsToShare({ town = null, name = null } = {}) {
  const labels = { name: nickFor(name), town: town?.trim() || null };
  return Object.fromEntries(Object.entries(labels).filter(([, text]) => isLabelText(text)));
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
  const words = text().popup;
  return {
    state: "share-refused",
    message: reason === "before-gregorian" ? words.shareBeforeGregorian : words.shareRefused,
    code: reason,
    notes: [],
    buttons: [],
  };
}

/**
 * What a chart screen shows when the chart can't go in Helioscope's link, for
 * the reasons chartToShare refuses. Cancel goes back to the chart, as after
 * Share….
 *
 * @param {string} reason
 */
export function viewForHelioscopeRefusal(reason) {
  const words = text().popup;
  return {
    state: "helioscope-refused",
    message: reason === "before-gregorian" ? words.helioscopeBeforeGregorian : words.helioscopeRefused,
    code: reason,
    notes: [],
    buttons: [],
  };
}

/**
 * What the popup shows on a Stellarium Web tab: the sky it is showing, and
 * buttons that open the same moment and place as an Astro-Seek chart or save
 * it there. The tab is already Stellarium Web, so there's no button for it.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky  from skyFromEngine
 * @param {{ timeZone?: string, town?: string | null }} [options]  timeZone as for
 *   viewFor; town, the name Stellarium Web gives the place (townFromPlace),
 *   for astro.com's and Astro-Seek's forms
 */
export function viewForSky(sky, { timeZone, town = null } = {}) {
  const words = text().popup;
  const clock = clockParts(sky.utc, timeZone);
  return withAstroSeekSave({
    state: "to-astro-seek",
    rows: [
      [
        words.rows.stellariumTime,
        words.stellariumTimeValue(`${clock.hour}:${clock.minute}`, Number(clock.day), Number(clock.month), Number(clock.year)),
      ],
      [words.rows.utc, utcText(sky.utc)],
      [words.rows.place, placeText(sky.lat, sky.lng)],
    ],
    ...(onAstroSeekDateLine(sky.lng) ? { warnings: astroSeekWarnings(sky.lng) } : {}),
    notes: astroSeekNotes(),
    sky,
    buttons: [{ label: words.buttons.openInAstroSeek, opens: "astro-seek" }],
    next: astroComStep(sky, { town }),
  }, { town });
}

// astro.com's pages, as seen signed out on 2026-11-01. Its birth data form
// (ade.cgi) is posted, asks for a country and town for its atlas to look up,
// has no coordinate fields, and offers "00:00 GMT / UT" among the time zones
// in its extended settings. This screen can't tell whether the browser is
// signed in. Each button keeps the values for the tab it opens. The form
// button also asks for access to www.astro.com and, given it, fills the form
// in as it opens (astro-com-open.js); without it, the popup on that tab fills
// it in: viewForAstroComTab. Its pages are named as they print themselves,
// in English, whatever the interface's language: its links open them so.
const FORM_URL = "https://www.astro.com/cgi/ade.cgi";
const SIGN_IN_URL = "https://www.astro.com/cgi/awd.cgi?lang=e";
const CREATE_ACCOUNT_URL = "https://www.astro.com/cgi/scus.cgi?act=new&";

// holds is what each keeps for the tab it opens; fills asks for access and fills it in.
function astroComButtons() {
  const { buttons } = text().popup;
  return [
    { label: buttons.openAstroComForm, url: FORM_URL, fills: true },
    { label: buttons.signIn, url: SIGN_IN_URL },
    { label: buttons.createAccount, url: CREATE_ACCOUNT_URL },
  ];
}

// astro.com's form has no coordinate fields: its atlas looks up a typed town.
// The same on a page that can't fill in the form: the town is typed by hand.
const townNote = (town) => text().popup.townNote(town === null ? null : searchTown(town));
const townByHandNote = (town) => (town === null ? townNote(null) : text().popup.townByHandNote(searchTown(town)));

// The sign-in advice is a note, not a step before the form: a signed-in browser
// goes straight on.
function astroComNotes() {
  const words = text().popup;
  return [words.signInNote, words.keepsNote(HOLD_MINUTES), words.accessNote];
}

// Shown while the form opens behind the popup.
export const astroComBusy = () => ({ state: "astro-com-busy", message: text().popup.astroComBusy, notes: [], buttons: [] });

/**
 * The two-click way, when the user declined access to www.astro.com: the
 * values, and a button that only keeps them for the tab it opens.
 *
 * @param {{ utc: string | null, lat: number, lng: number, local: string | null, town: string | null }} values
 */
export function viewForAstroComManual(values) {
  const words = text().popup;
  return {
    state: "astro-com-manual",
    ...astroComValues(values),
    message: words.noAccess,
    notes: [...zoneNotes(values), words.afterTabOpens],
    sky: { utc: values.utc, lat: values.lat, lng: values.lng },
    buttons: [{ label: words.buttons.openAstroComForm, url: FORM_URL, holds: { ...values } }],
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
  const words = text().popup;
  return {
    state: "astro-com-not-filled",
    ...astroComValues(values),
    message: outcome === "choose" ? words.formNeedsChoice : words.formNotOpened,
    notes: [...zoneNotes(values), words.switchToTab],
    sky: { utc: values.utc, lat: values.lat, lng: values.lng },
    buttons: [{ label: words.buttons.astroComTab, does: "show-tab" }],
  };
}

// astro.com's first and last name fields, sfnm and snam, each have a maxlength
// of 40, as seen signed out on 2026-11-01.
export const NAME_LENGTH = 40;

// The core readers give a chart's name the same way, so the rule is theirs.
export { nameFromText };

/**
 * A chart screen's Gender row, for a chart whose file gives one, so it shows
 * before astro.com's or Astro-Seek's form opens with it. A horary chart has
 * none: its Chart type row says so.
 *
 * @param {"female" | "male" | "event" | "horary" | null} gender
 * @returns {[string, string][]}
 */
export function genderRows(gender) {
  const words = text().popup;
  const label = Object.hasOwn(words.genders, gender ?? "") ? words.genders[gender] : null;
  return label ? [[words.rows.gender, label]] : [];
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
  const words = text().popup;
  const { firstName, lastName } = words.astroComRows;
  const long = [[firstName, first], [lastName, last]].filter(([, typed]) => typed.trim().length > NAME_LENGTH);
  if (long.length === 0) return null;
  return words.nameWarning(NAME_LENGTH, words.and(long.map(([label]) => label)));
}

// The secondary button on a screen whose chart can be entered in astro.com.
export const astroComStep = (sky, chart = {}) => ({ label: text().popup.buttons.enterInAstroCom, view: viewForAstroCom(sky, chart) });

// The same button on the shared chart page on the web, which has no extension
// to fill in astro.com's form: it leads to the values to type in.
export const astroComStepByHand = (sky, chart = {}) => ({ label: text().popup.buttons.enterInAstroCom, view: viewForAstroComByHand(sky, chart) });

// The step for the copy a screen is built for: the extension's fills in the
// form, the web's leads to the values to type in.
export const astroComStepFor = ({ onTheWeb = false } = {}) => (onTheWeb ? astroComStepByHand : astroComStep);

/**
 * The values to type into astro.com's form, for a page with no extension to
 * fill it in, such as the shared chart page on the web: the values, what to
 * check once the town is chosen, and a plain link to the form. Nothing is kept.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {{ local?: string | null, town?: string | null, name?: { first: string, last: string } | null,
 *   gender?: "female" | "male" | "event" | "horary" | null }} [chart]
 *   the chart's local time, town, name and gender, as for viewForAstroCom
 */
export function viewForAstroComByHand({ utc, lat, lng }, { local = null, town = null, name = null, gender = null } = {}) {
  const words = text().popup;
  const values = { utc, lat, lng, local };
  return {
    state: "astro-com-by-hand",
    ...astroComValues({ ...values, town, name, gender }),
    message: words.byHand,
    notes: [...zoneNotes(values, { filled: false }), townByHandNote(town)],
    sky: { utc, lat, lng },
    buttons: [{ label: words.buttons.openAstroComForm, url: FORM_URL }],
  };
}

/**
 * The values to enter in astro.com's birth data form for a decided UTC and
 * place, in the form's own terms, and links to the form and to signing in.
 *
 * @param {{ utc: string | null, lat: number, lng: number }} sky
 * @param {{ local?: string | null, town?: string | null, name?: { first: string, last: string } | null,
 *   gender?: "female" | "male" | "event" | "horary" | null }} [chart]
 *   the local time, town, name and gender the chart gives, filled in with the
 *   rest. A sky with no local time, such as Stellarium's, goes in as Universal Time.
 *   One with no UTC, pasted with no offset, has a local time for astro.com's
 *   automatic time zone.
 */
export function viewForAstroCom({ utc, lat, lng }, { local = null, town = null, name = null, gender = null } = {}) {
  const words = text().popup;
  const sky = { utc, lat, lng };
  const held = { ...sky, local, town, name, gender };
  return {
    state: "to-astro-com",
    // The name is in its boxes, not the rows, so it shows once.
    ...astroComValues({ ...held, name: null }),
    message: words.fillsAsItOpens,
    nameBoxes: [
      { part: "first", label: words.astroComRows.firstName, text: name?.first ?? "" },
      { part: "last", label: words.astroComRows.lastName, text: name?.last ?? "" },
    ],
    notes: [
      // A local time that is Universal Time needs no note.
      ...(local === null ? [words.universalTimeNote] : []),
      ...zoneNotes(held),
      townNote(town),
      words.nameNote,
      ...astroComNotes(),
    ],
    sky,
    buttons: astroComButtons().map((button) => ({ ...button, holds: { ...held } })),
  };
}

// The buttons of the screens on an astro.com tab. A button with does is an
// action popup.js takes on the tab; one with here opens its link in the tab
// itself, so the values kept for the tab stay with it.
const cancelButton = () => ({ label: text().popup.buttons.cancel, does: "release", secondary: true });
const blankFormButton = () => ({ label: text().popup.buttons.blankForm, url: FORM_URL, here: true });

// What the popup shows on a form it won't fill in, by readFormPage's form.
// Every one keeps the values on screen to type in by hand.
function unfillable(form) {
  const words = text().popup;
  const screens = {
    typed: {
      state: "astro-com-typed",
      message: words.typedForm,
      buttons: [blankFormButton(), cancelButton()],
    },
    unrecognised: {
      state: "astro-com-unrecognised",
      message: words.unrecognisedForm,
      code: "unrecognised-form",
      buttons: [cancelButton()],
    },
  };
  return Object.hasOwn(screens, form) ? screens[form] : null;
}

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
  const words = text().popup;
  const values = astroComValues(sky);

  if (page.kind !== "form") {
    return {
      state: "astro-com-waiting",
      ...values,
      message: words.keepingForTab,
      notes: [words.whenSignedIn],
      sky,
      buttons: [{ label: words.buttons.openAstroComForm, url: FORM_URL, here: true }, cancelButton()],
    };
  }

  const screen = unfillable(page.form);
  if (screen) {
    const { buttons, ...rest } = screen;
    return { ...rest, ...values, notes: zoneNotes(sky, { filled: false }), sky, buttons };
  }

  if (page.auth === "signed-out") {
    return {
      state: "astro-com-sign-in",
      heading: words.signInHeading,
      ...values,
      message: words.requiresAccount,
      notes: [words.keepsWhileSigningIn],
      sky,
      buttons: [
        { label: words.buttons.signIn, url: SIGN_IN_URL, here: true },
        { label: words.buttons.createAccount, url: CREATE_ACCOUNT_URL, here: true },
        { label: words.buttons.fillAnyway, does: "fill", secondary: true },
        cancelButton(),
      ],
    };
  }

  return {
    state: "astro-com-fill",
    ...values,
    message: words.fillQuestion,
    notes: [words.fillNote(filledText(sky), sky.town !== null), ...zoneNotes(sky), words.doesntSubmit],
    sky,
    buttons: [{ label: words.buttons.fillForm, does: "fill" }, cancelButton()],
  };
}

// What filling in sets: "the birthday, hour, minute, the 00:00 GMT / UT time zone and the town Sydney".
// The automatic time zone is the form's default, so it isn't named.
function filledText({ utc, local = null, town = null, name = null, gender = null }) {
  const { filled, and } = text().popup;
  const parts = [filled.birthday, filled.hour, filled.minute];
  if (formTime({ utc, local }).szon === "h0w") parts.push(filled.universalTime);
  if (name !== null) parts.push(filled.name);
  if (ASTRO_COM_GENDERS[gender]) parts.push(filled.gender);
  if (town !== null) parts.push(filled.town(town));
  return and(parts);
}

// astro.com's words for its gender buttons, by the chart's gender: a horary
// chart is an event there.
const ASTRO_COM_GENDERS = { female: "female", male: "male", event: "event/other", horary: "event/other" };

// The rows and warnings every astro.com screen shows: the form's values in its own terms.
// An empty name part, such as the first name of an event, has no row. With the
// automatic time zone, the Offset row is the chart's, to check astro.com's against.
function astroComValues({ utc, lat, lng, local = null, town = null, name = null, gender = null }) {
  const words = text().popup;
  const labels = words.astroComRows;
  const { time, szon } = formTime({ utc, local });
  const [year, month, day] = time.slice(0, 10).split("-").map(Number);
  const seconds = Number(time.slice(17, 19));
  return {
    rows: [
      [labels.birthday, words.longDate(day, month, year)],
      [labels.hourMin, time.slice(11, 16)],
      ...(szon === "h0w"
        ? [[labels.timeZone, words.universalTimeZone]]
        : [[labels.timeZone, words.automaticZone], ...(utc === null ? [] : [[words.rows.offset, offsetText(localOffset(utc, local))]])]),
      [words.rows.place, placeText(lat, lng)],
      ...(town === null ? [] : [[labels.town, town]]),
      ...(name === null || name.first === "" ? [] : [[labels.firstName, name.first]]),
      ...(name === null || name.last === "" ? [] : [[labels.lastName, name.last]]),
      ...(ASTRO_COM_GENDERS[gender] ? [[labels.gender, ASTRO_COM_GENDERS[gender]]] : []),
    ],
    warnings: seconds === 0 ? [] : [words.wholeMinutes(seconds)],
  };
}

// What an astro.com screen says about the automatic time zone, which is
// astro.com's to decide: the zone it should pick, who checks it, and how to
// enter the chart in Universal Time instead. Every way of filling in the form
// checks it on the page (watchZone); a form filled in by hand is checked by
// the person. Nothing for Universal Time. A chart with no UTC has no zone to
// check it against: the person checks the zone astro.com picks.
function zoneNotes({ utc, local = null }, { filled = true } = {}) {
  const words = text().popup;
  if (formTime({ utc, local }).szon === "h0w") return [];
  if (utc === null) return [words.zoneUnchecked];
  const offset = localOffset(utc, local);
  const [year, month, day] = utc.slice(0, 10).split("-").map(Number);
  const zone = `${zoneWords(offset)} (${offsetText(offset)})`;
  return [filled ? words.zoneChecked(zone) : words.zoneToCheck(zone, words.longDate(day, month, year), utc.slice(11, 16))];
}

// "EDT, DST" → "EDT"
const abbreviation = (zoneLabel) => zoneLabel.split(",")[0].trim();

// "2024-04-17T08:00:00" with "EDT, DST" → "17 Apr 2024, 08:00 (EDT, DST)"
function localText(local, zoneLabel) {
  const [year, month, day] = local.slice(0, 10).split("-").map(Number);
  const dated = `${text().popup.shortDate(day, month, year)}, ${local.slice(11, 16)}`;
  return zoneLabel === null ? dated : `${dated} (${zoneLabel})`;
}

// "2024-04-17T12:00:00Z" → "2024-04-17 12:00"
export const utcText = (utc) => `${utc.slice(0, 10)} ${utc.slice(11, 16)}`;

// What Stellarium Web's clock will show (the UTC instant in the computer's time
// zone) next to the birth time. Both carry their date, since they can differ.
// The month name comes from the catalog, not the locale, so it always matches
// the Local time row.
function clockNote(utc, local, timeZone) {
  const words = text().popup;
  const parts = clockParts(utc, timeZone);
  const clock = words.timeOnDay(`${parts.hour}:${parts.minute}`, Number(parts.day), Number(parts.month));
  const birth = words.timeOnDay(local.slice(11, 16), Number(local.slice(8, 10)), Number(local.slice(5, 7)));
  return clock === birth ? words.clockSame(clock) : words.clockDiffers(clock, birth);
}

// A UTC instant as the computer's clock shows it, which is also how Stellarium
// Web's clock shows it: { year, month, day, hour, minute } as strings. Only the
// numbers are used, so the format's own language doesn't matter.
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

// -240 → "UTC-04:00"
// A local-mean-time offset runs to the second, as from an astro.com chart
// image, and shows them: -40 s is "UTC-00:00:40".
export function offsetText(minutes) {
  const size = Math.round(Math.abs(minutes) * 60);
  const pad = (n) => String(n).padStart(2, "0");
  const text = `UTC${minutes < 0 ? "-" : "+"}${pad(Math.floor(size / 3600))}:${pad(Math.floor(size / 60) % 60)}`;
  return size % 60 === 0 ? text : `${text}:${pad(size % 60)}`;
}

// 40.716667, -74 → "40°43'N, 74°0'W", with the catalog's compass letters.
export function placeText(lat, lng) {
  const { north, south, east, west } = text().popup.compass;
  return `${angleText(lat, north, south)}, ${angleText(lng, east, west)}`;
}

function angleText(value, positive, negative) {
  // Rounding the total in minutes lets 59.99' carry into the next degree.
  const minutes = Math.round(Math.abs(value) * 60);
  return `${Math.floor(minutes / 60)}°${minutes % 60}'${value < 0 ? negative : positive}`;
}
