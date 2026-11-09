# AstroChart Bridge on iPadOS through Safari and Userscripts: implementation plan

An incremental plan for [safari-ipados-architecture.md](safari-ipados-architecture.md), using the findings in [safari-ipados-feasibility.md](safari-ipados-feasibility.md). Phase 0 is under way and phase 1 is built; the rest hasn't been started.

Each phase is a pull request of its own, written test first. Every phase leaves `npm test` and the manual checklist in `docs/manual-test.md` passing for the existing extension. Phases 1 and 2 don't depend on each other. Every later phase depends on phase 0's answers.

Complexity is relative: **S** is a day or less, **M** a few days, **L** a week or more, or a security review.

## Phase 0: settle the device questions

- **Scope:** No production code. A throwaway test userscript, kept outside the repository or under `build/`, installed with Userscripts on an iPad, to answer the "Device test" items in feasibility §10. Results go in the feasibility document.
- **Status, 2026-11-07:**
  - The test userscript exists as a guided walkthrough for remote testers, with a tester guide.
  - A rehearsal in Safari on macOS (feasibility §10.1) confirmed GM storage across sites, the token in the address while signed in, the Stellarium Web bridge, and the panel's styles on all four sites.
  - The iPad run is still to come.
- **Dependencies:** An iPad on iPadOS 26 with Userscripts from the App Store.
- **Complexity:** S.
- **Tests:** The probes themselves:
  - write a GM value on one site and read it on another;
  - call `GM.openInTab` and `window.open` after an `await`;
  - check whether a `#fragment` survives astro.com's form and sign-in, and Astro-Seek's redirects;
  - check whether document-start code runs before the page's own scripts;
  - read Stellarium Web's inline-script bridge;
  - check what `navigator.languages` reports under each Safari language setting;
  - read a file from Files and from Photos;
  - see what the clipboard prompt does;
  - save a Blob download;
  - make a `GM.xmlHttpRequest` to `http://<Mac's address>:8090/api/main/status`.
- **Acceptance:** Every row of feasibility §10 has an observed answer, with the iPadOS and Userscripts versions and the date.
- **iPad needed:** Yes. This phase exists because of that.

## Phase 1: the web copy of the import pages

- **Scope:**
  - Publish `paste.html`, `import.html` and `screenshot.html` with `chart.html`.
  - Add a shared run-time test for "extension copy or web copy", generalizing `chart.js:38`.
  - On the web, Share… opens `RECEIVER_URL` with the chart in its fragment.
  - On the web, the astro.com buttons lead to `viewForAstroComByHand`, and Save in Astro-Seek… opens the Add person form filled in by its address (the `declined` path).
  - Read a different chart's buttons link to the web pages.
  - `screenshot.html` gets a `<meta>` CSP that allows `'wasm-unsafe-eval'` and `worker-src 'self'`.
- **Status, 2026-11-08:** Built, test first, and `npm test` passes. Not yet checked in a browser: the acceptance below is still to run. Where it differs from the scope above:
  - The run-time test is `isExtensionCopy` in `extension-copy.js`. The import models take `onTheWeb`, which is off by default, so every existing caller still gets the extension's screens.
  - On the web, Save in Astro-Seek… leads to a screen of its own (`viewForAstroSeekSave`'s `by-hand`). It works like `declined`, but says this page can't choose the town, since there's no access to give.
  - The web copy has no Send to Stellarium Desktop. Whether a page on `https:` can reach `http://127.0.0.1` differs between browsers, and it wasn't tested.
  - All three pages get a CSP, a viewport tag and `no-referrer`, as `chart.html` has. The same files are the extension's pages, which send to Stellarium Desktop, so each policy allows `http://127.0.0.1:8090`.
  - Not done: links to the web pages. Read a different chart is the popup's, and opens the extension's own copies. On the web, nothing links to the three pages yet, and `chart.html` still says to open an AAF or Morinus file in the extension.
- **Dependencies:** None. GitHub Pages already deploys from `main`.
- **Complexity:** M. The pages exist. The work is the capability branch and the site list.
- **Tests first:**
  - `test/site.test.js` extended: each new page's imports are in `SITE_FILES`, and nothing else is.
  - A unit test for the copy test, for `moz-extension:`, `chrome-extension:`, `safari-web-extension:`, `https:` and `http://127.0.0.1`.
  - Model tests that the web path's buttons carry no `fills`, `holds` or `saves`.
  - Unchanged extension tests.
- **Acceptance:**
  - On desktop Firefox, a local copy built by `tools/site.mjs` and served with `python3 -m http.server` reads a pasted Astro-Seek chart, an AAF file, a Morinus file and an Astro-Seek screenshot.
  - Each opens Stellarium Web and Astro-Seek, and shows astro.com's values to type in.
  - The extension behaves as before in every browser.
- **iPad needed:** Yes, before calling it supported: the Photos and Files pickers, OCR memory, and the Blob downloads.

## Phase 2: the userscript build and reading chart pages

- **Scope:**
  - `tools/userscript.mjs` (architecture §7).
  - Metadata for the five hosts.
  - The injected button and panel.
  - Reading Astro-Seek and astro.com chart pages with the existing `extract` functions and `analyzePage`.
  - The popup's screens in the panel.
  - Destinations needing no handoff yet: Open Stellarium Web, Open chart in Astro-Seek, astro.com's values to type in, Share… through the receiving page, Save as AAF file.
  - Publishing `astrochart-bridge.user.js` from the Pages workflow.
  - An install guide, `docs/safari-userscript.md`.
- **Dependencies:** Phase 0's answers on script injection and opening tabs. Phase 1, for Read a different chart.
- **Complexity:** M.
- **Tests first:**
  - The bundler's unit tests: each import and export form the repository uses, plus a failing test for one it doesn't handle.
  - A built-bundle test: `node:vm` loads `astrochart-bridge.user.js` with a stand-in `GM` and `document`, and the fixtures in `fixtures/astroseek/` give the same `analyzePage` results through the bundle as through the modules.
  - A contract test: the bundle's `gmArea` passes the `fakeStorage` behaviour the existing tests rely on, such as `get(null)`, `get(key)`, `remove([…])` and structured values.
  - A metadata test: only the listed `@match` and `@grant` lines, no `@require`.
- **Acceptance:**
  - On the iPad, tests 1, 2, 7 and 11 of `docs/manual-test.md`, adapted to the panel, show the same rows and notes as the popup does on a Mac.
  - Open Stellarium Web lands on the same sky.
  - On a non-chart page, nothing is inserted.
- **iPad needed:** Yes.

## Phase 3: filling in astro.com's form

- **Scope:**
  - The token handoff (architecture §4) for **Enter in astro.com…**: hold under a token, open `ade.cgi#acb=<token>`, and fill on arrival with `readFormPage`, `fillForm`, `watchFilledZone` and `chooseFilledTown` through `hereScripting`.
  - The signed-out and typed-form choices, from `viewForAstroComTab`.
  - The "no token, ask first" path after a sign-in.
- **Dependencies:** Phase 2. Phase 0's answer on whether GM storage crosses sites; if it doesn't, the fragment fallback.
- **Complexity:** M.
- **Tests first:**
  - The destination runner with a stand-in `document` holding astro.com's form, reusing the form fixtures in `test/astro-com-form.test.js`.
  - Adversarial cases:
    - a stale token after 30 minutes;
    - a token for `astro-seek-tab:`;
    - a token that has been released, after a reload;
    - two tokens at once, each filling only its own tab;
    - a malformed entry;
    - a clock moved back;
    - a typed form;
    - a signed-out form;
    - a page with no token and two entries, which must ask and not fill.
  - The fragment is removed from the address before the page's load event.
- **Acceptance:**
  - On the iPad, test 18's astro.com items pass, signed in and signed out, including choosing the town and the zone check's Universal Time button.
  - Nothing is ever submitted.
- **iPad needed:** Yes.

## Phase 4: Save in Astro-Seek…

- **Scope:**
  - Take `fillSavePage(scripting, tabId, values)` out of `openAndSave`.
  - The same token handoff to `www.astro-seek.com/my-profile-astro-database`.
  - Optionally the `astroSeekTabs` keeps for Open chart in Astro-Seek, if a fragment survives on Astro-Seek's chart pages. Its addresses already use `#tabs_redraw`, so this needs checking first.
- **Dependencies:** Phase 3.
- **Complexity:** M.
- **Tests first:**
  - `test/astro-seek-save.test.js` and `test/astro-seek-open.test.js` pass unchanged after the refactor; that's the regression gate.
  - New: `fillSavePage` through `hereScripting` gives the same outcomes as through the tab stand-ins.
- **Acceptance:**
  - On the iPad, Save in Astro-Seek… chooses the town and the gender as on a Mac.
  - Signed out, it says so.
- **iPad needed:** Yes.

## Phase 5: reading Stellarium Web

- **Scope:**
  - The inline-script bridge for `readEngine` (architecture §4.4), with the result re-checked in the content world.
  - `viewForSky` in the panel, with its astro.com and Astro-Seek destinations from phases 3 and 4.
- **Dependencies:** Phase 0's answer on the bridge. Phases 3 and 4 for the form destinations; Open in Astro-Seek works without them.
- **Complexity:** S to M.
- **Tests first:**
  - The bridge's message parser refuses non-numbers, out-of-range values, missing fields and extra fields, and ignores a message without its own request id.
  - `skyFromEngine` and `townFromPlace` are unchanged and already tested.
- **Acceptance:**
  - On the iPad, test 18's Stellarium items pass.
  - A Stellarium Web without the engine path, as after a frontend update, shows the existing `stellarium-unreadable` refusal.
- **iPad needed:** Yes.

## Phase 6: from the web pages to the forms

- **Scope:** With the userscript installed, the web copy's astro.com and Save in Astro-Seek… buttons hand off as the panel's do. A pasted, imported or screenshotted chart then gets the same form filling as a chart read from a page. The page asks for this with a `postMessage` string, and the userscript answers only on the receiving page's own origin.
- **Dependencies:** Phases 1, 3 and 4.
- **Complexity:** S.
- **Tests first:**
  - The message is checked with `portable.parse`-style strictness: unknown keys are refused, and the origin must be the receiving page's.
  - Without the userscript, the page keeps the by-hand path.
- **Acceptance:** On the iPad, a pasted chart fills in astro.com's form.
- **iPad needed:** Yes.

## Phase 7, deferred: Stellarium Desktop from an iPad

- **Scope:**
  - `GM.xmlHttpRequest` behind `stellarium-desktop.js`'s request function.
  - An address setting that accepts only private, link-local and `.local` addresses.
  - HTTP Basic support for the plugin's password.
  - Send and Import in the panel.
- **Dependencies:** Phase 0 shows `GM.xmlHttpRequest` reaching `http://` on the local network from the iPad. A security review of the change from "127.0.0.1 only" to "an address on the local network".
- **Complexity:** L.
- **Tests first:**
  - `test/stellarium-desktop-client.test.js` passes unchanged with the default request function.
  - New tests run the same suite through a shim over a stand-in `GM.xmlHttpRequest`.
  - The address checks refuse public addresses, `localhost` aliases that resolve elsewhere, and URLs with credentials, paths or other schemes.
- **Acceptance:** On the iPad, Send to and Import from Stellarium Desktop on a Mac on the same Wi-Fi network, with and without a password.
- **iPad needed:** Yes, with a Mac running Stellarium.

## Order, and what to do first

1. **Phase 0**, because every phase from 2 on rests on its answers, and it costs about a day.
2. **Phase 1**, in parallel with phase 0 if wanted. It needs no iPad to build, helps every browser without an extension, and makes the biggest group of features (imports and Share…) usable on an iPad on its own.
3. **Phase 2**, then **3**: reading a chart page and filling in astro.com are the core workflows.
4. **Phases 4, 5 and 6**, in any order.
5. **Phase 7** only if people ask for it.

## Manual device checklist (for phases 2 to 6)

Run in Safari on an iPad with only the userscript installed. Note the iPadOS version, the Userscripts version and the date.

1. Open test 1's Astro-Seek URL. The AstroChart Bridge button appears. Tap it: the panel shows Local time, Offset, UTC and Place as on a Mac.
2. **Open Stellarium Web**: a new tab, the same sky, with `date=2024-04-17T12%3A00%3A00Z` in the address.
3. **Open chart in Astro-Seek** from an astro.com account chart: the same moment and place.
4. **Enter in astro.com…**, signed in:
   - the form is filled in;
   - the town list is chosen from;
   - the zone note appears for a chart whose offset astro.com's zone disagrees with;
   - nothing is submitted.
5. The same, signed out:
   - the panel offers to sign in first;
   - after signing in and coming back to the form, it asks before filling;
   - after 30 minutes it no longer offers.
6. Two charts sent to astro.com one after the other, in two tabs: each tab has its own chart.
7. Reload a filled astro.com tab: nothing is filled in again.
8. **Save in Astro-Seek…**, signed in: the Birth city is chosen, and the Gender too for an AAF chart that gives one.
9. Stellarium Web: set a time and place, then tap the button. The sky's UTC and place, then Open in Astro-Seek.
10. The web copy's paste page:
    - paste Astro-Seek's copied header;
    - tap **From clipboard** and accept Safari's Paste prompt;
    - then decline it, and see the refusal note.
11. The web copy's import page: an `.aaf` from Files, and a `.hor` from Files.
12. The web copy's screenshot page:
    - a screenshot from Photos;
    - a screenshot from Files;
    - a pasted image.
    - Watch for the page reloading, which is what an out-of-memory tab does.
13. Save as AAF file, and the `.astrochart.json` download: each file appears in Files → Downloads.
14. Set Safari's language to Español, then Slovenščina (Settings → Apps → Safari → Language, if the iPad offers it). Check the panel and the web pages. Then check the in-page language choice with the iPad in English.
15. Background tabs: tap **Enter in astro.com…**, switch to another app for a minute, then come back. The form is filled in once its tab is shown.
16. On a page AstroChart Bridge doesn't read, nothing is added.
