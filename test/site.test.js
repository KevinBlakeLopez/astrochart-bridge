import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { loadedBy } from "../tools/loaded-by.mjs";
import { buildSite, SITE_FILES } from "../tools/site.mjs";

const extension = new URL("../extension/", import.meta.url).pathname;
const read = (file) => readFileSync(join(extension, file), "utf8");

// The pages published on the web: the receiving page, and the pages that read
// a pasted chart, a chart file and a screenshot.
const PAGES = ["chart.html", "paste.html", "import.html", "screenshot.html"];

// Modules the pages import only in the extension's copy, which the extension
// ships: astro.com's and Astro-Seek's forms are filled in, and Stellarium
// Desktop is sent to, from there, never on the web, and only there is the
// choice of a shared chart's name and town kept.
const EXTENSION_ONLY = ["astro-com-page.js", "desktop-page.js", "preference.js"];

// Files Tesseract.js loads by address while the screenshot page reads, which
// no import names (screenshot.js's createWorker).
const LOADED_BY_ADDRESS = [
  "vendor/tesseract/worker.min.js",
  "vendor/tesseract/tesseract-core-simd-lstm.wasm.js",
  "vendor/tesseract/eng.traineddata.gz",
];

// Files a page doesn't load but must travel with what it loads.
const LICENSES = ["vendor/lean-qr/LICENSE", "vendor/tesseract/LICENSE-tesseract.js.md", "vendor/tesseract/LICENSE-tesseract.js-core"];

test("the site is exactly the files the web's pages load, and the licences for what they vendor", () => {
  // Everything the pages load on the web, and so not their extension-only modules.
  const expected = [...PAGES.flatMap((page) => [...loadedBy(page, { skip: EXTENSION_ONLY })]), ...LOADED_BY_ADDRESS, ...LICENSES];
  assert.deepEqual([...SITE_FILES].sort(), [...new Set(expected)].sort());
});

test("the files Tesseract.js loads by address are the ones screenshot.js names", () => {
  const code = read("screenshot.js");
  for (const file of LOADED_BY_ADDRESS) {
    const name = file.slice("vendor/tesseract/".length).replace("eng.traineddata.gz", "eng");
    assert.ok(code.includes(name), file);
  }
  assert.match(code, /langPath: VENDOR,/);
  assert.match(code, /createWorker\("eng",/);
});

test("the paste, import and screenshot pages load the code that fills in forms and sends to Stellarium Desktop only in the extension's copy", () => {
  for (const page of ["paste.js", "import.js", "screenshot.js"]) {
    const code = read(page);
    assert.match(code, /^const onTheWeb = !isExtensionCopy\(location\.href\);$/m, page);
    assert.match(code, /^const extensionLinks = onTheWeb \? null : await import\("\.\/astro-com-page\.js"\);$/m, page);
    assert.match(code, /^const desktop = onTheWeb \? null : await import\("\.\/desktop-page\.js"\);$/m, page);
    // Nothing else names them, so nothing loads them on the web.
    assert.equal(code.match(/astro-com-page\.js|desktop-page\.js/g).length, 2, page);
  }
});

test("chart.js loads the code that fills in astro.com's form, and keeps the share choice, only in the extension's copy", () => {
  const code = read("chart.js");
  assert.match(code, /^if \(canFill\) import\("\.\/astro-com-page\.js"\)/m);
  assert.match(code, /^const canFill = canImport;$/m);
  assert.match(code, /^const remembered = canImport \? chrome\.storage\.local : null;$/m);
  assert.match(code, /^const preference = remembered && \(await import\("\.\/preference\.js"\)\);$/m);
  assert.match(code, /^const canImport = isExtensionCopy\(location\.href\);$/m);
  for (const file of EXTENSION_ONLY) assert.equal(SITE_FILES.includes(file), false, file);
});

// The screenshot, paste and import pages are published since they work on the
// web too, for a browser with no extension, such as Safari on an iPad. The popup,
// the manifest, and the code that opens tabs, asks for access to a site, fills
// in its form or reaches Stellarium Desktop are the extension's alone.
test("nothing only the extension can use is published", () => {
  for (const file of SITE_FILES) {
    assert.doesNotMatch(
      file,
      /^(popup\.(html|js)|manifest\.json|astro-com-(page|open)\.js|astro-seek-open\.js|desktop-(page|model)\.js|stellarium-desktop\.js|preference\.js)$/,
      file,
    );
  }
});

test("Tesseract.js's source maps, which nothing loads, aren't published", () => {
  for (const file of SITE_FILES) assert.doesNotMatch(file, /\.map$/, file);
});

// Publishing Helioscope with the receiving page would hand Swiss Ephemeris's
// WebAssembly to every visitor (docs/HELIOSCOPE_V1_FEASIBILITY.md §4).
test("neither Helioscope nor the Swiss Ephemeris it loads is published", () => {
  for (const file of SITE_FILES) assert.doesNotMatch(file, /helioscope|vendor\/swisseph/, file);
});

test("the receiving page's own files are in it", () => {
  for (const file of ["chart.html", "chart.js", "chart-model.js", "core/portable.js", "qr.js", "vendor/lean-qr/index.mjs"]) {
    assert.ok(SITE_FILES.includes(file), file);
  }
});

test("buildSite copies those files, unchanged, and nothing else", () => {
  const out = mkdtempSync(join(tmpdir(), "astrochart-bridge-site-"));
  try {
    buildSite(out);
    const written = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else written.push(relative(out, path));
      }
    };
    walk(out);
    assert.deepEqual(written.sort(), [...SITE_FILES].sort());
    for (const file of SITE_FILES) {
      assert.ok(readFileSync(join(out, file)).equals(readFileSync(join(extension, file))), file);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("buildSite refuses a folder that already has files in it", () => {
  const out = mkdtempSync(join(tmpdir(), "astrochart-bridge-site-"));
  try {
    buildSite(out);
    assert.throws(() => buildSite(out), /not empty/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
