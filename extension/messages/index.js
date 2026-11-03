// The interface's language. Each page chooses it once, before drawing
// anything, from the browser's preferred languages; the models read its
// messages while they build a screen. English is the default, so a page or
// test that never chooses gets English.
import en from "./en.js";
import es from "./es.js";
import sl from "./sl.js";

// The catalogs, by primary language subtag.
const CATALOGS = { en, es, sl };

let current = en;

/**
 * Chooses the catalog for the first of the browser's preferred languages that
 * has one, or English. Tests call it to check another language and set it back.
 *
 * @param {readonly string[]} languages  navigator.languages, such as ["es-MX", "es", "en"]
 * @returns {string}  the chosen language's code, for the page's lang attribute
 */
export function setLanguage(languages) {
  const code = languages.map((tag) => tag.split("-")[0].toLowerCase()).find((code) => Object.hasOwn(CATALOGS, code)) ?? "en";
  current = CATALOGS[code];
  return code;
}

/**
 * The chosen language's messages. Read it while building a screen, not when a
 * module loads, or the screen keeps the language chosen before it.
 */
export const text = () => current;
