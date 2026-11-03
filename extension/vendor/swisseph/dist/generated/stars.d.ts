/**
 * ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
 *
 * Kaynak: sefstars.txt (Swiss Ephemeris sabit yıldız kataloğu)
 * Üreten: tools/generate-stars.mjs
 *
 * Adlandırma ve kadirler katalogdan okunuyor; elle yazılsalardı sessizce
 * yanlış olabilirlerdi (ilk elle yazımda Betelgeuse'un kadiri 0.42 yerine
 * 0.50 girilmişti).
 *
 * Yeniden üretmek için: node tools/generate-stars.mjs
 */
/** Bir yıldızın ait olduğu kürasyon grubu. */
export type StarGroup = 'royal' | 'behenian' | 'notable' | 'bright';
export interface CuratedStar {
    /** Katalogdaki geleneksel ad. */
    name: string;
    /**
     * Bayer/Flamsteed adlandırması, ör. "alTau".
     * Aramada bunu kullanın: katalog bazı yıldızları aynı adın farklı
     * yazımlarıyla iki kez içeriyor ve hangisinin döneceği platforma göre
     * değişebiliyor. byDesignation() bu belirsizliği kaldırır.
     */
    designation: string;
    /** Görünen kadir (V), katalogdan. */
    magnitude: number;
    /** Ait olduğu kürasyon grupları. */
    groups: StarGroup[];
    /** Geleneksel anlam — yalnızca kaynaklandırılabilir olanlarda. */
    meaning?: string;
}
/** Kürasyonlu yıldızların tamamı, kadire göre sıralı (parlaktan sönüğe). */
export declare const CURATED_STARS: readonly CuratedStar[];
/** Grup başına yıldız sayısı — tanılama ve belgeler için. */
export declare const STAR_GROUP_COUNTS: Readonly<Record<StarGroup, number>>;
/** 'bright' grubunun kadir sınırı. */
export declare const BRIGHT_MAGNITUDE_LIMIT = 2;
//# sourceMappingURL=stars.d.ts.map