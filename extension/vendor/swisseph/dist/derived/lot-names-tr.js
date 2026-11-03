/**
 * Turkish names and notes for the built-in lots.
 *
 * The lot definitions themselves are English, because they are **data that
 * leaves the process**: `LotResult.name`, `.source` and `.note` end up in a
 * caller's UI, in an MCP answer handed to a model, and in error messages. The
 * package is published to npm in English, so a Turkish string in that path is
 * undiagnosable for most of the people reading it.
 *
 * That is a separate question from whether the Turkish is worth keeping — it
 * is, and this file keeps it. Nothing reads this map by default; it is here for
 * a Turkish-language caller who wants it:
 *
 * ```ts
 * const lots = calculateLots(points, sect);
 * const label = LOT_NAMES_TR[lots.Fortune.key]?.name ?? lots.Fortune.name;
 * ```
 *
 * Keys match {@link ALL_LOTS}; {@link LOT_VARIANTS} entries are keyed by their
 * variant name.
 */
/** Turkish names for {@link ALL_LOTS}. */
export const LOT_NAMES_TR = {
    // --- HERMETIC_LOTS ---
    Fortune: {
        name: 'Şans Noktası',
        note: 'Bedene, sağlığa ve maddi koşullara ilişkin. Ay ile ilişkili.',
    },
    Spirit: {
        name: 'Ruh Noktası',
        note: 'Zihne, iradeye ve eyleme ilişkin. Güneş ile ilişkili.',
    },
    Eros: { name: 'Aşk Noktası' },
    Necessity: { name: 'Zorunluluk Noktası' },
    Courage: { name: 'Cesaret Noktası' },
    Victory: { name: 'Zafer Noktası' },
    Nemesis: { name: 'Nemesis Noktası' },
    // --- NON_HERMETIC_LOTS ---
    Basis: {
        name: 'Temel Noktası',
        note: 'Sekt aynası değil: iki nokta arasındaki kısa yay kullanılır. ' +
            'Bazı modern uygulamalar bunu sekt tabanlı sanıp yanlış hesaplar.',
    },
    Exaltation: {
        name: 'Yücelme Noktası',
        note: 'Sabit dereceler: gündüz Güneş\'in yücelme derecesi (19° Koç), ' +
            'gece Ay\'ınki (3° Boğa).',
    },
    Father: { name: 'Baba Noktası' },
    Mother: { name: 'Anne Noktası' },
    Siblings: {
        name: 'Kardeşler Noktası',
        note: 'Sekte bağlı değil — kaynaklarda gece için ayrı formül verilmiyor.',
    },
    Children: { name: 'Çocuklar Noktası' },
    Illness: { name: 'Hastalık Noktası' },
    Marriage: {
        name: 'Evlilik Noktası',
        note: 'Kaynaklar bu lotta belirgin biçimde ayrışıyor; bazıları cinsiyete ' +
            'göre formülü tersine çeviriyor. Kendi geleneğinizi izliyorsanız ' +
            'tanımı geçersiz kılın.',
    },
};
/** Turkish names for the {@link LOT_VARIANTS} definitions. */
export const LOT_VARIANT_NAMES_TR = {
    FortuneNoSect: {
        name: 'Şans Noktası (sektsiz)',
        note: 'Gece haritalarında sekt tabanlı formülden farklı sonuç verir.',
    },
    ChildrenReversed: {
        name: 'Çocuklar Noktası (ters)',
        note: 'Varsayılan tanımın tersi; kaynaklar bu lotta uzlaşmıyor.',
    },
    MarriageFeminine: {
        name: 'Evlilik Noktası (kadın haritası)',
        note: 'Erkek haritalarında varsayılan (Venüs − Satürn) kullanılır.',
    },
    BasisSectBased: {
        name: 'Temel Noktası (sekt tabanlı)',
        note: 'Geleneksel kısa yay kuralı yerine sekt aynası kullanır.',
    },
};
//# sourceMappingURL=lot-names-tr.js.map