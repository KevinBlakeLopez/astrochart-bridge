// Builds the receiving page's static site: the files chart.html loads, and
// the licence of what they vendor, copied unchanged from extension/. Nothing
// else from the extension is published. The Pages workflow runs it as
//
//   node tools/site.mjs _site
//
// test/site.test.js checks the list against what chart.html actually loads,
// so a new import can't be left out and an unused file can't be published.
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
  "share-config.js",
  "view.js",
  "popup-model.js",
  "pending.js",
  "qr.js",
  "core/portable.js",
  "core/astroseek.js",
  "core/astrocom.js",
  "core/stellarium.js",
  "core/civiltime.js",
  "vendor/lean-qr/index.mjs",
  "vendor/lean-qr/LICENSE",
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
