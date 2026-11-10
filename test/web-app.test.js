// The site as a web app people can install: on an iPad's or iPhone's Home
// Screen with Safari's Add to Home Screen, and with Install app on Android
// and in Chrome or Edge. extension/manifest.webmanifest describes it; each
// published page links it, and the 180-pixel icon Safari puts on the Home
// Screen. Installing it is in the manual test checklist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { SIZES, WEB_SIZES, iconPng } from "../tools/make-icons.mjs";
import { SITE_FILES } from "../tools/site.mjs";

const extension = new URL("../extension/", import.meta.url);
const read = (file) => readFileSync(new URL(file, extension));
const manifest = JSON.parse(read("manifest.webmanifest").toString("utf8"));

const PUBLISHED = ["index.html", "chart.html", "paste.html", "import.html", "screenshot.html", "helioscope.html"];

// A PNG's width and height, from its IHDR chunk, which always comes first.
const pngSize = (bytes) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });

// The image data of a PNG with one IDAT chunk, uncompressed, as in manifest.test.js.
function pixels(png) {
  const at = png.indexOf("IDAT");
  return inflateSync(png.subarray(at + 4, at + 4 + png.readUInt32BE(at - 4)));
}

test("it opens the home page, inside the site, in a window of its own", () => {
  assert.equal(manifest.start_url, "index.html");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.id, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(SITE_FILES.includes(manifest.start_url));
});

// A Home Screen label shows about 12 characters before it's cut short.
test("its name is AstroChart Bridge, short enough for a Home Screen label", () => {
  assert.equal(manifest.name, "AstroChart Bridge");
  assert.ok(manifest.short_name.length <= 12, manifest.short_name);
  assert.ok(manifest.description.length > 0);
});

test("its icons are the 192- and 512-pixel ones tools/make-icons.mjs draws, and the site has them", () => {
  assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ["192x192", "512x512"]);
  for (const { src, sizes, type } of manifest.icons) {
    const size = Number(sizes.split("x")[0]);
    assert.ok(SIZES.includes(size) || WEB_SIZES.includes(size), src);
    assert.equal(src, `icons/icon-${size}.png`);
    assert.equal(type, "image/png");
    assert.deepEqual(pngSize(read(src)), { width: size, height: size }, src);
    assert.ok(pixels(iconPng(size)).equals(pixels(read(src))), src);
    assert.ok(SITE_FILES.includes(src), src);
  }
});

// The splash screen and the window's title bar are the icon's own night blue.
test("its colours are the icon's background", () => {
  const corner = [...pixels(iconPng(192)).subarray(1, 4)];
  const hex = `#${corner.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  assert.equal(manifest.background_color, hex);
  assert.equal(manifest.theme_color, hex);
});

test("every published page links the manifest and the 180-pixel Home Screen icon", () => {
  for (const page of PUBLISHED) {
    const html = read(page).toString("utf8");
    assert.ok(html.includes('<link rel="manifest" href="manifest.webmanifest">'), page);
    assert.ok(html.includes('<link rel="apple-touch-icon" href="icons/icon-180.png">'), page);
  }
  assert.deepEqual(pngSize(read("icons/icon-180.png")), { width: 180, height: 180 });
  assert.ok(pixels(iconPng(180)).equals(pixels(read("icons/icon-180.png"))));
  assert.ok(WEB_SIZES.includes(180));
});

// --- The service worker (sw.js) ---
// Run with a stand-in for the worker's global, the network and the Cache API.

const SCOPE = "https://kevinblakelopez.github.io/astrochart-bridge/";

function worker() {
  const listeners = {};
  const kept = new Map();
  const network = { online: true, status: 200, fetched: [] };
  const calls = [];
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type, listener) => (listeners[type] = listener),
    skipWaiting: () => calls.push("skipWaiting"),
    clients: { claim: async () => calls.push("claim") },
  };
  const caches = {
    open: async (name) => ({ put: async (key, response) => kept.set(`${name} ${key}`, await response.text()) }),
    match: async (key, { cacheName }) => {
      const body = kept.get(`${cacheName} ${key}`);
      return body === undefined ? undefined : new Response(body);
    },
  };
  const fetch = async (request) => {
    network.fetched.push(request.url);
    if (!network.online) throw new TypeError("Failed to fetch");
    return new Response(`from the network: ${new URL(request.url).pathname}`, { status: network.status });
  };
  new Function("self", "caches", "fetch", read("sw.js").toString("utf8"))(self, caches, fetch);

  // A fetch event: what the worker answered, or null when it left the request alone.
  async function request(url, init) {
    let answer = null;
    const waits = [];
    listeners.fetch({ request: new Request(url, init), respondWith: (promise) => (answer = promise), waitUntil: (promise) => waits.push(promise) });
    if (answer === null) return null;
    const response = await answer;
    await Promise.all(waits);
    return response;
  }
  return { request, kept, network, calls, listeners };
}

test("the worker takes over as soon as it's installed", async () => {
  const { listeners, calls } = worker();
  listeners.install({});
  let activated;
  listeners.activate({ waitUntil: (promise) => (activated = promise) });
  await activated;
  assert.deepEqual(calls, ["skipWaiting", "claim"]);
});

test("online, a site file comes from the network, and a copy is kept under its address", async () => {
  const { request, kept, network } = worker();
  const response = await request(`${SCOPE}paste.html`);
  assert.equal(await response.text(), "from the network: /astrochart-bridge/paste.html");
  assert.deepEqual(network.fetched, [`${SCOPE}paste.html`]);
  assert.deepEqual([...kept.keys()], [`astrochart-bridge ${SCOPE}paste.html`]);
});

test("offline, the kept copy is used, and a file never opened fails as it would without the worker", async () => {
  const { request, network } = worker();
  await request(`${SCOPE}paste.html`);
  network.online = false;
  assert.equal(await (await request(`${SCOPE}paste.html`)).text(), "from the network: /astrochart-bridge/paste.html");
  await assert.rejects(request(`${SCOPE}import.html`), TypeError);
});

// A request's url keeps the fragment (Node's Request does, as the Fetch standard says).
test("a chart in a link's fragment is never kept: the copy is the page's, under its address without it", async () => {
  const { request, kept, network } = worker();
  assert.equal(new Request(`${SCOPE}helioscope.html#v1=abc`).url, `${SCOPE}helioscope.html#v1=abc`);
  await request(`${SCOPE}helioscope.html#v1=abc`);
  assert.deepEqual([...kept.keys()], [`astrochart-bridge ${SCOPE}helioscope.html`]);
  for (const [key, body] of kept) assert.doesNotMatch(`${key} ${body}`, /#|v1=|abc/);
  network.online = false;
  assert.ok(await request(`${SCOPE}helioscope.html#v1=another`));
});

test("an answer that isn't a plain 200 isn't kept", async () => {
  const { request, kept, network } = worker();
  network.status = 404;
  assert.equal((await request(`${SCOPE}missing.html`)).status, 404);
  assert.equal(kept.size, 0);
});

test("it leaves alone what isn't a plain GET of one of the site's own files", async () => {
  const { request, kept, network } = worker();
  for (const [url, init] of [
    [`${SCOPE}paste.html`, { method: "POST", body: "x" }],
    [`${SCOPE}paste.html?text=1`],
    ["https://kevinblakelopez.github.io/another-site/index.html"],
    ["https://stellarium-web.org/"],
    ["http://127.0.0.1:8090/api/main/status"],
  ]) {
    assert.equal(await request(url, init), null, url);
  }
  assert.deepEqual(network.fetched, []);
  assert.equal(kept.size, 0);
});
