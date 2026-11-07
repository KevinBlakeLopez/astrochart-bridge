import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { loadedBy } from "../tools/loaded-by.mjs";
import { buildSite, SITE_FILES } from "../tools/site.mjs";

const extension = new URL("../extension/", import.meta.url).pathname;
const read = (file) => readFileSync(join(extension, file), "utf8");

// Modules chart.js imports only in the extension's copy of the page, which
// the extension ships: astro.com's form is filled in from there, never on the
// web, and only there is the choice of a shared chart's name and town kept.
const EXTENSION_ONLY = ["astro-com-page.js", "preference.js"];

// Files a page doesn't load but must travel with what it loads.
const LICENSES = ["vendor/lean-qr/LICENSE"];

test("the site is exactly the files the receiving page loads, and the licence for what it vendors", () => {
  // Everything chart.html loads on the web, and so not its extension-only modules.
  const expected = [...loadedBy("chart.html", { skip: EXTENSION_ONLY }), ...LICENSES].sort();
  assert.deepEqual([...SITE_FILES].sort(), [...new Set(expected)].sort());
});

test("chart.js loads the code that fills in astro.com's form, and keeps the share choice, only in the extension's copy", () => {
  const code = read("chart.js");
  assert.match(code, /^if \(canFill\) import\("\.\/astro-com-page\.js"\)/m);
  assert.match(code, /^const canFill = canImport;$/m);
  assert.match(code, /^const remembered = canImport \? chrome\.storage\.local : null;$/m);
  assert.match(code, /^const preference = remembered && \(await import\("\.\/preference\.js"\)\);$/m);
  assert.match(code, /^const canImport = location\.protocol\.endsWith\("-extension:"\);$/m);
  for (const file of EXTENSION_ONLY) assert.equal(SITE_FILES.includes(file), false, file);
});

test("nothing of the extension's own pages is published", () => {
  for (const file of SITE_FILES) {
    assert.doesNotMatch(file, /^(popup\.(html|js)|screenshot|manifest\.json|vendor\/tesseract)/, file);
  }
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
