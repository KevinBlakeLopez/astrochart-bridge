/**
 * Placing a point in a house.
 *
 * Swiss Ephemeris hands back cusps and stops there — which house a body falls
 * in is left to the caller, and the caller usually gets it wrong. The naive
 * `floor((longitude − ascendant) / 30) + 1` is right only for equal houses
 * from the Ascendant; in Placidus a house can be 60° wide and its neighbour
 * 12°, and the whole calculation has to cross 0° Aries without noticing.
 *
 * So it lives here, once, with the wrap handled by construction: a point is
 * in house *i* when the arc **forward** from cusp *i* to the point is shorter
 * than the arc forward from cusp *i* to cusp *i+1*. No comparison ever spans
 * the 0/360 boundary, so there is no boundary case to get wrong.
 */
import { normalizeDegrees } from './sect.js';
/** Every house system except Gauquelin sectors gives twelve cusps. */
const HOUSE_COUNT = 12;
/**
 * Which house a longitude falls in, 1–12.
 *
 * A point sitting exactly on a cusp belongs to the house that cusp *begins*,
 * which is the universal convention.
 *
 * ```ts
 * const { cusps } = swe.houses(jd, 39.93, 32.86, HouseSystem.Placidus);
 * const sun = swe.calc(jd, Body.Sun);
 * houseOf(sun.longitude, cusps);   // 7
 * ```
 *
 * @param cusps the twelve cusps from {@link Houses.cusps}, in zodiacal order
 * @throws when given anything other than twelve cusps covering the circle —
 *         notably Gauquelin sectors, which are 36 and run the other way
 */
export function houseOf(longitude, cusps) {
    if (cusps.length !== HOUSE_COUNT) {
        throw new Error(`houseOf() needs twelve cusps, received ${cusps.length}. ` +
            (cusps.length === 36
                ? 'Gauquelin sectors are not houses: there are 36 of them and they ' +
                    'are counted clockwise, so no house number is meaningful here.'
                : 'Pass Houses.cusps from a twelve-house system.'));
    }
    /*
     * Hedef de uçlarla AYNI dönüşümden geçiyor.
     *
     * normalizeDegrees çift yönlü: ((x % 360) + 360) % 360, yani 360 ekleyip
     * çıkarıyor ve bu bir double'ın son bitlerini oynatıyor. Ham boylamı
     * normalize edilmiş uçlarla karşılaştırmak, tam bir ev ucunda oturan cismi
     * BİR ÖNCEKİ eve düşürüyordu — birinci ev ucundaki nokta 12. ev diyordu.
     * İkisini de aynı fonksiyondan geçirince "ucun kendisi" tam olarak sıfır
     * ofset veriyor ve karşılaştırma kesinleşiyor.
     */
    const target = normalizeDegrees(longitude);
    const starts = cusps.map(normalizeDegrees);
    const widths = starts.map((start, i) => normalizeDegrees(starts[(i + 1) % HOUSE_COUNT] - start));
    /*
     * Uçlar burç yönünde sıralı DEĞİLSE genişlikler toplamı 360 çıkmıyor —
     * ters sıralı bir dizide her genişlik ~330 olur ve toplam 3960'a fırlar.
     * Böyle bir dizide arama sessizce ilk eşleşmeyi döndürür ve HER cisim
     * birinci evde görünürdü. Sessiz yanlış cevap yerine hata veriyoruz.
     */
    const total = widths.reduce((sum, w) => sum + w, 0);
    if (Math.abs(total - 360) > 1e-6) {
        throw new Error(`These cusps do not cover the circle once (they span ${total.toFixed(3)}°). ` +
            'They are probably not in zodiacal order.');
    }
    for (let i = 0; i < HOUSE_COUNT; i++) {
        if (normalizeDegrees(target - starts[i]) < widths[i])
            return i + 1;
    }
    /*
     * Genişlikler 360'ı kapladığı için buraya düşülemez; yine de sessiz bir
     * `undefined` yerine hata bırakıyoruz.
     */
    throw new Error(`${target.toFixed(6)}° fell in no house. ` +
        'This should be unreachable; please report it.');
}
/**
 * Places a whole set of points at once.
 *
 * ```ts
 * const placed = assignHouses(positions, cusps, (p) => p.longitude);
 * ```
 *
 * @param longitudeOf reads the longitude out of each point
 */
export function assignHouses(points, cusps, longitudeOf) {
    return points.map((point) => ({
        point,
        house: houseOf(longitudeOf(point), cusps),
    }));
}
//# sourceMappingURL=houses.js.map