const HOST = "horoscopes.astro-seek.com";

const UNSUPPORTED = { kind: "refused", reason: "unsupported" };

// Pages are recognised by path, never by parameters: specialised views such as
// /calculate-asteroids/ reuse the bare narozeni_* parameters, and transit pages
// contain "narozeni_" inside muz_narozeni_* and zena_narozeni_*.
const PAGES = new Map([
  ["/calculate-birth-chart-horoscope-online/", { kind: "natal" }],
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
    return { ...UNSUPPORTED };
  }
  if (parsed.hostname !== HOST) return { ...UNSUPPORTED };
  return { ...(PAGES.get(parsed.pathname) ?? UNSUPPORTED) };
}
