// The parans page's model, parans-model.js: the page's horizons and settings,
// the pairs of events it counts as parans, within the orb and at most 12
// hours apart, and the screen drawn from them. The reference cases run the
// real engine, so every string below is what the page shows for that chart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BODIES, paranGaps } from "../extension/core/parans.js";
import { createEngine } from "../extension/helioscope-engine.js";
import { setLanguage } from "../extension/messages/index.js";
import {
  DEFAULT_SETTINGS,
  HORIZONS,
  ORBS,
  paransFor,
  paransSettings,
  paransWithin,
  setParansSettings,
  viewForFailure,
  viewForParans,
  viewForRefusal,
} from "../extension/parans-model.js";

const REFERENCE = JSON.parse(readFileSync(new URL("parans-reference.json", import.meta.url), "utf8"));

const DEFAULTS = { orb: 1, bodies: [...BODIES], horizon: "geometric", elevation: null };
const HALF_DAY_SECONDS = 12 * 3600;

const dashed = (name) => name.replaceAll("_", "-");
const natal = (utc, lat, lng) => ({ kind: "natal", utc, utcSource: "printed-utc", lat, lng });

// A pair as "sun rise / moon set", the earlier first.
const pairOf = (first, second) => `${first.point} ${dashed(first.event)} / ${second.point} ${dashed(second.event)}`;

// ---- Against astro-research, with the real engine -------------------------

test("HORIZONS are the two horizons test/parans-reference.json checks", () => {
  assert.deepEqual(Object.keys(HORIZONS), Object.keys(REFERENCE.horizons));
  for (const [name, { disc, refraction }] of Object.entries(REFERENCE.horizons)) {
    assert.deepEqual(HORIZONS[name], {
      disc: dashed(disc),
      refraction: refraction && { pressure: refraction.pressureHpa, temperature: refraction.temperatureC },
    }, name);
  }
});

test("paransFor: with every body and a 1° orb, the parans are astro-research's gaps within 1° of ARMC and 12 hours, in all six cases", async (t) => {
  const engine = await createEngine();
  t.after(() => engine.dispose());
  let seen = 0;
  for (const reference of REFERENCE.cases) {
    const chosen = reference.gaps.filter(([, , seconds, armc]) => Math.abs(armc) <= 1 && Math.abs(seconds) <= HALF_DAY_SECONDS);
    // No gap the other bound lets in is near this one, where the engine's
    // tenth of a second could put it on the other side.
    for (const [, , seconds, armc] of reference.gaps) {
      const nearOrb = Math.abs(Math.abs(armc) - 1) <= 0.01;
      const nearHalfDay = Math.abs(Math.abs(seconds) - HALF_DAY_SECONDS) <= 60;
      assert.ok(!(nearOrb && Math.abs(seconds) <= HALF_DAY_SECONDS + 60), `${reference.name}: a gap of ${armc}° is too near the orb`);
      assert.ok(!(nearHalfDay && Math.abs(armc) <= 1.01), `${reference.name}: a gap of ${seconds} s is too near 12 hours`);
    }
    const expected = chosen.map(([i, j]) => pairOf(reference.events[i], reference.events[j])).sort();

    const result = paransFor(natal(reference.utc, reference.lat, reference.lng), engine, { ...DEFAULTS, horizon: reference.horizon });
    assert.equal(result.kind, "parans", reference.name);
    assert.deepEqual(result.parans.map(({ first, second }) => pairOf(first, second)).sort(), expected, reference.name);
    const closeness = result.parans.map(({ armc }) => Math.abs(armc));
    assert.deepEqual(closeness, [...closeness].sort((a, b) => a - b), `${reference.name}: the closest first`);
    seen += expected.length;
  }
  // The six cases have parans to compare: 24 counted on 11 November 2026.
  assert.equal(seen, 24);
});

test("paransFor: the bodies are taken in BODIES's order, and the elevation is the default unless one is given", async (t) => {
  const engine = await createEngine();
  t.after(() => engine.dispose());
  const london = natal("2026-03-20T12:00:00Z", 51.5074, -0.1278);
  const none = paransFor(london, engine, { ...DEFAULTS, bodies: ["moon", "sun"] });
  assert.equal(none.kind, "parans");
  assert.deepEqual(none.events.bodies, ["sun", "moon"]);
  assert.deepEqual(none.events.horizon, HORIZONS.geometric);
  assert.deepEqual(none.events.assumptions.elevation, { metres: 0, source: "default" });
  const given = paransFor(london, engine, { ...DEFAULTS, bodies: ["moon", "sun"], horizon: "almanac", elevation: 120 });
  assert.deepEqual(given.events.horizon, HORIZONS.almanac);
  assert.deepEqual(given.events.assumptions.elevation, { metres: 120, source: "given" });
});

test("paransFor: angularEvents' refusal comes back as it gave it, and fewer than two bodies or an unknown horizon throws", () => {
  // Refused before the engine is asked anything.
  const engine = {};
  assert.deepEqual(paransFor({ kind: "event" }, engine, DEFAULTS), { kind: "refused", reason: "not-natal" });
  assert.deepEqual(paransFor({ kind: "natal", utcSource: "needs-choice" }, engine, DEFAULTS), { kind: "refused", reason: "needs-choice" });
  const chart = natal("2026-03-20T12:00:00Z", 51.5074, -0.1278);
  assert.throws(() => paransFor(chart, engine, { ...DEFAULTS, bodies: ["sun"] }), /two bodies or more/);
  assert.throws(() => paransFor(chart, engine, { ...DEFAULTS, bodies: [] }), /two bodies or more/);
  assert.throws(() => paransFor(chart, engine, { ...DEFAULTS, horizon: "toString" }), /takes a horizon/);
});

// ---- Which pairs count ----------------------------------------------------

// Events as angularEvents gives them, with only what paranGaps reads.
const JD = 2461000.5;
const at = (point, event, hours, armc) => ({ point, event, jd: JD + hours / 24, armc });
const eventsOf = (...events) => ({ kind: "events", events });

test("paransWithin: within the orb counts, its bound included, and just past it doesn't", () => {
  const events = eventsOf(
    at("sun", "rise", 0, 10),
    at("moon", "upper-transit", 0.05, 11), // 1° after the Sun: on the bound
    at("mars", "set", 0.1, 11.25), // 1.25° after the Sun, 0.25° after the Moon
  );
  const pairs = (orb) => paransWithin(events, orb).map(({ first, second, armc }) => [first.point, second.point, armc]);
  assert.deepEqual(pairs(1), [["moon", "mars", 0.25], ["sun", "moon", 1]]);
  assert.deepEqual(pairs(0.25), [["moon", "mars", 0.25]]);
  assert.deepEqual(pairs(2), [["moon", "mars", 0.25], ["sun", "moon", 1], ["sun", "mars", 1.25]]);
});

test("paransWithin: two events nearly a sidereal day apart aren't a paran, though their ARMCs nearly match", () => {
  const events = eventsOf(at("sun", "rise", -11.95, 359.75), at("moon", "set", 11.98, 0.25));
  // The gap wraps to half a degree...
  assert.deepEqual(paranGaps(events).map(({ armc }) => armc), [0.5]);
  // ...but they're nearly 24 hours apart.
  assert.deepEqual(paransWithin(events, 1), []);
});

test("paransWithin: 12 hours apart still counts, and a minute more doesn't", () => {
  const twelve = eventsOf(at("sun", "rise", 0, 100), at("moon", "set", 12, 100.5));
  assert.equal(paransWithin(twelve, 1).length, 1);
  const more = eventsOf(at("sun", "rise", 0, 100), at("moon", "set", 12 + 1 / 60, 100.5));
  assert.equal(paransWithin(more, 1).length, 0);
});

test("paransWithin: pairs as close as each other keep time order, two events of one body are never a pair, and an orb not offered throws", () => {
  // Quarter degrees, which floating point holds exactly, so equal gaps are equal.
  const events = eventsOf(
    at("sun", "rise", 0, 50),
    at("sun", "upper-transit", 0.01, 50.25), // a quarter of a degree from the Sun's rising, but the same body
    at("venus", "rise", 1, 50.5),
    at("moon", "set", 2, 50.75),
  );
  const pairs = paransWithin(events, 0.5).map(({ first, second }) => `${first.point} ${first.event} / ${second.point} ${second.event}`);
  // Two pairs a quarter of a degree apart, then two half a degree apart, each
  // two in the order of their first events; the Sun's rising and the Moon's
  // setting are 0.75° apart.
  assert.deepEqual(pairs, [
    "sun upper-transit / venus rise",
    "venus rise / moon set",
    "sun rise / venus rise",
    "sun upper-transit / moon set",
  ]);
  for (const orb of [0, 0.3, 3, "1", undefined]) assert.throws(() => paransWithin(events, orb), /takes an orb/, String(orb));
  assert.deepEqual(ORBS, [0.25, 0.5, 1, 2]);
});

// ---- Settings ---------------------------------------------------------------

// A stand-in for chrome.storage.local, as test/preference.test.js has it.
function storage(initial = {}) {
  const items = { ...initial };
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

test("paransSettings: a 1° orb, every body, the geometric horizon and no elevation until the user chooses, then what they chose", async () => {
  assert.deepEqual({ ...DEFAULT_SETTINGS, bodies: [...DEFAULT_SETTINGS.bodies] }, DEFAULTS);
  const area = storage();
  assert.deepEqual(await paransSettings(area), DEFAULTS);
  const chosen = { orb: 0.5, bodies: ["sun", "venus", "pluto"], horizon: "almanac", elevation: 120 };
  await setParansSettings(area, chosen);
  assert.deepEqual(area.items, { "parans-settings": chosen });
  assert.deepEqual(await paransSettings(area), chosen);
});

test("paransSettings: going back to the defaults forgets the choice", async () => {
  const area = storage({ "parans-settings": { orb: 0.5, bodies: ["sun", "moon"], horizon: "almanac", elevation: 120 } });
  await setParansSettings(area, DEFAULTS);
  assert.deepEqual(area.items, {});
  // Every body, in another order, is still every body.
  const reordered = storage({ "parans-settings": { orb: 2 } });
  await setParansSettings(reordered, { ...DEFAULTS, bodies: [...BODIES].reverse() });
  assert.deepEqual(reordered.items, {});
});

test("paransSettings: each stored value that doesn't fit is its default, and the bodies come back in BODIES's order", async () => {
  const read = (stored) => paransSettings(storage({ "parans-settings": stored }));
  assert.deepEqual(await read("odd"), DEFAULTS);
  assert.deepEqual(await read({ orb: 3, bodies: ["sun", "moon"], horizon: "almanac", elevation: 0 }), {
    ...DEFAULTS, bodies: ["sun", "moon"], horizon: "almanac", elevation: 0,
  });
  assert.deepEqual(await read({ orb: 0.25, bodies: ["pluto", "moon"] }), { ...DEFAULTS, orb: 0.25, bodies: ["moon", "pluto"] });
  for (const bodies of [["sun"], [], ["sun", "sun"], ["sun", "sirius"], "sun,moon", null]) {
    assert.deepEqual((await read({ bodies })).bodies, DEFAULTS.bodies, JSON.stringify(bodies));
  }
  for (const horizon of ["toString", "Geometric", 1, null]) assert.equal((await read({ horizon })).horizon, "geometric", String(horizon));
  for (const elevation of [30_000, -501, 1.5, "120"]) assert.equal((await read({ elevation })).elevation, null, String(elevation));
  assert.equal((await read({ elevation: -500 })).elevation, -500);
  assert.equal((await read({ elevation: 25_000 })).elevation, 25_000);
});

// ---- The screen -------------------------------------------------------------

// The reference cases' charts as the page's link gives them, at their own
// offsets: British Summer Time, Norway's summer time and Sydney's.
const chartAt = (utc, local, offsetMinutes, lat, lng) => ({
  kind: "natal", site: null, local, zoneLabel: null, lat, lng, utc, utcSource: "declared", offsetMinutes,
});
const LONDON = chartAt("2024-04-10T14:30:00Z", "2024-04-10T15:30:00", 60, 51.5074, -0.1278);
const TROMSO = chartAt("2024-06-21T12:00:00Z", "2024-06-21T14:00:00", 120, 69.6492, 18.9553);
const SYDNEY = chartAt("1987-12-05T03:20:00Z", "1987-12-05T14:20:00", 660, -33.8688, 151.2093);

// Runs check in a language, awaiting it, then goes back to English for the
// next test. The tests in a file run one at a time, so nothing else reads
// the language meanwhile.
async function inLanguage(code, check) {
  setLanguage([code]);
  try {
    return await check();
  } finally {
    setLanguage(["en"]);
  }
}

// The screen for a chart, with an engine of its own, as the page has.
async function screen(chart, settings = DEFAULTS) {
  const engine = await createEngine();
  try {
    const worked = paransFor(chart, engine, settings);
    assert.equal(worked.kind, "parans");
    return viewForParans(chart, worked, settings);
  } finally {
    engine.dispose();
  }
}

test("viewForParans: London on 10 April 2024, in English: the parans closest first, with their times at the chart's offset", async () => {
  const view = await screen(LONDON);
  assert.equal(view.state, "ready");
  assert.deepEqual(view.rows, [["Local time", "10 Apr 2024, 15:30"], ["Offset", "UTC+01:00"], ["UTC", "2024-04-10 14:30"], ["Place", "51°30'N, 0°8'W"]]);
  assert.equal(view.parans.heading, "Parans within 1° of ARMC");
  assert.equal(view.parans.none, null);
  // Mars and Saturn were in conjunction that day, so they're on every angle together.
  assert.deepEqual(view.parans.rows, [
    { first: "Saturn sets at 16:11", second: "Mars sets at 16:11", armc: "0.14° of ARMC", time: "33 s" },
    { first: "Mars anticulminates at 22:48", second: "Saturn anticulminates at 22:48", armc: "0.14° of ARMC", time: "34 s" },
    { first: "Jupiter rises at 07:24", second: "Uranus rises at 07:25", armc: "0.23° of ARMC", time: "55 s" },
    { first: "Pluto anticulminates at 20:02", second: "Mercury sets at 20:04", armc: "0.42° of ARMC", time: "1 min 40 s" },
    { first: "Mars culminates at 10:48", second: "Saturn culminates at 10:50", armc: "0.45° of ARMC", time: "1 min 48 s" },
    {
      first: "The Sun anticulminates at 01:02 on 11 Apr",
      second: "Mercury anticulminates at 01:04 on 11 Apr",
      armc: "0.64° of ARMC",
      time: "2 min 32 s",
    },
    { first: "Mars rises at 05:26", second: "Saturn rises at 05:30", armc: "0.89° of ARMC", time: "3 min 33 s" },
  ]);
  // Every event, in time order: four for each of the ten bodies.
  assert.equal(view.events.heading, "Every event");
  assert.equal(view.events.summary, "Every rising, setting and culmination in the 24 hours around the chart's moment");
  assert.equal(view.events.rows.length, 40);
  assert.deepEqual(view.events.rows.slice(0, 2), [["04:11", "Pluto rises · ARMC 246.54°"], ["05:26", "Mars rises · ARMC 265.27°"]]);
  assert.deepEqual(view.events.rows.at(-1), ["03:02 on 11 Apr", "The Moon anticulminates · ARMC 230.26°"]);
  assert.deepEqual(view.events.missing, []);
  assert.equal(view.assumptions.heading, "Assumptions");
  assert.deepEqual(view.assumptions.rows, [
    ["Ephemeris", "Swiss Ephemeris 2.10.03, Moshier"],
    ["Time", "The chart's UTC, taken as UT"],
    ["Window", "From 03:30 to 03:30 on 11 Apr, 12 hours either side of the chart's moment"],
    ["Positions", "Each body's actual place, its latitude included, not its zodiacal degree"],
    ["Horizon", "Geometric: the centre of the disc, without refraction"],
    ["Culminations", "On the meridian, at hour angles 0° and 180°"],
    ["Search", "Each event is the one a second search finds, started 3 minutes before the first's"],
    ["Elevation", "0 m, as none was given"],
    ["Orb", "Within 1° of ARMC, at most 12 hours apart"],
  ]);
  assert.deepEqual(view.notes, [
    "Times are at UTC+01:00, the chart's offset.",
    "ARMC is the right ascension of the midheaven, sidereal time in degrees: 1° of it passes in about 4 minutes.",
  ]);
});

test("viewForParans: Tromsø at midsummer, in Spanish, on the almanac's horizon: no parans within 0.5°, and six bodies that neither rise nor set", async () => {
  const view = await inLanguage("es", () => screen(TROMSO, { ...DEFAULTS, orb: 0.5, horizon: "almanac" }));
  assert.equal(view.parans.heading, "Parans a menos de 0,5° de ARMC");
  assert.deepEqual(view.parans.rows, []);
  assert.equal(
    view.parans.none,
    "Ningún par de estos cuerpos está en los ángulos a menos de 0,5° de ARMC en las 24 horas alrededor del momento de la carta.",
  );
  // The reference's own notes: the Sun, Mercury, Venus and Jupiter never set, and the Moon and Pluto never rise.
  assert.deepEqual(view.events.missing, [
    "El Sol no sale ni se pone ese día",
    "La Luna no sale ni se pone ese día",
    "Mercurio no sale ni se pone ese día",
    "Venus no sale ni se pone ese día",
    "Júpiter no sale ni se pone ese día",
    "Plutón no sale ni se pone ese día",
  ]);
  assert.deepEqual(view.events.rows[0], ["03:04", "Plutón culmina · ARMC 304,59°"]);
  const rows = Object.fromEntries(view.assumptions.rows);
  assert.equal(rows.Intervalo, "De las 02:00 a las 02:00 del 22 jun, 12 horas antes y después del momento de la carta");
  assert.equal(rows.Horizonte, "El borde superior, con refracción a 1013,25 hPa y 10 °C");
  assert.equal(rows.Orbe, "A menos de 0,5° de ARMC, con 12 horas de separación como mucho");
});

test("viewForParans: Sydney in 1987, in Slovenian, with a 0.25° orb: Neptune and Venus rising 2 seconds apart", async () => {
  const view = await inLanguage("sl", () => screen(SYDNEY, { ...DEFAULTS, orb: 0.25 }));
  assert.equal(view.parans.heading, "Parani znotraj 0,25° ARMC");
  assert.deepEqual(view.parans.rows, [{ first: "Neptun vzide ob 07:28", second: "Venera vzide ob 07:28", armc: "0,01° ARMC", time: "2 s" }]);
  assert.deepEqual(view.events.rows[0], ["02:33", "Neptun je v spodnji kulminaciji · ARMC 97,32°"]);
  const rows = Object.fromEntries(view.assumptions.rows);
  assert.equal(rows.Okno, "Od 02:20 do 02:20 dne 6. dec., 12 ur pred trenutkom horoskopa in po njem");
  assert.equal(rows.Iskanje, "Vsak dogodek je tisti, ki ga najde drugo iskanje, začeto 3 minute prej kot izid prvega");
  assert.equal(rows.Orba, "Znotraj 0,25° ARMC, največ 12 ur narazen");
  assert.deepEqual(view.notes.slice(0, 1), ["Časi so po zamiku UTC+11:00, ki ga ima horoskop."]);
});

// A result with only what viewForParans reads, for what the reference cases
// don't reach.
function madeUp({ events = [], noRiseOrSet = [], parans = [], elevation = { metres: 0, source: "default" } }) {
  return {
    events: {
      events,
      noRiseOrSet,
      window: { start: { utc: "2024-04-10T02:30:00Z" }, end: { utc: "2024-04-11T02:30:00Z" } },
      assumptions: { swissEphemeris: "2.10.03", refineLeadMinutes: 3, elevation },
    },
    parans,
  };
}

test("viewForParans: an ARMC that rounds to 360° is 0.00°, a body missing only its setting says so, and an elevation below sea level has a true minus", () => {
  const view = viewForParans(
    LONDON,
    madeUp({
      events: [{ point: "sun", event: "rise", utc: "2024-04-10T05:20:00Z", armc: 359.996 }],
      noRiseOrSet: [{ point: "mars", event: "set" }, { point: "venus", event: "rise" }],
      elevation: { metres: -20, source: "given" },
    }),
    DEFAULTS,
  );
  assert.deepEqual(view.events.rows, [["06:20", "The Sun rises · ARMC 0.00°"]]);
  // In BODIES's order, not the order they were found in.
  assert.deepEqual(view.events.missing, ["Venus doesn't rise that day", "Mars doesn't set that day"]);
  assert.deepEqual(Object.fromEntries(view.assumptions.rows).Elevation, "−20 m");
  assert.equal(view.parans.none, "No two of these bodies are on the angles within 1° of ARMC of each other in the 24 hours around the chart's moment.");
});

test("viewForParans: a gap's time is to the nearest second, and its ARMC is how far apart, whichever came first", () => {
  const first = { point: "sun", event: "rise", utc: "2024-04-10T05:20:00Z", armc: 10 };
  const second = { point: "moon", event: "set", utc: "2024-04-10T05:21:00Z", armc: 10.5 };
  const rows = (seconds, armc) => viewForParans(LONDON, madeUp({ parans: [{ first, second, seconds, armc }] }), DEFAULTS).parans.rows[0];
  assert.deepEqual(rows(59.5, 0.25), { first: "The Sun rises at 06:20", second: "The Moon sets at 06:21", armc: "0.25° of ARMC", time: "1 min 0 s" });
  assert.equal(rows(59.4, 0.25).time, "59 s");
  assert.equal(rows(-0.4, -0.004).armc, "0.00° of ARMC");
  assert.equal(rows(240, -1).armc, "1.00° of ARMC");
});

test("viewForRefusal: no chart, the parans' own refusals, a link's, and anything else, each keeping its code", () => {
  assert.deepEqual(viewForRefusal(null), {
    state: "empty",
    message: "This page works out a chart's parans. Open it from a chart in AstroChart Bridge.",
  });
  assert.deepEqual(viewForRefusal("at-pole"), {
    state: "refused",
    message: "At the poles there's no meridian for the bodies to culminate on, so there are no parans.",
    code: "at-pole",
  });
  assert.deepEqual(viewForRefusal("malformed"), {
    state: "refused",
    message: "This link is incomplete or damaged. Copy the whole link again.",
    code: "malformed",
  });
  assert.deepEqual(viewForRefusal("toString"), { state: "refused", message: "The parans can't be worked out for this chart.", code: "toString" });
  assert.equal(
    viewForRefusal("engine-failed").message,
    "Swiss Ephemeris couldn't start in this browser, so the parans can't be worked out.",
  );
});

test("viewForFailure: names the search that failed, with Swiss Ephemeris's reason as its code", async () => {
  const failed = { point: "sun", event: "rise", failure: { kind: "failed", reason: "engine-error" } };
  assert.deepEqual(viewForFailure(failed), {
    state: "refused",
    message: "Swiss Ephemeris couldn't work out when the Sun rises, so the parans can't be worked out.",
    code: "engine-error",
  });
  const spanish = await inLanguage("es", () => viewForFailure({ ...failed, event: "set" }));
  assert.equal(spanish.message, "Swiss Ephemeris no pudo calcular cuándo el Sol se pone, así que no se pueden calcular los parans.");
  const slovenian = await inLanguage("sl", () => viewForFailure({ point: "moon", event: "lower-transit", failure: { reason: "search-stalled" } }));
  assert.deepEqual(slovenian, {
    state: "refused",
    message: "Swiss Ephemeris ni mogel izračunati, kdaj je Luna v spodnji kulminaciji, zato paranov ni mogoče izračunati.",
    code: "search-stalled",
  });
  const rising = await inLanguage("sl", () => viewForFailure({ point: "sun", event: "rise", failure: { reason: "engine-error" } }));
  assert.equal(rising.message, "Swiss Ephemeris ni mogel izračunati, kdaj Sonce vzide, zato paranov ni mogoče izračunati.");
});
