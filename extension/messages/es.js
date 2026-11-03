// The interface's Spanish text, with en.js's keys. It speaks to the reader as
// tú. Names of sites, programs and their buttons stay as those sites print them.
export default {
  view: {
    code: (code) => `Código: ${code}`,
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
  },
};
