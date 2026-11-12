// The parans page's fixed stars, worked out from Swiss Ephemeris's catalogue,
// extension/vendor/swisseph/ephe/sefstars.txt: every star in it brighter than
// visual magnitude 2.0, and the traditional stars just fainter than that,
// brightest first. Each is the catalogue's designation, as Swiss Ephemeris
// takes it, its first name in the catalogue and its magnitude.
//
// test/parans-stars.test.js checks that core/parans.js's FIXED_STARS is what
// this works out from the vendored catalogue. Run it by hand to print the list
// after the catalogue changes:
//
//   node tools/fixed-stars.mjs
import { readFileSync } from "node:fs";

const CATALOGUE = new URL("../extension/vendor/swisseph/ephe/sefstars.txt", import.meta.url);

// The brightest visual magnitude kept, a choice made on 12 November 2026:
// 48 stars, fewer than Brady's 64 and none of them hers.
export const MAGNITUDE_LIMIT = 2.0;

// Traditional stars of astrology fainter than the limit, kept by name, as
// chosen the same day: Algol, Alphecca, Denebola, Hamal, Polaris, Alpheratz,
// Scheat and Markab.
export const TRADITIONAL = Object.freeze(["bePer", "alCrB", "beLeo", "alAri", "alUMi", "alAnd", "bePeg", "alPeg"]);

// A star's designation: a Bayer letter, maybe numbered, and a constellation,
// such as alLeo or ga-1Leo, or a Flamsteed number, such as 41Ari. Not the
// galactic poles, reference points and galaxies the catalogue also has.
const STAR = /^([a-z]{2,3}(-\d)?|\d{1,3})[A-Z][a-zA-Z]{2}$/;

/**
 * Every star in the catalogue, once, by designation, with the first name the
 * catalogue gives it, as Swiss Ephemeris finds it first, and its magnitude.
 *
 * @param {string} text  sefstars.txt
 * @returns {Map<string, { name: string, magnitude: number }>}
 */
export function catalogueStars(text) {
  const stars = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const fields = line.split(",").map((field) => field.trim());
    if (fields.length < 14) continue;
    const [name, designation] = fields;
    const magnitude = Number(fields[13]);
    if (!STAR.test(designation) || !Number.isFinite(magnitude) || stars.has(designation)) continue;
    stars.set(designation, { name, magnitude });
  }
  return stars;
}

/**
 * The page's stars, brightest first, with ties in the catalogue's order.
 *
 * @param {string} text  sefstars.txt
 * @returns {{ designation: string, name: string, magnitude: number }[]}
 */
export function fixedStars(text) {
  const stars = catalogueStars(text);
  for (const designation of TRADITIONAL) {
    if (!stars.has(designation)) throw new Error(`sefstars.txt has no ${designation}`);
  }
  return [...stars]
    .filter(([designation, { magnitude }]) => magnitude <= MAGNITUDE_LIMIT || TRADITIONAL.includes(designation))
    .map(([designation, { name, magnitude }]) => ({ designation: `,${designation}`, name, magnitude }))
    .sort((a, b) => a.magnitude - b.magnitude);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stars = fixedStars(readFileSync(CATALOGUE, "latin1"));
  for (const { designation, name, magnitude } of stars) console.log(`  { designation: "${designation}", name: "${name}", magnitude: ${magnitude} },`);
  console.log(`// ${stars.length} stars`);
}
