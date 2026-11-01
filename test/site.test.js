import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize, relative } from "node:path";
import { buildSite, SITE_FILES } from "../tools/site.mjs";

const extension = new URL("../extension/", import.meta.url).pathname;
const read = (file) => readFileSync(join(extension, file), "utf8");

// Every file import.html loads: its scripts and stylesheets, then every
// module those scripts import. Comments are dropped first, so a JSDoc
// type such as import("./core/index.js") isn't counted as a load.
function loadedBy(page) {
  const seen = new Set();
  const queue = [...read(page).matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  while (queue.length > 0) {
    const file = normalize(queue.shift());
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.m?js$/.test(file)) continue;
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const [, from] of code.matchAll(/\b(?:import|export)\b[^;"']*?\bfrom\s*["']([^"']+)["']/g)) {
      queue.push(join(dirname(file), from));
    }
    for (const [, imported] of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
      queue.push(join(dirname(file), imported));
    }
  }
  return seen;
}

// Files a page doesn't load but must travel with what it loads.
const LICENSES = ["vendor/lean-qr/LICENSE"];

test("the site is exactly the files the receiving page loads, and the licence for what it vendors", () => {
  const expected = [...loadedBy("import.html"), "import.html", ...LICENSES].sort();
  assert.deepEqual([...SITE_FILES].sort(), [...new Set(expected)].sort());
});

test("nothing of the extension's own pages is published", () => {
  for (const file of SITE_FILES) {
    assert.doesNotMatch(file, /^(popup\.(html|js)|screenshot|manifest\.json|vendor\/tesseract)/, file);
  }
});

test("the receiving page's own files are in it", () => {
  for (const file of ["import.html", "import.js", "import-model.js", "core/portable.js", "qr.js", "vendor/lean-qr/index.mjs"]) {
    assert.ok(SITE_FILES.includes(file), file);
  }
});

test("buildSite copies those files, unchanged, and nothing else", () => {
  const out = mkdtempSync(join(tmpdir(), "chart-bridge-site-"));
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
  const out = mkdtempSync(join(tmpdir(), "chart-bridge-site-"));
  try {
    buildSite(out);
    assert.throws(() => buildSite(out), /not empty/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
