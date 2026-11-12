import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { EPHEMERIS_FILES } from "../extension/parans-model.js";
import { loadedBy } from "../tools/loaded-by.mjs";
import { buildSite, SITE_FILES } from "../tools/site.mjs";

const extension = new URL("../extension/", import.meta.url).pathname;
const read = (file) => readFileSync(join(extension, file), "utf8");

// The pages published on the web: the home page, the receiving page, the pages
// that read a pasted chart, a chart file and a screenshot, Helioscope's page
// and the parans page.
const PAGES = ["index.html", "chart.html", "paste.html", "import.html", "screenshot.html", "helioscope.html", "parans.html"];

// Modules the pages import only in the extension's copy, which the extension
// ships: astro.com's and Astro-Seek's forms are filled in, and Stellarium
// Desktop is sent to, from there, never on the web, and only there is the
// choice of a shared chart's name and town kept.
const EXTENSION_ONLY = ["astro-com-page.js", "desktop-page.js", "preference.js"];

// Files Tesseract.js loads by address while the screenshot page reads, which
// no import names (screenshot.js's createWorker).
const TESSERACT_BY_ADDRESS = [
  "vendor/tesseract/worker.min.js",
  "vendor/tesseract/tesseract-core-simd-lstm.wasm.js",
  "vendor/tesseract/eng.traineddata.gz",
];

// The binary Swiss Ephemeris's glue fetches by address beside itself, which
// no import names either.
const SWISSEPH_BY_ADDRESS = ["vendor/swisseph/wasm/swisseph.wasm"];

// The asteroid files the parans page fetches by address for the dwarf planets.
const EPHEMERIS_BY_ADDRESS = EPHEMERIS_FILES.map((name) => `vendor/swisseph/ephe/${name}`);

// The icons the web app's manifest names, which the browser loads from it.
const MANIFEST_ICONS = JSON.parse(read("manifest.webmanifest")).icons.map(({ src }) => src);

// The service worker the home page registers by address (home.js).
const SERVICE_WORKER = ["sw.js"];

const LOADED_BY_ADDRESS = [...TESSERACT_BY_ADDRESS, ...SWISSEPH_BY_ADDRESS, ...EPHEMERIS_BY_ADDRESS, ...MANIFEST_ICONS, ...SERVICE_WORKER];

// Files a page doesn't load but must travel with what it loads. Swiss
// Ephemeris goes out under the AGPL, with swisseph-wasm's notice.
const LICENSES = [
  "vendor/lean-qr/LICENSE",
  "vendor/tesseract/LICENSE-tesseract.js.md",
  "vendor/tesseract/LICENSE-tesseract.js-core",
  "vendor/swisseph/LICENSE",
  "vendor/swisseph/NOTICE",
];

test("the site is exactly the files the web's pages load, and the licences for what they vendor", () => {
  // Everything the pages load on the web, and so not their extension-only modules.
  const expected = [...PAGES.flatMap((page) => [...loadedBy(page, { skip: EXTENSION_ONLY })]), ...LOADED_BY_ADDRESS, ...LICENSES];
  assert.deepEqual([...SITE_FILES].sort(), [...new Set(expected)].sort());
});

test("the files Tesseract.js loads by address are the ones screenshot.js names", () => {
  const code = read("screenshot.js");
  for (const file of TESSERACT_BY_ADDRESS) {
    const name = file.slice("vendor/tesseract/".length).replace("eng.traineddata.gz", "eng");
    assert.ok(code.includes(name), file);
  }
  assert.match(code, /langPath: VENDOR,/);
  assert.match(code, /createWorker\("eng",/);
});

test("the home page registers the service worker, by its name, on the web only, and no other page does", () => {
  const code = read("home.js");
  assert.match(code, /^if \(!isExtensionCopy\(location\.href\) && "serviceWorker" in navigator\) navigator\.serviceWorker\.register\("sw\.js"\)/m);
  assert.deepEqual(SERVICE_WORKER, ["sw.js"]);
  for (const file of SITE_FILES.filter((file) => /\.m?js$/.test(file) && file !== "home.js")) {
    assert.doesNotMatch(read(file), /serviceWorker\.register/, file);
  }
});

test("the binary Swiss Ephemeris's glue fetches by address is the one beside it", () => {
  const glue = read("vendor/swisseph/wasm/swisseph.mjs");
  assert.ok(glue.includes('new URL("swisseph.wasm",import.meta.url)'));
  assert.deepEqual(SWISSEPH_BY_ADDRESS, ["vendor/swisseph/wasm/swisseph.wasm"]);
});

test("the parans page fetches the dwarf planets' files by address beside it, each of them there", () => {
  const code = read("parans.js");
  assert.match(code, /fetch\(new URL\(`vendor\/swisseph\/ephe\/\$\{name\}`, import\.meta\.url\)\)/);
  assert.match(code, /EPHEMERIS_FILES\.map\(read\)/);
  for (const file of EPHEMERIS_BY_ADDRESS) assert.ok(existsSync(join(extension, file)), file);
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

// An installed web app has no back button, so each page but the home page has
// a way back to it, which only the web's copy shows (web-page.js's showHomeLink).
test("every published page but the home page links back to it, hidden until its script shows it on the web", () => {
  for (const page of PAGES.filter((page) => page !== "index.html")) {
    const html = read(page);
    assert.match(html, /<main>\n\s*<p id="home" class="home" hidden><a href="index\.html" data-text="pages\.popup\.title">AstroChart Bridge<\/a><\/p>\n/, page);
    const script = read(page.replace(".html", ".js"));
    assert.match(script, /^showHomeLink\(document, location\.href\);$/m, page);
  }
  for (const link of ["paste.html", "import.html", "screenshot.html", "chart.html"]) {
    assert.ok(read("index.html").includes(`<a href="${link}"`), link);
  }
});

test("Tesseract.js's and Swiss Ephemeris's source maps and type declarations, which nothing loads, aren't published", () => {
  for (const file of SITE_FILES) assert.doesNotMatch(file, /\.map$|\.d\.ts$/, file);
});

// Publishing Helioscope's page and the parans page hands Swiss Ephemeris's
// WebAssembly to every visitor, which the project's AGPL-3.0-or-later licence
// covers (docs/HELIOSCOPE_V1_FEASIBILITY.md §4, route A). The AGPL asks each
// page to say so, and to offer the source.
test("Swiss Ephemeris goes out with its licence and notice, and Helioscope's page and the parans page say so and link the source", () => {
  for (const file of ["vendor/swisseph/LICENSE", "vendor/swisseph/NOTICE"]) assert.ok(SITE_FILES.includes(file), file);
  for (const page of ["helioscope", "parans"]) {
    const html = read(`${page}.html`);
    assert.match(html, new RegExp(`data-text="pages\\.${page}\\.notice"`), page);
    assert.match(html, new RegExp(`<a href="https://github\\.com/KevinBlakeLopez/astrochart-bridge"[^>]*data-text="pages\\.${page}\\.source"`), page);
  }
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
