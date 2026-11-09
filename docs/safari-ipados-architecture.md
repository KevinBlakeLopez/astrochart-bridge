# AstroChart Bridge on iPadOS through Safari and Userscripts: architecture

This document proposes an architecture. Of it, only the web copy of the extension's pages (§1, piece 1) has been built: phase 1 of the plan. [safari-ipados-feasibility.md](safari-ipados-feasibility.md) holds the evidence it rests on, with each Userscripts and Safari capability's status, and [safari-ipados-implementation-plan.md](safari-ipados-implementation-plan.md) the order of work.

Status words used here, as in the feasibility document:

- **Observed:** run here.
- **Source:** read from code, AstroChart Bridge's or Userscripts' at `v4.8.6`.
- **Documented:** a vendor's documentation, or a maintainer's statement in an issue.
- **Device test:** needs Safari with Userscripts on an iPad before anything depends on it. The feasibility document's §10 numbers them.

## 1. Recommended approach

Two pieces, each reusing code that already exists:

1. **The web copy of the extension's pages.** `chart.html` is already on GitHub Pages and already works without the extension. Publish `paste.html`, `import.html` and `screenshot.html` beside it the same way. Those pages need nothing from an extension except to fill in another site's form, and for that they already have a fallback that needs no privileges. On an iPad they give pasted text, AAF and Morinus files, screenshots, links, QR codes and `.astrochart.json` files, sending a chart to Stellarium Web and Astro-Seek, the values to type into astro.com, and Share…, all with nothing installed.
2. **A thin userscript**, `astrochart-bridge.user.js`, built from the same modules. It does only what needs a script running on another site's page:
   - read the chart on Astro-Seek and astro.com chart pages;
   - read the sky on Stellarium Web;
   - fill in astro.com's form and Astro-Seek's Add person form when a tab opened for a chart reaches them;
   - optionally, let the web copy's pages hand a chart to those two forms.

The extension stays as it is for Firefox, Chrome, Edge, Brave and Safari on macOS. Nothing in either piece replaces a code path the extension uses. Each one adds a second caller for modules the extension already calls. The one change the extension sees is phase 1's: the paste, import and screenshot pages now set a `<meta>` content security policy, which applies to the extension's copies too.

The approaches considered:

| | Approach | New code | Keeps the user in Safari | Verdict |
|---|---|---|---|---|
| A | **Web copy + thin userscript** (recommended) | One build tool, one adapter of a few hundred lines, a capability branch in four page scripts | Yes | Smallest path to most features |
| B | Userscript only, with the whole popup and every import page inside the userscript | More: Tesseract's ~7 MB and its worker would have to run inside third-party pages, under their CSPs | Yes | OCR inside a userscript is the wrong place |
| C | Web pages only, with no userscript | Least | Yes | Loses reading charts from pages and filling in forms. A worthwhile first step, not the whole answer |
| D | The existing extension in Orion | None, if Orion's beta API coverage holds | No | A cheap experiment, not the supported path. Feasibility §8.5 has the comparison |

## 2. Shared code

What each piece reuses, without changes unless the change is listed:

| Module | Web copy | Userscript | Change needed |
|---|---|---|---|
| `core/*` (every reader, `civiltime`, `portable`, `stellarium`, `towns`, `places`) | ✓ | ✓ | None |
| `core/index.js` `extractorFor`, `analyzePage` | | ✓ | None: the extractor is called in the page instead of being injected into it |
| `core/astrocom.js` `readFormPage`, `fillForm`, `watchZone`, `readTownList`, `showTownChoice` | | ✓ | None |
| `core/astroseek.js` `readSavePage`, `guardChartPlace`, `typeCity`, `readCityList`, `chooseGender`, `showCityChoice` | | ✓ | None |
| `core/stellarium.js` `readEngine`, `skyFromEngine`, `townFromPlace` | | ✓ | None to the functions. `readEngine` has to run in Stellarium Web's page world (§4.4) |
| `popup-model.js`, `screenshot-model.js`, `paste-model.js`, `aaf-model.js`, `hor-model.js`, `chart-model.js` | ✓ | ✓ (popup-model, aaf-model) | None |
| `view.js` | ✓ | ✓ | None. It builds every element with `createElement` and `textContent`, and the repository has no `innerHTML` anywhere |
| `messages/*` | ✓ | ✓ | None to the catalogs. An optional language override goes in front of `navigator.languages` (§6) |
| `pending.js` (`holdForTab`, `heldForTab`, `releaseTab`, `astroSeekTabs`) | | ✓ | None. `tabStore` builds its key from whatever id it is given, so a random token works as a tab id does |
| `astro-com-open.js` `watchFilledZone`, `chooseFilledTown` | | ✓ | None. Both take a `scripting` object, and an in-page one works (§3.2) |
| `astro-seek-open.js` `openAndSave` | | ✓ | **Small refactor**: move the steps after the tab loads, from `readSavePage` to `showCityChoice`, into an exported `fillSavePage(scripting, tabId, values)`. `openAndSave` then calls it, and the existing tests keep covering it |
| `astro-com-page.js`, `paste.js`, `screenshot.js`, `chart.js` | ✓ | | **Capability branch**: on the web, Share… opens the public receiving page instead of `chrome.runtime.getURL("chart.html")`, and the astro.com and Save in Astro-Seek buttons take the paths that need no privileges (`viewForAstroComByHand`, and `viewForAstroSeekSave({ outcome: "declined" })`, which opens the Add person form filled in by its address) |
| `stellarium-desktop.js` | | Deferred | **Refactor if built**: `call` takes a `fetch`-like function instead of the global `fetch`, and `connection` takes an address that isn't `127.0.0.1` (§4.5) |
| `popup.css` | ✓ | ✓, inside a shadow root | The userscript's build rewrites `:root` and `body` to `:host` |
| `vendor/tesseract/` | ✓ | | None. It loads from the page's own origin, as it does in the extension |

The rule kept throughout is the one `core/index.js` already states: the functions run in a site's page use nothing from their module, because the browser sends only their source. A userscript calls them directly, so for it that rule is a constraint it doesn't need, but keeping it means one function serves both adapters.

## 3. Adapter interfaces

There is no general "platform" interface to invent. The modules already take the browser objects they use as parameters, and the userscript supplies stand-ins with the same shapes, as the tests do.

### 3.1 Storage: a `chrome.storage.StorageArea` over GM storage

`pending.js` and `preference.js` call `get(key | null)`, `set(items)` and `remove(keys)`. The userscript's shim:

```js
// Sketch, not code to commit.
const gmArea = {
  async get(keys) {
    const names = keys === null ? await GM.listValues() : [keys].flat();
    const entries = await Promise.all(names.map(async (k) => [k, await GM.getValue(k)]));
    return Object.fromEntries(entries.filter(([, v]) => v !== undefined));
  },
  async set(items) { for (const [k, v] of Object.entries(items)) await GM.setValue(k, v); },
  async remove(keys) { for (const k of [keys].flat()) await GM.deleteValue(k); },
};
```

Values are stored as given: Userscripts keeps them in `browser.storage.local`, which takes structured values, and `listValues` lists only this script's keys (source; feasibility §4.2-4.3). The same contract tests run against the shim as against the `fakeStorage` the tests already have (§8).

### 3.2 Scripting: running a page function in the page the script is already in

`watchFilledZone`, `chooseFilledTown` and the new `fillSavePage` call `scripting.executeScript({ target, func, args })` and read `[{ result }]`. In the destination page itself:

```js
const hereScripting = {
  async executeScript({ func, args = [] }) { return [{ result: await func(...args) }]; },
};
```

The `tabId` they are given is ignored. That is the whole adapter for form filling.

### 3.3 Tabs

The userscript can't drive another tab, so nothing pretends to provide `chrome.tabs`. Opening a destination is one function, used where `popup.js` calls `chrome.tabs.create`:

```js
// Sketch. GM.openInTab(url, openInBackground) calls browser.tabs.create in
// Userscripts' background page, so Safari's popup blocker doesn't apply.
const openTab = (url) => GM.openInTab(url, false);
```

`window.open` would need the tap's user gesture, and WebKit drops that gesture across an extension message, such as the `GM.setValue` that has to come first (feasibility §4.6). Whether iPadOS opens the tab in front, and whether it honours `openInBackground`, is device test 2.

### 3.4 What runs where

```
Source page (userscript, content world)          Destination page (userscript, content world)
──────────────────────────────────────          ─────────────────────────────────────────────
tap "AstroChart Bridge"                          document-start: read #acb=<token>, then
 → extractorFor(url)() in this page               history.replaceState without it
 → analyzePage → viewFor → render in panel       load:
 tap "Enter in astro.com…"                         → heldForTab(gmArea, token)
 → token = crypto.randomUUID()                     → readFormPage
 → holdForTab(gmArea, token, values)               → fillForm(formValues(values))
 → openTab(ade.cgi#acb=<token>)                    → watchFilledZone(hereScripting, 0, values)
                                                   → chooseFilledTown(hereScripting, 0, values)
                                                   → releaseTab(gmArea, token)
```

## 4. Cross-tab data transfer

### 4.1 The mechanism

**A random token in the destination's URL fragment, with the chart in Userscripts' storage under that token.** This is `pending.js` as it is, keyed by the token instead of a tab id.

Why this, and not the alternatives:

| Mechanism | Crosses from Astro-Seek to astro.com? | Problem |
|---|---|---|
| Query parameters | Yes | Sent to the destination's server. astro.com's form doesn't read them anyway |
| Chart in the fragment | Yes | Not sent to the server, but readable by every script on the destination page, its advertising included, until the userscript removes it. It also lands in Safari's history, which iCloud syncs |
| **Token in the fragment, chart in GM storage** | **Yes.** GM storage is per script and shared across sites (source, feasibility §4.3; observed in Safari on macOS, §10.1; device test 1 on an iPad) | The page sees only a random token that is useless once released or expired |
| `localStorage`, `sessionStorage`, `BroadcastChannel` | No | Each is per origin |
| `window.postMessage` | Only between windows that hold a reference to each other | Lost on any navigation, and a cross-origin opener is often cut off (`noopener`, COOP). Astro-Seek's challenge page sends `Cross-Origin-Opener-Policy: same-origin` |

Fallback, only if device test 1 contradicts the source and GM storage turns out to be per site: the chart itself goes in the fragment, `#acb1=` followed by the portable format's base64url, about 300 characters. The destination's document-start code removes it. That trades the privacy point above for having no storage at all, and the trade should be written down if it is taken.

### 4.2 Safeguards against applying the wrong chart

All but the last already exist in `pending.js` and `core/astrocom.js`:

- **One token per handoff.** `crypto.randomUUID()` gives 122 random bits. A tab fills in only the chart its own URL names, so concurrent conversions and several open tabs can't cross.
- **Expiry.** `HOLD_MINUTES` (30) for astro.com, as now. `liveValues` treats a clock that moved back as expired, and drops malformed entries.
- **One use.** `releaseTab` after a fill or a Cancel.
- **The destination kind is in the key.** The prefix is `astro-com-tab:` or `astro-seek-tab:`, so an astro.com token never fills Astro-Seek's form.
- **The form must be blank.** `readFormPage` says `typed` for a form with a date or time already in it, and `fillForm` refuses it. A town or name the person already typed is kept.
- **Never submits.** Neither site's form is ever submitted, as now.
- **New: no token, no automatic fill.** A destination page without a token never fills anything on its own (§4.3).
- **Short-lived, because it may not be private.** By source reading, other content-world userscripts the person installs can reach Userscripts' storage (feasibility §7). Entries keep only what `pending.js` keeps today, and only until they're used or expire.

### 4.3 Sign-in, redirects, suspension

- **Sign-in.** Signed out, astro.com's form loads normally, and `readFormPage` reports `signed-out`. The panel then shows `viewForAstroComTab`'s existing choice, sign in first or fill in anyway, as the popup does. If the person signs in, the token's fragment is lost on the way. Back on `ade.cgi` with no token, the userscript lists any astro.com entries younger than 30 minutes and **asks** whether to fill in the newest, using the popup's own wording (`keepsWhileSigningIn`). It never fills one in unasked.
- **Redirects.** Browsers carry a fragment across an HTTP redirect whose target has none. Whether astro.com's and Astro-Seek's redirects and sign-in keep it is device test 4. The userscript removes the token at `document-start`, which Userscripts doesn't guarantee runs before the page's own scripts (feasibility §4.1), so a page script may see the token. That is harmless, and it's why only a token goes in the address.
- **A slow load, a suspended tab, switching apps.** The extension's popup waits 20 seconds for a background tab and gives up (`LOAD_TIMEOUT_MS`). Here the destination does its own work whenever its page finally loads, and the stored entry lasts 30 minutes, so Safari suspending or delaying a background tab only delays the fill. This is more robust than the extension's approach, not less.
- **Duplicate taps.** Each tap opens its own tab with its own token. The token of a tab that has been filled is released, so reloading that tab does nothing.

### 4.4 Stellarium Web's engine

`readEngine` reads `#app.__vue_app__`, a JavaScript property that Stellarium Web's Vue sets on a DOM node. A content-world userscript sees the node but not the property. Two ways to reach it, to be settled on a device:

1. **An inline `<script>` added from the content world**, holding `readEngine`'s source, that posts its result back as a JSON string with `window.postMessage`. `stellarium-web.org` sent no Content-Security-Policy, as a header or a `<meta>`, on 2026-11-05, so an inline script is allowed today. The content world re-checks every number (`Number.isFinite`, as `readEngine` and `skyFromEngine` do) before using it, because any script on the page could post the same message. The values are on screen before anything opens.
2. **A second, page-world userscript** with `@inject-into page`. Userscripts removes a page-world script's grants, so it would have no GM functions, and it injects that script as a `<script>` element too (source; feasibility §4.4). Its CSP exposure is the same as option 1's.

Option 1 keeps one script, with its grants. It's device test 6. Both depend on Stellarium Web sending no CSP that blocks inline scripts, which should be checked again when Stellarium Web updates.

### 4.5 Stellarium Desktop (deferred)

It's possible only if `GM.xmlHttpRequest` can reach `http://` addresses on the local network from an iPad. It runs as an `XMLHttpRequest` in Userscripts' background page and gets past CORS only where the extension has host access; whether that covers a LAN address is device test 12 (feasibility §4.2). If it can:

- `stellarium-desktop.js` `call()` takes a `fetch`-like function. A shim over `GM.xmlHttpRequest` gives `status`, `headers.get("Server")` and `text()`.
- The address stops being fixed at `127.0.0.1`. The person types the Mac's address, such as `192.168.1.20` or `name.local`. Only private, link-local and `.local` addresses are accepted, and the `Server: Stellarium RemoteControl` check stays.
- On a network, the plugin's password matters more than on one computer. AstroChart Bridge doesn't send it today (`auth-required` is a dead end). Supporting HTTP Basic would come with this phase.
- **No companion service is needed.** Stellarium's plugin is already the HTTP server, listening on every interface (`docs/stellarium-desktop.md`). What stands in the way is on the browser's side: mixed content and CORS. A companion would only move that problem.

Never suggest exposing the plugin beyond the local network.

## 5. User interface

**Recommended: a small injected button that opens a panel showing the popup's own screens** (options A and B of the brief, together), plus the web copy's pages (option D) for everything that starts from something other than a web page.

- **The button.** One fixed, 44-point button labelled "AstroChart Bridge", at the bottom corner of supported pages only, in a shadow root. It is inserted only on pages `classifyUrl` accepts, or `isStellariumWeb`, or `isBirthDataForm`, or `isSavePage`, so it never sits on a page with nothing to do. On a page that might be a chart but is refused, it shows the refusal, as the popup does.
- **The panel.** A dismissible sheet, not draggable: dragging fights the page's own scrolling on a touch screen. It holds the popup's `render(app, view, onButton)` output with `popup.css` inside the shadow root, so the page's styles and the panel's can't affect each other. The shadow root is closed. The styles go in as a constructed stylesheet (`adoptedStyleSheets`) or a `<style>` element; both applied on all four sites in the macOS rehearsal (feasibility §6.4, §10.1). `popup.css` already has 44-point targets under `pointer: coarse`.
- **No new screens.** Every screen, refusal, note and button is `popup-model.js`'s. The userscript's own code is the click handlers, the counterpart of `popup.js`.
- **Read a different chart** opens the web copy's pages in a new tab, where the popup opens the extension's.
- **Accessibility.** The panel is a `role="dialog"` with a label. Focus moves into it when it opens and back to the button when it closes, and Escape closes it. `view.js`'s headings, lists and fieldsets keep their semantics inside the shadow root.
- **Userscripts' own menu** can't be used. Userscripts has no menu commands on any platform, and no context menus on iOS (feasibility §4.5), so option C of the brief isn't available.
- **No framework.** `view.js` is already the renderer.

## 6. Localization

- **The same catalogs.** `messages/en.js`, `es.js` and `sl.js` go into the userscript's bundle unchanged, about 2,200 lines in all, and the web copy already loads them.
- **The same choice of language**, `setLanguage(navigator.languages)`, with one small addition: an explicit choice of English, Español or Slovenščina in the panel and on the web pages. It is kept in GM storage or `localStorage` and passed first, as `setLanguage([chosen, ...navigator.languages])`.

The reason is that Safari on iOS has long reported a single language in `navigator.languages`, and community reports disagree on whether it follows the system language or Safari's own per-app language (feasibility §6.6). The override lets someone use AstroChart Bridge in Spanish or Slovenian without changing the iPad's language, whatever Safari reports. It needs no new translation system: `setLanguage` already takes a list.

- **The website's language doesn't change.** AstroChart Bridge reads English Astro-Seek and astro.com pages, and opens their English forms. The catalogs already keep those sites' English field names inside Spanish and Slovenian sentences, so that stays as it is.
- **Dates, times and coordinates are formatted as now.** The catalogs format dates themselves (`sl.js` has its own month names), coordinates keep the `40°43'N` form in every language, and Stellarium's local clock uses `Intl` with the device's time zone.

## 7. Build and packaging

The extension loads its ES modules as they are. A userscript is one classic script, so it needs a build step.

The modules use a small set of forms: named, default and namespace imports, `export function`, `export const` (one destructured) and `export { … }`. There is one dynamic `import()`, in `chart.js`, which the userscript doesn't include.

| Option | Dependencies | Risk |
|---|---|---|
| **`tools/userscript.mjs`**: wraps each module in a function, maps its exports, and writes the metadata block (recommended) | None, consistent with the repository's "no dependencies to install" | A hand-written bundler. Guarded by a test that loads the built file in `node:vm` and runs the contract tests against it, and a test that fails on any import form it doesn't handle |
| esbuild as a dev dependency | One, with a native binary | The first `npm install` the project would need |
| Load modules at run time from GitHub Pages | None | Fetching code to run inside astro.com and Astro-Seek pages means a compromised site could run code there. Rejected |

Packaging:

- **The form Userscripts 1.8.6 accepts** (feasibility §4.1, §4.4):
  - one classic script, with no `import`;
  - its body wrapped in an `async` function, since 1.8.6 rejects a top-level `await`;
  - `@name` fixed for good, because it names the file and so keys the script's storage;
  - `@run-at document-start`, so the destination finds its token as early as it can, with the work itself waiting for the page to load;
  - `@noframes`;
  - `@version`, plus `@updateURL` and `@downloadURL` ending in `.js`.
- **One built file**, `astrochart-bridge.user.js`, published by the existing Pages workflow next to `chart.html`. It isn't committed. It's built in CI as `_site` is.
- **The metadata block** names only the hosts used: `horoscopes.astro-seek.com`, `www.astro-seek.com` (the Add person page), `www.astro.com`, `stellarium-web.org` and the receiving page's own host. It declares only the GM functions used. It has no `@require` and no `@resource`.
- **The version** follows `manifest.json`'s.
- **Size.** It holds `core/`, the models, `view.js`, the three catalogs and `popup.css`: about 530 KB as the source files stand, much of it comments, and without Tesseract. Stripping comments in the build would shrink it a lot, but it isn't needed unless the device tests show a limit.
- **The web copy** grows from 24 files to the paste, import and screenshot pages plus `vendor/tesseract/`, about 7 MB. `test/site.test.js` already checks the file list against what each page loads, and would take the new pages.
- **`screenshot.html` on the web** needs a `<meta>` CSP of `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'`, where the extension's manifest gives `'wasm-unsafe-eval'` today.

## 8. Risks to the existing Firefox and Chrome extension

| Change | What could break | Guard |
|---|---|---|
| `fillSavePage` taken out of `openAndSave` | Save in Astro-Seek… in every browser | `test/astro-seek-save.test.js` and `astro-seek-open.test.js` already drive `openAndSave` with stand-ins and must pass unchanged |
| Capability branches in `astro-com-page.js`, `paste.js`, `screenshot.js`, `chart.js` | The extension's pages taking the web path | The test `chart.js` already uses, `location.protocol.endsWith("-extension:")`, moved into one shared function with tests for each protocol |
| `stellarium-desktop.js` taking a fetch function (deferred phase) | Send to and Import from Stellarium Desktop | `test/stellarium-desktop-client.test.js` runs against a real local server and must pass unchanged. The default stays global `fetch` and `127.0.0.1` |
| A build tool reading `extension/` | Nothing at run time: it only reads | The extension never loads anything it builds |
| `popup.css` rewritten for the shadow root | Nothing: the copy is rewritten, never the file | — |
| New site files | Publishing something not meant to be public | `tools/site.mjs`'s explicit list and `test/site.test.js` |
| The userscript and the extension both installed in Safari on a Mac | Two ways in on one page | The install guide says to use one or the other in each browser. Nothing in the extension changes |

The manual checklist in `docs/manual-test.md` stays the gate for `popup.js`, which this plan doesn't touch.
