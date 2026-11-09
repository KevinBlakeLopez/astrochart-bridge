const BASE = "https://stellarium-web.org/";

// The one form stellarium-web.org reads as the same instant in every browser
// time zone. Without the Z it uses the browser's local time, and an unencoded
// "+" offset makes it fall back to 1858-11-17.
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * The Stellarium Web link for a decided UTC instant and place. With no
 * options, only date, lat and lng are sent, so Stellarium keeps its default
 * view. Helioscope's page also sends a planet, which goes in the path and is
 * selected with the view locked on it, the observer's elevation in metres and
 * a field of view in degrees: the form docs/HELIOSCOPE_V1_FEASIBILITY.md §7
 * checked on stellarium-web.org. Each is sent only when given.
 *
 * Throws when there is no decided UTC, or an elevation or field of view that
 * isn't a finite number: that means the caller ran too early or passed
 * nonsense, which is a bug, not a page problem to explain to the user.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {{ object?: string, elevation?: number, fov?: number }} [options]
 * @returns {string}
 */
export function stellariumUrl({ utc, lat, lng }, { object, elevation, fov } = {}) {
  if (typeof utc !== "string" || !UTC_INSTANT.test(utc)) {
    throw new Error(`stellariumUrl needs a UTC instant like 2024-04-17T12:00:00Z, got ${utc}`);
  }
  for (const [name, value] of Object.entries({ elevation, fov })) {
    if (value !== undefined && !Number.isFinite(value)) throw new Error(`stellariumUrl needs a finite ${name}, got ${value}`);
  }
  const url = new URL(object === undefined ? "" : `skysource/${encodeURIComponent(object)}`, BASE);
  const params = new URLSearchParams({ date: utc, lat: String(lat), lng: String(lng) });
  if (elevation !== undefined) params.set("elev", String(elevation));
  if (fov !== undefined) params.set("fov", String(fov));
  url.search = params;
  return url.href;
}

/**
 * Whether a tab is Stellarium Web, the page whose sky can be sent to Astro-Seek.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isStellariumWeb(url) {
  try {
    return new URL(url).hostname === new URL(BASE).hostname;
  } catch {
    return false;
  }
}

// Modified Julian Date of 1970-01-01, the start of JavaScript's clock.
const MJD_UNIX_EPOCH = 40587;
const MINUTE_MS = 60_000;

/**
 * The sky Stellarium Web is showing, from its engine's state: core.utc is a
 * Modified Julian Date in UTC, core.latitude and core.longitude are radians
 * (read from stellarium-web.org, frontend 1.16.0, on 2026-10-31). The time is
 * rounded to the nearest minute, since Stellarium's clock keeps running.
 *
 * @param {{ utcMjd: number, latitudeRad: number, longitudeRad: number }} engine
 * @returns {{ utc: string, lat: number, lng: number }}
 */
export function skyFromEngine({ utcMjd, latitudeRad, longitudeRad }) {
  const ms = Math.round(((utcMjd - MJD_UNIX_EPOCH) * 86_400_000) / MINUTE_MS) * MINUTE_MS;
  return {
    utc: new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z"),
    lat: degrees(latitudeRad),
    lng: degrees(longitudeRad),
  };
}

// Rounded to 6 decimals like readChart's coordinates. "+ 0" turns -0 into 0.
const degrees = (radians) => Math.round(((radians * 180) / Math.PI) * 1e6) / 1e6 + 0;

/**
 * Runs inside the Stellarium Web page itself (world "MAIN"), where its engine
 * lives: the time and place it shows, and the name its store gives that
 * place. Firefox runs scripts there from version 128, the manifest's
 * strict_min_version. The browser copies this function into the page, so it
 * can't use anything else from this file. The path to the engine was read
 * from frontend 1.16.0. The store's currentLocation was read on
 * stellarium-web.org on 2026-11-02; only its name, country and coordinates
 * are copied. The store also keeps autoDetectedLocation, the visitor's own
 * whereabouts, which is never read.
 *
 * @returns {{ utcMjd: number, latitudeRad: number, longitudeRad: number,
 *   place: { name: string | null, country: string | null, lat: number | null, lng: number | null } | null } | null}
 */
export function readEngine() {
  const globals = document.querySelector("#app")?.__vue_app__?.config?.globalProperties;
  const core = globals?.$stel?.core;
  const engine = core && { utcMjd: core.utc, latitudeRad: core.latitude, longitudeRad: core.longitude };
  if (!engine || !Object.values(engine).every(Number.isFinite)) return null;
  const shown = globals.$store?.state?.currentLocation;
  const text = (value) => (typeof value === "string" ? value : null);
  const number = (value) => (Number.isFinite(value) ? value : null);
  const place = shown && { name: text(shown.short_name), country: text(shown.country), lat: number(shown.lat), lng: number(shown.lng) };
  return { ...engine, place: place ?? null };
}

// What Stellarium Web names a place with nothing near it, such as open sea:
// "Lat 30.000° Lon -40.000°", with the country "Unknown".
const UNNAMED = /^Lat -?\d+(\.\d+)?° Lon -?\d+(\.\d+)?°$/;

// How far the store's place may be from the engine's, in degrees, and still
// be the same place: the two keep the same coordinates, but rounded apart.
const SAME_PLACE_DEGREES = 0.001;

/**
 * The town to give astro.com's and Astro-Seek's forms for a Stellarium Web
 * sky, from the place name readEngine read, or null. Stellarium Web names
 * the coordinates it is opened at itself: a town, such as "Munich", but
 * sometimes a district ("Shinjuku"), a county ("Park County") or a village
 * ("Village of Pelham Manor"). Each form's own list then chooses the match
 * nearest the coordinates, or asks, so a name that isn't a town only means
 * the person chooses. A name for other coordinates, as when the place has
 * just changed, isn't this sky's, so it isn't used.
 *
 * @param {ReturnType<typeof readEngine>["place"]} place
 * @param {{ lat: number, lng: number }} sky  from skyFromEngine
 * @returns {string | null}
 */
export function townFromPlace(place, { lat, lng }) {
  const name = place?.name?.trim() ?? "";
  if (name === "" || UNNAMED.test(name) || place.country === "Unknown") return null;
  if (place.lat === null || place.lng === null) return null;
  if (Math.abs(place.lat - lat) > SAME_PLACE_DEGREES || Math.abs(place.lng - lng) > SAME_PLACE_DEGREES) return null;
  return name;
}
