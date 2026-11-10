// The web app's service worker, which the home page registers on the web, so
// that the site's pages work offline once they've been opened. Every file
// comes from the network first, so the site is never stuck on old code, and
// a copy of it is kept; offline, the copy is used instead.
//
// Only the site's own files are kept: GET requests inside this worker's scope,
// with no query string. github.io serves other sites at other paths of the
// same origin, and they're left alone. A chart travels in its link's
// fragment, after the #, which the network never sees but a request's url
// keeps, so each copy is kept under its file's address without the fragment:
// a chart is never kept. Nothing is sent anywhere a page wouldn't send it.
const CACHE = "astrochart-bridge";

// A request's address without its fragment.
const fileAddress = (url) => url.href.slice(0, url.href.length - url.hash.length);

// A new version takes over at once, rather than when every tab has closed:
// with the network first, there's nothing for the old one to finish.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.search !== "" || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(networkFirst(event, request, fileAddress(url)));
});

async function networkFirst(event, request, address) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(address, copy)));
    }
    return response;
  } catch (error) {
    const kept = await caches.match(address, { cacheName: CACHE });
    if (kept) return kept;
    throw error;
  }
}
