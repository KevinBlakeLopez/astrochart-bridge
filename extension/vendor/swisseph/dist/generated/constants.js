/**
 * ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
 *
 * Kaynak: vendor/swisseph/swephexp.h (Swiss Ephemeris 2.10.03)
 * Üreten: tools/generate-constants.mjs
 *
 * Yeniden üretmek için: node tools/generate-constants.mjs
 */
/* eslint-disable */
/** Gök cisimleri. swe_calc() ipl parametresi. */
export const Body = {
    Sun: 0,
    Moon: 1,
    Mercury: 2,
    Venus: 3,
    Mars: 4,
    Jupiter: 5,
    Saturn: 6,
    Uranus: 7,
    Neptune: 8,
    Pluto: 9,
    MeanNode: 10,
    TrueNode: 11,
    MeanApog: 12, // Black Moon Lilith (ortalama) — cisim değil, Ay apojesi
    OscuApog: 13, // Black Moon Lilith (gerçek/oskülatör)
    Earth: 14, // yalnızca heliosentrik hesapta anlamlı
    Chiron: 15,
    Pholus: 16,
    Ceres: 17,
    Pallas: 18,
    Juno: 19,
    Vesta: 20,
    IntpApog: 21,
    IntpPerg: 22,
};
/** Numaralı asteroide erişim: Body.AsteroidOffset + numara.
 *  Örn. Eris = 10000 + 136199. Her asteroid ayrı dosya ister
 *  ve asteroidlerde Moshier'e sessiz düşüş YOKTUR — analitik teori yok. */
export const AsteroidOffset = 10000;
/** Kurgusal cisimler (Witte/Sieggrün uranyen gezegenler, Transpluto vb.):
 *  FictitiousOffset + seorbel.txt içindeki sıra numarası. */
export const FictitiousOffset = 40;
/** Gezegen uydularına erişim: PlanetMoonOffset + uydu numarası. */
export const PlanetMoonOffset = 9000;
/** swe_calc() iflag bayrakları. Bit maskesi olarak OR'lanır. */
export const Flag = {
    Tropical: 0,
    Jpleph: 1,
    Swieph: 2,
    Defaulteph: 2,
    Moseph: 4,
    Helctr: 8,
    Truepos: 16,
    J2000: 32,
    Nonut: 64,
    Speed3: 128,
    Speed: 256,
    Nogdefl: 512,
    Noaberr: 1024,
    Astrometric: 1536,
    Equatorial: 2048,
    Xyz: 4096,
    Radians: 8192,
    Baryctr: 16384,
    Topoctr: 32768,
    OrbelAa: 32768,
    Sidereal: 65536,
    Icrs: 131072,
    Dpsideps1980: 262144,
    Jplhor: 262144,
    JplhorApprox: 524288,
    CenterBody: 1048576,
    TestPlmoon: 2228280,
};
/** Sidereal mod (ayanamsa). swe_set_sid_mode() içindir.
 * 48 mod mevcut; hangi geleneğin hangisini kullandığı
 * için docs/ dizinine bakın. */
export const Ayanamsa = {
    FaganBradley: 0,
    Lahiri: 1,
    Deluce: 2,
    Raman: 3,
    Ushashashi: 4,
    Krishnamurti: 5,
    DjwhalKhul: 6,
    Yukteshwar: 7,
    JnBhasin: 8,
    BabylKugler1: 9,
    BabylKugler2: 10,
    BabylKugler3: 11,
    BabylHuber: 12,
    BabylEtpsc: 13,
    Aldebaran15tau: 14,
    Hipparchos: 15,
    Sassanian: 16,
    Galcent0sag: 17,
    J2000: 18,
    J1900: 19,
    B1950: 20,
    Suryasiddhanta: 21,
    SuryasiddhantaMsun: 22,
    Aryabhata: 23,
    AryabhataMsun: 24,
    SsRevati: 25,
    SsCitra: 26,
    TrueCitra: 27,
    TrueRevati: 28,
    TruePushya: 29,
    GalcentRgilbrand: 30,
    GalequIau1958: 31,
    GalequTrue: 32,
    GalequMula: 33,
    GalalignMardyks: 34,
    TrueMula: 35,
    GalcentMulaWilhelm: 36,
    Aryabhata522: 37,
    BabylBritton: 38,
    TrueSheoran: 39,
    GalcentCochrane: 40,
    GalequFiorenza: 41,
    ValensMoon: 42,
    Lahiri1940: 43,
    LahiriVp285: 44,
    KrishnamurtiVp291: 45,
    LahiriIcrc: 46,
    User: 255,
};
/** Ev sistemleri. Değer, swe_houses() hsys parametresine geçen ASCII harfi.
 *  Adlar derlenmiş kütüphaneden swe_house_name() ile okundu. */
export const HouseSystem = {
    Equal: 'A',
    Alcabitius: 'B',
    Campanus: 'C',
    EqualMC: 'D',
    CarterPoliEqu: 'F',
    GauquelinSectors: 'G',
    HorizonAzimut: 'H',
    Sunshine: 'I',
    SunshineAlt: 'i',
    SavardA: 'J',
    Koch: 'K',
    PullenSD: 'L',
    Morinus: 'M',
    Equal1Aries: 'N',
    Porphyry: 'O',
    Placidus: 'P',
    PullenSR: 'Q',
    Regiomontanus: 'R',
    Sripati: 'S',
    PolichPage: 'T',
    KrusinskiPisaGoelzer: 'U',
    EqualVehlow: 'V',
    EqualWholeSign: 'W',
    AxialRotationSystemMeridianHouses: 'X',
    APCHouses: 'Y',
};
/** Aynı sistemi gösteren alternatif kodlar. Swiss Ephemeris ikisini de kabul
 *  eder; girdi normalleştirmek için kullanın. */
export const HOUSE_SYSTEM_ALIASES = {
    'E': 'A',
};
/** Her geçerli kod için insan-okunur ad (diğer-adlar dahil). */
export const HOUSE_SYSTEM_NAMES = {
    'A': "equal",
    'B': "Alcabitius",
    'C': "Campanus",
    'D': "equal (MC)",
    'E': "equal",
    'F': "Carter poli-equ.",
    'G': "Gauquelin sectors",
    'H': "horizon/azimut",
    'I': "Sunshine",
    'i': "Sunshine/alt.",
    'J': "Savard-A",
    'K': "Koch",
    'L': "Pullen SD",
    'M': "Morinus",
    'N': "equal/1=Aries",
    'O': "Porphyry",
    'P': "Placidus",
    'Q': "Pullen SR",
    'R': "Regiomontanus",
    'S': "Sripati",
    'T': "Polich/Page",
    'U': "Krusinski-Pisa-Goelzer",
    'V': "equal/Vehlow",
    'W': "equal/ whole sign",
    'X': "axial rotation system/Meridian houses",
    'Y': "APC houses",
};
/** Takvim seçimi. swe_julday() / swe_revjul() içindir. */
export const Calendar = {
    Julian: 0, // Jülyen takvimi
    Gregorian: 1, // Gregoryen takvimi
};
/** Doğuş / batış / kültminasyon olayları. swe_rise_trans() rsmi parametresi.
 * Olaylardan BİRİ seçilir, SE_BIT_* değiştiricileri OR'lanır. */
export const RiseTransit = {
    Rise: 1, // SE_CALC_RISE
    Set: 2, // SE_CALC_SET
    UpperCulmination: 4, // SE_CALC_MTRANSIT — meridyen geçişi (üst)
    LowerCulmination: 8, // SE_CALC_ITRANSIT — alt meridyen geçişi
    DiscCenter: 256, // SE_BIT_DISC_CENTER — kenar yerine merkez
    DiscBottom: 8192, // SE_BIT_DISC_BOTTOM — alt kenar
    FixedDiscSize: 16384, // SE_BIT_FIXED_DISC_SIZE
    NoRefraction: 512, // SE_BIT_NO_REFRACTION — atmosferik kırılmayı yok say
    GeocentricNoEclipticLatitude: 128, // SE_BIT_GEOCTR_NO_ECL_LAT
    CivilTwilight: 1024, // SE_BIT_CIVIL_TWILIGHT — Güneş -6°
    NauticalTwilight: 2048, // SE_BIT_NAUTIC_TWILIGHT — Güneş -12°
    AstronomicalTwilight: 4096, // SE_BIT_ASTRO_TWILIGHT — Güneş -18°
    HinduRising: 896, // SE_BIT_HINDU_RISING — merkez + kırılmasız + geosentrik
};
/** Tutulma tipleri ve görünürlük bayrakları. swe_*_eclipse_* dönüş değeri.
 * DİKKAT: 8192 ve 16384 bağlama göre iki anlama geliyor — ay tutulmasında
 * yarıgölge başlangıcı/bitişi, örtülmede (occultation) olayın gündüz
 * başlaması/bitmesi. Aynı bit, farklı çağrı, farklı anlam. */
export const EclipseFlag = {
    Central: 1, // SE_ECL_CENTRAL
    NonCentral: 2, // SE_ECL_NONCENTRAL
    Total: 4, // SE_ECL_TOTAL
    Annular: 8, // SE_ECL_ANNULAR — halkalı
    Partial: 16, // SE_ECL_PARTIAL — parçalı
    AnnularTotal: 32, // SE_ECL_ANNULAR_TOTAL — hibrit; SE_ECL_HYBRID ile aynı bit
    Penumbral: 64, // SE_ECL_PENUMBRAL — yalnızca ay tutulması
    AllSolarTypes: 63, // SE_ECL_ALLTYPES_SOLAR
    AllLunarTypes: 84, // SE_ECL_ALLTYPES_LUNAR
    Visible: 128, // SE_ECL_VISIBLE
    MaxVisible: 256, // SE_ECL_MAX_VISIBLE
    PartialBeginVisible: 512, // SE_ECL_PARTBEG_VISIBLE
    TotalBeginVisible: 1024, // SE_ECL_TOTBEG_VISIBLE
    TotalEndVisible: 2048, // SE_ECL_TOTEND_VISIBLE
    PartialEndVisible: 4096, // SE_ECL_PARTEND_VISIBLE
    PenumbralBeginVisible: 8192, // SE_ECL_PENUMBBEG_VISIBLE
    PenumbralEndVisible: 16384, // SE_ECL_PENUMBEND_VISIBLE
    OneTry: 32768, // SE_ECL_ONE_TRY — aramayı tek denemede bırak
};
/** Heliacal olay tipi. swe_heliacal_ut() TypeEvent parametresi. */
export const HeliacalEvent = {
    HeliacalRising: 1, // SE_HELIACAL_RISING — sabah ilk görünüş (SE_MORNING_FIRST)
    HeliacalSetting: 2, // SE_HELIACAL_SETTING — akşam son görünüş (SE_EVENING_LAST)
    EveningFirst: 3, // SE_EVENING_FIRST — yalnızca iç gezegenler ve Ay
    MorningLast: 4, // SE_MORNING_LAST — yalnızca iç gezegenler ve Ay
    AcronychalRising: 5, // SE_ACRONYCHAL_RISING — upstream'de HENÜZ UYGULANMADI
    AcronychalSetting: 6, // SE_ACRONYCHAL_SETTING — upstream'de HENÜZ UYGULANMADI
};
/** swe_heliacal_ut() iflag değiştiricileri. Efemeris bayrağıyla OR'lanır. */
export const HeliacalFlag = {
    LongSearch: 128, // SE_HELFLAG_LONG_SEARCH — bulamazsa daha uzun ara
    HighPrecision: 256, // SE_HELFLAG_HIGH_PRECISION — yavaş
    OpticalParams: 512, // SE_HELFLAG_OPTICAL_PARAMS — dobs[] gözlemci verisini kullan
    NoDetails: 1024, // SE_HELFLAG_NO_DETAILS — yalnızca olay anı; çok daha hızlı
    SearchOnePeriod: 2048, // SE_HELFLAG_SEARCH_1_PERIOD
    VisibilityLimitDark: 4096, // SE_HELFLAG_VISLIM_DARK
    VisibilityLimitNoMoon: 8192, // SE_HELFLAG_VISLIM_NOMOON
    VisibilityLimitPhotopic: 16384, // SE_HELFLAG_VISLIM_PHOTOPIC
    VisibilityLimitScotopic: 32768, // SE_HELFLAG_VISLIM_SCOTOPIC
    AverageVisibility: 65536, // SE_HELFLAG_AV
};
/** swe_calc() bunu bir cisim gibi alıp eğikliği ve nutasyonu döndürüyor.
 *  Cisim değil; -1 özel bir kimlik (SE_ECL_NUT). */
export const EclipticNutationId = -1;
//# sourceMappingURL=constants.js.map