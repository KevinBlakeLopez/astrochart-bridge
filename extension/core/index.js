import * as astroseek from "./astroseek.js";
import * as astrocom from "./astrocom.js";
import { readHeader, resolveHeaderUtc } from "./chart-image.js";
import { resolveUtc, utcFromOffset } from "./civiltime.js";
import * as astrogold from "./astrogold.js";
import * as esotech from "./esotech.js";
import * as janus from "./janus.js";
import * as jhora from "./jhora.js";
import * as kepler from "./kepler.js";
import * as morinus from "./morinus.js";
import * as planetdance from "./planetdance.js";
import { resolvePrinted, resolveReadings } from "./printed-chart.js";
import { SIDEREAL_TOLERANCE_SECONDS, siderealGap } from "./sidereal.js";

const refused = (reason) => ({ kind: "refused", reason });

// Every site Chart Bridge reads, by hostname. extract runs in the chart's tab
// and returns the input its site's read takes. The browser sends the tab only
// the function's source, so it can't use anything else in this module. These
// are the only lines that touch a page, so the browser checks them by hand.
const SITES = new Map([
  [
    "horoscopes.astro-seek.com",
    {
      classifyUrl: astroseek.classifyUrl,
      extract: () => ({ text: document.body.innerText }),
      read({ url, input }) {
        const chart = astroseek.readChart({ url, text: input.text ?? "" });
        if (chart.kind === "refused") return chart;
        // printedUt only feeds resolveUtc; the result carries the decided utc instead.
        const { local, zoneLabel, lat, lng } = chart;
        return { kind: "natal", site: "astro-seek", local, zoneLabel, lat, lng, ...resolveUtc(chart) };
      },
    },
  ],
  [
    "www.astro.com",
    {
      classifyUrl: astrocom.classifyUrl,
      // Only the drawing links: an account chart page's text lists every
      // chart saved in the account.
      extract: () => ({ links: [...document.querySelectorAll('a[href*="pgid="]')].map((a) => a.href) }),
      read({ url, input }) {
        const chart = astrocom.readChart({ url, links: input.links ?? [] });
        if (chart.kind === "refused") return chart;
        // astro.com states the offset, daylight saving included, and prints no
        // zone label, so there is nothing to check it against.
        const { local, offsetMinutes, lat, lng } = chart;
        return {
          kind: "natal",
          site: "astro-com",
          local,
          zoneLabel: null,
          lat,
          lng,
          utc: utcFromOffset(local, offsetMinutes),
          utcSource: "declared",
          offsetMinutes,
        };
      },
    },
  ],
]);

function siteFor(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  return SITES.get(hostname) ?? null;
}

/**
 * Decides from the address alone whether a page is a natal chart on a site
 * Chart Bridge reads.
 *
 * @param {string} url
 * @returns {{ kind: "natal" } | { kind: "refused", reason: string }}
 */
export function classifyUrl(url) {
  const site = siteFor(url);
  return site ? site.classifyUrl(url) : refused("unsupported");
}

/**
 * The function to run in the page's tab, whose result is analyzePage's input,
 * or null for a site Chart Bridge doesn't read.
 *
 * @param {string} url
 * @returns {(() => object) | null}
 */
export function extractorFor(url) {
  return siteFor(url)?.extract ?? null;
}

/**
 * Everything Chart Bridge needs from one chart page, in the shape of a
 * fixture's expected block. Stops at the first refusal and returns it as is.
 * site names the site whose chart was read, so the popup knows whether the
 * chart is already on Astro-Seek.
 *
 * @param {{ url: string, input: object }} page  input is what extractorFor(url) returned in the tab
 * @returns {{ kind: "refused", reason: string }
 *   | { kind: "natal", site: "astro-seek" | "astro-com", local: string, zoneLabel: string | null, lat: number, lng: number }
 *     & (ReturnType<typeof resolveUtc> | { utc: string, utcSource: "declared", offsetMinutes: number })}
 */
export function analyzePage({ url, input }) {
  const page = classifyUrl(url);
  if (page.kind === "refused") return page;
  // A script that returned nothing reads like an empty page.
  return siteFor(url).read({ url, input: input ?? {} });
}

// The forms readText and readField give a date and a time.
const ENTRY_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_TIME = /^\d{2}:\d{2}:\d{2}$/;

/**
 * The same as analyzePage, for birth data the user confirmed on the paste
 * page's review form, as readText and readField give its values. Like an
 * astro.com chart, it states its offset, so the UTC follows from it.
 *
 * The form enables its button only once all five values are read, so a missing
 * or malformed one is a bug in the form and throws, like stellariumUrl. The
 * message names the field but not its value, which is birth data.
 *
 * @param {{ date: string, time: string, lat: number, lng: number, offsetMinutes: number }} entry
 *   date like "1985-06-15", time like "10:30:00", offsetMinutes east of UTC
 * @returns {{ kind: "natal", site: "text", local: string, zoneLabel: null, lat: number, lng: number,
 *   utc: string, utcSource: "declared", offsetMinutes: number }}
 */
export function analyzeEntry({ date, time, lat, lng, offsetMinutes }) {
  const local = `${date}T${time}`;
  const checks = {
    date: typeof date === "string" && ENTRY_DATE.test(date),
    time: typeof time === "string" && ENTRY_TIME.test(time),
    lat: Number.isFinite(lat) && Math.abs(lat) <= 90,
    lng: Number.isFinite(lng) && Math.abs(lng) <= 180,
    // -12:00 to +14:00, the range parseOffset accepts, to the second: a
    // local-mean-time offset has seconds.
    offsetMinutes:
      Number.isFinite(offsetMinutes) &&
      Math.abs(offsetMinutes * 60 - Math.round(offsetMinutes * 60)) < 1e-6 &&
      offsetMinutes >= -720 &&
      offsetMinutes <= 840,
  };
  const bad = Object.keys(checks).find((field) => !checks[field]);
  if (bad) throw new Error(`analyzeEntry needs a valid ${bad}`);
  // V8 (Node 24) reads 1985-02-30 as 2 March and 24:00 as the next day's
  // midnight rather than refusing them, so the instant is printed back and compared.
  const ms = Date.parse(`${local}Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 19) !== local) {
    throw new Error("analyzeEntry needs a valid date and time");
  }

  // The zone as written, such as "PDT (UTC-7)", stays on the form: as a zone
  // label it would print inside the Local time row.
  return {
    kind: "natal",
    site: "text",
    local,
    zoneLabel: null,
    lat,
    lng,
    utc: utcFromOffset(local, offsetMinutes),
    utcSource: "declared",
    offsetMinutes,
  };
}

// How a screenshot shows its site: Astro-Seek's labels start their lines, and
// astro.com's chart image prints "Univ.Time" where Astro-Seek spells it out.
// A desktop program's reader says itself whether its block is in the text.
const ASTRO_SEEK_LABELS = /^(Date of Birth|Universal Time)/m;
const ASTRO_COM_LABELS = /Univ\W*Time/;

// Programs whose readers return a record for resolvePrinted, or several
// readings of one for resolveReadings to choose between.
const printedBy = (reader) => (text) => {
  const chart = reader.read(text);
  if (Array.isArray(chart)) return resolveReadings(chart);
  return chart.kind === "refused" ? chart : resolvePrinted(chart);
};

const PROGRAM_READERS = [
  { shows: esotech.detect, analyze: printedBy(esotech) },
  { shows: astrogold.detect, analyze: printedBy(astrogold) },
  { shows: morinus.detect, analyze: printedBy(morinus) },
  { shows: planetdance.detect, analyze: printedBy(planetdance) },
  { shows: jhora.detect, analyze: printedBy(jhora) },
  { shows: kepler.detect, analyze: printedBy(kepler) },
  { shows: janus.detect, analyze: printedBy(janus) },
];

const SCREENSHOT_READERS = [
  { shows: (text) => ASTRO_SEEK_LABELS.test(text), analyze: analyzeAstroSeekScreenshot },
  { shows: (text) => ASTRO_COM_LABELS.test(text), analyze: analyzeChartImage },
  ...PROGRAM_READERS,
];

/**
 * analyzeScreenshot for text pasted from a desktop astrology program, with
 * only the programs' readers: Astro-Seek's labels and astro.com's
 * "Univ.Time" turn up in ordinary labelled text too. Null when no program's
 * layout is in the text, so the paste page reads it as labelled text alone.
 *
 * @param {string} text
 * @returns {ReturnType<typeof resolvePrinted> | { kind: "refused", reason: string } | null}
 */
export function analyzeProgramText(text) {
  const shown = PROGRAM_READERS.filter((reader) => reader.shows(text));
  if (shown.length === 0) return null;
  if (shown.length > 1) return refused("ambiguous-screenshot");
  return shown[0].analyze(text);
}

/**
 * The same as analyzePage, for the OCR text of a screenshot of an Astro-Seek
 * chart page, an astro.com chart image, a Solar Fire wheel, Astro Gold's chart
 * details or Edit Chart screen, a Morinus status bar or square chart, a Valens
 * wheel, Planetdance's wheel, data screen or Vedic screen, Jagannatha Hora's
 * birth data, a Kepler or Sirius wheel, or a Janus wheel or report. With no
 * URL to check the text against, the checks are whatever the screenshot
 * prints: a sidereal time that must fit the UT and longitude, a weekday that
 * must fall on the date, a zone label or zone that must give the offset, and a
 * local time a real UTC offset away from the UT. Nothing checks the latitude.
 *
 * @param {string} text  OCR output
 * @returns {ReturnType<typeof analyzePage> | ReturnType<typeof resolvePrinted>}
 */
export function analyzeScreenshot(text) {
  const shown = SCREENSHOT_READERS.filter((reader) => reader.shows(text));
  if (shown.length > 1) return refused("ambiguous-screenshot");
  // With nothing recognised, Astro-Seek's reader refuses it as unreadable.
  return (shown[0]?.analyze ?? analyzeAstroSeekScreenshot)(text);
}

function analyzeChartImage(text) {
  const header = readHeader(text);
  if (header.kind === "refused") return header;
  const resolved = resolveHeaderUtc(header);
  if (resolved.kind === "refused") return resolved;
  // astro.com prints Univ.Time, so the offset comes from it, and no zone label
  // Chart Bridge could check. The screenshot page adds its own Astro-Seek button.
  const { local, lat, lng } = header;
  const { utc, utcSource, offsetMinutes } = resolved;
  return { kind: "natal", site: "astro-com", local, zoneLabel: null, lat, lng, utc, utcSource, offsetMinutes };
}

function analyzeAstroSeekScreenshot(text) {
  const chart = astroseek.readScreenshot(text);
  if (chart.kind === "refused") return chart;

  if (siderealGap(chart.printedUt, chart.lng, chart.siderealSeconds) > SIDEREAL_TOLERANCE_SECONDS) {
    return { kind: "refused", reason: "sidereal-mismatch" };
  }
  // A misread local date would otherwise show up as an offset of days or years.
  // -12:00 to +14:00 is the range parseOffset accepts.
  const offsetMinutes = (Date.parse(`${chart.local}Z`) - Date.parse(chart.printedUt)) / 60_000;
  if (offsetMinutes < -720 || offsetMinutes > 840) return { kind: "refused", reason: "offset-out-of-range" };

  // The text is an Astro-Seek page's. The screenshot page adds its own Astro-Seek button.
  const { local, zoneLabel, lat, lng } = chart;
  return { kind: "natal", site: "astro-seek", local, zoneLabel, lat, lng, ...resolveUtc(chart) };
}
