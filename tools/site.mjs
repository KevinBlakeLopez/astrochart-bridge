// Builds the static site: the receiving page and the paste, import and
// screenshot pages, the files they load on the web, and the licences of what
// they vendor, copied unchanged from extension/. Nothing else from the
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
