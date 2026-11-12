// The parans page's fixed stars: the list, worked out from the vendored star
// catalogue; the engine's events for them, against astro-research's; and
// how parans pair them, with bodies and never with each other.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { FIXED_STARS, angularEvents, isStar, paranGaps } from "../extension/core/parans.js";
import { createEngine } from "../extension/helioscope-engine.js";
import { MAGNITUDE_LIMIT, TRADITIONAL, fixedStars } from "../tools/fixed-stars.mjs";

const CATALOGUE = new URL("../extension/vendor/swisseph/ephe/sefstars.txt", import.meta.url);
// astro-research's star events, written by tools/make-star-reference.py.
const REFERENCE = JSON.parse(readFileSync(new URL("parans-star-reference.json", import.meta.url), "utf8"));
const CASES = JSON.parse(readFileSync(new URL("parans-reference.json", import.meta.url), "utf8"));

// Measured on 12 November 2026 over the 1,045 events: risings and settings at
// most 9.6 ms from astro-research's, culminations at most 58 ms, Polaris's,
// whose place 0.6° from the pole magnifies the ephemerides' difference. About
// 2.5 times those are allowed.
const SECONDS = { "rise-set": 0.025, transits: 0.15 };
const REFINE_LEAD_DAYS = 3 / 1440;
const GEOMETRIC = { disc: "centre", refraction: null };

const dashed = (name) => name.replaceAll("_", "-");
function horizonOf(name) {
  const { disc, refraction } = CASES.horizons[name];
  return { disc: dashed(disc), refraction: refraction && { pressure: refraction.pressureHpa, temperature: refraction.temperatureC } };
}
const placeOf = ({ lat, lng, elevation }) => ({ lat, lng, elevation });
const natal = (utc, lat, lng) => ({ kind: "natal", utc, utcSource: "printed-utc", lat, lng });

async function withCatalogue(t) {
  const engine = await createEngine({ ephemerisFiles: { "sefstars.txt": new Uint8Array(readFileSync(CATALOGUE)) } });
  t.after(() => engine.dispose());
  return engine;
}

test("FIXED_STARS are the catalogue's stars brighter than magnitude 2.0, with eight traditional ones just fainter, brightest first", () => {
  const catalogue = readFileSync(CATALOGUE);
  assert.equal(createHash("sha256").update(catalogue).digest("hex"), REFERENCE.catalogue.sha256);
  assert.deepEqual(FIXED_STARS, fixedStars(catalogue.toString("latin1")));
  assert.equal(MAGNITUDE_LIMIT, 2);
  assert.equal(FIXED_STARS.filter(({ magnitude }) => magnitude <= MAGNITUDE_LIMIT).length, 48);
  assert.deepEqual(FIXED_STARS.slice(48).map(({ name }) => name), ["Hamal", "Polaris", "Alpheratz", "Algol", "Denebola", "Alphecca", "Scheat", "Markab"]);
  assert.deepEqual(TRADITIONAL.map((d) => `,${d}`).sort(), FIXED_STARS.slice(48).map(({ designation }) => designation).sort());
  assert.deepEqual(REFERENCE.stars, FIXED_STARS.map(({ designation }) => designation));
  assert.ok(FIXED_STARS.every(({ name }) => name.length > 0), "every star has a name");
});

test("angularEvent: every star event is astro-research's, within the tolerance, in all six cases", async (t) => {
  const engine = await withCatalogue(t);
  let compared = 0;
  for (const result of REFERENCE.results) {
    const place = placeOf(result);
    const horizon = horizonOf(result.horizon);
    for (const { point, event, jdUt } of result.events) {
      const label = `${result.name}: ${point} ${event}`;
      const found = engine.angularEvent(jdUt - REFINE_LEAD_DAYS, place, point, dashed(event), horizon);
      assert.equal(found.kind, "found", label);
      const allowed = event.endsWith("transit") ? SECONDS.transits : SECONDS["rise-set"];
      const seconds = Math.abs(found.jd - jdUt) * 86400;
      assert.ok(seconds <= allowed, `${label}: ${seconds} s from astro-research's`);
      compared += 1;
    }
    for (const [point, event] of result.noRiseOrSet) {
      assert.deepEqual(engine.angularEvent(result.window.startJdUt, place, point, dashed(event), horizon), { kind: "none" }, `${result.name}: ${point} ${event}`);
    }
  }
  assert.equal(compared, 1045);
});

test("angularEvent: a star without the catalogue fails with no-ephemeris-file, and the same star asked twice gives the same event", async (t) => {
  const none = await createEngine();
  t.after(() => none.dispose());
  const [london] = REFERENCE.results;
  const place = placeOf(london);
  const failed = none.angularEvent(london.window.startJdUt, place, ",alLeo", "rise", GEOMETRIC);
  assert.equal(failed.reason, "no-ephemeris-file");
  assert.match(failed.serr, /sefstars\.txt/);
  // Swiss Ephemeris writes "Regulus,alLeo" over the name it's given, so the engine writes it afresh.
  const engine = await withCatalogue(t);
  const first = engine.angularEvent(london.window.startJdUt, place, ",alLeo", "rise", GEOMETRIC);
  const again = engine.angularEvent(london.window.startJdUt, place, ",alLeo", "rise", GEOMETRIC);
  assert.equal(first.kind, "found");
  assert.deepEqual(again, first);
  // A designation the catalogue hasn't is Swiss Ephemeris's error, not a missing rising.
  assert.equal(engine.angularEvent(london.window.startJdUt, place, ",xiZzz", "rise", GEOMETRIC).reason, "engine-error");
  // A name, not a designation, isn't a star at all.
  assert.throws(() => engine.angularEvent(london.window.startJdUt, place, "Regulus", "rise", GEOMETRIC), /body/);
});

test("angularEvents: the stars come after the bodies, in the result's stars, and parans pair a star with a body, never two stars", async (t) => {
  const engine = await withCatalogue(t);
  const [london] = REFERENCE.results;
  const stars = [",alLeo", ",alCMa", ",alUMi"];
  const result = angularEvents(natal(london.utc, london.lat, london.lng), engine, { bodies: ["sun", "moon"], stars, horizon: GEOMETRIC });
  assert.equal(result.kind, "events");
  assert.deepEqual(result.stars, stars);
  assert.deepEqual(result.assumptions.ephemerisFiles, ["sefstars.txt"]);
  // Polaris never sets at London, so only its two culminations.
  assert.deepEqual(result.noRiseOrSet, [{ point: ",alUMi", event: "rise" }, { point: ",alUMi", event: "set" }]);
  assert.equal(result.events.filter(({ point }) => isStar(point)).length, 4 + 4 + 2);
  const gaps = paranGaps(result);
  assert.ok(gaps.length > 0);
  assert.ok(gaps.every(({ first, second }) => !(isStar(first.point) && isStar(second.point))), "no pair of two stars");
  assert.ok(gaps.some(({ first, second }) => isStar(first.point) !== isStar(second.point)), "a star with a body");
});

test("angularEvents: stars are FIXED_STARS's designations, each once; anything else is a mistake in the caller", async (t) => {
  const engine = await withCatalogue(t);
  const [london] = REFERENCE.results;
  const chart = natal(london.utc, london.lat, london.lng);
  for (const stars of [[",alLeo", ",alLeo"], ["Regulus"], [",ze-2UMa"], ",alLeo", null]) {
    assert.throws(() => angularEvents(chart, engine, { bodies: ["sun"], stars, horizon: GEOMETRIC }), /stars/, JSON.stringify(stars));
  }
  assert.equal(angularEvents(chart, engine, { bodies: ["sun"], horizon: GEOMETRIC }).stars.length, 0);
});
