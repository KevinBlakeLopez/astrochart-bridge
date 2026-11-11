// Builds the static site: the receiving page, the paste, import and
// screenshot pages, Helioscope's page, the files they load on the web, and the
// licences of what they vendor, copied unchanged from extension/. Nothing else from the
// extension is published. The Pages workflow runs it as
//
//   node tools/site.mjs _site
//
// test/site.test.js checks the list against what the pages actually load, so
// a new import can't be left out and an unused file can't be published.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSION = fileURLToPath(new URL("../extension/", import.meta.url));

export const SITE_FILES = Object.freeze([
  // The home page, where the installed web app opens. Only the web has it.
  "index.html",
  "home.css",
  "home.js",
  // The service worker the home page registers, which keeps the site's files
  // for offline use.
  "sw.js",
  // The web app's manifest, which every page links, the Home Screen icon they
  // link, and the icons the manifest names.
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "chart.html",
  "popup.css",
  "chart.css",
  "chart.js",
  "chart-model.js",
  "extension-copy.js",
  "share-config.js",
  "view.js",
  "popup-model.js",
  "pending.js",
  "messages/index.js",
  "messages/en.js",
  "messages/es.js",
  "messages/sl.js",
  "qr.js",
  "core/portable.js",
  "core/astroseek.js",
  "core/astrocom.js",
  "core/towns.js",
  "core/places.js",
  "core/names.js",
  "core/stellarium.js",
  "core/civiltime.js",
  "vendor/lean-qr/index.mjs",
  "vendor/lean-qr/LICENSE",
  // The paste, import and screenshot pages, and what they share.
  "web-page.js",
  // The web app's offline copy and what is shared to it, which every page uses.
  "web-app.js",
  "paste.html",
  "paste.css",
  "paste.js",
  "paste-model.js",
  "core/text.js",
  "import.html",
  "import.css",
  "import.js",
  "aaf-model.js",
  "hor-model.js",
  "core/aaf.js",
  "core/morinus-hor.js",
  "screenshot.html",
  "screenshot.css",
  "screenshot.js",
  "screenshot-model.js",
  // What reads a screenshot, and the text pasted from a program.
  "core/index.js",
  "core/chart-image.js",
  "core/printed-chart.js",
  "core/sidereal.js",
  "core/astrogold.js",
  "core/astrolog.js",
  "core/esotech.js",
  "core/janus.js",
  "core/jhora.js",
  "core/kepler.js",
  "core/morinus.js",
  "core/pickle.js",
  "core/planetdance.js",
  "core/timepassages.js",
  "core/winstar.js",
  // Tesseract.js, and the files it loads by address while it reads.
  "vendor/tesseract/tesseract.esm.min.js",
  "vendor/tesseract/worker.min.js",
  "vendor/tesseract/tesseract-core-simd-lstm.wasm.js",
  "vendor/tesseract/eng.traineddata.gz",
  "vendor/tesseract/LICENSE-tesseract.js.md",
  "vendor/tesseract/LICENSE-tesseract.js-core",
  // Helioscope's page, which works out which planets were visible.
  "helioscope.html",
  "helioscope.css",
  "helioscope.js",
  "helioscope-engine.js",
  "helioscope-model.js",
  "helioscope-view.js",
  "core/helioscope.js",
  // Where the page keeps its settings on the web, the site's localStorage.
  "web-storage.js",
  // Check that night's weather: the request to Open-Meteo, which the page
  // sends only on its click, and reading the answer.
  "core/open-meteo.js",
  // Only its Julian Day arithmetic: the requests to Stellarium Desktop are
  // sent by stellarium-desktop.js, which isn't published.
  "core/stellarium-desktop.js",
  // Swiss Ephemeris, compiled to WebAssembly by swisseph-wasm: the modules
  // its index.js imports, the binary its glue fetches by address, and the
  // AGPL and notice they're distributed under.
  "vendor/swisseph/dist/index.js",
  "vendor/swisseph/dist/instance.js",
  "vendor/swisseph/dist/constants.js",
  "vendor/swisseph/dist/types.js",
  "vendor/swisseph/dist/derived/antiscia.js",
  "vendor/swisseph/dist/derived/aspects.js",
  "vendor/swisseph/dist/derived/declination.js",
  "vendor/swisseph/dist/derived/dignities.js",
  "vendor/swisseph/dist/derived/eclipses.js",
  "vendor/swisseph/dist/derived/heliacal.js",
  "vendor/swisseph/dist/derived/houses.js",
  "vendor/swisseph/dist/derived/lot-names-tr.js",
  "vendor/swisseph/dist/derived/lots.js",
  "vendor/swisseph/dist/derived/parans.js",
  "vendor/swisseph/dist/derived/sect.js",
  "vendor/swisseph/dist/derived/stars.js",
  "vendor/swisseph/dist/derived/timelords.js",
  "vendor/swisseph/dist/ephemeris/asteroids.js",
  "vendor/swisseph/dist/ephemeris/files.js",
  "vendor/swisseph/dist/ephemeris/sources.js",
  "vendor/swisseph/dist/generated/constants.js",
  "vendor/swisseph/dist/generated/stars.js",
  "vendor/swisseph/wasm/swisseph.mjs",
  "vendor/swisseph/wasm/swisseph.wasm",
  "vendor/swisseph/LICENSE",
  "vendor/swisseph/NOTICE",
]);

/**
 * Copies the site's files into a folder, which must be empty or not exist yet,
 * so nothing left over from an earlier build is published.
 *
 * @param {string} out
 */
export function buildSite(out) {
  mkdirSync(out, { recursive: true });
  if (readdirSync(out).length > 0) throw new Error(`${out} is not empty`);
  for (const file of SITE_FILES) {
    mkdirSync(dirname(join(out, file)), { recursive: true });
    copyFileSync(join(EXTENSION, file), join(out, file));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [out] = process.argv.slice(2);
  if (!out) {
    console.error("usage: node tools/site.mjs <folder>");
    process.exit(1);
  }
  buildSite(out);
  console.log(`${SITE_FILES.length} files in ${out}`);
}
