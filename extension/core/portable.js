// A decided chart in a form that can leave the browser: as a link's fragment,
// a QR code or a .astrochart.json file, all the same JSON. It knows nothing of
// any site or browser API, so the extension and a page without it read it alike.
//
//   {
//     "format": "chart-bridge",
//     "version": 1,
//     "chart": {
//       "calendar": "gregorian",
//       "local": "2024-04-17T08:00:00",
//       "utcOffsetSeconds": -14400,
//       "latitude": 40.716667,
//       "longitude": -74
//     },
//     "source": { "site": "astro-seek", "via": "page", "zoneLabel": "EDT, DST", "utcBasis": "printed" }
//   }
//
// chart is what the sky depends on: the wall-clock time at the birthplace, its
// offset from UTC to the second (local-mean-time offsets run to the second),
// and degrees north and east. The UTC is worked out from them rather than
// written alongside, so the two can't disagree. Every key in chart, and at the
// top level, must be understood: a reader refuses one it doesn't know, so a
// later version's approximate time or time zone is never read as an exact time
// at this offset. A change of meaning needs a new version.
//
// source only says where the chart came from. Its fields are all optional, and
// a reader drops ones it doesn't know, so new ones can be added within a version.
//
// There are no names, place names or IANA time zones: no reader has one to give.
// Only a decided chart can be written, never one whose offset is still to be
// chosen or entered, and no unknown or approximate time.

export const FORMAT = "chart-bridge";
export const VERSION = 1;

// A chart is about 230 characters, and its fragment about 300, so these leave
// room for later source fields and refuse anything far bigger before parsing.
export const MAX_TEXT_LENGTH = 16_384;
export const MAX_FRAGMENT_LENGTH = 2_048;

const refused = (reason) => ({ kind: "refused", reason });

// The Gregorian calendar's first day. No reader has a calendar to say which an
// earlier date is in, so it isn't written as Gregorian.
const FIRST_GREGORIAN = "1582-10-15T00:00:00";

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
// The form stellariumUrl and astroSeekUrl take.
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

// -12:00 to +14:00, the range parseOffset accepts. Local mean time stays
// inside it: it is at most 12 hours from Greenwich.
const MIN_OFFSET_SECONDS = -12 * 3600;
const MAX_OFFSET_SECONDS = 14 * 3600;

const TOP_KEYS = new Set(["format", "version", "chart", "source"]);
const CHART_KEYS = new Set(["calendar", "local", "utcOffsetSeconds", "latitude", "longitude"]);

// "astro-seek", "screenshot", "printed": lower-case words joined by hyphens.
const CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isCode = (value) => typeof value === "string" && value.length <= 32 && CODE.test(value);
// "EDT, DST" as the page printed it. Control and format characters (a newline,
// a right-to-left override) are refused, since they could make the text read
// as something else.
const isLabel = (value) =>
  typeof value === "string" && value.length >= 1 && value.length <= 64 && value.isWellFormed() && !/[\p{Cc}\p{Cf}]/u.test(value);

// The known source fields, in the order they are written.
const SOURCE_FIELDS = { site: isCode, via: isCode, zoneLabel: isLabel, utcBasis: isCode };

/**
 * The portable chart for a decided sky and the wall-clock time it was decided
 * from. Refuses what a reader would refuse, so anything it returns can be shared.
 *
 * @param {{ local: string, utc: string, lat: number, lng: number }} sky  local
 *   is the wall-clock time at the birthplace; utc the instant decided for it
 * @param {{ site?: string, via?: string, zoneLabel?: string, utcBasis?: string }} [source]
 *   site is analyzePage's; via is "page" or "screenshot"; utcBasis says how the
 *   offset was decided: "printed", "declared", "zone-label" or "entered"
 * @returns {{ kind: "portable", chart: object } | { kind: "refused", reason: string }}
 */
export function toPortable({ local, utc, lat, lng }, source = {}) {
  const decided = typeof local === "string" && typeof utc === "string" && UTC_INSTANT.test(utc);
  const offsetSeconds = decided ? (Date.parse(`${local}Z`) - Date.parse(utc)) / 1000 : NaN;
  const given = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined));
  return check({
    format: FORMAT,
    version: VERSION,
    chart: { calendar: "gregorian", local, utcOffsetSeconds: offsetSeconds, latitude: lat, longitude: lng },
    source: given,
  });
}

/**
 * The chart as JSON, with its keys always in the same order, so the same chart
 * always gives the same text, link and QR code. A file is indented to be read;
 * a link isn't, to stay short. parse reads both.
 *
 * @param {object} chart  from toPortable or parse
 * @param {number} [indent]  spaces per level, as JSON.stringify takes them
 * @returns {string}
 */
export function serialize(chart, indent) {
  return JSON.stringify(canonical(chart), null, indent);
}

/**
 * Reads a chart from JSON text: a file's contents, or a decoded fragment.
 *
 * @param {string} text
 * @returns {{ kind: "portable", chart: object }
 *   | { kind: "refused", reason: "malformed" | "too-large" | "not-chart-bridge" | "unsupported-version"
 *       | "unknown-field" | "unsupported-calendar" | "invalid-date" | "before-gregorian"
 *       | "invalid-offset" | "invalid-coordinates" | "invalid-source" }}
 */
export function parse(text) {
  if (typeof text !== "string") return refused("malformed");
  if (text.length > MAX_TEXT_LENGTH) return refused("too-large");
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    return refused("malformed");
  }
  return check(document);
}

/**
 * The sky the destination links take: stellariumUrl and astroSeekUrl.
 *
 * @param {object} chart  from toPortable or parse
 * @returns {{ utc: string, lat: number, lng: number }}
 */
export function skyFor({ chart }) {
  return { utc: utcFor(chart.local, chart.utcOffsetSeconds), lat: chart.latitude, lng: chart.longitude };
}

// "v1=" then the base64url of serialize's text. The key names how the payload
// is encoded, so a later encoding can have its own.
const FRAGMENT = /^v(\d+)=(.*)$/s;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * The chart as a link's fragment, without its "#". A fragment is never sent to
 * the server that serves the page.
 *
 * @param {object} chart  from toPortable or parse
 * @returns {string}
 */
export function toFragment(chart) {
  return `v${VERSION}=${encodeBase64url(serialize(chart))}`;
}

/**
 * Reads a chart from a link's fragment, with or without its "#".
 *
 * @param {string} hash  location.hash
 * @returns {ReturnType<typeof parse>}
 */
export function fromFragment(hash) {
  if (typeof hash !== "string") return refused("malformed");
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (fragment.length > MAX_FRAGMENT_LENGTH) return refused("too-large");
  const match = FRAGMENT.exec(fragment);
  if (!match) return refused("malformed");
  const [, encoding, payload] = match;
  if (encoding !== String(VERSION)) return refused("unsupported-version");
  const text = BASE64URL.test(payload) ? decodeBase64url(payload) : null;
  return text === null ? refused("malformed") : parse(text);
}

// The parsed document as a chart, or the first thing wrong with it. Builds a
// new object from the keys it knows, so nothing else in the document survives.
function check(document) {
  if (!isObject(document)) return refused("malformed");
  if (document.format !== FORMAT) return refused("not-chart-bridge");
  if (!Number.isInteger(document.version)) return refused("malformed");
  if (document.version !== VERSION) return refused("unsupported-version");
  if (Object.keys(document).some((key) => !TOP_KEYS.has(key))) return refused("unknown-field");

  const { chart } = document;
  if (!isObject(chart)) return refused("malformed");
  if (Object.keys(chart).some((key) => !CHART_KEYS.has(key))) return refused("unknown-field");
  if (chart.calendar !== "gregorian") return refused("unsupported-calendar");
  if (!isLocalTime(chart.local)) return refused("invalid-date");
  // The fixed-width form sorts like the dates it writes.
  if (chart.local < FIRST_GREGORIAN) return refused("before-gregorian");

  const offset = chart.utcOffsetSeconds;
  if (!Number.isInteger(offset) || offset < MIN_OFFSET_SECONDS || offset > MAX_OFFSET_SECONDS) {
    return refused("invalid-offset");
  }
  // A UTC past year 9999 has no YYYY form for the destinations to take.
  if (!UTC_INSTANT.test(utcFor(chart.local, offset))) return refused("invalid-date");
  if (!isDegrees(chart.latitude, 90) || !isDegrees(chart.longitude, 180)) return refused("invalid-coordinates");

  const source = Object.hasOwn(document, "source") ? document.source : {};
  if (!isObject(source)) return refused("invalid-source");
  for (const [field, valid] of Object.entries(SOURCE_FIELDS)) {
    if (Object.hasOwn(source, field) && !valid(source[field])) return refused("invalid-source");
  }

  return { kind: "portable", chart: canonical(document) };
}

// The known keys in writing order. "+ 0" turns -0 into 0, which JSON writes
// as 0 anyway, so a chart is equal to itself after the trip.
function canonical({ chart, source = {} }) {
  return {
    format: FORMAT,
    version: VERSION,
    chart: {
      calendar: chart.calendar,
      local: chart.local,
      utcOffsetSeconds: chart.utcOffsetSeconds + 0,
      latitude: chart.latitude + 0,
      longitude: chart.longitude + 0,
    },
    source: Object.fromEntries(
      Object.keys(SOURCE_FIELDS)
        .filter((field) => Object.hasOwn(source, field))
        .map((field) => [field, source[field]]),
    ),
  };
}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const isDegrees = (value, limit) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;

function isLocalTime(text) {
  const match = LOCAL.exec(typeof text === "string" ? text : "");
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day &&
    hour <= 23 && minute <= 59 && second <= 59
  );
}

// "2024-04-17T08:00:00" at -14400 → "2024-04-17T12:00:00Z". A year past 9999
// comes out as "+010000-…", which UTC_INSTANT refuses.
const utcFor = (local, offsetSeconds) =>
  new Date(Date.parse(`${local}Z`) - offsetSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

function encodeBase64url(text) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// The text, or null when the payload isn't base64url of UTF-8.
function decodeBase64url(payload) {
  if (payload.length % 4 === 1) return null;
  try {
    const binary = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}
