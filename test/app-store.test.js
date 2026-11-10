// The App Store's Safari build leaves Helioscope and Swiss Ephemeris out, and
// its Which planets were visible opens the web's copy of Helioscope's page
// instead (docs/safari-ipad.md). tools/package-app-store.sh packs it from a
// commit; its part that needs Xcode is in docs/safari-ipad.md.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { HELIOSCOPE_URL } from "../extension/helioscope-config.js";
import { helioscopeNotes } from "../extension/popup-model.js";
import { RECEIVER_URL } from "../extension/share-config.js";
import { pageUrl } from "../extension/web-page.js";
import { appStoreConfig, writeAppStoreConfig } from "../tools/app-store.mjs";
import { loadedBy } from "../tools/loaded-by.mjs";

const extension = new URL("../extension/", import.meta.url).pathname;
const read = (file) => readFileSync(join(extension, file), "utf8");
const listIn = (file) =>
  readFileSync(new URL(`../tools/${file}`, import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line !== "" && !line.startsWith("#"));
const STORE_LEFT_OUT = listIn("store-leave-out.txt");
const APP_STORE_LEFT_OUT = listIn("app-store-leave-out.txt");
const under = (paths) => (file) => paths.some((path) => file === path || file.startsWith(`${path}/`));
const leftOut = under([...STORE_LEFT_OUT, ...APP_STORE_LEFT_OUT]);
const appStoreOnly = under(APP_STORE_LEFT_OUT);

// Every file in extension/, relative to it.
function filesIn(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesIn(path) : [relative(extension, path)];
  });
}
const FILES = filesIn(extension);
// The pages the App Store's build keeps.
const KEPT_PAGES = FILES.filter((file) => file.endsWith(".html") && !leftOut(file));

// The web's copy of Helioscope's page, beside the receiving page.
const WEB_HELIOSCOPE = "https://kevinblakelopez.github.io/astrochart-bridge/helioscope.html";

test("the extension and the site open their own copy of Helioscope's page", () => {
  assert.equal(HELIOSCOPE_URL, null);
  assert.equal(pageUrl("helioscope.html", "chrome-extension://abcdefghijklmnop/popup.html"), "chrome-extension://abcdefghijklmnop/helioscope.html");
  assert.equal(pageUrl("helioscope.html", "safari-web-extension://5678/paste.html"), "safari-web-extension://5678/helioscope.html");
  assert.equal(pageUrl("helioscope.html", "https://kevinblakelopez.github.io/astrochart-bridge/import.html"), WEB_HELIOSCOPE);
});

test("a build that leaves Helioscope out opens the web's copy, and Share… still opens the receiving page beside the page", () => {
  assert.equal(pageUrl("helioscope.html", "safari-web-extension://5678/popup.html", WEB_HELIOSCOPE), WEB_HELIOSCOPE);
  assert.equal(pageUrl("helioscope.html", "safari-web-extension://5678/chart.html", WEB_HELIOSCOPE), WEB_HELIOSCOPE);
  assert.equal(pageUrl("chart.html", "safari-web-extension://5678/paste.html", WEB_HELIOSCOPE), "safari-web-extension://5678/chart.html");
});

test("the App Store's list names paths that exist, Swiss Ephemeris's whole folder among them", () => {
  for (const path of APP_STORE_LEFT_OUT) assert.ok(existsSync(join(extension, path)), path);
  assert.ok(APP_STORE_LEFT_OUT.includes("vendor/swisseph"));
  assert.ok(APP_STORE_LEFT_OUT.includes("helioscope.html"));
});

test("the App Store's build leaves out every file only Helioscope's page loads, and nothing a page it keeps loads", () => {
  assert.ok(KEPT_PAGES.length >= 5, KEPT_PAGES.join(", "));
  assert.ok(KEPT_PAGES.includes("popup.html") && KEPT_PAGES.includes("chart.html"), KEPT_PAGES.join(", "));
  const usedByKept = new Set(KEPT_PAGES.flatMap((page) => [...loadedBy(page)]));
  for (const file of loadedBy("helioscope.html")) {
    assert.ok(usedByKept.has(file) || appStoreOnly(file), `only Helioscope's page loads ${file}, which the build would keep unused`);
  }
  for (const page of KEPT_PAGES) {
    for (const file of loadedBy(page)) assert.equal(leftOut(file), false, `${page} loads ${file}, which the build leaves out`);
  }
});

test("every Which planets were visible opens Helioscope's page through pageUrl, never an address of its own", () => {
  const scripts = FILES.filter((file) => file.endsWith(".js") && !file.startsWith("vendor/") && !appStoreOnly(file));
  for (const file of scripts) assert.doesNotMatch(read(file), /getURL\(\s*"helioscope\.html"\s*\)/, file);
  // paste.js and screenshot.js open Share…'s and Helioscope's page from one table.
  for (const file of ["paste.js", "screenshot.js"]) assert.doesNotMatch(read(file), /getURL\(\s*page\s*\)/, file);
  // The popup's own getURL(page) opens its other ways to a chart, none of them Helioscope.
  const otherWayPages = [...read("popup-model.js").matchAll(/page: "([^"]+)"/g)].map(([, page]) => page);
  assert.deepEqual(otherWayPages.sort(), ["chart.html", "import.html", "paste.html", "screenshot.html"]);
  for (const file of ["popup.js", "paste.js", "screenshot.js", "import.js"]) {
    assert.match(read(file), /chrome\.tabs\.create\(\{ url: linkFor\(pageUrl\((page|"helioscope\.html"), location\.href\), shared\.chart\) \}\)/, file);
  }
  // On the web, and on the receiving page in either copy, openPage opens it.
  assert.match(read("web-page.js"), /window\.open\(linkFor\(pageUrl\(page, href\), chart\), "_blank", "noopener"\)/);
  assert.match(read("chart.js"), /openPage\("helioscope\.html", /);
});

test("the App Store's helioscope-config.js points Which planets were visible at the web's copy, beside the receiving page", async () => {
  assert.equal(new URL("helioscope.html", RECEIVER_URL).href, WEB_HELIOSCOPE);
  const dir = mkdtempSync(join(tmpdir(), "astrochart-app-store-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
    writeFileSync(join(dir, "helioscope-config.js"), appStoreConfig(RECEIVER_URL));
    const { HELIOSCOPE_URL: written } = await import(pathToFileURL(join(dir, "helioscope-config.js")).href);
    assert.equal(written, WEB_HELIOSCOPE);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeAppStoreConfig writes that file into a copy without Helioscope, and refuses one that still has it", async () => {
  const copy = mkdtempSync(join(tmpdir(), "astrochart-app-store-"));
  try {
    writeFileSync(join(copy, "package.json"), JSON.stringify({ type: "module" }));
    for (const file of ["share-config.js", "helioscope-config.js"]) copyFileSync(join(extension, file), join(copy, file));
    assert.equal(await writeAppStoreConfig(copy), WEB_HELIOSCOPE);
    assert.equal(readFileSync(join(copy, "helioscope-config.js"), "utf8"), appStoreConfig(RECEIVER_URL));
    // The extension's own file is untouched.
    assert.match(read("helioscope-config.js"), /^export const HELIOSCOPE_URL = null;$/m);

    writeFileSync(join(copy, "helioscope.html"), "");
    await assert.rejects(writeAppStoreConfig(copy), /still has helioscope\.html/);
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

// --- The note that says where Which planets were visible goes ---

test("the extension and the site say nothing more about Which planets were visible", () => {
  assert.deepEqual(helioscopeNotes(), []);
  assert.deepEqual(helioscopeNotes(null), []);
  assert.deepEqual(helioscopeNotes(WEB_HELIOSCOPE), [
    "Which planets were visible opens AstroChart Bridge's website, kevinblakelopez.github.io, which works out the planets in the browser. The chart goes after the # in the page's address, which the browser doesn't send to the website.",
  ]);
});

// The App Store's build as tools/package-app-store.sh makes it, less
// Tesseract's files, which no screen here needs: extension/ without what it
// leaves out, with the App Store's helioscope-config.js. Its own modules
// build its screens, so they read its own setting.
let appStore = null;
async function appStoreCopy() {
  if (appStore) return appStore;
  const dir = mkdtempSync(join(tmpdir(), "astrochart-app-store-copy-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
  for (const file of FILES.filter((file) => !leftOut(file) && !file.startsWith("vendor/tesseract/"))) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    copyFileSync(join(extension, file), join(dir, file));
  }
  await writeAppStoreConfig(dir);
  const load = (file) => import(pathToFileURL(join(dir, file)).href);
  appStore = { dir, load };
  return appStore;
}
after(() => appStore && rmSync(appStore.dir, { recursive: true, force: true }));

test("in the App Store's build, every screen with Which planets were visible says where it goes, right after the privacy note, and no other screen does", async () => {
  const { load } = await appStoreCopy();
  const { privacyNote, viewFor, viewForAstroCom, viewForSky } = await load("popup-model.js");
  const { analyzePage } = await load("core/index.js");
  const { viewForEntry } = await load("paste-model.js");
  const { viewForScreenshot } = await load("screenshot-model.js");
  const { viewForAafText } = await load("aaf-model.js");
  const { viewForHorFile } = await load("hor-model.js");
  const { viewForImport } = await load("chart-model.js");
  const { fromFragment, toFragment, toPortable } = await load("core/portable.js");
  const { text } = await load("messages/index.js");
  const note = text().popup.helioscopeOnTheWeb("kevinblakelopez.github.io");

  const LA = { timeZone: "America/Los_Angeles" };
  const SKY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
  const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
  const analyze = (name) => analyzePage(fixture(name));
  const page = { kind: "natal", site: "astro-seek", local: "2024-04-17T08:00:00", zoneLabel: "EDT, DST", lat: SKY.lat, lng: SKY.lng };
  const received = fromFragment(`#${toFragment(toPortable({ local: "2024-04-17T08:00:00", ...SKY }, { site: "astro-seek", via: "page" }).chart)}`);
  const hor = new Uint8Array(readFileSync(new URL("../fixtures/morinus/ny-est-plus-dst.p2.hor", import.meta.url)));

  const offered = {
    "an Astro-Seek page": viewFor(analyze("ny-2024-04-17"), { ...LA, town: "New York" }),
    "an astro.com page": viewFor({ ...page, site: "astro-com", zoneLabel: null, utc: SKY.utc, utcSource: "declared", offsetMinutes: -240 }, LA),
    "a page whose offset is to be entered": viewFor({ ...page, utc: null, utcSource: "needs-offset", reason: "no-printed-ut" }),
    "a page whose UTC is to be chosen": viewFor({
      ...page, local: "2021-03-14T02:30:00", zoneLabel: "EST", utc: null, utcSource: "needs-choice",
      candidates: [
        { basis: "printed UT", utc: "2021-03-14T06:30:00Z", offsetMinutes: -240 },
        { basis: "zone label", utc: "2021-03-14T07:30:00Z", offsetMinutes: -300 },
      ],
    }),
    "a screenshot": viewForScreenshot({ ...page, utc: SKY.utc, utcSource: "printed", offsetMinutes: -240 }, LA),
    "pasted text": viewForEntry({ date: "1985-06-15", time: "10:30:00", lat: 47.6062, lng: -122.3321, offsetMinutes: -420 }, LA),
    "an AAF chart": viewForAafText("#A93:Test,New York,*,17.4.2024,8:00,New York,NY (US)\n#B93:*,40n43,74w00,5hw00,1\n", LA).items[0].view,
    "a Morinus chart": viewForHorFile(hor, LA).items[0].view,
    "the receiving page": viewForImport(received, LA),
  };
  for (const [name, view] of Object.entries(offered)) {
    assert.ok(view.buttons.some(({ does }) => does === "helioscope"), `${name} offers Which planets were visible`);
    assert.equal(view.notes.filter((line) => line === note).length, 1, name);
    assert.equal(view.notes.indexOf(note), view.notes.indexOf(privacyNote()) + 1, name);
  }

  const notOffered = {
    "a Stellarium tab": viewForSky(SKY),
    "the astro.com step": viewForAstroCom(SKY),
  };
  for (const [name, view] of Object.entries(notOffered)) {
    assert.equal((view.buttons ?? []).some(({ does }) => does === "helioscope"), false, name);
    assert.equal((view.notes ?? []).includes(note), false, name);
  }
});
