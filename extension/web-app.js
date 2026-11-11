// The site as an installed web app, on the web's copy of each page: the
// service worker that keeps its files for offline use, and what was shared
// to it from another app's share sheet. The extension's copy has neither.
import { isExtensionCopy } from "./extension-copy.js";

// Where sw.js keeps a shared screenshot or shared text, and under what names.
const SHARED = "astrochart-bridge-shared";
const SHARED_ITEMS = { image: "shared-image", text: "shared-text" };

/**
 * Starts the service worker (sw.js), on the web only. Every page starts it,
 * not just the home page, so a web app installed from any page can take a
 * share before the home page has opened. A browser without one, or that
 * refuses it, still has every page, online.
 *
 * @param {string} href  this page's address, location.href
 */
export function keepForOffline(href) {
  if (!isExtensionCopy(href) && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

/**
 * What was shared to the web app for this page: a screenshot for the
 * screenshot page, text for the paste page. The worker keeps it only until
 * its page opens, and this empties that cache whatever it held, so nothing
 * shared stays on the device once a page has taken it, or once a page opens
 * without it. Null when the page wasn't opened by a share, or the item is gone.
 *
 * @param {"image" | "text"} kind
 * @param {string} href  this page's address, location.href
 * @returns {Promise<Blob | string | null>}
 */
export async function takeShared(kind, href) {
  if (isExtensionCopy(href) || typeof caches === "undefined") return null;
  try {
    if (new URL(href).hash !== "#shared") return null;
    const kept = await caches.match(new URL(SHARED_ITEMS[kind], href).href, { cacheName: SHARED });
    if (!kept) return null;
    return kind === "image" ? await kept.blob() : await kept.text();
  } catch {
    return null;
  } finally {
    await caches.delete(SHARED).catch(() => {});
  }
}
