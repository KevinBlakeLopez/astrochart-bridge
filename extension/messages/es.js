// The interface's Spanish text, with en.js's keys. It speaks to the reader as
// tú, in words used on both sides of the Atlantic ("tu equipo", not computadora
// or ordenador). The names of astro.com's and Astro-Seek's own buttons, fields
// and options stay as those sites print them in English, since AstroChart
// Bridge's links open their English pages: Add person, Birth city, First name,
// 00:00 GMT / UT, show / hide extended settings, automatic time zone.

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// "a las 05:00", but "a la 01:00", as one says la una.
const at = (time) => (time.startsWith("01:") ? `a la ${time}` : `a las ${time}`);

const TOOLBAR_STEP = "vuelve a hacer clic en el icono de AstroChart Bridge de la barra de herramientas para completar el formulario.";

const LOCAL_ZONE =
  "La fecha y la hora son las locales de la carta, y la opción automatic time zone de astro.com busca la zona de la ciudad que elijas. ";

export default {
  view: {
    code: (code) => `Código: ${code}`,
    cancel: "Cancelar",
    offsetPlaceholder: "p. ej. -04:00",
    offsetLabel: "Diferencia horaria con UTC",
    offsetPreview: (utc) => `UTC: ${utc}`,
  },

  popup: {
    refusals: {
      transit: "Esta es una carta de tránsitos. AstroChart Bridge solo abre cartas natales.",
      synastry: "Esta es una carta de sinastría o de compatibilidad. AstroChart Bridge solo abre cartas natales.",
      unsupported: "Abre una carta natal de Astro-Seek o astro.com para usar AstroChart Bridge.",
      databank: "Todavía no se admiten las cartas de Astro-Databank. AstroChart Bridge abre las cartas guardadas en tu cuenta de astro.com.",
      "unsupported-chart": "AstroChart Bridge todavía no puede leer este tipo de carta de astro.com.",
      "no-drawing-link":
        "Esta página de astro.com no tiene el enlace \"Drawing (for subscribers)\", que es de donde AstroChart Bridge lee los datos de nacimiento.",
      "local-mean-time": "Esta carta usa la hora media local, que AstroChart Bridge todavía no puede abrir.",
      "calendar-unsupported":
        "Esta carta de astro.com tiene una fecha anterior al comienzo del calendario gregoriano, el 15 de octubre de 1582. AstroChart Bridge solo lee fechas gregorianas.",
      "page-url-mismatch": "La página no coincide con su dirección. Vuelve a cargar la carta e inténtalo de nuevo.",
      "stellarium-unreadable": "AstroChart Bridge no pudo leer el cielo de esta pestaña de Stellarium Web.",
    },
    unreadable: "AstroChart Bridge no pudo leer la página de esta carta.",
    tabUnreadable: "AstroChart Bridge no pudo leer esta pestaña.",
    chartUnshowable: "AstroChart Bridge no pudo mostrar esta carta.",

    // "17 abr 2024"
    shortDate: (day, month, year) => `${day} ${MONTHS[month - 1]} ${year}`,
    // "17 de abril de 2024"
    longDate: (day, month, year) => `${day} de ${MONTH_NAMES[month - 1]} de ${year}`,
    // "el 17 abr a las 05:00"
    timeOnDay: (time, day, month) => `el ${day} ${MONTHS[month - 1]} ${at(time)}`,
    // O for oeste.
    compass: { north: "N", south: "S", east: "E", west: "O" },
    // "a, b y c", with e before a word that starts with the sound i, as in "e hija".
    and: (items) => {
      if (items.length === 1) return items[0];
      const last = items.at(-1);
      return `${items.slice(0, -1).join(", ")} ${/^h?i(?!e)/i.test(last) ? "e" : "y"} ${last}`;
    },

    rows: {
      localTime: "Hora local",
      place: "Lugar",
      offset: "Diferencia horaria",
      utc: "UTC",
      stellariumTime: "Hora de Stellarium",
      gender: "Sexo",
    },
    // "17 abr 2024, 05:00, hora de tu equipo"
    stellariumTimeValue: (time, day, month, year) => `${day} ${MONTHS[month - 1]} ${year}, ${time}, hora de tu equipo`,
    genders: { female: "Femenino", male: "Masculino", event: "Evento" },

    buttons: {
      openSky: "Abrir Stellarium Web",
      openInAstroSeek: "Abrir la carta en Astro-Seek",
      saveInAstroSeek: "Guardar en Astro-Seek…",
      openAstroSeekForm: "Abrir el formulario de Astro-Seek",
      astroSeekTab: "Ir a la pestaña de Astro-Seek",
      share: "Compartir…",
      enterInAstroCom: "Completar en astro.com…",
      openAstroComForm: "Abrir el formulario de astro.com",
      signIn: "Iniciar sesión",
      createAccount: "Crear cuenta",
      astroComTab: "Ir a la pestaña de astro.com",
      blankForm: "Abrir un formulario en blanco",
      fillAnyway: "Completar de todos modos",
      fillForm: "Completar el formulario",
      cancel: "Cancelar",
    },
    groups: { sky: "Ver el cielo", elsewhere: "Llevar la carta a otro sitio" },
    otherWays: {
      read: "Leer una carta que tienes",
      screenshot: "Leer una captura de pantalla",
      paste: "Pegar el texto de una carta",
      file: "Abrir un archivo AAF o de Morinus",
      bridgeFile: "Abrir un archivo de AstroChart Bridge",
      desktop: "O usar el cielo de Stellarium Desktop",
      importFromDesktop: "Importar desde Stellarium Desktop",
      more: "Leer otra carta",
    },

    clockNote: "El reloj de Stellarium Web muestra la zona horaria de tu equipo y sigue en marcha.",
    privacyNote:
      "Abrir el cielo envía esta fecha, hora y lugar a stellarium-web.org, y su página pasa el enlace a las etiquetas publicitarias de Google.",
    // Each says that the clock keeps running within its first sentence, which
    // keeps the note to English's two lines (or three) at the popup's 440px.
    clockSame: (clock) => `El reloj de Stellarium Web marcará ${clock}, como en el lugar de nacimiento, y avanzará hasta que lo pauses.`,
    clockDiffers: (clock, birth) =>
      `El reloj de Stellarium Web marcará ${clock}, la hora de tu equipo, y avanzará hasta que lo pauses. En el lugar de nacimiento es ${birth}.`,
    zoneLabelUnknown: (label) =>
      label === null
        ? "Astro-Seek no muestra ninguna etiqueta de zona horaria, así que se usa su Tiempo Universal tal como aparece."
        : `AstroChart Bridge no puede comprobar la etiqueta de zona horaria "${label}" de Astro-Seek, así que se usa su Tiempo Universal tal como aparece.`,
    contradicts: (time, label, offset) =>
      `La página de Astro-Seek se contradice: marca ${time} como ${label}, pero su Tiempo Universal implica ${offset}.`,
    asPrinted: (utc, offset) => `${utc} UTC, como aparece en Astro-Seek (${offset})`,
    asLabelled: (utc, label, offset) => `${utc} UTC, como dice la etiqueta ${label} (${offset})`,
    needsOffset: "Astro-Seek no muestra el Tiempo Universal. Escribe la diferencia horaria con UTC del lugar de nacimiento, en formato ±HH:MM.",

    astroSeekNotes: [
      "Astro-Seek dibujará esta carta en UT/GMT en estas coordenadas, redondeada al minuto y sin ciudad.",
      "Abrir la carta envía esta fecha, hora y lugar a astro-seek.com.",
    ],
    astroSeekSaveNote: "Abrir o guardar envía esta fecha, hora y lugar a astro-seek.com.",
    astroSeekSaveNamedNote:
      "Abrir o guardar envía esta fecha, hora y lugar a astro-seek.com; guardar también envía el nombre y la ciudad de la carta, si los tiene.",
    astroSeekSaveBusy: "Abriendo el formulario Add person de Astro-Seek…",
    saveMessages: {
      "signed-out":
        "Astro-Seek indica que no has iniciado sesión, y solo guarda cartas en una cuenta. Inicia sesión en su pestaña y vuelve a hacer clic en Guardar en Astro-Seek…",
      elsewhere: "Astro-Seek no mostró su formulario Add person. Si te pide iniciar sesión, hazlo y vuelve a hacer clic en Guardar en Astro-Seek…",
      "not-loaded": "El formulario de Astro-Seek no terminó de abrirse a tiempo, así que AstroChart Bridge no eligió su ciudad.",
      "city-typed": "El formulario de Astro-Seek ya tenía una Birth city, así que AstroChart Bridge la dejó como estaba.",
      unrecognised: "AstroChart Bridge no reconoció el formulario de Astro-Seek, así que no eligió su ciudad.",
    },
    checkNote:
      "Antes de hacer clic en Add person, elige la Birth city en la lista de Astro-Seek si no está elegida, y comprueba que las coordenadas y el UT/GMT siguen siendo los de la carta.",
    saveDeclined: "AstroChart Bridge no puede elegir la ciudad en el formulario de Astro-Seek sin acceso a www.astro-seek.com.",
    saveDeclinedNote: (named) => `El formulario se abre con esta fecha, hora y lugar en UT/GMT${named ? ", y con el nombre" : ""}.`,

    shareBeforeGregorian:
      "AstroChart Bridge todavía no puede compartir una carta con fecha anterior al 15 de octubre de 1582: no puede saber en qué calendario está la fecha.",
    shareRefused: "AstroChart Bridge no puede compartir esta carta.",

    townNote: (town) =>
      town === null
        ? "astro.com pide un país y una ciudad, no coordenadas. Elige la ciudad más cercana a este lugar y comprueba las coordenadas que muestra astro.com."
        : `astro.com pide un país y una ciudad, no coordenadas. AstroChart Bridge escribe la ciudad ${town}; elige la coincidencia más cercana a este lugar y comprueba las coordenadas que muestra astro.com.`,
    signInNote:
      "astro.com solo dibuja la carta si has iniciado sesión en una cuenta. Si te pide iniciar sesión o crear una cuenta gratuita, hazlo en esa pestaña: AstroChart Bridge guarda estos valores para ella.",
    keepsNote: (minutes) =>
      `AstroChart Bridge los guarda durante ${minutes} minutos, hasta que los escribe en el formulario o hasta que canceles o cierres el navegador. Al completarlo, quedan en la página de astro.com, y su búsqueda de ciudades envía una ciudad a astro.com de inmediato; al enviar el formulario se envía el resto.`,
    accessNote:
      "La primera vez, tu navegador te pide permiso para que AstroChart Bridge lea y modifique las páginas de www.astro.com. Solo lo usa para completar el formulario en la pestaña que abre. Si dices que no, te muestra los valores para que los escribas tú.",
    afterTabOpens: `Cuando se abra la pestaña de astro.com, ${TOOLBAR_STEP}`,
    switchToTab: `Ve a la pestaña de astro.com y ${TOOLBAR_STEP}`,
    astroComBusy: "Abriendo el formulario de astro.com para completarlo…",
    noAccess: "AstroChart Bridge no puede completar el formulario sin acceso a www.astro.com.",
    formNeedsChoice: "El formulario de astro.com está abierto, pero antes necesitas elegir algo, como iniciar sesión.",
    formNotOpened: "El formulario de astro.com no terminó de abrirse, así que AstroChart Bridge todavía no pudo completarlo.",
    nameNote:
      "El nombre va en los campos First name y Last name de astro.com, y antes puedes cambiarlo aquí. Un nombre sin separar va en First name, y astro.com no guarda una carta sin él.",
    nameWarning: (length, fields) =>
      `Los campos de nombre de astro.com admiten ${length} caracteres. Acorta ${fields} aquí, o astro.com podría cortarlo.`,
    byHand: "Escribe estos valores en el formulario de astro.com. Esta página no puede completarlo por ti.",
    fillsAsItOpens: "AstroChart Bridge abre el formulario de astro.com y lo completa mientras se abre. No envía el formulario.",
    universalTimeNote: "La fecha y la hora están en Tiempo Universal, así que pueden ser distintas de la fecha y la hora locales de nacimiento.",
    typedForm: "Este formulario ya tiene una fecha o una hora. AstroChart Bridge solo completa formularios en blanco, así que no cambiará lo que hay.",
    unrecognisedForm: "AstroChart Bridge no reconoce este formulario de astro.com, así que no puede completarlo. Escribe tú los valores de arriba.",
    keepingForTab: "AstroChart Bridge está guardando estos valores para esta pestaña.",
    whenSignedIn:
      "Cuando hayas iniciado sesión, abre el formulario de datos de nacimiento de astro.com en esta pestaña y vuelve a hacer clic en el icono de AstroChart Bridge de la barra de herramientas para completarlo.",
    signInHeading: "Inicia sesión en astro.com",
    requiresAccount: "astro.com necesita una cuenta para generar cartas. Inicia sesión en tu cuenta o crea una cuenta gratuita para continuar.",
    keepsWhileSigningIn:
      "AstroChart Bridge guarda estos valores para la pestaña de astro.com mientras inicias sesión. Después, abre allí el formulario de astro.com y vuelve a hacer clic en el icono de AstroChart Bridge de la barra de herramientas.",
    fillQuestion: "¿Completar el formulario de astro.com con estos valores?",
    filled: {
      birthday: "la fecha de nacimiento",
      hour: "la hora",
      minute: "el minuto",
      universalTime: "la zona horaria 00:00 GMT / UT",
      name: "el nombre",
      gender: "el sexo",
      town: (town) => `la ciudad ${town}`,
    },
    fillNote: (filled, hasTown) =>
      `AstroChart Bridge completa ${filled}. ` +
      (hasTown
        ? "Elige la coincidencia de astro.com más cercana a este lugar y comprueba las coordenadas que muestra."
        : "Elige tú la ciudad más cercana a este lugar y comprueba las coordenadas que muestra astro.com."),
    doesntSubmit: "AstroChart Bridge no envía el formulario, y olvida estos valores en cuanto los ha completado.",

    astroComRows: {
      birthday: "Birthday",
      hourMin: "Hour, min",
      timeZone: "Time zone",
      town: "Town",
      firstName: "First name",
      lastName: "Last name",
      gender: "Gender",
    },
    universalTimeZone: "00:00 GMT / UT, en show / hide extended settings",
    automaticZone: "automatic time zone, la opción predeterminada del formulario",
    wholeMinutes: (seconds) =>
      seconds === 1
        ? "astro.com solo admite minutos enteros, así que se omite 1 segundo."
        : `astro.com solo admite minutos enteros, así que se omiten los ${seconds} segundos.`,
    zoneUnchecked:
      LOCAL_ZONE +
      "AstroChart Bridge no tiene una diferencia con UTC con la que comprobarla, así que comprueba la zona horaria que muestra astro.com para la ciudad y la fecha.",
    zoneChecked: (zone) =>
      LOCAL_ZONE +
      `Debería ser ${zone}: AstroChart Bridge la comprueba en la página cuando eliges la ciudad, y allí te ofrece el Tiempo Universal si no lo es.`,
    zoneToCheck: (zone, date, time) =>
      LOCAL_ZONE +
      `Comprueba que sea ${zone}. Si no lo es, elige 00:00 GMT / UT en show / hide extended settings y escribe ${date}, ${time} en su lugar.`,
  },
};
