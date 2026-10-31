// Minutes east of UTC for each zone label seen on a captured Astro-Seek page.
// Ambiguous abbreviations such as IST or CST are never added: they stay
// unknown, and the printed UT is used with a warning.
export const ZONE_OFFSETS = Object.freeze({ EST: -300, EDT: -240, EWT: -240, AEST: 600, AEDT: 660 });

/**
 * Decides the UTC instant for a chart that readChart returned.
 *
 * @param {{ local: string, zoneLabel: string | null, printedUt: string | null }} chart
 * @returns {{ utc: string, utcSource: "printed", offsetMinutes: number, warnings?: ["zone-label-unknown"] }
 *   | { utc: null, utcSource: "needs-choice", reason: "zone-label-mismatch",
 *       candidates: { utc: string, offsetMinutes: number, basis: string }[] }
 *   | { utc: null, utcSource: "needs-offset", reason: "no-printed-ut" }}
 */
export function resolveUtc({ local, zoneLabel, printedUt }) {
  if (printedUt === null) return { utc: null, utcSource: "needs-offset", reason: "no-printed-ut" };

  // The local wall-clock time read as if it were UTC. The page prints UT
  // without seconds, so the offset is worked out to the minute.
  const wallMs = Date.parse(`${local}Z`);
  const printedOffset = Math.floor((wallMs - Date.parse(printedUt)) / 60_000);

  const abbreviation = zoneLabel?.split(",")[0].trim() ?? null;
  const labelOffset = abbreviation !== null && Object.hasOwn(ZONE_OFFSETS, abbreviation)
    ? ZONE_OFFSETS[abbreviation]
    : null;

  if (labelOffset === null) {
    return { utc: printedUt, utcSource: "printed", offsetMinutes: printedOffset, warnings: ["zone-label-unknown"] };
  }
  if (labelOffset !== printedOffset) {
    return {
      utc: null,
      utcSource: "needs-choice",
      reason: "zone-label-mismatch",
      candidates: [
        { utc: printedUt, offsetMinutes: printedOffset, basis: "printed UT" },
        { utc: isoUtc(wallMs - labelOffset * 60_000), offsetMinutes: labelOffset, basis: `zone label ${abbreviation}` },
      ],
    };
  }
  return { utc: printedUt, utcSource: "printed", offsetMinutes: printedOffset };
}

// "2021-03-14T07:30:00Z": the same form as printedUt, without milliseconds.
const isoUtc = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
