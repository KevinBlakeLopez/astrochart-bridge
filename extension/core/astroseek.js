const HOST = "horoscopes.astro-seek.com";

const refused = (reason) => ({ kind: "refused", reason });

// Pages are recognised by path, never by parameters: specialised views reuse the
// bare narozeni_* parameters, and transit pages contain "narozeni_" inside
// muz_narozeni_* and zena_narozeni_*. A path is added as natal only once a
// captured fixture shows readChart can read its page.
const PAGES = new Map([
  ["/calculate-birth-chart-horoscope-online/", { kind: "natal" }],
  ["/calculate-traditional-chart/", { kind: "natal" }],
  ["/calculate-asteroids/", { kind: "natal" }],
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

/**
 * The town a chart's address names, for astro.com's birth town field, or null.
 * The page header doesn't print it, so it is taken from the address unchecked:
 * astro.com's own atlas lookup and the coordinates it shows are the check. A
 * chart placed by coordinates, such as one AstroChart Bridge opens, names no country
 * and puts "Manually place: °'N, °'E" where the city goes.
 *
 * @param {string} url
 * @returns {string | null}
 */
export function townFromUrl(url) {
  let page;
  try {
    page = new URL(url);
  } catch {
    return null;
  }
  if (page.hostname !== HOST) return null;
  const town = page.searchParams.get("narozeni_mesto_hidden")?.trim() ?? "";
  const country = page.searchParams.get("narozeni_stat_hidden")?.trim() ?? "";
  return town !== "" && country !== "" ? town : null;
}

const LABEL_LOCAL = "Date of Birth (local time):";
const LABEL_UT = "Universal Time (UT/GMT):";
const LABEL_COORDS = "Latitude, Longitude:";

// Chrome and Firefox give each label and value a line of its own. Safari runs
// the whole header block into one line: "Date of Birth (local time):1 January
// 1970 - 00:00  (PST) Universal Time (UT/GMT):1 January 1970 - 08:00  Local
// Sidereal Time (LST):06:49:14House system:…". Breaking the text around these
// labels gives the same lines in both. The last two are the labels that follow
// a value readChart reads, so that value ends where they begin.
const LINE_LABELS = [LABEL_LOCAL, LABEL_UT, LABEL_COORDS, "Local Sidereal Time (LST):", "City:"];
// Takes the spaces and at most one line break on each side of a label, so text
// that already has its labels on lines of their own comes out unchanged.
const AROUND_LABEL = new RegExp(
  `\\n?[^\\S\\n]*(${LINE_LABELS.map((label) => label.replace(/[()]/g, "\\$&")).join("|")})[^\\S\\n]*\\n?`,
  "g",
);

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

  const lines = text
    .replace(AROUND_LABEL, "\n$1\n")
    .split("\n")
    .map((line) => line.trim());
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

// The same labels as OCR reads them from a screenshot of the page, each on one
// line with its value, and how to parse that value. Only the leading words are
// matched: on a small screenshot, OCR loses the grey "(local time)", "(UT/GMT)"
// and "(LST)", and reads the colon as "-", ";", "3" or nothing at all.
const SCREENSHOT_FIELDS = {
  local: ["Date of Birth", (value) => parseDateLine(value)],
  ut: ["Universal Time", (value) => parseDateLine(value)],
  sidereal: ["Local Sidereal Time", (value) => parseSiderealLine(value)],
  coords: ["Latitude, Longitude", (value) => parseCoordsLine(value)],
};
// "20:48:26"
const SIDEREAL_LINE = /^(\d{2}):(\d{2}):(\d{2})$/;

/**
 * Reads the OCR text of a screenshot of an Astro-Seek natal chart page. There
 * is no URL to check it against, as readChart has, so the printed sidereal time
 * comes back too: analyzeScreenshot checks the UT and longitude with it.
 *
 * @param {string} text  OCR output, one line of the image per line
 * @returns {{ local: string, zoneLabel: string | null, printedUt: string, lat: number, lng: number, siderealSeconds: number }
 *   | { kind: "refused", reason: "ambiguous-screenshot" | "unreadable-screenshot" }}
 */
export function readScreenshot(text) {
  const lines = text.split("\n").map((line) => line.replace(/\s+/g, " ").trim());
  const read = {};
  for (const [field, [label, parse]] of Object.entries(SCREENSHOT_FIELDS)) {
    const found = lines.filter((line) => line.startsWith(label));
    // Two of a label means two charts, as on a synastry page.
    if (found.length > 1) return refused("ambiguous-screenshot");
    if (found.length === 0) return refused("unreadable-screenshot");
    read[field] = valueAfter(found[0], label.length, parse);
  }

  const { local, ut, sidereal: siderealSeconds, coords } = read;
  if (!local || !ut || !coords || !isPlace(coords) || siderealSeconds === null) {
    return refused("unreadable-screenshot");
  }

  return {
    local: `${isoDate(local)}T${pad(local.hour)}:${pad(local.minute)}:${pad(local.second ?? 0)}`,
    zoneLabel: local.label,
    printedUt: `${isoDate(ut)}T${pad(ut.hour)}:${pad(ut.minute)}:${pad(ut.second ?? 0)}Z`,
    lat: degrees(coords.latDeg, coords.latMin, coords.latSouth),
    lng: degrees(coords.lngDeg, coords.lngMin, coords.lngWest),
    siderealSeconds,
  };
}

// The value is the earliest rest of the line, after the label, that parses in
// full, whatever OCR made of the text in between. It never starts inside a
// number, so a misread "117" can't be taken as "17". null when nothing parses.
function valueAfter(line, start, parse) {
  for (let i = start; i < line.length; i++) {
    if (/\d/.test(line[i - 1])) continue;
    const value = parse(line.slice(i));
    if (value !== null) return value;
  }
  return null;
}

// readChart gets these ranges from URL_FIELDS; a screenshot has only its text.
function isPlace({ latDeg, latMin, lngDeg, lngMin }) {
  return latMin <= 59 && lngMin <= 59 && latDeg + latMin / 60 <= 90 && lngDeg + lngMin / 60 <= 180;
}

// "20:48:26" → 74906, or null.
function parseSiderealLine(line) {
  const match = SIDEREAL_LINE.exec(line ?? "");
  if (!match) return null;
  const [hours, minutes, seconds] = match.slice(1).map(Number);
  return hours > 23 || minutes > 59 || seconds > 59 ? null : hours * 3600 + minutes * 60 + seconds;
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

const UTC_PARTS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

/**
 * The Astro-Seek birth chart for a UTC instant and place. The time goes in as
 * UT/GMT with no daylight saving (narozeni_timezone_form=0, _dst_form=0) and
 * the place as coordinates with no city, so no time zone has to be guessed.
 * The parameters copy, in order, the one chart of this kind captured from
 * Astro-Seek's form: fixtures/astroseek/manual-ut-2024-04-17-0000.json.
 *
 * Throws when utc isn't YYYY-MM-DDTHH:MM:SSZ, like stellariumUrl.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @returns {string}
 */
export function astroSeekUrl({ utc, lat, lng }) {
  const match = UTC_PARTS.exec(typeof utc === "string" ? utc : "");
  if (!match) throw new Error(`astroSeekUrl needs a UTC instant like 2024-04-17T12:00:00Z, got ${utc}`);
  const [, year, month, day, hour, minute, second] = match;
  const latitude = degreesMinutes(lat);
  const longitude = degreesMinutes(lng);

  const url = new URL(`https://${HOST}/calculate-birth-chart-horoscope-online/`);
  url.search = new URLSearchParams([
    ["input_natal", "1"],
    ["send_calculation", "1"],
    ["narozeni_den", String(Number(day))],
    ["narozeni_mesic", String(Number(month))],
    ["narozeni_rok", year],
    ["narozeni_hodina", hour],
    ["narozeni_minuta", minute],
    ["narozeni_sekunda", second],
    ["narozeni_city", ""],
    ["narozeni_mesto_hidden", "Manually place: °'N, °'E"],
    ["narozeni_stat_hidden", ""],
    ["narozeni_podstat_kratky_hidden", ""],
    ["narozeni_tzid_id", ""],
    ["narozeni_sirka_stupne", String(latitude.deg)],
    ["narozeni_sirka_minuty", String(latitude.min)],
    ["narozeni_sirka_smer", String(latitude.negative)],
    ["narozeni_delka_stupne", String(longitude.deg)],
    ["narozeni_delka_minuty", String(longitude.min)],
    ["narozeni_delka_smer", String(longitude.negative)],
    ["narozeni_timezone_form", "0"],
    ["narozeni_timezone_dst_form", "0"],
    ["house_system", "placidus"],
    ["hid_fortune", "1"],
    ["hid_vertex", "1"],
    ["hid_chiron", "1"],
    ["hid_chiron_check", "on"],
    ["hid_lilith", "1"],
    ["hid_lilith_check", "on"],
    ["hid_uzel", "1"],
    ["hid_uzel_check", "on"],
    ["tolerance", "1"],
    ["aya", ""],
    ["tolerance_paral", "0"],
  ]);
  return url.href;
}

// 40.716667 → { deg: 40, min: 43, negative: 0 }, the form's whole minutes and
// direction code (0 for N or E, 1 for S or W). Rounding the total in minutes
// lets 59.99' carry into the next degree.
function degreesMinutes(value) {
  const minutes = Math.round(Math.abs(value) * 60);
  return { deg: Math.floor(minutes / 60), min: minutes % 60, negative: value < 0 ? 1 : 0 };
}
