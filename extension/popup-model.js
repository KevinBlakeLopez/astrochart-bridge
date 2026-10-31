import { parseOffset, utcFromOffset } from "./core/civiltime.js";

const CLOCK_NOTE = "Stellarium Web's clock shows your computer's time zone and keeps running.";

// Seen on 2026-10-31: stellarium-web.org's Google Ads tag sent the full link,
// date and coordinates included, as its url= parameter.
const PRIVACY_NOTE =
  "Opening the sky sends this date, time and place to stellarium-web.org, and its page passes the link on to Google's advertising tags.";

// Shown on the choose and enter-offset screens, the privacy note last, just above
// Open sky. The ready screen knows its UTC, so it names the exact clock time instead.
const NOTES = [CLOCK_NOTE, PRIVACY_NOTE];

const RUNNING = "The clock starts running at once; its pause button stops it.";

const REFUSALS = {
  transit: "This is a transit chart. Chart Bridge opens natal charts only.",
  synastry: "This is a synastry or compatibility chart. Chart Bridge opens natal charts only.",
  unsupported: "Open an Astro-Seek birth chart to use Chart Bridge.",
  "page-url-mismatch": "The page doesn't match its address. Reload the chart and try again.",
};

// Every other refusal means the chart page couldn't be read. They share one
// message and show their code, so a bug report says which check failed.
const UNREADABLE = "Chart Bridge couldn't read this chart page.";

const WARNINGS = {
  "zone-label-unknown": ({ zoneLabel }) =>
    zoneLabel === null
      ? "Astro-Seek printed no zone label, so its Universal Time is used as printed."
      : `Astro-Seek's zone label "${abbreviation(zoneLabel)}" isn't one Chart Bridge can check, so its Universal Time is used as printed.`,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * What the popup shows for an analyzePage result. Every decision about the
 * screen is made here, so popup.js only renders it.
 *
 * @param {ReturnType<typeof import("./core/index.js").analyzePage>} result
 * @param {{ timeZone?: string }} [options]  the computer's time zone; when left
 *   out, Intl uses the one this code runs in, which the popup shares with the
 *   Stellarium tab. Tests pass it so they give the same result anywhere.
 */
export function viewFor(result, { timeZone } = {}) {
  if (result.kind === "refused") {
    return Object.hasOwn(REFUSALS, result.reason)
      ? { state: "refused", message: REFUSALS[result.reason] }
      : { state: "refused", message: UNREADABLE, code: result.reason };
  }

  const { local, zoneLabel, lat, lng } = result;
  const localRow = ["Local time", localText(local, zoneLabel)];
  const placeRow = ["Place", placeText(lat, lng)];
  const sky = (utc) => ({ utc, lat, lng });

  if (result.utcSource === "needs-choice") {
    const label = abbreviation(zoneLabel);
    const printed = result.candidates.find((candidate) => candidate.basis === "printed UT");
    return {
      state: "choose",
      rows: [localRow, placeRow],
      message:
        `Astro-Seek's page contradicts itself: it labels ${local.slice(11, 16)} as ${label}, ` +
        `but its Universal Time implies ${offsetText(printed.offsetMinutes)}.`,
      choices: result.candidates.map((candidate) => ({
        label:
          `${utcText(candidate.utc)} UTC, ` +
          `${candidate === printed ? "as Astro-Seek printed" : `as the label ${label} says`} ` +
          `(${offsetText(candidate.offsetMinutes)})`,
        sky: sky(candidate.utc),
      })),
      notes: [...NOTES],
    };
  }

  if (result.utcSource === "needs-offset") {
    return {
      state: "enter-offset",
      rows: [localRow, placeRow],
      message: "Astro-Seek didn't print a Universal Time. Enter the UTC offset at the birth place, as ±HH:MM.",
      notes: [...NOTES],
      chart: { local, lat, lng },
    };
  }

  return {
    state: "ready",
    rows: [localRow, ["Offset", offsetText(result.offsetMinutes)], ["UTC", utcText(result.utc)], placeRow],
    warnings: (result.warnings ?? []).map((code) => WARNINGS[code]?.(result) ?? code),
    notes: [clockNote(result.utc, local, timeZone), PRIVACY_NOTE],
    sky: sky(result.utc),
  };
}

/**
 * The UTC preview for what the user typed in the offset field, or null while
 * it isn't a valid ±HH:MM offset.
 *
 * @param {{ chart: { local: string, lat: number, lng: number } }} view  an enter-offset view
 * @param {string} text
 */
export function offsetPreview(view, text) {
  const minutes = parseOffset(text.trim());
  if (minutes === null) return null;
  const { local, lat, lng } = view.chart;
  const utc = utcFromOffset(local, minutes);
  return { utcText: utcText(utc), sky: { utc, lat, lng } };
}

// "EDT, DST" → "EDT"
const abbreviation = (zoneLabel) => zoneLabel.split(",")[0].trim();

// "2024-04-17T08:00:00" with "EDT, DST" → "17 Apr 2024, 08:00 (EDT, DST)"
function localText(local, zoneLabel) {
  const [year, month, day] = local.slice(0, 10).split("-");
  const text = `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}, ${local.slice(11, 16)}`;
  return zoneLabel === null ? text : `${text} (${zoneLabel})`;
}

// "2024-04-17T12:00:00Z" → "2024-04-17 12:00"
const utcText = (utc) => `${utc.slice(0, 10)} ${utc.slice(11, 16)}`;

// What Stellarium Web's clock will show (the UTC instant in the computer's time
// zone) next to the birth time. Both carry their date, since they can differ.
function clockNote(utc, local, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(utc))
      .map(({ type, value }) => [type, value]),
  );
  const clock = timeOnDay(`${parts.hour}:${parts.minute}`, parts.month, parts.day);
  const birth = timeOnDay(local.slice(11, 16), local.slice(5, 7), local.slice(8, 10));
  return clock === birth
    ? `Stellarium Web's clock will show ${clock}, the same as the birthplace. ${RUNNING}`
    : `Stellarium Web's clock will show ${clock}, your computer's time. That's ${birth} at the birthplace. ${RUNNING}`;
}

// "05:00", "4", "17" → "05:00 on 17 Apr". The month name comes from MONTHS, not
// the locale, so it always matches the Local time row.
const timeOnDay = (time, month, day) => `${time} on ${Number(day)} ${MONTHS[Number(month) - 1]}`;

// -240 → "UTC-04:00"
function offsetText(minutes) {
  const size = Math.abs(minutes);
  const pad = (n) => String(n).padStart(2, "0");
  return `UTC${minutes < 0 ? "-" : "+"}${pad(Math.floor(size / 60))}:${pad(size % 60)}`;
}

// 40.716667, -74 → "40°43'N, 74°0'W", the way the Astro-Seek page writes it.
const placeText = (lat, lng) => `${angleText(lat, "N", "S")}, ${angleText(lng, "E", "W")}`;

function angleText(value, positive, negative) {
  // Rounding the total in minutes lets 59.99' carry into the next degree.
  const minutes = Math.round(Math.abs(value) * 60);
  return `${Math.floor(minutes / 60)}°${minutes % 60}'${value < 0 ? negative : positive}`;
}
