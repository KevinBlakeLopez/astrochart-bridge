// Whether the user has made Stellarium Desktop their default for a chart's
// sky, and which of a chart's name and town the share page includes when it
// passes the chart on. Each takes the storage area to use: the popup and the
// share page pass chrome.storage.local, kept on this computer only and not
// synced to the browser's account, and tests pass a stand-in. Nothing else is
// kept: not the name or town themselves.

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

const SHARE_KEY = "share-labels";

/**
 * Which of a chart's name and town the share page includes in a link, QR code
 * or file.
 *
 * @param {chrome.storage.StorageArea} storage
 * @returns {Promise<{ name: boolean, town: boolean }>}  neither, until the user ticks one
 */
export async function shareIncludes(storage) {
  const { [SHARE_KEY]: value } = await storage.get(SHARE_KEY);
  return { name: value?.name === true, town: value?.town === true };
}

/**
 * Keeps which of a chart's name and town the share page includes, or forgets
 * the choice when it is neither.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {{ name?: boolean, town?: boolean }} include
 */
export async function setShareIncludes(storage, include) {
  const kept = { name: include.name === true, town: include.town === true };
  if (kept.name || kept.town) await storage.set({ [SHARE_KEY]: kept });
  else await storage.remove(SHARE_KEY);
}
