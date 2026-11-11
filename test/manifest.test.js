import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { SIZES, iconPng } from "../tools/make-icons.mjs";

const extension = new URL("../extension/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", extension), "utf8"));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A PNG's width and height, from its IHDR chunk, which always comes first.
async function pngSize(path) {
  const bytes = await readFile(new URL(path, extension));
  assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, `${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("every icon the manifest lists is a square PNG of the size it is listed under", async () => {
  const icons = Object.entries(manifest.icons ?? {});
  assert.ok(icons.length > 0, "the manifest lists no icons");
  for (const [size, path] of icons) {
    assert.deepEqual(await pngSize(path), { width: Number(size), height: Number(size) }, path);
  }
});

// Safari's packager makes the iPad app's 1024-pixel icon from the largest one
// listed, scaling it up when it is smaller (seen with Xcode 26.1).
test("the largest icon is the 1024 pixels an iPad app icon needs", () => {
  assert.equal(Math.max(...Object.keys(manifest.icons ?? {}).map(Number)), 1024);
});

test("the icons are the ones tools/make-icons.mjs draws, at the sizes it draws", async () => {
  assert.deepEqual(Object.keys(manifest.icons).map(Number), SIZES);
  for (const size of SIZES) {
    const file = await readFile(new URL(manifest.icons[size], extension));
    assert.ok(pixels(iconPng(size)).equals(pixels(file)), `icon ${size}`);
  }
});

// The image data of a PNG with one IDAT chunk, uncompressed, so a different
// zlib in another Node version doesn't count as a different icon.
function pixels(png) {
  const at = png.indexOf("IDAT");
  return inflateSync(png.subarray(at + 4, at + 4 + png.readUInt32BE(at - 4)));
}

test("the browser minimums are the versions the manual checklist runs in", () => {
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
  assert.equal(manifest.browser_specific_settings.safari.strict_min_version, "26.0");
});

// AMO ties the listing, and every installed copy's updates, to this ID: a
// different one is a different add-on.
test("the Firefox add-on ID is the one AMO has", () => {
  assert.equal(manifest.browser_specific_settings.gecko.id, "astrochart-bridge@kevinblakelopez.github.io");
});

// Firefox shows this at install. The name and birth data go to astro.com's
// form, and birth data read from a page goes into Stellarium Web and
// Astro-Seek links, when the user asks. Location is optional: Helioscope's
// Check that night's weather asks for it from its click, before sending a
// chart's month and rounded place to Open-Meteo. Firefox 140 is the first
// with the consent screen, which is why it's the minimum. A change here
// changes what users agree to, so it should be deliberate and match
// docs/privacy.md.
test("the Firefox data collection declaration is the one the privacy page describes", () => {
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions, {
    required: ["personallyIdentifyingInfo", "websiteContent"],
    optional: ["locationInfo"],
  });
});

// The name and description come from _locales, one folder per language the
// interface has (extension/messages/), English by default.
const LANGUAGES = ["en", "es", "sl"];
const localized = Object.fromEntries(
  await Promise.all(
    LANGUAGES.map(async (code) => [code, JSON.parse(await readFile(new URL(`_locales/${code}/messages.json`, extension), "utf8"))]),
  ),
);

test("the name, description and toolbar title come from each language's messages, English by default", async () => {
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.name, "__MSG_extName__");
  assert.equal(manifest.description, "__MSG_extDescription__");
  assert.equal(manifest.action.default_title, "__MSG_extName__");
  const folders = (await readdir(new URL("_locales/", extension))).sort();
  assert.deepEqual(folders, [...LANGUAGES].sort());
  for (const code of LANGUAGES) {
    assert.deepEqual(Object.keys(localized[code]).sort(), ["extDescription", "extName"], code);
    assert.equal(localized[code].extName.message, "AstroChart Bridge", code);
  }
});

// The Chrome Web Store shows the description as the listing's summary, and
// allows it 132 characters at most, in each language.
test("the description fits the Chrome Web Store's summary", () => {
  for (const code of LANGUAGES) {
    const { message } = localized[code].extDescription;
    assert.ok(message.length <= 132, `${code}: ${message.length} characters`);
  }
});

// Both stores take up to four dot-separated whole numbers, and each upload
// needs one they haven't had. The popup shows it, so a loaded copy can be
// told from another. AMO's addons-linter refuses leading zeros and numbers
// over nine digits. Chromium loads both, but the Chrome Web Store's
// documentation allows each number 65535 at most, which covers Firefox's
// limit too.
test("the version is dot-separated whole numbers, as both stores take", () => {
  assert.match(manifest.version, /^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/);
  for (const part of manifest.version.split(".")) {
    assert.ok(Number(part) <= 65535, `${part} in ${manifest.version} is over 65535`);
  }
});
