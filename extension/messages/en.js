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

const NEWER = "This chart was made by a newer version of AstroChart Bridge, which this page can't read.";
const NEWER_FILE = "This file was made by a newer version of AstroChart Bridge, which this page can't read.";
const BEFORE_GREGORIAN = "This chart's date is before 15 October 1582, which AstroChart Bridge can't open yet.";
const PRE_GREGORIAN = "AstroChart Bridge opens dates from 15 October 1582 on, when the Gregorian calendar began.";
const QR_TOO_LONG = "This link is too long for a QR code that scans reliably.";
const ELEVATION_RANGE = "Enter whole metres, from -500 to 25000.";

// "a, b and c"
const and = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

export default {
  // The pages' own text: their HTML's data-text and data-label (localizePage),
  // and what their scripts say themselves.
  pages: {
    popup: {
      title: "AstroChart Bridge",
      reading: "Reading the page…",
      version: (number) => `AstroChart Bridge ${number}`,
    },
    // The site's home page, index.html. Its links say what each page's own heading says.
    home: {
      intro:
        "Bring in a chart's birth data, then open its sky in Stellarium Web, open the chart in Astro-Seek, or see which planets were visible.",
      privacy:
        "Charts are read on this device, and nothing is sent until you open the sky or the chart. This site keeps copies of its own files on this device so that it works offline, but never a chart.",
    },
    screenshot: {
      title: "AstroChart Bridge: read a screenshot",
      heading: "Read a chart screenshot",
      intro:
        "Paste (⌘V) or drop a screenshot of an Astro-Seek birth chart page, an astro.com chart drawing, a Solar Fire wheel, Astro Gold's Chart Details, a Morinus chart, a Valens wheel, a Planetdance chart, Jagannatha Hora's birth data, a Kepler or Sirius wheel, a Janus or Win*Star wheel, a TimePassages chart or an Astrolog wheel anywhere on this page, or choose a file. From Astro-Seek it needs everything from Date of Birth to Latitude, Longitude; from astro.com, the drawing's header from the date to Sid. Time; from Solar Fire or Astro Gold, the chart details from the date to the coordinates; from Morinus, its status bar or the middle of its square chart; from Valens, the middle of its wheel; from Planetdance, the lines at the top left of the wheel, down to St:; from Jagannatha Hora, the birth data from Date to Sidereal Time; from Kepler or Sirius, the data block from the name to the Time Zone; from Janus, the middle of the wheel from the date to the coordinates; from Win*Star, the upper right of the wheel from the date to the latitude; from TimePassages, the whole chart, with its corners; from Astrolog, the top of the sidebar from the date to the Julian Day. The whole page is fine.",
      choose: "Choose a screenshot",
      privacy: "The screenshot is read on this computer and isn't sent anywhere.",
      whatWasRead: "What AstroChart Bridge read",
      reading: "Reading the screenshot…",
      unreadable: "AstroChart Bridge couldn't read this image.",
    },
    paste: {
      title: "AstroChart Bridge: paste chart text",
      heading: "Paste chart text",
      intro:
        'Paste birth data copied from an astrology program, a report or a note, in labelled lines such as "Date of Birth: 15 June 1985" or "latitude=47.6062".',
      textLabel: "Chart text",
      read: "Read the text",
      fromClipboard: "Paste from clipboard",
      privacy: "The text is read on this computer and isn't sent or saved anywhere.",
      clipboardRefused: "Your browser didn't let AstroChart Bridge read the clipboard. Click the box above and paste with ⌘V or Ctrl+V instead.",
      continue: "Continue",
      continueToAstroCom: "Continue to astro.com",
      alsoInText: "Also in the text:",
      back: "Back to the form",
    },
    import: {
      title: "AstroChart Bridge: open an AAF or Morinus file",
      heading: "Open an AAF or Morinus file",
      intro:
        "Choose or drop an AAF (.aaf) file or a Morinus chart (.hor) anywhere on this page, or paste an AAF file's text below. Astrolog and other astrology programs save charts in AAF.",
      choose: "Choose an AAF or Morinus file",
      textLabel: "AAF text",
      read: "Read pasted text",
      privacy: "The file is read on this computer and isn't sent anywhere.",
    },
    chart: {
      title: "AstroChart Bridge: open a chart",
      readingLink: "Reading the link…",
      linkLabel: "Link to this chart",
      openFile: "Open an AstroChart Bridge file",
      fileLabel: "Chart file",
      privacy:
        "A chart's link holds the chart itself, and so does its file. Anyone with either can read it, so share them only with people who should see this birth data. This page reads them on this device, keeps nothing, and sends nothing until you open the sky or the chart.",
      opened: (name) => `Opened ${name}.`,
      couldntPass: "AstroChart Bridge couldn't pass the file on. Click Open an AAF or Morinus file in the popup and choose it there.",
      linkCopied: "Link copied.",
      copyRefused: "This browser didn't let AstroChart Bridge copy the link. Copy it from here instead:",
      hideQr: "Hide QR code",
      shareSheetFailed: "AstroChart Bridge couldn't open the share sheet. Use Copy link or Download file instead.",
    },
    helioscope: {
      title: "AstroChart Bridge: which planets were visible",
      heading: "Which planets were visible",
      elevation: "Elevation in metres",
      underTheBeams: "Under the beams within",
      working: "Working out the planets…",
      notice:
        "AstroChart Bridge, © 2026 Kevin Blake Lopez, works this out on this device with Swiss Ephemeris, © 1997–2021 Astrodienst AG, through swisseph-wasm. All three are free software: you may share and change them under the GNU Affero General Public License, version 3 or later. They come with no warranty.",
      source: "Source code and licence",
    },
    // astro-com-page.js's, on the pages that stay open while a form fills in.
    astroComFilled: "AstroChart Bridge filled in astro.com's form in its tab.",
    astroSeekFilled: "AstroChart Bridge filled in Astro-Seek's form in its tab. Check Gender there, then press Add person.",
  },

  view: {
    code: (code) => `Code: ${code}`,
    cancel: "Cancel",
    offsetPlaceholder: "e.g. -04:00",
    offsetLabel: "UTC offset",
    offsetPreview: (utc) => `UTC: ${utc}`,
  },

  popup: {
    // A refusal's code says which site it came from (transit and synastry only
    // from Astro-Seek; databank and the three after it only from astro.com), so
    // each message can name its site without being told it. calendar-unsupported
    // comes from both, so its message names neither.
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
        "This chart is dated before the Gregorian calendar began on 15 October 1582. AstroChart Bridge reads Gregorian dates only.",
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
    and,

    rows: {
      localTime: "Local time",
      place: "Place",
      town: "Town",
      name: "Name",
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
      helioscope: "Which planets were visible",
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
    astroSeekDateLine: "Astro-Seek can't take a longitude of 180°, so it gets 179°59' on the same side, 1 arcminute away.",
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
    saveByHand: "This page can't choose the town in Astro-Seek's form for you.",

    shareBeforeGregorian:
      "AstroChart Bridge can't share a chart dated before 15 October 1582 yet: it can't tell which calendar the date is in.",
    shareRefused: "AstroChart Bridge can't share this chart.",
    helioscopeBeforeGregorian:
      "AstroChart Bridge can't work out the planets for a chart dated before 15 October 1582 yet: it can't tell which calendar the date is in.",
    helioscopeRefused: "AstroChart Bridge can't work out the planets for this chart.",

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

  desktop: {
    send: "Send to Stellarium Desktop",
    nowDefault: "Stellarium Desktop is now your default for charts. Every chart screen has a link to change it back.",
    undo: "Undo",
    isDefault: "Stellarium Desktop is your default for charts.",
    makeWebDefault: "Make Stellarium Web the default",
    webDefaultAgain: "Stellarium Web is the default again.",
    useByDefault: "Use Stellarium Desktop by default",
    // The line under the desktop buttons once the popup has checked
    // Stellarium on opening, by probe's result.
    hints: {
      connected: "Stellarium Desktop is open and ready.",
      unavailable: "Stellarium Desktop isn't reachable right now. The button shows how to set it up.",
      "auth-required": "Stellarium asks for a password, which AstroChart Bridge doesn't use. The button shows how to turn it off.",
      "invalid-response": "Something other than Stellarium is answering on port 8090.",
      "stellarium-not-earth": "Stellarium's observer is on another planet.",
    },
    noAnswer: "Stellarium Desktop didn't answer.",
    sending: "Sending to Stellarium Desktop…",
    reading: "Reading Stellarium Desktop…",
    // Stellarium 25.1, seen on 2026-11-01. The plugin loads only when
    // Stellarium starts, which is why it has to be quit and opened again, and
    // its server is off until ticked. The labels are the settings window's own.
    setupSteps: [
      "Open Stellarium and press F2 (fn+F2 on many Mac keyboards) for its Configuration window.",
      "On the Plugins tab, select Remote Control and tick Load at startup.",
      "Quit Stellarium and open it again: the plugin loads only when Stellarium starts.",
      "Press F2 again, select Remote Control on the Plugins tab and click Configure.",
      "Tick Server enabled, and Enable automatically on startup so you don't have to next time. Leave Port Number at 8090 and Access requires authentication unticked, then click Save settings.",
      "Come back here and click Try again.",
    ],
    // Stellarium's settings window shows the address it listens on, which is
    // the computer's network address, not only this computer.
    networkNote:
      "While its server is on, other devices on your network can control Stellarium too. Untick Server enabled when you're done if that matters on this network.",
    // What each failure says. Text with a direction differs between sending and importing.
    problems: {
      unavailable: {
        heading: "Stellarium Desktop isn't reachable",
        message: "Stellarium Desktop could not be reached. Open Stellarium and enable its Remote Control plugin.",
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
    },
    mismatchNames: { time: "time", "clock-running": "paused clock", latitude: "latitude", longitude: "longitude" },
    // names are mismatchNames', or the codes it doesn't know.
    mismatch: (names) =>
      `After sending, Stellarium's ${and(names)} didn't match the chart. Try again, and check Stellarium isn't busy with a script.`,
    tryAgain: "Try again",
    sentHeading: "Sent to Stellarium Desktop",
    sentNotes: [
      "Stellarium's clock is paused at this moment. Its play button, or K, starts it again.",
      "Stellarium shows the time in its own time zone, which this doesn't change, so its clock may not show the birthplace's local time. The UTC above is the moment it was given.",
      "Stellarium names the place by its coordinates.",
    ],
    done: "Done",
    fromHeading: "From Stellarium Desktop",
    pauseNote: "If Stellarium's clock is running, pause it and import again, so the chart is the moment you chose.",
  },

  // The screenshot page. A program's own words, which its reader looks for,
  // stay as the program prints them in every language: the readers read
  // English screenshots only.
  screenshot: {
    // Each refusal analyzeScreenshot can return.
    refusals: {
      "unreadable-screenshot":
        "AstroChart Bridge couldn't find the birth data in this screenshot. From Astro-Seek, include everything from Date of Birth to Latitude, Longitude; from astro.com, the chart's header from the date to Sid. Time; from Solar Fire or Astro Gold, the chart details from the date to the coordinates; from Morinus, its status bar or the middle of its square chart; from Valens, the middle of its wheel; from Planetdance, the lines at the top left of the wheel, down to St:; from Jagannatha Hora, the birth data from Date to Sidereal Time; from Kepler or Sirius, the data block from the name to the Time Zone; from Janus, the middle of the wheel from the date to the coordinates; from Win*Star, the upper right of the wheel from the date to the latitude; from TimePassages, the whole chart, with its corners; from Astrolog, the top of the sidebar from the date to the Julian Day. Take it at full size.",
      "no-coordinates":
        "This screenshot has no coordinates. Astro Gold's chart wheel doesn't print them: take its Chart Details panel or Edit Chart screen instead. From Solar Fire, include the chart details down to the coordinates.",
      "ambiguous-screenshot": "This screenshot shows more than one chart. AstroChart Bridge opens natal charts only.",
      "sidereal-mismatch":
        "The sidereal time in this screenshot doesn't match its Universal Time and longitude, so one of them was probably misread. Try a larger screenshot.",
      "offset-out-of-range":
        "The local time in this screenshot is too far from its Universal Time, so one of them was probably misread. Try a larger screenshot.",
      "weekday-mismatch":
        "The weekday in this screenshot doesn't fall on its date, so the date was probably misread. Try a larger screenshot.",
      "zone-offset-mismatch":
        "The time zone in this screenshot doesn't match its UTC offset, so one of them was probably misread. Try a larger screenshot.",
      "calendar-unsupported":
        "This chart is dated before the Gregorian calendar began on 15 October 1582, or marked Old Style or BC. AstroChart Bridge reads Gregorian dates only.",
      "apparent-time": "This chart uses local apparent time, which AstroChart Bridge can't open yet.",
      "offset-off-quarter-hour":
        "The sidereal time in this screenshot gives a UTC offset that isn't on a quarter hour, so its longitude was probably misread. Try a larger screenshot. A chart in one of the few zones off the quarter hour, such as Amsterdam's before 1940, can't be read from a TimePassages screenshot yet.",
      "true-local-time-mismatch":
        "The TLT in this screenshot doesn't match its sidereal time and longitude, so one of them was probably misread. Try a larger screenshot.",
      "local-time-ambiguous":
        "This chart's time is marked LC, which Morinus and Valens print for both local mean time and local apparent time. AstroChart Bridge can't tell which, so it can't open it yet.",
      "chart-type-unsupported": "This is a return, profection or direction chart. AstroChart Bridge opens natal and horary charts only.",
    },
    // Two programs a reader can't tell apart: "Solar Fire or Astro Gold".
    either: (a, b) => `${a} or ${b}`,
    offsetUnchecked: (program) =>
      `Nothing in this ${program} screenshot checks its UTC offset. Compare the Offset row with the screenshot.`,
    // A program's time is its clock, so the offset to enter takes in daylight saving.
    noOffset: (program) =>
      `${program} doesn't print the UTC offset. Enter the offset at the birth place, including daylight saving, as ±HH:MM.`,
    // OCR can misread, and the latitude is the one number no check covers.
    compareNote: "Read from a screenshot. Compare these rows with it before opening the sky: nothing checks the latitude.",
  },

  // The paste page. readText reads English labels, dates and compass letters
  // only, so the examples of what to type are ones it reads, in every language.
  paste: {
    tooLong: (max) => `This text is too long. Paste only the part with the birth data, up to ${max.toLocaleString("en-US")} characters.`,
    refusals: {
      "no-birth-data":
        'AstroChart Bridge found no birth data in this text. It reads labelled lines such as "Date of Birth: 15 June 1985" or "latitude=47.6062".',
      "several-records": "This text has more than one birth date or name, so it may hold more than one chart. Paste one chart at a time.",
    },
    // The form's fields: each one's label, and what to type.
    fields: {
      date: { label: "Date", example: "1985-06-15 or 15 June 1985" },
      time: { label: "Local time", example: "10:30 or 10:30 AM" },
      lat: { label: "Latitude", example: "47.6062 or 47°36'N" },
      lng: { label: "Longitude", example: "-122.3321 or 122°19'W" },
      offset: { label: "UTC offset", example: "-07:00, daylight saving included" },
    },
    // The other fields readText finds, shown as written.
    info: {
      name: "Name",
      place: "Place",
      country: "Country",
      gender: "Gender",
      zone: "Time zone",
      houses: "Houses",
      zodiac: "Zodiac",
      ayanamsa: "Ayanamsa",
    },
    formNote: "Check each value against the text. Nothing is sent until you open the sky or the chart.",
    placeNote:
      "AstroChart Bridge doesn't look places up. Stellarium Web, Astro-Seek's chart and Share use the latitude and longitude; astro.com's form and Save in Astro-Seek… get the town, for their own lists to look up.",
    noOffsetNote:
      "With the UTC offset left empty, the chart can open only in astro.com, which looks up the time zone for the town. Stellarium Web, Astro-Seek and Share need the offset.",
    localOnlyNote:
      "No UTC offset was entered, so this chart can open only in astro.com. Go back to the form and enter one to open it in Stellarium Web or Astro-Seek, or to share it.",
    offsetNote: "Nothing checks that this offset was in use at the birthplace on that date.",
    // Why a desktop program's reader turned down text laid out as its program's, after "but".
    programRefusals: {
      "no-coordinates": "it has no coordinates",
      "ambiguous-screenshot": "it can be read as more than one program's, or more than one chart",
      "sidereal-mismatch": "its sidereal time doesn't fit its time, offset and longitude",
      "offset-out-of-range": "its local time is too far from its Universal Time",
      "weekday-mismatch": "its weekday doesn't fall on its date",
      "zone-offset-mismatch": "its time zone doesn't match its UTC offset",
      "calendar-unsupported":
        "it's dated before the Gregorian calendar began on 15 October 1582, or Old Style or BC, and AstroChart Bridge reads Gregorian dates only",
      "apparent-time": "it uses local apparent time, which AstroChart Bridge can't open yet",
      "local-time-ambiguous": "its time is marked LC, which can mean local mean or local apparent time",
      "chart-type-unsupported": "it's a return, progression or other chart that isn't the birth",
      "offset-off-quarter-hour": "its sidereal time gives a UTC offset that isn't on a quarter hour",
      "true-local-time-mismatch": "its true local time doesn't fit its sidereal time and longitude",
    },
    programRefused: "it doesn't pass that program's checks",
    turnedDown: (why, code) =>
      `This text is laid out like an astrology program's or site's, but ${why}, so AstroChart Bridge didn't use that program's reading (${code}). Check each value against the text.`,
    offsetUnchecked: (program) => `Nothing in this ${program} text checks its UTC offset. Compare the offset with the text.`,
    readAs: (program) => `Read as ${program}'s text: its birth data is laid out the way ${program} prints it.`,
    westPlus: (program) => `${program} writes offsets west of Greenwich with a plus sign, so its +7:00 is UTC-07:00 here.`,
    programNoOffset: (program) =>
      `${program} doesn't print the UTC offset. Enter the offset at the birthplace on that date, including daylight saving.`,
    asProgram: (value, program) => `${value} (as ${program}'s text)`,
    readAsSource: (program) => `Read as ${program}'s text.`,
    lineReadAs: (line, text, program) => `Line ${line}: ${text}, read as ${program}'s text.`,
    readsDifferently: (line, program) => `Line ${line} reads differently from ${program}'s layout. Pick the one the text means.`,
    onLine: (value, line) => `${value} (line ${line})`,
    zoneNoOffset: (zone) => `The text names the zone "${zone}" but gives no offset. Enter the offset at the birthplace on that date.`,
    notInText: "Not in the pasted text.",
    differentLines: (lines) => `The text gives different values on lines ${lines.join(" and ")}.`,
    line: (line, text) => `Line ${line}: ${text}`,
    eitherDate: (source) => `${source}. This could be either date.`,
    couldBe: (dates) => `This could be ${dates.join(" or ")}. Write the month's name, or the year first.`,
    cantRead: (example) => `AstroChart Bridge can't read this. Try ${example}.`,
    // Under a date that reads but is before the Gregorian calendar began.
    preGregorian: PRE_GREGORIAN,
    houses: (houses) => `The text uses ${houses} houses, but Astro-Seek's chart will open with Placidus houses.`,
    sidereal: "The text uses the sidereal zodiac. AstroChart Bridge doesn't pass it on, so set it in Astro-Seek's chart.",
    // A field written differently on different lines: "10:30 or 10:45".
    or: (items) => items.join(" or "),
    atBirthplace: (time) => `${time} at the birthplace`,
  },

  // What the import page's AAF and Morinus screens share.
  files: {
    oneChart: "1 chart in this file.",
    unnamed: "Unnamed chart",
    birthplace: "Birthplace",
    // A record's date as the file writes it, so a chart that can't open is still recognisable.
    recordDate: (day, month, year) => `${day} ${MONTHS[month - 1]} ${year}`,
  },

  // AAF files. The file's own text is AAF's, in every language.
  aaf: {
    // Why chartFromRecord refused a record.
    refusals: {
      "no-birth-date": "This chart has no birth date: the file gives *.",
      "no-birth-time": "This chart has no birth time: the file gives *. AstroChart Bridge doesn't guess one.",
      "julian-calendar": "This date is in the Julian calendar, which AstroChart Bridge can't open yet.",
      "pre-gregorian-date": PRE_GREGORIAN,
      "no-coordinates": "This chart has no coordinates, so there is no sky to open.",
      "local-mean-time": "This chart uses local mean time, which AstroChart Bridge can't open yet.",
      "meridian-time": "This chart uses a special meridian, such as a capital's local time, which AstroChart Bridge can't open yet.",
      "unknown-daylight-saving":
        "This chart doesn't say whether daylight saving was in effect: its time type is *. AstroChart Bridge doesn't guess.",
      "no-offset": "This chart gives no UTC offset, so its Universal Time can't be worked out. AstroChart Bridge doesn't guess one.",
      "offset-seconds": "This chart's offset has seconds in it, which AstroChart Bridge can't open yet.",
      "offset-out-of-range": "This chart's offset, daylight saving included, is outside -12:00 to +14:00.",
      "julian-day-mismatch":
        "The file's Julian Day doesn't match its date, time and offset, so AstroChart Bridge can't tell which is right.",
    },
    // What parseAaf couldn't read, for couldntRead's what.
    unreadable: {
      "a93-fields": "the #A93 line, which needs seven fields,",
      "b93-fields": "the #B93 line, which needs five fields,",
      "bad-date": "the date",
      "bad-time": "the time",
      "bad-julian-day": "the Julian Day",
      "bad-latitude": "the latitude",
      "bad-longitude": "the longitude",
      "bad-offset": "the offset",
      "bad-time-type": "the time type",
      "duplicate-b93": "a second #B93 line",
      "duplicate-znam": "a second #ZNAM line",
      "bad-chunk": "the line",
    },
    thisRecord: "this record",
    couldntRead: (line, what, value) => `Line ${line}: AstroChart Bridge couldn't read ${what} "${value}".`,
    hourOnly: (time) => `The AAF file gives this birth time to the hour only, so the chart is drawn for ${time}.`,
    unreadableRecord: (line) => `Line ${line}: unreadable record`,
    noRecords: "AstroChart Bridge found no AAF records. Each record starts with a line beginning #A93:.",
    charts: (count) => `${count} charts in this file. Choose one.`,
    save: "Save as AAF file",
    // Why a saved file is in Universal Time: a chart's page doesn't say how
    // its offset splits into standard time and daylight saving.
    utNotes: {
      chart:
        "The AAF file gives this chart in Universal Time, since the page doesn't say how its offset splits into standard time and daylight saving.",
      sky: "The AAF file gives this moment in Universal Time, since Stellarium Web shows no birthplace time zone.",
    },
    dateUnknown: "date unknown",
    timeUnknown: "time unknown",
    notUtf8: "This file isn't UTF-8, so AstroChart Bridge read it as Windows-1252. Check that accented letters in names look right.",
  },

  // Morinus .hor files.
  hor: {
    // Why chartFromHor refused a chart.
    refusals: {
      "chart-type-unsupported":
        "This is a Morinus chart of another kind, such as a solar return or a transit. AstroChart Bridge opens radix and horary charts only.",
      "bce-date": "This chart's date is BC, which AstroChart Bridge can't open yet.",
      "julian-calendar": "This date is in the Julian calendar, which AstroChart Bridge can't open yet.",
      "pre-gregorian-date": PRE_GREGORIAN,
      "bad-date": "This chart's date isn't on the calendar, such as 30 February.",
      "local-mean-time": "This chart is in local mean time, which AstroChart Bridge can't open yet.",
      "local-apparent-time": "This chart is in local apparent time, sundial time, which AstroChart Bridge can't open yet.",
      "bad-coordinates": "This chart's coordinates are past 90° of latitude or 180° of longitude.",
      "offset-out-of-range": "This chart's offset, daylight saving included, is outside -12:00 to +14:00.",
    },
    cantOpen: "AstroChart Bridge can't open this chart.",
    // Why parseHor couldn't read the file, given fieldWords' words for the field it stopped at.
    unreadable: {
      "too-large": () => "This file is far bigger than a Morinus chart, so AstroChart Bridge didn't read it.",
      truncated: (field) => `This file stops partway through its ${field}, so it may have been cut short.`,
      "trailing-data": () => "This file goes on after the chart, which a Morinus chart file doesn't, so it may not be one.",
      "unsupported-opcode": (field) =>
        `At its ${field}, this file holds something other than text, a number or yes or no, which is all a Morinus chart holds. AstroChart Bridge didn't read it.`,
      malformed: (field) => `AstroChart Bridge couldn't read this file at its ${field}. It may not be a Morinus chart file.`,
      "bad-text": (field) => `At its ${field}, this file has text that can't be read. It may not be a Morinus chart file.`,
      "field-type": (field) => `At its ${field}, this file has a kind of value Morinus doesn't save there, so it may not be a Morinus chart file.`,
      "field-range": (field) => `At its ${field}, this file has a value outside what Morinus allows, so it may not be a Morinus chart file.`,
    },
    couldntReadFile: "AstroChart Bridge couldn't read this file.",
    // The fields in words, for "its notes" or "its zone hours".
    fieldWords: {
      name: "name", male: "sex", htype: "chart type", bc: "BC box", year: "year", month: "month", day: "day",
      hour: "hour", minute: "minute", second: "second", cal: "calendar", zt: "time type", plus: "zone direction",
      zh: "zone hours", zm: "zone minutes", daylightsaving: "daylight saving box", place: "place",
      deglon: "longitude", minlon: "longitude", seclon: "longitude", east: "longitude",
      deglat: "latitude", minlat: "latitude", seclat: "latitude", north: "latitude", altitude: "altitude", notes: "notes",
    },
    warnings: {
      "text-encoding-guessed":
        "This file was saved by an older Morinus, which doesn't record how it wrote accented letters. Check that the name and place look right.",
      "daylight-saving-on-ut":
        "Morinus has this chart in Greenwich time with daylight saving ticked, so it takes an hour off the time entered, and so does AstroChart Bridge.",
      "longitude-seconds-ignored-by-morinus":
        "The file gives the longitude to the second, but Morinus leaves the seconds out when it opens the file, so its chart is drawn up to 59\" east or west of this one.",
    },
    zoneNote:
      "Morinus saves the offset entered for a chart, not its time zone, so nothing here checks that offset against the birthplace and date.",
    // A Greenwich time is written as it is, so the AAF import's reason for UT doesn't apply.
    utDownloadNote: "The AAF file gives this chart in Universal Time, the time Morinus works out from the time entered.",
    unreadableLabel: "Unreadable Morinus file",
    couldntReadMorinus: "AstroChart Bridge couldn't read this Morinus file.",
    enteredAs: "Entered as",
    chartType: "Chart type",
    horary: "Horary",
    // "UTC-05:00 zone, with daylight saving" or "Greenwich time".
    zone: (offset) => `${offset} zone`,
    greenwich: "Greenwich time",
    withDaylightSaving: (basis) => `${basis}, with daylight saving`,
    // "16 Nov 575 BC (Julian)"
    recordDate: (day, month, year, bc, julian) => `${day} ${MONTHS[month - 1]} ${year}${bc ? " BC" : ""}${julian ? " (Julian)" : ""}`,
  },

  // A match's distance from the chart's coordinates, for chooseListedTown.
  towns: {
    away: (km) => (km < 1 ? "less than 1 km" : `${Math.round(km)} km`),
  },

  // The notes AstroChart Bridge puts on astro.com's and Astro-Seek's own
  // pages. The functions that draw them run in the page, which gets only their
  // source and arguments, so these are plain strings: each {name} is filled in
  // there with the value of that name. The sentences after "AstroChart Bridge:"
  // start in lower case.
  pageNotes: {
    astroCom: {
      useUt: "Enter in Universal Time",
      // line is astro.com's time zone line as it reads; zone and words are
      // offsets in its words, such as "4 h west".
      zoneUnreadable:
        "astro.com's time zone here is \"{line}\", which can't be checked against this chart's {zone}. Check that the town is right. If it is, you can enter the chart in Universal Time instead.",
      zoneAtUt:
        "this chart is at Universal Time, but astro.com's automatic time zone for this town is {words}. Check that the town is right. If it is, enter the chart in Universal Time instead.",
      zoneOff:
        "this chart is {zone} of Universal Time, but astro.com's automatic time zone for this town is {words}. Check that the town is right. If it is, enter the chart in Universal Time instead.",
      enteredUt:
        "AstroChart Bridge entered {ut} with the 00:00 GMT / UT time zone. That is the chart's own Universal Time, so the moment is the chart's, whatever astro.com's warning about manual time zones says.",
      gone: "astro.com's list no longer has \"{text}\". Choose the town from its list.",
      listAgain: "List the matches again",
      chose: "chose \"{text}\" from astro.com's list, {away} from the chart's coordinates.",
      chooseAnother: "Choose another",
      ask: "more than one of astro.com's matches for \"{town}\" is within {km} km of the chart's coordinates. Which is the chart's town?",
      noneOfOne:
        "astro.com's one match for \"{town}\" isn't within {km} km of the chart's coordinates. Choose the town from astro.com's list, or type a nearer one.",
      noneOfMany:
        "none of astro.com's {listed} matches for \"{town}\" is within {km} km of the chart's coordinates. Choose the town from astro.com's list, or type a nearer one.",
    },
    astroSeek: {
      // gender is Astro-Seek's own option, such as Female.
      genderStarts: "Check Gender, which Astro-Seek starts at Male, then press Add person.",
      genderSet: "Gender is {gender}, from the chart. Check it, then press Add person.",
      gone: "Astro-Seek's list no longer has \"{text}\". Choose the city from its list.",
      listAgain: "List the matches again",
      chose: "chose \"{text}\" from Astro-Seek's list, {away} from the chart's coordinates. {genderNote}",
      chooseAnother: "Choose another",
      ask: "more than one of Astro-Seek's matches for \"{town}\" is within {km} km of the chart's coordinates. Which is the chart's town?",
      noneOfOne:
        "Astro-Seek's one match for \"{town}\" isn't within {km} km of the chart's coordinates. Choose the city from Astro-Seek's list, or type a nearer one.",
      noneOfMany:
        "none of Astro-Seek's {listed} matches for \"{town}\" is within {km} km of the chart's coordinates. Choose the city from Astro-Seek's list, or type a nearer one.",
      noList: "Astro-Seek didn't list its matches for \"{town}\" in time. Choose the city from its list.",
      noTown:
        "the chart names no town, and Astro-Seek saves a chart only with a Birth city chosen from its list. Type the town and choose it; the chart's coordinates and UT/GMT stay as they are. {genderNote}",
      placeBack:
        "AstroChart Bridge: Astro-Seek changed the latitude, longitude or time zone, so the chart's are back: {place}, UT/GMT with no daylight saving. Change them here yourself if you mean to.",
    },
  },

  // The receiving page, chart.html, in the extension and on the web.
  chart: {
    copyLink: "Copy link",
    showQr: "Show QR code",
    downloadFile: "Download file",
    shareLink: "Share link…",
    shareFile: "Share file…",
    shareNote: "Share link… and Share file… send the chart to the app you choose.",
    includesLegend: "Include in the link, QR code and file",
    includesNote: "The name and town go in the link, QR code and file only when ticked, and anyone with them can read them.",
    remembersNote: "AstroChart Bridge remembers what you tick, on this computer.",
    from: "From",
    // How a chart reached the device that shared it, by its source's via.
    viaNames: { page: "page", screenshot: "screenshot", paste: "pasted text" },
    // Where the chart was first read: its site's name and viaNames', either
    // of which may be missing, or a code the catalog doesn't know.
    origin: (site, via) => [site, via].filter(Boolean).join(" "),
    viaWarnings: {
      screenshot:
        "This chart was read from a screenshot by OCR on the device that shared it. Compare these rows with the chart before opening it: nothing checked the latitude.",
      paste:
        "This chart was read from pasted text and checked by hand on the device that shared it. Nothing checked its UTC offset against the birthplace and date.",
    },
    // Each refusal from fromFragment or readChartFile, worded for where the chart came from.
    refusals: {
      link: {
        malformed: "This link is incomplete or damaged. Copy the whole link again.",
        "too-large": "This link is too long to be an AstroChart Bridge chart.",
        "not-astrochart": "This link doesn't hold an AstroChart Bridge chart.",
        "unsupported-version": NEWER,
        "unknown-field": NEWER,
        "unsupported-calendar": NEWER,
        "before-gregorian": BEFORE_GREGORIAN,
      },
      file: {
        malformed: "This file isn't an AstroChart Bridge chart, or it is damaged.",
        "too-large": "This file is too large to be an AstroChart Bridge chart.",
        "not-astrochart": "This file isn't an AstroChart Bridge chart.",
        "unsupported-version": NEWER_FILE,
        "unknown-field": NEWER_FILE,
        "unsupported-calendar": NEWER_FILE,
        "before-gregorian": BEFORE_GREGORIAN,
      },
    },
    damaged: {
      link: "This link's chart isn't valid. Copy the whole link again.",
      file: "This file's chart isn't valid.",
    },
    empty: "Open an AstroChart Bridge link or chart file to see its chart here.",
    // Files the extension's import page opens, said as they are, and where to
    // go: the import page in the extension, the extension itself on the web.
    otherFiles: {
      "morinus-file": "This is a Morinus chart file (.hor), not an AstroChart Bridge chart.",
      "aaf-file": "This is an AAF file, not an AstroChart Bridge chart.",
    },
    inExtension: "It opens on the page for AAF and Morinus files.",
    onTheWeb: "The AstroChart Bridge extension opens it: click Open an AAF or Morinus file in its popup.",
    openItThere: "Open it there",
    // labelled: the chart has a name or town, which can be what makes it too long.
    qrTooLong: (labelled) =>
      labelled
        ? `${QR_TOO_LONG} Untick the name or town to shorten it, or use Copy link or Download file instead.`
        : `${QR_TOO_LONG} Use Copy link or Download file instead.`,
    qrLabel: "QR code for the link to this chart",
    qrNote: "Scan this with a phone or tablet's camera to open the chart there. Anyone who can see the code can read the chart.",
    // The share sheet's title, with no birth data in it.
    shareTitle: "AstroChart Bridge chart",
  },

  // Helioscope's page, from helioscope-model.js. Numbers arrive written out,
  // with decimal as their decimal mark, and times as "18:15", or as onDay
  // gives them when they aren't on the chart's own day. A number and its
  // unit are joined by a no-break space, \u00a0, so no line ends between them.
  helioscope: {
    decimal: ".",
    // For numbers written out whole, such as how many times brighter.
    locale: "en",
    planets: { mercury: "Mercury", venus: "Venus", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn" },
    conditions: { cazimi: "Cazimi", combust: "Combust", "under-the-beams": "Under the beams", clear: "Clear" },
    // The side of the Sun, the apparition: east of it is the evening sky.
    sides: { evening: "evening", morning: "morning" },
    // "Clear · evening"
    moment: (condition, side) => `${condition} · ${side}`,
    eastOfSun: (degrees) => `${degrees}° east of the Sun`,
    westOfSun: (degrees) => `${degrees}° west of the Sun`,
    inConjunction: "In conjunction with the Sun",
    inOpposition: "Opposite the Sun",
    notWorkedOut: "Couldn't be worked out",
    predictions: {
      detectable: "Visible",
      undetectable: "Too faint",
      "below-horizon": "Below the horizon",
      indeterminate: "No prediction",
      unavailable: "Couldn't be worked out",
    },
    // The windows by their twilight, so they aren't taken for the side of the Sun.
    windows: { evening: "dusk", morning: "dawn" },
    // "At dusk, 18:15: about 4,000 times brighter than needed"
    visibleAt: (window, time, ratio) => `At ${window}, ${time}: about ${ratio} times brighter than needed`,
    // "Best chance at dawn, 06:38: about 2.4 times too faint"
    tooFaintAt: (window, time, ratio) => `Best chance at ${window}, ${time}: about ${ratio} times too faint`,
    // " · also visible at dusk", for a planet visible in both windows.
    alsoVisible: (window) => ` · also visible at ${window}`,
    belowBoth: "Below the horizon at dusk and at dawn",
    noWindow: {
      set: "The Sun doesn't set that day",
      rise: "The Sun doesn't rise that day",
      both: "The Sun doesn't set or rise that day",
      other: "There's no twilight to judge by that night",
    },
    // "18:15 on 10 Jan"
    onDay: (time, day) => `${time} on ${day}`,
    dayMonth: (day, month) => `${day} ${MONTHS[month - 1]}`,
    // A planet's details, one row each.
    labels: {
      evening: "Evening",
      morning: "Morning",
      best: { evening: "Best at dusk", morning: "Best at dawn" },
      longitudeGap: "Longitude gap",
      elongation: "Elongation",
    },
    events: {
      sunset: "sunset",
      "astronomical-dusk": "the end of astronomical twilight",
      "lower-transit": "the Sun's lowest point",
      "astronomical-dawn": "the start of astronomical twilight",
      sunrise: "sunrise",
    },
    // "From sunset at 16:49 to the end of astronomical twilight at 18:26"
    span: (start, startTime, end, endTime) => `From ${start} at ${startTime} to ${end} at ${endTime}`,
    // After span.
    above: (count, total) => `, above the horizon in ${count} of ${total} samples`,
    below: ", below the horizon throughout",
    none: {
      "no-sunset": "None: the Sun doesn't set that day",
      "no-sunrise": "None: the Sun doesn't rise that day",
      other: "None: there's no twilight that night",
    },
    failed: (code) => `Couldn't be worked out: ${code}`,
    // "18:15: magnitude −4.53 against a limiting magnitude of 4.48, a margin of +9.01. 25° up in the southwest, the Sun 16° below the horizon"
    bestMoment: ({ time, margin, magnitude, limit, altitude, direction, sunDepth }) =>
      `${time}: magnitude ${magnitude} against a limiting magnitude of ${limit}, a margin of ${margin}. ${altitude}° up in the ${direction}, the Sun ${sunDepth}° below the horizon`,
    // From north, every 45° clockwise.
    directions: ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"],
    timesAt: (offset) => `Times are at ${offset}, the chart's offset.`,
    // A planet's link to Stellarium Web at its best moment, and what a screen
    // reader says for it: "See Venus at 18:15 in Stellarium Web".
    seeInStellarium: "See it in Stellarium Web",
    stellariumLabel: (planet, time) => `See ${planet} at ${time} in Stellarium Web`,
    linksNote:
      "See it in Stellarium Web sends that moment and the chart's place to stellarium-web.org, whose page passes the link on to Google's advertising tags. Stellarium Web's clock starts running at once; its pause button stops it.",
    // Under each result's heading: how it's judged.
    methodMoment: (cazimi, combust, underTheBeams) =>
      `The traditional condition, from the longitude gap alone: cazimi within ${cazimi}, combust ${combust}, under the beams ${underTheBeams}`,
    methodPrediction: "Whether it was bright enough to see in the twilights nearest the chart's moment",
    // How this is worked out: only what the headings don't say.
    how: {
      title: "How this is worked out",
      steps: [
        "Brightness is measured in magnitudes, which run backwards: the lower the number, the brighter. Venus is about −4, and the faintest stars a dark sky shows are about 6. Each step of 1 is about 2.5 times in brightness.",
        "Twilight hides faint things. Every 2 minutes from sunset to the end of astronomical twilight, and from its start to sunrise, Swiss Ephemeris works out the faintest magnitude you could see where the planet was: the limiting magnitude. It depends on the Sun's depth, the Moon, and the air and observer under Assumptions. Where the Sun never gets 18° below the horizon, the twilights end or start at its lowest point.",
        "A planet brighter than the limit can be seen. The table gives its best moment, and how many times brighter or fainter than needed it was then; the details give the magnitudes.",
        "The chart doesn't record the weather or the observer's eyes. Haze dims a planet most when it's low in the sky, so even one many times brighter than needed could have been hidden. Check that night's weather gives ERA5's cloud and air.",
        "The prediction uses the planet's true place, its latitude included, while the condition uses longitude alone, so the two can disagree.",
      ],
      more: "The method, and how it was checked",
    },
    // Check that night's weather, and what the page says of it.
    weather: {
      button: "Check that night's weather",
      // Under the button, before anything is sent.
      sends: "Sends the chart's month and its place, rounded to about 25\u00a0km, to open-meteo.com, whose logs may keep them for up to 90 days.",
      asking: "Asking Open-Meteo…",
      title: "That night's weather, from ERA5",
      // "Dusk: 90 % cloud at 18:00 · Dawn: no cloud at 07:00"
      twilights: { evening: "Dusk", morning: "Dawn" },
      twilight: (twilight, said) => `${twilight}: ${said}`,
      both: (evening, morning) => `${evening} · ${morning}`,
      cloudAt: (percent, time) => `${percent}\u00a0% cloud at ${time}`,
      clearAt: (time) => `no cloud at ${time}`,
      reworked:
        "The planets below are worked out again with that night's air. ERA5's cloud is for a square about 25\u00a0km across, and a bright planet can show through thin high cloud or a gap.",
      // The credit Open-Meteo's licence and ERA5's ask for, drawn as "Weather
      // data by Open-Meteo.com (CC BY 4.0), generated using …", its first part
      // linked to Open-Meteo and the licence to the licence.
      credit: {
        data: "Weather data by Open-Meteo.com",
        licence: "CC BY 4.0",
        source: (year) => `generated using Copernicus Climate Change Service information ${year}`,
      },
      refusals: {
        "before-1940": "ERA5's weather starts in 1940, so there's none to check for this chart.",
        future: "That night hasn't happened yet, so there's no weather to check.",
        "no-twilight": "There's no twilight that night, so there's no weather to check.",
        "not-yet": "ERA5 doesn't have that night yet: it runs about 5 days behind.",
        declined: "Firefox wasn't allowed to send it, so nothing was sent.",
      },
      failed: "Couldn't get the weather.",
      // Firefox refused to ask, as it does when the manifest it loaded doesn't declare the consent.
      consentFailed: "Firefox couldn't ask for its consent, so nothing was sent.",
      // Under Assumptions, once the weather is in.
      air: "Atmosphere that night",
      cloud: "Cloud that night",
      cloudValue: (low, mid, high) => `low ${low}\u00a0%, mid ${mid}\u00a0%, high ${high}\u00a0%`,
    },
    assumptions: {
      ephemeris: "Ephemeris",
      ephemerisValue: (version) => `Swiss Ephemeris ${version}, Moshier`,
      atmosphere: "Atmosphere",
      atmosphereValue: (pressure, temperature, humidity) => `${pressure}\u00a0hPa, ${temperature}\u00a0°C, ${humidity}\u00a0% humidity`,
      observer: "Observer",
      observerValue: (age, snellen, bothEyes) => `Aged ${age}, Snellen ratio ${snellen}, ${bothEyes ? "both eyes" : "one eye"}`,
      elevation: "Elevation",
      elevationGiven: (metres) => `${metres}\u00a0m`,
      elevationDefault: (metres) => `${metres}\u00a0m, as none was given`,
      moon: "Moon",
      moonIncluded: "Its light is included",
      moonLeftOut: "Its light is left out",
      samples: "Samples",
      every: (minutes) => `Every ${minutes} minutes`,
      limits: "Limits",
      limitsValue: (cazimi, combust, underTheBeams) => `Cazimi ${cazimi}, combust ${combust}, under the beams ${underTheBeams}`,
    },
    columns: { planet: "Planet", moment: "At the chart's moment", prediction: "Predicted in the twilight around it" },
    detailsHeading: "Details",
    // A planet's details, closed until opened: "Venus: Detectable"
    detailsSummary: (planet, prediction) => `${planet}: ${prediction}`,
    assumptionsHeading: "Assumptions",
    empty: "This page works out which planets were visible for a chart. Open it from a chart in AstroChart Bridge.",
    refusals: {
      "date-out-of-range": "AstroChart Bridge works out which planets were visible only for dates before 3000.",
      "invalid-coordinates": "This chart's place isn't a latitude and longitude on the globe.",
      "invalid-elevation": ELEVATION_RANGE,
      "engine-failed": "Swiss Ephemeris couldn't start in this browser, so the planets can't be worked out.",
      other: "The planets can't be worked out for this chart.",
    },
    elevationRefused: ELEVATION_RANGE,
  },
};
