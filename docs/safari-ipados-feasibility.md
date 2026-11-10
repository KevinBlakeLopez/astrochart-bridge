# AstroChart Bridge on iPadOS through Safari and Userscripts: feasibility

An investigation, on 2026-11-05, of whether AstroChart Bridge can reach iPad users through Safari and the free, open-source [Userscripts](https://github.com/quoid/userscripts) extension, without an Apple Developer account, an App Store or Chrome Web Store submission, another browser, a native app or a server. Nothing was built.

The companion documents are [safari-ipados-architecture.md](safari-ipados-architecture.md), for the design, and [safari-ipados-implementation-plan.md](safari-ipados-implementation-plan.md), for the phases. [safari-ipad.md](safari-ipad.md) covers the other route, wrapping the extension in an app with Xcode, which needs an Apple account and may need the paid program.

**What kind of evidence this is.** Each claim below says what supports it:

- **Observed:** run here. This covers the repository's tests and the HTTP headers fetched from each site with `curl`.
- **Source:** read from code. That's AstroChart Bridge's own code, or Userscripts' at tag [`v4.8.6`](https://github.com/quoid/userscripts/tree/v4.8.6), the source of App Store version 1.8.6 for iPadOS.
- **Documented:** a vendor's documentation, or a maintainer's statement in an issue.
- **Device test:** no source settles it.

**Nothing was run on an iPad.** Every "supported" below means supported in source or documentation, not seen working on a device. §10 lists the device tests that should come before any code that depends on them. §10.1 records one rehearsal in Safari on a Mac, which settles the questions that depend on the sites and on Userscripts' own code, but none that depend on iPadOS.

## 1. Executive summary

- **The primary workflows can work.** Reading a chart on Astro-Seek or astro.com and opening it in Stellarium Web, in Astro-Seek, or in astro.com's form filled in, can all run in Safari on an iPad through a userscript. Nothing found blocks them. Each still needs the device tests in §10.
- **A Mac rehearsal backs up the core of the design** (§10.1). In Safari on macOS, with the same Userscripts source:
  - one script's storage carried a walk across all four sites;
  - a token in the address reached astro.com's form and Astro-Seek's Add person page;
  - the Stellarium Web bridge read the live engine;
  - the panel's styles applied on every site.
- **Most of the code is already portable.** The chart reading and conversion code (`extension/core/`, 27 modules) uses no browser API. Neither do the view models and the message catalogs. The functions that touch Astro-Seek's, astro.com's and Stellarium Web's pages are self-contained functions that a userscript can call as they are.
- **What the extension does that a userscript can't** is drive one tab from another. The popup opens astro.com's form in a background tab and fills it in from outside. A userscript can't, but its copy running on astro.com's form can do the same steps itself, given the chart.
  - **Userscripts' storage is per script, not per site** (source: `api.js` keys every value `<script filename>---<key>` in the extension's own `browser.storage.local`). So a random token in the form's address, with the chart kept in that storage under the token, carries the chart across.
  - `pending.js` already keeps charts this way, by tab id. A token works as a tab id does.
- **A web version of the import pages already half-exists.** The receiving page, `chart.html`, is live on GitHub Pages and works without the extension. Publishing the paste, import and screenshot pages beside it would give iPad users pasted text, AAF and Morinus files, screenshots, sharing, Stellarium Web and Astro-Seek, with nothing to install.
- **What isn't kept:**
  - **Stellarium Desktop.** The extension talks only to `127.0.0.1`, which on an iPad is the iPad itself. Reaching a Mac on the same network depends on whether Userscripts' `GM.xmlHttpRequest` can reach a local `http:` address from an iPad, which nothing settles. It would also change a deliberate security property. Defer it.
  - **Automatic updates.** Userscripts 1.8.6 checks for updates only when asked (source: the check is commented out, issue [#894](https://github.com/quoid/userscripts/issues/894)).
- **The size of the job.** Of 16 user-visible features (§3), 14 look portable:
  - 10 need no change or a minor one;
  - 4 need moderate work: a cross-tab handoff, a page-world bridge, or OCR memory on an iPad;
  - 2 aren't kept for now: sending to and importing from Stellarium Desktop.
- **Recommendation:** Safari + Userscripts as the supported iPad path, after a day of device tests:
  1. the web copy of the import pages first;
  2. then a thin userscript that reads chart pages and shows the popup's own screens;
  3. then filling in astro.com's and Astro-Seek's forms.

  Orion is worth a short experiment, not an investment (§8.5). §11 answers the brief's ten questions.

## 2. Existing architecture

Read from the repository at `e8fefa0` on branch `helioscope-gate-4`. `npm test` passed on Node 24.14.1: 1,119 tests, 0 failures (observed).

### 2.1 Shape

- **Manifest V3.** One manifest serves every browser (`extension/manifest.json`).
  - Permissions: `activeTab`, `scripting`, `storage`.
  - Optional host permissions, asked for on a click: `http://127.0.0.1/*`, `https://www.astro.com/*`, `https://www.astro-seek.com/*`.
- **No background script or service worker.** The manifest has no `background` key.
- **No declared content scripts.** The manifest has no `content_scripts` key. When the popup opens, it injects plain functions into the active tab with `chrome.scripting.executeScript({ func })`. Each injected function is self-contained, because the browser sends the tab only the function's source.
- **The popup** (`popup.html`, `popup.js`, 306 lines) is the only part that drives tabs. It reads the active tab, renders a screen and opens destinations.
- **The extension's own pages** (`screenshot.html`, `paste.html`, `import.html`, `chart.html`) open in tabs and stay open.
- **The receiving page, `chart.html`, also runs without the extension.**
  - `.github/workflows/pages.yml` publishes it, with the 24 files it loads (`tools/site.mjs`), to `https://kevinblakelopez.github.io/astrochart-bridge/chart.html`. It answered HTTP 200 (observed).
  - It already tells its two copies apart at run time, at `chart.js:38`: `canImport = location.protocol.endsWith("-extension:")`. The web copy takes paths that need no privileges, such as `viewForAstroComByHand` (`popup-model.js:599`), which shows astro.com's values to type in.

### 2.2 Layers

| Layer | Files | Browser APIs used |
|---|---|---|
| Chart reading and conversion | `extension/core/*.js`: 27 modules, ~6,150 lines | None. No module in `core/` imports from outside `core/` |
| Functions run inside a site's page | Exported from `core/astroseek.js`: `readSavePage`, `guardChartPlace`, `typeCity`, `readCityList`, `chooseGender`, `showCityChoice`. From `core/astrocom.js`: `readFormPage`, `fillForm`, `watchZone`, `readTownList`, `showTownChoice`. From `core/stellarium.js`: `readEngine`. Plus the two `extract` arrows in `core/index.js` | DOM only. Everything else, the catalog's words included, comes in as arguments |
| View models | `popup-model.js`, `chart-model.js`, `screenshot-model.js`, `paste-model.js`, `aaf-model.js`, `hor-model.js`, `desktop-model.js` | None. Covered by tests |
| Rendering | `view.js` | DOM only: `createElement` and `textContent`. Nothing in the repository uses `innerHTML` (observed, by search) |
| Localization | `messages/index.js` and the catalogs `en.js`, `es.js`, `sl.js` (~730 lines each) | `navigator.languages`, passed in by each page |
| Browser glue | `popup.js`, `astro-com-open.js`, `astro-seek-open.js`, `astro-com-page.js`, `pending.js`, `tabs.js`, `preference.js`, `desktop-page.js`, and the Share and storage lines of `chart.js`, `paste.js` and `screenshot.js` | `chrome.tabs`, `chrome.scripting`, `chrome.storage.session` and `.local`, `chrome.permissions`, `chrome.runtime.getURL` |
| Network to Stellarium Desktop | `stellarium-desktop.js` | `fetch` to `http://127.0.0.1:8090`, allowed by the optional host permission |
| OCR | `screenshot.js`, `vendor/tesseract/` (Tesseract.js 5.1.1, ~7 MB including a 3.9 MB WebAssembly core and 2.9 MB of English data) | A Web Worker started from a file, and WebAssembly (`'wasm-unsafe-eval'` in the manifest's CSP) |

Every glue module takes the browser APIs it uses as parameters, for example `openAndFill({ tabs, scripting, storage }, …)`, `tabStore(…).hold(storage, tabId, …)` and `desktopPreferred(storage)`, so the tests pass stand-ins. A second adapter would plug in at the same point.

### 2.3 What each dependency really is

| Kind | Where | Genuine platform dependency, or an implementation choice? |
|---|---|---|
| **Browser-independent** | All of `core/`, every `*-model.js`, `messages/`, `view.js` | Independent. Already runs in Node, in extension pages and on GitHub Pages |
| **DOM access to a third-party site** | The Astro-Seek and astro.com extractors, filling in astro.com's form and Astro-Seek's Add person form, and reading Stellarium Web | **Genuine.** It needs code running in that site's page: an extension's content script or a userscript |
| **The page's own JavaScript world** | `readEngine` reads `#app.__vue_app__`, which Stellarium Web's Vue sets as a JavaScript property on a DOM node. The popup injects it with `world: "MAIN"` (`popup.js:61-65`) | **Genuine.** An isolated world shares the DOM but not the page's JavaScript properties |
| **Driving another tab** | `openAndFill` and `openAndSave` open a background tab, wait for it to load (`tabs.js`), and inject functions into it one at a time | **An implementation choice.** The same steps can run inside the destination tab |
| **Storage that outlives a page** | `pending.js` keeps a chart for the tab it opened: 30 minutes for astro.com, to bridge a sign-in. `preference.js` keeps two settings | **Partly genuine.** The data must cross from one origin to another, which `localStorage` can't do. Any store shared across sites works. `tabStore` builds its key from whatever id it is given |
| **A background context** | None | There is no background script |
| **A privileged cross-origin request** | `stellarium-desktop.js` fetches `http://127.0.0.1:8090` from an extension page | **Genuine for the network part.** An `https:` page can't fetch `http:` (mixed content). The plugin sends no CORS headers unless **Enable CORS** is ticked, which `docs/stellarium-desktop.md` advises against |
| **Desktop only** | Stellarium Desktop at `127.0.0.1`, on the same machine as the browser | **Genuine as written** |
| **The extension's own origin** | `chrome.runtime.getURL("chart.html")` for Share…, and the buttons under Read a different chart, which open extension pages | **An implementation choice.** The public receiving page is the same file at an `https:` address |
| **Clipboard** | `paste.js:30`: `navigator.clipboard.readText()` on a click, with the text box as the other way in | The web platform, not the extension |
| **Files** | `<input type="file">`, `File.arrayBuffer()` and drag and drop (`import.js`, `chart.js`, `screenshot.js`) | The web platform |
| **Downloads** | `.astrochart.json` files (`chart.js:243`) and the AAF save: a Blob URL and `a.download` | The web platform |
| **Screenshot OCR** | Tesseract.js and its WebAssembly core, all vendored, nothing downloaded at run time (`screenshot.js:41-53`) | The web platform, loading from the page's own origin |

### 2.4 How chart data moves

```
 SOURCES (how the extension reaches them)
 Astro-Seek page ── extract(): body.innerText ──────┐  injected, isolated world
 astro.com page  ── extract(): a[href*="pgid="] ────┤  injected, isolated world
 Stellarium Web  ── readEngine(): $stel.core ───────┤  injected, MAIN world
 Stellarium Desk ── fetch 127.0.0.1:8090 ───────────┤  extension origin
 Screenshot      ── Tesseract OCR text ─────────────┤  screenshot.html
 Pasted text     ── textarea, or clipboard on click ┤  paste.html
 AAF / .hor file ── <input type=file> bytes ────────┤  import.html
 Link / .json    ── location.hash, or a file ───────┘  chart.html, extension or web
                                   │
                                   ▼
   core/: analyzePage · analyzeScreenshot · analyzeProgramText · analyzeEntry ·
          parseAaf → chartFromRecord · parseHor → chartFromHor ·
          portable.parse / fromFragment · skyFromEngine · skyFromStatus
                                   │  { local, utc, lat, lng, zoneLabel,
                                   │    offsetMinutes?, name?, town?, gender? }
                                   ▼
   *-model.js: viewFor, viewForSky, … → { rows, notes, buttons }
                                   │  a button is { url }, { url, holds },
                                   │  { url, fills }, { saves }, { keeps } or { does }
                                   ▼
   view.js render() ──click──▶ browser glue (popup.js, astro-com-page.js)
                                   │
   ┌───────────────────────────────┼─────────────────────────────────────┐
   ▼                               ▼                                     ▼
 URL only                   URL, then DOM work in the new tab       Not a website
 stellariumUrl()            astro.com ade.cgi: keep the values      Stellarium Desktop:
 astroSeekUrl()             (storage.session, by tab id) →          transferRequests() →
 chart.html#v1=… (Share)    tabLoaded → readFormPage → fillForm     POSTs → checkApplied()
                            → watchZone → readTownList →            AAF or .json file:
                            chooseTown → showTownChoice             Blob download
                            Astro-Seek save page: astroSeekSaveUrl
                            → readSavePage → guardChartPlace →
                            chooseGender → typeCity → readCityList
                            → chooseCity → showCityChoice
```

## 3. Feature compatibility matrix

**How features are counted.** One feature is one bullet of the README's "What it reads" and "Where it sends a chart" lists. Stellarium Web and Stellarium Desktop are split into one feature each, as are Astro-Seek's chart and Save in Astro-Seek…. That gives nine sources, R1 to R9, and seven destinations, D1 to D7. Localization cuts across all of them and is rated separately.

A percentage of features is not a percentage of use. AstroChart Bridge collects no usage data, but the workflows the brief puts first, R1, R2, D1 and D4, weigh more than one feature each.

**Confidence:**

- **High:** the same code already runs in that environment or is a tested pure function, and the platform behaviour is confirmed in source or documentation.
- **Medium:** confirmed in source or documentation, not run on an iPad.
- **Low:** a device test decides.

| # | Feature | Existing implementation | Safari + Userscripts on iPadOS | Required changes | Confidence |
|---|---|---|---|---|---|
| R1 | **Astro-Seek extraction** (birth, asteroids and traditional chart pages) | `extract` reads `document.body.innerText`. `readChart` checks the page against the URL's `narozeni_*` parameters (`core/astroseek.js:148`). It already handles Safari running the header into one line (`core/astroseek.js:96-107`) | A content-world userscript reads the DOM. That's its basic function | Call the extractor in the page. Add the panel UI | **Medium-high.** Same code. Risk: iPad mini may get a mobile layout (`docs/safari-ipad.md`), which would be refused, not misread |
| R2 | **astro.com extraction** (account chart pages) | `extract` collects `a[href*="pgid="]`. `readChart` decodes the `nd=` record in the drawing link (`core/astrocom.js:74`) | The same. It runs in the person's own signed-in Safari session: no cookies or sign-in are handled | As R1 | **Medium-high** |
| R3 | **Stellarium Web reading** | `readEngine` runs in the MAIN world and reads Vue's `__vue_app__` (`core/stellarium.js:80`) | A userscript with any `@grant` is forced into the content world, which can't see that property (source: `entry-userscripts.js` L175-186 at `v4.8.6`). A `<script>` added to the page can, unless the page's CSP forbids it. `stellarium-web.org` sent no CSP, as a header or a `<meta>` (observed) | An inline-script bridge posting the engine's numbers back. Re-check every value | **Medium** |
| R4 | **Stellarium Desktop import** | `fetch` to `127.0.0.1:8090` (`stellarium-desktop.js:103`) | Not as written: no Stellarium on an iPad. A Mac on the same network needs `GM.xmlHttpRequest` to reach a local `http:` address. That's not settled (§4.2, §4.6; device test 12) | A request shim, an address setting, HTTP Basic auth, security review | **Low.** Deferred |
| R5 | **Screenshot import** | Tesseract.js in `screenshot.html`, vendored, worker from a file | On the web copy: Safari supports WebAssembly and workers. Usable WebAssembly memory on iOS varies, and a page past it may be killed rather than told (WebKit bugs [222097](https://bugs.webkit.org/show_bug.cgi?id=222097), [221530](https://bugs.webkit.org/show_bug.cgi?id=221530)) | Publish the page, with a `<meta>` CSP that allows `'wasm-unsafe-eval'` | **Low-medium.** Memory is a device test |
| R6 | **Pasted text** | `paste.html`: the text box, and **From clipboard** with `navigator.clipboard.readText()` on a click | The text box works everywhere. On iOS, a clipboard read in a gesture shows a **Paste** callout to tap ([WebKit](https://webkit.org/blog/10855/async-clipboard-api/)) | Publish the page. Share… goes to the web receiving page | **High** for the box, **medium** for the button |
| R7 | **AAF files** | `import.html`: `<input type="file">`, `File.arrayBuffer()`, `parseAaf` | `Blob.arrayBuffer()` since iOS 14.5 (MDN). The Files picker is standard | Publish the page | **High** for the logic, **medium** for the picker |
| R8 | **Morinus `.hor` files** | As R7, with `parseHor` | As R7 | As R7 | **High / medium** |
| R9 | **Links, QR codes, `.astrochart.json`** | `chart.html`, already on GitHub Pages | Already reachable from any browser | None | **High.** The page is live. Not yet opened on an iPad |
| D1 | **Open Stellarium Web** | `stellariumUrl()`, a link | A link. From a userscript, `GM.openInTab`, which isn't subject to the popup blocker (source: `tabs.create`) | None to the logic | **High** |
| D2 | **Send to Stellarium Desktop** | POSTs to `127.0.0.1:8090` | As R4 | As R4 | **Low.** Deferred |
| D3 | **Open chart in Astro-Seek** | `astroSeekUrl()`, a link. The extension also keeps the town and name for that tab, for a later Save in Astro-Seek… | The link: yes. The kept town and name: only with a token in Astro-Seek's address, and its chart links already use `#tabs_redraw` | None for the link. Keeping the town and name is optional | **High** for the link |
| D4 | **Enter in astro.com…** (fill, zone check, town choice) | The popup opens `ade.cgi` behind it, keeps the values by tab id, and injects five functions | **Cross-site form population.** The destination page's userscript does the same steps itself. The chart crosses in GM storage under a token in the address (§4.3, architecture §4) | A token handoff and a destination runner. The five functions are reused unchanged through an in-page `scripting` stand-in | **Medium** |
| D5 | **Save in Astro-Seek…** (city and gender) | `astroSeekSaveUrl()`, then six injected functions on `www.astro-seek.com` | As D4. Without the userscript, the address alone already fills in everything but the town (the existing `declined` path) | As D4, plus moving `openAndSave`'s post-load steps into a function of their own | **Medium** |
| D6 | **Save as AAF file** | A Blob URL and `a.download` | Safari on iPadOS saves downloads to Files | None | **Medium.** A device test |
| D7 | **Share…** (link, QR, file, share sheet) | `chart.html` | Already on the web. `navigator.share` exists in Safari | Share… from the userscript and the web pages opens the web receiving page | **High** |
| L | **Localization** (English, Spanish, Slovenian) | Three catalogs, chosen from `navigator.languages` (`messages/index.js:21`) | The catalogs are plain modules. iOS Safari's `navigator.languages` often has one entry, and which setting it follows is unsettled (§6.6) | A language choice in the panel and the pages, passed before `navigator.languages` | **High** for the text, **medium** for the automatic choice |

Tally: R9, D1, D3, D6 and D7 need no change to their code. R1, R2, R6, R7 and R8 need minor changes. R3, R5, D4 and D5 need moderate ones. R4 and D2 aren't kept for now.

The shared groundwork is counted once, not in each feature: the build step, the panel, and the web copy's capability branch. That groundwork is most of phases 1 and 2 of the plan, so "minor" means the feature's own code changes little, not that the first release is small.

## 4. Verified Userscripts capabilities

Userscripts by quoid (Justin Wasack), maintained mostly by ACTCD:

- **The App Store build** is [1.8.6](https://apps.apple.com/us/app/userscripts/id1463298887), from 11 January 2026. It's free and needs iPadOS 15.0 or later. It's the same source as the macOS v4.8.6 [release](https://github.com/quoid/userscripts/releases/tag/v4.8.6).
- **v5.0.0-beta.23** (2026-05-10) is on TestFlight and is the head of `main`. This document targets 1.8.6 and depends on nothing that only the beta has.
- **Activity:** the last code commit is 2026-05-10. Issues are still answered through late October 2026, and a v5 refactor of the native side is said to be in progress (issue [#894](https://github.com/quoid/userscripts/issues/894)).

Every source reference below is to tag `v4.8.6` unless it says otherwise.

### 4.1 Metadata

Source: `xcode/Ext-Safari/Functions.swift`, `getCode` and the metadata parser. Also the README.

| Directive | Status |
|---|---|
| `@name` | Required. It becomes the installed file's name, and that **name keys the script's storage** (§4.3), so it must never change |
| `@match`, `@exclude-match`, `@include`, `@exclude` | Supported. `@match` takes `http`, `https` and `<all_urls>`, and ignores ports |
| `@run-at` | `document-start`, `document-end` (the default) and `document-idle`. `document-start` is **not guaranteed** to run before the page's own scripts: injection waits on storage and a native message (issues [#623](https://github.com/quoid/userscripts/issues/623), [#459](https://github.com/quoid/userscripts/issues/459)). `context-menu` is macOS only |
| `@inject-into` | `auto` (the default), `content`, `page`. **Any `@grant` forces the content world**, and a page-world script has its grants removed (source: `entry-userscripts.js`, confirmed here) |
| `@grant` | An allowlist. Only `GM.`-prefixed names, plus `GM_info` and `GM_xmlhttpRequest` |
| `@noframes` | Supported. Without it, scripts run in frames too: the manifest sets `all_frames: true` |
| `@version`, `@updateURL`, `@downloadURL` | Supported, for a manual update check (§8.3) |
| `@require` | Fetched once by the native side, with `http` rewritten to `https`. A failed download is skipped **silently** ([#871](https://github.com/quoid/userscripts/issues/871)). AstroChart Bridge shouldn't use it |
| `@resource` | Not implemented |
| `@connect`, `@namespace` | `@connect` is ignored. `@namespace` is parsed, but `GM.info` reports it empty |

### 4.2 GM functions

Source: `src/ext/content-scripts/api.js`, `src/ext/background/main.js`. No iOS-specific gating was found in either.

| Function | Status for AstroChart Bridge |
|---|---|
| `GM.getValue`, `setValue`, `deleteValue`, `listValues` | **Confirmed in source.** Values are structured: whatever `browser.storage.local` stores, no JSON needed. `listValues` lists only this script's keys |
| `GM.openInTab(url, openInBackground)` | **Confirmed in source.** It takes a boolean, not an options object, and calls `browser.tabs.create({ active: !openInBackground })`. Whether iPadOS honours a background tab is a **device test** |
| `GM.closeTab`, `GM.getTab`, `GM.saveTab` | In source. `getTab` and `saveTab` keep their data in a background page that may unload; issue [#667](https://github.com/quoid/userscripts/issues/667) proposes deprecating them. **Not used** |
| `GM.xmlHttpRequest` | In source: an `XMLHttpRequest` made in Userscripts' background page, with origin `safari-web-extension://`. It supports `user` and `password`; `anonymous` and `fetch` aren't supported. It gets past CORS only where the extension has host access ([#897](https://github.com/quoid/userscripts/issues/897), macOS). Local `http:` addresses from an iPad: a **device test** |
| `GM.addStyle` | In source, through `tabs.insertCSS`. Top frame only |
| `GM.setClipboard` | **Unreliable on iOS** ([#285](https://github.com/quoid/userscripts/issues/285), closed as unfixable). Not needed |
| `GM.info` | Always available |
| Not available | Menu commands ([#230](https://github.com/quoid/userscripts/issues/230)), `GM.notification`, `GM.download`, `GM.getResourceUrl`, `unsafeWindow` ([#252](https://github.com/quoid/userscripts/issues/252)), value-change listeners, `window.onurlchange`, and synchronous `GM_getValue` and `GM_setValue` |

### 4.3 Storage scope: shared across sites, per script

**Confirmed in source, and observed in Safari on macOS (§10.1). Not yet observed on an iPad.**

- In `api.js` (lines 1-53), `setValue` writes `item[\`${sid}---${key}\`]` to `browser.storage.local`, where `sid` is the script's own file name, bound to each script when it's injected.
- `browser.storage.local` is Userscripts' extension storage, not a web origin's. So one `.user.js` matching `horoscopes.astro-seek.com`, `www.astro.com` and `stellarium-web.org` reads and writes the same keys on all three.
- `localStorage` and `sessionStorage` are, as always, per origin.

The cross-tab design in architecture §4 rests on this.

Limits:

- The storage isn't synced between devices.
- Other userscripts the person has installed may be able to read it (§7).
- A script installed under a different file name gets a fresh store, so `@name` stays fixed.

### 4.4 Execution

- **The content world** runs the script as `Function({GM…}, code)(apis)` (source: `entry-userscripts.js` L80-86). It shares the page's DOM, not its JavaScript.
  - **1.8.6 doesn't wrap the code, so a top-level `await` is a syntax error.** The beta wraps it in an async function.
  - **Static `import` is a syntax error in both worlds**, so the userscript has to be one built file (architecture §7).
- **The page world** is a `<script>` element in a closed shadow root (`entry-userscripts.js` L71-78), subject to the page's CSP. So is any `<script>` or `<style>` element a content-world script adds (README FAQ, [#954](https://github.com/quoid/userscripts/issues/954)).
- **Navigation:** a script runs once per document load. A single-page app's history changes don't run it again. AstroChart Bridge reads on a tap, so this doesn't matter.
- **Size:** no limit in the JavaScript. iOS limits an extension's native process to about 80 MB, and large scripts broke message replies until 1.8.6 ([#293](https://github.com/quoid/userscripts/issues/293)).

### 4.5 The interface Userscripts itself offers on iPadOS

Userscripts' popup, opened from Safari's extensions button, has:

- an on and off switch;
- the list of scripts matching the page;
- the install prompt;
- an update check.

It has **no menu commands** and no context menus on iOS, so a script can add nothing to it. A page itself is the only place for AstroChart Bridge's interface.

Known iPadOS issues to keep in mind when testing:

- Opening an extension's popup crashed Safari on iPadOS 26.4 with Compact Tabs ([#921](https://github.com/quoid/userscripts/issues/921)). Most extensions are affected.
- "Preload Top Hit" stops scripts running ([#977](https://github.com/quoid/userscripts/issues/977), reported on iOS 27.0.1).
- The scripts folder sometimes resets ([#896](https://github.com/quoid/userscripts/issues/896)).

### 4.6 Safari platform behaviour that matters here

| Capability | Status | Evidence |
|---|---|---|
| `window.open` | Allowed only during a user gesture. The gesture survives a `setTimeout` of up to 1 second and microtasks. Waiting on an extension message, such as any GM call, probably loses it | Source: WebKit `LocalDOMWindow.cpp`, `UserGestureIndicator.h`, read at commit dbcd525. So the userscript opens tabs with `GM.openInTab` |
| A fragment kept through an HTTP redirect | Per the Fetch and HTML standards, a redirect target with no fragment keeps the original's | Documented. astro.com's and Astro-Seek's own redirects: a **device test** |
| Clipboard read | Only in a gesture. iOS shows a **Paste** callout, which needs a tap unless the same origin wrote the text | [WebKit blog](https://webkit.org/blog/10855/async-clipboard-api/). From a content-world userscript: a **device test**, and not needed: reading the clipboard stays on the web copy |
| A pasted image | Comes through as a PNG `File` in `clipboardData.files` | [WebKit blog](https://webkit.org/blog/8170/clipboard-api-improvements/). `screenshot.js:55` already reads it |
| File input | `File.text()` and `arrayBuffer()` since iOS 14.5. Some `accept` values filter oddly ([229456](https://bugs.webkit.org/show_bug.cgi?id=229456)) | MDN compatibility data, WebKit bugs. The Photos and Files choices: a **device test** |
| Mixed content | An `https:` page can't `fetch` an `http:` address, and IP addresses aren't upgraded | [MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content) |
| Local network prompt | Safari's own traffic needs no local-network permission | Apple [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy). Whether that covers Userscripts' background page: a **device test** |
| Private Network Access | No evidence that WebKit implements it | WebKit standards position #163, closed with no stated outcome |
| WebAssembly memory | Varies by device, from about 200 MB to 1.9 GB in reports. Past the limit, the tab may be killed | WebKit bugs [222097](https://bugs.webkit.org/show_bug.cgi?id=222097), [221530](https://bugs.webkit.org/show_bug.cgi?id=221530) |
| The sites' CSPs | `stellarium-web.org`: no CSP header or `<meta>`. `www.astro.com/cgi/ade.cgi`: none, but `X-Frame-Options: deny`. `horoscopes.astro-seek.com`: unknown, because `curl` got Cloudflare's challenge page, whose own CSP and `Permissions-Policy: clipboard-read=(), clipboard-write=()` may not be the real page's. `www.astro-seek.com`: only `frame-ancestors 'self'` | Observed with `curl -D -`, 2026-11-05, and from inside the pages in Safari on macOS, 2026-11-07 (§10.1), where the Astro-Seek chart host again answered with the challenge page |

## 5. Unsupported functionality

What can't be carried over, or not as it is:

- **Stellarium Desktop at `127.0.0.1`.** On an iPad, that address is the iPad. Reaching a Mac needs a different design (§6.5), and it's deferred.
- **Driving a background tab from the popup.** No userscript API can inject into another tab or wait for it to load. Replaced as §6.1 describes.
- **The extension's per-feature permission requests.** `chrome.permissions.request` asks for `www.astro.com` only when the form button is clicked. With Userscripts, Safari asks the person to allow **Userscripts** on each site, and the README suggests "All Websites", for all scripts. The person can still allow only the sites AstroChart Bridge uses.
- **Automatic updates.** The 1.8.6 check is manual (§8.3).
- **Menu commands and context-menu actions.** None on iOS (§4.5).
- **A toolbar button.** The extension's popup is opened from the toolbar. A userscript has no toolbar presence of its own, so the button goes on the page.
- **Synchronous storage, `unsafeWindow` and `@resource`.** AstroChart Bridge needs none of them.

## 6. Required workarounds

### 6.1 Tab orchestration becomes destination-side work

The destination's own copy of the userscript runs the steps the popup runs from outside. The source holds the chart in GM storage under a fresh random token, then calls `GM.openInTab("…ade.cgi#acb=<token>")`. The destination reads the token, removes it from the address, and runs:

1. `readFormPage`;
2. `fillForm`;
3. `watchFilledZone`;
4. `chooseFilledTown`;
5. `releaseTab`.

All are existing functions, called through an in-page stand-in for `chrome.scripting`. Architecture §4 has the safeguards against the wrong chart.

### 6.2 Reaching Stellarium Web's engine

The content-world script adds a `<script>` element holding `readEngine`'s source, which posts the engine's numbers back as a JSON string. Allowed while `stellarium-web.org` sends no CSP.

### 6.3 One built file

A build step bundles the modules into one classic script, wrapped in an async function, since 1.8.6 rejects a top-level `await`. Architecture §7 weighs a small in-repository bundler against esbuild.

### 6.4 The panel's styles

The panel lives in a shadow root, so the page's styles and `popup.css` can't affect each other. A `<style>` element is subject to the page's `style-src`. A constructed stylesheet (`adoptedStyleSheets`) may not be. In the macOS rehearsal (§10.1), both applied on all four sites, Astro-Seek's chart page included, so either can be used.

### 6.5 Stellarium Desktop, if it is ever done

It needs all of these:

- a shim over `GM.xmlHttpRequest`;
- an address setting limited to private, link-local and `.local` addresses;
- HTTP Basic support for the plugin's password;
- the device test on reaching `http:` on the local network.

No companion service is needed. Stellarium's plugin already listens on every interface (`docs/stellarium-desktop.md`).

### 6.6 Language

`messages/index.js` takes the first of `navigator.languages` it has a catalog for. On iOS, reports say:

- `navigator.languages` has long held only the first preferred language ([Cordova CB-14236](https://issues.apache.org/jira/browse/CB-14236));
- which setting it follows, the system's or the app's own, has varied between iOS versions ([Apple forums 749795](https://developer.apple.com/forums/thread/749795)).

These are community reports from WKWebView apps and older iOS versions, not Safari 26.

Neither prevents Spanish or Slovenian. Given that, the workaround is a language choice in the panel and on the web pages:

- it's kept on the device;
- it's passed first, as `setLanguage([chosen, ...navigator.languages])`;
- it reuses the three catalogs as they are.

That lets someone use AstroChart Bridge in Spanish or Slovenian without changing the iPad's language. Whether Safari's per-app language setting already does that is a device test.

### 6.7 Clipboard

Reading stays on the web copy's paste page, as now: the text box, plus the button that reads on a tap. `GM.setClipboard` isn't used. The receiving page's Copy link already uses `navigator.clipboard.writeText`.

## 7. Security considerations

- **What leaves the device is unchanged.** Stellarium Web and Astro-Seek get the moment and place in their address, as now. astro.com's and Astro-Seek's forms are filled in the page and never submitted. Share… still carries the name and town only when ticked. Screenshots, files and pasted text are read in the page and never uploaded. Tesseract runs from the page's own origin with no CDN.
- **What the web copy adds:** GitHub serves the pages, so it sees that someone loaded them, not any chart. The receiving page already works this way.
- **What the userscript keeps:**
  - Pending handoffs, as `pending.js` already keeps them: the decided UTC, place, local time, town, name and gender. Nothing of the sites' own.
  - Each entry lasts at most 30 minutes, is removed once used, and lives in Userscripts' storage on this device, not synced.
  - Plus the two preferences and an optional language choice.
- **Other userscripts may read that storage.**
  - Content-world scripts run through `Function()` in the content script's global scope, where `browser.storage.local` can be reached. Nothing in the injection code hides it (source: `entry-userscripts.js` L80-86).
  - So any other content-world userscript the person installs could, by this reading, read AstroChart Bridge's pending entries. This hasn't been tried.
  - That reaches further than the sites themselves: a content-world userscript running on any site, not only astro.com, could read an entry while it exists. Keeping entries short-lived and one-use is the mitigation, and the install guide should say it.
- **Tokens in addresses:** 122 random bits, meaningless once released or expired. Page scripts may see one before it's removed, because `document-start` doesn't always run first (§4.1). That's the reason a token goes in the address and the chart doesn't.
- **Messages from a page can be forged.** Any script on Stellarium Web could post the engine bridge's message, Google Tag Manager's included. The content world accepts only a message carrying its own request id, with finite numbers in range, and shows the values before anything opens. The request id only filters out stale or unrelated messages: the page can read the injected script, so the id doesn't stop a deliberate forgery. The range checks and showing the values first are what stop that.
- **Script injection:** the rendering code builds every element with `createElement` and `textContent`, and there's no `innerHTML` anywhere in the repository (observed). The panel uses a closed shadow root.
- **Automatic submission:** none. Neither form is ever submitted, as now.
- **Local network:** deferred. If built: private addresses only, the `Server: Stellarium RemoteControl` check, password support, and never advising anyone to expose the plugin beyond the local network.
- **Supply chain:**
  - no `@require` and no code loaded at run time;
  - the file is built by the existing Pages workflow from `main` only, with actions pinned to commits;
  - its `@match` lines name five hosts;
  - `@noframes`;
  - only the GM functions used are granted.

## 8. Distribution approach

### 8.1 Where the script lives

At `https://kevinblakelopez.github.io/astrochart-bridge/astrochart-bridge.user.js`, published with the receiving page by `.github/workflows/pages.yml`:

- the address's **path** ends in `.user.js`, which is what Userscripts looks for (source: the manifest's `*://*/*.user.js` content script);
- GitHub Pages serves it as `application/javascript` over HTTPS;
- it isn't behind Cloudflare, so the popup's own re-fetch of the URL works ([#950](https://github.com/quoid/userscripts/issues/950)).

GitHub Releases is a poor fit: asset URLs redirect to a download host and are served as attachments, which most likely download the file instead of offering to install it (inference, not tried).

### 8.2 Installing

From the README at `v4.8.6`, with the 1.8.6 popup behaviour from [#876](https://github.com/quoid/userscripts/issues/876):

1. Install **Userscripts** from the App Store. It's free and needs iPadOS 15 or later.
2. Open the app once. It sets up a scripts folder, "On My iPad › Userscripts", by itself.
3. Turn Userscripts on in Safari's extension settings, under **Settings › Apps › Safari › Extensions**, or from **Manage Extensions** in Safari's address bar. Allow it on Astro-Seek, astro.com, Stellarium Web and the receiving page's site, or on all websites.
4. In Safari, open the script's address. Safari shows its text.
5. Tap the extensions button in the address bar, then **Userscripts**. In 1.8.6 the popup must be opened by hand; it says "Userscript Detected: Tap to install". Tap it.
6. Open an Astro-Seek chart. If Safari asks, allow Userscripts on that site. The AstroChart Bridge button appears.

The other way in: save the `.user.js` file into the Userscripts folder in Files, then open the popup once. If the folder is in iCloud Drive, set it to keep downloaded files, or iOS may remove them ([#424](https://github.com/quoid/userscripts/issues/424)).

Exact wording and permission prompts on iPadOS 26: a device test.

### 8.3 Updates, versions and rollback

- **Updates are manual** in 1.8.6: Userscripts' popup › updates › check. The automatic check is commented out (source: `App.svelte` L307). In the v5 beta it's a setting that defaults to never.
- The script carries `@version`, the extension's version, plus `@updateURL` and `@downloadURL`, both the address above. In 1.8.6, `@updateURL` must end in `js`, so it has no query string (source: `Functions.swift`).
- Versions compare numerically, part by part.
- **Rollback:** each release is also published at a versioned address, such as `…/userscript/0.2.0/astrochart-bridge.user.js`, from which an older one can be installed by hand. It updates forward again only when the person checks.
- **Authenticity:** HTTPS from the project's own Pages site, built in CI from `main`. Each release's notes give the commit and the file's SHA-256. Safari shows the script's text before installing. No Apple Developer account is involved at any step.
- **Installation failures** to document:
  - the extension isn't allowed on the site;
  - the popup was never opened, so the script was never noticed;
  - the scripts folder reset ([#896](https://github.com/quoid/userscripts/issues/896));
  - Preload Top Hit ([#977](https://github.com/quoid/userscripts/issues/977)).

### 8.4 Permissions asked of the person

Safari asks about Userscripts, not about AstroChart Bridge. AstroChart Bridge's own scope is its `@match` and `@grant` lines.

### 8.5 Compared with Orion

[Orion](https://kagi.com/orion/) runs Chrome and Firefox extensions on iPadOS and can install from a file, so the existing extension might run with no new code at all. Against it:

- **It's another browser,** which the brief wants to avoid.
- **Its iOS extension support "is still in beta",** limited by "APIs we can support which are imposed by Apple" ([Kagi](https://help.kagi.com/orion/browser-extensions/ios-ipados-extensions.html)).
- **Nothing found says whether Orion on iPadOS supports what the popup needs:**
  - `scripting.executeScript` with `world: "MAIN"`;
  - `storage.session`;
  - `permissions.request` for optional hosts;
  - the action popup.

  Kagi's API list is a spreadsheet linked from its [technical page](https://help.kagi.com/orion/misc/technical.html).

Worth half an hour on an iPad: install the Firefox build in Orion and run test 18. If it works, document it as an alternative. Don't build anything for it.

## 9. Outstanding questions

1. **Astro-Seek's real CSP and Permissions-Policy.** Neither `curl` nor the macOS rehearsal got past Cloudflare's challenge to read them. It no longer decides how the panel's styles load: both kinds applied there (§6.4, §10.1). It still matters for clipboard access on Astro-Seek's pages, which the challenge page's `Permissions-Policy` would forbid. Safari's Web Inspector, on the chart page itself, can show the real headers.
2. **Which iPadOS versions to support.** Userscripts runs on iPadOS 15 and later, the extension's manifest asks for Safari 26, and the code uses `String.prototype.isWellFormed` (Safari 16.4). The userscript's floor is a choice to make.
3. **Whether Open chart in Astro-Seek should keep the town and name for a later Save in Astro-Seek…** It depends on Astro-Seek's chart pages keeping a fragment of the userscript's beside their own `#tabs_redraw`.
4. **The risk of depending on Userscripts.** Its last release was in January 2026, with a native-side rewrite in progress. If it stopped working, the web copy would keep imports, Share…, Stellarium Web and Astro-Seek working. Only reading chart pages and filling in forms would be lost.
5. **Whether anyone needs Stellarium Desktop from an iPad.** If not, phase 7 never happens.
6. **What the install guide says about allowing all websites,** which Userscripts' README suggests, versus allowing only the sites AstroChart Bridge uses.

## 10. Device tests

Each needs Safari with Userscripts 1.8.6 on an iPad. Note the iPadOS version and date with each result. The "Decides" column names what waits on it.

| # | Question | Decides |
|---|---|---|
| 1 | One script writes a GM value on `horoscopes.astro-seek.com` and reads it on `www.astro.com` | The handoff in architecture §4. Source says yes |
| 2 | `GM.openInTab(url, false)` and `(url, true)`: does the tab open, and does it come to the front? | How tabs are opened |
| 3 | `window.open` called after `await GM.getValue(…)` in a tap handler | Confirms `GM.openInTab` is needed |
| 4 | Does `ade.cgi#acb=x` keep its fragment until the page loads, signed in and signed out? Through Astro-Seek's `my-profile-astro-database` signed out? | The token in the address |
| 5 | Does `document-start` code run before astro.com's own scripts? | Only how quickly the token leaves the address |
| 6 | A `<script>` added by a content-world userscript on Stellarium Web reads `__vue_app__` and posts the result back | R3 |
| 7 | `navigator.language` and `navigator.languages` with the iPad in English and Safari set to Español or Slovenščina, and the other way round | Whether the language choice is necessary |
| 8 | `<input type="file">` without `accept`, and with `accept="image/*"`: are Files, Photos and the camera offered? | R5, R7, R8 |
| 9 | Tesseract on the web copy, with a full-size iPad screenshot on the oldest iPad available | R5 |
| 10 | **From clipboard** on the web copy: the Paste callout, then declining it | R6 |
| 11 | Blob downloads of `.aaf` and `.astrochart.json`: does each land in Files › Downloads? | D6, D7 |
| 12 | `GM.xmlHttpRequest` to `http://<Mac's address>:8090/api/main/status` with Stellarium running | R4, D2 |
| 13 | Installing from the GitHub Pages address, and from a GitHub raw address | §8.2 |
| 14 | The panel on an iPad mini: does Astro-Seek serve its desktop page? | R1 |
| 15 | Whether Compact Tabs or Preload Top Hit get in the way on the test iPad | The install guide |
| 16 | Orion: the Firefox build, test 18 | §8.5 |

### 10.1 Rehearsal on macOS Safari, 2026-11-07

**Setup.** The tests were run once in Safari on a Mac, with Userscripts for macOS. That build has the same source as the iPad's 1.8.6. They were run as a throwaway walkthrough userscript, kept outside the repository, at its version 0.2.0.

- **Versions:** Safari 26.6.2, macOS 26.6.2, Userscripts 4.8.6.
- **Sites:** live astro.com, Stellarium Web and Astro-Seek, signed in to both astrology sites.

**What it can settle.** A Mac settles what depends on the sites and on Userscripts' own code. It doesn't settle what depends on iPadOS: file pickers, the share sheet, background-tab suspension, memory, or `navigator.languages` on iOS. **Every iPad row of §10 stays open.**

| # | Observed on macOS Safari | What it means for the iPad |
|---|---|---|
| 1 | One walk carried its progress across `www.astro-seek.com`, `www.astro.com`, `stellarium-web.org` and `horoscopes.astro-seek.com` | GM storage is per script and shared across sites, as the source says (§4.3). The handoff design in architecture §4 holds on Userscripts' shared code |
| 2 | `GM.openInTab(url, false)`: the new tab came to the front about 60 ms after the click. `GM.openInTab(url, true)`: the tab loaded while hidden, and first showed about 6 s later, when switched to | `openInBackground` is honoured on macOS. The iPad still decides its own behaviour |
| 3 | `window.open` after `await GM.getValue(…)` returned `null`: blocked | Matches the WebKit source reading in §4.6. Opening tabs goes through `GM.openInTab` |
| 4 | The token arrived on `ade.cgi`, and on Astro-Seek's `my-profile-astro-database`, three times each. In every case `history.replaceState` removed it before `load` | The token in the address works through both sites' pages when signed in. **Signed out was not tried**, so that half of test 4 remains |
| 5 | At `document-start`, astro.com already held 22 script elements while still loading. Stellarium Web held 3, Astro-Seek 2 to 3 | On astro.com, the script ran after the page's first scripts. Running before the page's scripts isn't something to rely on (§4.1), and the design doesn't: only a random token is in the address |
| 6 | The inline-script bridge read Stellarium Web's engine: finite UTC, latitude and longitude, and a place name | R3's approach works on the live site. The sky didn't match the one the walk opened. Version 0.2.0 didn't record whether the time or the place differed; the walkthrough now records both as yes or no |
| 8 | `accept="image/*"` read a PNG through the Finder dialog. The step without `accept` gave no result: a fault in the walkthrough's file step, since fixed, not in Safari | The iPad picker's choices remain to be seen |
| 10 | `clipboard.writeText` worked. `readText` of the page's own text worked with no prompt. Pasting into a text box worked. Text copied in another app brought up Safari's **Paste** button; left unclicked, `readText` failed with `NotAllowedError`. A pasted screenshot arrived as a PNG in `clipboardData.files` | Matches WebKit's documented behaviour (§4.6). It supports keeping the paste box as the main way in, with **From clipboard** as a convenience |
| 11 | A Blob download of `probe.aaf` saved to Downloads, the full 121 bytes | — |
| 12 | Not tested: Stellarium wasn't running, so the request had nothing to reach | Still open, on the Mac as well as on the iPad |
| 14 | Astro-Seek's desktop chart page printed each of the four labels `readChart` needs exactly once | R1 reads Astro-Seek's desktop layout, which full-size iPads are also served. iPad mini remains |
| 17 | **Stylesheets:** both a constructed stylesheet and a `<style>` element applied in a shadow root on all four sites, Astro-Seek's chart page included. **Policy headers:** astro.com and Stellarium Web sent no CSP. `www.astro-seek.com` sent only `frame-ancestors 'self'`. For `horoscopes.astro-seek.com`, the only headers captured were Cloudflare's challenge page's, status 403 | The panel can style itself on every site (§6.4). The chart host's own policy is still unread, but no longer decides anything |

## 11. Final recommendation


1. **Can the primary workflows run through Safari + Userscripts on iPadOS?** Yes, as far as source and documentation show. Reading Astro-Seek and astro.com charts, opening Stellarium Web and Astro-Seek, and filling in astro.com's form all have a path that uses only what Userscripts 1.8.6 provides. The decisive fact is that GM storage is per script, not per site. That's confirmed in source and observed in Safari on macOS (§10.1), but not yet on an iPad. Device tests 1 to 4 should still come first on an iPad, signed out as well as signed in.
2. **How much is portable?** Counting the 16 features in §3: 14, or 88%, look portable. 10 of those, 63% of the total, need no change or a minor one. That's a count of features, not of use, and it assumes the device tests pass.
3. **What can't be kept?**
   - Sending to and importing from Stellarium Desktop, for now (R4, D2).
   - Automatic updates: they become a manual check.
   - The extension's narrower, ask-when-needed site permissions: Safari asks about Userscripts as a whole.
4. **Minor adaptation:**
   - reading Astro-Seek and astro.com pages (R1, R2);
   - pasted text (R6);
   - AAF and Morinus files (R7, R8).

   Links, Share…, Stellarium Web, Astro-Seek and the AAF download (R9, D7, D1, D3, D6) need none, beyond a device check of the download.
5. **Significant engineering:**
   - Stellarium Desktop over a network: large, with a security review.
   - Moderate: filling in astro.com's form (D4), Save in Astro-Seek… (D5), reading Stellarium Web (R3), screenshots within an iPad's memory (R5), and the build step for one file.
6. **The smallest viable iPad version:**
   - the web copy of the paste, import and screenshot pages (plan phase 1);
   - a userscript that reads Astro-Seek and astro.com chart pages and shows the popup's own screens in a panel (phase 2), with Stellarium Web, Astro-Seek, astro.com's values to type in, and Share… through the receiving page.

   Filling in forms comes next (phase 3).
7. **Safari + Userscripts or Orion?** Safari + Userscripts.
   - It keeps people in Safari.
   - What it needs is confirmed in Userscripts' source.
   - Userscripts is free and open source.

   Orion might run the extension unchanged, but its iPad extension support is beta, and nothing found says it covers the APIs the popup uses. Test it once; don't build for it.
8. **Is a standalone web interface worth it?** Yes, because it mostly exists. `chart.html` is live and works without the extension. Publishing three more pages makes imports, Share…, Stellarium Web and Astro-Seek work on an iPad with nothing installed, and in any other browser without the extension. If Userscripts ever stops working, it's also the fallback.
9. **What first?** The device tests in §10, about a day, with plan phase 1 alongside, since it needs no iPad to build. Then phase 2.
10. **What needs an iPad before going on?** §10, above all:
    - tests 1 to 4: storage across sites, opening tabs, and the fragment through sign-in;
    - test 6: Stellarium Web;
    - test 9: OCR memory;
    - test 12: Stellarium Desktop on the network.
