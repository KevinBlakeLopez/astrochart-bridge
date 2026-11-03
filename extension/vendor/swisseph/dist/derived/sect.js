/**
 * Sect — whether a chart is diurnal or nocturnal.
 *
 * Most Arabic lots, the dignities and much of traditional technique depend on
 * it, and getting it wrong corrupts results silently: the day and night
 * formulae for the Lot of Fortune are mirror images, so an inverted sect puts
 * the lot somewhere else entirely without raising anything.
 *
 * The rule is simple — the chart is diurnal when the Sun is above the
 * horizon. There are two ways to define "above", they disagree in the edge
 * cases, and both are offered so the choice is the caller's.
 */
/**
 * Latitude of the polar circle, 90° minus the obliquity of the ecliptic.
 *
 * The ascendant-based sect rule is **exact** up to this latitude and breaks
 * down beyond it — see below.
 */
export const POLAR_CIRCLE_LATITUDE = 66.56;
/** Reduces an angle to [0, 360). */
export function normalizeDegrees(angle) {
    return ((angle % 360) + 360) % 360;
}
/**
 * Yükselen tabanlı sekt.
 *
 * Evler Yükselen'den itibaren artan boylam yönünde numaralanır ve 1.-6. evler
 * ufkun ALTINDA, 7.-12. evler üstündedir. Dolayısıyla Güneş, Asc'tan itibaren
 * ölçülen fark 180°'yi geçtiyse ufkun üstündedir.
 *
 * (Ankara 1990-05-15 14:30 UT ile doğrulandı: Asc 206.62°, Güneş 54.50°,
 *  fark 207.88° -> gündüz. Yerel saat 17:30, Mayıs — Güneş gerçekten yukarıda.)
 */
function sectFromAscendant(sunLongitude, ascendant, twilightAllowance) {
    const fromAsc = normalizeDegrees(sunLongitude - ascendant);
    // Ufuk ekseninden ekliptik boyunca ölçülen işaretli yay:
    //   0°   (Asc)  ->    0
    //   90°  (IC)   ->  -90   ufkun altında, en derin
    //   180° (Desc) ->    0
    //   270° (MC)   ->  +90   ufkun üstünde, en yüksek
    // İki doğrusal parça; ufkun altı [0,180), üstü [180,360).
    const elevation = fromAsc < 180
        ? -(90 - Math.abs(fromAsc - 90))
        : 90 - Math.abs(fromAsc - 270);
    return {
        sect: elevation >= -twilightAllowance ? 'day' : 'night',
        elevation,
    };
}
/**
 * Determines a chart's sect.
 *
 * @param sunLongitude the Sun's ecliptic longitude in degrees
 * @param ascendant    the Ascendant in degrees
 * @param sunAltitude  the Sun's true altitude; only for `method: 'altitude'`
 */
export function determineSect(sunLongitude, ascendant, options = {}) {
    // sunAltitude verilmişse varsayılan olarak onu kullan: her enlemde doğru.
    // Yalnızca boylamlar varsa yükselen kısayoluna düş.
    const method = options.method
        ?? (options.sunAltitude !== undefined ? 'altitude' : 'ascendant');
    const twilight = options.twilightAllowance ?? 0;
    if (method === 'altitude') {
        if (options.sunAltitude === undefined) {
            throw new Error("method:'altitude' needs sunAltitude — compute it with swe.horizontal().");
        }
        const elevation = options.sunAltitude;
        return {
            sect: elevation >= -twilight ? 'day' : 'night',
            sunElevation: elevation,
            method,
            borderline: Math.abs(elevation) < 1,
        };
    }
    const { sect, elevation } = sectFromAscendant(sunLongitude, ascendant, twilight);
    return {
        sect,
        sunElevation: elevation,
        method,
        borderline: Math.abs(elevation) < 1,
    };
}
//# sourceMappingURL=sect.js.map