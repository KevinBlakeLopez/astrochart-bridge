// The parans page's model, parans-model.js: the page's horizons and settings,
// and the pairs of events it counts as parans, within the orb and at most 12
// hours apart. The reference cases run the real engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BODIES, paranGaps } from "../extension/core/parans.js";
import { createEngine } from "../extension/helioscope-engine.js";
import {
  DEFAULT_SETTINGS,
  HORIZONS,
  ORBS,
  paransFor,
  paransSettings,
  paransWithin,
  setParansSettings,
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
