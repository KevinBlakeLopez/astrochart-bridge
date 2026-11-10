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

const NEWER = "Esta carta la creó una versión más reciente de AstroChart Bridge, que esta página no puede leer.";
const NEWER_FILE = "Este archivo lo creó una versión más reciente de AstroChart Bridge, que esta página no puede leer.";
const BEFORE_GREGORIAN = "La fecha de esta carta es anterior al 15 de octubre de 1582, y AstroChart Bridge todavía no puede abrirla.";
const PRE_GREGORIAN = "AstroChart Bridge abre fechas a partir del 15 de octubre de 1582, cuando comenzó el calendario gregoriano.";
const QR_TOO_LONG = "Este enlace es demasiado largo para un código QR que se lea bien.";
const ELEVATION_RANGE = "Escribe metros enteros, de -500 a 25000.";

// "a, b y c", with e before a word that starts with the sound i, as in "e hija".
const and = (items) => {
  if (items.length < 2) return items.join("");
  const last = items.at(-1);
  return `${items.slice(0, -1).join(", ")} ${/^h?i(?!e)/i.test(last) ? "e" : "y"} ${last}`;
};

// "las 05:00", but "la 01:00", as one says la una; "a las 05:00".
const clock = (time) => (time.startsWith("01:") ? `la ${time}` : `las ${time}`);
const at = (time) => `a ${clock(time)}`;

const TOOLBAR_STEP = "vuelve a hacer clic en el icono de AstroChart Bridge de la barra de herramientas para completar el formulario.";

const LOCAL_ZONE =
  "La fecha y la hora son las locales de la carta, y la opción automatic time zone de astro.com busca la zona de la ciudad que elijas. ";

export default {
  pages: {
    popup: {
      title: "AstroChart Bridge",
      reading: "Leyendo la página…",
      version: (number) => `AstroChart Bridge ${number}`,
    },
    screenshot: {
      title: "AstroChart Bridge: leer una captura de pantalla",
      heading: "Leer la captura de pantalla de una carta",
      intro:
        "Pega (⌘V) o suelta en cualquier parte de esta página una captura de pantalla de una página de carta natal de Astro-Seek, un dibujo de carta de astro.com, una rueda de Solar Fire, los Chart Details de Astro Gold, una carta de Morinus, una rueda de Valens, una carta de Planetdance, los datos de nacimiento de Jagannatha Hora, una rueda de Kepler o Sirius, una rueda de Janus o Win*Star, una carta de TimePassages o una rueda de Astrolog, o elige un archivo. De Astro-Seek necesita todo desde Date of Birth hasta Latitude, Longitude; de astro.com, la cabecera del dibujo desde la fecha hasta Sid. Time; de Solar Fire o Astro Gold, los datos de la carta desde la fecha hasta las coordenadas; de Morinus, su barra de estado o el centro de su carta cuadrada; de Valens, el centro de su rueda; de Planetdance, las líneas de arriba a la izquierda de la rueda, hasta St:; de Jagannatha Hora, los datos de nacimiento desde Date hasta Sidereal Time; de Kepler o Sirius, el bloque de datos desde el nombre hasta Time Zone; de Janus, el centro de la rueda desde la fecha hasta las coordenadas; de Win*Star, la parte superior derecha de la rueda desde la fecha hasta la latitud; de TimePassages, toda la carta, con sus esquinas; de Astrolog, la parte superior de la barra lateral desde la fecha hasta Julian Day. Vale la página entera.",
      choose: "Elegir una captura de pantalla",
      privacy: "La captura de pantalla se lee en este equipo y no se envía a ningún sitio.",
      whatWasRead: "Lo que leyó AstroChart Bridge",
      reading: "Leyendo la captura de pantalla…",
      unreadable: "AstroChart Bridge no pudo leer esta imagen.",
    },
    paste: {
      title: "AstroChart Bridge: pegar el texto de una carta",
      heading: "Pegar el texto de una carta",
      intro:
        'Pega datos de nacimiento copiados de un programa de astrología, un informe o una nota, en líneas con etiquetas en inglés, como "Date of Birth: 15 June 1985" o "latitude=47.6062".',
      textLabel: "Texto de la carta",
      read: "Leer el texto",
      fromClipboard: "Pegar del portapapeles",
      privacy: "El texto se lee en este equipo y no se envía ni se guarda en ningún sitio.",
      clipboardRefused: "Tu navegador no dejó que AstroChart Bridge leyera el portapapeles. Haz clic en el cuadro de arriba y pega con ⌘V o Ctrl+V.",
      continue: "Continuar",
      continueToAstroCom: "Continuar en astro.com",
      alsoInText: "También en el texto:",
      back: "Volver al formulario",
    },
    import: {
      title: "AstroChart Bridge: abrir un archivo AAF o de Morinus",
      heading: "Abrir un archivo AAF o de Morinus",
      intro:
        "Elige o suelta en cualquier parte de esta página un archivo AAF (.aaf) o una carta de Morinus (.hor), o pega abajo el texto de un archivo AAF. Astrolog y otros programas de astrología guardan las cartas en AAF.",
      choose: "Elegir un archivo AAF o de Morinus",
      textLabel: "Texto AAF",
      read: "Leer el texto pegado",
      privacy: "El archivo se lee en este equipo y no se envía a ningún sitio.",
    },
    chart: {
      title: "AstroChart Bridge: abrir una carta",
      readingLink: "Leyendo el enlace…",
      linkLabel: "Enlace a esta carta",
      openFile: "Abrir un archivo de AstroChart Bridge",
      fileLabel: "Archivo de carta",
      privacy:
        "El enlace de una carta contiene la propia carta, y su archivo también. Cualquiera que tenga uno de los dos puede leerla, así que compártelos solo con personas que deban ver estos datos de nacimiento. Esta página los lee en este dispositivo, no guarda nada y no envía nada hasta que abras el cielo o la carta.",
      opened: (name) => `Se abrió ${name}.`,
      couldntPass:
        "AstroChart Bridge no pudo pasar el archivo. Haz clic en Abrir un archivo AAF o de Morinus en la ventana emergente de la extensión y elígelo allí.",
      linkCopied: "Enlace copiado.",
      copyRefused: "Este navegador no dejó que AstroChart Bridge copiara el enlace. Cópialo desde aquí:",
      hideQr: "Ocultar código QR",
      shareSheetFailed: "AstroChart Bridge no pudo abrir el menú para compartir. Usa Copiar enlace o Descargar archivo.",
    },
    helioscope: {
      title: "AstroChart Bridge: qué planetas eran visibles",
      heading: "Qué planetas eran visibles",
      elevation: "Altitud en metros",
      underTheBeams: "Bajo los rayos a menos de",
      working: "Calculando los planetas…",
      notice:
        "AstroChart Bridge, © 2026 Kevin Blake Lopez, lo calcula en este dispositivo con Swiss Ephemeris, © 1997–2021 Astrodienst AG, a través de swisseph-wasm. Los tres son software libre: puedes compartirlos y modificarlos según la Licencia Pública General Affero de GNU, versión 3 o posterior. No tienen ninguna garantía.",
      source: "Código fuente y licencia",
    },
    astroComFilled: "AstroChart Bridge completó el formulario de astro.com en su pestaña.",
    astroSeekFilled: "AstroChart Bridge completó el formulario de Astro-Seek en su pestaña. Comprueba allí Gender y después haz clic en Add person.",
  },

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
        "Esta carta tiene una fecha anterior al comienzo del calendario gregoriano, el 15 de octubre de 1582. AstroChart Bridge solo lee fechas gregorianas.",
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
    and,

    rows: {
      localTime: "Hora local",
      place: "Lugar",
      town: "Ciudad",
      name: "Nombre",
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
      helioscope: "Qué planetas eran visibles",
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
    astroSeekDateLine: "Astro-Seek no admite una longitud de 180°, así que recibe 179°59' del mismo lado, a 1 minuto de arco.",
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
    helioscopeBeforeGregorian:
      "AstroChart Bridge todavía no puede calcular los planetas de una carta con fecha anterior al 15 de octubre de 1582: no puede saber en qué calendario está la fecha.",
    helioscopeRefused: "AstroChart Bridge no puede calcular los planetas de esta carta.",

    townNote: (town) =>
      town === null
        ? "astro.com pide un país y una ciudad, no coordenadas. Elige la ciudad más cercana a este lugar y comprueba las coordenadas que muestra astro.com."
        : `astro.com pide un país y una ciudad, no coordenadas. AstroChart Bridge escribe la ciudad ${town}; elige la coincidencia más cercana a este lugar y comprueba las coordenadas que muestra astro.com.`,
    townByHandNote: (town) =>
      `astro.com pide un país y una ciudad, no coordenadas. Escribe la ciudad ${town}, elige la coincidencia más cercana a este lugar y comprueba las coordenadas que muestra astro.com.`,
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

  // Stellarium follows the computer's language, so its windows, tabs and
  // settings are named as its own Spanish translation names them
  // (po/stellarium/es.po in Stellarium's repository, read on 2026-11-02):
  // Ventana de configuración, Complementos, Control Remoto, Cargar al inicio,
  // configurar, Servidor habilitado, Activar automáticamente el inicio,
  // Número de puerto, El acceso requiere autenticación, Guardar
  // configuración, Ventana de ubicación.
  desktop: {
    send: "Enviar a Stellarium Desktop",
    nowDefault: "Stellarium Desktop es ahora tu opción predeterminada para las cartas. Cada pantalla de carta tiene un enlace para volver a cambiarla.",
    undo: "Deshacer",
    isDefault: "Stellarium Desktop es tu opción predeterminada para las cartas.",
    makeWebDefault: "Usar Stellarium Web de forma predeterminada",
    webDefaultAgain: "Stellarium Web vuelve a ser la opción predeterminada.",
    useByDefault: "Usar Stellarium Desktop de forma predeterminada",
    hints: {
      connected: "Stellarium Desktop está abierto y listo.",
      unavailable: "Ahora mismo no se puede conectar con Stellarium Desktop. El botón muestra cómo configurarlo.",
      "auth-required": "Stellarium pide una contraseña, que AstroChart Bridge no usa. El botón muestra cómo desactivarla.",
      "invalid-response": "Un programa que no es Stellarium está respondiendo en el puerto 8090.",
      "stellarium-not-earth": "El observador de Stellarium está en otro planeta.",
    },
    noAnswer: "Stellarium Desktop no respondió.",
    sending: "Enviando a Stellarium Desktop…",
    reading: "Leyendo Stellarium Desktop…",
    setupSteps: [
      "Abre Stellarium y presiona F2 (fn+F2 en muchos teclados de Mac) para abrir su Ventana de configuración.",
      "En la pestaña Complementos, selecciona Control Remoto y marca Cargar al inicio.",
      "Cierra Stellarium y vuelve a abrirlo: el complemento solo se carga cuando Stellarium se inicia.",
      "Presiona F2 de nuevo, selecciona Control Remoto en la pestaña Complementos y haz clic en configurar.",
      "Marca Servidor habilitado, y también Activar automáticamente el inicio para no tener que hacerlo la próxima vez. Deja Número de puerto en 8090 y El acceso requiere autenticación sin marcar, y haz clic en Guardar configuración.",
      "Vuelve aquí y haz clic en Reintentar.",
    ],
    networkNote:
      "Mientras su servidor está activo, otros dispositivos de tu red también pueden controlar Stellarium. Desmarca Servidor habilitado cuando termines si eso importa en esta red.",
    problems: {
      unavailable: {
        heading: "No se puede conectar con Stellarium Desktop",
        message: "No se pudo conectar con Stellarium Desktop. Abre Stellarium y activa su complemento Control Remoto.",
      },
      "no-permission": {
        heading: "AstroChart Bridge necesita tu permiso",
        message:
          "Para llegar a Stellarium, AstroChart Bridge necesita permiso para conectarse a este equipo en 127.0.0.1. No se conecta a ningún otro sitio, y solo cuando haces clic.",
      },
      "auth-required": {
        heading: "Stellarium pide una contraseña",
        message:
          "AstroChart Bridge no usa la contraseña de Control Remoto. En la configuración de Control Remoto de Stellarium, desmarca El acceso requiere autenticación y haz clic en Guardar configuración; después desmarca y vuelve a marcar Servidor habilitado para reiniciar el servidor.",
      },
      "invalid-response": {
        heading: "Otro programa está usando el puerto 8090",
        message:
          "El programa que responde en el puerto 8090 no es el Control Remoto de Stellarium, así que AstroChart Bridge no envió nada. Cierra ese programa y después desmarca y vuelve a marcar Servidor habilitado en la configuración de Control Remoto de Stellarium.",
      },
      "request-failed": {
        heading: "Stellarium no terminó la solicitud",
        message: "El Control Remoto de Stellarium no respondió como se esperaba. Comprueba que Stellarium esté abierto y responda, y vuelve a intentarlo.",
      },
      "stellarium-not-earth": {
        heading: "Stellarium no está en la Tierra",
        message: "El observador de Stellarium está en otro planeta. Elige un lugar de la Tierra en su Ventana de ubicación (F6) y vuelve a intentarlo.",
      },
      "stellarium-date-out-of-range": {
        heading: "Esta fecha no se puede enviar a Stellarium",
        message: {
          send: "AstroChart Bridge envía a Stellarium fechas desde el 15 de octubre de 1582 hasta el año 9999.",
          import: "Stellarium muestra una fecha anterior al 15 de octubre de 1582 o posterior al año 9999, que AstroChart Bridge no puede leer.",
        },
      },
      mismatch: {
        heading: "Stellarium no aceptó toda la carta",
      },
    },
    mismatchNames: { time: "la hora", "clock-running": "el reloj en pausa", latitude: "la latitud", longitude: "la longitud" },
    mismatch: (names) =>
      `Después del envío, ${and(names)} de Stellarium no ${names.length === 1 ? "coincidía" : "coincidían"} con la carta. ` +
      "Vuelve a intentarlo y comprueba que Stellarium no esté ocupado con un script.",
    tryAgain: "Reintentar",
    sentHeading: "Enviado a Stellarium Desktop",
    sentNotes: [
      "El reloj de Stellarium está en pausa en este momento. Su botón de reproducción, o K, lo vuelve a poner en marcha.",
      "Stellarium muestra la hora en su propia zona horaria, que esto no cambia, así que su reloj puede no mostrar la hora local del lugar de nacimiento. El UTC de arriba es el momento que recibió.",
      "Stellarium nombra el lugar por sus coordenadas.",
    ],
    done: "Listo",
    fromHeading: "Desde Stellarium Desktop",
    pauseNote: "Si el reloj de Stellarium está en marcha, ponlo en pausa e importa de nuevo, para que la carta sea el momento que elegiste.",
  },

  // A program's own labels stay as it prints them, since the readers read
  // English screenshots only: Date of Birth, Sid. Time, St:, Time Zone, LC.
  screenshot: {
    refusals: {
      "unreadable-screenshot":
        "AstroChart Bridge no encontró los datos de nacimiento en esta captura de pantalla. De Astro-Seek, incluye todo desde Date of Birth hasta Latitude, Longitude; de astro.com, la cabecera de la carta desde la fecha hasta Sid. Time; de Solar Fire o Astro Gold, los datos de la carta desde la fecha hasta las coordenadas; de Morinus, su barra de estado o el centro de su carta cuadrada; de Valens, el centro de su rueda; de Planetdance, las líneas de arriba a la izquierda de la rueda, hasta St:; de Jagannatha Hora, los datos de nacimiento desde Date hasta Sidereal Time; de Kepler o Sirius, el bloque de datos desde el nombre hasta Time Zone; de Janus, el centro de la rueda desde la fecha hasta las coordenadas; de Win*Star, la parte superior derecha de la rueda desde la fecha hasta la latitud; de TimePassages, toda la carta, con sus esquinas; de Astrolog, la parte superior de la barra lateral desde la fecha hasta Julian Day. Hazla a tamaño completo.",
      "no-coordinates":
        "Esta captura de pantalla no tiene coordenadas. La rueda de Astro Gold no las muestra: captura su panel Chart Details o su pantalla Edit Chart. De Solar Fire, incluye los datos de la carta hasta las coordenadas.",
      "ambiguous-screenshot": "Esta captura de pantalla muestra más de una carta. AstroChart Bridge solo abre cartas natales.",
      "sidereal-mismatch":
        "El tiempo sidéreo de esta captura no coincide con su Tiempo Universal y su longitud, así que probablemente alguno se leyó mal. Prueba con una captura más grande.",
      "offset-out-of-range":
        "La hora local de esta captura está demasiado lejos de su Tiempo Universal, así que probablemente alguna se leyó mal. Prueba con una captura más grande.",
      "weekday-mismatch":
        "El día de la semana de esta captura no corresponde a su fecha, así que probablemente la fecha se leyó mal. Prueba con una captura más grande.",
      "zone-offset-mismatch":
        "La zona horaria de esta captura no coincide con su diferencia horaria con UTC, así que probablemente alguna se leyó mal. Prueba con una captura más grande.",
      "calendar-unsupported":
        "Esta carta tiene una fecha anterior al comienzo del calendario gregoriano, el 15 de octubre de 1582, o está marcada como Old Style o BC. AstroChart Bridge solo lee fechas gregorianas.",
      "apparent-time": "Esta carta usa la hora aparente local, que AstroChart Bridge todavía no puede abrir.",
      "offset-off-quarter-hour":
        "El tiempo sidéreo de esta captura da una diferencia horaria con UTC que no cae en un cuarto de hora, así que probablemente su longitud se leyó mal. Prueba con una captura más grande. Una carta de una de las pocas zonas que no caen en un cuarto de hora, como la de Ámsterdam antes de 1940, todavía no se puede leer de una captura de TimePassages.",
      "true-local-time-mismatch":
        "El TLT de esta captura no coincide con su tiempo sidéreo y su longitud, así que probablemente alguno se leyó mal. Prueba con una captura más grande.",
      "local-time-ambiguous":
        "La hora de esta carta está marcada como LC, que Morinus y Valens usan tanto para la hora media local como para la hora aparente local. AstroChart Bridge no puede saber cuál es, así que todavía no puede abrirla.",
      "chart-type-unsupported": "Esta es una carta de revolución, profección o dirección. AstroChart Bridge solo abre cartas natales y horarias.",
    },
    either: (a, b) => `${a} o ${b}`,
    offsetUnchecked: (program) =>
      `Nada en esta captura de ${program} comprueba su diferencia horaria con UTC. Compara la fila Diferencia horaria con la captura.`,
    noOffset: (program) =>
      `${program} no muestra la diferencia horaria con UTC. Escribe la del lugar de nacimiento, con el horario de verano incluido, en formato ±HH:MM.`,
    compareNote: "Leído de una captura de pantalla. Compara estas filas con ella antes de abrir el cielo: nada comprueba la latitud.",
  },

  // readText reads English labels, dates and compass letters only, so the
  // examples are ones it reads: "15 June 1985", "122°19'W". It refuses "O"
  // for west and a Spanish date as unreadable, rather than misreading them.
  paste: {
    tooLong: (max) => `Este texto es demasiado largo. Pega solo la parte con los datos de nacimiento, hasta ${max.toLocaleString("es")} caracteres.`,
    refusals: {
      "no-birth-data":
        'AstroChart Bridge no encontró datos de nacimiento en este texto. Lee líneas con etiquetas en inglés, como "Date of Birth: 15 June 1985" o "latitude=47.6062".',
      "several-records":
        "Este texto tiene más de una fecha de nacimiento o más de un nombre, así que puede contener más de una carta. Pega una carta cada vez.",
    },
    fields: {
      date: { label: "Fecha", example: "1985-06-15 o 15 June 1985" },
      time: { label: "Hora local", example: "10:30 o 10:30 AM" },
      lat: { label: "Latitud", example: "47.6062 o 47°36'N" },
      lng: { label: "Longitud", example: "-122.3321 o 122°19'W" },
      offset: { label: "Diferencia con UTC", example: "-07:00, con el horario de verano incluido" },
    },
    info: {
      name: "Nombre",
      place: "Lugar",
      country: "País",
      gender: "Sexo",
      zone: "Zona horaria",
      houses: "Casas",
      zodiac: "Zodíaco",
      ayanamsa: "Ayanamsa",
    },
    formNote: "Comprueba cada valor con el texto. No se envía nada hasta que abras el cielo o la carta.",
    placeNote:
      "AstroChart Bridge no busca lugares. Stellarium Web, la carta de Astro-Seek y Compartir usan la latitud y la longitud; el formulario de astro.com y Guardar en Astro-Seek… reciben la ciudad, para buscarla en sus propias listas.",
    noOffsetNote:
      "Si dejas vacía la diferencia con UTC, la carta solo se puede abrir en astro.com, que busca la zona horaria de la ciudad. Stellarium Web, Astro-Seek y Compartir necesitan la diferencia.",
    localOnlyNote:
      "No se escribió ninguna diferencia con UTC, así que esta carta solo se puede abrir en astro.com. Vuelve al formulario y escribe una para abrirla en Stellarium Web o Astro-Seek, o para compartirla.",
    offsetNote: "Nada comprueba que esta diferencia horaria estuviera en uso en el lugar de nacimiento en esa fecha.",
    programRefusals: {
      "no-coordinates": "no tiene coordenadas",
      "ambiguous-screenshot": "se puede leer como de más de un programa, o como más de una carta",
      "sidereal-mismatch": "su tiempo sidéreo no encaja con su hora, su diferencia horaria y su longitud",
      "offset-out-of-range": "su hora local está demasiado lejos de su Tiempo Universal",
      "weekday-mismatch": "su día de la semana no corresponde a su fecha",
      "zone-offset-mismatch": "su zona horaria no coincide con su diferencia con UTC",
      "calendar-unsupported":
        "tiene una fecha anterior al comienzo del calendario gregoriano, el 15 de octubre de 1582, o es Old Style o BC, y AstroChart Bridge solo lee fechas gregorianas",
      "apparent-time": "usa la hora aparente local, que AstroChart Bridge todavía no puede abrir",
      "local-time-ambiguous": "su hora está marcada como LC, que puede ser la hora media local o la hora aparente local",
      "chart-type-unsupported": "es una revolución, una progresión u otra carta que no es la natal",
      "offset-off-quarter-hour": "su tiempo sidéreo da una diferencia con UTC que no cae en un cuarto de hora",
      "true-local-time-mismatch": "su hora local verdadera no encaja con su tiempo sidéreo y su longitud",
    },
    programRefused: "no pasa las comprobaciones de ese programa",
    turnedDown: (why, code) =>
      `Este texto tiene el formato de un programa o sitio de astrología, pero ${why}, así que AstroChart Bridge no usó la lectura de ese programa (${code}). Comprueba cada valor con el texto.`,
    offsetUnchecked: (program) => `Nada en este texto de ${program} comprueba su diferencia con UTC. Compara la diferencia con el texto.`,
    readAs: (program) => `Leído como texto de ${program}: sus datos de nacimiento tienen el formato en que ${program} los muestra.`,
    westPlus: (program) => `${program} escribe con signo más las diferencias al oeste de Greenwich, así que su +7:00 es UTC-07:00 aquí.`,
    programNoOffset: (program) =>
      `${program} no muestra la diferencia con UTC. Escribe la del lugar de nacimiento en esa fecha, con el horario de verano incluido.`,
    asProgram: (value, program) => `${value} (como texto de ${program})`,
    readAsSource: (program) => `Leído como texto de ${program}.`,
    lineReadAs: (line, text, program) => `Línea ${line}: ${text}, leído como texto de ${program}.`,
    readsDifferently: (line, program) => `La línea ${line} se lee de otra manera que el formato de ${program}. Elige lo que quiere decir el texto.`,
    onLine: (value, line) => `${value} (línea ${line})`,
    zoneNoOffset: (zone) =>
      `El texto nombra la zona "${zone}" pero no da ninguna diferencia horaria. Escribe la del lugar de nacimiento en esa fecha.`,
    notInText: "No está en el texto pegado.",
    differentLines: (lines) => `El texto da valores distintos en las líneas ${and(lines.map(String))}.`,
    line: (line, text) => `Línea ${line}: ${text}`,
    eitherDate: (source) => `${source}. Podría ser cualquiera de las dos fechas.`,
    couldBe: (dates) => `Podría ser ${dates.join(" o ")}. Escribe el nombre del mes en inglés, o el año primero.`,
    cantRead: (example) => `AstroChart Bridge no puede leer esto. Prueba con ${example}.`,
    preGregorian: PRE_GREGORIAN,
    houses: (houses) => `El texto usa casas ${houses}, pero la carta de Astro-Seek se abrirá con casas Placidus.`,
    sidereal: "El texto usa el zodíaco sideral. AstroChart Bridge no lo transmite, así que configúralo en la carta de Astro-Seek.",
    or: (items) => items.join(" o "),
    atBirthplace: (time) => `${time} en el lugar de nacimiento`,
  },

  files: {
    oneChart: "1 carta en este archivo.",
    unnamed: "Carta sin nombre",
    birthplace: "Lugar de nacimiento",
    recordDate: (day, month, year) => `${day} ${MONTHS[month - 1]} ${year}`,
  },

  aaf: {
    refusals: {
      "no-birth-date": "Esta carta no tiene fecha de nacimiento: el archivo da *.",
      "no-birth-time": "Esta carta no tiene hora de nacimiento: el archivo da *. AstroChart Bridge no se inventa una.",
      "julian-calendar": "Esta fecha está en el calendario juliano, que AstroChart Bridge todavía no puede abrir.",
      "pre-gregorian-date": PRE_GREGORIAN,
      "no-coordinates": "Esta carta no tiene coordenadas, así que no hay cielo que abrir.",
      "local-mean-time": "Esta carta usa la hora media local, que AstroChart Bridge todavía no puede abrir.",
      "meridian-time": "Esta carta usa un meridiano especial, como la hora local de una capital, que AstroChart Bridge todavía no puede abrir.",
      "unknown-daylight-saving":
        "Esta carta no dice si regía el horario de verano: su tipo de hora es *. AstroChart Bridge no lo adivina.",
      "no-offset":
        "Esta carta no da ninguna diferencia con UTC, así que no se puede calcular su Tiempo Universal. AstroChart Bridge no se inventa una.",
      "offset-seconds": "La diferencia horaria de esta carta tiene segundos, y AstroChart Bridge todavía no puede abrirla.",
      "offset-out-of-range": "La diferencia horaria de esta carta, con el horario de verano incluido, está fuera del intervalo de -12:00 a +14:00.",
      "julian-day-mismatch":
        "El día juliano del archivo no coincide con su fecha, su hora y su diferencia horaria, así que AstroChart Bridge no puede saber cuál es correcto.",
    },
    unreadable: {
      "a93-fields": "la línea #A93, que necesita siete campos,",
      "b93-fields": "la línea #B93, que necesita cinco campos,",
      "bad-date": "la fecha",
      "bad-time": "la hora",
      "bad-julian-day": "el día juliano",
      "bad-latitude": "la latitud",
      "bad-longitude": "la longitud",
      "bad-offset": "la diferencia horaria",
      "bad-time-type": "el tipo de hora",
      "duplicate-b93": "una segunda línea #B93",
      "duplicate-znam": "una segunda línea #ZNAM",
      "bad-chunk": "la línea",
    },
    thisRecord: "este registro",
    couldntRead: (line, what, value) => `Línea ${line}: AstroChart Bridge no pudo leer ${what} "${value}".`,
    hourOnly: (time) => `El archivo AAF da esta hora de nacimiento solo en horas enteras, así que la carta se dibuja para ${clock(time)}.`,
    unreadableRecord: (line) => `Línea ${line}: registro ilegible`,
    noRecords: "AstroChart Bridge no encontró registros AAF. Cada registro empieza con una línea que comienza por #A93:.",
    charts: (count) => `${count} cartas en este archivo. Elige una.`,
    save: "Guardar como archivo AAF",
    utNotes: {
      chart:
        "El archivo AAF da esta carta en Tiempo Universal, porque la página no dice cómo se reparte su diferencia horaria entre la hora estándar y el horario de verano.",
      sky: "El archivo AAF da este momento en Tiempo Universal, porque Stellarium Web no muestra la zona horaria del lugar de nacimiento.",
    },
    dateUnknown: "fecha desconocida",
    timeUnknown: "hora desconocida",
    notUtf8: "Este archivo no está en UTF-8, así que AstroChart Bridge lo leyó como Windows-1252. Comprueba que las letras con acento de los nombres se vean bien.",
  },

  hor: {
    refusals: {
      "chart-type-unsupported":
        "Esta es una carta de Morinus de otro tipo, como una revolución solar o un tránsito. AstroChart Bridge solo abre cartas radicales y horarias.",
      "bce-date": "La fecha de esta carta es a. C., y AstroChart Bridge todavía no puede abrirla.",
      "julian-calendar": "Esta fecha está en el calendario juliano, que AstroChart Bridge todavía no puede abrir.",
      "pre-gregorian-date": PRE_GREGORIAN,
      "bad-date": "La fecha de esta carta no existe en el calendario, como un 30 de febrero.",
      "local-mean-time": "Esta carta está en hora media local, que AstroChart Bridge todavía no puede abrir.",
      "local-apparent-time": "Esta carta está en hora aparente local, la del reloj de sol, que AstroChart Bridge todavía no puede abrir.",
      "bad-coordinates": "Las coordenadas de esta carta pasan de 90° de latitud o de 180° de longitud.",
      "offset-out-of-range": "La diferencia horaria de esta carta, con el horario de verano incluido, está fuera del intervalo de -12:00 a +14:00.",
    },
    cantOpen: "AstroChart Bridge no puede abrir esta carta.",
    // field is fieldWords', which carry their own su or sus.
    unreadable: {
      "too-large": () => "Este archivo es mucho más grande que una carta de Morinus, así que AstroChart Bridge no lo leyó.",
      truncated: (field) => `Este archivo se detiene a mitad de ${field}, así que puede que esté cortado.`,
      "trailing-data": () => "Este archivo sigue después de la carta, algo que un archivo de carta de Morinus no hace, así que puede que no lo sea.",
      "unsupported-opcode": (field) =>
        `En ${field}, este archivo contiene algo que no es texto, un número ni un sí o un no, que es todo lo que contiene una carta de Morinus. AstroChart Bridge no lo leyó.`,
      malformed: (field) => `AstroChart Bridge no pudo leer este archivo en ${field}. Puede que no sea un archivo de carta de Morinus.`,
      "bad-text": (field) => `En ${field}, este archivo tiene un texto que no se puede leer. Puede que no sea un archivo de carta de Morinus.`,
      "field-type": (field) =>
        `En ${field}, este archivo tiene un tipo de valor que Morinus no guarda ahí, así que puede que no sea un archivo de carta de Morinus.`,
      "field-range": (field) =>
        `En ${field}, este archivo tiene un valor fuera de lo que Morinus permite, así que puede que no sea un archivo de carta de Morinus.`,
    },
    couldntReadFile: "AstroChart Bridge no pudo leer este archivo.",
    fieldWords: {
      name: "su nombre", male: "su sexo", htype: "su tipo de carta", bc: "su casilla a. C.", year: "su año", month: "su mes",
      day: "su día", hour: "su hora", minute: "su minuto", second: "su segundo", cal: "su calendario", zt: "su tipo de hora",
      plus: "su dirección de zona", zh: "sus horas de zona", zm: "sus minutos de zona", daylightsaving: "su casilla de horario de verano",
      place: "su lugar", deglon: "su longitud", minlon: "su longitud", seclon: "su longitud", east: "su longitud",
      deglat: "su latitud", minlat: "su latitud", seclat: "su latitud", north: "su latitud", altitude: "su altitud", notes: "sus notas",
    },
    warnings: {
      "text-encoding-guessed":
        "Este archivo lo guardó una versión antigua de Morinus, que no registra cómo escribió las letras con acento. Comprueba que el nombre y el lugar se vean bien.",
      "daylight-saving-on-ut":
        "Morinus tiene esta carta en hora de Greenwich con el horario de verano marcado, así que resta una hora a la hora escrita, y AstroChart Bridge también.",
      "longitude-seconds-ignored-by-morinus":
        "El archivo da la longitud al segundo, pero Morinus omite los segundos al abrir el archivo, así que su carta se dibuja hasta 59\" al este o al oeste de esta.",
    },
    zoneNote:
      "Morinus guarda la diferencia horaria escrita para una carta, no su zona horaria, así que aquí nada comprueba esa diferencia frente al lugar y la fecha de nacimiento.",
    utDownloadNote: "El archivo AAF da esta carta en Tiempo Universal, la hora que Morinus calcula a partir de la hora escrita.",
    unreadableLabel: "Archivo de Morinus ilegible",
    couldntReadMorinus: "AstroChart Bridge no pudo leer este archivo de Morinus.",
    enteredAs: "Escrita como",
    chartType: "Tipo de carta",
    horary: "Horaria",
    zone: (offset) => `zona ${offset}`,
    greenwich: "hora de Greenwich",
    withDaylightSaving: (basis) => `${basis}, con horario de verano`,
    recordDate: (day, month, year, bc, julian) => `${day} ${MONTHS[month - 1]} ${year}${bc ? " a. C." : ""}${julian ? " (juliano)" : ""}`,
  },

  towns: {
    away: (km) => (km < 1 ? "menos de 1 km" : `${Math.round(km)} km`),
  },

  // Plain strings with {name} slots, as en.js says. astro.com's and
  // Astro-Seek's own controls keep their English names here too: Gender, Male,
  // Add person, Birth city, automatic time zone, 00:00 GMT / UT, "4 h west".
  pageNotes: {
    astroCom: {
      useUt: "Usar Tiempo Universal",
      zoneUnreadable:
        "la zona horaria de astro.com aquí es \"{line}\", que no se puede comparar con la de esta carta, {zone}. Comprueba que la ciudad sea la correcta. Si lo es, puedes usar el Tiempo Universal de la carta.",
      zoneAtUt:
        "esta carta está en Tiempo Universal, pero la automatic time zone de astro.com para esta ciudad es {words}. Comprueba que la ciudad sea la correcta. Si lo es, usa el Tiempo Universal de la carta.",
      zoneOff:
        "esta carta está a {zone} del Tiempo Universal, pero la automatic time zone de astro.com para esta ciudad es {words}. Comprueba que la ciudad sea la correcta. Si lo es, usa el Tiempo Universal de la carta.",
      enteredUt:
        "AstroChart Bridge escribió {ut} con la zona horaria 00:00 GMT / UT. Es el Tiempo Universal de la propia carta, así que el momento es el de la carta, diga lo que diga el aviso de astro.com sobre las zonas horarias manuales.",
      gone: "la lista de astro.com ya no tiene \"{text}\". Elige la ciudad de su lista.",
      listAgain: "Volver a mostrar las coincidencias",
      chose: "eligió \"{text}\" de la lista de astro.com, a {away} de las coordenadas de la carta.",
      chooseAnother: "Elegir otra",
      ask: "más de una de las coincidencias de astro.com para \"{town}\" está a menos de {km} km de las coordenadas de la carta. ¿Cuál es la ciudad de la carta?",
      noneOfOne:
        "la única coincidencia de astro.com para \"{town}\" no está a menos de {km} km de las coordenadas de la carta. Elige la ciudad de la lista de astro.com, o escribe una más cercana.",
      noneOfMany:
        "ninguna de las {listed} coincidencias de astro.com para \"{town}\" está a menos de {km} km de las coordenadas de la carta. Elige la ciudad de la lista de astro.com, o escribe una más cercana.",
    },
    astroSeek: {
      genderStarts: "Comprueba Gender, que Astro-Seek empieza en Male, y después haz clic en Add person.",
      genderSet: "Gender es {gender}, según la carta. Compruébalo y después haz clic en Add person.",
      gone: "la lista de Astro-Seek ya no tiene \"{text}\". Elige la ciudad de su lista.",
      listAgain: "Volver a mostrar las coincidencias",
      chose: "eligió \"{text}\" de la lista de Astro-Seek, a {away} de las coordenadas de la carta. {genderNote}",
      chooseAnother: "Elegir otra",
      ask: "más de una de las coincidencias de Astro-Seek para \"{town}\" está a menos de {km} km de las coordenadas de la carta. ¿Cuál es la ciudad de la carta?",
      noneOfOne:
        "la única coincidencia de Astro-Seek para \"{town}\" no está a menos de {km} km de las coordenadas de la carta. Elige la ciudad de la lista de Astro-Seek, o escribe una más cercana.",
      noneOfMany:
        "ninguna de las {listed} coincidencias de Astro-Seek para \"{town}\" está a menos de {km} km de las coordenadas de la carta. Elige la ciudad de la lista de Astro-Seek, o escribe una más cercana.",
      noList: "Astro-Seek no mostró a tiempo sus coincidencias para \"{town}\". Elige la ciudad de su lista.",
      noTown:
        "la carta no nombra ninguna ciudad, y Astro-Seek solo guarda una carta con una Birth city elegida de su lista. Escribe la ciudad y elígela; las coordenadas y el UT/GMT de la carta se quedan como están. {genderNote}",
      placeBack:
        "AstroChart Bridge: Astro-Seek cambió la latitud, la longitud o la zona horaria, así que se han vuelto a poner las de la carta: {place}, UT/GMT sin horario de verano. Cámbialas tú aquí si es lo que quieres.",
    },
  },

  chart: {
    copyLink: "Copiar enlace",
    showQr: "Mostrar código QR",
    downloadFile: "Descargar archivo",
    shareLink: "Compartir enlace…",
    shareFile: "Compartir archivo…",
    shareNote: "Compartir enlace… y Compartir archivo… envían la carta a la aplicación que elijas.",
    includesLegend: "Incluir en el enlace, el código QR y el archivo",
    includesNote: "El nombre y la ciudad van en el enlace, el código QR y el archivo solo si están marcados, y cualquiera que los tenga puede leerlos.",
    remembersNote: "AstroChart Bridge recuerda lo que marcas, en este equipo.",
    from: "Origen",
    viaNames: { page: "página", screenshot: "captura de pantalla", paste: "texto pegado" },
    // "página de Astro-Seek", "texto pegado"
    origin: (site, via) => (site && via ? `${via} de ${site}` : site || via || ""),
    viaWarnings: {
      screenshot:
        "Esta carta se leyó de una captura de pantalla mediante OCR en el dispositivo que la compartió. Compara estas filas con la carta antes de abrirla: nada comprobó la latitud.",
      paste:
        "Esta carta se leyó de un texto pegado y se comprobó a mano en el dispositivo que la compartió. Nada comprobó su diferencia horaria con UTC frente al lugar y la fecha de nacimiento.",
    },
    refusals: {
      link: {
        malformed: "Este enlace está incompleto o dañado. Vuelve a copiar el enlace completo.",
        "too-large": "Este enlace es demasiado largo para ser una carta de AstroChart Bridge.",
        "not-astrochart": "Este enlace no contiene una carta de AstroChart Bridge.",
        "unsupported-version": NEWER,
        "unknown-field": NEWER,
        "unsupported-calendar": NEWER,
        "before-gregorian": BEFORE_GREGORIAN,
      },
      file: {
        malformed: "Este archivo no es una carta de AstroChart Bridge, o está dañado.",
        "too-large": "Este archivo es demasiado grande para ser una carta de AstroChart Bridge.",
        "not-astrochart": "Este archivo no es una carta de AstroChart Bridge.",
        "unsupported-version": NEWER_FILE,
        "unknown-field": NEWER_FILE,
        "unsupported-calendar": NEWER_FILE,
        "before-gregorian": BEFORE_GREGORIAN,
      },
    },
    damaged: {
      link: "La carta de este enlace no es válida. Vuelve a copiar el enlace completo.",
      file: "La carta de este archivo no es válida.",
    },
    empty: "Abre un enlace o un archivo de carta de AstroChart Bridge para ver aquí su carta.",
    otherFiles: {
      "morinus-file": "Este es un archivo de carta de Morinus (.hor), no una carta de AstroChart Bridge.",
      "aaf-file": "Este es un archivo AAF, no una carta de AstroChart Bridge.",
    },
    inExtension: "Se abre en la página de archivos AAF y de Morinus.",
    onTheWeb: "Lo abre la extensión AstroChart Bridge: haz clic en Abrir un archivo AAF o de Morinus en su ventana emergente.",
    openItThere: "Abrirlo allí",
    qrTooLong: (labelled) =>
      labelled
        ? `${QR_TOO_LONG} Desmarca el nombre o la ciudad para acortarlo, o usa Copiar enlace o Descargar archivo.`
        : `${QR_TOO_LONG} Usa Copiar enlace o Descargar archivo.`,
    qrLabel: "Código QR del enlace a esta carta",
    qrNote: "Escanéalo con la cámara de un teléfono o una tableta para abrir la carta en él. Cualquiera que pueda ver el código puede leer la carta.",
    shareTitle: "Carta de AstroChart Bridge",
  },

  helioscope: {
    decimal: ",",
    // For numbers written out whole, such as how many times brighter.
    locale: "es",
    planets: { mercury: "Mercurio", venus: "Venus", mars: "Marte", jupiter: "Júpiter", saturn: "Saturno" },
    conditions: { cazimi: "Cazimi", combust: "Combusto", "under-the-beams": "Bajo los rayos", clear: "Libre de los rayos" },
    sides: { evening: "vespertino", morning: "matutino" },
    moment: (condition, side) => `${condition} · ${side}`,
    eastOfSun: (degrees) => `${degrees}° al este del Sol`,
    westOfSun: (degrees) => `${degrees}° al oeste del Sol`,
    inConjunction: "En conjunción con el Sol",
    inOpposition: "En oposición al Sol",
    notWorkedOut: "No se pudo calcular",
    predictions: {
      detectable: "Visible",
      undetectable: "Demasiado tenue",
      "below-horizon": "Bajo el horizonte",
      indeterminate: "Sin predicción",
      unavailable: "No se pudo calcular",
    },
    windows: { evening: "anochecer", morning: "amanecer" },
    // "Al anochecer, a las 18:15: unas 4000 veces más brillante de lo necesario"
    visibleAt: (window, time, ratio) => `Al ${window}, ${at(time)}: unas ${ratio} veces más brillante de lo necesario`,
    tooFaintAt: (window, time, ratio) => `Su mejor momento, al ${window}, ${at(time)}: unas ${ratio} veces más tenue de lo necesario`,
    alsoVisible: (window) => ` · también visible al ${window}`,
    belowBoth: "Bajo el horizonte al anochecer y al amanecer",
    noWindow: {
      set: "El Sol no se pone ese día",
      rise: "El Sol no sale ese día",
      both: "El Sol no se pone ni sale ese día",
      other: "Esa noche no hay crepúsculo con el que juzgar",
    },
    // "18:15 del 10 ene"
    onDay: (time, day) => `${time} del ${day}`,
    dayMonth: (day, month) => `${day} ${MONTHS[month - 1]}`,
    labels: {
      evening: "Anochecer",
      morning: "Amanecer",
      best: { evening: "Mejor al anochecer", morning: "Mejor al amanecer" },
      longitudeGap: "Diferencia de longitud",
      elongation: "Elongación",
    },
    events: {
      sunset: "la puesta del Sol",
      "astronomical-dusk": "el final del crepúsculo astronómico",
      "lower-transit": "el punto más bajo del Sol",
      "astronomical-dawn": "el comienzo del crepúsculo astronómico",
      sunrise: "la salida del Sol",
    },
    // "Desde la puesta del Sol a las 16:49 hasta el final del crepúsculo astronómico a las 18:26"
    span: (start, startTime, end, endTime) => `Desde ${start} ${at(startTime)} hasta ${end} ${at(endTime)}`,
    above: (count, total) => `, sobre el horizonte en ${count} de ${total} muestras`,
    below: ", bajo el horizonte todo el tiempo",
    none: {
      "no-sunset": "Ninguna: el Sol no se pone ese día",
      "no-sunrise": "Ninguna: el Sol no sale ese día",
      other: "Ninguna: esa noche no hay crepúsculo",
    },
    failed: (code) => `No se pudo calcular: ${code}`,
    bestMoment: ({ time, margin, magnitude, limit, altitude, direction, sunDepth }) =>
      `${time}: magnitud ${magnitude} frente a una magnitud límite de ${limit}, un margen de ${margin}. A ${altitude}° de altura hacia el ${direction}, con el Sol ${sunDepth}° bajo el horizonte`,
    directions: ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"],
    timesAt: (offset) => `Las horas están en ${offset}, la diferencia horaria de la carta.`,
    // "Ver Venus a las 18:15 en Stellarium Web"
    seeInStellarium: "Ver en Stellarium Web",
    stellariumLabel: (planet, time) => `Ver ${planet} ${at(time)} en Stellarium Web`,
    linksNote:
      "Ver en Stellarium Web envía ese momento y el lugar de la carta a stellarium-web.org, cuya página pasa el enlace a las etiquetas publicitarias de Google. El reloj de Stellarium Web empieza a correr enseguida; su botón de pausa lo detiene.",
    methodMoment: (cazimi, combust, underTheBeams) =>
      `La condición tradicional, solo por la diferencia de longitud: cazimi a menos de ${cazimi}, combusto ${combust}, bajo los rayos ${underTheBeams}`,
    methodPrediction: "Si brillaba lo bastante para verse en los crepúsculos más cercanos al momento de la carta",
    how: {
      title: "Cómo se calcula",
      steps: [
        "El brillo se mide en magnitudes, que van al revés: cuanto menor el número, más brillante. Venus está en torno a −4, y las estrellas más tenues que muestra un cielo oscuro, en torno a 6. Cada paso de 1 es unas 2,5 veces en brillo.",
        "El crepúsculo oculta lo tenue. Cada 2 minutos, desde la puesta del Sol hasta el final del crepúsculo astronómico y desde su comienzo hasta la salida del Sol, Swiss Ephemeris calcula la magnitud más tenue que se podría ver donde estaba el planeta: la magnitud límite. Depende de la profundidad del Sol, la Luna, y el aire y el observador de Supuestos. Donde el Sol nunca baja 18° bajo el horizonte, los crepúsculos terminan o empiezan en su punto más bajo.",
        "Un planeta más brillante que el límite se puede ver. La tabla da su mejor momento y cuántas veces más brillante o más tenue de lo necesario era entonces; los detalles dan las magnitudes.",
        "La carta no recoge el tiempo ni la vista del observador. La bruma atenúa más a un planeta cuando está bajo en el cielo, así que incluso uno muchas veces más brillante de lo necesario pudo quedar oculto. Consultar el tiempo de esa noche da las nubes y el aire de ERA5.",
        "La predicción usa la posición real del planeta, con su latitud, y la condición solo la longitud, así que pueden no coincidir.",
      ],
      more: "El método y cómo se comprobó",
    },
    weather: {
      button: "Consultar el tiempo de esa noche",
      sends: "Envía el mes de la carta y su lugar, redondeado a unos 25 km, a open-meteo.com, cuyos registros pueden guardarlos hasta 90 días.",
      asking: "Consultando Open-Meteo…",
      title: "El tiempo de esa noche, según ERA5",
      // "Anochecer: 90 % de nubes a las 18:00 · Amanecer: sin nubes a las 07:00"
      twilights: { evening: "Anochecer", morning: "Amanecer" },
      twilight: (twilight, said) => `${twilight}: ${said}`,
      both: (evening, morning) => `${evening} · ${morning}`,
      cloudAt: (percent, time) => `${percent} % de nubes ${at(time)}`,
      clearAt: (time) => `sin nubes ${at(time)}`,
      reworked:
        "Los planetas de abajo se vuelven a calcular con el aire de esa noche. Las nubes de ERA5 son las de un cuadrado de unos 25 km de lado, y un planeta brillante puede verse a través de nubes altas y finas o de un claro.",
      credit: {
        data: "Datos meteorológicos de Open-Meteo.com",
        licence: "CC BY 4.0",
        source: (year) => `generados con información del Servicio de Cambio Climático de Copernicus ${year}`,
      },
      refusals: {
        "before-1940": "Los datos de ERA5 empiezan en 1940, así que no hay tiempo que consultar para esta carta.",
        future: "Esa noche aún no ha llegado, así que no hay tiempo que consultar.",
        "no-twilight": "Esa noche no hay crepúsculo, así que no hay tiempo que consultar.",
        "not-yet": "ERA5 aún no tiene esa noche: va unos 5 días por detrás.",
        declined: "Firefox no dio permiso para enviarlo, así que no se envió nada.",
      },
      failed: "No se pudo obtener el tiempo.",
      air: "Atmósfera esa noche",
      cloud: "Nubes esa noche",
      cloudValue: (low, mid, high) => `bajas ${low} %, medias ${mid} %, altas ${high} %`,
    },
    assumptions: {
      ephemeris: "Efemérides",
      ephemerisValue: (version) => `Swiss Ephemeris ${version}, Moshier`,
      atmosphere: "Atmósfera",
      atmosphereValue: (pressure, temperature, humidity) => `${pressure} hPa, ${temperature} °C, ${humidity} % de humedad`,
      observer: "Observador",
      observerValue: (age, snellen, bothEyes) =>
        `${age} años, razón de Snellen ${snellen}, ${bothEyes ? "con los dos ojos" : "con un ojo"}`,
      elevation: "Altitud",
      elevationGiven: (metres) => `${metres} m`,
      elevationDefault: (metres) => `${metres} m, porque no se indicó ninguna`,
      moon: "Luna",
      moonIncluded: "Se tiene en cuenta su luz",
      moonLeftOut: "No se tiene en cuenta su luz",
      samples: "Muestras",
      every: (minutes) => `Cada ${minutes} minutos`,
      limits: "Límites",
      limitsValue: (cazimi, combust, underTheBeams) => `Cazimi ${cazimi}, combusto ${combust}, bajo los rayos ${underTheBeams}`,
    },
    columns: { planet: "Planeta", moment: "En el momento de la carta", prediction: "Predicción en el crepúsculo cercano" },
    detailsHeading: "Detalles",
    detailsSummary: (planet, prediction) => `${planet}: ${prediction}`,
    assumptionsHeading: "Supuestos",
    empty: "Esta página calcula qué planetas eran visibles para una carta. Ábrela desde una carta en AstroChart Bridge.",
    refusals: {
      "date-out-of-range": "AstroChart Bridge calcula qué planetas eran visibles solo para fechas anteriores a 3000.",
      "invalid-coordinates": "El lugar de esta carta no es una latitud y una longitud del globo.",
      "invalid-elevation": ELEVATION_RANGE,
      "engine-failed": "Swiss Ephemeris no pudo iniciarse en este navegador, así que no se pueden calcular los planetas.",
      other: "No se pueden calcular los planetas para esta carta.",
    },
    elevationRefused: ELEVATION_RANGE,
  },
};
