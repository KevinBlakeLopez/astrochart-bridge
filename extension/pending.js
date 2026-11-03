// The values kept for a tab that AstroChart Bridge opened for a chart, so the
// popup on that tab can use them after the popup or page that opened it has
// closed: astro.com's form fills them in, and Save in Astro-Seek… on an
// Astro-Seek chart saves with its name and town. Each takes the storage area
// to use: the browser passes chrome.storage.session, which the browser empties
// when it quits, and tests pass a stand-in. Only the decided UTC, place and the
// chart's local time, town and name are kept, never anything of a site's. A
// chart pasted with no offset has no UTC, only its local time.

export const HOLD_MINUTES = 30;

/**
 * One site's tabs, each with an entry of its own, so two charts opened in two
 * tabs don't replace each other, and an astro.com tab's values are never an
 * Astro-Seek tab's.
 *
 * @param {string} prefix  of each entry's key, before the tab's id
 * @param {number} minutes  how long values are used; Infinity until the browser quits
 */
function tabStore(prefix, minutes) {
  const keyFor = (tabId) => `${prefix}${tabId}`;
  return {
    /**
     * Keeps a chart's values for the tab opened for them, replacing any kept for
     * that tab before. Expired values of other tabs are removed on the way, so
     * nothing needs a timer.
     *
     * @param {chrome.storage.StorageArea} storage
     * @param {number} tabId
     * @param {{ utc: string | null, lat: number, lng: number, local?: string | null, town?: string | null,
     *   name?: { first: string, last: string } | null, gender?: "female" | "male" | "event" | "horary" | null }} values
     *   local, town, name and gender are null when the chart has none; utc is null only with a local time
     * @param {number} [now]  milliseconds since the epoch
     */
    async hold(storage, tabId, { utc, lat, lng, local = null, town = null, name = null, gender = null }, now = Date.now()) {
      const stale = Object.entries(await storage.get(null))
        .filter(([key, entry]) => key.startsWith(prefix) && liveValues(entry, now, minutes) === null)
        .map(([key]) => key);
      if (stale.length > 0) await storage.remove(stale);
      const values = { utc, lat, lng, local, town, name: nameOrNull(name), gender: GENDERS.includes(gender) ? gender : null };
      await storage.set({ [keyFor(tabId)]: { values, heldAt: now } });
    },

    /**
     * The values kept for a tab, or null when there are none or they have
     * expired. Expired or malformed values are removed, so they never come back.
     *
     * @param {chrome.storage.StorageArea} storage
     * @param {number} tabId
     * @param {number} [now]
     * @returns {Promise<{ utc: string | null, lat: number, lng: number, local: string | null, town: string | null,
     *   name: { first: string, last: string } | null, gender: "female" | "male" | "event" | "horary" | null } | null>}
     */
    async held(storage, tabId, now = Date.now()) {
      const key = keyFor(tabId);
      const { [key]: entry } = await storage.get(key);
      if (entry === undefined) return null;
      const values = liveValues(entry, now, minutes);
      if (values === null) await storage.remove(key);
      return values;
    },

    /**
     * Forgets the values kept for a tab: once they are filled in, or cancelled.
     *
     * @param {chrome.storage.StorageArea} storage
     * @param {number} tabId
     */
    async release(storage, tabId) {
      await storage.remove(keyFor(tabId));
    },
  };
}

// An astro.com tab's values bridge a sign-in, so they're used for HOLD_MINUTES.
export const { hold: holdForTab, held: heldForTab, release: releaseTab } = tabStore("astro-com-tab:", HOLD_MINUTES);

// An Astro-Seek tab opened by Open chart in Astro-Seek keeps the chart's town
// and name for Save in Astro-Seek… there, which may come long after the chart
// is looked at, so they're used until the browser quits.
export const astroSeekTabs = tabStore("astro-seek-tab:", Infinity);

// An entry's values while it is younger than minutes, else null. One kept
// "later" than now means the clock moved back, and counts as expired too.
function liveValues(entry, now, minutes) {
  const age = now - entry?.heldAt;
  if (!(age >= 0 && age < minutes * 60_000)) return null;
  const { utc, lat, lng, local: kept, town, name, gender } = entry.values ?? {};
  const local = typeof kept === "string" && LOCAL.test(kept) ? kept : null;
  // Values with neither a UTC nor a local time have no time to fill in.
  if (!(typeof utc === "string" || (utc === null && local !== null))) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    utc,
    lat,
    lng,
    local,
    town: typeof town === "string" ? town : null,
    name: nameOrNull(name),
    gender: GENDERS.includes(gender) ? gender : null,
  };
}

// The genders a chart can give, as aaf-model.js and hor-model.js read them.
const GENDERS = ["female", "male", "event", "horary"];

// "2024-04-17T08:00:00", the form a chart's local time takes.
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

// A name's two parts, or null when it isn't two strings or both are empty, so
// a form is never filled in with a blank name. Anything else kept with it is dropped.
function nameOrNull(name) {
  const { first, last } = name ?? {};
  if (typeof first !== "string" || typeof last !== "string" || (first === "" && last === "")) return null;
  return { first, last };
}
