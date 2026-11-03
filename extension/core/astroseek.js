import { withLabels } from "./names.js";
import { chooseListedTown } from "./towns.js";

const HOST = "horoscopes.astro-seek.com";
// The account's pages, such as its private astro database, are on www.
const ACCOUNT_HOST = "www.astro-seek.com";
const DATABASE_PATH = "/my-profile-astro-database";

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
  const params = chartParams(url);
  const town = params?.get("narozeni_mesto_hidden")?.trim() ?? "";
  const state = params?.get("narozeni_podstat_kratky_hidden")?.trim() ?? "";
  const country = params?.get("narozeni_stat_hidden")?.trim() ?? "";
  // The state and country codes after it help choose among a town search's
  // matches; only the town is typed (searchTown).
  return town !== "" && country !== "" ? [town, state, country].filter(Boolean).join(", ") : null;
}

/**
 * The name a chart's address gives, for astro.com's name fields, or null. A
 * chart opened from the account's saved people carries its saved name as
 * nick=, in its address and in every link on its page, so it stays through a
 * change of settings, as seen on 2026-11-02. The page prints it too, above
 * Date of Birth, but a chart from the calculator, or one AstroChart Bridge
 * opens, has no nick= and something else, or nothing, there. Taken
 * unchecked, as the town is: it shows in the astro.com screen's name boxes,
 * to change before anything is filled in.
 *
 * @param {string} url
 * @returns {string | null}
 */
export function nameFromUrl(url) {
  const name = chartParams(url)?.get("nick")?.trim() ?? "";
  return name === "" ? null : name;
}

// An Astro-Seek chart address's parameters, or null for another site's page
// or text that isn't an address.
function chartParams(url) {
  let page;
  try {
    page = new URL(url);
  } catch {
    return null;
  }
  return page.hostname === HOST ? page.searchParams : null;
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

  // A saved person's chart prints its name above Date of Birth, and a chart
  // placed at a city prints City and Country rows below the coordinates, as
  // "City: New York" and "Country: United States (US), NY", seen on 2026-11-02;
  // Tesseract.js read that screenshot's name line whole. An unsaved chart
  // prints a double rule there instead, under its "Edit birth data and
  // settings" and "Add into my database" links, so none of those is a name.
  const above = lines[lines.findIndex((line) => line.startsWith("Date of Birth")) - 1] ?? "";
  const city = rowValue(lines, "City");
  const country = rowValue(lines, "Country");
  return withLabels(
    {
      local: `${isoDate(local)}T${pad(local.hour)}:${pad(local.minute)}:${pad(local.second ?? 0)}`,
      zoneLabel: local.label,
      printedUt: `${isoDate(ut)}T${pad(ut.hour)}:${pad(ut.minute)}:${pad(ut.second ?? 0)}Z`,
      lat: degrees(coords.latDeg, coords.latMin, coords.latSouth),
      lng: degrees(coords.lngDeg, coords.lngMin, coords.lngWest),
      siderealSeconds,
    },
    {
      name: isChartName(above) ? above : null,
      place: city === null ? null : [city, country].filter(Boolean).join(", "),
    },
  );
}

// The page's labels, none of which is a chart's name.
const PAGE_LABELS = [...Object.values(SCREENSHOT_FIELDS).map(([label]) => label), "House system", "City", "Country"];
// What an unsaved chart's page prints above Date of Birth, seen on 2026-11-02.
const PAGE_TEXT = /Edit birth data|Add into my database|online calculator/i;

// Whether the line above Date of Birth names the chart: not one of the page's
// labels or links, and mostly letters, as a rule OCR reads as marks isn't.
function isChartName(line) {
  const letters = line.match(/\p{L}/gu)?.length ?? 0;
  return (
    letters >= 2 &&
    letters * 2 >= line.replace(/\s/g, "").length &&
    !PAGE_LABELS.some((label) => line.startsWith(label)) &&
    !PAGE_TEXT.test(line)
  );
}

// A row's value: the rest of its line after the label, less the marks OCR
// puts first, as it reads the colon as "-", ";", "3" or nothing, and the
// country's flag as "E=": leading words of up to two characters with no
// letter, or up to three with one of OCR's marks, so "St. Louis" and
// "100 Mile House" stay whole. null when there is no such row or nothing
// after its label.
function rowValue(lines, label) {
  const rest = lines.find((each) => each.startsWith(label))?.slice(label.length) ?? "";
  // A copied page's colon comes straight before its value: "Country:United States".
  const words = rest.replace(/^[^\p{L}\d]+/u, "").split(" ").filter(Boolean);
  while (words.length > 0 && (/^[^\p{L}]{1,2}$/u.test(words[0]) || /^(?=.*[:;=|~_•])\S{1,3}$/.test(words[0]))) words.shift();
  return words.length === 0 ? null : words.join(" ");
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
export function astroSeekUrl(sky) {
  const { year, month, day, hour, minute, second, latitude, longitude } = formParts(sky, "astroSeekUrl");

  const url = new URL(`https://${HOST}/calculate-birth-chart-horoscope-online/`);
  url.search = new URLSearchParams([
    ["input_natal", "1"],
    ["send_calculation", "1"],
    ["narozeni_den", day],
    ["narozeni_mesic", month],
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

/**
 * Astro-Seek's page for adding a chart to the signed-in account's private
 * astro database, filled in for a UTC instant and place, with a name. Like
 * astroSeekUrl, the time goes in as UT/GMT with no daylight saving and the
 * place as coordinates. The parameters copy, in order, the "Add into my
 * database" link on the chart astroSeekUrl opened for 2024-04-17 12:00 UT at
 * 40°43'N, 74°0'W, seen signed in on 2026-11-01, with the name in nick.
 *
 * Opened signed in, it shows Astro-Seek's Add person form with the name,
 * date, time, coordinates and UT/GMT filled in, Gender at Male and Birth city
 * empty. That form doesn't save a chart properly without a city, and saves a
 * town typed into the link with an unknown country, so the town is left to
 * be chosen from the form's own list.
 *
 * Throws when utc isn't YYYY-MM-DDTHH:MM:SSZ, like astroSeekUrl.
 *
 * @param {{ utc: string, lat: number, lng: number }} sky
 * @param {{ name?: string | null }} [chart]  the chart's name in one piece, as
 *   Astro-Seek's form has a single Name field
 * @returns {string}
 */
export function astroSeekSaveUrl(sky, { name = null } = {}) {
  const { year, month, day, hour, minute, second, latitude, longitude } = formParts(sky, "astroSeekSaveUrl");

  const url = new URL(`https://${ACCOUNT_HOST}${DATABASE_PATH}`);
  url.search = new URLSearchParams([
    ["typ", "save_birth_data"],
    ["source", "osobni_horoskop"],
    ["narozeni_den", day],
    ["narozeni_mesic", month],
    ["narozeni_rok", year],
    ["narozeni_hodina", hour],
    ["narozeni_minuta", minute],
    ["narozeni_sekunda", second],
    ["narozeni_sirka_stupne", String(latitude.deg)],
    ["narozeni_sirka_minuty", String(latitude.min)],
    ["narozeni_sirka_smer", String(latitude.negative)],
    ["narozeni_delka_stupne", String(longitude.deg)],
    ["narozeni_delka_minuty", String(longitude.min)],
    ["narozeni_delka_smer", String(longitude.negative)],
    ["narozeni_timezone_form", "0"],
    ["narozeni_timezone_dst_form", "0"],
    ["narozeni_mesto_hidden", `Manually place: ${placeText(latitude, longitude)}`],
    ["narozeni_stat_hidden", ""],
    ["narozeni_podstat_kratky_hidden", ""],
    ["narozeni_tzid_id", "0"],
    ["birth_city_save", ""],
    ["nick", name?.trim() ?? ""],
  ]);
  return url.href;
}

// Astro-Seek's Birth city field, as seen on 2026-11-01, is jQuery UI's
// autocomplete on #city. Its city search, api_gmaps3.php?term=New%20York,
// answers with matches such as { value: "New York, USA, New York", label:
// "New York, USA, New York (40n43, 74w0)", id: "336" }, and jQuery UI lists
// each match by its label. "New York" lists both New York and New York City,
// USA, New York at 40n43, 74w0.

/**
 * Which of Astro-Seek's Birth city matches to choose for a chart's town, from
 * their labels and the chart's coordinates, by towns.js's rules: so "New
 * York" chooses New York, USA, New York over New York City at the same place.
 * A label whose coordinates can't be read is left out.
 *
 * @param {string[]} labels  the matches' labels, in Astro-Seek's order
 * @param {{ town: string, lat: number, lng: number }} chart
 * @param {Parameters<typeof chooseListedTown>[2]} [words]  as for chooseListedTown
 * @returns {ReturnType<typeof chooseListedTown>}
 */
export function chooseCity(labels, chart, words) {
  return chooseListedTown(labels.map((text) => ({ text, place: cityPlace(text) })), chart, words);
}

// "New York, USA, New York (40n43, 74w0)": the name before the first comma,
// its country and state, then the latitude and longitude in brackets at the
// end, in degrees and whole minutes.
const CITY_LABEL = /^([^,]+),(.*) \((\d{1,2})([ns])(\d{1,2}), (\d{1,3})([ew])(\d{1,2})\)$/;

// A label's name, coordinates and the pieces between them, as "USA" and
// "New York"; or null when it isn't in CITY_LABEL's form or its numbers are
// out of range.
function cityPlace(label) {
  const match = CITY_LABEL.exec(label);
  if (!match) return null;
  const [, name, between, latDeg, latSide, latMin, lngDeg, lngSide, lngMin] = match;
  if (Number(latMin) > 59 || Number(lngMin) > 59) return null;
  const lat = degrees(Number(latDeg), Number(latMin), latSide === "s");
  const lng = degrees(Number(lngDeg), Number(lngMin), lngSide === "w");
  const pieces = between.split(",").map((piece) => piece.trim()).filter(Boolean);
  return Math.abs(lat) > 90 || Math.abs(lng) > 180 ? null : { name: name.trim(), lat, lng, pieces };
}

/**
 * Whether a page is the account's private astro database, where
 * astroSeekSaveUrl leads, whatever its parameters.
 *
 * @param {string} url
 */
export function isSavePage(url) {
  try {
    const page = new URL(url);
    return page.origin === `https://${ACCOUNT_HOST}` && page.pathname === DATABASE_PATH;
  } catch {
    return false;
  }
}

/**
 * What the save page's tab needs to know about it, as seen on 2026-11-01.
 * Signed in, every Astro-Seek page's menu links to /logout; signed out, it
 * links to /login (its Login and Account items) and /registration. auth is
 * read from those links' addresses, not their words: "signed-in" with a
 * /logout link and no /login one, "signed-out" the other way round, and
 * "unknown" with both or neither. Every page, signed in or out, also has a
 * /login link inside an HTML comment; a comment holds no elements, so the
 * page's links leave it out, though a search of the page's source would
 * find it. form is the Add person form,
 * form#form_jina_osoba, when it has the fields AstroChart Bridge fills in or
 * checks: "city-empty" while its Birth city is empty, as astroSeekSaveUrl
 * leaves it, and "city-typed" once it holds anything, which is never
 * replaced. Runs in the tab, so it uses nothing from this module.
 *
 * @returns {{ auth: "signed-in" | "signed-out" | "unknown", form: "city-empty" | "city-typed" | "unrecognised" }}
 */
export function readSavePage() {
  const paths = new Set();
  for (const link of document.querySelectorAll("a[href]")) {
    try {
      const target = new URL(link.href);
      if (target.hostname === "astro-seek.com" || target.hostname.endsWith(".astro-seek.com")) paths.add(target.pathname);
    } catch {
      // An address URL can't read says nothing either way.
    }
  }
  const logout = paths.has("/logout");
  const login = paths.has("/login");
  const auth = logout && !login ? "signed-in" : login && !logout ? "signed-out" : "unknown";

  const fields = document.getElementById("form_jina_osoba")?.elements;
  const names = [
    "nick",
    "narozeni_city",
    "narozeni_sirka_stupne",
    "narozeni_sirka_minuty",
    "narozeni_sirka_smer",
    "narozeni_delka_stupne",
    "narozeni_delka_minuty",
    "narozeni_delka_smer",
    "narozeni_timezone_form",
    "narozeni_timezone_dst_form",
  ];
  if (!names.every((name) => fields?.namedItem(name))) return { auth, form: "unrecognised" };
  return { auth, form: fields.namedItem("narozeni_city").value.trim() === "" ? "city-empty" : "city-typed" };
}

/**
 * The chart's place and time zone as the Add person form holds them once
 * astroSeekSaveUrl has filled it in: the coordinates in whole minutes, and
 * UT/GMT with daylight saving not observed. guardChartPlace keeps them.
 *
 * @param {{ lat: number, lng: number }} sky
 * @returns {{ values: Record<string, string>, text: string }}  values by field
 *   name, and the coordinates in words, such as "40°43'N, 74°0'W"
 */
export function savePlace({ lat, lng }) {
  const latitude = degreesMinutes(lat);
  const longitude = degreesMinutes(lng);
  return {
    values: {
      narozeni_sirka_stupne: String(latitude.deg),
      narozeni_sirka_minuty: String(latitude.min),
      narozeni_sirka_smer: String(latitude.negative),
      narozeni_delka_stupne: String(longitude.deg),
      narozeni_delka_minuty: String(longitude.min),
      narozeni_delka_smer: String(longitude.negative),
      narozeni_timezone_form: "0",
      narozeni_timezone_dst_form: "0",
    },
    text: placeText(latitude, longitude),
  };
}

// "40°43'N, 74°0'W", as Astro-Seek writes a place entered by coordinates.
// Only the north and west form has been seen; S and E are assumed.
const placeText = (latitude, longitude) =>
  `${latitude.deg}°${latitude.min}'${latitude.negative ? "S" : "N"}, ${longitude.deg}°${longitude.min}'${longitude.negative ? "W" : "E"}`;

// typeCity, readCityList, showCityChoice and guardChartPlace run in the save
// page's tab, like readSavePage. Astro-Seek's Birth city list is assumed to be
// built as astro.com's is, both being jQuery UI's autocomplete: a
// ul.ui-autocomplete added to the page and hidden with an inline "display:
// none" while closed, one li.ui-menu-item per match. It hasn't been seen yet.

/**
 * Types a chart's town into the Add person form's empty Birth city, the way
 * a person would, so Astro-Seek's city search lists its matches. A Birth city
 * that already holds anything is left as it is.
 *
 * @param {string} town
 * @returns {{ typed: true } | { typed: false, form: "city-typed" | "unrecognised" }}
 */
export function typeCity(town) {
  const city = document.getElementById("form_jina_osoba")?.elements.namedItem("narozeni_city") ?? null;
  if (!city) return { typed: false, form: "unrecognised" };
  if (city.value.trim() !== "") return { typed: false, form: "city-typed" };
  city.value = town;
  city.focus();
  city.dispatchEvent(new Event("input", { bubbles: true }));
  return { typed: true };
}

/**
 * Astro-Seek's matches for the town typeCity typed, once its list shows them:
 * "waiting" until a list with matches opens; "changed" once Birth city holds
 * anything else, such as a town the person typed.
 *
 * @param {string} town
 * @returns {{ state: "waiting" | "changed" } | { state: "listed", labels: string[] }}
 */
export function readCityList(town) {
  const city = document.getElementById("form_jina_osoba")?.elements.namedItem("narozeni_city") ?? null;
  if (!city || city.value !== town) return { state: "changed" };
  const menu = [...document.querySelectorAll("ul.ui-autocomplete")].find(
    (list) => list.style.display !== "none" && list.querySelector("li.ui-menu-item"),
  );
  if (!menu) return { state: "waiting" };
  return { state: "listed", labels: [...menu.querySelectorAll("li.ui-menu-item")].map((item) => item.textContent.trim()) };
}

// The Add person form's Gender options, c_pohlavi, by the chart's gender, as
// seen signed in on 2026-11-01: Male 1, where the form starts, Female 2,
// Nonbinary 3, Event 4, Davison rel. chart 5 and Horary question 6. label is
// the option's own text, for the box under Birth city.
export const ASTRO_SEEK_GENDERS = {
  male: { value: "1", label: "Male" },
  female: { value: "2", label: "Female" },
  event: { value: "4", label: "Event" },
  horary: { value: "6", label: "Horary question" },
};

/**
 * Sets the Add person form's Gender to the chart's (ASTRO_SEEK_GENDERS'
 * value), while it is still at Male, where Astro-Seek starts it. Any other
 * Gender is the person's, and is left as it is, as is a value the form has no
 * option for. Never submits.
 *
 * @param {string} value
 * @returns {{ set: boolean }}
 */
export function chooseGender(value) {
  const gender = document.getElementById("form_jina_osoba")?.elements.namedItem("c_pohlavi") ?? null;
  if (!gender || gender.value !== "1") return { set: false };
  gender.value = value;
  // A select ignores a value none of its options has.
  if (gender.value !== value) {
    gender.value = "1";
    return { set: false };
  }
  gender.dispatchEvent(new Event("change", { bubbles: true }));
  return { set: true };
}

/**
 * Acts on the city to choose for a chart, in a box under Birth city: chooses
 * chooseCity's pick in Astro-Seek's list as a person would, or asks, or says
 * there's no near match, no list, or no town to type. Once a match is chosen,
 * the box says which and how far it is from the chart's coordinates, with a
 * button that lists the matches again, and reminds the person of Gender:
 * the chart's, when chooseGender set it, or else that Astro-Seek starts it
 * at Male. The box goes once the person types in Birth city. Never submits.
 *
 * @param {ReturnType<typeof chooseCity> | { kind: "no-list" } | { kind: "no-town" }} choice
 * @param {string | null} town  null only with "no-town"
 * @param {number} limitKm  TOWN_LIMIT_KM, for the box's words
 * @param {string | null} gender  the Gender option chooseGender set, by its label
 * @param {Record<string, string>} words  the catalog's pageNotes.astroSeek, whose
 *   {name}s fill is given; the page gets only this function's source
 * @returns {{ shown: boolean }}
 */
export function showCityChoice(choice, town, limitKm, gender, words) {
  const fill = (template, values) => template.replace(/\{(\w+)\}/g, (slot, name) => (Object.hasOwn(values, name) ? values[name] : slot));
  const city = document.getElementById("form_jina_osoba")?.elements.namedItem("narozeni_city") ?? null;
  if (!city || (town !== null && city.value !== town)) return { shown: false };
  document.getElementById("astrochart-bridge-city")?.remove();

  const note = document.createElement("div");
  note.id = "astrochart-bridge-city";
  const message = document.createElement("p");
  const buttons = document.createElement("div");
  note.append(message, buttons);
  const say = (text, { warn }) => {
    message.textContent = `AstroChart Bridge: ${text}`;
    note.style.cssText = `clear: both; margin: 0.5em 0; padding: 0.5em 0.75em; border: 2px solid ${warn ? "#b00020" : "#888"}; background: #fff; color: #222;`;
    buttons.replaceChildren();
  };
  const button = (text, onClick) => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = text;
    element.style.margin = "0 0.5em 0.25em 0";
    element.addEventListener("click", onClick);
    buttons.append(element);
  };
  const genderNote = gender === null ? words.genderStarts : fill(words.genderSet, { gender });
  // Types the town again, as typeCity did, so Astro-Seek lists its matches.
  const listAgain = () => {
    note.remove();
    city.value = town;
    city.focus();
    city.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const choose = ({ text, away }) => {
    const items = [...document.querySelectorAll("ul.ui-autocomplete li.ui-menu-item")];
    const item = items.find((element) => element.textContent.trim() === text);
    if (!item) {
      say(fill(words.gone, { text }), { warn: true });
      button(words.listAgain, listAgain);
      return;
    }
    // jQuery UI 1.12 puts each match's text in a .ui-menu-item-wrapper, which
    // astro.com's list takes the click on; older versions have none.
    (item.querySelector(".ui-menu-item-wrapper") ?? item).click();
    say(fill(words.chose, { text, away, genderNote }), { warn: false });
    button(words.chooseAnother, listAgain);
  };

  if (choice.kind === "pick") choose(choice.match);
  if (choice.kind === "ask") {
    say(fill(words.ask, { town, km: limitKm }), { warn: true });
    for (const match of choice.matches) button(`${match.text} (${match.away})`, () => choose(match));
  }
  if (choice.kind === "none") {
    say(fill(choice.listed === 1 ? words.noneOfOne : words.noneOfMany, { town, km: limitKm, listed: choice.listed }), { warn: true });
    button(words.listAgain, listAgain);
  }
  if (choice.kind === "no-list") {
    say(fill(words.noList, { town }), { warn: true });
    button(words.listAgain, listAgain);
  }
  if (choice.kind === "no-town") say(fill(words.noTown, { genderNote }), { warn: true });
  if (choice.kind !== "pick") city.blur();
  // Typing in Birth city makes the box's choice stale; the input events above
  // are the script's own, so only the person's are heard.
  city.addEventListener("input", (event) => event.isTrusted && note.remove());
  if (!note.isConnected) city.after(note);
  return { shown: true };
}

/**
 * Keeps the chart's coordinates and UT/GMT in the Add person form while the
 * person finishes it: choosing a Birth city may set the city's own, which
 * hasn't been seen yet. Four times a second, a field that no longer holds
 * savePlace's value is set back, quietly, so the page's own scripts don't
 * react, and a note under the time zone says the chart's place is back.
 * A field the person changes is theirs and is left alone. Stops when the form
 * is submitted, or after 30 minutes. Never submits.
 *
 * @param {ReturnType<typeof savePlace>} place
 * @param {Record<string, string>} words  the catalog's pageNotes.astroSeek, as for showCityChoice
 * @returns {{ guarding: boolean }}
 */
export function guardChartPlace(place, words) {
  const fill = (template, values) => template.replace(/\{(\w+)\}/g, (slot, name) => (Object.hasOwn(values, name) ? values[name] : slot));
  const GUARD_MS = 30 * 60_000;
  const form = document.getElementById("form_jina_osoba");
  const fields = form?.elements;
  const names = Object.keys(place.values);
  if (!names.every((name) => fields?.namedItem(name))) return { guarding: false };
  if (form.dataset.astrochartBridgeGuard === "on") return { guarding: true };
  form.dataset.astrochartBridgeGuard = "on";

  const theirs = new Set();
  for (const name of names) {
    const claim = (event) => event.isTrusted && theirs.add(name);
    fields.namedItem(name).addEventListener("input", claim);
    fields.namedItem(name).addEventListener("change", claim);
  }
  const note = document.createElement("p");
  note.id = "astrochart-bridge-place";
  note.style.cssText = "clear: both; margin: 0.5em 0; padding: 0.5em 0.75em; border: 2px solid #888; background: #fff; color: #222;";
  note.textContent = fill(words.placeBack, { place: place.text });

  const timer = setInterval(() => {
    let putBack = false;
    for (const name of names) {
      const element = fields.namedItem(name);
      if (theirs.has(name) || element.value === place.values[name]) continue;
      element.value = place.values[name];
      putBack = true;
    }
    if (putBack && !note.isConnected) {
      const dst = fields.namedItem("narozeni_timezone_dst_form");
      (dst.parentElement && dst.parentElement !== form ? dst.parentElement : dst).after(note);
    }
  }, 250);
  const stop = () => {
    clearInterval(timer);
    delete form.dataset.astrochartBridgeGuard;
  };
  form.addEventListener("submit", stop);
  setTimeout(stop, GUARD_MS);
  return { guarding: true };
}

/**
 * Whether two skies are the same Astro-Seek chart: the same UT date, hour and
 * minute, and the same whole minutes of latitude and longitude, as Astro-Seek's
 * form takes them. Seconds aren't compared: an Astro-Seek page prints its time
 * to the minute. A sky with no UTC is no chart's.
 *
 * @param {{ utc: string | null, lat: number, lng: number }} a
 * @param {{ utc: string | null, lat: number, lng: number }} b
 */
export function sameAstroSeekChart(a, b) {
  const parts = (sky) => {
    if (!UTC_PARTS.test(sky?.utc ?? "")) return null;
    const { second, ...rest } = formParts(sky, "sameAstroSeekChart");
    return JSON.stringify(rest);
  };
  const first = parts(a);
  return first !== null && first === parts(b);
}

// The birth form's values for a UTC instant and place: the day and month
// without a leading zero, the year and time as written, and the coordinates
// as degreesMinutes gives them. Throws, naming the caller, when utc isn't
// YYYY-MM-DDTHH:MM:SSZ.
function formParts({ utc, lat, lng }, caller) {
  const match = UTC_PARTS.exec(typeof utc === "string" ? utc : "");
  if (!match) throw new Error(`${caller} needs a UTC instant like 2024-04-17T12:00:00Z, got ${utc}`);
  const [, year, month, day, hour, minute, second] = match;
  return {
    year,
    month: String(Number(month)),
    day: String(Number(day)),
    hour,
    minute,
    second,
    latitude: degreesMinutes(lat),
    longitude: degreesMinutes(lng),
  };
}

// 40.716667 → { deg: 40, min: 43, negative: 0 }, the form's whole minutes and
// direction code (0 for N or E, 1 for S or W). Rounding the total in minutes
// lets 59.99' carry into the next degree.
function degreesMinutes(value) {
  const minutes = Math.round(Math.abs(value) * 60);
  return { deg: Math.floor(minutes / 60), min: minutes % 60, negative: value < 0 ? 1 : 0 };
}
