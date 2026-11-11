// The site's home page, index.html, where the web app opens once it's
// installed: the ways to bring a chart in. Only the web has it; in the
// extension, the popup is the way in, so the store zips leave it out.
import { keepForOffline } from "./web-app.js";
import { localizePage } from "./messages/index.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

// The service worker that keeps the site's files for offline use, on the web
// only, as every published page starts it (web-app.js).
keepForOffline(location.href);
