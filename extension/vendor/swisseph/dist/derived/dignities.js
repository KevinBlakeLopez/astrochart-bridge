/**
 * Essential dignities and rulerships.
 *
 * Pure table work — Swiss Ephemeris gives the position, this layer says what
 * the tradition takes that position to mean.
 *
 * Five essential dignities: domicile, exaltation, triplicity, terms (bounds)
 * and faces (decans). Detriment and fall are the opposites of domicile and
 * exaltation, so they are derived rather than tabulated.
 *
 * Triplicity rulers and terms depend on **sect**; the determination in
 * `sect.ts` feeds in here.
 */
import { Body, SIGNS } from '../constants.js';
/** The classical seven — the dignity tables cover only these. */
export const TRADITIONAL_RULERS = [
    Body.Sun, Body.Moon, Body.Mercury, Body.Venus,
    Body.Mars, Body.Jupiter, Body.Saturn,
];
/**
 * Domicile, the traditional assignment, indexed by sign (0 = Aries).
 *
 * Modern astrology gives Scorpio to Pluto, Aquarius to Uranus and Pisces to
 * Neptune; {@link MODERN_RULERS} carries that separately. The traditional
 * techniques — dignity scoring, profection, firdaria — need the classical
 * assignment.
 */
export const DOMICILE = [
    Body.Mars, // Koç
    Body.Venus, // Boğa
    Body.Mercury, // İkizler
    Body.Moon, // Yengeç
    Body.Sun, // Aslan
    Body.Mercury, // Başak
    Body.Venus, // Terazi
    Body.Mars, // Akrep
    Body.Jupiter, // Yay
    Body.Saturn, // Oğlak
    Body.Saturn, // Kova
    Body.Jupiter, // Balık
];
/** The modern outer-planet assignments. Differs from traditional in three signs. */
export const MODERN_RULERS = DOMICILE.map((ruler, sign) => sign === 7 ? Body.Pluto : sign === 10 ? Body.Uranus : sign === 11 ? Body.Neptune : ruler);
/** Exaltation degrees: body to absolute longitude (0 = 0° Aries). */
export const EXALTATION = {
    [Body.Sun]: 19, // 19° Koç
    [Body.Moon]: 33, // 3° Boğa
    [Body.Mercury]: 165, // 15° Başak
    [Body.Venus]: 357, // 27° Balık
    [Body.Mars]: 298, // 28° Oğlak
    [Body.Jupiter]: 105, // 15° Yengeç
    [Body.Saturn]: 201, // 21° Terazi
};
/** Dorothean triplicity rulers: element to [day, night, participating]. */
const TRIPLICITY = [
    [Body.Sun, Body.Jupiter, Body.Saturn], // ateş: Koç, Aslan, Yay
    [Body.Venus, Body.Moon, Body.Mars], // toprak: Boğa, Başak, Oğlak
    [Body.Saturn, Body.Mercury, Body.Jupiter], // hava: İkizler, Terazi, Kova
    [Body.Venus, Body.Mars, Body.Moon], // su: Yengeç, Akrep, Balık
];
/**
 * The Egyptian terms (bounds). Five divisions per sign, each `[ruler, end°]`.
 * End degrees are within the sign (0–30) and the last always ends at 30.
 */
const EGYPTIAN_TERMS = [
    [[Body.Jupiter, 6], [Body.Venus, 12], [Body.Mercury, 20], [Body.Mars, 25], [Body.Saturn, 30]],
    [[Body.Venus, 8], [Body.Mercury, 14], [Body.Jupiter, 22], [Body.Saturn, 27], [Body.Mars, 30]],
    [[Body.Mercury, 6], [Body.Jupiter, 12], [Body.Venus, 17], [Body.Mars, 24], [Body.Saturn, 30]],
    [[Body.Mars, 7], [Body.Venus, 13], [Body.Mercury, 19], [Body.Jupiter, 26], [Body.Saturn, 30]],
    [[Body.Jupiter, 6], [Body.Venus, 11], [Body.Saturn, 18], [Body.Mercury, 24], [Body.Mars, 30]],
    [[Body.Mercury, 7], [Body.Venus, 17], [Body.Jupiter, 21], [Body.Mars, 28], [Body.Saturn, 30]],
    [[Body.Saturn, 6], [Body.Mercury, 14], [Body.Jupiter, 21], [Body.Venus, 28], [Body.Mars, 30]],
    [[Body.Mars, 7], [Body.Venus, 11], [Body.Mercury, 19], [Body.Jupiter, 24], [Body.Saturn, 30]],
    [[Body.Jupiter, 12], [Body.Venus, 17], [Body.Mercury, 21], [Body.Saturn, 26], [Body.Mars, 30]],
    [[Body.Mercury, 7], [Body.Jupiter, 14], [Body.Venus, 22], [Body.Saturn, 26], [Body.Mars, 30]],
    [[Body.Mercury, 7], [Body.Venus, 13], [Body.Jupiter, 20], [Body.Mars, 25], [Body.Saturn, 30]],
    [[Body.Venus, 12], [Body.Jupiter, 16], [Body.Mercury, 19], [Body.Mars, 28], [Body.Saturn, 30]],
];
/**
 * The faces (decans) — 10° divisions cycling through the Chaldean order.
 *
 * The sequence runs Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon, and the
 * first face of Aries starts with Mars. The table is generated from the
 * sequence rather than written out: thirty-six hand-typed entries invite a
 * silent ordering error.
 */
const CHALDEAN_ORDER = [
    Body.Saturn, Body.Jupiter, Body.Mars, Body.Sun,
    Body.Venus, Body.Mercury, Body.Moon,
];
/** The first face of Aries is Mars — index 2 in the Chaldean sequence. */
const FIRST_FACE_INDEX = 2;
export const FACES = Array.from({ length: 36 }, (_, i) => CHALDEAN_ORDER[(FIRST_FACE_INDEX + i) % 7]);
const norm = (d) => ((d % 360) + 360) % 360;
/** A sign's element: 0 fire, 1 earth, 2 air, 3 water. */
export const elementOf = (signIndex) => signIndex % 4;
const SCORES = {
    domicile: 5, exaltation: 4, triplicity: 3, term: 2, face: 1,
    detriment: -5, fall: -4, peregrine: 0,
};
/**
 * Evaluates a body's essential dignities at a given longitude.
 *
 * Only meaningful for the classical seven; the outer planets have no place in
 * the traditional tables and come back with an empty `dignities` list.
 */
export function evaluateDignities(body, longitude, sect) {
    const lon = norm(longitude);
    const signIndex = Math.floor(lon / 30);
    const degreeInSign = lon - signIndex * 30;
    const domicileRuler = DOMICILE[signIndex];
    const element = elementOf(signIndex);
    const triplicityRuler = TRIPLICITY[element][sect === 'day' ? 0 : 1];
    const termRuler = EGYPTIAN_TERMS[signIndex]
        .find(([, end]) => degreeInSign < end)?.[0]
        ?? EGYPTIAN_TERMS[signIndex][4][0];
    const faceRuler = FACES[signIndex * 3 + Math.min(2, Math.floor(degreeInSign / 10))];
    const dignities = [];
    if (domicileRuler === body)
        dignities.push('domicile');
    else if (DOMICILE[(signIndex + 6) % 12] === body)
        dignities.push('detriment');
    const exaltationDegree = EXALTATION[body];
    if (exaltationDegree !== undefined) {
        if (Math.floor(exaltationDegree / 30) === signIndex)
            dignities.push('exaltation');
        else if (Math.floor(norm(exaltationDegree + 180) / 30) === signIndex)
            dignities.push('fall');
    }
    if (triplicityRuler === body)
        dignities.push('triplicity');
    if (termRuler === body)
        dignities.push('term');
    if (faceRuler === body)
        dignities.push('face');
    const positive = dignities.filter((d) => SCORES[d] > 0);
    if (positive.length === 0 && !dignities.includes('detriment') && !dignities.includes('fall')) {
        dignities.push('peregrine');
    }
    return {
        body, longitude: lon, signIndex, sign: SIGNS[signIndex], degreeInSign,
        domicileRuler, triplicityRuler, termRuler, faceRuler,
        dignities,
        score: dignities.reduce((sum, d) => sum + SCORES[d], 0),
    };
}
/** A sign's ruler, traditional or modern. */
export function rulerOfSign(signIndex, modern = false) {
    return (modern ? MODERN_RULERS : DOMICILE)[norm(signIndex * 30) / 30];
}
/** The term divisions of a sign — for display and inspection. */
export function termsOfSign(signIndex) {
    let from = 0;
    return EGYPTIAN_TERMS[signIndex].map(([ruler, to]) => {
        const bound = { ruler, from, to };
        from = to;
        return bound;
    });
}
//# sourceMappingURL=dignities.js.map