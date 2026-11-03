import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import en from "../extension/messages/en.js";
import es from "../extension/messages/es.js";
import { setLanguage } from "../extension/messages/index.js";
import { actionGroups, viewFor, viewForAstroCom } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

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

test("a chart screen's rows and notes are in the chosen language", () => {
  inLanguage("es", () => {
    const view = viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" });
    assert.deepEqual(view.rows, [
      ["Hora local", "17 abr 2024, 08:00 (EDT, DST)"],
      ["Diferencia horaria", "UTC-04:00"],
      ["UTC", "2024-04-17 12:00"],
      ["Lugar", "40°43'N, 74°0'O"],
    ]);
    assert.equal(
      view.notes[0],
      "El reloj de Stellarium Web marcará el 17 abr a las 05:00, la hora de tu equipo, y avanzará hasta que lo pauses. " +
        "En el lugar de nacimiento es el 17 abr a las 08:00.",
    );
    assert.deepEqual(actionGroups(view).map(({ label }) => label), ["Ver el cielo", "Llevar la carta a otro sitio"]);
  });
});

test("Spanish says la una, and joins a list with e before an i sound", () => {
  assert.equal(es.popup.timeOnDay("01:30", 17, 4), "el 17 abr a la 01:30");
  assert.equal(es.popup.timeOnDay("13:00", 17, 4), "el 17 abr a las 13:00");
  assert.equal(es.popup.and(["la hora", "el minuto", "el nombre"]), "la hora, el minuto y el nombre");
  assert.equal(es.popup.and(["padre", "hija"]), "padre e hija");
  assert.equal(es.popup.and(["agua", "hielo"]), "agua y hielo");
  assert.equal(es.popup.and(["First name"]), "First name");
});

test("astro.com's own fields and options keep the names its English form prints", () => {
  inLanguage("es", () => {
    const view = viewForAstroCom({ utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 }, { local: "2024-04-17T08:00:00", town: "New York" });
    assert.deepEqual(view.rows, [
      ["Birthday", "17 de abril de 2024"],
      ["Hour, min", "08:00"],
      ["Time zone", "automatic time zone, la opción predeterminada del formulario"],
      ["Diferencia horaria", "UTC-04:00"],
      ["Lugar", "40°43'N, 74°0'O"],
      ["Town", "New York"],
    ]);
    assert.deepEqual(view.nameBoxes.map(({ label }) => label), ["First name", "Last name"]);
  });
});

test("a screenshot's town still goes right after the place row in Spanish", () => {
  const result = {
    kind: "natal", site: "astro-seek", local: "2024-04-17T08:00:00", zoneLabel: null, lat: 40.716667, lng: -74,
    utc: "2024-04-17T12:00:00Z", utcSource: "printed", offsetMinutes: -240, town: "New York",
  };
  const labels = () => viewForScreenshot(result, { timeZone: "UTC" }).rows.map(([label]) => label);
  assert.deepEqual(labels().slice(-2), ["Place", "Town"]);
  inLanguage("es", () => assert.deepEqual(labels().slice(-2), ["Lugar", "Town"]));
});
