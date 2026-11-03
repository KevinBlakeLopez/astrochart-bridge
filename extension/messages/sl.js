// The interface's Slovenian text, with en.js's keys. It addresses the reader
// formally (vikanje: "kliknite", "izberite"), and its buttons take the short
// imperative Slovenian interfaces use ("Odpri", "Prekliči"). As in es.js, the
// names of astro.com's and Astro-Seek's own buttons, fields and options stay as
// those sites print them in English, since AstroChart Bridge's links open
// their English pages: Add person, Birth city, First name, 00:00 GMT / UT,
// show / hide extended settings, automatic time zone. Quotation marks are
// »…«, and an ellipsis after a whole word has a space before it.

const MONTHS = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "avg.", "sep.", "okt.", "nov.", "dec."];
const MONTH_NAMES = [
  "januar", "februar", "marec", "april", "maj", "junij",
  "julij", "avgust", "september", "oktober", "november", "december",
];

// Slovenian counts have four forms: 1 minuto, 2 minuti, 3 minute, 5 minut.
// Intl's rules also cover 101, 102, 103 and so on, which end the same way.
const PLURAL = new Intl.PluralRules("sl");
const count = (n, forms) => `${n} ${forms[PLURAL.select(n)]}`;
// After a verb, as in "jih hrani 30 minut" or "izpusti 3 sekunde".
const MINUTES = { one: "minuto", two: "minuti", few: "minute", other: "minut" };
const SECONDS = { one: "sekundo", two: "sekundi", few: "sekunde", other: "sekund" };
const CHARACTERS = { one: "znak", two: "znaka", few: "znake", other: "znakov" };

const TOOLBAR_STEP = "znova kliknite ikono AstroChart Bridge v orodni vrstici, da izpolni obrazec.";

const LOCAL_ZONE =
  "Datum in čas sta v lokalnem času horoskopa, možnost automatic time zone na astro.com pa poišče časovni pas mesta, ki ga izberete. ";

export default {
  view: {
    code: (code) => `Koda: ${code}`,
    cancel: "Prekliči",
    offsetPlaceholder: "npr. -04:00",
    offsetLabel: "Zamik od UTC",
    offsetPreview: (utc) => `UTC: ${utc}`,
  },

  popup: {
    refusals: {
      transit: "To je horoskop tranzitov. AstroChart Bridge odpira samo rojstne horoskope.",
      synastry: "To je horoskop sinastrije ali združljivosti. AstroChart Bridge odpira samo rojstne horoskope.",
      unsupported: "Za uporabo AstroChart Bridge odprite rojstni horoskop na Astro-Seeku ali astro.com.",
      databank:
        "Horoskopi iz Astro-Databank še niso podprti. AstroChart Bridge odpira horoskope, shranjene v vašem računu na astro.com.",
      "unsupported-chart": "AstroChart Bridge te vrste horoskopa z astro.com še ne zna prebrati.",
      "no-drawing-link":
        "Ta stran astro.com nima povezave »Drawing (for subscribers)«, iz katere AstroChart Bridge bere rojstne podatke.",
      "local-mean-time": "Ta horoskop uporablja lokalni srednji čas, ki ga AstroChart Bridge še ne zna odpreti.",
      "calendar-unsupported":
        "Ta horoskop z astro.com ima datum pred začetkom gregorijanskega koledarja 15. oktobra 1582. AstroChart Bridge bere samo gregorijanske datume.",
      "page-url-mismatch": "Stran se ne ujema s svojim naslovom. Znova naložite horoskop in poskusite ponovno.",
      "stellarium-unreadable": "AstroChart Bridge ne more prebrati neba iz tega zavihka Stellarium Web.",
    },
    unreadable: "AstroChart Bridge ne more prebrati te strani s horoskopom.",
    tabUnreadable: "AstroChart Bridge ne more prebrati tega zavihka.",
    chartUnshowable: "AstroChart Bridge ne more prikazati tega horoskopa.",

    // "17. apr. 2024"
    shortDate: (day, month, year) => `${day}. ${MONTHS[month - 1]} ${year}`,
    // "17. april 2024", as Intl writes it for sl.
    longDate: (day, month, year) => `${day}. ${MONTH_NAMES[month - 1]} ${year}`,
    // "17. apr. ob 05:00"
    timeOnDay: (time, day, month) => `${day}. ${MONTHS[month - 1]} ob ${time}`,
    // English's letters, not S, J, V and Z: a Slovenian S is sever, north, and
    // the coordinates are copied into sites that read S as south.
    compass: { north: "N", south: "S", east: "E", west: "W" },
    // "a, b in c"
    and: (items) => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} in ${items.at(-1)}`),

    rows: {
      localTime: "Lokalni čas",
      place: "Kraj",
      offset: "Zamik",
      utc: "UTC",
      stellariumTime: "Čas v Stellariumu",
      gender: "Spol",
    },
    // "17. apr. 2024 ob 05:00, čas vašega računalnika"
    stellariumTimeValue: (time, day, month, year) => `${day}. ${MONTHS[month - 1]} ${year} ob ${time}, čas vašega računalnika`,
    genders: { female: "Ženski", male: "Moški", event: "Dogodek" },

    buttons: {
      openSky: "Odpri Stellarium Web",
      openInAstroSeek: "Odpri horoskop na Astro-Seeku",
      saveInAstroSeek: "Shrani na Astro-Seeku …",
      openAstroSeekForm: "Odpri obrazec Astro-Seeka",
      astroSeekTab: "Pojdi na zavihek Astro-Seek",
      share: "Deli …",
      enterInAstroCom: "Vnesi na astro.com …",
      openAstroComForm: "Odpri obrazec astro.com",
      signIn: "Prijava",
      createAccount: "Ustvari račun",
      astroComTab: "Pojdi na zavihek astro.com",
      blankForm: "Odpri prazen obrazec",
      fillAnyway: "Vseeno izpolni",
      fillForm: "Izpolni obrazec",
      cancel: "Prekliči",
    },
    groups: { sky: "Oglejte si nebo", elsewhere: "Odnesite horoskop drugam" },
    otherWays: {
      read: "Preberite horoskop, ki ga imate",
      screenshot: "Preberi posnetek zaslona",
      paste: "Prilepi besedilo horoskopa",
      file: "Odpri datoteko AAF ali Morinus",
      bridgeFile: "Odpri datoteko AstroChart Bridge",
      desktop: "Ali uporabite nebo iz Stellarium Desktop",
      importFromDesktop: "Uvozi iz Stellarium Desktop",
      more: "Preberi drug horoskop",
    },

    clockNote: "Ura v Stellarium Web kaže časovni pas vašega računalnika in teče naprej.",
    privacyNote:
      "Odpiranje neba pošlje ta datum, čas in kraj na stellarium-web.org, njegova stran pa povezavo posreduje Googlovim oglaševalskim oznakam.",
    // As in es.js, each says that the clock keeps running within its first
    // sentence, to keep the note close to English's length at the popup's 440px.
    clockSame: (clock) => `Ura v Stellarium Web bo kazala ${clock}, kot v kraju rojstva, in bo tekla, dokler je ne ustavite.`,
    clockDiffers: (clock, birth) =>
      `Ura v Stellarium Web bo kazala ${clock}, čas vašega računalnika, in bo tekla, dokler je ne ustavite. V kraju rojstva je to ${birth}.`,
    zoneLabelUnknown: (label) =>
      label === null
        ? "Astro-Seek ne izpiše oznake časovnega pasu, zato se uporabi njegov univerzalni čas, kot je izpisan."
        : `AstroChart Bridge ne more preveriti oznake časovnega pasu »${label}« z Astro-Seeka, zato se uporabi njegov univerzalni čas, kot je izpisan.`,
    contradicts: (time, label, offset) =>
      `Stran Astro-Seek si nasprotuje: ${time} označi kot ${label}, njen univerzalni čas pa pomeni ${offset}.`,
    asPrinted: (utc, offset) => `${utc} UTC, kot izpiše Astro-Seek (${offset})`,
    asLabelled: (utc, label, offset) => `${utc} UTC, kot pravi oznaka ${label} (${offset})`,
    needsOffset: "Astro-Seek ne izpiše univerzalnega časa. Vnesite zamik od UTC v kraju rojstva v obliki ±HH:MM.",

    astroSeekNotes: [
      "Astro-Seek bo ta horoskop narisal v UT/GMT na teh koordinatah, zaokroženo na minuto, in brez mesta.",
      "Odpiranje horoskopa pošlje ta datum, čas in kraj na astro-seek.com.",
    ],
    astroSeekSaveNote: "Odpiranje ali shranjevanje pošlje ta datum, čas in kraj na astro-seek.com.",
    astroSeekSaveNamedNote:
      "Odpiranje ali shranjevanje pošlje ta datum, čas in kraj na astro-seek.com; shranjevanje pošlje še ime in mesto horoskopa, če ju ima.",
    astroSeekSaveBusy: "Odpiranje obrazca Add person na Astro-Seeku …",
    saveMessages: {
      "signed-out":
        "Astro-Seek kaže, da niste prijavljeni, horoskop pa shrani samo v račun. Prijavite se v njegovem zavihku, nato znova kliknite Shrani na Astro-Seeku …",
      elsewhere: "Astro-Seek ni prikazal obrazca Add person. Če zahteva prijavo, se prijavite, nato znova kliknite Shrani na Astro-Seeku …",
      "not-loaded": "Obrazec Astro-Seeka se ni pravočasno odprl do konca, zato AstroChart Bridge v njem ni izbral mesta.",
      "city-typed": "Obrazec Astro-Seeka je že imel izpolnjeno polje Birth city, zato ga je AstroChart Bridge pustil, kot je bilo.",
      unrecognised: "AstroChart Bridge ni prepoznal obrazca Astro-Seeka, zato v njem ni izbral mesta.",
    },
    checkNote:
      "Preden kliknete Add person, v seznamu Astro-Seeka izberite Birth city, če še ni izbrano, in preverite, da koordinate in UT/GMT še vedno ustrezajo horoskopu.",
    saveDeclined: "Brez dostopa do www.astro-seek.com AstroChart Bridge ne more izbrati mesta v obrazcu Astro-Seeka.",
    saveDeclinedNote: (named) => `Obrazec se odpre s tem datumom, časom in krajem v UT/GMT${named ? " ter z imenom" : ""}.`,

    shareBeforeGregorian:
      "AstroChart Bridge še ne more deliti horoskopa z datumom pred 15. oktobrom 1582: ne more ugotoviti, v katerem koledarju je datum.",
    shareRefused: "AstroChart Bridge tega horoskopa ne more deliti.",

    townNote: (town) =>
      town === null
        ? "astro.com zahteva državo in mesto, ne koordinat. Izberite mesto, ki je najbližje temu kraju, in preverite koordinate, ki jih pokaže astro.com."
        : `astro.com zahteva državo in mesto, ne koordinat. AstroChart Bridge vpiše mesto ${town}; izberite zadetek, ki je najbližje temu kraju, in preverite koordinate, ki jih pokaže astro.com.`,
    townByHandNote: (town) =>
      `astro.com zahteva državo in mesto, ne koordinat. Vpišite mesto ${town}, izberite zadetek, ki je najbližje temu kraju, in preverite koordinate, ki jih pokaže astro.com.`,
    signInNote:
      "astro.com nariše horoskop samo za prijavljen račun. Če zahteva prijavo ali brezplačen račun, to naredite v tistem zavihku: AstroChart Bridge te vrednosti hrani zanj.",
    keepsNote: (minutes) =>
      `AstroChart Bridge jih hrani ${count(minutes, MINUTES)}, dokler jih ne vpiše ali dokler ne prekličete ali zaprete brskalnika. Vpis jih postavi na stran astro.com, njeno iskanje mest pa takoj pošlje mesto na astro.com; oddaja obrazca pošlje še ostalo.`,
    accessNote:
      "Prvič vas brskalnik vpraša, ali sme AstroChart Bridge brati in spreminjati strani www.astro.com. To uporablja samo za izpolnjevanje obrazca v zavihku, ki ga odpre. Če odklonite, prikaže vrednosti, ki jih vpišete sami.",
    afterTabOpens: `Ko se odpre zavihek astro.com, ${TOOLBAR_STEP}`,
    switchToTab: `Preklopite na zavihek astro.com, nato ${TOOLBAR_STEP}`,
    astroComBusy: "Odpiranje obrazca astro.com za izpolnitev …",
    noAccess: "Brez dostopa do www.astro.com AstroChart Bridge ne more izpolniti obrazca.",
    formNeedsChoice: "Obrazec astro.com je odprt, vendar morate najprej nekaj izbrati, na primer se prijaviti.",
    formNotOpened: "Obrazec astro.com se ni odprl do konca, zato ga AstroChart Bridge še ni mogel izpolniti.",
    nameNote:
      "Ime gre v polji First name in Last name na astro.com, pred tem pa ga lahko spremenite tukaj. Ime iz ene besede gre v First name, brez katerega astro.com horoskopa ne shrani.",
    nameWarning: (length, fields) =>
      `Polja za ime na astro.com sprejmejo ${count(length, CHARACTERS)}. Tukaj skrajšajte ${fields}, sicer lahko astro.com ime odreže.`,
    byHand: "Te vrednosti vpišite v obrazec astro.com. Ta stran ga ne more izpolniti namesto vas.",
    fillsAsItOpens: "AstroChart Bridge odpre obrazec astro.com in ga izpolni, ko se odpre. Obrazca ne odda.",
    universalTimeNote: "Datum in čas sta v univerzalnem času, zato se lahko razlikujeta od lokalnega datuma in časa rojstva.",
    typedForm:
      "V tem obrazcu je že datum ali čas. AstroChart Bridge izpolni samo prazen obrazec, zato tega, kar je v njem, ne bo spremenil.",
    unrecognisedForm: "AstroChart Bridge ne prepozna tega obrazca astro.com, zato ga ne more izpolniti. Zgornje vrednosti vnesite sami.",
    keepingForTab: "AstroChart Bridge te vrednosti hrani za ta zavihek.",
    whenSignedIn:
      "Ko boste prijavljeni, v tem zavihku odprite obrazec za rojstne podatke na astro.com in znova kliknite ikono AstroChart Bridge v orodni vrstici, da ga izpolni.",
    signInHeading: "Prijavite se v astro.com",
    requiresAccount:
      "astro.com za izdelavo horoskopov zahteva račun. Za nadaljevanje se prijavite v obstoječi račun ali ustvarite brezplačnega.",
    keepsWhileSigningIn:
      "AstroChart Bridge te vrednosti hrani za zavihek astro.com, medtem ko se prijavljate. Nato tam odprite obrazec astro.com in znova kliknite ikono AstroChart Bridge v orodni vrstici.",
    fillQuestion: "Želite izpolniti obrazec astro.com s temi vrednostmi?",
    // After "izpolni", so in the accusative: "datum rojstva, uro, minuto in mesto Sydney".
    filled: {
      birthday: "datum rojstva",
      hour: "uro",
      minute: "minuto",
      universalTime: "časovni pas 00:00 GMT / UT",
      name: "ime",
      gender: "spol",
      town: (town) => `mesto ${town}`,
    },
    fillNote: (filled, hasTown) =>
      `AstroChart Bridge izpolni ${filled}. ` +
      (hasTown
        ? "Izberite zadetek na astro.com, ki je najbližje temu kraju, in preverite koordinate, ki jih pokaže."
        : "Sami izberite mesto, ki je najbližje temu kraju, in preverite koordinate, ki jih pokaže astro.com."),
    doesntSubmit: "AstroChart Bridge obrazca ne odda, te vrednosti pa pozabi, ko jih vpiše.",

    astroComRows: {
      birthday: "Birthday",
      hourMin: "Hour, min",
      timeZone: "Time zone",
      town: "Town",
      firstName: "First name",
      lastName: "Last name",
      gender: "Gender",
    },
    universalTimeZone: "00:00 GMT / UT, pod show / hide extended settings",
    automaticZone: "automatic time zone, privzeta možnost obrazca",
    wholeMinutes: (seconds) => `astro.com sprejme samo cele minute, zato AstroChart Bridge izpusti ${count(seconds, SECONDS)}.`,
    zoneUnchecked:
      LOCAL_ZONE +
      "AstroChart Bridge nima zamika od UTC, s katerim bi ga primerjal, zato preverite časovni pas, ki ga astro.com pokaže za mesto in datum.",
    zoneChecked: (zone) =>
      LOCAL_ZONE +
      `Moral bi biti ${zone}: AstroChart Bridge ga preveri na strani, ko izberete mesto, in tam ponudi univerzalni čas, če ni.`,
    zoneToCheck: (zone, date, time) =>
      LOCAL_ZONE +
      `Preverite, da je ${zone}. Če ni, pod show / hide extended settings izberite 00:00 GMT / UT in namesto tega vnesite ${date}, ${time}.`,
  },
};
