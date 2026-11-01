// The values kept for an astro.com tab that AstroChart Bridge opened for a chart,
// so the popup on that tab can fill in astro.com's form after the popup that
// opened it has closed. Each takes the storage area to use: the browser passes
// chrome.storage.session, which the browser empties when it quits, and tests
// pass a stand-in. Only the decided UTC, place and the chart's town and name
// are kept, never anything of astro.com's.

export const HOLD_MINUTES = 30;

// One entry per tab, so two charts opened in two tabs don't replace each other.
const PREFIX = "astro-com-tab:";
const keyFor = (tabId) => `${PREFIX}${tabId}`;

/**
 * Keeps a chart's values for the tab opened for them, replacing any kept for
 * that tab before. Expired values of other tabs are removed on the way, so
 * nothing needs a timer.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {number} tabId
 * @param {{ utc: string, lat: number, lng: number, town?: string | null, name?: { first: string, last: string } | null }} values
 *   town and name are null when the chart has none
 * @param {number} [now]  milliseconds since the epoch
 */
export async function holdForTab(storage, tabId, { utc, lat, lng, town = null, name = null }, now = Date.now()) {
  const stale = Object.entries(await storage.get(null))
    .filter(([key, entry]) => key.startsWith(PREFIX) && liveValues(entry, now) === null)
    .map(([key]) => key);
  if (stale.length > 0) await storage.remove(stale);
  await storage.set({ [keyFor(tabId)]: { values: { utc, lat, lng, town, name: nameOrNull(name) }, heldAt: now } });
}

/**
 * The values kept for a tab, or null when there are none or they have
 * expired. Expired or malformed values are removed, so they never come back.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {number} tabId
 * @param {number} [now]
 * @returns {Promise<{ utc: string, lat: number, lng: number, town: string | null,
 *   name: { first: string, last: string } | null } | null>}
 */
export async function heldForTab(storage, tabId, now = Date.now()) {
  const key = keyFor(tabId);
  const { [key]: entry } = await storage.get(key);
  if (entry === undefined) return null;
  const values = liveValues(entry, now);
  if (values === null) await storage.remove(key);
  return values;
}

/**
 * Forgets the values kept for a tab: once they are filled in, or cancelled.
 *
 * @param {chrome.storage.StorageArea} storage
 * @param {number} tabId
 */
export async function releaseTab(storage, tabId) {
  await storage.remove(keyFor(tabId));
}

// An entry's values while it is younger than HOLD_MINUTES, else null. One kept
// "later" than now means the clock moved back, and counts as expired too.
function liveValues(entry, now) {
  const age = now - entry?.heldAt;
  if (!(age >= 0 && age < HOLD_MINUTES * 60_000)) return null;
  const { utc, lat, lng, town, name } = entry.values ?? {};
  if (typeof utc !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { utc, lat, lng, town: typeof town === "string" ? town : null, name: nameOrNull(name) };
}

// A name's two parts, or null when it isn't two strings or both are empty, so
// a form is never filled in with a blank name. Anything else kept with it is dropped.
function nameOrNull(name) {
  const { first, last } = name ?? {};
  if (typeof first !== "string" || typeof last !== "string" || (first === "" && last === "")) return null;
  return { first, last };
}
