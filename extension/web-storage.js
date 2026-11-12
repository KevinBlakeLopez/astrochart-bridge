// localStorage in the shape of chrome.storage.local, for the copy of a page
// on the web, which has no extension storage: the settings helioscope-model.js
// and parans-model.js keep take either. Each key goes under "astrochart-bridge:", since the
// site's origin, kevinblakelopez.github.io, is shared by every GitHub Pages
// site of its account. Only the calls the models make are here: get with one
// key, set and remove, each a promise, so a refused write rejects as
// chrome.storage's does.

const PREFIX = "astrochart-bridge:";

/**
 * @param {{ localStorage?: Storage | null }} window  the page's window, globalThis
 * @returns {Pick<chrome.storage.StorageArea, "get" | "set" | "remove"> | null}
 *   null when the browser won't let the page use localStorage
 */
export function webStorageArea(window) {
  let storage;
  // Reading localStorage throws when the browser blocks the site's storage.
  try {
    storage = window.localStorage;
  } catch {
    return null;
  }
  if (!storage) return null;
  return {
    async get(key) {
      const kept = storage.getItem(PREFIX + key);
      if (kept === null) return {};
      // Anything else under the key, from another site on the origin or a
      // hand edit, is nothing kept.
      try {
        return { [key]: JSON.parse(kept) };
      } catch {
        return {};
      }
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) storage.setItem(PREFIX + key, JSON.stringify(value));
    },
    async remove(key) {
      storage.removeItem(PREFIX + key);
    },
  };
}
