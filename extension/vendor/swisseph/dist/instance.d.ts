import { type RequiredFilesOptions } from './ephemeris/files.js';
import type { EphemerisSource } from './ephemeris/sources.js';
import { type Sect, type SectOptions, type SectResult } from './derived/sect.js';
import { type ChartPoints, type LotDefinition, type LotResult } from './derived/lots.js';
import type { DeclinationPoint } from './derived/declination.js';
import { type AngleEventTimes, type ParanContact, type ParanOptions } from './derived/parans.js';
import { type LunarEclipse, type SolarEclipse } from './derived/eclipses.js';
import { type Atmosphere, type HeliacalResult, type Observer } from './derived/heliacal.js';
import { type CalcOptions, type CalendarDate, type EphemerisModel, type EquatorialPosition, type GeoPosition, type Houses, type Obliquity, type Position, type PositionWithSign, type StarPosition, type SwissEphOptions } from './types.js';
export type SwissEph = Awaited<ReturnType<typeof createSwissEph>>;
/** A body's return to its natal longitude. */
export interface ReturnResult {
    /** Julian day of the return, UT. */
    jd: number;
    /**
     * The longitude actually crossed. Equal to `natalLongitude` unless the
     * return was precession-corrected, in which case it has moved by the
     * precession accumulated since birth.
     */
    targetLongitude: number;
    natalLongitude: number;
    precessionCorrected: boolean;
}
/**
 * Creates an isolated Swiss Ephemeris instance.
 *
 * Every call gets its **own** WebAssembly instance, and therefore its own
 * linear memory. That is a correctness requirement rather than a
 * convenience: Swiss Ephemeris keeps all of its state in a single global
 * `swed` struct, so `swe_set_topo`, `swe_set_sid_mode` and
 * `swe_set_ephe_path` are process-wide on the C side. On a server sharing one
 * instance, the sidereal mode set by one request silently changes the answer
 * given to the next.
 *
 * Use one instance per request in concurrent code, or queue work through a
 * single instance. Creating one is not free — it compiles WebAssembly — so
 * pooling is the sensible middle ground.
 */
export declare function createSwissEph(options?: SwissEphOptions): Promise<{
    /** The vendored Swiss Ephemeris version, e.g. `"2.10.03"`. */
    readonly version: string;
    /** Direct access to the Emscripten module. An escape hatch; prefer the API. */
    readonly raw: import("*/wasm/swisseph.mjs").SwissEphWasmModule;
    /**
     * Calendar date to Julian day. The hour is read as Universal Time.
     * @param hour decimal hour, e.g. 14.5 = 14:30
     */
    julianDay(year: number, month: number, day: number, hour?: number, calendar?: number): number;
    /** Julian day back to a calendar date. The inverse of `julianDay()`. */
    calendarDate(jd: number, calendar?: number): CalendarDate;
    /** ΔT (TT − UT) in days. */
    deltaT(jd: number, ephemeris?: EphemerisModel): number;
    /**
     * A body's position, for a moment given in Universal Time.
     *
     * Check the `ephemeris` field on the result: when Swiss Ephemeris cannot
     * find the `.se1` file you asked for, it falls back to Moshier without
     * raising an error.
     */
    calc(jd: number, body: number, options?: CalcOptions): Position;
    /** `calc()` plus sign, degree-in-sign and retrograde state. */
    calcWithSign(jd: number, body: number, options?: CalcOptions): PositionWithSign;
    /** The body's name, e.g. `Body.Chiron` gives `"Chiron"`. */
    planetName(body: number): string;
    /**
     * A fixed star's position.
     * @param name traditional name (`"Aldebaran"`) or Bayer designation (`",alTau"`)
     */
    fixedStar(name: string, jd: number, options?: CalcOptions): StarPosition;
    /**
     * House cusps and angles.
     *
     * Several house systems are undefined beyond the polar circle and Swiss
     * Ephemeris substitutes Porphyry there. That is reported as
     * `substituted` rather than thrown — see {@link Houses}.
     *
     * `cusps.length` is 12 for every system except `HouseSystem.GauquelinSectors`
     * (`'G'`), which gives 36 — do not assume twelve.
     *
     * @param latitude  geographic latitude, north positive
     * @param longitude geographic longitude, east positive
     */
    houses(jd: number, latitude: number, longitude: number, system?: string, options?: CalcOptions): Houses;
    /**
     * Sect, chart points and Arabic lots for a birth moment and place.
     *
     * Gathers the positions the lots need, determines the sect, and resolves
     * the lots in dependency order — several are defined in terms of others.
     *
     * ```ts
     * const { sect, lots } = swe.lots(jd, { latitude: 39.93, longitude: 32.86 });
     * lots.Fortune.degreeInSign;
     * ```
     */
    lots(jd: number, options: {
        latitude: number;
        longitude: number;
        houseSystem?: string;
        /** Pass the sect if you determined it yourself; otherwise it is computed. */
        sect?: Sect;
        sectOptions?: SectOptions;
        definitions?: Record<string, LotDefinition>;
        calcOptions?: CalcOptions;
    }): {
        sect: SectResult & {
            overridden: boolean;
        };
        points: ChartPoints;
        lots: Record<string, LotResult>;
    };
    /**
     * A body's horizon coordinates.
     *
     * @returns `azimuth` measured from south towards west;
     *          `altitude`, the true (unrefracted) height;
     *          `apparentAltitude`, with atmospheric refraction applied
     */
    horizontal(jd: number, body: number, latitude: number, longitude: number, altitudeMetres?: number, options?: CalcOptions): {
        azimuth: number;
        altitude: number;
        apparentAltitude: number;
    };
    /**
     * Whether the chart is diurnal or nocturnal.
     *
     * Most Arabic lots and much of traditional dignity depend on this; get it
     * wrong and the results are quietly wrong rather than obviously so.
     *
     * The default uses the Sun's **true altitude**. The traditional ascendant
     * shortcut (`method: 'ascendant'`) agrees exactly up to the polar circle
     * and then breaks down — at 70° latitude it can report "night" with the
     * Sun 11° above the horizon. See `derived/sect.ts`.
     *
     * The `borderline` field marks charts where the Sun is within a degree of
     * the horizon, so a minute of uncertainty in the birth time could flip
     * the answer.
     */
    sect(jd: number, latitude: number, longitude: number, options?: SectOptions & {
        houseSystem?: string;
    }): SectResult;
    /**
     * A body's position in equatorial coordinates.
     *
     * The same call as {@link calc} with `Flag.Equatorial`, but with the
     * fields named for what they hold. Under that flag Swiss Ephemeris
     * returns right ascension where longitude normally sits and declination
     * where latitude sits, which is easy to misread.
     */
    equatorial(jd: number, body: number, options?: CalcOptions): EquatorialPosition;
    /**
     * Obliquity of the ecliptic and the nutation at a moment.
     *
     * Needed for out-of-bounds work: the limit a body has to pass is the
     * obliquity, which drifts by about 47 arcseconds per century. Using the
     * J2000 constant instead flips the verdict for any body sitting within
     * a tenth of a degree of the boundary.
     */
    obliquity(jd: number, options?: CalcOptions): Obliquity;
    /**
     * Declinations for a set of bodies, ready for
     * `findDeclinationAspects()` and `outOfBounds()`.
     *
     * ```ts
     * const points = swe.declinations(jd, [Body.Sun, Body.Moon, Body.Venus]);
     * const parallels = findDeclinationAspects(points);
     * const oob = outOfBounds(points, swe.obliquity(jd).trueObliquity);
     * ```
     */
    declinations(jd: number, bodies: readonly number[], options?: CalcOptions): DeclinationPoint[];
    /**
     * When a body or star next reaches one of the four angles.
     *
     * @param target a body constant, or a fixed star name
     * @param event  one of `RiseTransit.Rise`, `.Set`, `.UpperCulmination`,
     *               `.LowerCulmination`, optionally OR'd with the
     *               `RiseTransit` modifier bits
     *
     * A circumpolar object never rises or sets. That is not an error, and it
     * is reported as `occurs: false` rather than thrown — a chart at 70° N
     * has bodies in exactly that state and should still compute.
     */
    riseTransit(jd: number, target: number | string, place: GeoPosition, event?: number, options?: CalcOptions & {
        pressure?: number;
        temperature?: number;
    }): {
        jd: number | null;
        occurs: boolean;
    };
    /**
     * All four angle times for each object, the input parans need.
     *
     * Each event is the *next* occurrence at or after `jd`, so the four times
     * span roughly one rotation. Objects that never cross the horizon are
     * marked `circumpolar` or `neverRises` and still report their
     * culminations, which is what makes a paran with a circumpolar star
     * possible at all.
     */
    angleEvents(jd: number, targets: readonly (number | string)[], place: GeoPosition, options?: CalcOptions & {
        pressure?: number;
        temperature?: number;
    }): AngleEventTimes[];
    /**
     * Parans between a set of objects at a place.
     *
     * A convenience over {@link angleEvents} and `findParans()`; reach for
     * those two directly when you want to reuse the event times.
     *
     * ```ts
     * const contacts = swe.parans(jd, [Body.Sun, Body.Mars, 'Sirius'],
     *   { latitude: 39.93, longitude: 32.86 }, { orbMinutes: 20 });
     * ```
     */
    parans(jd: number, targets: readonly (number | string)[], place: GeoPosition, options?: ParanOptions & CalcOptions): ParanContact[];
    /**
     * The next time a body reaches a given longitude.
     *
     * The Sun and Moon use Swiss Ephemeris's own crossing routines. Everything
     * else is found by stepping and then bisecting.
     *
     * Two things to know about the general case. A planet near a station can
     * cross the same longitude three times, and this returns the **first**.
     * And a stepped search can in principle skip a pair of crossings that both
     * fall inside one step — possible only when a station sits within about
     * two degrees of the target.
     *
     * @param afterJd the search starts here and always moves forward; a
     *                crossing exactly at `afterJd` is skipped, so calling this
     *                repeatedly walks through successive crossings
     */
    nextCrossing(body: number, targetLongitude: number, afterJd: number, options?: CalcOptions & {
        maxDays?: number;
        forceSearch?: boolean;
    }): number;
    /**
     * Solar return: when the Sun comes back to its natal longitude.
     *
     * Set `precessionCorrected` to return to the same **sidereal** longitude
     * instead. The two disagree by the precession accumulated since birth —
     * roughly a day of Sun motion after thirty years — and which one is
     * correct is a live disagreement between practitioners, not a detail.
     *
     * The correction is measured with whatever sidereal mode the instance
     * currently has, since it is the *change* in ayanamsa that matters and
     * the constant offset cancels. Rates do differ slightly between models
     * though: about one arcsecond per year, which after thirty years moves
     * the corrected return by a quarter of an hour. Call `setSiderealMode()`
     * first if your tradition specifies one.
     *
     * ```ts
     * const { jd } = swe.solarReturn(natalJd, { after: swe.julianDay(2026, 1, 1) });
     * const chart = swe.houses(jd, 39.93, 32.86);
     * ```
     */
    solarReturn(natalJd: number, options?: CalcOptions & {
        after?: number;
        precessionCorrected?: boolean;
    }): ReturnResult;
    /**
     * Lunar return: when the Moon comes back to its natal longitude.
     * Roughly every 27.3 days. `precessionCorrected` works as for the solar
     * return, though over one month the correction is negligible.
     */
    lunarReturn(natalJd: number, options?: CalcOptions & {
        after?: number;
        precessionCorrected?: boolean;
    }): ReturnResult;
    /**
     * A return of any body to its natal longitude — Mars returns, Saturn
     * returns, and so on. Slow bodies need a wide search; see
     * {@link nextCrossing} for what `maxDays` does.
     */
    returnOf(body: number, natalJd: number, options?: CalcOptions & {
        after?: number;
        precessionCorrected?: boolean;
        maxDays?: number;
    }): ReturnResult;
    /**
     * The next solar eclipse.
     *
     * With no `place`, the search is global — the next eclipse anywhere,
     * optionally filtered to a type. With a `place`, it is the next eclipse
     * *visible from there*, and the result carries magnitude, obscuration and
     * the Sun's altitude at maximum.
     *
     * The two searches also return different timings, which is why they are
     * mapped to named fields here: what the C API calls `tret[4]` is the
     * start of totality in one and the fourth contact in the other.
     */
    solarEclipse(afterJd: number, options?: CalcOptions & {
        place?: GeoPosition;
        /** `EclipseFlag.Total` etc. Global searches only. */
        type?: number;
        backward?: boolean;
    }): SolarEclipse;
    /**
     * The next lunar eclipse. With a `place`, the next one visible from
     * there, carrying umbral and penumbral magnitude and the Moon's altitude.
     *
     * Note that `place.altitude` is validated by Swiss Ephemeris and an
     * implausible height is rejected outright rather than clamped.
     */
    lunarEclipse(afterJd: number, options?: CalcOptions & {
        place?: GeoPosition;
        /** `EclipseFlag.Total` etc. Global searches only. */
        type?: number;
        backward?: boolean;
    }): LunarEclipse;
    /**
     * The next heliacal event for an object — its first or last visible
     * appearance in the twilight.
     *
     * Unlike the rest of this library the answer depends on the atmosphere
     * and on the observer's eyesight, so it carries assumptions. Both are
     * typed and defaulted explicitly; see `Atmosphere` and `Observer`.
     *
     * `HeliacalEvent.EveningFirst` and `.MorningLast` apply only to the Moon
     * and the inner planets. `.AcronychalRising` and `.AcronychalSetting` are
     * declared upstream but not implemented.
     *
     * ```ts
     * const { visibilityBegin } = swe.heliacal(
     *   swe.julianDay(-3000, 7, 1), 'Sirius',
     *   { latitude: 30.0, longitude: 31.2, altitude: 20 },
     *   HeliacalEvent.HeliacalRising,
     * );
     * ```
     */
    heliacal(afterJd: number, object: string, place: GeoPosition, event: number, options?: CalcOptions & {
        atmosphere?: Atmosphere;
        observer?: Observer;
        /** `HeliacalFlag.*` bits, OR'd with the ephemeris flag. */
        heliacalFlags?: number;
    }): HeliacalResult;
    /**
     * Sets the sidereal (nirayana) mode, used together with `Flag.Sidereal`.
     * The setting is instance-wide — precisely why instances are isolated.
     */
    setSiderealMode(ayanamsa: number, t0?: number, ayanT0?: number): void;
    /** The ayanamsa for a moment, in degrees. */
    ayanamsa(jd: number, ephemeris?: EphemerisModel): number;
    /** Sets the observer's place for topocentric positions, with `Flag.Topocentric`. */
    setTopocentric(longitude: number, latitude: number, altitudeMetres?: number): void;
    /** Sets the search path for ephemeris files. */
    setEphemerisPath(path: string): void;
    /**
     * Writes ephemeris files into the virtual filesystem and sets the path.
     * @returns total bytes written
     */
    mountEphemeris(files: Record<string, Uint8Array | ArrayBuffer>, dir?: string): number;
    /**
     * Fetches and mounts the files a given date range needs.
     *
     * Files must be loaded **before** any calculation: Swiss Ephemeris reads
     * them synchronously on the C side, and there is no way to await a fetch
     * in the middle of one. Because the file a date needs is computable from
     * the date (see `ephemeris/files.ts`), only the necessary files are
     * downloaded.
     *
     * A file that cannot be found is not an error — Swiss Ephemeris falls
     * back to Moshier for that range. The result reports what was loaded and
     * what was missing.
     *
     * ```ts
     * const swe = await createSwissEph();
     * await swe.loadEphemeris(new FetchEphemeris(), {
     *   fromYear: 1900, toYear: 2100, fixedStars: true,
     * });
     * ```
     */
    loadEphemeris(source: EphemerisSource, range: RequiredFilesOptions, dir?: string): Promise<{
        loaded: string[];
        missing: string[];
        bytes: number;
    }>;
    /**
     * Node only: mounts a real directory with **no copying**.
     *
     * `mountEphemeris()` copies files into memory, and since isolation means
     * one WebAssembly instance per `createSwissEph()`, that is 2 MB per
     * instance. Under NODEFS the same directory is shared by all of them,
     * which is what a server should use.
     *
     * Throws in a browser; use `loadEphemeris()` there.
     */
    mountEphemerisDirectory(hostDirectory: string, dir?: string): void;
    /**
     * Closes open files and frees the buffers. The instance is unusable
     * afterwards.
     */
    dispose(): void;
    /** Support for `using` declarations (TypeScript 5.2+). */
    [Symbol.dispose](): void;
}>;
//# sourceMappingURL=instance.d.ts.map