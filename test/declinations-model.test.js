// The declinations page's model, declinations-model.js: its orbs and
// settings, and the screen drawn from the contacts. The real-chart cases run
// the real engine with the dwarf planets' files, so every string below is
// what the page shows for that chart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ANGLES, DWARF_PLANETS, PLANETS } from "../extension/core/declinations.js";
import { createEngine } from "../extension/helioscope-engine.js";
import { setLanguage } from "../extension/messages/index.js";
import {
  DEFAULT_SETTINGS,
  EPHEMERIS_FILES,
  ORBS,
  chartFromLink,
  declinationsFor,
  declinationsSettings,
  orbLabel,
  setDeclinationsSettings,
  viewForDeclinations,
  viewForFailure,
  viewForRefusal,
} from "../extension/declinations-model.js";
import { EPHEMERIS_FILES as PARANS_FILES, chartFromLink as paransChartFromLink } from "../extension/parans-model.js";

// Charts as the receiving page has them, with their local times for the chart's rows.
const chartAt = (local, utc, lat, lng, offsetMinutes) => ({
  kind: "natal", site: null, local, zoneLabel: null, lat, lng, utc, utcSource: "declared", offsetMinutes,
});
const LONDON = chartAt("2024-04-10T15:30:00", "2024-04-10T14:30:00Z", 51.5074, -0.1278, 60);
const SYDNEY = chartAt("1987-12-05T14:20:00", "1987-12-05T03:20:00Z", -33.8688, 151.2093, 660);
const TROMSO = chartAt("2024-06-21T14:00:00", "2024-06-21T12:00:00Z", 69.6492, 18.9553, 120);

async function withFiles(t) {
  const files = Object.fromEntries(EPHEMERIS_FILES.map((name) => [
    name,
    new Uint8Array(readFileSync(new URL(`../extension/vendor/swisseph/ephe/${name}`, import.meta.url))),
  ]));
  const engine = await createEngine({ ephemerisFiles: files });
  t.after(() => engine.dispose());
  return engine;
}

async function inLanguage(code, run) {
  setLanguage([code]);
  try {
    return await run();
  } finally {
    setLanguage(["en"]);
  }
}

// A view's contacts as one line each.
const lines = (view) => view.contacts.rows.map(({ pair, contact, orb, declinations }) => `${pair} ${contact} ${orb} (${declinations})`);

test("the page reads its chart and loads its files as the parans page does", () => {
  assert.equal(chartFromLink, paransChartFromLink);
  assert.equal(EPHEMERIS_FILES, PARANS_FILES);
});

test("ORBS are 0.5°, 1° and 1.5° of declination, and 1° is the default", () => {
  assert.deepEqual(ORBS, [0.5, 1, 1.5]);
  assert.deepEqual(DEFAULT_SETTINGS, { orb: 1 });
});

// ---- Real charts ------------------------------------------------------------

test("viewForDeclinations: London on 10 April 2024, in English: each dwarf planet's contacts, in degrees and minutes", async (t) => {
  const engine = await withFiles(t);
  const view = viewForDeclinations(LONDON, declinationsFor(LONDON, engine, { orb: 1 }), { orb: 1 });
  assert.equal(view.state, "ready");
  assert.equal(view.contacts.heading, "Parallels and contra-parallels within 1°");
  assert.deepEqual(view.contacts.columns, { contact: "Contact", orb: "Orb" });
  // Ceres and Pluto 0.998° apart, Sedna and Saturn too: inside the orb, at
  // 1°00′ to the minute.
  assert.deepEqual(lines(view), [
    "Ceres – Pluto Parallel 1°00′ (23°36′ S and 22°37′ S)",
    "Eris – Venus Contra-parallel 0°50′ (0°28′ S and 1°18′ N)",
    "Makemake – Pluto Contra-parallel 0°44′ (21°52′ N and 22°37′ S)",
    "Sedna – Ascendant Parallel 0°30′ (8°36′ N and 9°06′ N)",
    "Sedna – Sun Parallel 0°20′ (8°36′ N and 8°16′ N)",
    "Sedna – Saturn Contra-parallel 1°00′ (8°36′ N and 7°36′ S)",
  ]);
  assert.equal(view.contacts.none, null);
  assert.equal(view.declinations.heading, "Every declination");
  assert.deepEqual(view.declinations.rows.map(([name]) => name), [
    "Ceres", "Eris", "Makemake", "Haumea", "Varuna", "Ixion", "Orcus", "Sedna", "Ascendant", "MC", "Vertex",
    "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
  ]);
  assert.deepEqual(view.declinations.rows.slice(8, 11), [["Ascendant", "9°06′ N"], ["MC", "19°55′ N"], ["Vertex", "17°55′ S"]]);
  assert.deepEqual(view.assumptions.rows, [
    ["Ephemeris", "Swiss Ephemeris 2.10.03, Moshier"],
    ["Dwarf planets", "From Astrodienst's asteroid files, made from JPL's DE441, with the Sun and Earth from Moshier"],
    ["Time", "The chart's UTC, taken as UT"],
    ["Positions", "Each body's actual place, its latitude included, not its zodiacal degree: seen from the Earth's centre, on the true equator of the date"],
    ["Angles", "The Ascendant, MC and Vertex as points on the ecliptic, at its true obliquity of 23°26′"],
    ["Orb", "Within 1° of declination, 1° itself included"],
  ]);
  assert.deepEqual(view.notes, [
    "The Descendant, IC and anti-Vertex have the declinations of the Ascendant, MC and Vertex on the other side of the equator, so a parallel to one of them is a contra-parallel to its partner.",
  ]);
  // The chart reads as it does in the popup.
  assert.ok(view.rows.length > 0);
});

test("viewForDeclinations: Sydney in 1987, in Spanish, within 0.5°: Haumea contra-parallel to the Sun and Neptune", async (t) => {
  const engine = await withFiles(t);
  const view = await inLanguage("es", () => viewForDeclinations(SYDNEY, declinationsFor(SYDNEY, engine, { orb: 0.5 }), { orb: 0.5 }));
  assert.equal(view.contacts.heading, "Paralelos y contraparalelos a menos de 0,5°");
  assert.deepEqual(lines(view), [
    "Haumea – Sol Contraparalelo 0°23′ (22°40′ N y 22°17′ S)",
    "Haumea – Neptuno Contraparalelo 0°22′ (22°40′ N y 22°18′ S)",
  ]);
  assert.equal(view.assumptions.rows.at(-1)[1], "A 0,5° de declinación como mucho, 0,5° incluido");
});

test("viewForDeclinations: Tromsø at midsummer, in Slovenian, within 1.5°: Eris and Neptune, by the equator, are both", async (t) => {
  const engine = await withFiles(t);
  const view = await inLanguage("sl", () => viewForDeclinations(TROMSO, declinationsFor(TROMSO, engine, { orb: 1.5 }), { orb: 1.5 }));
  assert.equal(view.contacts.heading, "Paralele in kontraparalele znotraj 1,5°");
  const eris = lines(view).filter((line) => line.startsWith("Erida – Neptun"));
  assert.deepEqual(eris, [
    "Erida – Neptun Paralela 0°57′ (0°15′ J in 1°12′ J)",
    "Erida – Neptun Kontraparalela 1°27′ (0°15′ J in 1°12′ J)",
  ]);
});

test("viewForDeclinations: with nothing in the orb, a line saying so", async (t) => {
  const engine = await withFiles(t);
  // Tromsø's real declinations, with its one contact within 0.5°, Ceres and the Moon, taken away.
  const worked = declinationsFor(TROMSO, engine, { orb: 0.5 });
  const view = viewForDeclinations(TROMSO, { ...worked, contacts: [] }, { orb: 0.5 });
  assert.deepEqual(view.contacts.rows, []);
  assert.equal(view.contacts.none, "None of the dwarf planets is parallel or contra-parallel to the Ascendant, MC, Vertex or a planet within 0.5°.");
});

test("declinationsFor: declinations' refusal comes back as it gave it, and an orb not offered throws", () => {
  const uncalled = new Proxy({}, { get: (_, name) => { throw new Error(`the engine was asked for ${String(name)}`); } });
  assert.deepEqual(declinationsFor({ ...LONDON, lat: 90 }, uncalled, { orb: 1 }), { kind: "refused", reason: "at-pole" });
  for (const orb of [0.25, 2, "1", undefined]) assert.throws(() => declinationsFor(LONDON, uncalled, { orb }), /orb from 0.5, 1, 1.5/);
});

// ---- Degrees and minutes, from results made by hand -------------------------

function madeView(declinationsByPoint, contacts = []) {
  const points = {};
  for (const point of [...DWARF_PLANETS, ...ANGLES, ...PLANETS]) points[point] = { declination: declinationsByPoint[point] ?? 10 };
  const result = { kind: "declinations", points, obliquity: 23.4376, assumptions: { swissEphemeris: "2.10.03" } };
  return viewForDeclinations(LONDON, { result, contacts }, { orb: 1 });
}

test("viewForDeclinations: a declination to the nearest minute, carried into the degree, with no side at 0°00′", () => {
  const rows = Object.fromEntries(madeView({ ceres: 23.99999, eris: -0.004, makemake: 0.009, haumea: -12.5 }).declinations.rows);
  assert.equal(rows.Ceres, "24°00′ N");
  assert.equal(rows.Eris, "0°00′");
  assert.equal(rows.Makemake, "0°01′ N");
  assert.equal(rows.Haumea, "12°30′ S");
});

test("viewForDeclinations: an orb of 0° is 0°00′, and Slovenian says north and south with S and J", async () => {
  const contacts = [{ dwarfPlanet: "orcus", partner: "vertex", contact: "contra-parallel", orb: 0 }];
  const view = await inLanguage("sl", () => madeView({ orcus: 4.5, vertex: -4.5 }, contacts));
  assert.deepEqual(view.contacts.rows, [{ pair: "Ork – Verteks", contact: "Kontraparalela", orb: "0°00′", declinations: "4°30′ S in 4°30′ J" }]);
});

// ---- Settings ---------------------------------------------------------------

function storage(items = {}) {
  return {
    items,
    async get(key) {
      return Object.hasOwn(items, key) ? { [key]: items[key] } : {};
    },
    async set(entries) {
      Object.assign(items, entries);
    },
    async remove(key) {
      delete items[key];
    },
  };
}

test("declinationsSettings: a 1° orb until the user chooses, then what they chose, and the default again forgets it", async () => {
  const area = storage();
  assert.deepEqual(await declinationsSettings(area), { orb: 1 });
  await setDeclinationsSettings(area, { orb: 1.5 });
  assert.deepEqual(area.items, { "declinations-settings": { orb: 1.5 } });
  assert.deepEqual(await declinationsSettings(area), { orb: 1.5 });
  await setDeclinationsSettings(area, { orb: 1 });
  assert.deepEqual(area.items, {});
});

test("declinationsSettings: an orb that doesn't fit is the default, and the parans page's settings are its own", async () => {
  for (const orb of [2, 0.25, "1.5", null]) {
    assert.deepEqual(await declinationsSettings(storage({ "declinations-settings": { orb } })), { orb: 1 }, String(orb));
  }
  assert.deepEqual(await declinationsSettings(storage({ "declinations-settings": "odd" })), { orb: 1 });
  assert.deepEqual(await declinationsSettings(storage({ "parans-settings": { orb: 0.5 } })), { orb: 1 });
});

test("orbLabel: each orb with the language's decimal mark", async () => {
  assert.deepEqual(ORBS.map(orbLabel), ["0.5°", "1°", "1.5°"]);
  assert.deepEqual(await inLanguage("es", () => ORBS.map(orbLabel)), ["0,5°", "1°", "1,5°"]);
});

// ---- Refusals and failures --------------------------------------------------

test("viewForRefusal: no chart, the page's own refusals, a link's, and anything else, each keeping its code", () => {
  assert.deepEqual(viewForRefusal(null), {
    state: "empty",
    message: "This page works out the parallels and contra-parallels of a chart's dwarf planets. Open it from a chart in AstroChart Bridge.",
  });
  assert.deepEqual(viewForRefusal("at-pole"), {
    state: "refused",
    message: "At the poles the Ascendant, MC and Vertex aren't defined, so the contacts can't be worked out.",
    code: "at-pole",
  });
  assert.equal(viewForRefusal("date-out-of-range").message,
    "AstroChart Bridge works out declinations only for dates from 15 October 1582 to the end of 2999.");
  assert.equal(viewForRefusal("malformed").message, "This link is incomplete or damaged. Copy the whole link again.");
  assert.deepEqual(viewForRefusal("toString"), { state: "refused", message: "The declinations can't be worked out for this chart.", code: "toString" });
});

test("viewForFailure: names the body or the angles that couldn't be worked out, with Swiss Ephemeris's reason as its code", async () => {
  assert.deepEqual(viewForFailure({ point: "ceres", failure: { reason: "no-ephemeris-file" } }), {
    state: "refused",
    message: "Swiss Ephemeris couldn't work out Ceres's declination, so the contacts can't be worked out.",
    code: "no-ephemeris-file",
  });
  assert.equal(viewForFailure({ point: "sun", failure: { reason: "engine-error" } }).message,
    "Swiss Ephemeris couldn't work out the Sun's declination, so the contacts can't be worked out.");
  assert.equal(viewForFailure({ point: "angles", failure: { reason: "engine-error" } }).message,
    "Swiss Ephemeris couldn't work out the Ascendant, MC and Vertex, so the contacts can't be worked out.");
  assert.equal(await inLanguage("es", () => viewForFailure({ point: "sun", failure: { reason: "x" } }).message),
    "Swiss Ephemeris no pudo calcular la declinación del Sol, así que no se pueden calcular los aspectos.");
  assert.equal(await inLanguage("sl", () => viewForFailure({ point: "eris", failure: { reason: "x" } }).message),
    "Swiss Ephemeris ni mogel izračunati deklinacije telesa Erida, zato aspektov ni mogoče izračunati.");
});
