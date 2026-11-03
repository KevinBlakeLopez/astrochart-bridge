// The interface's English text, by the module that shows it. Every other
// catalog has the same keys, which test/messages.test.js checks. A message
// with values in it is a function of them, so each language can place them
// where its grammar needs.
export default {
  view: {
    code: (code) => `Code: ${code}`,
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
  },
};
