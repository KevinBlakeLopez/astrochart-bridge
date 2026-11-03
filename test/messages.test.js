import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import en from "../extension/messages/en.js";
import es from "../extension/messages/es.js";
import { setLanguage } from "../extension/messages/index.js";
import { viewFor } from "../extension/popup-model.js";

const analyze = (name) => {
  const { url, input } = JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
  return analyzePage({ url, input });
};

// Runs check in a language, then goes back to English for the next test.
function inLanguage(code, check) {
  setLanguage([code]);
  try {
    check();
  } finally {
    setLanguage(["en"]);
  }
}

test("the first preferred language with a catalog is chosen, or else English", () => {
  inLanguage("en", () => {
    assert.equal(setLanguage(["es-MX", "en"]), "es");
    assert.equal(setLanguage(["fr-FR", "ES"]), "es");
    assert.equal(setLanguage(["en-GB", "es"]), "en");
    assert.equal(setLanguage(["fr"]), "en");
    assert.equal(setLanguage([]), "en");
  });
});

// What each message is, key by key: a string, a function of so many values,
// or a group of messages.
function shape(messages) {
  if (typeof messages === "string") return "string";
  if (typeof messages === "function") return `function of ${messages.length}`;
  if (Array.isArray(messages)) return messages.map(shape);
  return Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, shape(value)]));
}

test("the Spanish catalog has every English message, of the same kind", () => {
  assert.deepEqual(shape(es), shape(en));
});

test("the popup's refusals are in the chosen language", () => {
  inLanguage("es", () => {
    assert.deepEqual(viewFor(analyze("transit-sydney-2026-11-01")), {
      state: "refused",
      message: "Esta es una carta de tránsitos. AstroChart Bridge solo abre cartas natales.",
    });
    assert.deepEqual(viewFor({ kind: "refused", reason: "ambiguous-page" }), {
      state: "refused",
      message: "AstroChart Bridge no pudo leer la página de esta carta.",
      code: "ambiguous-page",
    });
  });
  assert.equal(viewFor(analyze("transit-sydney-2026-11-01")).message, "This is a transit chart. AstroChart Bridge opens natal charts only.");
});
