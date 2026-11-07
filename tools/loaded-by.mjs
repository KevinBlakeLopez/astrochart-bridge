// What an extension page loads, for the tests that check what ships: its
// scripts and stylesheets, then every module those scripts import, with
// import ... from, a bare import "...", or import(). A module can be the
// start instead of a page.
// Comments are dropped first, so a JSDoc type such as import("./core/index.js")
// isn't counted as a load. Only relative imports are followed: a bare one,
// such as "node:fs", is for Node, not a file in extension/.
import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const EXTENSION = new URL("../extension/", import.meta.url).pathname;
const read = (file) => readFileSync(join(EXTENSION, file), "utf8");

/**
 * @param {string} start  a page or a module, relative to extension/, such as "chart.html"
 * @param {{ skip?: string[] }} [options]  modules not to follow, relative to extension/
 * @returns {Set<string>} the start and every file it loads, relative to extension/
 */
export function loadedBy(start, { skip = [] } = {}) {
  const seen = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const file = normalize(queue.shift());
    if (seen.has(file) || skip.includes(file)) continue;
    seen.add(file);
    if (file.endsWith(".html")) {
      for (const [, src] of read(file).matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
        queue.push(join(dirname(file), src));
      }
      continue;
    }
    if (!/\.m?js$/.test(file)) continue;
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const imports = [
      ...code.matchAll(/\b(?:import|export)\b[^;"']*?\bfrom\s*["']([^"']+)["']/g),
      ...code.matchAll(/\bimport\s*["']([^"']+)["']/g),
      ...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
    ];
    for (const [, specifier] of imports) {
      if (specifier.startsWith(".")) queue.push(join(dirname(file), specifier));
    }
  }
  return seen;
}
