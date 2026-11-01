import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.deepEqual(manifest.browser_specific_settings, {
    gecko: { strict_min_version: "128.0" },
    safari: { strict_min_version: "26.0" },
  });
});
