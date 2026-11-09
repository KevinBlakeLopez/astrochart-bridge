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
const count = (n, forms) => `${n.toLocaleString("sl")} ${forms[PLURAL.select(n)]}`;
// After a verb, as in "jih hrani 30 minut" or "izpusti 3 sekunde".
const MINUTES = { one: "minuto", two: "minuti", few: "minute", other: "minut" };
const SECONDS = { one: "sekundo", two: "sekundi", few: "sekunde", other: "sekund" };
const CHARACTERS = { one: "znak", two: "znaka", few: "znake", other: "znakov" };
// After "do", as in "do 100.000 znakov".
const UP_TO_CHARACTERS = { one: "znaka", two: "znakov", few: "znakov", other: "znakov" };
// The verb agrees with the count too: "sta 2 horoskopa", "je 5 horoskopov".
const CHARTS_IN_FILE = { one: "je # horoskop", two: "sta # horoskopa", few: "so # horoskopi", other: "je # horoskopov" };

// "a, b in c"
const and = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} in ${items.at(-1)}`);

const NEWER = "Ta horoskop je naredila novejša različica AstroChart Bridge, zato ga ta stran ne zna prebrati.";
const NEWER_FILE = "To datoteko je naredila novejša različica AstroChart Bridge, zato je ta stran ne zna prebrati.";
const BEFORE_GREGORIAN = "Datum tega horoskopa je pred 15. oktobrom 1582, zato ga AstroChart Bridge še ne zna odpreti.";
const QR_TOO_LONG = "Ta povezava je predolga za kodo QR, ki bi se zanesljivo prebrala.";
const JULIAN = "Ta datum je v julijanskem koledarju, ki ga AstroChart Bridge še ne zna odpreti.";
const PRE_GREGORIAN = "AstroChart Bridge odpira datume od 15. oktobra 1582 naprej, ko se je začel gregorijanski koledar.";
const OFFSET_RANGE = "Zamik tega horoskopa je, vključno s poletnim časom, zunaj obsega od -12:00 do +14:00.";
// Each screenshot refusal that blames a misreading ends with the same advice.
const MISREAD = "zato je bil eden od podatkov verjetno napačno prebran. Poskusite z večjim posnetkom.";

const TOOLBAR_STEP = "znova kliknite ikono AstroChart Bridge v orodni vrstici, da izpolni obrazec.";

const LOCAL_ZONE =
  "Datum in čas sta v lokalnem času horoskopa, možnost automatic time zone na astro.com pa poišče časovni pas mesta, ki ga izberete. ";

export default {
  // A page's heading is the button that opens it, where English's are the same.
  pages: {
    popup: {
      title: "AstroChart Bridge",
      reading: "Branje strani …",
    },
    screenshot: {
      title: "AstroChart Bridge: branje posnetka zaslona",
      heading: "Preberi posnetek zaslona s horoskopom",
      intro:
        "Kamor koli na to stran prilepite (⌘V) ali spustite posnetek zaslona strani z rojstnim horoskopom na Astro-Seeku, risbe horoskopa z astro.com, kolesa iz Solar Fire, plošče Chart Details iz Astro Gold, horoskopa iz Morinusa, kolesa iz Valensa, horoskopa iz Planetdance, rojstnih podatkov iz Jagannatha Hora, kolesa iz Keplerja ali Siriusa, kolesa iz Janusa ali Win*Star, horoskopa iz TimePassages ali kolesa iz Astrologa, ali pa izberite datoteko. Z Astro-Seeka potrebuje vse od Date of Birth do Latitude, Longitude; z astro.com glavo risbe od datuma do Sid. Time; iz Solar Fire ali Astro Gold podatke horoskopa od datuma do koordinat; iz Morinusa njegovo vrstico stanja ali sredino njegovega kvadratnega horoskopa; iz Valensa sredino njegovega kolesa; iz Planetdance vrstice levo zgoraj ob kolesu, do St:; iz Jagannatha Hora rojstne podatke od Date do Sidereal Time; iz Keplerja ali Siriusa blok podatkov od imena do Time Zone; iz Janusa sredino kolesa od datuma do koordinat; iz Win*Star desni zgornji del kolesa od datuma do zemljepisne širine; iz TimePassages ves horoskop z vogali; iz Astrologa zgornji del stranske vrstice od datuma do Julian Day. Zajamete lahko tudi vso stran.",
      choose: "Izberi posnetek zaslona",
      privacy: "Posnetek zaslona se prebere na tem računalniku in se nikamor ne pošlje.",
      whatWasRead: "Kaj je AstroChart Bridge prebral",
      reading: "Branje posnetka zaslona …",
      unreadable: "AstroChart Bridge te slike ne more prebrati.",
    },
    paste: {
      title: "AstroChart Bridge: lepljenje besedila horoskopa",
      heading: "Prilepi besedilo horoskopa",
      intro:
        "Prilepite rojstne podatke, kopirane iz astrološkega programa, poročila ali zapiska, v vrsticah z angleškimi oznakami, kot sta »Date of Birth: 15 June 1985« in »latitude=47.6062«.",
      textLabel: "Besedilo horoskopa",
      read: "Preberi besedilo",
      fromClipboard: "Prilepi iz odložišča",
      privacy: "Besedilo se prebere na tem računalniku in se nikamor ne pošlje ali shrani.",
      clipboardRefused:
        "Brskalnik ni dovolil, da AstroChart Bridge prebere odložišče. Kliknite polje zgoraj in namesto tega prilepite s ⌘V ali Ctrl+V.",
      continue: "Nadaljuj",
      continueToAstroCom: "Nadaljuj na astro.com",
      alsoInText: "V besedilu je tudi:",
      back: "Nazaj na obrazec",
    },
    import: {
      title: "AstroChart Bridge: odpiranje datoteke AAF ali Morinus",
      heading: "Odpri datoteko AAF ali Morinus",
      intro:
        "Izberite datoteko AAF (.aaf) ali horoskop Morinus (.hor) ali ju spustite kamor koli na to stran, lahko pa spodaj prilepite besedilo datoteke AAF. Astrolog in drugi astrološki programi shranjujejo horoskope v AAF.",
      choose: "Izberi datoteko AAF ali Morinus",
      textLabel: "Besedilo AAF",
      read: "Preberi prilepljeno besedilo",
      privacy: "Datoteka se prebere na tem računalniku in se nikamor ne pošlje.",
    },
    chart: {
      title: "AstroChart Bridge: odpiranje horoskopa",
      readingLink: "Branje povezave …",
      linkLabel: "Povezava do tega horoskopa",
      openFile: "Odpri datoteko AstroChart Bridge",
      fileLabel: "Datoteka s horoskopom",
      privacy:
        "Povezava do horoskopa vsebuje horoskop sam, prav tako njegova datoteka. Kdor ima eno ali drugo, ga lahko prebere, zato ju delite samo z ljudmi, ki smejo videti te rojstne podatke. Ta stran ju prebere na tej napravi, ničesar ne shrani in ničesar ne pošlje, dokler ne odprete neba ali horoskopa.",
      // "Odprto: chart.astrochart.json.", so the file's name needn't agree with a verb.
      opened: (name) => `Odprto: ${name}.`,
      couldntPass: "AstroChart Bridge datoteke ni mogel predati naprej. V pojavnem oknu kliknite Odpri datoteko AAF ali Morinus in jo izberite tam.",
      linkCopied: "Povezava je kopirana.",
      copyRefused: "Ta brskalnik ni dovolil, da AstroChart Bridge kopira povezavo. Kopirajte jo od tukaj:",
      hideQr: "Skrij kodo QR",
      shareSheetFailed: "AstroChart Bridge ni mogel odpreti menija za deljenje. Uporabite Kopiraj povezavo ali Prenesi datoteko.",
    },
    astroComFilled: "AstroChart Bridge je izpolnil obrazec astro.com v njegovem zavihku.",
    astroSeekFilled: "AstroChart Bridge je izpolnil obrazec Astro-Seeka v njegovem zavihku. Tam preverite Gender, nato pritisnite Add person.",
  },

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
        "Ta horoskop ima datum pred začetkom gregorijanskega koledarja 15. oktobra 1582. AstroChart Bridge bere samo gregorijanske datume.",
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
    and,

    rows: {
      localTime: "Lokalni čas",
      place: "Kraj",
      town: "Mesto",
      name: "Ime",
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
    astroSeekDateLine: "Astro-Seek ne sprejme zemljepisne dolžine 180°, zato dobi 179°59' na isti strani, 1 ločno minuto stran.",
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
    saveByHand: "Ta stran ne more izbrati mesta v obrazcu Astro-Seeka namesto vas.",

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

  // Stellarium follows the computer's language. Its Slovenian translation, as
  // Stellarium 25.1 ships it (translations/stellarium/sl.qm), names Okno za
  // nastavitve, Vtičniki, Naloži ob zagonu, nastavi, Shrani nastavitve and
  // Okno za nastavljanje kraja; the Remote Control plugin's own settings
  // aren't translated, so they stay as Stellarium shows them: Remote Control,
  // Server enabled, Enable automatically on startup, Port Number, Access
  // requires authentication.
  desktop: {
    send: "Pošlji v Stellarium Desktop",
    nowDefault: "Stellarium Desktop je zdaj vaša privzeta izbira za horoskope. Na vsakem zaslonu s horoskopom je povezava, s katero to spremenite nazaj.",
    undo: "Razveljavi",
    isDefault: "Stellarium Desktop je vaša privzeta izbira za horoskope.",
    makeWebDefault: "Nastavi Stellarium Web kot privzetega",
    webDefaultAgain: "Stellarium Web je spet privzet.",
    useByDefault: "Privzeto uporabljaj Stellarium Desktop",
    hints: {
      connected: "Stellarium Desktop je odprt in pripravljen.",
      unavailable: "Stellarium Desktop trenutno ni dosegljiv. Gumb pokaže, kako ga nastavite.",
      "auth-required": "Stellarium zahteva geslo, ki ga AstroChart Bridge ne uporablja. Gumb pokaže, kako ga izklopite.",
      "invalid-response": "Na vratih 8090 se odziva nekaj drugega kot Stellarium.",
      "stellarium-not-earth": "Opazovalec v Stellariumu je na drugem planetu.",
    },
    noAnswer: "Stellarium Desktop se ni odzval.",
    sending: "Pošiljanje v Stellarium Desktop …",
    reading: "Branje iz Stellarium Desktop …",
    setupSteps: [
      "Odprite Stellarium in pritisnite F2 (na mnogih tipkovnicah Mac fn+F2), da odprete Okno za nastavitve.",
      "Na zavihku Vtičniki izberite Remote Control in obkljukajte Naloži ob zagonu.",
      "Zaprite Stellarium in ga znova odprite: vtičnik se naloži samo ob zagonu Stellariuma.",
      "Znova pritisnite F2, na zavihku Vtičniki izberite Remote Control in kliknite nastavi.",
      "Obkljukajte Server enabled in še Enable automatically on startup, da vam naslednjič tega ne bo treba. Port Number pustite na 8090 in Access requires authentication neobkljukano, nato kliknite Shrani nastavitve.",
      "Vrnite se sem in kliknite Poskusi znova.",
    ],
    networkNote:
      "Dokler je njegov strežnik vklopljen, lahko Stellarium upravljajo tudi druge naprave v vašem omrežju. Ko končate, odkljukajte Server enabled, če je to v tem omrežju pomembno.",
    problems: {
      unavailable: {
        heading: "Stellarium Desktop ni dosegljiv",
        message: "Povezava s Stellarium Desktop ni uspela. Odprite Stellarium in vklopite njegov vtičnik Remote Control.",
      },
      "no-permission": {
        heading: "AstroChart Bridge potrebuje vaše dovoljenje",
        message:
          "Za dostop do Stellariuma AstroChart Bridge potrebuje dovoljenje za povezavo s tem računalnikom na 127.0.0.1. Nikamor drugam se ne povezuje, in to samo, ko kliknete.",
      },
      "auth-required": {
        heading: "Stellarium zahteva geslo",
        message:
          "AstroChart Bridge ne uporablja gesla vtičnika Remote Control. V nastavitvah Remote Control v Stellariumu odkljukajte Access requires authentication in kliknite Shrani nastavitve, nato odkljukajte in znova obkljukajte Server enabled, da se strežnik znova zažene.",
      },
      "invalid-response": {
        heading: "Vrata 8090 uporablja nekaj drugega",
        message:
          "Program, ki se odziva na vratih 8090, ni Stellariumov Remote Control, zato AstroChart Bridge ni poslal ničesar. Zaprite ta program, nato v nastavitvah Remote Control v Stellariumu odkljukajte in znova obkljukajte Server enabled.",
      },
      "request-failed": {
        heading: "Stellarium zahteve ni dokončal",
        message: "Stellariumov Remote Control se ni odzval po pričakovanjih. Preverite, ali je Stellarium odprt in se odziva, nato poskusite znova.",
      },
      "stellarium-not-earth": {
        heading: "Stellarium ni na Zemlji",
        message: "Opazovalec v Stellariumu je na drugem planetu. V Oknu za nastavljanje kraja (F6) izberite kraj na Zemlji, nato poskusite znova.",
      },
      "stellarium-date-out-of-range": {
        heading: "Tega datuma ni mogoče poslati v Stellarium",
        message: {
          send: "AstroChart Bridge pošilja Stellariumu datume od 15. oktobra 1582 do leta 9999.",
          import: "Stellarium kaže datum pred 15. oktobrom 1582 ali po letu 9999, ki ga AstroChart Bridge ne more prebrati.",
        },
      },
      mismatch: {
        heading: "Stellarium ni sprejel celotnega horoskopa",
      },
    },
    mismatchNames: { time: "čas", "clock-running": "ustavljena ura", latitude: "zemljepisna širina", longitude: "zemljepisna dolžina" },
    // After a colon, so the names don't have to agree with a verb.
    mismatch: (names) =>
      `Po pošiljanju se v Stellariumu s horoskopom ni ujemalo naslednje: ${and(names)}. Poskusite znova in preverite, da Stellarium ni zaposlen s skriptom.`,
    tryAgain: "Poskusi znova",
    sentHeading: "Poslano v Stellarium Desktop",
    sentNotes: [
      "Ura v Stellariumu je ustavljena na tem trenutku. Znova jo zaženeta njen gumb za predvajanje ali tipka K.",
      "Stellarium kaže čas v svojem časovnem pasu, ki ga to ne spremeni, zato njegova ura morda ne kaže lokalnega časa kraja rojstva. Zgornji UTC je trenutek, ki ga je prejel.",
      "Stellarium kraj poimenuje po koordinatah.",
    ],
    done: "Končano",
    fromHeading: "Iz Stellarium Desktop",
    pauseNote: "Če ura v Stellariumu teče, jo ustavite in znova uvozite, da bo horoskop trenutek, ki ste ga izbrali.",
  },

  // A program's own labels stay as it prints them, since the readers read
  // English screenshots only: Date of Birth, Sid. Time, St:, Time Zone, LC.
  screenshot: {
    refusals: {
      "unreadable-screenshot":
        "AstroChart Bridge v tem posnetku zaslona ni našel rojstnih podatkov. Z Astro-Seeka zajemite vse od Date of Birth do Latitude, Longitude; z astro.com glavo horoskopa od datuma do Sid. Time; iz Solar Fire ali Astro Gold podatke horoskopa od datuma do koordinat; iz Morinusa njegovo vrstico stanja ali sredino njegovega kvadratnega horoskopa; iz Valensa sredino njegovega kolesa; iz Planetdance vrstice levo zgoraj ob kolesu, do St:; iz Jagannatha Hora rojstne podatke od Date do Sidereal Time; iz Keplerja ali Siriusa blok podatkov od imena do Time Zone; iz Janusa sredino kolesa od datuma do koordinat; iz Win*Star desni zgornji del kolesa od datuma do zemljepisne širine; iz TimePassages ves horoskop z vogali; iz Astrologa zgornji del stranske vrstice od datuma do Julian Day. Posnetek naredite v polni velikosti.",
      "no-coordinates":
        "Ta posnetek zaslona nima koordinat. Kolo horoskopa v Astro Gold jih ne izpiše: zajemite raje njegovo ploščo Chart Details ali zaslon Edit Chart. Iz Solar Fire zajemite podatke horoskopa vse do koordinat.",
      "ambiguous-screenshot": "Ta posnetek zaslona kaže več kot en horoskop. AstroChart Bridge odpira samo rojstne horoskope.",
      "sidereal-mismatch": `Zvezdni čas v tem posnetku se ne ujema z njegovim univerzalnim časom in zemljepisno dolžino, ${MISREAD}`,
      "offset-out-of-range": `Lokalni čas v tem posnetku je preveč oddaljen od njegovega univerzalnega časa, ${MISREAD}`,
      "weekday-mismatch":
        "Dan v tednu v tem posnetku ne ustreza njegovemu datumu, zato je bil datum verjetno napačno prebran. Poskusite z večjim posnetkom.",
      "zone-offset-mismatch": `Časovni pas v tem posnetku se ne ujema z njegovim zamikom od UTC, ${MISREAD}`,
      "calendar-unsupported":
        "Ta horoskop ima datum pred začetkom gregorijanskega koledarja 15. oktobra 1582 ali je označen z Old Style ali BC. AstroChart Bridge bere samo gregorijanske datume.",
      "apparent-time": "Ta horoskop uporablja lokalni pravi sončni čas, ki ga AstroChart Bridge še ne zna odpreti.",
      "offset-off-quarter-hour":
        "Zvezdni čas v tem posnetku da zamik od UTC, ki ni na četrt ure, zato je bila zemljepisna dolžina verjetno napačno prebrana. Poskusite z večjim posnetkom. Horoskopa iz enega redkih pasov, ki niso na četrt ure, na primer amsterdamskega pred letom 1940, s posnetka TimePassages še ni mogoče prebrati.",
      "true-local-time-mismatch": `TLT v tem posnetku se ne ujema z njegovim zvezdnim časom in zemljepisno dolžino, ${MISREAD}`,
      "local-time-ambiguous":
        "Čas tega horoskopa je označen z LC, kar Morinus in Valens izpišeta tako za lokalni srednji kot za lokalni pravi sončni čas. AstroChart Bridge ne more ugotoviti, kateri je, zato ga še ne more odpreti.",
      "chart-type-unsupported": "To je horoskop povratka, profekcije ali direkcije. AstroChart Bridge odpira samo rojstne in horarne horoskope.",
    },
    either: (a, b) => `${a} ali ${b}`,
    // "iz programa Kepler ali Sirius", so a program's name needn't decline.
    offsetUnchecked: (program) =>
      `Nič v tem posnetku iz programa ${program} ne preveri njegovega zamika od UTC. Primerjajte vrstico Zamik s posnetkom.`,
    noOffset: (program) =>
      `Program ${program} ne izpiše zamika od UTC. Vnesite zamik v kraju rojstva, vključno s poletnim časom, v obliki ±HH:MM.`,
    compareNote: "Prebrano s posnetka zaslona. Preden odprete nebo, primerjajte te vrstice s posnetkom: nič ne preveri zemljepisne širine.",
  },

  // readText reads English labels, dates and compass letters only, so the
  // examples are ones it reads: "15 June 1985", "122°19'W". A Slovenian date
  // or a V for vzhod is refused as unreadable, not misread.
  paste: {
    tooLong: (max) =>
      `To besedilo je predolgo. Prilepite samo del z rojstnimi podatki, do ${count(max, UP_TO_CHARACTERS)}.`,
    refusals: {
      "no-birth-data":
        "AstroChart Bridge v tem besedilu ni našel rojstnih podatkov. Bere vrstice z angleškimi oznakami, kot sta »Date of Birth: 15 June 1985« in »latitude=47.6062«.",
      "several-records":
        "To besedilo ima več kot en datum rojstva ali ime, zato morda vsebuje več horoskopov. Prilepite po en horoskop naenkrat.",
    },
    fields: {
      date: { label: "Datum", example: "1985-06-15 ali 15 June 1985" },
      time: { label: "Lokalni čas", example: "10:30 ali 10:30 AM" },
      lat: { label: "Zemljepisna širina", example: "47.6062 ali 47°36'N" },
      lng: { label: "Zemljepisna dolžina", example: "-122.3321 ali 122°19'W" },
      offset: { label: "Zamik od UTC", example: "-07:00, vključno s poletnim časom" },
    },
    info: {
      name: "Ime",
      place: "Kraj",
      country: "Država",
      gender: "Spol",
      zone: "Časovni pas",
      houses: "Hiše",
      zodiac: "Zodiak",
      ayanamsa: "Ayanamsa",
    },
    formNote: "Vsako vrednost primerjajte z besedilom. Nič se ne pošlje, dokler ne odprete neba ali horoskopa.",
    placeNote:
      "AstroChart Bridge krajev ne išče. Stellarium Web, horoskop na Astro-Seeku in Deli uporabljajo zemljepisno širino in dolžino; obrazec astro.com in Shrani na Astro-Seeku … dobita mesto, da ga poiščeta v svojih seznamih.",
    noOffsetNote:
      "Če zamik od UTC pustite prazen, se horoskop lahko odpre samo na astro.com, ki poišče časovni pas za mesto. Stellarium Web, Astro-Seek in Deli potrebujejo zamik.",
    localOnlyNote:
      "Zamik od UTC ni vnesen, zato se ta horoskop lahko odpre samo na astro.com. Vrnite se na obrazec in vnesite zamik, da boste horoskop lahko odprli v Stellarium Web ali na Astro-Seeku ali ga delili.",
    offsetNote: "Nič ne preveri, ali je ta zamik na ta datum veljal v kraju rojstva.",
    // After "vendar", but.
    programRefusals: {
      "no-coordinates": "nima koordinat",
      "ambiguous-screenshot": "ga je mogoče prebrati kot besedilo več programov ali več horoskopov",
      "sidereal-mismatch": "se njegov zvezdni čas ne ujema z njegovim časom, zamikom in zemljepisno dolžino",
      "offset-out-of-range": "je njegov lokalni čas preveč oddaljen od njegovega univerzalnega časa",
      "weekday-mismatch": "njegov dan v tednu ne ustreza njegovemu datumu",
      "zone-offset-mismatch": "se njegov časovni pas ne ujema z njegovim zamikom od UTC",
      "calendar-unsupported":
        "ima datum pred začetkom gregorijanskega koledarja 15. oktobra 1582 ali je označen z Old Style ali BC, AstroChart Bridge pa bere samo gregorijanske datume",
      "apparent-time": "uporablja lokalni pravi sončni čas, ki ga AstroChart Bridge še ne zna odpreti",
      "local-time-ambiguous": "je njegov čas označen z LC, kar lahko pomeni lokalni srednji ali lokalni pravi sončni čas",
      "chart-type-unsupported": "je horoskop povratka, progresije ali drug horoskop, ki ni rojstni",
      "offset-off-quarter-hour": "njegov zvezdni čas da zamik od UTC, ki ni na četrt ure",
      "true-local-time-mismatch": "se njegov pravi lokalni čas ne ujema z njegovim zvezdnim časom in zemljepisno dolžino",
    },
    programRefused: "ne prestane preverjanj tega programa",
    turnedDown: (why, code) =>
      `To besedilo je oblikovano kot besedilo astrološkega programa ali spletnega mesta, vendar ${why}, zato AstroChart Bridge ni uporabil branja tega programa (${code}). Vsako vrednost primerjajte z besedilom.`,
    offsetUnchecked: (program) => `Nič v tem besedilu iz programa ${program} ne preveri njegovega zamika od UTC. Primerjajte zamik z besedilom.`,
    readAs: (program) => `Prebrano kot besedilo iz programa ${program}: rojstni podatki so razporejeni tako, kot jih izpiše ${program}.`,
    westPlus: (program) => `${program} zamike zahodno od Greenwicha piše s plusom, zato je njegov +7:00 tukaj UTC-07:00.`,
    programNoOffset: (program) =>
      `${program} ne izpiše zamika od UTC. Vnesite zamik v kraju rojstva na ta datum, vključno s poletnim časom.`,
    asProgram: (value, program) => `${value} (kot besedilo iz programa ${program})`,
    readAsSource: (program) => `Prebrano kot besedilo iz programa ${program}.`,
    lineReadAs: (line, text, program) => `Vrstica ${line}: ${text}, prebrano kot besedilo iz programa ${program}.`,
    readsDifferently: (line, program) => `Vrstica ${line} se bere drugače kot po razporedu programa ${program}. Izberite, kar besedilo pomeni.`,
    onLine: (value, line) => `${value} (vrstica ${line})`,
    zoneNoOffset: (zone) => `Besedilo navaja časovni pas »${zone}«, ne pa zamika. Vnesite zamik v kraju rojstva na ta datum.`,
    notInText: "Ni v prilepljenem besedilu.",
    differentLines: (lines) => `Besedilo navaja različne vrednosti v vrsticah ${and(lines.map(String))}.`,
    line: (line, text) => `Vrstica ${line}: ${text}`,
    eitherDate: (source) => `${source}. To je lahko kateri koli od obeh datumov.`,
    couldBe: (dates) => `To je lahko ${dates.join(" ali ")}. Napišite ime meseca v angleščini ali najprej leto.`,
    cantRead: (example) => `AstroChart Bridge tega ne zna prebrati. Poskusite na primer ${example}.`,
    preGregorian: PRE_GREGORIAN,
    houses: (houses) => `Besedilo uporablja hiše ${houses}, horoskop na Astro-Seeku pa se bo odprl s hišami Placidus.`,
    sidereal: "Besedilo uporablja siderični zodiak. AstroChart Bridge ga ne posreduje, zato ga nastavite v horoskopu na Astro-Seeku.",
    or: (items) => items.join(" ali "),
    atBirthplace: (time) => `${time} v kraju rojstva`,
  },

  files: {
    oneChart: "V tej datoteki je 1 horoskop.",
    unnamed: "Horoskop brez imena",
    birthplace: "Kraj rojstva",
    recordDate: (day, month, year) => `${day}. ${MONTHS[month - 1]} ${year}`,
  },

  aaf: {
    refusals: {
      "no-birth-date": "Ta horoskop nima datuma rojstva: datoteka navaja *.",
      "no-birth-time": "Ta horoskop nima časa rojstva: datoteka navaja *. AstroChart Bridge ga ne ugiba.",
      "julian-calendar": JULIAN,
      "pre-gregorian-date": PRE_GREGORIAN,
      "no-coordinates": "Ta horoskop nima koordinat, zato ni neba, ki bi ga lahko odprli.",
      "local-mean-time": "Ta horoskop uporablja lokalni srednji čas, ki ga AstroChart Bridge še ne zna odpreti.",
      "meridian-time":
        "Ta horoskop uporablja poseben poldnevnik, na primer lokalni čas prestolnice, ki ga AstroChart Bridge še ne zna odpreti.",
      "unknown-daylight-saving":
        "Ta horoskop ne pove, ali je veljal poletni čas: njegova vrsta časa je *. AstroChart Bridge tega ne ugiba.",
      "no-offset":
        "Ta horoskop ne navaja zamika od UTC, zato njegovega univerzalnega časa ni mogoče izračunati. AstroChart Bridge zamika ne ugiba.",
      "offset-seconds": "Zamik tega horoskopa vsebuje sekunde, česar AstroChart Bridge še ne zna odpreti.",
      "offset-out-of-range": OFFSET_RANGE,
      "julian-day-mismatch":
        "Julijanski dan v datoteki se ne ujema z njenim datumom, časom in zamikom, zato AstroChart Bridge ne more ugotoviti, kaj je pravilno.",
    },
    // In the genitive, after couldntRead's "ni mogel prebrati".
    unreadable: {
      "a93-fields": "vrstice #A93, ki potrebuje sedem polj,",
      "b93-fields": "vrstice #B93, ki potrebuje pet polj,",
      "bad-date": "datuma",
      "bad-time": "časa",
      "bad-julian-day": "julijanskega dneva",
      "bad-latitude": "zemljepisne širine",
      "bad-longitude": "zemljepisne dolžine",
      "bad-offset": "zamika",
      "bad-time-type": "vrste časa",
      "duplicate-b93": "druge vrstice #B93",
      "duplicate-znam": "druge vrstice #ZNAM",
      "bad-chunk": "vrstice",
    },
    thisRecord: "tega zapisa",
    couldntRead: (line, what, value) => `Vrstica ${line}: AstroChart Bridge ni mogel prebrati ${what} »${value}«.`,
    hourOnly: (time) => `Datoteka AAF navaja ta čas rojstva samo na uro natančno, zato je horoskop narisan za ${time}.`,
    unreadableRecord: (line) => `Vrstica ${line}: neberljiv zapis`,
    noRecords: "AstroChart Bridge ni našel zapisov AAF. Vsak zapis se začne z vrstico, ki se začne s #A93:.",
    charts: (n) => `V tej datoteki ${CHARTS_IN_FILE[PLURAL.select(n)].replace("#", n.toLocaleString("sl"))}. Izberite enega.`,
    save: "Shrani kot datoteko AAF",
    utNotes: {
      chart:
        "Datoteka AAF navaja ta horoskop v univerzalnem času, ker stran ne pove, kako se njegov zamik deli na standardni in poletni čas.",
      sky: "Datoteka AAF navaja ta trenutek v univerzalnem času, ker Stellarium Web ne kaže časovnega pasu kraja rojstva.",
    },
    dateUnknown: "datum neznan",
    timeUnknown: "čas neznan",
    notUtf8: "Ta datoteka ni v UTF-8, zato jo je AstroChart Bridge prebral kot Windows-1252. Preverite, ali so črke s strešicami in naglasi v imenih videti pravilno.",
  },

  hor: {
    refusals: {
      "chart-type-unsupported":
        "To je Morinusov horoskop druge vrste, na primer sončni povratek ali tranzit. AstroChart Bridge odpira samo radix in horarne horoskope.",
      "bce-date": "Datum tega horoskopa je pred našim štetjem, česar AstroChart Bridge še ne zna odpreti.",
      "julian-calendar": JULIAN,
      "pre-gregorian-date": PRE_GREGORIAN,
      "bad-date": "Datuma tega horoskopa ni v koledarju, na primer 30. februar.",
      "local-mean-time": "Ta horoskop je v lokalnem srednjem času, ki ga AstroChart Bridge še ne zna odpreti.",
      "local-apparent-time": "Ta horoskop je v lokalnem pravem sončnem času, času sončne ure, ki ga AstroChart Bridge še ne zna odpreti.",
      "bad-coordinates": "Koordinate tega horoskopa presegajo 90° zemljepisne širine ali 180° zemljepisne dolžine.",
      "offset-out-of-range": OFFSET_RANGE,
    },
    cantOpen: "AstroChart Bridge tega horoskopa ne more odpreti.",
    // The field's name in quotation marks, so it needn't decline: "polja »ime«".
    unreadable: {
      "too-large": () => "Ta datoteka je veliko večja od Morinusovega horoskopa, zato je AstroChart Bridge ni prebral.",
      truncated: (field) => `Ta datoteka se konča sredi polja »${field}«, zato je bila morda odrezana.`,
      "trailing-data": () => "Ta datoteka se nadaljuje za horoskopom, česar Morinusova datoteka s horoskopom ne počne, zato morda ni taka datoteka.",
      "unsupported-opcode": (field) =>
        `V polju »${field}« ta datoteka vsebuje nekaj, kar ni besedilo, število ali da oziroma ne, kar je edino, kar vsebuje Morinusov horoskop. AstroChart Bridge je ni prebral.`,
      malformed: (field) => `AstroChart Bridge te datoteke ni mogel prebrati pri polju »${field}«. Morda ni Morinusova datoteka s horoskopom.`,
      "bad-text": (field) => `V polju »${field}« ima ta datoteka besedilo, ki ga ni mogoče prebrati. Morda ni Morinusova datoteka s horoskopom.`,
      "field-type": (field) =>
        `V polju »${field}« ima ta datoteka vrsto vrednosti, ki je Morinus tja ne shranjuje, zato morda ni Morinusova datoteka s horoskopom.`,
      "field-range": (field) =>
        `V polju »${field}« ima ta datoteka vrednost zunaj tega, kar Morinus dovoli, zato morda ni Morinusova datoteka s horoskopom.`,
    },
    couldntReadFile: "AstroChart Bridge te datoteke ni mogel prebrati.",
    fieldWords: {
      name: "ime", male: "spol", htype: "vrsta horoskopa", bc: "pr. n. št.", year: "leto", month: "mesec", day: "dan",
      hour: "ura", minute: "minuta", second: "sekunda", cal: "koledar", zt: "vrsta časa", plus: "smer pasu",
      zh: "ure pasu", zm: "minute pasu", daylightsaving: "poletni čas", place: "kraj",
      deglon: "zemljepisna dolžina", minlon: "zemljepisna dolžina", seclon: "zemljepisna dolžina", east: "zemljepisna dolžina",
      deglat: "zemljepisna širina", minlat: "zemljepisna širina", seclat: "zemljepisna širina", north: "zemljepisna širina",
      altitude: "nadmorska višina", notes: "opombe",
    },
    warnings: {
      "text-encoding-guessed":
        "To datoteko je shranil starejši Morinus, ki ne zabeleži, kako je zapisal črke s strešicami in naglasi. Preverite, ali sta ime in kraj videti pravilna.",
      "daylight-saving-on-ut":
        "Morinus ima ta horoskop v greenwiškem času z obkljukanim poletnim časom, zato od vnesenega časa odšteje uro, in prav tako AstroChart Bridge.",
      "longitude-seconds-ignored-by-morinus":
        "Datoteka navaja zemljepisno dolžino na sekundo natančno, Morinus pa sekunde ob odpiranju datoteke izpusti, zato je njegov horoskop narisan do 59\" vzhodno ali zahodno od tega.",
    },
    zoneNote:
      "Morinus shrani zamik, vnesen za horoskop, ne pa njegovega časovnega pasu, zato nič tukaj ne preveri tega zamika glede na kraj rojstva in datum.",
    utDownloadNote: "Datoteka AAF navaja ta horoskop v univerzalnem času, ki ga Morinus izračuna iz vnesenega časa.",
    unreadableLabel: "Neberljiva datoteka Morinus",
    couldntReadMorinus: "AstroChart Bridge te datoteke Morinus ni mogel prebrati.",
    enteredAs: "Vneseno kot",
    chartType: "Vrsta horoskopa",
    horary: "Horarni",
    // "pas UTC-05:00, s poletnim časom" or "greenwiški čas".
    zone: (offset) => `pas ${offset}`,
    greenwich: "greenwiški čas",
    withDaylightSaving: (basis) => `${basis}, s poletnim časom`,
    // "16. nov. 575 pr. n. št. (julijanski)"
    recordDate: (day, month, year, bc, julian) =>
      `${day}. ${MONTHS[month - 1]} ${year}${bc ? " pr. n. št." : ""}${julian ? " (julijanski)" : ""}`,
  },

  // After "oddaljeno", as in "oddaljeno 3 km od koordinat horoskopa".
  towns: {
    away: (km) => (km < 1 ? "manj kot 1 km" : `${Math.round(km)} km`),
  },

  // Plain strings with {name} slots, as en.js says, and the sentences after
  // "AstroChart Bridge:" start in lower case here too. astro.com's and
  // Astro-Seek's own controls keep their English names: Gender, Male, Add
  // person, Birth city, automatic time zone, 00:00 GMT / UT, "4 h west". A
  // match is "zadetek"; "more than one is within 50 km" becomes "več jih je
  // oddaljenih manj kot 50 km", and "isn't within" "je oddaljen več kot".
  pageNotes: {
    astroCom: {
      useUt: "Vnesi v univerzalnem času",
      zoneUnreadable:
        "časovni pas na astro.com je tukaj »{line}«, ki ga ni mogoče primerjati z zamikom tega horoskopa, {zone}. Preverite, ali je mesto pravo. Če je, lahko horoskop namesto tega vnesete v univerzalnem času.",
      zoneAtUt:
        "ta horoskop je v univerzalnem času, automatic time zone na astro.com pa je za to mesto {words}. Preverite, ali je mesto pravo. Če je, horoskop namesto tega vnesite v univerzalnem času.",
      zoneOff:
        "ta horoskop je {zone} od univerzalnega časa, automatic time zone na astro.com pa je za to mesto {words}. Preverite, ali je mesto pravo. Če je, horoskop namesto tega vnesite v univerzalnem času.",
      enteredUt:
        "AstroChart Bridge je vnesel {ut} s časovnim pasom 00:00 GMT / UT. To je univerzalni čas samega horoskopa, zato je trenutek pravi, ne glede na to, kaj pravi opozorilo astro.com o ročnih časovnih pasovih.",
      gone: "seznam na astro.com nima več »{text}«. Mesto izberite s seznama.",
      listAgain: "Znova prikaži zadetke",
      chose: "s seznama na astro.com je izbral »{text}«, oddaljeno {away} od koordinat horoskopa.",
      chooseAnother: "Izberi drugo mesto",
      ask: "več zadetkov na astro.com za »{town}« je od koordinat horoskopa oddaljenih manj kot {km} km. Katero je mesto horoskopa?",
      noneOfOne:
        "edini zadetek na astro.com za »{town}« je od koordinat horoskopa oddaljen več kot {km} km. Mesto izberite s seznama na astro.com ali vpišite bližje.",
      noneOfMany:
        "noben od {listed} zadetkov na astro.com za »{town}« ni od koordinat horoskopa oddaljen manj kot {km} km. Mesto izberite s seznama na astro.com ali vpišite bližje.",
    },
    astroSeek: {
      genderStarts: "Preverite Gender, ki ga Astro-Seek nastavi na Male, nato pritisnite Add person.",
      genderSet: "Gender je nastavljen na {gender}, kot v horoskopu. Preverite ga, nato pritisnite Add person.",
      gone: "seznam na Astro-Seeku nima več »{text}«. Mesto izberite s seznama.",
      listAgain: "Znova prikaži zadetke",
      chose: "s seznama na Astro-Seeku je izbral »{text}«, oddaljeno {away} od koordinat horoskopa. {genderNote}",
      chooseAnother: "Izberi drugo mesto",
      ask: "več zadetkov na Astro-Seeku za »{town}« je od koordinat horoskopa oddaljenih manj kot {km} km. Katero je mesto horoskopa?",
      noneOfOne:
        "edini zadetek na Astro-Seeku za »{town}« je od koordinat horoskopa oddaljen več kot {km} km. Mesto izberite s seznama na Astro-Seeku ali vpišite bližje.",
      noneOfMany:
        "noben od {listed} zadetkov na Astro-Seeku za »{town}« ni od koordinat horoskopa oddaljen manj kot {km} km. Mesto izberite s seznama na Astro-Seeku ali vpišite bližje.",
      noList: "Astro-Seek zadetkov za »{town}« ni pravočasno prikazal. Mesto izberite s seznama.",
      noTown:
        "horoskop ne navaja mesta, Astro-Seek pa horoskop shrani samo z mestom Birth city, izbranim s seznama. Vpišite mesto in ga izberite; koordinate in UT/GMT horoskopa ostanejo, kot so. {genderNote}",
      placeBack:
        "AstroChart Bridge: Astro-Seek je spremenil zemljepisno širino, dolžino ali časovni pas, zato so vrnjeni podatki horoskopa: {place}, UT/GMT brez poletnega časa. Če to želite, jih tukaj spremenite sami.",
    },
  },

  chart: {
    copyLink: "Kopiraj povezavo",
    showQr: "Prikaži kodo QR",
    downloadFile: "Prenesi datoteko",
    shareLink: "Deli povezavo …",
    shareFile: "Deli datoteko …",
    shareNote: "Deli povezavo … in Deli datoteko … pošljeta horoskop v aplikacijo, ki jo izberete.",
    includesLegend: "Vključi v povezavo, kodo QR in datoteko",
    includesNote: "Ime in mesto gresta v povezavo, kodo QR in datoteko samo, če sta obkljukana, in kdor jih ima, ju lahko prebere.",
    remembersNote: "AstroChart Bridge si na tem računalniku zapomni, kaj obkljukate.",
    from: "Vir",
    viaNames: { page: "stran", screenshot: "posnetek zaslona", paste: "prilepljeno besedilo" },
    // "stran Astro-Seek", "posnetek zaslona astro.com": the kind first, so the site needn't decline.
    origin: (site, via) => [via, site].filter(Boolean).join(" "),
    viaWarnings: {
      screenshot:
        "Ta horoskop je bil na napravi, ki ga je delila, prebran s posnetka zaslona z OCR. Preden ga odprete, primerjajte te vrstice s horoskopom: nič ni preverilo zemljepisne širine.",
      paste:
        "Ta horoskop je bil na napravi, ki ga je delila, prebran iz prilepljenega besedila in ročno preverjen. Nič ni preverilo njegovega zamika od UTC glede na kraj rojstva in datum.",
    },
    refusals: {
      link: {
        malformed: "Ta povezava je nepopolna ali poškodovana. Znova kopirajte celotno povezavo.",
        "too-large": "Ta povezava je predolga, da bi bila horoskop AstroChart Bridge.",
        "not-astrochart": "Ta povezava ne vsebuje horoskopa AstroChart Bridge.",
        "unsupported-version": NEWER,
        "unknown-field": NEWER,
        "unsupported-calendar": NEWER,
        "before-gregorian": BEFORE_GREGORIAN,
      },
      file: {
        malformed: "Ta datoteka ni horoskop AstroChart Bridge ali pa je poškodovana.",
        "too-large": "Ta datoteka je prevelika, da bi bila horoskop AstroChart Bridge.",
        "not-astrochart": "Ta datoteka ni horoskop AstroChart Bridge.",
        "unsupported-version": NEWER_FILE,
        "unknown-field": NEWER_FILE,
        "unsupported-calendar": NEWER_FILE,
        "before-gregorian": BEFORE_GREGORIAN,
      },
    },
    damaged: {
      link: "Horoskop v tej povezavi ni veljaven. Znova kopirajte celotno povezavo.",
      file: "Horoskop v tej datoteki ni veljaven.",
    },
    empty: "Odprite povezavo ali datoteko AstroChart Bridge, da tukaj vidite njen horoskop.",
    otherFiles: {
      "morinus-file": "To je Morinusova datoteka s horoskopom (.hor), ne horoskop AstroChart Bridge.",
      "aaf-file": "To je datoteka AAF, ne horoskop AstroChart Bridge.",
    },
    inExtension: "Odpre se na strani za datoteke AAF in Morinus.",
    onTheWeb: "Odpre jo razširitev AstroChart Bridge: v njenem pojavnem oknu kliknite Odpri datoteko AAF ali Morinus.",
    openItThere: "Odpri jo tam",
    qrTooLong: (labelled) =>
      labelled
        ? `${QR_TOO_LONG} Odkljukajte ime ali mesto, da jo skrajšate, ali pa uporabite Kopiraj povezavo ali Prenesi datoteko.`
        : `${QR_TOO_LONG} Uporabite Kopiraj povezavo ali Prenesi datoteko.`,
    qrLabel: "Koda QR za povezavo do tega horoskopa",
    qrNote: "To skenirajte s kamero telefona ali tablice, da tam odprete horoskop. Kdor vidi kodo, lahko prebere horoskop.",
    shareTitle: "Horoskop AstroChart Bridge",
  },
};
