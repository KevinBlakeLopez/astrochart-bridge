// Whether the user has made Stellarium Desktop their default for a chart's
// sky. Each takes the storage area to use: the popup passes
// chrome.storage.local, kept on this computer only and not synced to the
// browser's account, and tests pass a stand-in. Nothing else is kept.

const KEY = "default-sky";
const DESKTOP = "stellarium-desktop";

/**
 * @param {chrome.storage.StorageArea} storage
 * @returns {Promise<boolean>}  false, Stellarium Web, until the user chooses otherwise
 */
export async function desktopPreferred(storage) {
  const { [KEY]: value } = await storage.get(KEY);
  return value === DESKTOP;
}

/**
 * Makes Stellarium Desktop the default, or forgets that choice.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {boolean} preferred
 */
export async function setDesktopPreferred(storage, preferred) {
  if (preferred) await storage.set({ [KEY]: DESKTOP });
  else await storage.remove(KEY);
}
