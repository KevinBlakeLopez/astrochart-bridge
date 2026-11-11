// The site as a web app people can install: on an iPad's or iPhone's Home
// Screen with Safari's Add to Home Screen, and with Install app on Android
// and in Chrome or Edge. extension/manifest.webmanifest describes it; each
// published page links it, and the 180-pixel icon Safari puts on the Home
// Screen. Installing it is in the manual test checklist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { decodeAafFile, viewForAafText } from "../extension/aaf-model.js";
import { isHorFile } from "../extension/core/morinus-hor.js";
import { viewForHorFile } from "../extension/hor-model.js";
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

// --- Opening chart files (file_handlers) ---
// Chrome and Edge on the desktop offer the installed app for these files in
// the computer's file manager, and import.js reads the one it's opened with.

const fixture = (path) => readFileSync(new URL(`../fixtures/${path}`, import.meta.url));

test("it opens AAF and Morinus files on the import page, and claims no other kind of file", () => {
  assert.deepEqual(manifest.file_handlers, [
    { action: "import.html", accept: { "application/x-aaf": [".aaf"], "application/x-morinus-hor": [".hor"] } },
  ]);
  const site = "https://kevinblakelopez.github.io/astrochart-bridge/manifest.webmanifest";
  for (const { action, accept } of manifest.file_handlers) {
    assert.ok(SITE_FILES.includes(action), action);
    assert.ok(new URL(action, site).href.startsWith(new URL(manifest.scope, site).href), action);
    // Types of their own, never a shared one such as text/plain, application/json,
    // application/octet-stream or an image, which would offer the app for every such file.
    for (const type of Object.keys(accept)) assert.match(type, /^application\/x-[a-z-]+$/, type);
  }
});

test("each file it opens is one the import page reads into a chart", () => {
  const aaf = viewForAafText(decodeAafFile(fixture("aaf/astrolog-8.00-new-york.aaf")).text, { onTheWeb: true });
  assert.equal(aaf.items.length, 1);
  assert.ok(aaf.items[0].chart);
  const hor = fixture("morinus/greenwich-with-dst.p2.hor");
  assert.ok(isHorFile("greenwich-with-dst.p2.hor", hor));
  const morinus = viewForHorFile(hor, { onTheWeb: true });
  assert.equal(morinus.items.length, 1);
  assert.ok(morinus.items[0].chart);
});

test("the import page reads the file it's opened with as it reads a chosen one, once the page is ready", () => {
  const code = read("import.js").toString("utf8");
  const consumer = code.indexOf('if ("launchQueue" in window) {');
  assert.ok(consumer > code.indexOf("const openLink = "), "after openLink is defined");
  assert.ok(consumer > code.indexOf("if (handed) readBytes("), "after the file the receiving page hands over");
  assert.match(
    code.slice(consumer),
    /^if \("launchQueue" in window\) \{\n  window\.launchQueue\.setConsumer\(async \(\{ files = \[\] \}\) => \{\n    if \(files\.length > 0\) readFile\(await files\[0\]\.getFile\(\)\);\n  \}\);\n\}\n$/,
  );
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
  // Each copy is kept as its bytes, under "<cache> <address>", with its type.
  const types = new Map();
  const caches = {
    open: async (name) => ({
      put: async (key, response) => {
        kept.set(`${name} ${key}`, Buffer.from(await response.arrayBuffer()));
        types.set(`${name} ${key}`, response.headers.get("Content-Type"));
      },
    }),
    match: async (key, { cacheName }) => {
      const body = kept.get(`${cacheName} ${key}`);
      return body === undefined ? undefined : new Response(body);
    },
    delete: async (name) => {
      for (const key of [...kept.keys()].filter((key) => key.startsWith(`${name} `))) kept.delete(key);
      return true;
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
  return { request, kept, types, network, calls, listeners };
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

// --- What's shared to the web app (share_target, sw.js, web-app.js) ---
// Android lists an installed web app in its share sheet from share_target,
// and sends what's shared as a POST of form data to its action.

test("it takes a shared image, text or link as form data, sent to share inside the site", () => {
  assert.deepEqual(manifest.share_target, {
    action: "share",
    method: "POST",
    enctype: "multipart/form-data",
    params: { text: "text", url: "url", files: [{ name: "image", accept: ["image/*"] }] },
  });
  assert.equal(new URL(manifest.share_target.action, SCOPE).href, `${SCOPE}share`);
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function shared({ image, text, url } = {}) {
  const form = new FormData();
  if (image) form.append("image", image);
  if (text !== undefined) form.append("text", text);
  if (url !== undefined) form.append("url", url);
  return { method: "POST", body: form };
}

const redirectOf = (response) => ({ status: response.status, location: response.headers.get("Location") });

test("a shared screenshot is kept on the device for the screenshot page, which opens with #shared", async () => {
  const { request, kept, types, network } = worker();
  const response = await request(`${SCOPE}share`, shared({ image: new File([PNG], "Screenshot.png", { type: "image/png" }), text: "A chart" }));
  assert.deepEqual(redirectOf(response), { status: 303, location: `${SCOPE}screenshot.html#shared` });
  assert.deepEqual([...kept.keys()], [`astrochart-bridge-shared ${SCOPE}shared-image`]);
  assert.ok(kept.get(`astrochart-bridge-shared ${SCOPE}shared-image`).equals(PNG));
  assert.equal(types.get(`astrochart-bridge-shared ${SCOPE}shared-image`), "image/png");
  assert.deepEqual(network.fetched, []);
});

test("shared text, with a shared link after it, is kept for the paste page", async () => {
  const { request, kept, network } = worker();
  const response = await request(`${SCOPE}share`, shared({ text: "Born 15 June 1985, 23:30, Seattle", url: "https://example.com/chart" }));
  assert.deepEqual(redirectOf(response), { status: 303, location: `${SCOPE}paste.html#shared` });
  assert.deepEqual([...kept.keys()], [`astrochart-bridge-shared ${SCOPE}shared-text`]);
  assert.equal(kept.get(`astrochart-bridge-shared ${SCOPE}shared-text`).toString("utf8"), "Born 15 June 1985, 23:30, Seattle\nhttps://example.com/chart");
  assert.deepEqual(network.fetched, []);
});

test("a share with no image and no text opens the home page, and keeps nothing", async () => {
  const { request, kept } = worker();
  for (const init of [shared(), shared({ text: "  " }), shared({ image: new File(["not a picture"], "notes.txt", { type: "text/plain" }) }), { method: "POST", body: "x" }]) {
    assert.deepEqual(redirectOf(await request(`${SCOPE}share`, init)), { status: 303, location: `${SCOPE}index.html` });
  }
  assert.equal(kept.size, 0);
});

test("a new share replaces what an earlier one left, and leaves the site's own copies alone", async () => {
  const { request, kept } = worker();
  await request(`${SCOPE}paste.html`);
  await request(`${SCOPE}share`, shared({ image: new File([PNG], "a.png", { type: "image/png" }) }));
  await request(`${SCOPE}share`, shared({ text: "Another chart" }));
  assert.deepEqual([...kept.keys()].sort(), [`astrochart-bridge ${SCOPE}paste.html`, `astrochart-bridge-shared ${SCOPE}shared-text`]);
});

test("only a POST to share itself is taken as a share", async () => {
  const { request } = worker();
  assert.equal(await request(`${SCOPE}share?x=1`, shared({ text: "A chart" })), null);
  assert.equal(await request(`${SCOPE}share/more`, shared({ text: "A chart" })), null);
  assert.equal(await request("https://kevinblakelopez.github.io/another-site/share", shared({ text: "A chart" })), null);
});

// web-app.js, run with a stand-in Cache API in place of the browser's.
const { takeShared } = await import("../extension/web-app.js");

function pageCaches(items) {
  const kept = new Map(Object.entries(items));
  const asked = [];
  globalThis.caches = {
    match: async (key, { cacheName }) => {
      asked.push(`${cacheName} ${key}`);
      const item = kept.get(`${cacheName} ${key}`);
      return item === undefined ? undefined : new Response(item.body, { headers: { "Content-Type": item.type } });
    },
    delete: async (name) => {
      for (const key of [...kept.keys()].filter((key) => key.startsWith(`${name} `))) kept.delete(key);
      return true;
    },
  };
  return { kept, asked };
}

test("the screenshot page takes the shared screenshot once, and the cache is emptied", async () => {
  const { kept } = pageCaches({ [`astrochart-bridge-shared ${SCOPE}shared-image`]: { body: PNG, type: "image/png" } });
  const image = await takeShared("image", `${SCOPE}screenshot.html#shared`);
  assert.equal(image.type, "image/png");
  assert.ok(Buffer.from(await image.arrayBuffer()).equals(PNG));
  assert.equal(kept.size, 0);
  assert.equal(await takeShared("image", `${SCOPE}screenshot.html#shared`), null);
});

test("the paste page takes shared text", async () => {
  pageCaches({ [`astrochart-bridge-shared ${SCOPE}shared-text`]: { body: "Born 15 June 1985", type: "text/plain;charset=utf-8" } });
  assert.equal(await takeShared("text", `${SCOPE}paste.html#shared`), "Born 15 June 1985");
});

test("a page opened without #shared takes nothing, and still empties what a share left", async () => {
  const { kept, asked } = pageCaches({ [`astrochart-bridge-shared ${SCOPE}shared-image`]: { body: PNG, type: "image/png" } });
  assert.equal(await takeShared("image", `${SCOPE}screenshot.html`), null);
  assert.deepEqual(asked, []);
  assert.equal(kept.size, 0);
});

test("the extension's copy of a page never looks for a share", async () => {
  const { kept, asked } = pageCaches({ [`astrochart-bridge-shared ${SCOPE}shared-image`]: { body: PNG, type: "image/png" } });
  assert.equal(await takeShared("image", "chrome-extension://abcdefghijklmnop/screenshot.html#shared"), null);
  assert.deepEqual(asked, []);
  assert.equal(kept.size, 1);
});

test("the names the pages look under are the ones the worker keeps under", () => {
  const worker = read("sw.js").toString("utf8");
  const page = read("web-app.js").toString("utf8");
  for (const name of ['"astrochart-bridge-shared"', '"shared-image"', '"shared-text"']) {
    assert.ok(worker.includes(name), `sw.js ${name}`);
    assert.ok(page.includes(name), `web-app.js ${name}`);
  }
  assert.match(worker, /screenshot\.html#shared/);
  assert.match(worker, /paste\.html#shared/);
  assert.ok(page.includes('"#shared"'));
});
