// What a button does on a page of the extension's own that draws the popup's
// screens and stays open, the screenshot, paste and import pages: a link opens
// in a new tab, an astro.com button or Open chart in Astro-Seek keeps the
// values for the tab it opens, and Save in Astro-Seek… opens Astro-Seek's
// form, as in the popup.
import { ASTRO_COM_ACCESS, openAndFill } from "./astro-com-open.js";
import { ASTRO_SEEK_ACCESS, openAndSave } from "./astro-seek-open.js";
import { astroSeekTabs, holdForTab } from "./pending.js";
import { viewForAstroComManual, viewForAstroComNotFilled, viewForAstroSeekSave } from "./popup-model.js";
import { paragraph, render } from "./view.js";

/**
 * @param {HTMLElement} container  where the page draws its screens
 * @param {{ url: string, holds?: object, keeps?: { town: string | null, name: object | null }, fills?: boolean,
 *   saves?: { town: string | null, name: string | null } }} button  keeps is the town and name Open chart in
 *   Astro-Seek keeps for its tab, as in the popup
 * @param {{ utc: string, lat: number, lng: number } | null} [sky]  the sky the screen decided
 */
export async function openLink(container, { url, holds, keeps, fills, saves }, sky = null) {
  if (saves) return saveInAstroSeek(container, sky, saves);
  if (fills) return openForm(container, url, holds);
  if (!holds && !(keeps && sky)) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const tab = await chrome.tabs.create({ url });
  if (holds) await holdForTab(chrome.storage.session, tab.id, holds);
  else await astroSeekTabs.hold(chrome.storage.session, tab.id, { ...sky, ...keeps });
}

// The form button, as in the popup: access is asked for first, while the click
// still counts as the user's. The page stays open, so a form that needs a
// choice first is left to the popup on its tab, and the page says so.
async function openForm(container, url, values) {
  if (!(await chrome.permissions.request(ASTRO_COM_ACCESS).catch(() => false))) {
    render(container, viewForAstroComManual(values), (button) => openLink(container, button));
    return;
  }
  container.replaceChildren(paragraph("Opening astro.com's form to fill it in…", "note"));
  const browser = { tabs: chrome.tabs, scripting: chrome.scripting, storage: chrome.storage.session };
  const { outcome, tabId } = await openAndFill(browser, { url, values });
  const showTab = () => chrome.tabs.update(tabId, { active: true });
  if (outcome === "filled") {
    container.replaceChildren(paragraph("AstroChart Bridge filled in astro.com's form in its tab.", "note"));
    await showTab();
    return;
  }
  render(container, viewForAstroComNotFilled(values, outcome), showTab);
}

// Save in Astro-Seek…, as in the popup: access is asked for first, while the
// click still counts as the user's. The page stays open, so it says what
// happened, and brings the form's tab to the front once it is filled in.
async function saveInAstroSeek(container, sky, saves) {
  if (!(await chrome.permissions.request(ASTRO_SEEK_ACCESS).catch(() => false))) {
    render(container, viewForAstroSeekSave({ outcome: "declined" }, sky, saves), (button) => openLink(container, button));
    return;
  }
  container.replaceChildren(paragraph("Opening Astro-Seek's Add person form…", "note"));
  const result = await openAndSave({ tabs: chrome.tabs, scripting: chrome.scripting }, { values: { ...sky, ...saves } });
  const showTab = () => chrome.tabs.update(result.tabId, { active: true });
  if (result.outcome === "filled") {
    container.replaceChildren(paragraph("AstroChart Bridge filled in Astro-Seek's form in its tab. Check Gender there, then press Add person.", "note"));
    await showTab();
    return;
  }
  render(container, viewForAstroSeekSave(result, sky, saves), (button) => (button.does === "show-tab" ? showTab() : openLink(container, button)));
}
