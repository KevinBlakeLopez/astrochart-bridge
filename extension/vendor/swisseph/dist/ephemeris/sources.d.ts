/**
 * Where ephemeris files come from.
 *
 * Swiss Ephemeris reads its files **synchronously** on the C side
 * (`swi_fopen`/`fread`). There is no way to await a fetch in the middle of a
 * C call, so files have to be loaded *before* any calculation. The arithmetic
 * in `files.ts` is what makes that practical: because the file a date needs
 * is known in advance, only the ~2 MB actually required is pulled from a
 * 379 MB archive.
 *
 * A missing file is not an error — Swiss Ephemeris falls back to Moshier on
 * its own. That is why `read()` may return null, and why callers do not have
 * to treat it as a failure.
 */
/** A source that can supply an ephemeris file by name. */
export interface EphemerisSource {
    /** The file's contents, or null when the source does not have it. */
    read(fileName: string): Promise<Uint8Array | null>;
    /** Name shown in diagnostic output. */
    readonly description: string;
}
/**
 * Files already in memory. Use this when you fetched them yourself — a
 * bundler import, a user upload, your own cache.
 */
export declare class MemoryEphemeris implements EphemerisSource {
    #private;
    readonly description = "memory";
    constructor(files: Record<string, Uint8Array | ArrayBuffer>);
    read(fileName: string): Promise<Uint8Array | null>;
}
export interface FetchEphemerisOptions {
    /**
     * Base URL the files sit under. Defaults to the data package's copy on
     * jsDelivr, which serves every published npm package automatically, so
     * there is no hosting cost.
     */
    baseUrl?: string;
    /**
     * Where downloaded files are kept. Without one, the browser's Cache API is
     * used; if that is unavailable, the source runs uncached and downloads
     * every time.
     */
    cache?: EphemerisCache;
    /** Replace `fetch` — for tests, a proxy, or custom headers. */
    fetchImpl?: typeof fetch;
}
/** Persistent storage for downloaded files. */
export interface EphemerisCache {
    get(key: string): Promise<Uint8Array | null>;
    set(key: string, value: Uint8Array): Promise<void>;
}
/**
 * Fetches files over HTTP, caching them when a cache is available.
 *
 * Written for the browser, but works under Node 18+ through global `fetch`.
 */
export declare class FetchEphemeris implements EphemerisSource {
    #private;
    readonly description: string;
    constructor(options?: FetchEphemerisOptions);
    read(fileName: string): Promise<Uint8Array | null>;
}
/** The data package's address on jsDelivr. */
export declare const DEFAULT_CDN_BASE = "https://cdn.jsdelivr.net/npm/@kuntay/swisseph-data/ephe";
/**
 * Reads from a real directory under Node.
 *
 * **Usually not what you want under Node.** Prefer
 * `createSwissEph({ ephemerisDirectory: '...' })`, which mounts the directory
 * through NODEFS with no copying. This class reads files into memory, which
 * means a 2 MB copy per instance.
 */
export declare class NodeFsEphemeris implements EphemerisSource {
    #private;
    readonly description: string;
    constructor(directory: string);
    read(fileName: string): Promise<Uint8Array | null>;
}
/**
 * A persistent cache built on the browser's Cache API.
 *
 * Cache API rather than IndexedDB: it is the natural interface for binary
 * data, the browser handles the quota, and the API surface is far smaller.
 * When it is unavailable — an insecure context, for instance — `create()`
 * returns null and the caller carries on without a cache.
 */
export declare class BrowserCache implements EphemerisCache {
    #private;
    private constructor();
    static create(cacheName?: string): BrowserCache | null;
    get(key: string): Promise<Uint8Array | null>;
    set(key: string, value: Uint8Array): Promise<void>;
}
//# sourceMappingURL=sources.d.ts.map