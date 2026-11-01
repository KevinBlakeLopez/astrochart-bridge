const HOST = "horoscopes.astro-seek.com";

const refused = (reason) => ({ kind: "refused", reason });

// Pages are recognised by path, never by parameters: specialised views such as
// /calculate-asteroids/ reuse the bare narozeni_* parameters, and transit pages
// contain "narozeni_" inside muz_narozeni_* and zena_narozeni_*. A path is added
// as natal only once a captured fixture shows readChart can read its page.
const PAGES = new Map([
  ["/calculate-birth-chart-horoscope-online/", { kind: "natal" }],
  ["/calculate-traditional-chart/", { kind: "natal" }],
  ["/calculate-transit-chart/", { kind: "refused", reason: "transit" }],
  ["/calculate-love-compatibility/", { kind: "refused", reason: "synastry" }],
]);

/**
 * Decides from the host and path alone whether a page is a natal chart.
 * Whether its parameters are complete is readChart's job.
 *
 * @param {string} url
 * @returns {{ kind: "natal" } | { kind: "refused", reason: "transit" | "synastry" | "unsupported" }}
 */
export function classifyUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return refused("unsupported");
  }
  if (parsed.hostname !== HOST) return refused("unsupported");
  const page = PAGES.get(parsed.pathname);
  return page ? { ...page } : refused("unsupported");
}

const LABEL_LOCAL = "Date of Birth (local time):";
const LABEL_UT = "Universal Time (UT/GMT):";
const LABEL_COORDS = "Latitude, Longitude:";

// "17 April 2024 - 08:00  (EDT, DST)" on natal pages; traditional chart pages
// add seconds, "08:00:00". The gap before the label includes a no-break space,
// which \s matches. Some pages use three-letter month names.
const DATE_LINE = /^(\d{1,2}) ([A-Za-z]+) (\d{4}) - (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s+\((.+)\))?$/;
// "40°43'N, 74°0'W"
const COORDS_LINE = /^(\d{1,2})°(\d{1,2})'([NS]), (\d{1,3})°(\d{1,2})'([EW])$/;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Each birth field: its URL parameter after "narozeni_", and the allowed range.
// The direction codes are 0 for N or E and 1 for S or W.
const URL_FIELDS = {
  year: ["rok", 1, 9999],
  month: ["mesic", 1, 12],
  day: ["den", 1, 31],
  hour: ["hodina", 0, 23],
  minute: ["minuta", 0, 59],
  second: ["sekunda", 0, 59],
  latDeg: ["sirka_stupne", 0, 90],
  latMin: ["sirka_minuty", 0, 59],
  latSouth: ["sirka_smer", 0, 1],
  lngDeg: ["delka_stupne", 0, 180],
  lngMin: ["delka_minuty", 0, 59],
  lngWest: ["delka_smer", 0, 1],
};

/**
 * Reads a page that classifyUrl accepted as natal. Date, time and coordinates
 * come from the URL, and the page must agree with them. Universal Time and the
 * zone label exist only on the page.
 *
 * @param {{ url: string, text: string }} page  text is document.body.innerText
 * @returns {{ local: string, zoneLabel: string | null, printedUt: string | null, lat: number, lng: number }
 *   | { kind: "refused", reason: "incomplete-url" | "ambiguous-page" | "unreadable-page" | "page-url-mismatch" }}
 */
export function readChart({ url, text }) {
  const birth = readUrl(url);
  if (!birth) return refused("incomplete-url");

  const lines = text.split("\n").map((line) => line.trim());
  const valueAfter = {};
  for (const label of [LABEL_LOCAL, LABEL_UT, LABEL_COORDS]) {
    const at = lines.flatMap((line, i) => (line === label ? [i] : []));
    if (at.length > 1) return refused("ambiguous-page");
    valueAfter[label] = at.length === 1 ? (lines[at[0] + 1] ?? "") : null;
  }

  const local = parseDateLine(valueAfter[LABEL_LOCAL]);
  const coords = parseCoordsLine(valueAfter[LABEL_COORDS]);
  const utLine = valueAfter[LABEL_UT];
  const ut = utLine === null ? null : parseDateLine(utLine);
  if (!local || !coords || (utLine !== null && !ut)) return refused("unreadable-page");

  if (
    !same(local, birth, ["year", "month", "day", "hour", "minute"]) ||
    (local.second !== null && local.second !== birth.second) ||
    !same(coords, birth, ["latDeg", "latMin", "latSouth", "lngDeg", "lngMin", "lngWest"])
  ) {
    return refused("page-url-mismatch");
  }

  return {
    local: `${isoDate(birth)}T${pad(birth.hour)}:${pad(birth.minute)}:${pad(birth.second)}`,
    zoneLabel: local.label,
    // Natal pages print UT without seconds, so those read as :00.
    printedUt: ut && `${isoDate(ut)}T${pad(ut.hour)}:${pad(ut.minute)}:${pad(ut.second ?? 0)}Z`,
    lat: degrees(birth.latDeg, birth.latMin, birth.latSouth),
    lng: degrees(birth.lngDeg, birth.lngMin, birth.lngWest),
  };
}

function readUrl(url) {
  let params;
  try {
    params = new URL(url).searchParams;
  } catch {
    return null;
  }
  const birth = {};
  for (const [field, [name, min, max]] of Object.entries(URL_FIELDS)) {
    // Every URL seen so far has narozeni_sekunda; a missing one counts as 0.
    const raw = params.get(`narozeni_${name}`) ?? (field === "second" ? "0" : null);
    if (raw === null || !/^\d+$/.test(raw)) return null;
    const value = Number(raw);
    if (value < min || value > max) return null;
    birth[field] = value;
  }
  return isCalendarDate(birth) ? birth : null;
}

function parseDateLine(line) {
  const match = DATE_LINE.exec(line ?? "");
  if (!match) return null;
  const [, day, monthName, year, hour, minute, second, label] = match;
  const date = {
    year: Number(year),
    month: monthNumber(monthName),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    // null when the page prints no seconds, so there is nothing to compare.
    second: second === undefined ? null : Number(second),
  };
  if (!date.month || date.hour > 23 || date.minute > 59 || (date.second ?? 0) > 59 || !isCalendarDate(date)) {
    return null;
  }
  return { ...date, label: label ?? null };
}

function parseCoordsLine(line) {
  const match = COORDS_LINE.exec(line ?? "");
  if (!match) return null;
  const [, latDeg, latMin, latHemisphere, lngDeg, lngMin, lngHemisphere] = match;
  return {
    latDeg: Number(latDeg),
    latMin: Number(latMin),
    latSouth: latHemisphere === "S" ? 1 : 0,
    lngDeg: Number(lngDeg),
    lngMin: Number(lngMin),
    lngWest: lngHemisphere === "W" ? 1 : 0,
  };
}

// Full English month names or their first three letters; 0 when unknown.
function monthNumber(word) {
  const lower = word.toLowerCase();
  return MONTHS.findIndex((name) => lower === name || lower === name.slice(0, 3)) + 1;
}

function isCalendarDate({ year, month, day }) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const same = (a, b, keys) => keys.every((key) => a[key] === b[key]);

const pad = (n, width = 2) => String(n).padStart(width, "0");

const isoDate = ({ year, month, day }) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

// Rounded to 6 decimals, about 0.1 m. "0 - value" rather than "-value" keeps
// 0°0' on the negative side as 0 instead of -0.
function degrees(deg, min, negative) {
  const value = Math.round((deg + min / 60) * 1e6) / 1e6;
  return negative ? 0 - value : value;
}
