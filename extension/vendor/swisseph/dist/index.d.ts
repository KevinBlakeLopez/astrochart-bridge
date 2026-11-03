/**
 * @kuntay/swisseph — Swiss Ephemeris 2.10.03, compiled to WebAssembly.
 *
 * ```ts
 * import { createSwissEph, Body, HouseSystem } from '@kuntay/swisseph';
 *
 * const swe = await createSwissEph();
 * const jd = swe.julianDay(1990, 5, 15, 14.5);
 *
 * const sun = swe.calcWithSign(jd, Body.Sun);
 * console.log(`${sun.degreeInSign.toFixed(2)}° ${sun.sign}`);
 *
 * const { ascendant, cusps } = swe.houses(jd, 41.01, 28.98, HouseSystem.Placidus);
 * swe.dispose();
 * ```
 *
 * Works with no data files at all, using the built-in Moshier theory. For
 * full precision install `@kuntay/swisseph-data` and mount it with
 * `mountEphemeris()`.
 *
 * Licensed AGPL-3.0-or-later. If you serve this over a network you are
 * obliged to release your application's source under a compatible licence;
 * otherwise you need a Swiss Ephemeris Professional License from Astrodienst.
 */
export { createSwissEph, type ReturnResult, type SwissEph } from './instance.js';
export { ASCMC, AsteroidOffset, Ayanamsa, Body, Calendar, EclipseFlag, EclipticNutationId, FictitiousOffset, Flag, HeliacalEvent, HeliacalFlag, HOUSE_SYSTEM_ALIASES, HOUSE_SYSTEM_NAMES, HouseSystem, PlanetMoonOffset, REQUIRES_EPHEMERIS_FILE, RiseTransit, SIGNS, type Sign, } from './constants.js';
export { approximateYearFromJulianDay, AUXILIARY_FILES, COVERAGE, ephemerisFileFor, requiredEphemerisFiles, type EphemerisFileKind, type RequiredFilesOptions, } from './ephemeris/files.js';
export { Asteroid, asteroidBody, asteroidFile, ASTEROID_NAMES, BUILT_IN_ASTEROIDS, POPULAR_ASTEROIDS, type AsteroidFileSpec, } from './ephemeris/asteroids.js';
export { BrowserCache, DEFAULT_CDN_BASE, FetchEphemeris, MemoryEphemeris, NodeFsEphemeris, type EphemerisCache, type EphemerisSource, type FetchEphemerisOptions, } from './ephemeris/sources.js';
export { determineSect, normalizeDegrees, type Sect, type SectMethod, type SectOptions, type SectResult, } from './derived/sect.js';
export { assignHouses, houseOf, type HousePlacement, } from './derived/houses.js';
export { ALL_LOTS, calculateLots, 
/** @deprecated Use `NON_HERMETIC_LOTS`. */
COMMON_LOTS, HERMETIC_LOTS, LOT_REQUIRED_BODIES, LOT_VARIANTS, NON_HERMETIC_LOTS, type ChartPoints, type LotDefinition, type LotFormula, type LotPoint, type LotResult, } from './derived/lots.js';
export { LOT_NAMES_TR, LOT_VARIANT_NAMES_TR, type LocalisedLot, } from './derived/lot-names-tr.js';
export { BEHENIAN_STARS, BRIGHT_MAGNITUDE_LIMIT, BRIGHT_STARS, byDesignation, CURATED_STARS, findByDesignation, findCuratedStar, NOTABLE_STARS, ROYAL_STARS, STAR_GROUP_COUNTS, starsInGroup, type CuratedStar, type StarGroup, } from './derived/stars.js';
export { DOMICILE, elementOf, evaluateDignities, EXALTATION, FACES, MODERN_RULERS, rulerOfSign, termsOfSign, TRADITIONAL_RULERS, type DignityKind, type DignityReport, } from './derived/dignities.js';
export { ALL_ASPECTS, findAspects, findAspectsBetween, MAJOR_ASPECTS, MINOR_ASPECTS, MODERN_ORBS, separation, TIGHT_ORBS, TRADITIONAL_MOIETIES, type Aspect, type AspectDefinition, type AspectPoint, type FindAspectsOptions, type OrbScheme, } from './derived/aspects.js';
export { antiscion, contraAntiscion, findAntiscia, reflect, type AntisciaContact, type AntisciaKind, type AntisciaOptions, type ReflectedPoint, } from './derived/antiscia.js';
export { findDeclinationAspects, OBLIQUITY_J2000, outOfBounds, type DeclinationAspect, type DeclinationAspectKind, type DeclinationOptions, type DeclinationPoint, type OutOfBoundsReport, } from './derived/declination.js';
export { ANGLE_EVENTS, eventSeparationMinutes, findParans, type AngleEvent, type AngleEventTimes, type ParanContact, type ParanOptions, } from './derived/parans.js';
export { EGYPTIAN_YEAR, FIRDARIA_CYCLE_YEARS, FIRDARIA_DIURNAL, FIRDARIA_NOCTURNAL, firdaria, firdariaAt, JULIAN_YEAR, LORD_BODY, profection, TROPICAL_YEAR, type FirdariaAt, type FirdariaLord, type FirdariaOptions, type FirdariaPeriod, type Profection, type ProfectionOptions, type ProfectedUnit, } from './derived/timelords.js';
export { lunarEclipseKind, solarEclipseKind, type LunarEclipse, type LunarEclipseKind, type LunarEclipseLocal, type SolarEclipse, type SolarEclipseKind, type SolarEclipseLocal, type EclipseTimings, } from './derived/eclipses.js';
export { type Atmosphere, type HeliacalResult, type Observer, } from './derived/heliacal.js';
export { SwissEphError, type CalcOptions, type CalendarDate, type EphemerisModel, type EquatorialPosition, type GeoPosition, type Houses, type Obliquity, type Position, type PositionWithSign, type StarPosition, type SwissEphOptions, } from './types.js';
/**
 * File names in the full-precision data package (1800–2399 CE, 2.05 MB).
 *
 * Load them from `@kuntay/swisseph-data` or from your own source and mount
 * them with `mountEphemeris()`. A missing file is not an error — Swiss
 * Ephemeris falls back to Moshier.
 */
export declare const DATA_PACKAGE_FILES: readonly ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1', 'sefstars.txt', 'seorbel.txt'];
//# sourceMappingURL=index.d.ts.map