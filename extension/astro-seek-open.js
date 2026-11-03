// Opens Astro-Seek's Add person form for a chart, filled in by its address
// (astroSeekSaveUrl), and chooses its Birth city, and its Gender when the
// chart gives one, once the user has granted access to www.astro-seek.com.
// The tab opens behind the popup. The person always has the last word: Add
// person itself is theirs. Each function takes the browser APIs it uses, so
// tests can pass stand-ins.
import {
  ASTRO_SEEK_GENDERS,
  astroSeekSaveUrl,
  chooseCity,
  chooseGender,
  guardChartPlace,
  isSavePage,
  readCityList,
  readSavePage,
  savePlace,
  showCityChoice,
  typeCity,
} from "./core/astroseek.js";
import { TOWN_LIMIT_KM } from "./core/towns.js";
import { tabLoaded } from "./tabs.js";

// The manifest's optional host permission, asked for when Save in Astro-Seek… is clicked.
export const ASTRO_SEEK_ACCESS = { origins: ["https://www.astro-seek.com/*"] };

// Astro-Seek's pages wait for their advertising before they count as loaded,
// as astro.com's do, so the wait is astro.com's.
export const LOAD_TIMEOUT_MS = 20_000;

// Astro-Seek's city search hasn't been timed. astro.com's list took about 2.5
// seconds, so the wait is astro.com's too.
export const CITY_LIST_TIMEOUT_MS = 8_000;
const CITY_LIST_POLL_MS = 250;

/**
 * Opens the Add person form for a chart in a background tab and, once it has
 * loaded signed in, or with no way to tell, keeps the chart's coordinates
 * and UT/GMT in it (guardChartPlace), sets its Gender to the chart's when it
 * has one (chooseGender), and chooses the chart's town as its Birth city, or
 * asks (chooseFormCity). A chart with no town has its box ask the person to
 * type one. Signed out, or on a page that isn't the form as expected, nothing
 * is filled in and the tab is left for the person.
 *
 * @param {{ tabs: typeof chrome.tabs, scripting: typeof chrome.scripting }} browser
 * @param {{ values: { utc: string, lat: number, lng: number, town?: string | null, name?: string | null,
 *   gender?: "female" | "male" | "event" | "horary" | null },
 *   timeoutMs?: number, cityWait?: { timeoutMs?: number, pollMs?: number } }} request
 * @returns {Promise<{ outcome: "filled", tabId: number }
 *   | { outcome: "signed-out", tabId: number }
 *   | { outcome: "not-filled", tabId: number, page: "not-loaded" | "elsewhere" | "city-typed" | "unrecognised" }>}
 */
export async function openAndSave({ tabs, scripting }, { values, timeoutMs = LOAD_TIMEOUT_MS, cityWait = {} }) {
  const { utc, lat, lng, town = null, name = null, gender = null } = values;
  const { id: tabId } = await tabs.create({ url: astroSeekSaveUrl({ utc, lat, lng }, { name }), active: false });
  const notFilled = (page) => ({ outcome: "not-filled", tabId, page });

  const tab = await tabLoaded(tabs, tabId, timeoutMs);
  if (!tab) return notFilled("not-loaded");
  // Signed out, Astro-Seek may send the address elsewhere, such as to its
  // sign-in page; what it does hasn't been seen.
  if (!isSavePage(tab.url ?? "")) return notFilled("elsewhere");

  try {
    const [{ result: page }] = await scripting.executeScript({ target: { tabId }, func: readSavePage });
    if (page?.auth === "signed-out") return { outcome: "signed-out", tabId };
    if (page?.form !== "city-empty") return notFilled(page?.form === "city-typed" ? "city-typed" : "unrecognised");

    const [{ result: guard }] = await scripting.executeScript({ target: { tabId }, func: guardChartPlace, args: [savePlace({ lat, lng })] });
    if (!guard?.guarding) return notFilled("unrecognised");
    const option = ASTRO_SEEK_GENDERS[gender] ?? null;
    const [{ result: set }] = option ? await scripting.executeScript({ target: { tabId }, func: chooseGender, args: [option.value] }) : [{}];
    const genderLabel = set?.set ? option.label : null;
    const choice = town === null ? { kind: "no-town" } : await chooseFormCity(scripting, tabId, { town, lat, lng }, cityWait);
    if (choice !== null) {
      await scripting.executeScript({ target: { tabId }, func: showCityChoice, args: [choice, town, TOWN_LIMIT_KM, genderLabel] });
    }
  } catch {
    // The tab navigated away, or the browser refused the script.
    return notFilled("unrecognised");
  }
  return { outcome: "filled", tabId };
}

/**
 * Types the chart's town into Birth city, waits for Astro-Seek's list of its
 * matches and decides which to choose (chooseCity). A list that doesn't come
 * in time is "no-list", for the box to say so. Birth city typed in before or
 * while waiting is the person's, so nothing is chosen: null.
 *
 * @param {typeof chrome.scripting} scripting
 * @param {number} tabId
 * @param {{ town: string, lat: number, lng: number }} chart
 * @param {{ timeoutMs?: number, pollMs?: number }} [wait]
 * @returns {Promise<ReturnType<typeof chooseCity> | { kind: "no-list" } | null>}
 */
export async function chooseFormCity(scripting, tabId, chart, { timeoutMs = CITY_LIST_TIMEOUT_MS, pollMs = CITY_LIST_POLL_MS } = {}) {
  const [{ result: typed }] = await scripting.executeScript({ target: { tabId }, func: typeCity, args: [chart.town] });
  if (!typed?.typed) return null;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [{ result: list }] = await scripting.executeScript({ target: { tabId }, func: readCityList, args: [chart.town] });
    if (list?.state === "listed") return chooseCity(list.labels, chart);
    if (list?.state !== "waiting") return null;
    if (Date.now() >= deadline) return { kind: "no-list" };
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
