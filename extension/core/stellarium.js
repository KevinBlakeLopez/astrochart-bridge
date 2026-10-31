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
