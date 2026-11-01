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
        { utc: utcFromOffset(local, labelOffset), offsetMinutes: labelOffset, basis: `zone label ${abbreviation}` },
      ],
    };
  }
  return { utc: printedUt, utcSource: "printed", offsetMinutes: printedOffset };
}

// "+05:30". The sign is required, so a positive offset can't be entered by leaving it out.
const OFFSET_TEXT = /^([+-])(\d{2}):(\d{2})$/;

/**
 * Minutes east of UTC for an offset written as ±HH:MM, or null. Accepts
 * -12:00 to +14:00, the range of offsets in use today.
 *
 * @param {string} text
 * @returns {number | null}
 */
export function parseOffset(text) {
  const match = OFFSET_TEXT.exec(text);
  if (!match) return null;
  const [, sign, hours, minutes] = match;
  if (Number(minutes) > 59) return null;
  const total = Number(hours) * 60 + Number(minutes);
  // "0 - total" rather than "-total" keeps -00:00 at 0 instead of -0.
  const offset = sign === "-" ? 0 - total : total;
  return offset >= -720 && offset <= 840 ? offset : null;
}

/**
 * The UTC instant for a local wall-clock time and an offset in minutes east
 * of UTC. "2021-03-14T02:30:00" at -300 gives "2021-03-14T07:30:00Z".
 *
 * @param {string} local
 * @param {number} offsetMinutes
 * @returns {string}
 */
export function utcFromOffset(local, offsetMinutes) {
  return isoUtc(Date.parse(`${local}Z`) - offsetMinutes * 60_000);
}

// "2021-03-14T07:30:00Z": the same form as printedUt, without milliseconds.
export const isoUtc = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
