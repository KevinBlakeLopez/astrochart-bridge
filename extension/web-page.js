// What a button does on the web's copy of the screenshot, paste and import
// pages, which can only open links: astro-com-page.js's counterpart, for
// screens built with onTheWeb. There is no extension to open a tab it keeps
// values for, ask for access to a site or fill in its form, so a link opens
// in a new tab, and Save in Astro-Seek… by hand leads to Astro-Seek's form
// filled in by its address alone. Nothing is kept.
import { linkFor } from "./chart-model.js";
import { isExtensionCopy } from "./extension-copy.js";
import { viewForAstroSeekSave } from "./popup-model.js";
import { render } from "./view.js";

/**
 * Shows the way back to the site's home page, index.html, on the web's copy
 * of a page: an installed web app has no back button. The extension's copy
 * keeps it hidden, since the store zips leave the home page out.
 *
 * @param {Document} document  a page with a hidden #home
 * @param {string} href  this page's address, location.href
 */
export function showHomeLink(document, href) {
  if (!isExtensionCopy(href)) document.getElementById("home").hidden = false;
}

/**
 * @param {HTMLElement} container  where the page draws its screens
 * @param {{ url?: string, savesByHand?: { town: string | null, name: string | null } }} button
 * @param {{ utc: string, lat: number, lng: number } | null} [sky]  the sky the screen decided
 */
export function openLink(container, { url, savesByHand }, sky = null) {
  if (savesByHand) {
    render(container, viewForAstroSeekSave({ outcome: "by-hand" }, sky, savesByHand), (button) => openLink(container, button));
    return;
  }
  window.open(url, "_blank", "noopener");
}

/**
 * A page beside this one, wherever the site is served: on GitHub Pages, or on
 * this computer while it is tried out.
 *
 * @param {string} page  the page's file: chart.html, helioscope.html, parans.html or declinations.html
 * @param {string} href  this page's address, location.href
 */
export const pageUrl = (page, href) => new URL(page, href).href;

/**
 * Share…, Which planets were visible, Parans or Declinations on the web: the
 * receiving page, Helioscope's page, the parans page or the declinations page
 * beside this one in a new tab, with the chart in its link. Called while the click is still being handled,
 * with nothing awaited first, since Safari blocks a window opened after an
 * await.
 *
 * @param {string} page  the page's file: chart.html, helioscope.html, parans.html or declinations.html
 * @param {object} chart  a portable chart
 * @param {string} href  this page's address, location.href
 */
export function openPage(page, chart, href) {
  window.open(linkFor(pageUrl(page, href), chart), "_blank", "noopener");
}
