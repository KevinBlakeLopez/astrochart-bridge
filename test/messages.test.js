import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import en from "../extension/messages/en.js";
import es from "../extension/messages/es.js";
import { localizePage, messageAt, setLanguage } from "../extension/messages/index.js";
import sl from "../extension/messages/sl.js";
import { actionGroups, viewFor, viewForAstroCom } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";
import { readLink, viewForImport } from "../extension/chart-model.js";
import { toFragment, toPortable } from "../extension/core/portable.js";
import { checkField, formForText } from "../extension/paste-model.js";
import { viewForHorFile } from "../extension/hor-model.js";

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
    assert.equal(setLanguage(["sl-SI", "en"]), "sl");
    assert.equal(setLanguage(["hr", "sl"]), "sl");
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

test("the Slovenian catalog has every English message, of the same kind", () => {
  assert.deepEqual(shape(sl), shape(en));
});

// Each page's elements with data-text or data-label: the attribute, the
// message's path, and what the HTML itself says there, its text or its aria-label.
const PAGES = ["popup", "screenshot", "paste", "import", "chart", "helioscope"];
function marked(page) {
  const html = readFileSync(new URL(`../extension/${page}.html`, import.meta.url), "utf8");
  const marks = [
    ...[...html.matchAll(/<\w+[^>]*\bdata-text="([^"]+)"[^>]*>([^<]*)</g)].map(([, path, said]) => ({ path, said })),
    ...[...html.matchAll(/<\w+[^>]*\baria-label="([^"]+)"[^>]*\bdata-label="([^"]+)"/g)].map(([, said, path]) => ({ path, said })),
  ];
  // Every attribute was found, not only those these patterns fit.
  assert.equal(marks.length, html.match(/\bdata-(?:text|label)="/g)?.length ?? 0, `${page}'s marks`);
  return marks;
}

test("every page's data-text and data-label names a message in each catalog, and English says what the HTML does", () => {
  for (const page of PAGES) {
    const marks = marked(page);
    assert.ok(marks.length > 0, page);
    for (const { path, said } of marks) {
      inLanguage("en", () => assert.equal(messageAt(path), said, `${page}: ${path}`));
      inLanguage("es", () => assert.equal(typeof messageAt(path), "string", `${page}: ${path} in Spanish`));
      inLanguage("sl", () => assert.equal(typeof messageAt(path), "string", `${page}: ${path} in Slovenian`));
    }
  }
});

test("localizePage sets the page's lang and fills in its text and labels, leaving what has no message", () => {
  const element = (dataset) => ({ dataset, textContent: "English", label: null, setAttribute: function (name, value) { this.label = value; } });
  const heading = element({ text: "pages.paste.heading" });
  const missing = element({ text: "pages.paste.nothing" });
  const box = element({ label: "pages.paste.textLabel" });
  const document = { documentElement: {}, querySelectorAll: (selector) => (selector === "[data-text]" ? [heading, missing] : [box]) };
  try {
    localizePage(document, ["es-ES", "en"]);
    assert.equal(document.documentElement.lang, "es");
    assert.equal(heading.textContent, "Pegar el texto de una carta");
    assert.equal(box.label, "Texto de la carta");
    assert.equal(missing.textContent, "English");

    localizePage(document, ["sl-SI", "en"]);
    assert.equal(document.documentElement.lang, "sl");
    assert.equal(heading.textContent, "Prilepi besedilo horoskopa");
    assert.equal(box.label, "Besedilo horoskopa");
  } finally {
    setLanguage(["en"]);
  }
});

// The {name}s in a page note's template, sorted.
const slots = (template) => [...template.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();

test("the notes on astro.com's and Astro-Seek's pages travel as plain data, with the same slots in each language", () => {
  // What executeScript passes to a page: data only, so no functions.
  assert.deepEqual(JSON.parse(JSON.stringify(es.pageNotes)), es.pageNotes);
  assert.deepEqual(JSON.parse(JSON.stringify(en.pageNotes)), en.pageNotes);
  assert.deepEqual(JSON.parse(JSON.stringify(sl.pageNotes)), sl.pageNotes);
  for (const [site, notes] of Object.entries(en.pageNotes)) {
    for (const [key, template] of Object.entries(notes)) {
      assert.deepEqual(slots(es.pageNotes[site][key]), slots(template), `${site}.${key}`);
      assert.deepEqual(slots(sl.pageNotes[site][key]), slots(template), `${site}.${key} in Slovenian`);
    }
  }
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
  inLanguage("es", () => assert.deepEqual(labels().slice(-2), ["Lugar", "Ciudad"]));
});

test("the paste form speaks Spanish, but its boxes keep what the English-only reader reads back", () => {
  inLanguage("es", () => {
    const form = formForText("Date of Birth: 15 June 1985\nTime of Birth: 10:30\nLatitude: 47°36'N\nLongitude: 122°19'W\nUTC Offset: -07:00");
    assert.deepEqual(form.fields.map(({ label }) => label), ["Fecha", "Hora local", "Latitud", "Longitud", "Diferencia con UTC"]);
    for (const { name, text } of form.fields) assert.notEqual(checkField(name, text).value, null, `${name}: ${text}`);
    assert.equal(checkField("time", "10:30").message, "10:30 en el lugar de nacimiento");
    assert.equal(checkField("date", "1985-06-15").message, "15 de junio de 1985");
    assert.equal(
      checkField("date", "1500-06-15").message,
      "AstroChart Bridge abre fechas a partir del 15 de octubre de 1582, cuando comenzó el calendario gregoriano.",
    );
    // West is W in the box and under it: readField doesn't read O, and says so.
    assert.equal(checkField("lng", "-122.3321").message, "122°19'56\"W");
    assert.deepEqual(checkField("lng", "122°19'O"), {
      value: null,
      message: "AstroChart Bridge no puede leer esto. Prueba con -122.3321 o 122°19'W.",
    });
  });
});

test("a Morinus chart keeps its Entered as and Birthplace rows in Spanish", () => {
  const bytes = new Uint8Array(readFileSync(new URL("../fixtures/morinus/ny-est-plus-dst.p2.hor", import.meta.url)));
  inLanguage("es", () => {
    const list = viewForHorFile(bytes, { timeZone: "America/Los_Angeles" });
    assert.equal(list.message, "1 carta en este archivo.");
    assert.equal(list.items[0].label, "Test: 17 abr 2024, 08:00, New York");
    assert.deepEqual(list.items[0].view.rows, [
      ["Nombre", "Test"],
      ["Hora local", "17 abr 2024, 08:00"],
      ["Diferencia horaria", "UTC-04:00"],
      ["Escrita como", "zona UTC-05:00, con horario de verano"],
      ["UTC", "2024-04-17 12:00"],
      ["Lugar de nacimiento", "New York"],
      ["Lugar", "40°43'N, 74°0'O"],
    ]);
  });
});

test("a shared chart's town goes right after the place row, before the From row, in Spanish", () => {
  const shared = toPortable(
    { local: "2024-04-17T08:00:00", utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
    { site: "astro-seek", via: "page" },
    { name: "Ana", town: "New York" },
  );
  const view = () => viewForImport(readLink(`#${toFragment(shared.chart)}`), { timeZone: "UTC" });
  inLanguage("es", () => {
    assert.deepEqual(view().rows.map(([label]) => label), ["Nombre", "Hora local", "Diferencia horaria", "UTC", "Lugar", "Ciudad", "Origen"]);
    assert.deepEqual(view().rows.at(-1), ["Origen", "página de Astro-Seek"]);
    assert.deepEqual(view().includes.boxes.map(({ label }) => label), ["Nombre: Ana", "Ciudad: New York"]);
  });
});

test("a chart screen's rows and notes are in Slovenian", () => {
  inLanguage("sl", () => {
    const view = viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" });
    assert.deepEqual(view.rows, [
      ["Lokalni čas", "17. apr. 2024, 08:00 (EDT, DST)"],
      ["Zamik", "UTC-04:00"],
      ["UTC", "2024-04-17 12:00"],
      ["Kraj", "40°43'N, 74°0'W"],
    ]);
    assert.equal(
      view.notes[0],
      "Ura v Stellarium Web bo kazala 17. apr. ob 05:00, čas vašega računalnika, in bo tekla, dokler je ne ustavite. " +
        "V kraju rojstva je to 17. apr. ob 08:00.",
    );
    assert.deepEqual(actionGroups(view).map(({ label }) => label), ["Oglejte si nebo", "Odnesite horoskop drugam"]);
  });
});

// 1, 2, 3 or 4, and 5 or more each take their own form, and the hundreds
// repeat it: 101 like 1, 102 like 2, but 42 like 5.
test("Slovenian counts take the form for their number", () => {
  const minutes = [1, 2, 3, 4, 5, 30, 101, 102, 103].map((n) => sl.popup.keepsNote(n).match(/hrani (\d+ \S+),/)[1]);
  assert.deepEqual(minutes, [
    "1 minuto", "2 minuti", "3 minute", "4 minute", "5 minut", "30 minut", "101 minuto", "102 minuti", "103 minute",
  ]);
  const seconds = [1, 2, 3, 42, 59].map((n) => sl.popup.wholeMinutes(n).match(/izpusti (\d+ \S+)\.$/)[1]);
  assert.deepEqual(seconds, ["1 sekundo", "2 sekundi", "3 sekunde", "42 sekund", "59 sekund"]);
  // The verb agrees with the count too.
  assert.deepEqual([2, 3, 5, 102].map((n) => sl.aaf.charts(n)), [
    "V tej datoteki sta 2 horoskopa. Izberite enega.",
    "V tej datoteki so 3 horoskopi. Izberite enega.",
    "V tej datoteki je 5 horoskopov. Izberite enega.",
    "V tej datoteki sta 102 horoskopa. Izberite enega.",
  ]);
  assert.equal(sl.paste.tooLong(100_000), "To besedilo je predolgo. Prilepite samo del z rojstnimi podatki, do 100.000 znakov.");
  assert.match(sl.popup.nameWarning(40, "First name"), /^Polja za ime na astro\.com sprejmejo 40 znakov\. Tukaj skrajšajte First name,/);
});

test("Slovenian dates put a full stop after the day, and lists join with in", () => {
  assert.equal(sl.popup.shortDate(17, 4, 2024), "17. apr. 2024");
  assert.equal(sl.popup.longDate(17, 4, 2024), "17. april 2024");
  assert.equal(sl.popup.timeOnDay("05:00", 1, 5), "1. maj ob 05:00");
  assert.equal(sl.popup.and(["datum rojstva", "uro", "minuto"]), "datum rojstva, uro in minuto");
  assert.equal(sl.popup.and(["First name"]), "First name");
});

// Every message as a screen would show it, with "X" for each value, or ["X"]
// for a message that takes a list, such as and.
function texts(messages) {
  if (typeof messages === "string") return [messages];
  if (typeof messages === "function") {
    const withEach = (value) => messages(...Array(messages.length).fill(value));
    try {
      return [withEach("X")];
    } catch {
      return [withEach(["X"])];
    }
  }
  return Object.values(messages).flatMap(texts);
}

test("every message has a space after its punctuation", () => {
  for (const [code, messages] of Object.entries({ en, es, sl })) {
    for (const message of texts(messages)) {
      // Host names, "e.g.", ±HH:MM and "(.hor)" have their punctuation inside a
      // word, and Planetdance's "St:" can end a clause.
      const words = message.replace(/[\w-]+(?:\.[\w-]+)+/g, "").replace("HH:MM", "").replace(/\(\.\w+\)/g, "");
      assert.doesNotMatch(words, /[,.:;!?][^\s\d)»"'…,.;]/u, `${code}: ${message}`);
    }
  }
});

// A Slovenian S is sever, north, so S, J, V and Z would turn a southern
// latitude around for anyone who reads it the English way.
test("Slovenian coordinates keep N, S, E and W", () => {
  assert.deepEqual(sl.popup.compass, en.popup.compass);
});

test("the paste form speaks Slovenian, but its boxes keep what the English-only reader reads back", () => {
  inLanguage("sl", () => {
    const form = formForText("Date of Birth: 15 June 1985\nTime of Birth: 10:30\nLatitude: 47°36'N\nLongitude: 122°19'W\nUTC Offset: -07:00");
    assert.deepEqual(form.fields.map(({ label }) => label), ["Datum", "Lokalni čas", "Zemljepisna širina", "Zemljepisna dolžina", "Zamik od UTC"]);
    for (const { name, text } of form.fields) assert.notEqual(checkField(name, text).value, null, `${name}: ${text}`);
    assert.equal(checkField("time", "10:30").message, "10:30 v kraju rojstva");
    assert.equal(checkField("date", "1985-06-15").message, "15. junij 1985");
    assert.equal(
      checkField("date", "1500-06-15").message,
      "AstroChart Bridge odpira datume od 15. oktobra 1582 naprej, ko se je začel gregorijanski koledar.",
    );
    assert.equal(checkField("lng", "-122.3321").message, "122°19'56\"W");
    // V for vzhod, east, isn't read, and the form says so rather than misreading it.
    assert.deepEqual(checkField("lng", "14°30'V"), {
      value: null,
      message: "AstroChart Bridge tega ne zna prebrati. Poskusite na primer -122.3321 ali 122°19'W.",
    });
  });
});

test("a Morinus chart keeps its Entered as and Birthplace rows in Slovenian", () => {
  const bytes = new Uint8Array(readFileSync(new URL("../fixtures/morinus/ny-est-plus-dst.p2.hor", import.meta.url)));
  inLanguage("sl", () => {
    const list = viewForHorFile(bytes, { timeZone: "America/Los_Angeles" });
    assert.equal(list.message, "V tej datoteki je 1 horoskop.");
    assert.equal(list.items[0].label, "Test: 17. apr. 2024, 08:00, New York");
    assert.deepEqual(list.items[0].view.rows, [
      ["Ime", "Test"],
      ["Lokalni čas", "17. apr. 2024, 08:00"],
      ["Zamik", "UTC-04:00"],
      ["Vneseno kot", "pas UTC-05:00, s poletnim časom"],
      ["UTC", "2024-04-17 12:00"],
      ["Kraj rojstva", "New York"],
      ["Kraj", "40°43'N, 74°0'W"],
    ]);
  });
});

test("a shared chart's town goes right after the place row, before the From row, in Slovenian", () => {
  const shared = toPortable(
    { local: "2024-04-17T08:00:00", utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 },
    { site: "astro-seek", via: "page" },
    { name: "Ana", town: "New York" },
  );
  const view = () => viewForImport(readLink(`#${toFragment(shared.chart)}`), { timeZone: "UTC" });
  inLanguage("sl", () => {
    assert.deepEqual(view().rows.map(([label]) => label), ["Ime", "Lokalni čas", "Zamik", "UTC", "Kraj", "Mesto", "Vir"]);
    assert.deepEqual(view().rows.at(-1), ["Vir", "stran Astro-Seek"]);
    assert.deepEqual(view().includes.boxes.map(({ label }) => label), ["Ime: Ana", "Mesto: New York"]);
  });
});
