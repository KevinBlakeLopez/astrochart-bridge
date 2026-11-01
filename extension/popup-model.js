import { astroSeekUrl } from "./core/astroseek.js";
import { parseOffset, utcFromOffset } from "./core/civiltime.js";
import { HOLD_MINUTES } from "./pending.js";

const CLOCK_NOTE = "Stellarium Web's clock shows your computer's time zone and keeps running.";

// Seen on 2026-10-31: stellarium-web.org's Google Ads tag sent the full link,
// date and coordinates included, as its url= parameter.
export const PRIVACY_NOTE =
  "Opening the sky sends this date, time and place to stellarium-web.org, and its page passes the link on to Google's advertising tags.";

// Shown on the choose and enter-offset screens, the privacy note last, just above
// Open sky. The ready screen knows its UTC, so it names the exact clock time instead.
const NOTES = [CLOCK_NOTE, PRIVACY_NOTE];

const RUNNING = "The clock starts running at once; its pause button stops it.";

// A refusal's code says which site it came from (transit and synastry only
// from Astro-Seek; databank and the four after it only from astro.com), so
// each message can name its site without being told it.
const REFUSALS = {
  transit: "This is a transit chart. Chart Bridge opens natal charts only.",
  synastry: "This is a synastry or compatibility chart. Chart Bridge opens natal charts only.",
  unsupported: "Open an Astro-Seek or astro.com birth chart to use Chart Bridge.",
  databank: "Astro-Databank charts aren't supported yet. Chart Bridge opens charts saved in your astro.com account.",
  "unsupported-chart": "Chart Bridge can't read this kind of astro.com chart yet.",
  "no-drawing-link":
    "This astro.com page has no \"Drawing (for subscribers)\" link, which is where Chart Bridge reads the birth data.",
  "local-mean-time": "This chart uses local mean time, which Chart Bridge can't open yet.",
  "calendar-unsupported":
    "This astro.com chart is dated before the Gregorian calendar began on 15 October 1582. Chart Bridge reads Gregorian dates only.",
  "page-url-mismatch": "The page doesn't match its address. Reload the chart and try again.",
  "stellarium-unreadable": "Chart Bridge couldn't read the sky from this Stellarium Web tab.",
};

// Every other refusal means the chart page couldn't be read. They share one
// message and show their code, so a bug report says which check failed.
const UNREADABLE = "Chart Bridge couldn't read this chart page.";

const WARNINGS = {
  "zone-label-unknown": ({ zoneLabel }) =>
    zoneLabel === null
      ? "Astro-Seek printed no zone label, so its Universal Time is used as printed."
      : `Astro-Seek's zone label "${abbreviation(zoneLabel)}" isn't one Chart Bridge can check, so its Universal Time is used as printed.`,
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
    };
  }

  if (result.utcSource === "needs-offset") {
    return {
      state: "enter-offset",
      rows: [localRow, placeRow],
      message: "Astro-Seek didn't print a Universal Time. Enter the UTC offset at the birth place, as ±HH:MM.",
      notes: [...NOTES],
      chart: { local, lat, lng },
    };
  }

  const ready = {
    state: "ready",
    rows: [localRow, ["Offset", offsetText(result.offsetMinutes)], ["UTC", utcText(result.utc)], placeRow],
    warnings: (result.warnings ?? []).map((code) => WARNINGS[code]?.(result) ?? code),
    notes: [clockNote(result.utc, local, timeZone), PRIVACY_NOTE],
    sky: sky(result.utc),
  };
  // An astro.com chart can also open in Astro-Seek. An Astro-Seek page already
  // shows its chart there, and leads to the values to enter in astro.com instead.
  if (result.site === "astro-com") {
    return { ...ready, notes: [...ready.notes, ...ASTRO_SEEK_NOTES], buttons: [...ASTRO_SEEK_BUTTONS] };
  }
  return result.site === "astro-seek" ? { ...ready, next: astroComStep(ready.sky, town) } : ready;
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
  { label: "Open sky", opens: "stellarium" },
  { label: "Open chart in Astro-Seek", opens: "astro-seek" },
];

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
    next: astroComStep(sky, town),
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
    : `astro.com asks for a country and town, not coordinates. Chart Bridge fills in the town ${town}; choose the match nearest this place and check the coordinates astro.com shows.`;

// The sign-in advice is a note, not a step before the form: a signed-in browser
// goes straight on.
const ASTRO_COM_NOTES = [
  "astro.com draws the chart only for a signed-in account. If it asks you to sign in or create a free account, do it in that tab: Chart Bridge keeps these values for it.",
  `Chart Bridge keeps them for ${HOLD_MINUTES} minutes, until it fills them in, or until you cancel or close the browser. Filling in puts them in astro.com's page, and its town search sends a town to astro.com at once; submitting sends the rest.`,
  "The first time, your browser asks to let Chart Bridge read and change www.astro.com pages. It uses that only to fill in the form in the tab it opens. If you say no, it shows the values to fill in yourself.",
];

// The step after the form button that both ways back to the toolbar icon name.
const TOOLBAR_STEP = "click the Chart Bridge icon in the toolbar again to fill in the form.";

// Shown while the form opens behind the popup.
export const ASTRO_COM_BUSY = { state: "astro-com-busy", message: "Opening astro.com's form to fill it in…", notes: [], buttons: [] };

/**
 * The two-click way, when the user declined access to www.astro.com: the
 * values, and a button that only keeps them for the tab it opens.
 *
 * @param {{ utc: string, lat: number, lng: number, town: string | null }} values
 */
export function viewForAstroComManual(values) {
  return {
    state: "astro-com-manual",
    ...astroComValues(values),
    message: "Chart Bridge can't fill in the form without access to www.astro.com.",
    notes: [`After the astro.com tab opens, ${TOOLBAR_STEP}`],
    sky: { utc: values.utc, lat: values.lat, lng: values.lng },
    buttons: [{ label: "Open astro.com's form", url: FORM_URL, holds: { ...values } }],
  };
}

/**
 * The form opened but couldn't be filled in: it didn't load in time, or ended
 * up on another page. On the screenshot page, also a form that needs a choice
 * first, which the popup on its tab offers. Its values are kept for its tab.
 *
 * @param {{ utc: string, lat: number, lng: number, town: string | null }} values
 * @param {"not-filled" | "choose"} [outcome]  openAndFill's
 */
export function viewForAstroComNotFilled(values, outcome = "not-filled") {
  return {
    state: "astro-com-not-filled",
    ...astroComValues(values),
    message:
      outcome === "choose"
        ? "astro.com's form is open, but something needs your choice first, such as signing in."
        : "astro.com's form didn't finish opening, so Chart Bridge couldn't fill it in yet.",
    notes: [`Switch to the astro.com tab, then ${TOOLBAR_STEP}`],
    sky: { utc: values.utc, lat: values.lat, lng: values.lng },
    buttons: [{ label: "Go to the astro.com tab", does: "show-tab" }],
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The secondary button on a screen whose chart can be entered in astro.com.
export const astroComStep = (sky, town = null) => ({ label: "Enter in astro.com…", view: viewForAstroCom(sky, town) });

/**
 * The values to enter in astro.com's birth data form for a decided UTC and
 * place, in the form's own terms, and links to the form and to signing in.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {string | null} [town]  the town the chart names, filled in with the rest
 */
export function viewForAstroCom({ utc, lat, lng }, town = null) {
  const sky = { utc, lat, lng };
  const held = { ...sky, town };
  return {
    state: "to-astro-com",
    ...astroComValues(held),
    message: "Chart Bridge opens astro.com's form and fills it in as it opens. It doesn't submit the form.",
    notes: [
      "The date and time are Universal Time, so they can differ from the local birth date and time.",
      townNote(town),
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
    message: "This form already has a date or time in it. Chart Bridge fills in only a blank form, so it won't change what's there.",
    buttons: [BLANK_FORM, CANCEL],
  },
  unrecognised: {
    state: "astro-com-unrecognised",
    message: "Chart Bridge doesn't recognise this astro.com form, so it can't fill it in. Enter the values above yourself.",
    code: "unrecognised-form",
    buttons: [CANCEL],
  },
};

/**
 * What the popup shows on an astro.com tab Chart Bridge keeps values for.
 * Nothing here happens without a click: the form is filled in only by its
 * button, and no page is opened on the tab's behalf, so a failed sign-in can't
 * start a loop. A browser not seen signed out may be signed in, so it is never
 * held up by a sign-in prompt.
 *
 * @param {{ utc: string, lat: number, lng: number, town: string | null }} sky  from heldForTab
 * @param {{ kind: "form" } & ReturnType<typeof import("./core/astrocom.js").readFormPage> | { kind: "other" }} page
 */
export function viewForAstroComTab(sky, page) {
  const values = astroComValues(sky);
  const copy = (buttons) => buttons.map((button) => ({ ...button }));

  if (page.kind !== "form") {
    return {
      state: "astro-com-waiting",
      ...values,
      message: "Chart Bridge is keeping these values for this tab.",
      notes: ["When you're signed in, open astro.com's birth data form in this tab and click the Chart Bridge icon in the toolbar again to fill it in."],
      sky,
      buttons: copy([{ label: "Open astro.com's form", url: FORM_URL, here: true }, CANCEL]),
    };
  }

  if (Object.hasOwn(UNFILLABLE, page.form)) {
    const { buttons, ...screen } = UNFILLABLE[page.form];
    return { ...screen, ...values, notes: [], sky, buttons: copy(buttons) };
  }

  if (page.auth === "signed-out") {
    return {
      state: "astro-com-sign-in",
      heading: "Sign in to astro.com",
      ...values,
      message:
        "astro.com requires an account to generate charts. Sign in to your existing account or create a free account to continue.",
      notes: [
        "Chart Bridge keeps these values for the astro.com tab while you sign in. Afterwards, open astro.com's form there and click the Chart Bridge icon in the toolbar again.",
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
      sky.town === null
        ? "Chart Bridge fills in the birthday, hour, minute and the 00:00 GMT / UT time zone. Choose the town nearest this place yourself, and check the coordinates astro.com shows."
        : `Chart Bridge fills in the birthday, hour, minute, the 00:00 GMT / UT time zone and the town ${sky.town}. Choose astro.com's match nearest this place, and check the coordinates it shows.`,
      "Chart Bridge doesn't submit the form, and forgets these values once it has filled them in.",
    ],
    sky,
    buttons: copy([{ label: "Fill in the form", does: "fill" }, CANCEL]),
  };
}

// The rows and warnings every astro.com screen shows: the form's values in its own terms.
function astroComValues({ utc, lat, lng, town = null }) {
  const [year, month, day] = utc.slice(0, 10).split("-");
  const seconds = Number(utc.slice(17, 19));
  return {
    rows: [
      ["Birthday", `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`],
      ["Hour, min", utc.slice(11, 16)],
      ["Time zone", "00:00 GMT / UT, under show / hide extended settings"],
      ["Place", placeText(lat, lng)],
      ...(town === null ? [] : [["Town", town]]),
    ],
    warnings: seconds === 0 ? [] : [`astro.com takes whole minutes, so the ${seconds} seconds are left out.`],
  };
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
function offsetText(minutes) {
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
