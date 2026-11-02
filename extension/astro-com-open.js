// Opens astro.com's birth data form for a chart and fills it in as it opens,
// once the user has granted access to www.astro.com. The popup stays open
// while it does: the tab opens behind it, and comes to the front only when
// there is nothing left for the user to decide. Each function takes the
// browser APIs it uses, so tests can pass stand-ins.
import { fillForm, formValues, isBirthDataForm, readFormPage, watchZone, zoneCheck } from "./core/astrocom.js";
import { holdForTab, releaseTab } from "./pending.js";

// The manifest's optional host permission, asked for when the form button is clicked.
export const ASTRO_COM_ACCESS = { origins: ["https://www.astro.com/*"] };

// astro.com's form loaded within a few seconds when seen; its page waits for
// its advertising before it counts as loaded, so the wait allows for more.
export const LOAD_TIMEOUT_MS = 20_000;

/**
 * Waits for a tab to finish loading. Listens only while it waits.
 *
 * @param {typeof chrome.tabs} tabs
 * @param {number} tabId
 * @param {number} timeoutMs
 * @returns {Promise<chrome.tabs.Tab | null>}  the loaded tab, or null when it
 *   closed or didn't load in time
 */
export function tabLoaded(tabs, tabId, timeoutMs) {
  return new Promise((resolve) => {
    let timer;
    const finish = (tab) => {
      clearTimeout(timer);
      tabs.onUpdated.removeListener(onUpdated);
      tabs.onRemoved.removeListener(onRemoved);
      resolve(tab);
    };
    const onUpdated = (id, change, tab) => {
      if (id === tabId && change.status === "complete") finish(tab);
    };
    const onRemoved = (id) => {
      if (id === tabId) finish(null);
    };
    tabs.onUpdated.addListener(onUpdated);
    tabs.onRemoved.addListener(onRemoved);
    timer = setTimeout(() => finish(null), timeoutMs);
    // The tab may have loaded before the listeners were added.
    tabs.get(tabId).then(
      (tab) => tab.status === "complete" && finish(tab),
      () => finish(null),
    );
  });
}

/**
 * Opens the form in a background tab, keeps the values for it, and fills it
 * in once it has loaded, unless the browser is seen signed out or the form
 * isn't blank: those are left for the user to choose, with the values still
 * kept. Anything that goes wrong also leaves the values kept, for the
 * two-click way: the toolbar icon on the astro.com tab.
 *
 * @param {{ tabs: typeof chrome.tabs, scripting: typeof chrome.scripting, storage: chrome.storage.StorageArea }} browser
 * @param {{ url: string, values: { utc: string, lat: number, lng: number, local: string | null, town: string | null },
 *   timeoutMs?: number }} request
 * @returns {Promise<{ outcome: "filled", tabId: number }
 *   | { outcome: "choose", tabId: number, page: { kind: "form", auth: "signed-out" | "unknown", form: string } }
 *   | { outcome: "not-filled", tabId: number }>}
 */
export async function openAndFill({ tabs, scripting, storage }, { url, values, timeoutMs = LOAD_TIMEOUT_MS }) {
  const { id: tabId } = await tabs.create({ url, active: false });
  await holdForTab(storage, tabId, values);
  const notFilled = { outcome: "not-filled", tabId };

  const tab = await tabLoaded(tabs, tabId, timeoutMs);
  if (!tab || !isBirthDataForm(tab.url ?? "")) return notFilled;

  try {
    const [{ result: page }] = await scripting.executeScript({ target: { tabId }, func: readFormPage });
    if (!page) return notFilled;
    if (page.form !== "blank" || page.auth === "signed-out") return { outcome: "choose", tabId, page: { kind: "form", ...page } };

    const [{ result: fill }] = await scripting.executeScript({ target: { tabId }, func: fillForm, args: [formValues(values)] });
    if (!fill?.filled) {
      return { outcome: "choose", tabId, page: { kind: "form", auth: page.auth, form: fill?.form ?? "unrecognised" } };
    }
    await watchFilledZone(scripting, tabId, values);
  } catch {
    // The tab navigated away, or the browser refused the script.
    return notFilled;
  }
  await releaseTab(storage, tabId);
  return { outcome: "filled", tabId };
}

/**
 * Once a form is filled in with astro.com's automatic time zone, has the tab
 * check the zone it picks against the chart's (watchZone). The form is filled
 * in either way, so a check that can't start is left out, not reported.
 *
 * @param {typeof chrome.scripting} scripting
 * @param {number} tabId
 * @param {{ utc: string, local?: string | null }} values
 */
export async function watchFilledZone(scripting, tabId, values) {
  const check = zoneCheck(values);
  if (check === null) return;
  await scripting.executeScript({ target: { tabId }, func: watchZone, args: [check] }).catch(() => {});
}
