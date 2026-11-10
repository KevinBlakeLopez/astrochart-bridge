// Turns a copy of extension/ without Helioscope's files into the App Store's
// Safari build: it writes the copy's helioscope-config.js so that Which planets
// were visible opens the web's copy of Helioscope's page, beside the receiving
// page the copy's share-config.js names. tools/package-app-store.sh makes the
// copy from a commit and runs this on it as
//
//   node tools/app-store.mjs <copy>
//
// test/app-store.test.js covers it.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * helioscope-config.js for a build that leaves Helioscope out.
 *
 * @param {string} receiverUrl  share-config.js's RECEIVER_URL, the receiving page on the web
 * @returns {string} the file's text
 */
export function appStoreConfig(receiverUrl) {
  const url = new URL("helioscope.html", receiverUrl).href;
  return [
    "// Written by tools/app-store.mjs for the App Store's Safari build, which leaves",
    "// Helioscope and Swiss Ephemeris out: Which planets were visible opens the",
    "// web's copy of Helioscope's page.",
    `export const HELIOSCOPE_URL = ${JSON.stringify(url)};`,
    "",
  ].join("\n");
}

/**
 * Writes the App Store's helioscope-config.js into a copy of extension/. It
 * refuses a copy that still has Helioscope's page, or has no receiving page
 * on the web to put it beside.
 *
 * @param {string} copy  the copy's folder
 * @returns {Promise<string>} the address Which planets were visible opens
 */
export async function writeAppStoreConfig(copy) {
  if (existsSync(join(copy, "helioscope.html"))) throw new Error(`${copy} still has helioscope.html`);
  if (existsSync(join(copy, "vendor", "swisseph"))) throw new Error(`${copy} still has vendor/swisseph`);
  if (!existsSync(join(copy, "helioscope-config.js"))) throw new Error(`${copy} has no helioscope-config.js`);
  const { RECEIVER_URL } = await import(pathToFileURL(join(copy, "share-config.js")).href);
  if (typeof RECEIVER_URL !== "string") throw new Error(`${copy}'s share-config.js names no receiving page`);
  const text = appStoreConfig(RECEIVER_URL);
  writeFileSync(join(copy, "helioscope-config.js"), text);
  return new URL("helioscope.html", RECEIVER_URL).href;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [copy] = process.argv.slice(2);
  if (!copy) {
    console.error("usage: node tools/app-store.mjs <copy of extension/>");
    process.exit(1);
  }
  try {
    console.log(`Which planets were visible opens ${await writeAppStoreConfig(copy)}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
