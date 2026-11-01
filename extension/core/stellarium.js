const BASE = "https://stellarium-web.org/";

// The one form stellarium-web.org reads as the same instant in every browser
// time zone. Without the Z it uses the browser's local time, and an unencoded
// "+" offset makes it fall back to 1858-11-17.
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/**
 * The Stellarium Web link for a decided UTC instant and place. Only date, lat
 * and lng are sent, so Stellarium keeps its default view.
 *
 * Throws when there is no decided UTC: that means the caller ran too early,
 * which is a bug, not a page problem to explain to the user.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @returns {string}
 */
export function stellariumUrl({ utc, lat, lng }) {
  if (typeof utc !== "string" || !UTC_INSTANT.test(utc)) {
    throw new Error(`stellariumUrl needs a UTC instant like 2024-04-17T12:00:00Z, got ${utc}`);
  }
  const url = new URL(BASE);
  url.search = new URLSearchParams({ date: utc, lat: String(lat), lng: String(lng) });
  return url.href;
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
