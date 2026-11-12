// An instant as the pages that work things out from a chart say it, at the
// chart's own offset: Helioscope's and the parans page. The extension has no
// time zones to give another.
import { text } from "./messages/index.js";

/**
 * A UTC instant at the chart's offset, to the nearest minute, as "18:15", or
 * with its day, "18:15 on 10 Jan", when that isn't the chart's own.
 *
 * @param {string} utc  an ISO instant
 * @param {{ local: string, offsetMinutes: number }} chart  a normalized chart
 * @returns {string}
 */
export function atChartOffset(utc, chart) {
  const words = text().times;
  const minute = 60_000;
  const local = new Date(Math.round((Date.parse(utc) + chart.offsetMinutes * minute) / minute) * minute).toISOString();
  const time = local.slice(11, 16);
  if (local.slice(0, 10) === chart.local.slice(0, 10)) return time;
  const [, month, day] = local.slice(0, 10).split("-").map(Number);
  return words.onDay(time, words.dayMonth(day, month));
}
