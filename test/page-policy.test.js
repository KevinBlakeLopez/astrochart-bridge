// The pages published on the web set their own content security policy with
// a <meta> tag, since GitHub Pages sends no headers. The same files are the
// extension's pages, so each policy also allows what the extension's copy
// does: the paste, import and screenshot pages send to Stellarium Desktop,
// and Helioscope's page runs Swiss Ephemeris's WebAssembly and, when asked,
// gets that night's weather from Open-Meteo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARCHIVE_ORIGIN } from "../extension/core/open-meteo.js";
import { PORT } from "../extension/core/stellarium-desktop.js";

const read = (file) => readFileSync(new URL(`../extension/${file}`, import.meta.url), "utf8");
const STELLARIUM_DESKTOP = `http://127.0.0.1:${PORT}`;

// A page's head, up to its first stylesheet or script, which the policy must come before.
const headBeforeLoads = (html) => html.slice(0, html.search(/<(link|script)\b/));
const metaContent = (html, attribute, value) =>
  html.match(new RegExp(`<meta ${attribute}="${value}" content="([^"]*)">`))?.[1] ?? null;

// The policy as { directive: [sources] }.
function policyOf(page) {
  const content = metaContent(headBeforeLoads(read(page)), "http-equiv", "Content-Security-Policy");
  assert.ok(content, `${page} sets its policy before it loads anything`);
  return Object.fromEntries(
    content.split(";").map((part) => part.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...sources]) => [name, sources]),
  );
}

// Every page the site publishes (tools/site.mjs).
const PUBLISHED = ["index.html", "chart.html", "paste.html", "import.html", "screenshot.html", "helioscope.html"];

// Every page may load its own web app manifest (manifest.webmanifest), and its
// own images: the browser loads the Home Screen icon the page links as one.
const STRICT = { "default-src": ["'none'"], "style-src": ["'self'"], "img-src": ["'self'"], "manifest-src": ["'self'"], "base-uri": ["'none'"], "form-action": ["'none'"] };

test("every published page fits an iPad's screen and sends no referrer", () => {
  for (const page of PUBLISHED) {
    const html = read(page);
    assert.equal(metaContent(html, "name", "viewport"), "width=device-width, initial-scale=1", page);
    assert.equal(metaContent(html, "name", "referrer"), "no-referrer", page);
  }
});

test("the receiving page runs only its own scripts, and reaches nothing", () => {
  assert.deepEqual(policyOf("chart.html"), { ...STRICT, "script-src": ["'self'"] });
});

test("the home page also starts the site's own service worker", () => {
  assert.deepEqual(policyOf("index.html"), { ...STRICT, "script-src": ["'self'"], "worker-src": ["'self'"] });
});

test("the paste and import pages run only their own scripts, and reach only Stellarium Desktop", () => {
  for (const page of ["paste.html", "import.html"]) {
    assert.deepEqual(policyOf(page), { ...STRICT, "script-src": ["'self'"], "connect-src": [STELLARIUM_DESKTOP] }, page);
  }
});

test("the screenshot page also lets Tesseract.js start its worker, compile its WebAssembly and load its language data", () => {
  // The worker may take the page's policy, as the extension's does, so the
  // page allows what the worker does: WebAssembly, and fetching from the site.
  assert.deepEqual(policyOf("screenshot.html"), {
    ...STRICT,
    "script-src": ["'self'", "'wasm-unsafe-eval'"],
    "worker-src": ["'self'"],
    "connect-src": ["'self'", STELLARIUM_DESKTOP],
  });
});

test("Helioscope's page also lets Swiss Ephemeris compile its WebAssembly and fetch it from beside the glue, and reaches Open-Meteo's archive", () => {
  // No Stellarium Desktop: the page opens Stellarium Web by its links only.
  // Open-Meteo's archive is for Check that night's weather, on its click,
  // and nothing else of Open-Meteo's.
  assert.deepEqual(policyOf("helioscope.html"), {
    ...STRICT,
    "script-src": ["'self'", "'wasm-unsafe-eval'"],
    "connect-src": ["'self'", ARCHIVE_ORIGIN],
  });
});

test("no page allows inline scripts, eval, scripts from elsewhere, or a whole scheme", () => {
  for (const page of PUBLISHED) {
    const policy = policyOf(page);
    assert.deepEqual(policy["script-src"].filter((source) => !["'self'", "'wasm-unsafe-eval'"].includes(source)), [], page);
    for (const [directive, sources] of Object.entries(policy)) {
      for (const source of sources) {
        assert.doesNotMatch(source, /^'unsafe-(inline|eval|hashes)'$|^\*$|^(https?|data|blob):$/, `${page} ${directive}`);
      }
    }
  }
});
