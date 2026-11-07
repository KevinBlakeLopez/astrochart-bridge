/**
 * Aspects between chart points.
 *
 * Pure geometry over longitudes the library already computes. The interesting
 * part is not detecting a 90° separation — it is that **orb schemes genuinely
 * disagree** between traditions, and most libraries hardcode one.
 *
 * Three schemes ship here and custom ones are first-class. Orbs may be
 * attached to the aspect, to the body, or to both; all three conventions
 * exist in practice, so which one applies is an explicit choice.
 */
import { Body } from '../constants.js';
import { normalizeDegrees } from './sect.js';
/** Ptolemaic aspects — the five recognised by traditional astrology. */
export const MAJOR_ASPECTS = {
    Conjunction: { name: 'Conjunction', angle: 0, weight: 1 },
    Sextile: { name: 'Sextile', angle: 60, weight: 0.7 },
    Square: { name: 'Square', angle: 90, weight: 1 },
    Trine: { name: 'Trine', angle: 120, weight: 1 },
    Opposition: { name: 'Opposition', angle: 180, weight: 1 },
};
/** Minor aspects in common modern use. */
export const MINOR_ASPECTS = {
    SemiSextile: { name: 'Semi-sextile', angle: 30, weight: 0.3 },
    SemiSquare: { name: 'Semi-square', angle: 45, weight: 0.4 },
    Quintile: { name: 'Quintile', angle: 72, weight: 0.3 },
    Sesquiquadrate: { name: 'Sesquiquadrate', angle: 135, weight: 0.4 },
    BiQuintile: { name: 'Bi-quintile', angle: 144, weight: 0.3 },
    Quincunx: { name: 'Quincunx', angle: 150, weight: 0.5 },
};
export const ALL_ASPECTS = {
    ...MAJOR_ASPECTS,
    ...MINOR_ASPECTS,
};
/**
 * A common modern scheme: orb depends on the aspect, not the bodies.
 * Widely used in software defaults.
 */
export const MODERN_ORBS = {
    name: 'modern (by aspect)',
    byAspect: {
        Conjunction: 8, Opposition: 8, Trine: 8, Square: 7, Sextile: 6,
        Quincunx: 3, SemiSquare: 2, Sesquiquadrate: 2,
        SemiSextile: 2, Quintile: 2, BiQuintile: 2,
    },
    fallback: 2,
};
/**
 * Traditional moiety scheme: each body carries half an orb and two bodies
 * aspect when they are within the sum of their halves. The luminaries get the
 * widest orbs, which is the point of the scheme.
 */
export const TRADITIONAL_MOIETIES = {
    name: 'traditional (moieties)',
    byBody: {
        [Body.Sun]: 7.5, [Body.Moon]: 6, [Body.Mercury]: 3.5, [Body.Venus]: 3.5,
        [Body.Mars]: 4, [Body.Jupiter]: 4.5, [Body.Saturn]: 4.5,
    },
    combine: 'sum',
    fallback: 3,
};
/** A deliberately tight scheme, useful when only exact contacts matter. */
export const TIGHT_ORBS = {
    name: 'tight',
    byAspect: { Conjunction: 3, Opposition: 3, Trine: 3, Square: 3, Sextile: 2 },
    fallback: 1,
};
/**
 * Signed angular difference `b − a`, reduced to (−180, 180].
 *
 * The sign says which way round the pair sits, which is what tells an
 * applying aspect from a separating one.
 */
function signedSeparation(a, b) {
    const d = normalizeDegrees(b - a);
    return d > 180 ? d - 360 : d;
}
/** Shortest angular distance between two longitudes, 0–180. */
export function separation(a, b) {
    return Math.abs(signedSeparation(a, b));
}
function orbFor(scheme, aspectKey, from, to) {
    const byAspect = scheme.byAspect?.[aspectKey];
    if (scheme.byBody && from.body !== undefined && to.body !== undefined) {
        const a = scheme.byBody[from.body];
        const b = scheme.byBody[to.body];
        if (a !== undefined && b !== undefined) {
            switch (scheme.combine ?? 'mean') {
                case 'sum': return a + b;
                case 'max': return Math.max(a, b);
                default: return (a + b) / 2;
            }
        }
    }
    return byAspect ?? scheme.fallback;
}
/*
 * `includeSelfPairs` BURADAN KALDIRILDI.
 *
 * Tanımlıydı, JSDoc'u davranışını anlatıyordu ve findAspects onu hiç
 * okumuyordu: false geçmek de true geçmek de aynı 25 açıyı döndürüyordu.
 * Anlattığı şey (yalnızca kümeler arası karşılaştırma) zaten ayrı bir
 * fonksiyon — findAspectsBetween. Etkisiz bir seçeneği tutmak, onu ayarlayan
 * çağıranın bir şeyi kapattığını sanması demekti. Yerine gelen ayrım
 * AspectPoint.group.
 */
/**
 * Finds aspects among a set of points.
 *
 * Each unordered pair is examined once, except pairs that share a
 * {@link AspectPoint.group} — those are not independent and are skipped.
 * Results are sorted strongest first.
 *
 * ```ts
 * const aspects = findAspects([
 *   { name: 'Sun', longitude: 54.5, body: Body.Sun, speed: 0.97 },
 *   { name: 'Moon', longitude: 296.9, body: Body.Moon, speed: 12.8 },
 * ], { orbs: TRADITIONAL_MOIETIES });
 * ```
 */
export function findAspects(points, options = {}) {
    const aspects = options.aspects ?? MAJOR_ASPECTS;
    const scheme = options.orbs ?? MODERN_ORBS;
    const found = [];
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const a = points[i], b = points[j];
            if (a.group !== undefined && a.group === b.group)
                continue;
            const hit = examine(a, b, aspects, scheme);
            if (hit)
                found.push(hit);
        }
    }
    return found.sort((a, b) => b.strength - a.strength);
}
/**
 * Finds aspects between two sets — synastry, transits to a natal chart, or
 * any comparison where within-set pairs are not wanted.
 */
export function findAspectsBetween(from, to, options = {}) {
    const aspects = options.aspects ?? MAJOR_ASPECTS;
    const scheme = options.orbs ?? MODERN_ORBS;
    const found = [];
    for (const a of from) {
        for (const b of to) {
            const hit = examine(a, b, aspects, scheme);
            if (hit)
                found.push(hit);
        }
    }
    return found.sort((x, y) => y.strength - x.strength);
}
function examine(from, to, aspects, scheme) {
    const sep = separation(from.longitude, to.longitude);
    /*
     * Bir çift aynı anda tek bir açıyı sağlayabilir; iki tanım geniş bir orb
     * şemasında çakışırsa EN GÜÇLÜ olanı tutuyoruz.
     *
     * Eskiden en DAR orb'lu tutuluyordu, ki bu modülün kendi sıralama ölçütüyle
     * çelişiyordu: findAspects sonucu güce göre sıralıyor, dolayısıyla "hangi
     * açı" sorusunu orb'la, "hangisi önce" sorusunu güçle cevaplamak tutarsız.
     * Fark gerçek: geleneksel moiety şemasında Güneş–Ay çiftinin izni her açı
     * için 13.5° olduğundan 37°'lik bir ayrım hem yarım-altmışlığa (orb 7,
     * güç 0.144) hem yarım-kareye (orb 8, güç 0.163) uyuyor. Orb dar olanı,
     * güç ise güçlü olanı seçer — ikincisi listenin geri kalanıyla aynı dili
     * konuşuyor.
     *
     * Eşitlikte ilk tanım kazanıyor; MAJOR_ASPECTS başta geldiği için bu da
     * majör lehine.
     */
    let best = null;
    for (const [key, aspect] of Object.entries(aspects)) {
        const orb = Math.abs(sep - aspect.angle);
        const maxOrb = orbFor(scheme, key, from, to);
        if (orb > maxOrb)
            continue;
        const strength = (1 - orb / maxOrb) * aspect.weight;
        if (best && best.strength >= strength)
            continue;
        best = {
            aspect, from, to, separation: sep, orb, maxOrb, strength,
            ...applyingState(from, to, aspect.angle, sep),
        };
    }
    return best;
}
/**
 * Whether the aspect is applying (closing) or separating.
 *
 * The orb is `|separation − angle|`, so the aspect is applying exactly when
 * that quantity is **decreasing**. We take its derivative rather than
 * sampling:
 *
 *   d(separation)/dt = sign(Δ) · (to.speed − from.speed),  Δ = signed b − a
 *   d(orb)/dt        = sign(separation − angle) · d(separation)/dt
 *
 * This was a finite step of 0.01 days, and the step **overshot exactness**.
 * The Moon covers 0.13° in that time, so any Moon aspect closer than about
 * 0.06° to exact was pushed past perfection and reported as separating while
 * it was still applying — measured: correct at an orb of 0°03'43", inverted
 * at 0°03'40" and everything tighter. That is precisely the partile range,
 * the one horary and electional work turns on. The threshold scaled with
 * relative speed, so it silently affected the fastest pairs the most.
 *
 * The derivative has no step to overshoot. Retrograde motion and the 0/360
 * boundary still need no special case: both live in the signed difference.
 *
 * At exactness the orb is at a corner (a minimum), so `sign(0) = 0` makes
 * this report **separating** — from that instant the orb only widens.
 */
function applyingState(from, to, angle, currentSeparation) {
    if (from.speed === undefined || to.speed === undefined)
        return {};
    const delta = signedSeparation(from.longitude, to.longitude);
    const separationRate = Math.sign(delta) * (to.speed - from.speed);
    const orbRate = Math.sign(currentSeparation - angle) * separationRate;
    return { applying: orbRate < 0 };
}
//# sourceMappingURL=aspects.js.map