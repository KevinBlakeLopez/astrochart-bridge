// The interface's English text, by the module that shows it. Every other
// catalog has the same keys, which test/messages.test.js checks. A message
// with values in it is a function of them, so each language can place them
// where its grammar needs. Dates take the day, month (1 to 12) and year as numbers.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const RUNNING = "The clock starts running at once; its pause button stops it.";

// The step after the form button that both ways back to the toolbar icon name.
const TOOLBAR_STEP = "click the AstroChart Bridge icon in the toolbar again to fill in the form.";

export default {
  view: {
    code: (code) => `Code: ${code}`,
    cancel: "Cancel",
    offsetPlaceholder: "e.g. -04:00",
    offsetLabel: "UTC offset",
    offsetPreview: (utc) => `UTC: ${utc}`,
  },

  popup: {
    // A refusal's code says which site it came from (transit and synastry only
    // from Astro-Seek; databank and the four after it only from astro.com), so
    // each message can name its site without being told it.
    refusals: {
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
    },
    unreadable: "AstroChart Bridge couldn't read this chart page.",
    // popup.js's own, for a tab or chart that failed in a way no reader names.
    tabUnreadable: "AstroChart Bridge couldn't read this tab.",
    chartUnshowable: "AstroChart Bridge couldn't show this chart.",

    // "17 Apr 2024"
    shortDate: (day, month, year) => `${day} ${MONTHS[month - 1]} ${year}`,
    // "17 April 2024"
    longDate: (day, month, year) => `${day} ${MONTH_NAMES[month - 1]} ${year}`,
    // "05:00 on 17 Apr"
    timeOnDay: (time, day, month) => `${time} on ${day} ${MONTHS[month - 1]}`,
    // The letters after a latitude and longitude, the way the Astro-Seek page writes them.
    compass: { north: "N", south: "S", east: "E", west: "W" },
    // "a, b and c"
    and: (items) => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`),

    rows: {
      localTime: "Local time",
      place: "Place",
      offset: "Offset",
      utc: "UTC",
      stellariumTime: "Stellarium time",
      gender: "Gender",
    },
    // "05:00 on 17 Apr 2024, your computer's time"
    stellariumTimeValue: (time, day, month, year) => `${time} on ${day} ${MONTHS[month - 1]} ${year}, your computer's time`,
    genders: { female: "Female", male: "Male", event: "Event" },

    buttons: {
      openSky: "Open Stellarium Web",
      openInAstroSeek: "Open chart in Astro-Seek",
      saveInAstroSeek: "Save in Astro-Seek…",
      openAstroSeekForm: "Open Astro-Seek's form",
      astroSeekTab: "Go to the Astro-Seek tab",
      share: "Share…",
      enterInAstroCom: "Enter in astro.com…",
      openAstroComForm: "Open astro.com's form",
      signIn: "Sign in",
      createAccount: "Create account",
      astroComTab: "Go to the astro.com tab",
      blankForm: "Open a blank form",
      fillAnyway: "Fill in anyway",
      fillForm: "Fill in the form",
      cancel: "Cancel",
    },
    // The labels over a screen's two kinds of action, when it has both.
    groups: { sky: "See the sky", elsewhere: "Take the chart elsewhere" },
    // The buttons keep their verbs, so each says what it does without its label.
    otherWays: {
      read: "Read a chart you have",
      screenshot: "Read a screenshot",
      paste: "Paste chart text",
      file: "Open an AAF or Morinus file",
      bridgeFile: "Open an AstroChart Bridge file",
      desktop: "Or use the sky in Stellarium Desktop",
      importFromDesktop: "Import from Stellarium Desktop",
      more: "Read a different chart",
    },

    clockNote: "Stellarium Web's clock shows your computer's time zone and keeps running.",
    // Seen on 2026-10-31: stellarium-web.org's Google Ads tag sent the full link,
    // date and coordinates included, as its url= parameter.
    privacyNote:
      "Opening the sky sends this date, time and place to stellarium-web.org, and its page passes the link on to Google's advertising tags.",
    clockSame: (clock) => `Stellarium Web's clock will show ${clock}, the same as the birthplace. ${RUNNING}`,
    clockDiffers: (clock, birth) => `Stellarium Web's clock will show ${clock}, your computer's time. That's ${birth} at the birthplace. ${RUNNING}`,
    // label is the zone label's abbreviation, or null when Astro-Seek printed none.
    zoneLabelUnknown: (label) =>
      label === null
        ? "Astro-Seek printed no zone label, so its Universal Time is used as printed."
        : `Astro-Seek's zone label "${label}" isn't one AstroChart Bridge can check, so its Universal Time is used as printed.`,
    contradicts: (time, label, offset) =>
      `Astro-Seek's page contradicts itself: it labels ${time} as ${label}, but its Universal Time implies ${offset}.`,
    asPrinted: (utc, offset) => `${utc} UTC, as Astro-Seek printed (${offset})`,
    asLabelled: (utc, label, offset) => `${utc} UTC, as the label ${label} says (${offset})`,
    needsOffset: "Astro-Seek didn't print a Universal Time. Enter the UTC offset at the birth place, as ±HH:MM.",

    astroSeekNotes: [
      "Astro-Seek will draw this chart in UT/GMT at these coordinates, rounded to the minute, with no city.",
      "Opening the chart sends this date, time and place to astro-seek.com.",
    ],
    astroSeekSaveNote: "Opening or saving sends this date, time and place to astro-seek.com.",
    astroSeekSaveNamedNote:
      "Opening or saving sends this date, time and place to astro-seek.com; saving also sends the chart's name and town, if it has them.",
    astroSeekSaveBusy: "Opening Astro-Seek's Add person form…",
    // By openAndSave's outcome, or its page for "not-filled".
    saveMessages: {
      "signed-out": "Astro-Seek shows you signed out, and saves a chart only in an account. Sign in in its tab, then click Save in Astro-Seek… again.",
      elsewhere: "Astro-Seek didn't show its Add person form. If it asks you to sign in, sign in, then click Save in Astro-Seek… again.",
      "not-loaded": "Astro-Seek's form didn't finish opening in time, so AstroChart Bridge didn't choose its town.",
      "city-typed": "Astro-Seek's form already had a Birth city, so AstroChart Bridge left it as it was.",
      unrecognised: "AstroChart Bridge didn't recognise Astro-Seek's form, so it didn't choose its town.",
    },
    checkNote:
      "Before Add person, choose the Birth city in Astro-Seek's list if it isn't, then check that the coordinates and UT/GMT are still the chart's.",
    saveDeclined: "AstroChart Bridge can't choose the town in Astro-Seek's form without access to www.astro-seek.com.",
    saveDeclinedNote: (named) => `The form opens with this date, time and place in UT/GMT${named ? ", and the name" : ""}.`,

    shareBeforeGregorian:
      "AstroChart Bridge can't share a chart dated before 15 October 1582 yet: it can't tell which calendar the date is in.",
    shareRefused: "AstroChart Bridge can't share this chart.",

    // town is what AstroChart Bridge types in, or null.
    townNote: (town) =>
      town === null
        ? "astro.com asks for a country and town, not coordinates. Choose the town nearest this place and check the coordinates astro.com shows."
        : `astro.com asks for a country and town, not coordinates. AstroChart Bridge fills in the town ${town}; choose the match nearest this place and check the coordinates astro.com shows.`,
    // The same on a page that can't fill in the form, for a chart with a town.
    townByHandNote: (town) =>
      `astro.com asks for a country and town, not coordinates. Type the town ${town}, choose the match nearest this place and check the coordinates astro.com shows.`,
    signInNote:
      "astro.com draws the chart only for a signed-in account. If it asks you to sign in or create a free account, do it in that tab: AstroChart Bridge keeps these values for it.",
    keepsNote: (minutes) =>
      `AstroChart Bridge keeps them for ${minutes} minutes, until it fills them in, or until you cancel or close the browser. Filling in puts them in astro.com's page, and its town search sends a town to astro.com at once; submitting sends the rest.`,
    accessNote:
      "The first time, your browser asks to let AstroChart Bridge read and change www.astro.com pages. It uses that only to fill in the form in the tab it opens. If you say no, it shows the values to fill in yourself.",
    afterTabOpens: `After the astro.com tab opens, ${TOOLBAR_STEP}`,
    switchToTab: `Switch to the astro.com tab, then ${TOOLBAR_STEP}`,
    astroComBusy: "Opening astro.com's form to fill it in…",
    noAccess: "AstroChart Bridge can't fill in the form without access to www.astro.com.",
    formNeedsChoice: "astro.com's form is open, but something needs your choice first, such as signing in.",
    formNotOpened: "astro.com's form didn't finish opening, so AstroChart Bridge couldn't fill it in yet.",
    nameNote:
      "The name goes in astro.com's first and last name fields, and you can change it here first. A name in one piece goes in First name, which astro.com won't save a chart without.",
    // fields are astroComRows' names of the boxes too long.
    nameWarning: (length, fields) =>
      `astro.com's name fields take ${length} characters. Shorten ${fields} here, or astro.com may cut it short.`,
    byHand: "Type these into astro.com's form. This page can't fill it in for you.",
    fillsAsItOpens: "AstroChart Bridge opens astro.com's form and fills it in as it opens. It doesn't submit the form.",
    universalTimeNote: "The date and time are Universal Time, so they can differ from the local birth date and time.",
    typedForm: "This form already has a date or time in it. AstroChart Bridge fills in only a blank form, so it won't change what's there.",
    unrecognisedForm: "AstroChart Bridge doesn't recognise this astro.com form, so it can't fill it in. Enter the values above yourself.",
    keepingForTab: "AstroChart Bridge is keeping these values for this tab.",
    whenSignedIn:
      "When you're signed in, open astro.com's birth data form in this tab and click the AstroChart Bridge icon in the toolbar again to fill it in.",
    signInHeading: "Sign in to astro.com",
    requiresAccount:
      "astro.com requires an account to generate charts. Sign in to your existing account or create a free account to continue.",
    keepsWhileSigningIn:
      "AstroChart Bridge keeps these values for the astro.com tab while you sign in. Afterwards, open astro.com's form there and click the AstroChart Bridge icon in the toolbar again.",
    fillQuestion: "Fill in astro.com's form with these values?",
    // What filling in sets, for fillNote: "the birthday, hour, minute, the 00:00
    // GMT / UT time zone and the town Sydney". The automatic time zone is the
    // form's default, so it isn't named.
    filled: {
      birthday: "the birthday",
      hour: "hour",
      minute: "minute",
      universalTime: "the 00:00 GMT / UT time zone",
      name: "the name",
      gender: "the gender",
      town: (town) => `the town ${town}`,
    },
    fillNote: (filled, hasTown) =>
      `AstroChart Bridge fills in ${filled}. ` +
      (hasTown
        ? "Choose astro.com's match nearest this place, and check the coordinates it shows."
        : "Choose the town nearest this place yourself, and check the coordinates astro.com shows."),
    doesntSubmit: "AstroChart Bridge doesn't submit the form, and forgets these values once it has filled them in.",

    // The rows of an astro.com screen, named as astro.com's form names its fields.
    astroComRows: {
      birthday: "Birthday",
      hourMin: "Hour, min",
      timeZone: "Time zone",
      town: "Town",
      firstName: "First name",
      lastName: "Last name",
      gender: "Gender",
    },
    universalTimeZone: "00:00 GMT / UT, under show / hide extended settings",
    automaticZone: "automatic time zone, the form's default",
    wholeMinutes: (seconds) => `astro.com takes whole minutes, so the ${seconds} seconds are left out.`,
    // zone is astro.com's words for it with the offset: "4 h west (UTC-04:00)".
    zoneUnchecked:
      "The date and time are the chart's local time, and astro.com's automatic time zone looks up the zone for the town you choose. " +
      "AstroChart Bridge has no UTC offset to check it against, so check the time zone astro.com shows for the town and date.",
    zoneChecked: (zone) =>
      "The date and time are the chart's local time, and astro.com's automatic time zone looks up the zone for the town you choose. " +
      `It should be ${zone}: AstroChart Bridge checks it on the page once you choose the town, and offers Universal Time there if it isn't.`,
    zoneToCheck: (zone, date, time) =>
      "The date and time are the chart's local time, and astro.com's automatic time zone looks up the zone for the town you choose. " +
      `Check that it's ${zone}. If it isn't, choose 00:00 GMT / UT under show / hide extended settings and enter ${date}, ${time} instead.`,
  },
};
