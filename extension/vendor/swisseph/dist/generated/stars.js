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
/* eslint-disable */
/** Kürasyonlu yıldızların tamamı, kadire göre sıralı (parlaktan sönüğe). */
export const CURATED_STARS = [
    { name: "Sirius", designation: "alCMa", magnitude: -1.46, groups: ["behenian", "bright"] },
    { name: "Canopus", designation: "alCar", magnitude: -0.74, groups: ["notable", "bright"] },
    { name: "Toliman", designation: "alCen", magnitude: -0.1, groups: ["notable", "bright"] },
    { name: "Arcturus", designation: "alBoo", magnitude: -0.05, groups: ["behenian", "bright"] },
    { name: "Vega", designation: "alLyr", magnitude: 0.03, groups: ["behenian", "bright"] },
    { name: "Capella", designation: "alAur", magnitude: 0.08, groups: ["behenian", "bright"] },
    { name: "Rigel", designation: "beOri", magnitude: 0.13, groups: ["notable", "bright"] },
    { name: "Procyon", designation: "alCMi", magnitude: 0.37, groups: ["behenian", "bright"] },
    { name: "Betelgeuse", designation: "alOri", magnitude: 0.42, groups: ["notable", "bright"] },
    { name: "Achernar", designation: "alEri", magnitude: 0.46, groups: ["notable", "bright"] },
    { name: "Hadar", designation: "beCen", magnitude: 0.6, groups: ["bright"] },
    { name: "Altair", designation: "alAql", magnitude: 0.76, groups: ["notable", "bright"] },
    { name: "Acrux", designation: "alCru", magnitude: 0.81, groups: ["notable", "bright"] },
    { name: "Aldebaran", designation: "alTau", magnitude: 0.86, groups: ["royal", "behenian", "bright"], meaning: "Watcher of the East — the eye of the Bull" },
    { name: "Antares", designation: "alSco", magnitude: 0.91, groups: ["royal", "behenian", "bright"], meaning: "Watcher of the West — the heart of the Scorpion" },
    { name: "Spica", designation: "alVir", magnitude: 0.97, groups: ["behenian", "bright"] },
    { name: "Pollux", designation: "beGem", magnitude: 1.14, groups: ["notable", "bright"] },
    { name: "Fomalhaut", designation: "alPsA", magnitude: 1.16, groups: ["royal", "bright"], meaning: "Watcher of the South — the mouth of the Southern Fish" },
    { name: "Deneb", designation: "alCyg", magnitude: 1.25, groups: ["notable", "bright"] },
    { name: "Mimosa", designation: "beCru", magnitude: 1.25, groups: ["bright"] },
    { name: "Regulus", designation: "alLeo", magnitude: 1.4, groups: ["royal", "behenian", "bright"], meaning: "Watcher of the North — the heart of the Lion" },
    { name: "Adara", designation: "epCMa", magnitude: 1.5, groups: ["bright"] },
    { name: "Castor", designation: "alGem", magnitude: 1.58, groups: ["notable", "bright"] },
    { name: "Shaula", designation: "laSco", magnitude: 1.62, groups: ["bright"] },
    { name: "Bellatrix", designation: "gaOri", magnitude: 1.64, groups: ["notable", "bright"] },
    { name: "Gacrux", designation: "gaCru", magnitude: 1.64, groups: ["bright"] },
    { name: "Elnath", designation: "beTau", magnitude: 1.65, groups: ["bright"] },
    { name: "Alnilam", designation: "epOri", magnitude: 1.69, groups: ["notable", "bright"] },
    { name: "Miaplacidus", designation: "beCar", magnitude: 1.69, groups: ["bright"] },
    { name: "Alnair", designation: "alGru", magnitude: 1.71, groups: ["bright"] },
    { name: "Alioth", designation: "epUMa", magnitude: 1.77, groups: ["bright"] },
    { name: "Mirfak", designation: "alPer", magnitude: 1.79, groups: ["notable", "bright"] },
    { name: "Alnitak", designation: "zeOri", magnitude: 1.79, groups: ["notable", "bright"] },
    { name: "Dubhe", designation: "alUMa", magnitude: 1.79, groups: ["bright"] },
    { name: "Suhail al Muhlif", designation: "ga-2Vel", magnitude: 1.83, groups: ["bright"] },
    { name: "Wezen", designation: "deCMa", magnitude: 1.84, groups: ["bright"] },
    { name: "Kaus Australis", designation: "epSgr", magnitude: 1.85, groups: ["bright"] },
    { name: "Alkaid", designation: "etUMa", magnitude: 1.86, groups: ["behenian", "bright"] },
    { name: "Sargas", designation: "thSco", magnitude: 1.862, groups: ["bright"] },
    { name: "Menkalinan", designation: "beAur", magnitude: 1.9, groups: ["bright"] },
    { name: "Peacock", designation: "alPav", magnitude: 1.918, groups: ["bright"] },
    { name: "Alhena", designation: "gaGem", magnitude: 1.92, groups: ["notable", "bright"] },
    { name: "Atria", designation: "alTrA", magnitude: 1.92, groups: ["bright"] },
    { name: "Alsephina", designation: "deVel", magnitude: 1.95, groups: ["bright"] },
    { name: "Avior", designation: "epCar", magnitude: 1.953, groups: ["bright"] },
    { name: "Alphard", designation: "alHya", magnitude: 1.97, groups: ["notable", "bright"] },
    { name: "Mirzam", designation: "beCMa", magnitude: 1.97, groups: ["bright"] },
    { name: "Algieba", designation: "ga-1Leo", magnitude: 1.98, groups: ["bright"] },
    { name: "Hamal", designation: "alAri", magnitude: 2.01, groups: ["notable"] },
    { name: "Polaris", designation: "alUMi", magnitude: 2.02, groups: ["notable"] },
    { name: "Mirach", designation: "beAnd", magnitude: 2.05, groups: ["notable"] },
    { name: "Alpheratz", designation: "alAnd", magnitude: 2.06, groups: ["notable"] },
    { name: "Algol", designation: "bePer", magnitude: 2.12, groups: ["behenian"] },
    { name: "Denebola", designation: "beLeo", magnitude: 2.13, groups: ["notable"] },
    { name: "Schedar", designation: "alCas", magnitude: 2.23, groups: ["notable"] },
    { name: "Alphecca", designation: "alCrB", magnitude: 2.24, groups: ["behenian"] },
    { name: "Scheat", designation: "bePeg", magnitude: 2.42, groups: ["notable"] },
    { name: "Markab", designation: "alPeg", magnitude: 2.48, groups: ["notable"] },
    { name: "Menkar", designation: "alCet", magnitude: 2.53, groups: ["notable"] },
    { name: "Zosma", designation: "deLeo", magnitude: 2.53, groups: ["notable"] },
    { name: "Zubeneshamali", designation: "beLib", magnitude: 2.62, groups: ["notable"] },
    { name: "Unukalhai", designation: "alSer", magnitude: 2.63, groups: ["notable"] },
    { name: "Zubenelgenubi", designation: "al-2Lib", magnitude: 2.75, groups: ["notable"] },
    { name: "Vindemiatrix", designation: "epVir", magnitude: 2.79, groups: ["notable"] },
    { name: "Deneb Algedi", designation: "deCap", magnitude: 2.83, groups: ["behenian"] },
    { name: "Algenib", designation: "gaPeg", magnitude: 2.84, groups: ["notable"] },
    { name: "Alcyone", designation: "etTau", magnitude: 2.87, groups: ["behenian"] },
    { name: "Sadalsuud", designation: "beAqr", magnitude: 2.89, groups: ["notable"] },
    { name: "Algorab", designation: "deCrv", magnitude: 2.94, groups: ["behenian"] },
    { name: "Sadalmelik", designation: "alAqr", magnitude: 2.94, groups: ["notable"] },
    { name: "Diadem", designation: "alCom", magnitude: 4.32, groups: ["notable"] },
    { name: "Facies", designation: "M22", magnitude: 6.17, groups: ["notable"] },
];
/** Grup başına yıldız sayısı — tanılama ve belgeler için. */
export const STAR_GROUP_COUNTS = {
    royal: 4,
    behenian: 15,
    notable: 35,
    bright: 48,
};
/** 'bright' grubunun kadir sınırı. */
export const BRIGHT_MAGNITUDE_LIMIT = 2;
//# sourceMappingURL=stars.js.map