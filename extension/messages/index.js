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

/**
 * The message at a dotted path in the chosen catalog, such as "pages.paste.heading",
 * or undefined where there is none.
 *
 * @param {string} path
 */
export const messageAt = (path) => path.split(".").reduce((group, key) => (group && Object.hasOwn(group, key) ? group[key] : undefined), current);

/**
 * Chooses the language for a page and fills in its own text, before it draws
 * anything: the page's lang, each element's data-text as its text and each
 * data-label as its aria-label, both paths for messageAt. An element whose
 * message isn't a string keeps what the HTML says.
 *
 * @param {Document} document
 * @param {readonly string[]} languages  navigator.languages
 */
export function localizePage(document, languages) {
  document.documentElement.lang = setLanguage(languages);
  for (const element of document.querySelectorAll("[data-text]")) {
    const message = messageAt(element.dataset.text);
    if (typeof message === "string") element.textContent = message;
  }
  for (const element of document.querySelectorAll("[data-label]")) {
    const message = messageAt(element.dataset.label);
    if (typeof message === "string") element.setAttribute("aria-label", message);
  }
}
