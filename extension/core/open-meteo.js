// Open-Meteo's archive of ERA5, the reanalysis of the world's weather since
// 1940, for Helioscope's weather check: the address that asks it for the
// hours a chart's twilights need, and what's read from its answer. Nothing
// here fetches or uses a browser API. Helioscope's page asks only when the
// user clicks Check that night's weather.
//
// It sends as little as the answer needs: the place rounded to ERA5's grid,
// which loses nothing ERA5 has, and whole months, so the day isn't given
// away. Never the chart's time, name or town.

// The archive's origin, which Helioscope's page policy lets it reach.
export const ARCHIVE_ORIGIN = "https://archive-api.open-meteo.com";
const ARCHIVE = `${ARCHIVE_ORIGIN}/v1/archive`;

// ERA5's first day. The archive refuses an earlier one, and a day after
// today, with HTTP 400.
export const FIRST_DAY = "1940-01-01";

// Degrees: ERA5's grid, about 25 km.
const GRID = 0.25;

// What's asked for at each hour, and the unit each must come in.
const UNITS = Object.freeze({
  cloud_cover: "%",
  cloud_cover_low: "%",
  cloud_cover_mid: "%",
  cloud_cover_high: "%",
  relative_humidity_2m: "%",
  temperature_2m: "°C",
  surface_pressure: "hPa",
});
const PERCENT = Object.keys(UNITS).filter((name) => UNITS[name] === "%");

const HOUR = 3_600_000;

/**
 * The hour an instant is nearest, named as the archive names its hours in GMT.
 *
 * @param {string} utc  an ISO instant
 * @returns {string}  "YYYY-MM-DDTHH:00"
 */
export function nearestHour(utc) {
  return `${new Date(Math.round(Date.parse(utc) / HOUR) * HOUR).toISOString().slice(0, 13)}:00`;
}

/**
 * The address that asks the archive for the weather at these hours, at the
 * place: ERA5 alone, in GMT, every hour of the months they fall in, up to
 * today.
 *
 * @param {{ lat: number, lng: number }} place
 * @param {string[]} hours  from nearestHour, at least one
 * @param {string} today  the UTC date, "YYYY-MM-DD": the last day the archive takes
 * @returns {{ kind: "request", url: string } | { kind: "refused", reason: "before-1940" | "future" }}
 */
export function weatherRequest({ lat, lng }, hours, today) {
  const days = hours.map((hour) => hour.slice(0, 10)).sort();
  const [first, last] = [days[0], days.at(-1)];
  if (first < FIRST_DAY) return { kind: "refused", reason: "before-1940" };
  if (last > today) return { kind: "refused", reason: "future" };
  const monthEnd = lastOfMonth(last);
  const query = new URLSearchParams({
    latitude: onGrid(lat),
    longitude: onGrid(lng),
    start_date: `${first.slice(0, 7)}-01`,
    end_date: monthEnd < today ? monthEnd : today,
    hourly: Object.keys(UNITS).join(","),
    models: "era5",
    timezone: "GMT",
  });
  return { kind: "request", url: `${ARCHIVE}?${query}` };
}

/**
 * The archive's answer at each hour asked for: the cloud cover in all and at
 * each height, in %, and the air at 2 m as Swiss Ephemeris takes it. An hour
 * the answer doesn't have, or has without every value, is null: the archive
 * answers the days ERA5 hasn't reached yet, about the last five, with nulls.
 *
 * @param {unknown} answer  the archive's JSON
 * @param {string[]} hours  from nearestHour
 * @returns {{ kind: "weather", at: Record<string, Reading | null> } | { kind: "failed", reason: "unexpected-answer" }}
 */
export function readWeather(answer, hours) {
  if (!inShape(answer)) return { kind: "failed", reason: "unexpected-answer" };
  const { hourly } = answer;
  const at = {};
  for (const hour of hours) {
    const i = hourly.time.indexOf(hour);
    const value = (name) => (i === -1 ? null : hourly[name][i]);
    at[hour] = Object.keys(UNITS).some((name) => value(name) === null)
      ? null
      : {
          cloud: { total: value("cloud_cover"), low: value("cloud_cover_low"), mid: value("cloud_cover_mid"), high: value("cloud_cover_high") },
          air: { pressure: value("surface_pressure"), temperature: value("temperature_2m"), humidity: value("relative_humidity_2m") },
        };
  }
  return { kind: "weather", at };
}

// An answer in the shape asked for: hours in GMT, and each value in its unit,
// a number or null for every hour. A percentage outside 0 to 100, or a
// pressure of 0 or less, which Swiss Ephemeris would take as one to fill in,
// isn't weather. Anything else is refused rather than guessed at.
function inShape(answer) {
  const hourly = answer?.hourly;
  if (answer?.utc_offset_seconds !== 0 || !Array.isArray(hourly?.time)) return false;
  if (!hourly.time.every((hour) => typeof hour === "string")) return false;
  const fits = (name, check) =>
    answer.hourly_units?.[name] === UNITS[name] &&
    Array.isArray(hourly[name]) &&
    hourly[name].length === hourly.time.length &&
    hourly[name].every((value) => value === null || (Number.isFinite(value) && check(value)));
  return (
    PERCENT.every((name) => fits(name, (value) => value >= 0 && value <= 100)) &&
    fits("temperature_2m", () => true) &&
    fits("surface_pressure", (value) => value > 0)
  );
}

// The nearest point on ERA5's grid, as the address writes it: 40.75, -74, 0.
const onGrid = (degrees) => String(Math.round(degrees / GRID) * GRID + 0);

// "2025-02-28" for any day of February 2025.
function lastOfMonth(day) {
  const [year, month] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/**
 * @typedef {{ cloud: { total: number, low: number, mid: number, high: number },
 *   air: { pressure: number, temperature: number, humidity: number } }} Reading
 *   cloud cover in %, pressure in hPa at the surface, temperature in °C and relative humidity in %, at 2 m
 */
