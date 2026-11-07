/**
 * Arabic lots (Arabic parts).
 *
 * Swiss Ephemeris does **not** provide these — they are pure arithmetic and
 * so fall outside its scope. They are nonetheless in constant use, and there
 * is no properly done implementation on the JavaScript side.
 *
 * Every one of them has the shape `A + B − C`. The difficulty is not in the
 * formula but in two other places:
 *
 * 1. **Sect.** Most lots have day and night formulae that mirror each other.
 *    Get the sect backwards and the lot lands somewhere else entirely,
 *    without raising anything. See `sect.ts`, where the choice of method and
 *    the twilight allowance are made explicit.
 *
 * 2. **Dependencies.** Some lots refer to other lots — Eros uses the Lot of
 *    Spirit, Necessity uses Fortune. Resolve them in the wrong order and you
 *    compute against an undefined value.
 *
 * Sources disagree on some formulae. Every definition names the tradition it
 * follows in its `source` field, and you can supply your own definitions if
 * you follow a different one.
 */
import { Body, SIGNS } from '../constants.js';
import { normalizeDegrees } from './sect.js';
/**
 * The seven Hermetic lots.
 *
 * The best-documented set in the ancient sources, appearing in this form in
 * Paulus Alexandrinus and Vettius Valens. Fortune and Spirit underpin the
 * rest.
 */
export const HERMETIC_LOTS = {
    Fortune: {
        name: 'Lot of Fortune',
        day: { a: 'Ascendant', b: 'Moon', c: 'Sun' },
        night: { a: 'Ascendant', b: 'Sun', c: 'Moon' },
        source: 'Paulus Alexandrinus, Introduction 23',
        note: 'Concerns the body, health and material circumstances. ' +
            'Associated with the Moon.',
    },
    Spirit: {
        name: 'Lot of Spirit',
        day: { a: 'Ascendant', b: 'Sun', c: 'Moon' },
        night: { a: 'Ascendant', b: 'Moon', c: 'Sun' },
        source: 'Paulus Alexandrinus, Introduction 23',
        note: 'Concerns the mind, the will and action. Associated with the Sun.',
    },
    Eros: {
        name: 'Lot of Eros',
        day: { a: 'Ascendant', b: 'Venus', c: 'lot:Spirit' },
        night: { a: 'Ascendant', b: 'lot:Spirit', c: 'Venus' },
        source: 'Paulus Alexandrinus, Introduction 23',
    },
    Necessity: {
        name: 'Lot of Necessity',
        day: { a: 'Ascendant', b: 'lot:Fortune', c: 'Mercury' },
        night: { a: 'Ascendant', b: 'Mercury', c: 'lot:Fortune' },
        source: 'Paulus Alexandrinus, Introduction 23',
    },
    Courage: {
        name: 'Lot of Courage',
        day: { a: 'Ascendant', b: 'lot:Fortune', c: 'Mars' },
        night: { a: 'Ascendant', b: 'Mars', c: 'lot:Fortune' },
        source: 'Paulus Alexandrinus, Introduction 23',
    },
    Victory: {
        name: 'Lot of Victory',
        day: { a: 'Ascendant', b: 'Jupiter', c: 'lot:Spirit' },
        night: { a: 'Ascendant', b: 'lot:Spirit', c: 'Jupiter' },
        source: 'Paulus Alexandrinus, Introduction 23',
    },
    Nemesis: {
        name: 'Lot of Nemesis',
        day: { a: 'Ascendant', b: 'lot:Fortune', c: 'Saturn' },
        night: { a: 'Ascendant', b: 'Saturn', c: 'lot:Fortune' },
        source: 'Paulus Alexandrinus, Introduction 23',
    },
};
/**
 * The lots outside the Hermetic seven — chiefly from Valens.
 *
 * Sources are less consistent here than for the Hermetic seven; each one's
 * `note` field records where they diverge.
 *
 * This set is **not self-contained**: `Basis` is defined in terms of Fortune
 * and Spirit, which live in {@link HERMETIC_LOTS}. `calculateLots` resolves
 * such references from {@link ALL_LOTS}, so passing this set on its own works
 * — the two Hermetic lots are computed as intermediates and left out of the
 * result.
 */
export const NON_HERMETIC_LOTS = {
    Basis: {
        name: 'Lot of Basis',
        // day/night yalnızca tip gereği; gerçek hesap compute() içinde.
        day: { a: 'Ascendant', b: 'lot:Fortune', c: 'lot:Spirit' },
        /**
         * Temel Noktası sekt aynası DEĞİL: Şans ile Ruh arasındaki KISA yay
         * seçilir. Yani hangi formülün uygulanacağı sekte değil, iki noktanın
         * göreli konumuna bağlı — A+B−C kalıbına sığmadığı için compute() ile.
         */
        compute: (resolve) => {
            const fortune = resolve('lot:Fortune');
            const spirit = resolve('lot:Spirit');
            const ascendant = resolve('Ascendant');
            // Şans'tan Ruh'a burç yönündeki yay 180°'den küçükse o yay kullanılır.
            const arc = normalizeDegrees(spirit - fortune);
            return arc <= 180
                ? normalizeDegrees(ascendant + arc)
                : normalizeDegrees(ascendant + (360 - arc));
        },
        source: 'Hellenistic tradition (the shorter Fortune–Spirit arc)',
        note: 'Not a sect mirror: the shorter arc between the two points is used. ' +
            'Some modern implementations treat it as sect-based and get it wrong.',
    },
    Exaltation: {
        name: 'Lot of Exaltation',
        day: { a: 'Ascendant', b: { degree: 19 }, c: 'Sun' }, // 19° Aries
        night: { a: 'Ascendant', b: { degree: 33 }, c: 'Moon' }, // 3° Taurus
        source: 'Paulus Alexandrinus',
        note: 'Fixed degrees: by day the Sun\'s exaltation degree (19° Aries), ' +
            'by night the Moon\'s (3° Taurus).',
    },
    Father: {
        name: 'Lot of the Father',
        day: { a: 'Ascendant', b: 'Sun', c: 'Saturn' },
        night: { a: 'Ascendant', b: 'Saturn', c: 'Sun' },
        source: 'Vettius Valens, Anthology II',
    },
    Mother: {
        name: 'Lot of the Mother',
        day: { a: 'Ascendant', b: 'Moon', c: 'Venus' },
        night: { a: 'Ascendant', b: 'Venus', c: 'Moon' },
        source: 'Vettius Valens, Anthology II',
    },
    Siblings: {
        name: 'Lot of Siblings',
        day: { a: 'Ascendant', b: 'Jupiter', c: 'Saturn' },
        source: 'Vettius Valens, Anthology II',
        note: 'Not sect-dependent — the sources give no separate nocturnal formula.',
    },
    Children: {
        name: 'Lot of Children',
        day: { a: 'Ascendant', b: 'Saturn', c: 'Jupiter' },
        night: { a: 'Ascendant', b: 'Jupiter', c: 'Saturn' },
        source: 'Vettius Valens, Anthology II',
    },
    Illness: {
        name: 'Lot of Illness',
        day: { a: 'Ascendant', b: 'Mars', c: 'Saturn' },
        night: { a: 'Ascendant', b: 'Saturn', c: 'Mars' },
        source: 'Paulus Alexandrinus',
    },
    Marriage: {
        name: 'Lot of Marriage',
        day: { a: 'Ascendant', b: 'Venus', c: 'Saturn' },
        source: 'Traditional',
        note: 'The sources diverge markedly on this lot; some invert the formula ' +
            'by gender. Override the definition if you follow a different ' +
            'tradition.',
    },
};
/** Every lot that ships with the library. */
export const ALL_LOTS = {
    ...HERMETIC_LOTS,
    ...NON_HERMETIC_LOTS,
};
/**
 * @deprecated Renamed to {@link NON_HERMETIC_LOTS}, which says what the set
 * actually is. The old name promised "the lots in common use" while excluding
 * Fortune and Spirit — the two most common of all — because it was really
 * "everything in {@link ALL_LOTS} that is not Hermetic". Kept as an alias.
 */
export const COMMON_LOTS = NON_HERMETIC_LOTS;
/**
 * Calculates the lots.
 *
 * Dependencies resolve themselves: when a lot refers to another, that one is
 * computed first. A circular definition raises an error. A reference to a lot
 * outside `definitions` is resolved from {@link ALL_LOTS}, so any subset of the
 * built-in sets can be passed on its own; only the keys you asked for are
 * returned.
 *
 * ```ts
 * const lots = calculateLots(points, 'day');
 * lots.Fortune.longitude;
 * ```
 *
 * @param sect `'day'`, `'night'`, or the {@link SectResult} from
 *             `determineSect()`. Anything else throws — a mistyped sect must
 *             not quietly produce a day chart.
 */
export function calculateLots(points, sect, definitions = ALL_LOTS) {
    const resolvedSect = normalizeSect(sect);
    const results = {};
    /** Çözülmekte olan lotlar — döngüsel bağımlılığı yakalamak için. */
    const resolving = new Set();
    function pointValue(point) {
        if (typeof point === 'object')
            return normalizeDegrees(point.degree);
        if (point.startsWith('lot:')) {
            const key = point.slice(4);
            // Yerel değişkene alıyoruz: results[key] üzerinde doğrudan truthy
            // kontrolü yapılırsa TypeScript negatif dalı `never`'a daraltır
            // (nesne tipleri her zaman truthy sayılır) ve sonraki erişim tip
            // hatası verir.
            const cached = results[key];
            if (cached)
                return cached.longitude;
            if (resolving.has(key)) {
                throw new Error(`Circular lot dependency: ${[...resolving].join(' -> ')} -> ${key}`);
            }
            /*
             * Bağımlılığı önce geçirilen kümede, sonra ALL_LOTS'ta arıyoruz.
             *
             * ALL_LOTS'a düşmek şart, çünkü lot kümeleri bağımlılık sınırlarına göre
             * bölünmüş DEĞİL: Basis (NON_HERMETIC_LOTS) lot:Fortune ve lot:Spirit'e
             * bağlı ama o ikisi HERMETIC_LOTS'ta. Yalnızca `definitions`'a bakmak
             * COMMON_LOTS ile yapılan HER çağrıyı patlatıyordu. Kütüphanenin kendi
             * alt kümesinin kullanılamaz olması kabul edilemez.
             *
             * Sıra önemli: `definitions` önce geliyor, dolayısıyla çağıranın kendi
             * tanımı (ör. LOT_VARIANTS.FortuneNoSect) varsayılanı ezmeye devam eder.
             */
            const dependency = definitions[key] ?? ALL_LOTS[key];
            if (!dependency) {
                throw new Error(`Unknown lot reference: "${key}". It is in neither the definitions ` +
                    'passed nor ALL_LOTS.');
            }
            compute(key, dependency);
            return results[key].longitude;
        }
        switch (point) {
            case 'Ascendant': return points.ascendant;
            case 'Midheaven': return points.midheaven;
            case 'Descendant': return normalizeDegrees(points.ascendant + 180);
            case 'ImumCoeli': return normalizeDegrees(points.midheaven + 180);
            case 'Sun': return points.sun;
            case 'Moon': return points.moon;
            case 'Mercury': return points.mercury;
            case 'Venus': return points.venus;
            case 'Mars': return points.mars;
            case 'Jupiter': return points.jupiter;
            case 'Saturn': return points.saturn;
            case 'NorthNode':
            case 'SouthNode': {
                if (points.northNode === undefined) {
                    throw new Error('This lot needs the lunar node; supply ChartPoints.northNode.');
                }
                return point === 'NorthNode'
                    ? points.northNode
                    : normalizeDegrees(points.northNode + 180);
            }
            default: {
                // Tip düzeyinde erişilemez; çalışma anında yanlış girdiye karşı.
                throw new Error(`Unknown lot point: ${String(point)}`);
            }
        }
    }
    function compute(key, definition) {
        resolving.add(key);
        const sectDependent = definition.compute
            ? false // özel hesap sektten bağımsız olabilir
            : definition.night !== undefined;
        let longitude;
        if (definition.compute) {
            longitude = normalizeDegrees(definition.compute(pointValue, resolvedSect));
        }
        else {
            const formula = resolvedSect === 'night' && definition.night
                ? definition.night : definition.day;
            longitude = normalizeDegrees(pointValue(formula.a) + pointValue(formula.b) - pointValue(formula.c));
        }
        const signIndex = Math.floor(longitude / 30);
        results[key] = {
            key,
            name: definition.name,
            longitude,
            signIndex,
            sign: SIGNS[signIndex],
            degreeInSign: longitude - signIndex * 30,
            sectUsed: resolvedSect,
            sectDependent,
            source: definition.source,
            ...(definition.note ? { note: definition.note } : {}),
        };
        resolving.delete(key);
    }
    for (const [key, definition] of Object.entries(definitions)) {
        if (!(key in results))
            compute(key, definition);
    }
    /*
     * Yalnızca İSTENEN anahtarları döndürüyoruz.
     *
     * ALL_LOTS'a düşen bağımlılıklar ara değer olarak `results`'a giriyor
     * (COMMON_LOTS istendiğinde Fortune ve Spirit de hesaplanıyor). Onları da
     * döndürmek alt kümenin anlamını bozardı: "COMMON_LOTS istedim, Şans
     * Noktası neden geldi?" ALL_LOTS ve HERMETIC_LOTS için bu süzme işlemsizdir
     * — o kümelerin bağımlılıkları kendi içlerinde.
     */
    const requested = {};
    for (const key of Object.keys(definitions))
        requested[key] = results[key];
    return requested;
}
/**
 * Sekti bir kez, başta doğrula.
 *
 * Formül seçimi `sect === 'night' ? night : day` biçimindeydi, yani 'night'
 * DIŞINDAKİ her değer sessizce gündüz dalına düşüyordu: 'DAY', 'Day',
 * 'daytime' ve — en kötüsü — boş string. Eksik bir değerin hata değil
 * *varsayılan* olması, bu modülün baştan sona karşı durduğu şey.
 *
 * TypeScript tipli çağıranı zaten koruyor; açık yüzey JS tüketicileri, JSON'dan
 * gelen değerler ve determineSect()'in SectResult'ını bütün olarak geçmek.
 * Sonuncusu özellikle sinsi: bir nesne 'night' değildir, dolayısıyla gündüz
 * dalına düşer ve hiçbir şey şikâyet etmez. Onu da kabul ediyoruz.
 */
function normalizeSect(sect) {
    const value = typeof sect === 'object' && sect !== null ? sect.sect : sect;
    if (value !== 'day' && value !== 'night') {
        throw new TypeError(`sect must be 'day' or 'night' (or the SectResult from determineSect()), ` +
            `received ${JSON.stringify(sect)}`);
    }
    return value;
}
/** The bodies to gather with `swe.calc()` in order to fill in `ChartPoints`. */
export const LOT_REQUIRED_BODIES = [
    Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars,
    Body.Jupiter, Body.Saturn,
];
/**
 * Alternative formulae for the same lot, from different traditions.
 *
 * Traditional sources genuinely disagree about some lots, and astrology
 * software exposes that disagreement as a setting. Rather than pick a
 * "correct" one and hide the rest, the well-documented variants are named and
 * selectable — which also makes it possible to see **why** another program
 * gives a different answer.
 *
 * ```ts
 * calculateLots(points, sect, { ...ALL_LOTS, ...LOT_VARIANTS.FortuneNoSect });
 * ```
 */
export const LOT_VARIANTS = {
    /**
     * The Lot of Fortune **ignoring sect**: always Asc + Moon − Sun.
     *
     * The default, or an option, in most modern astrology software. It agrees
     * with the sect-based formula in diurnal charts and differs completely in
     * **nocturnal** ones. If Fortune disagrees with another program in a night
     * chart, look here first.
     */
    FortuneNoSect: {
        Fortune: {
            name: 'Lot of Fortune (without sect)',
            day: { a: 'Ascendant', b: 'Moon', c: 'Sun' },
            source: 'Modern practice — the form that makes no sect distinction',
            note: 'Differs from the sect-based formula in nocturnal charts.',
        },
        Spirit: {
            name: 'Lot of Spirit (without sect)',
            day: { a: 'Ascendant', b: 'Sun', c: 'Moon' },
            source: 'Modern practice — the form that makes no sect distinction',
        },
    },
    /**
     * The reversed formula for the Lot of Children.
     *
     * Sources disagree on this one: some give Asc + Jupiter − Saturn by day,
     * others the reverse. The default here is Saturn − Jupiter.
     */
    ChildrenReversed: {
        Children: {
            name: 'Lot of Children (reversed)',
            day: { a: 'Ascendant', b: 'Jupiter', c: 'Saturn' },
            night: { a: 'Ascendant', b: 'Saturn', c: 'Jupiter' },
            source: 'Alternative tradition',
            note: 'The reverse of the default definition; the sources do not agree ' +
                'on this lot.',
        },
    },
    /**
     * The gender-dependent form of the Lot of Marriage.
     *
     * Traditional sources invert the formula between male and female charts.
     * The default here uses a single form.
     */
    MarriageFeminine: {
        Marriage: {
            name: 'Lot of Marriage (feminine chart)',
            day: { a: 'Ascendant', b: 'Saturn', c: 'Venus' },
            source: 'Traditional — for feminine charts',
            note: 'Masculine charts use the default form (Venus − Saturn).',
        },
    },
    /**
     * The sect-based form of the Lot of Basis.
     *
     * The default applies the shorter-arc rule, which is the traditional
     * definition. Some modern implementations treat it as a sect mirror like
     * the other lots; use this variant to reproduce that behaviour.
     */
    BasisSectBased: {
        Basis: {
            name: 'Lot of Basis (sect-based)',
            day: { a: 'Ascendant', b: 'lot:Fortune', c: 'lot:Spirit' },
            night: { a: 'Ascendant', b: 'lot:Spirit', c: 'lot:Fortune' },
            source: 'Modern practice',
            note: 'Uses a sect mirror instead of the traditional shorter-arc rule.',
        },
    },
};
//# sourceMappingURL=lots.js.map