// The parans page's fixed stars, worked out from Swiss Ephemeris's catalogue,
// extension/vendor/swisseph/ephe/sefstars.txt: every star in it brighter than
// visual magnitude 2.0, and the 64 stars Bernadette Brady uses, brightest
// first. Each is the catalogue's designation, as Swiss Ephemeris takes it, its
// first name in the catalogue, its other names, and its magnitude. The other
// names are the catalogue's, among them the Indian names of the nakshatras'
// stars, and Brady's spelling where the catalogue hasn't it.
//
// test/parans-stars.test.js checks that core/parans.js's FIXED_STARS is what
// this works out from the vendored catalogue. Run it by hand to print the list
// after the catalogue or either choice changes:
//
//   node tools/fixed-stars.mjs
import { readFileSync } from "node:fs";

const CATALOGUE = new URL("../extension/vendor/swisseph/ephe/sefstars.txt", import.meta.url);

// The brightest visual magnitude kept, a choice made on 12 November 2026.
export const MAGNITUDE_LIMIT = 2.0;

// The 64 stars Bernadette Brady uses, as Astro America lists them for her Star
// & Planet Combinations, whose description says each chart "lists all the 64
// stars which Brady uses" (https://astroamerica.com/stars.html, read on 12
// November 2026), by the catalogue's designation for each of her names. Her
// names that the catalogue spells otherwise: Agena is Hadar, Toliman Rigil
// Kentaurus, El Nath Elnath, Deneb Adige Deneb, Murzims Mirzam, Ras Alhague
// Rasalhague, Al Rescha Alrescha and Zuben Elgenubi Zubenelgenubi. Its
// "Alhilam", which no catalogue name matches, is taken for Alnilam, epOri.
// Menkar is alpha Ceti, not lambda, and four are star clusters: Aculeus M6,
// Acumen M7, Capulus NGC 869 and Facies M22.
// Each is [designation, Brady's name for it], in the list's order.
const BRADY_NAMES = Object.freeze([
  ["alEri", "Achernar"], ["alCru", "Acrux"], ["alCnc", "Acubens"], ["M6", "Aculeus"], ["M7", "Acumen"],
  ["beCen", "Agena"], ["alPsc", "Al Rescha"], ["etTau", "Alcyone"], ["alTau", "Aldebaran"], ["alCep", "Alderamin"],
  ["bePer", "Algol"], ["gaGem", "Alhena"], ["alCrt", "Alkes"], ["epOri", "Alnilam"], ["alHya", "Alphard"],
  ["alCrB", "Alphecca"], ["alAnd", "Alpheratz"], ["alAql", "Altair"], ["alPhe", "Ankaa"], ["alSco", "Antares"],
  ["alBoo", "Arcturus"], ["gaOri", "Bellatrix"], ["alOri", "Betelgeuse"], ["alCar", "Canopus"], ["alAur", "Capella"],
  ["NGC869", "Capulus"], ["alGem", "Castor"], ["alCyg", "Deneb Adige"], ["deCap", "Deneb Algedi"], ["beLeo", "Denebola"],
  ["alCom", "Diadem"], ["alUMa", "Dubhe"], ["beTau", "El Nath"], ["M22", "Facies"], ["alPsA", "Fomalhaut"],
  ["alAri", "Hamal"], ["alPeg", "Markab"], ["alCet", "Menkar"], ["beAnd", "Mirach"], ["alPer", "Mirfak"],
  ["beCMa", "Murzims"], ["alCol", "Phact"], ["alUMi", "Polaris"], ["beGem", "Pollux"], ["alCMi", "Procyon"],
  ["alHer", "Ras Algethi"], ["alOph", "Ras Alhague"], ["alLeo", "Regulus"], ["beOri", "Rigel"], ["alSgr", "Rukbat"],
  ["alAqr", "Sadalmelek"], ["beAqr", "Sadalsuud"], ["bePeg", "Scheat"], ["alCas", "Schedar"], ["alCMa", "Sirius"],
  ["alVir", "Spica"], ["alDel", "Sualocin"], ["alDra", "Thuban"], ["alCen", "Toliman"], ["alLyr", "Vega"],
  ["epVir", "Vindemiatrix"], ["deLeo", "Zosma"], ["al-2Lib", "Zuben Elgenubi"], ["beLib", "Zuben Eschamali"],
]);
export const BRADY = Object.freeze(BRADY_NAMES.map(([designation]) => designation));

// Names the catalogue gives a designation that aren't that star's: it files
// Proxima Centauri, a star of its own, under alpha Centauri's.
const NOT_ITS_NAME = Object.freeze({ alCen: ["Proxima Centauri"] });

// A star's designation: a Bayer letter, maybe numbered, and a constellation,
// such as alLeo or ga-1Leo, or a Flamsteed number, such as 41Ari. Not the
// galactic poles, reference points and galaxies the catalogue also has.
const STAR = /^([a-z]{2,3}(-\d)?|\d{1,3})[A-Z][a-zA-Z]{2}$/;

/**
 * Every record in the catalogue, once, by designation, with the first name
 * the catalogue gives it, as Swiss Ephemeris finds it first, every name it
 * gives it in its order, its magnitude, and whether it's a star by its
 * designation.
 *
 * @param {string} text  sefstars.txt
 * @returns {Map<string, { name: string, names: string[], magnitude: number, star: boolean }>}
 */
export function catalogueStars(text) {
  const stars = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const fields = line.split(",").map((field) => field.trim());
    if (fields.length < 14) continue;
    const [name, designation] = fields;
    const magnitude = Number(fields[13]);
    if (designation === "" || !Number.isFinite(magnitude)) continue;
    const known = stars.get(designation);
    if (known) {
      if (name !== "" && !known.names.includes(name)) known.names.push(name);
      continue;
    }
    stars.set(designation, { name, names: name === "" ? [] : [name], magnitude, star: STAR.test(designation) });
  }
  return stars;
}

// The same name, whatever its spaces, hyphens and capitals: "Zuben Elgenubi" and "Zubenelgenubi".
const squash = (name) => name.toLowerCase().replace(/[^a-z]/g, "");

// A star's other names: the catalogue's after its first, but not those that
// aren't the star's, then Brady's where none of those is it, however spelled.
function otherNames(designation, names) {
  const others = names.slice(1).filter((name) => !(NOT_ITS_NAME[designation] ?? []).includes(name));
  const brady = BRADY_NAMES.find(([d]) => d === designation)?.[1];
  if (brady && ![names[0], ...others].some((name) => squash(name) === squash(brady))) others.push(brady);
  return others;
}

/**
 * The page's stars, brightest first, with ties in the catalogue's order.
 *
 * @param {string} text  sefstars.txt
 * @returns {{ designation: string, name: string, otherNames: string[], magnitude: number }[]}
 */
export function fixedStars(text) {
  const stars = catalogueStars(text);
  for (const designation of BRADY) {
    if (!stars.has(designation)) throw new Error(`sefstars.txt has no ${designation}`);
  }
  return [...stars]
    .filter(([designation, { magnitude, star }]) => (star && magnitude <= MAGNITUDE_LIMIT) || BRADY.includes(designation))
    .map(([designation, { name, names, magnitude }]) => ({
      designation: `,${designation}`,
      name,
      otherNames: otherNames(designation, names),
      magnitude,
    }))
    .sort((a, b) => a.magnitude - b.magnitude);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stars = fixedStars(readFileSync(CATALOGUE, "latin1"));
  for (const { designation, name, otherNames: others, magnitude } of stars) {
    console.log(`  { designation: "${designation}", name: "${name}", otherNames: ${JSON.stringify(others).replaceAll('","', '", "')}, magnitude: ${magnitude} },`);
  }
  console.log(`// ${stars.length} stars`);
}
