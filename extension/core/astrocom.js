const ORIGIN = "https://www.astro.com";

const refused = (reason) => ({ kind: "refused", reason });

// An account chart's page draws the birth data into the chart image, but its
// "Drawing (for subscribers)" link, /cgi/sub.cgi?…&pgid=…, carries the chart's
// own URL with the birth data inline as nd=. pgid is "L", the length of the
// text that follows, "L", then that text: the chart URL in base64url. Only the
// unpadded form has been seen; the one sample needed no padding.
const DRAWING_PATH = "/cgi/sub.cgi";
const CHART_PATH = "/cgi/chart.cgi";
const PGID = /^L(\d+)L([A-Za-z0-9_-]+)$/;

/**
 * The nd= record in an account chart page's drawing link. Reads nothing but
 * the link: the page text lists every chart saved in the account.
 *
 * @param {{ url: string, links: string[] }} page  links are the addresses of
 *   the page's links that contain "pgid="
 * @returns {{ nd: string }
 *   | { kind: "refused", reason: "unsupported" | "no-drawing-link" | "ambiguous-page" | "unreadable-link" | "page-url-mismatch" }}
 */
export function readPgid({ url, links }) {
  let page;
  try {
    page = new URL(url);
  } catch {
    return refused("unsupported");
  }

  // The same pgid in two links, say with different lang= parameters, is one link.
  const pgids = new Set(links.flatMap((href) => drawingPgid(href) ?? []));
  if (pgids.size === 0) return refused("no-drawing-link");
  if (pgids.size > 1) return refused("ambiguous-page");

  const chart = unwrapPgid([...pgids][0]);
  // nd2 is the account's second chart slot, not the chart drawn, so it is never read.
  const nd = chart?.searchParams.getAll("nd") ?? [];
  if (nd.length !== 1) return refused("unreadable-link");

  return agrees(page.searchParams, chart.searchParams) ? { nd: nd[0] } : refused("page-url-mismatch");
}

// The pgid of a drawing link, or null for any other link.
function drawingPgid(href) {
  let link;
  try {
    link = new URL(href);
  } catch {
    return null;
  }
  const pgid = link.searchParams.getAll("pgid");
  return link.origin === ORIGIN && link.pathname === DRAWING_PATH && pgid.length === 1 ? pgid[0] : null;
}

// The chart URL inside a pgid, or null. atob reads unpadded base64 and gives
// one character per byte, so a non-ASCII place name comes out garbled; the
// fields Chart Bridge reads are all ASCII.
function unwrapPgid(pgid) {
  const match = PGID.exec(pgid);
  if (!match || Number(match[1]) !== match[2].length) return null;
  let chart;
  try {
    chart = new URL(atob(match[2].replaceAll("-", "+").replaceAll("_", "/")));
  } catch {
    return null;
  }
  return chart.origin === ORIGIN && chart.pathname === CHART_PATH ? chart : null;
}

// Every key both URLs carry must have the same values, and both must carry
// btyp, so the link was made for this page's chart type and settings. A key
// on one side only is fine: pages are reached by links with different extras.
// This can't show that nd is the chart the page's nhor names, since the link
// carries no nhor.
function agrees(page, chart) {
  if (!page.has("btyp") || !chart.has("btyp")) return false;
  return [...new Set(page.keys())].every(
    (key) => !chart.has(key) || JSON.stringify(page.getAll(key)) === JSON.stringify(chart.getAll(key)),
  );
}

// astro.com keeps a chart's birth data in an nd= record: comma-separated
// fields such as ",Test,e,17,4,2024,8:00,h4w,gad,0,New York,NY (US),74w00,40n43,f,45,-24500,61".
// Only the date, time, zone, field 9 and coordinates are read; names, place
// and the unexplained atlas numbers are skipped. Every form accepted here has
// been seen in a captured record, and anything else is refused, not guessed.

// Every record seen has 18 fields. A comma inside a name or place would shift
// every field after it, so any other count is refused.
const FIELD_COUNT = 18;

// Only ever seen as "gad", beside every h zone, or "gal", beside every
// local-mean-time zone. Its meaning is unknown, so it is passed on for the
// caller to judge rather than read.
const FIELD_9 = new Set(["gad", "gal"]);

// "8:00", "7:30:03"
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
// "h4w": whole hours east or west of UT, daylight saving already applied.
const ZONE_HOURS = /^h(\d{1,2})([ew])$/;
// "m10e0": local mean time at a meridian, in degrees and minutes.
const ZONE_LMT = /^m(\d{1,3})([ew])(\d{1,2})$/;
// "40n43", "74w0", "73w4859": degrees, a direction, then minutes in one or
// two digits or minutes and seconds in four.
const ANGLE = /^(\d{1,3})([nsew])(\d{1,2}|\d{4})$/;

/**
 * The birth data in an nd= record, or null when any field it reads has a
 * form not seen before. Makes no decision about what Chart Bridge supports:
 * a local-mean-time zone is returned as such.
 *
 * @param {string} record  the nd= value, already URL-decoded
 * @returns {{
 *   local: string,
 *   zone: { kind: "offset", offsetMinutes: number } | { kind: "local-mean-time", meridian: number },
 *   field9: "gad" | "gal",
 *   lat: number,
 *   lng: number,
 * } | null}
 */
export function parseNd(record) {
  const fields = record.split(",");
  if (fields.length !== FIELD_COUNT) return null;
  const [, , , day, month, year, time, zoneCode, field9, , , , lngCode, latCode] = fields;

  const date = parseDate(day, month, year);
  const clock = parseTime(time);
  const zone = parseZone(zoneCode);
  const lat = parseAngle(latCode, "n", "s", 90);
  const lng = parseAngle(lngCode, "e", "w", 180);
  if (!date || !clock || !zone || !FIELD_9.has(field9) || lat === null || lng === null) return null;

  return {
    local: `${isoDate(date)}T${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}`,
    zone,
    field9,
    lat,
    lng,
  };
}

function parseDate(day, month, year) {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{1,4}$/.test(year)) return null;
  const date = { year: Number(year), month: Number(month), day: Number(day) };
  return isCalendarDate(date) ? date : null;
}

function parseTime(text) {
  const match = TIME.exec(text);
  if (!match) return null;
  const [hour, minute, second] = [match[1], match[2], match[3] ?? "0"].map(Number);
  return hour <= 23 && minute <= 59 && second <= 59 ? { hour, minute, second } : null;
}

function parseZone(code) {
  const hours = ZONE_HOURS.exec(code);
  if (hours) {
    const [, size, side] = hours;
    // "0 - minutes" rather than "-minutes" keeps h0w at 0 instead of -0.
    const offsetMinutes = side === "e" ? Number(size) * 60 : 0 - Number(size) * 60;
    // -12 to +14 hours, the range of offsets in use today.
    return offsetMinutes >= -720 && offsetMinutes <= 840 ? { kind: "offset", offsetMinutes } : null;
  }
  const lmt = ZONE_LMT.exec(code);
  if (lmt) {
    const [, deg, side, min] = lmt;
    const meridian = degrees(Number(deg), Number(min), 0, side === "w", 180);
    return meridian === null ? null : { kind: "local-mean-time", meridian };
  }
  return null;
}

// positive and negative are the two direction letters the field may use, so
// a latitude written with "e" or "w" is refused.
function parseAngle(code, positive, negative, limit) {
  const match = ANGLE.exec(code);
  if (!match) return null;
  const [, deg, side, rest] = match;
  if (side !== positive && side !== negative) return null;
  const [min, sec] = rest.length === 4 ? [rest.slice(0, 2), rest.slice(2)] : [rest, "0"];
  return degrees(Number(deg), Number(min), Number(sec), side === negative, limit);
}

// Signed decimal degrees, rounded to 6 decimals like the Astro-Seek reader,
// or null past the limit. "0 - value" rather than "-value" keeps 0°0' on the
// negative side as 0 instead of -0.
function degrees(deg, min, sec, negative, limit) {
  if (min > 59 || sec > 59) return null;
  const value = Math.round((deg + min / 60 + sec / 3600) * 1e6) / 1e6;
  if (value > limit) return null;
  return negative ? 0 - value : value;
}

function isCalendarDate({ year, month, day }) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pad = (n, width = 2) => String(n).padStart(width, "0");

const isoDate = ({ year, month, day }) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
