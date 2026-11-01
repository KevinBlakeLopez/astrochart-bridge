import * as astroseek from "./astroseek.js";
import * as astrocom from "./astrocom.js";
import { resolveUtc, utcFromOffset } from "./civiltime.js";

const refused = (reason) => ({ kind: "refused", reason });

// Every site Chart Bridge reads, by hostname. extract runs in the chart's tab
// and returns the input its site's read takes. Chrome sends the tab only the
// function's source, so it can't use anything else in this module. These are
// the only lines that touch a page, so the browser checks them by hand.
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
        return { kind: "natal", local, zoneLabel, lat, lng, ...resolveUtc(chart) };
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
 *
 * @param {{ url: string, input: object }} page  input is what extractorFor(url) returned in the tab
 * @returns {{ kind: "refused", reason: string }
 *   | { kind: "natal", local: string, zoneLabel: string | null, lat: number, lng: number }
 *     & (ReturnType<typeof resolveUtc> | { utc: string, utcSource: "declared", offsetMinutes: number })}
 */
export function analyzePage({ url, input }) {
  const page = classifyUrl(url);
  if (page.kind === "refused") return page;
  // A script that returned nothing reads like an empty page.
  return siteFor(url).read({ url, input: input ?? {} });
}
