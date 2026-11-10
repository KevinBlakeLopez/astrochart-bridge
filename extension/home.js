// The site's home page, index.html, where the web app opens once it's
// installed: the ways to bring a chart in. Only the web has it; in the
// extension, the popup is the way in, so the store zips leave it out.
import { isExtensionCopy } from "./extension-copy.js";
import { localizePage } from "./messages/index.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

// The service worker that keeps the site's files for offline use (sw.js),
// on the web only. A browser without one, or that refuses it, still has
// every page, online.
if (!isExtensionCopy(location.href) && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
