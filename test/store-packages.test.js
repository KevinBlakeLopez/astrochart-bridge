import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { loadedBy } from "../tools/loaded-by.mjs";

// The paths tools/package-stores.sh leaves out of the zip the Chrome Web
// Store and Firefox Add-ons take. Helioscope's were, until its page arrived
// on 9 November 2026 (docs/HELIOSCOPE_V1_FEASIBILITY.md §9).
const LEFT_OUT = readFileSync(new URL("../tools/store-leave-out.txt", import.meta.url), "utf8")
  .split("\n")
  .filter((line) => line !== "" && !line.startsWith("#"));
const extension = new URL("../extension/", import.meta.url);
const PAGES = readdirSync(extension).filter((name) => name.endsWith(".html"));
const leftOut = (file) => LEFT_OUT.some((path) => file === path || file.startsWith(`${path}/`));

test("the store zips leave nothing out now that Helioscope's page uses it, and each path listed exists", () => {
  assert.deepEqual(LEFT_OUT, []);
  for (const path of LEFT_OUT) assert.ok(existsSync(new URL(path, extension)), path);
});

test("no page the extension ships loads anything the store zips leave out", () => {
  assert.ok(PAGES.length >= 5, PAGES.join(", "));
  for (const page of PAGES) {
    for (const file of loadedBy(page)) assert.equal(leftOut(file), false, `${page} loads ${file}`);
  }
});

// With nothing left out, everything Helioscope loads must be a page's.
test("everything Helioscope loads is left out of the store zips, unless a page loads it too", () => {
  const usedByPages = new Set(PAGES.flatMap((page) => [...loadedBy(page)]));
  for (const start of ["helioscope-engine.js", "core/helioscope.js"]) {
    for (const file of loadedBy(start)) {
      assert.ok(leftOut(file) || usedByPages.has(file), `${start} loads ${file}, which would ship unused`);
    }
  }
});
