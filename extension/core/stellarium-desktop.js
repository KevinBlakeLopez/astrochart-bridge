// Stellarium Desktop's Remote Control plugin, in terms of a decided sky. The
// requests and the status fields were read from the plugin's source in
// Stellarium v25.1 (plugins/RemoteControl/src). Nothing here talks to the
// network: ../stellarium-desktop.js sends the requests.

// The plugin's default port. AstroChart Bridge only ever talks to this machine.
export const PORT = 8090;

// Julian Day of 1970-01-01T00:00:00Z, the start of JavaScript's clock.
const JD_UNIX_EPOCH = 2440587.5;
const DAY_MS = 86_400_000;

// Stellarium counts days before 1582-10-15 in the Julian calendar, and
// JavaScript in the Gregorian, so earlier dates would mean different days.
// After 9999, toISOString writes a six-digit year that no destination reads.
const FIRST_JD = 2299160.5; // 1582-10-15T00:00:00Z
const END_JD = 5373484.5; // 10000-01-01T00:00:00Z

// The same form stellariumUrl and astroSeekUrl take.
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

// setJD's argument and status's jday are both Julian Days in UT, not TT.
// Comparing times allows a second each way, for the clock pausing a frame late.
const TIME_TOLERANCE_DAYS = 1 / 86_400;
// The plugin keeps latitude and longitude as single-precision floats, good to
// about 0.00001°. 0.0001° is about 11 m.
const DEGREE_TOLERANCE = 1e-4;

const refused = (reason) => ({ kind: "refused", reason });

/**
 * The Julian Day (UT) of a UTC instant. Throws when utc isn't
 * YYYY-MM-DDTHH:MM:SSZ, like stellariumUrl.
 *
 * @param {string} utc
 * @returns {number}
 */
export function julianDay(utc) {
  if (typeof utc !== "string" || !UTC_INSTANT.test(utc)) {
    throw new Error(`julianDay needs a UTC instant like 2024-04-17T12:00:00Z, got ${utc}`);
  }
  return Date.parse(utc) / DAY_MS + JD_UNIX_EPOCH;
}

/**
 * The UTC instant of a Julian Day (UT), to the nearest second.
 *
 * @param {number} jd
 * @returns {string}
 */
export function utcFromJulianDay(jd) {
  const ms = Math.round(((jd - JD_UNIX_EPOCH) * DAY_MS) / 1000) * 1000;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * The parts of GET /api/main/status that AstroChart Bridge uses, or null when the
 * response isn't shaped like Stellarium's. Whatever answers on the port is
 * checked like any page text before anything is read from it.
 *
 * @param {unknown} json  the parsed response body
 * @returns {{ jday: number, timerate: number, lat: number, lng: number, planet: string, name: string | null } | null}
 */
export function readStatus(json) {
  const time = json?.time;
  const location = json?.location;
  if (typeof time !== "object" || time === null || typeof location !== "object" || location === null) return null;
  const { jday, timerate } = time;
  const { latitude: lat, longitude: lng, planet, name } = location;
  if (![jday, timerate, lat, lng].every(Number.isFinite)) return null;
  if (!onGlobe(lat, lng) || typeof planet !== "string") return null;
  return { jday, timerate, lat, lng, planet, name: typeof name === "string" ? name : null };
}

/**
 * The sky Stellarium is showing, in the same form every destination takes.
 * Its own place name and time zone are left behind: the destinations take
 * coordinates and UTC.
 *
 * @param {NonNullable<ReturnType<typeof readStatus>>} status
 * @returns {{ kind: "sky", sky: { utc: string, lat: number, lng: number } }
 *   | { kind: "refused", reason: "stellarium-not-earth" | "stellarium-date-out-of-range" }}
 */
export function skyFromStatus({ jday, lat, lng, planet }) {
  if (planet !== "Earth") return refused("stellarium-not-earth");
  if (!inRange(jday)) return refused("stellarium-date-out-of-range");
  return { kind: "sky", sky: { utc: utcFromJulianDay(jday), lat: degrees(lat), lng: degrees(lng) } };
}

/**
 * The POSTs that put a sky on Stellarium, in the order to send them. The clock
 * is paused before the time is set, so the time can't run on between the two;
 * the place is sent with no name, and Stellarium names it by its coordinates.
 * Its view, landscape, planet and time zone are left as they are.
 *
 * params go in the query string. Stellarium 25.1.0 read a form body only
 * when the header was spelled "Content-Length", and fetch in Node sends
 * content-length; the query string is read whatever the client's spelling.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @returns {{ kind: "requests", requests: { path: string, params: URLSearchParams }[] }
 *   | { kind: "refused", reason: "invalid-coordinates" | "stellarium-date-out-of-range" }}
 */
export function transferRequests({ utc, lat, lng }) {
  if (!onGlobe(lat, lng)) return refused("invalid-coordinates");
  const jd = julianDay(utc);
  if (!inRange(jd)) return refused("stellarium-date-out-of-range");
  return {
    kind: "requests",
    requests: [
      { path: "/api/main/time", params: new URLSearchParams({ timerate: "0" }) },
      { path: "/api/location/setlocationfields", params: new URLSearchParams({ latitude: String(lat), longitude: String(lng) }) },
      { path: "/api/main/time", params: new URLSearchParams({ time: String(jd) }) },
    ],
  };
}

/**
 * What Stellarium's status shows differently from the sky that was sent, or
 * an empty list. The plugin answers "ok" even when it ignored a value, so only
 * this says whether a transfer worked.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {NonNullable<ReturnType<typeof readStatus>>} status
 * @returns {("time" | "clock-running" | "latitude" | "longitude")[]}
 */
export function checkApplied({ utc, lat, lng }, status) {
  const mismatches = [];
  if (Math.abs(status.jday - julianDay(utc)) > TIME_TOLERANCE_DAYS) mismatches.push("time");
  if (status.timerate !== 0) mismatches.push("clock-running");
  if (Math.abs(status.lat - lat) > DEGREE_TOLERANCE) mismatches.push("latitude");
  if (Math.abs(status.lng - lng) > DEGREE_TOLERANCE) mismatches.push("longitude");
  return mismatches;
}

/**
 * Whether a response's Server header is the one Stellarium's plugin sets on
 * every response. Another program could listen on the port; this tells
 * AstroChart Bridge it isn't talking to Stellarium, not that it is.
 *
 * @param {string | null} header
 * @returns {boolean}
 */
export function isStellariumServer(header) {
  return typeof header === "string" && header.startsWith("Stellarium RemoteControl");
}

const onGlobe = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const inRange = (jd) => jd >= FIRST_JD && jd < END_JD;

// status widens the plugin's float to a double, so 151.2 comes back as
// 151.1999969482422. This is the shortest decimal with the same float, capped
// at readChart's 6 decimals. "+ 0" turns -0 into 0.
function degrees(value) {
  for (let digits = 1; digits < 17; digits += 1) {
    const shortest = Number(value.toPrecision(digits));
    if (Math.fround(shortest) === value) return Math.round(shortest * 1e6) / 1e6 + 0;
  }
  return Math.round(value * 1e6) / 1e6 + 0;
}
