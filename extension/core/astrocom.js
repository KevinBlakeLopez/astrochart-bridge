const ORIGIN = "https://www.astro.com";
const CHART_PATH = "/cgi/chart.cgi";

const refused = (reason) => ({ kind: "refused", reason });

// astro.com serves every chart, natal or not, from one path and names the
// chart type in its parameters, so unlike Astro-Seek's pages these are
// recognised by parameters. A btyp and mth pair is added as natal only once a
// captured page shows readPgid can read its drawing link.
const NATAL = [{ btyp: "2", mth: "gw" }];

/**
 * Decides from the address alone whether a page is an account chart AstroChart
 * Bridge can open. Whether its drawing link can be read is readPgid's job.
 * Other parameters, such as the dates, lang= and pa=, aren't checked: a chart
 * page links to itself with several different sets of them.
 *
 * @param {string} url
 * @returns {{ kind: "natal" } | { kind: "refused", reason: "databank" | "unsupported-chart" | "unsupported" }}
 */
export function classifyUrl(url) {
  let page;
  try {
    page = new URL(url);
  } catch {
    return refused("unsupported");
  }
  if (page.origin !== ORIGIN) return refused("unsupported");
  // Astro-Databank pages, and their charts, which carry the birth data in wgid
  // instead of naming a chart saved in the account.
  if (page.pathname.startsWith("/astro-databank/")) return refused("databank");
  if (page.pathname !== CHART_PATH) return refused("unsupported");
  const params = queryParams(page);
  if (params.has("wgid")) return refused("databank");

  // Every other chart page is refused as a chart type of its own, so the
  // popup doesn't ask someone already on an astro.com chart to open one.
  // nhor names the saved chart. pdf= opens the chart as a PDF, where the
  // extension can't run.
  const nhor = only(params, "nhor");
  if (nhor === null || !/^\d+$/.test(nhor) || params.has("pdf")) return refused("unsupported-chart");
  const btyp = only(params, "btyp");
  const mth = only(params, "mth");
  return NATAL.some((type) => type.btyp === btyp && type.mth === mth) ? { kind: "natal" } : refused("unsupported-chart");
}

// astro.com separates a query's parameters with ";" as well as "&", as in
// chart.cgi?;smon=11;rs=0;…;nhor=13, and reads both the same. URL's
// searchParams splits on "&" only, so every parameter this file reads comes
// from here. A ";" written unencoded inside nd= splits the record too, which
// leaves it too few fields for parseNd.
function queryParams(url) {
  return new URLSearchParams(url.search.replaceAll(";", "&"));
}

// A parameter's value when it appears exactly once, else null.
function only(params, key) {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}

/**
 * Reads a page that classifyUrl accepted as natal: the nd= record in its
 * drawing link, limited to what AstroChart Bridge can open today.
 *
 * @param {{ url: string, links: string[] }} page  as for readPgid
 * @returns {{ local: string, offsetMinutes: number, lat: number, lng: number }
 *   | { kind: "refused", reason: "unsupported" | "no-drawing-link" | "ambiguous-page" | "unreadable-link"
 *       | "page-url-mismatch" | "unreadable-record" | "calendar-unsupported" | "local-mean-time" | "unseen-field-9" }}
 */
export function readChart({ url, links }) {
  const link = readPgid({ url, links });
  if (link.kind === "refused") return link;

  const chart = parseNd(link.nd);
  if (!chart) return refused("unreadable-record");
  if (chart.local < GREGORIAN_START) return refused("calendar-unsupported");
  // Checked before field 9, which reads "gal" beside every local-mean-time
  // zone seen, so these charts get the reason that explains them.
  if (chart.zone.kind === "local-mean-time") return refused("local-mean-time");
  // Field 9 is unexplained. Only "gad" (daylight saving) and "gas" (standard
  // time) have been seen beside an offset zone, and the offset already
  // includes daylight saving, so both are read the same. "gal" there could
  // mean another calendar, which would shift the sky.
  if (!OFFSET_FIELD_9.has(chart.field9)) return refused("unseen-field-9");

  const { local, lat, lng } = chart;
  return { local, offsetMinutes: chart.zone.offsetMinutes, lat, lng };
}

// An account chart's page draws the birth data into the chart image, but its
// "Drawing (for subscribers)" link, /cgi/sub.cgi?…&pgid=…, carries the chart's
// own URL with the birth data inline as nd=. pgid is "L", the length of the
// text that follows, "L", then that text: the chart URL in base64url. Only the
// unpadded form has been seen; the one sample needed no padding.
const DRAWING_PATH = "/cgi/sub.cgi";

// astro.com's AAF files take dates before the Gregorian calendar began as
// Julian, as aaf.js reads them. Whether its nd records do hasn't been seen,
// and nothing in the record would catch a date some days out, so they are refused.
const GREGORIAN_START = "1582-10-15";
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
  const nd = chart ? queryParams(chart).getAll("nd") : [];
  if (nd.length !== 1) return refused("unreadable-link");

  return agrees(queryParams(page), queryParams(chart)) ? { nd: nd[0] } : refused("page-url-mismatch");
}

// The pgid of a drawing link, or null for any other link.
function drawingPgid(href) {
  let link;
  try {
    link = new URL(href);
  } catch {
    return null;
  }
  const pgid = queryParams(link).getAll("pgid");
  return link.origin === ORIGIN && link.pathname === DRAWING_PATH && pgid.length === 1 ? pgid[0] : null;
}

// The chart URL inside a pgid, or null. atob reads unpadded base64 and gives
// one character per byte, so a non-ASCII place name comes out garbled; the
// fields AstroChart Bridge reads are all ASCII.
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

// Only ever seen as "gad" or "gas", beside h zones in daylight saving and
// standard time, or "gal", beside every local-mean-time zone. Its meaning is
// unknown, so it is passed on for the caller to judge rather than read.
const FIELD_9 = new Set(["gad", "gas", "gal"]);
const OFFSET_FIELD_9 = new Set(["gad", "gas"]);

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
 * form not seen before. Makes no decision about what AstroChart Bridge supports:
 * a local-mean-time zone is returned as such.
 *
 * @param {string} record  the nd= value, already URL-decoded
 * @returns {{
 *   local: string,
 *   zone: { kind: "offset", offsetMinutes: number } | { kind: "local-mean-time", meridian: number },
 *   field9: "gad" | "gas" | "gal",
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
  // Date.UTC takes years 0 to 99 for 1900 to 1999, so the year is set apart.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const pad = (n, width = 2) => String(n).padStart(width, "0");

const isoDate = ({ year, month, day }) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

// astro.com's birth data form, ade.cgi, as seen signed out on 2026-11-01: a
// POST form named "start" whose fields are named sday, imon (a select of 1 to
// 12), syar, ihou (a select of "", "u" and 0 to 23), smin, and szon (a select
// of time zones: "au", "automatic time zone", selected, then "h0w" first among
// the " 00:00 GMT / UT" ones, and half-hour zones written like "h3w30"). szon sits in
// the extended settings, whose toggle sets the hidden extset field from
// "close" to "open" and shows #extended. Signed in, the same blank form has
// the same fields; its hidden cid, empty signed out, is 25 characters long, so
// cid doesn't tell a new entry from a saved chart and isn't read.
// Typing in the town field, scit, makes astro.com's page look the town up at
// once (adejs.cgi?…&func=place_query) and list its matches with coordinates.
// The name is two text fields, sfnm (first name) and snam (last name), each
// with a maxlength of 40 and neither required.
const FORM_PATH = "/cgi/ade.cgi";

/**
 * Whether a page is on astro.com at all, where AstroChart Bridge may have values
 * waiting for the tab.
 *
 * @param {string} url
 */
export function isAstroComPage(url) {
  try {
    return new URL(url).origin === ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Whether a page is astro.com's birth data form.
 *
 * @param {string} url
 */
export function isBirthDataForm(url) {
  return isAstroComPage(url) && new URL(url).pathname === FORM_PATH;
}

/**
 * The time to enter in ade.cgi and its time zone. astro.com recommends its
 * automatic time zone, au, the form's default, which looks the zone up in its
 * atlas for the town and local time chosen. So a chart's local time goes in
 * with au. A chart with no local time, such as a sky from Stellarium, goes in
 * as Universal Time with h0w, " 00:00 GMT / UT", and so does one whose local
 * time is Universal Time: with h0w that is the same moment whatever town is
 * chosen, as for a chart entered in UT on Astro-Seek.
 *
 * @param {{ utc: string, local?: string | null }} values  local is the chart's
 *   local time, YYYY-MM-DDTHH:MM:SS, or null
 * @returns {{ time: string, szon: "au" | "h0w" }}  time is YYYY-MM-DDTHH:MM:SS
 */
export function formTime({ utc, local = null }) {
  const ut = utc.slice(0, 19);
  return local === null || local === ut ? { time: ut, szon: "h0w" } : { time: local, szon: "au" };
}

// Minutes from Universal Time to a chart's local time: -240 for 08:00 local at 12:00 UT.
export const localOffset = (utc, local) => (Date.parse(`${local}Z`) - Date.parse(utc)) / 60_000;

/**
 * An offset in the words of ade.cgi's time zone line, to the nearest minute:
 * -240 is "4 h west", 330 "5 h 30 min east", 0 "GMT/UT".
 *
 * @param {number} minutes
 */
export function zoneWords(minutes) {
  const size = Math.round(Math.abs(minutes));
  if (size === 0) return "GMT/UT";
  const [hours, rest] = [Math.floor(size / 60), size % 60];
  return `${hours} h${rest === 0 ? "" : ` ${rest} min`} ${minutes < 0 ? "west" : "east"}`;
}

/**
 * What watchZone checks astro.com's automatic time zone against, or null when
 * the form is filled in as Universal Time and there is nothing to check: the
 * chart's offset, the date and time filled in, and the Universal Time to
 * enter instead.
 *
 * @param {{ utc: string, local?: string | null }} values
 * @returns {{ offsetMinutes: number, zone: string, filled: Record<string, string>,
 *   ut: Record<string, string>, utText: string } | null}
 */
export function zoneCheck({ utc, local = null }) {
  if (formTime({ utc, local }).szon !== "au") return null;
  const offset = localOffset(utc, local);
  const clock = ({ sday, imon, syar, ihou, smin }) => ({ sday, imon, syar, ihou, smin });
  return {
    offsetMinutes: Math.round(offset),
    zone: zoneWords(offset),
    filled: { ...clock(formValues({ utc, local })), szon: "au" },
    ut: { ...clock(formValues({ utc })), szon: "h0w" },
    utText: `${utc.slice(0, 10)} ${utc.slice(11, 16)}`,
  };
}

/**
 * The values for ade.cgi's fields for a decided UTC, the chart's local time,
 * and its town and name, by field name. The time and zone are formTime's. The
 * seconds are left out: the form takes whole minutes. The town, when there is
 * one, goes in the birth town field, scit, and the name, when there is one,
 * in the first and last name fields, sfnm and snam.
 *
 * @param {{ utc: string, local?: string | null, town?: string | null, name?: { first: string, last: string } | null }} values
 * @returns {{ sday: string, imon: string, syar: string, ihou: string, smin: string, szon: "au" | "h0w",
 *   scit?: string, sfnm?: string, snam?: string }}
 */
export function formValues({ utc, local = null, town = null, name = null }) {
  const { time, szon } = formTime({ utc, local });
  const [year, month, day] = time.slice(0, 10).split("-");
  return {
    sday: String(Number(day)),
    imon: String(Number(month)),
    syar: year,
    ihou: String(Number(time.slice(11, 13))),
    smin: time.slice(14, 16),
    szon,
    ...(town === null ? {} : { scit: town }),
    ...(name === null ? {} : { sfnm: name.first, snam: name.last }),
  };
}

// readFormPage and fillForm run in the form's tab. The browser sends the tab
// only each function's source, so neither can use anything else in this
// module, and each repeats the checks it needs.

/**
 * What the popup needs to know about an ade.cgi tab. auth is "signed-out" only
 * when the page greets "Hello [not logged in]", as every signed-out page seen
 * did; anything else is "unknown", as a signed-in page was. form is "blank"
 * only when the date and time are empty. A saved chart's form is assumed to
 * show its date and time, so it reads as "typed" and is never filled in.
 *
 * @returns {{ auth: "signed-out" | "unknown", form: "blank" | "typed" | "unrecognised" }}
 */
export function readFormPage() {
  const greetings = [...document.querySelectorAll("li.hello")].map((item) => item.textContent.trim());
  const auth = greetings.includes("Hello [not logged in]") ? "signed-out" : "unknown";
  const fields = document.forms.namedItem("start")?.elements;
  const names = ["sday", "imon", "syar", "ihou", "smin", "extset", "szon"];
  const field = (name) => fields?.namedItem(name) ?? null;
  if (!names.every(field)) return { auth, form: "unrecognised" };
  const typed = ["sday", "syar", "smin"].some((name) => field(name).value !== "") || field("ihou").value !== "";
  return { auth, form: typed ? "typed" : "blank" };
}

/**
 * Fills in a blank ade.cgi form with formValues' values, the way a person
 * would: the extended settings are opened so the time zone shows, each change
 * is announced to the page's own scripts, and the town field is focused for
 * the person to type in or pick astro.com's match. A town or name already
 * typed is kept. Never submits. Fills in nothing unless the form is still
 * blank and every value is one the form accepts.
 *
 * @param {ReturnType<typeof formValues>} values
 * @returns {{ filled: true } | { filled: false, form: "typed" | "unrecognised" }}
 */
export function fillForm(values) {
  const fields = document.forms.namedItem("start")?.elements;
  const field = (name) => fields?.namedItem(name) ?? null;
  if (![...Object.keys(values), "extset", "scit"].every(field)) return { filled: false, form: "unrecognised" };
  // What the person typed in these is theirs: only empty ones are filled in.
  const kept = ["scit", "sfnm", "snam"];
  const names = Object.keys(values).filter((name) => !kept.includes(name) || field(name).value === "");
  if (["sday", "syar", "smin", "ihou"].some((name) => field(name).value !== "")) return { filled: false, form: "typed" };

  // A select ignores a value none of its options has, so each is tried and put
  // back before anything is changed.
  for (const name of names) {
    const element = field(name);
    const before = element.value;
    element.value = values[name];
    const accepted = element.value === values[name];
    element.value = before;
    if (!accepted) return { filled: false, form: "unrecognised" };
  }

  field("extset").value = "open";
  const extended = document.getElementById("extended");
  if (extended) extended.style.display = "";
  for (const name of names) {
    const element = field(name);
    element.value = values[name];
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  field("scit").focus();
  return { filled: true };
}

// ade.cgi's time zone line, #zz in the extended settings, which the page
// fills in from adejs.cgi?func=get_su_mo_asc_map once a town is chosen, as
// seen on 2026-11-01: "time zone:" then "4 h west", "3 h 30 min west",
// "5 h 45 min east" or "GMT/UT", a comma, and "Standard Time", "Daylight
// Saving T." or "War Time"; or "Local Mean Time" with no offset. A skipped or
// repeated clock time adds a line starting "ATTENTION:". It is empty until a
// town is chosen.

/**
 * Watches the time zone astro.com's automatic time zone picks, once a form is
 * filled in with it, and compares it with zoneCheck's offset. When they
 * differ, or the line can't be read, a note goes under the time zone row with
 * a button that enters the chart's Universal Time with the 00:00 GMT / UT
 * time zone instead. A wrong town gives a wrong zone and wrong coordinates,
 * which Universal Time doesn't mend, so the note asks about the town first. Stops once the date, time or time zone differs from what was filled in, so
 * whatever the person changes is theirs, or once the button is used. Never
 * submits.
 *
 * @param {NonNullable<ReturnType<typeof zoneCheck>>} check
 * @returns {{ watching: boolean }}
 */
export function watchZone(check) {
  const fields = document.forms.namedItem("start")?.elements;
  const field = (name) => fields?.namedItem(name) ?? null;
  const zone = document.getElementById("zz");
  // One watch per line, marked on it, whether or not its note is showing.
  if (!zone || !Object.keys(check.ut).every(field) || zone.dataset.astrochartBridge) return { watching: false };
  zone.dataset.astrochartBridge = "watching";

  const note = document.createElement("div");
  note.id = "astrochart-bridge-zone";
  // #zz floats right of the time zone select, so the note goes after the
  // select, below both, as seen on 2026-11-01.
  note.style.cssText = "clear: both; margin: 0.5em 0; padding: 0.5em 0.75em; border: 2px solid #b00020; background: #fff; color: #222;";
  const message = document.createElement("p");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Enter in Universal Time";
  note.append(message, button);

  const observer = new MutationObserver(() => update());
  const stop = () => {
    observer.disconnect();
    delete zone.dataset.astrochartBridge;
  };
  const unchanged = () => Object.entries(check.filled).every(([name, value]) => field(name).value === value);
  const show = (text) => {
    message.textContent = `AstroChart Bridge: ${text}`;
    if (!note.isConnected) field("szon").after(note);
  };

  function update() {
    if (!unchanged()) {
      stop();
      note.remove();
      return;
    }
    // \s takes in the no-break space after the comma.
    const text = zone.textContent.replace(/\s+/g, " ").trim();
    if (text === "") return note.remove();
    // Its <br>s add no space, so "time zone:" and "ATTENTION:" run into the text around them.
    const line = text.replace(/^time zone: ?/, "").split("ATTENTION")[0].trim();
    const read = /^(?:GMT\/UT|(\d{1,2}) h(?: (\d{1,2}) min)? (west|east)),/.exec(line);
    if (!read) {
      show(`astro.com's time zone here is "${line}", which can't be checked against this chart's ${check.zone}. Check that the town is right. If it is, you can enter the chart in Universal Time instead.`);
      return;
    }
    const size = Number(read[1] ?? 0) * 60 + Number(read[2] ?? 0);
    const minutes = read[3] === "west" ? 0 - size : size;
    if (minutes === check.offsetMinutes) return note.remove();
    const words = line.split(",")[0];
    show(`this chart is ${check.zone} of Universal Time, but astro.com's automatic time zone for this town is ${words}. Check that the town is right. If it is, enter the chart in Universal Time instead.`);
  }

  button.addEventListener("click", () => {
    stop();
    for (const [name, value] of Object.entries(check.ut)) {
      const element = field(name);
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    message.textContent = `AstroChart Bridge entered ${check.utText} with the 00:00 GMT / UT time zone. That is the chart's own Universal Time, so the moment is the chart's, whatever astro.com's warning about manual time zones says.`;
    button.remove();
  });

  observer.observe(zone, { childList: true, characterData: true, subtree: true });
  update();
  return { watching: true };
}
