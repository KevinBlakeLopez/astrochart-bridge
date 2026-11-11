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

// What someone shares to the installed web app from another app's share
// sheet, as manifest.webmanifest's share_target says, arrives as a POST to
// "share". GitHub Pages can't take a POST, so the worker answers it here, on
// the device, and nothing shared reaches the network. A screenshot goes to
// the screenshot page and text to the paste page. Each is kept in a cache of
// its own only until that page opens, which takes it and empties the cache
// (web-page.js's takeShared, which uses the same names). A new share replaces
// anything left there.
const SHARED = "astrochart-bridge-shared";
const SHARED_IMAGE = "shared-image";
const SHARED_TEXT = "shared-text";

// A request's address without its fragment.
const fileAddress = (url) => url.href.slice(0, url.href.length - url.hash.length);

// A new version takes over at once, rather than when every tab has closed:
// with the network first, there's nothing for the old one to finish.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method === "POST" && fileAddress(url) === `${self.registration.scope}share`) {
    event.respondWith(receiveShare(request));
    return;
  }
  if (request.method !== "GET" || url.search !== "" || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(networkFirst(event, request, fileAddress(url)));
});

// Keeps what was shared and opens the page that reads it, with #shared, a
// fragment, so the page comes from the kept copy offline too. The first image
// shared is read; the text and a link, together, only when there's no image.
// With neither, the home page opens.
async function receiveShare(request) {
  const scope = self.registration.scope;
  let form = null;
  try {
    form = await request.formData();
  } catch {
    // Not form data: nothing to read.
  }
  const image = form?.getAll("image").find((file) => typeof file !== "string" && file.type.startsWith("image/"));
  const text = ["text", "url"]
    .map((name) => form?.get(name))
    .filter((value) => typeof value === "string" && value.trim() !== "")
    .join("\n");
  await caches.delete(SHARED);
  if (image) {
    await (await caches.open(SHARED)).put(`${scope}${SHARED_IMAGE}`, new Response(image, { headers: { "Content-Type": image.type } }));
    return Response.redirect(`${scope}screenshot.html#shared`, 303);
  }
  if (text !== "") {
    await (await caches.open(SHARED)).put(`${scope}${SHARED_TEXT}`, new Response(text, { headers: { "Content-Type": "text/plain;charset=utf-8" } }));
    return Response.redirect(`${scope}paste.html#shared`, 303);
  }
  return Response.redirect(`${scope}index.html`, 303);
}

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
