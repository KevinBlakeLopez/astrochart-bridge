/**
 * ÜRETİLMİŞ DOSYA — elle düzenlemeyin.
 *
 * Kaynak: vendor/swisseph/swephexp.h (Swiss Ephemeris 2.10.03)
 * Üreten: tools/generate-constants.mjs
 *
 * Yeniden üretmek için: node tools/generate-constants.mjs
 */
/** Gök cisimleri. swe_calc() ipl parametresi. */
export declare const Body: {
    readonly Sun: 0;
    readonly Moon: 1;
    readonly Mercury: 2;
    readonly Venus: 3;
    readonly Mars: 4;
    readonly Jupiter: 5;
    readonly Saturn: 6;
    readonly Uranus: 7;
    readonly Neptune: 8;
    readonly Pluto: 9;
    readonly MeanNode: 10;
    readonly TrueNode: 11;
    readonly MeanApog: 12;
    readonly OscuApog: 13;
    readonly Earth: 14;
    readonly Chiron: 15;
    readonly Pholus: 16;
    readonly Ceres: 17;
    readonly Pallas: 18;
    readonly Juno: 19;
    readonly Vesta: 20;
    readonly IntpApog: 21;
    readonly IntpPerg: 22;
};
export type Body = (typeof Body)[keyof typeof Body];
/** Numaralı asteroide erişim: Body.AsteroidOffset + numara.
 *  Örn. Eris = 10000 + 136199. Her asteroid ayrı dosya ister
 *  ve asteroidlerde Moshier'e sessiz düşüş YOKTUR — analitik teori yok. */
export declare const AsteroidOffset = 10000;
/** Kurgusal cisimler (Witte/Sieggrün uranyen gezegenler, Transpluto vb.):
 *  FictitiousOffset + seorbel.txt içindeki sıra numarası. */
export declare const FictitiousOffset = 40;
/** Gezegen uydularına erişim: PlanetMoonOffset + uydu numarası. */
export declare const PlanetMoonOffset = 9000;
/** swe_calc() iflag bayrakları. Bit maskesi olarak OR'lanır. */
export declare const Flag: {
    readonly Tropical: 0;
    readonly Jpleph: 1;
    readonly Swieph: 2;
    readonly Defaulteph: 2;
    readonly Moseph: 4;
    readonly Helctr: 8;
    readonly Truepos: 16;
    readonly J2000: 32;
    readonly Nonut: 64;
    readonly Speed3: 128;
    readonly Speed: 256;
    readonly Nogdefl: 512;
    readonly Noaberr: 1024;
    readonly Astrometric: 1536;
    readonly Equatorial: 2048;
    readonly Xyz: 4096;
    readonly Radians: 8192;
    readonly Baryctr: 16384;
    readonly Topoctr: 32768;
    readonly OrbelAa: 32768;
    readonly Sidereal: 65536;
    readonly Icrs: 131072;
    readonly Dpsideps1980: 262144;
    readonly Jplhor: 262144;
    readonly JplhorApprox: 524288;
    readonly CenterBody: 1048576;
    readonly TestPlmoon: 2228280;
};
export type Flag = (typeof Flag)[keyof typeof Flag];
/** Sidereal mod (ayanamsa). swe_set_sid_mode() içindir.
 * 48 mod mevcut; hangi geleneğin hangisini kullandığı
 * için docs/ dizinine bakın. */
export declare const Ayanamsa: {
    readonly FaganBradley: 0;
    readonly Lahiri: 1;
    readonly Deluce: 2;
    readonly Raman: 3;
    readonly Ushashashi: 4;
    readonly Krishnamurti: 5;
    readonly DjwhalKhul: 6;
    readonly Yukteshwar: 7;
    readonly JnBhasin: 8;
    readonly BabylKugler1: 9;
    readonly BabylKugler2: 10;
    readonly BabylKugler3: 11;
    readonly BabylHuber: 12;
    readonly BabylEtpsc: 13;
    readonly Aldebaran15tau: 14;
    readonly Hipparchos: 15;
    readonly Sassanian: 16;
    readonly Galcent0sag: 17;
    readonly J2000: 18;
    readonly J1900: 19;
    readonly B1950: 20;
    readonly Suryasiddhanta: 21;
    readonly SuryasiddhantaMsun: 22;
    readonly Aryabhata: 23;
    readonly AryabhataMsun: 24;
    readonly SsRevati: 25;
    readonly SsCitra: 26;
    readonly TrueCitra: 27;
    readonly TrueRevati: 28;
    readonly TruePushya: 29;
    readonly GalcentRgilbrand: 30;
    readonly GalequIau1958: 31;
    readonly GalequTrue: 32;
    readonly GalequMula: 33;
    readonly GalalignMardyks: 34;
    readonly TrueMula: 35;
    readonly GalcentMulaWilhelm: 36;
    readonly Aryabhata522: 37;
    readonly BabylBritton: 38;
    readonly TrueSheoran: 39;
    readonly GalcentCochrane: 40;
    readonly GalequFiorenza: 41;
    readonly ValensMoon: 42;
    readonly Lahiri1940: 43;
    readonly LahiriVp285: 44;
    readonly KrishnamurtiVp291: 45;
    readonly LahiriIcrc: 46;
    readonly User: 255;
};
export type Ayanamsa = (typeof Ayanamsa)[keyof typeof Ayanamsa];
/** Ev sistemleri. Değer, swe_houses() hsys parametresine geçen ASCII harfi.
 *  Adlar derlenmiş kütüphaneden swe_house_name() ile okundu. */
export declare const HouseSystem: {
    readonly Equal: 'A';
    readonly Alcabitius: 'B';
    readonly Campanus: 'C';
    readonly EqualMC: 'D';
    readonly CarterPoliEqu: 'F';
    readonly GauquelinSectors: 'G';
    readonly HorizonAzimut: 'H';
    readonly Sunshine: 'I';
    readonly SunshineAlt: 'i';
    readonly SavardA: 'J';
    readonly Koch: 'K';
    readonly PullenSD: 'L';
    readonly Morinus: 'M';
    readonly Equal1Aries: 'N';
    readonly Porphyry: 'O';
    readonly Placidus: 'P';
    readonly PullenSR: 'Q';
    readonly Regiomontanus: 'R';
    readonly Sripati: 'S';
    readonly PolichPage: 'T';
    readonly KrusinskiPisaGoelzer: 'U';
    readonly EqualVehlow: 'V';
    readonly EqualWholeSign: 'W';
    readonly AxialRotationSystemMeridianHouses: 'X';
    readonly APCHouses: 'Y';
};
export type HouseSystem = (typeof HouseSystem)[keyof typeof HouseSystem];
/** Aynı sistemi gösteren alternatif kodlar. Swiss Ephemeris ikisini de kabul
 *  eder; girdi normalleştirmek için kullanın. */
export declare const HOUSE_SYSTEM_ALIASES: Record<string, string>;
/** Her geçerli kod için insan-okunur ad (diğer-adlar dahil). */
export declare const HOUSE_SYSTEM_NAMES: Record<string, string>;
/** Takvim seçimi. swe_julday() / swe_revjul() içindir. */
export declare const Calendar: {
    readonly Julian: 0;
    readonly Gregorian: 1;
};
export type Calendar = (typeof Calendar)[keyof typeof Calendar];
/** Doğuş / batış / kültminasyon olayları. swe_rise_trans() rsmi parametresi.
 * Olaylardan BİRİ seçilir, SE_BIT_* değiştiricileri OR'lanır. */
export declare const RiseTransit: {
    readonly Rise: 1;
    readonly Set: 2;
    readonly UpperCulmination: 4;
    readonly LowerCulmination: 8;
    readonly DiscCenter: 256;
    readonly DiscBottom: 8192;
    readonly FixedDiscSize: 16384;
    readonly NoRefraction: 512;
    readonly GeocentricNoEclipticLatitude: 128;
    readonly CivilTwilight: 1024;
    readonly NauticalTwilight: 2048;
    readonly AstronomicalTwilight: 4096;
    readonly HinduRising: 896;
};
export type RiseTransit = (typeof RiseTransit)[keyof typeof RiseTransit];
/** Tutulma tipleri ve görünürlük bayrakları. swe_*_eclipse_* dönüş değeri.
 * DİKKAT: 8192 ve 16384 bağlama göre iki anlama geliyor — ay tutulmasında
 * yarıgölge başlangıcı/bitişi, örtülmede (occultation) olayın gündüz
 * başlaması/bitmesi. Aynı bit, farklı çağrı, farklı anlam. */
export declare const EclipseFlag: {
    readonly Central: 1;
    readonly NonCentral: 2;
    readonly Total: 4;
    readonly Annular: 8;
    readonly Partial: 16;
    readonly AnnularTotal: 32;
    readonly Penumbral: 64;
    readonly AllSolarTypes: 63;
    readonly AllLunarTypes: 84;
    readonly Visible: 128;
    readonly MaxVisible: 256;
    readonly PartialBeginVisible: 512;
    readonly TotalBeginVisible: 1024;
    readonly TotalEndVisible: 2048;
    readonly PartialEndVisible: 4096;
    readonly PenumbralBeginVisible: 8192;
    readonly PenumbralEndVisible: 16384;
    readonly OneTry: 32768;
};
export type EclipseFlag = (typeof EclipseFlag)[keyof typeof EclipseFlag];
/** Heliacal olay tipi. swe_heliacal_ut() TypeEvent parametresi. */
export declare const HeliacalEvent: {
    readonly HeliacalRising: 1;
    readonly HeliacalSetting: 2;
    readonly EveningFirst: 3;
    readonly MorningLast: 4;
    readonly AcronychalRising: 5;
    readonly AcronychalSetting: 6;
};
export type HeliacalEvent = (typeof HeliacalEvent)[keyof typeof HeliacalEvent];
/** swe_heliacal_ut() iflag değiştiricileri. Efemeris bayrağıyla OR'lanır. */
export declare const HeliacalFlag: {
    readonly LongSearch: 128;
    readonly HighPrecision: 256;
    readonly OpticalParams: 512;
    readonly NoDetails: 1024;
    readonly SearchOnePeriod: 2048;
    readonly VisibilityLimitDark: 4096;
    readonly VisibilityLimitNoMoon: 8192;
    readonly VisibilityLimitPhotopic: 16384;
    readonly VisibilityLimitScotopic: 32768;
    readonly AverageVisibility: 65536;
};
export type HeliacalFlag = (typeof HeliacalFlag)[keyof typeof HeliacalFlag];
/** swe_calc() bunu bir cisim gibi alıp eğikliği ve nutasyonu döndürüyor.
 *  Cisim değil; -1 özel bir kimlik (SE_ECL_NUT). */
export declare const EclipticNutationId = -1;
//# sourceMappingURL=constants.d.ts.map