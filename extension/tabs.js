// Waiting on a tab AstroChart Bridge opened, for the sites whose forms it
// fills in (astro-com-open.js, astro-seek-open.js).

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
