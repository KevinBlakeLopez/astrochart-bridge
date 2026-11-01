// What a button does on a page of the extension's own that draws the popup's
// screens and stays open, the screenshot, paste and import pages: a link opens
// in a new tab, and an astro.com button keeps the values for the tab it opens,
// as in the popup.
import { ASTRO_COM_ACCESS, openAndFill } from "./astro-com-open.js";
import { holdForTab } from "./pending.js";
import { viewForAstroComManual, viewForAstroComNotFilled } from "./popup-model.js";
import { paragraph, render } from "./view.js";

/**
 * @param {HTMLElement} container  where the page draws its screens
 * @param {{ url: string, holds?: object, fills?: boolean }} button
 */
export async function openLink(container, { url, holds, fills }) {
  if (fills) return openForm(container, url, holds);
  if (!holds) {
    window.open(url, "_blank", "noopener");
    return;
  }
  const tab = await chrome.tabs.create({ url });
  await holdForTab(chrome.storage.session, tab.id, holds);
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
