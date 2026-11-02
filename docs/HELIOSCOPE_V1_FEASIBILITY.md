# Helioscope V1 feasibility: planetary visibility

This spike, on 1 November 2026, asked whether AstroChart Bridge can predict naked-eye planetary visibility in the browser, using Swiss Ephemeris compiled to WebAssembly by [swisseph-wasm](https://github.com/kuntayerkus/swisseph-wasm) (`@kuntay/swisseph`). Nothing in `extension/` changed.

Findings are marked by how they were established. **Verified** means observed: decoded from the published binary, seen on a live site, or measured by running Swiss Ephemeris. **Read** means read in source or documentation, not run.

## 1. Executive conclusion

**Decision, 1 November 2026:** route A (§4). AstroChart Bridge is licensed under AGPL-3.0-or-later, and gate 1 passes once that licence is on `main`. The rest of this document records the spike as it stood before the decision, except for gate 4, which ran after it (§8).

- **The function exists and can be reached.** `swe_vis_limit_mag()` is compiled into the published `@kuntay/swisseph` 0.2.2 binary and exported (Verified). The package doesn't wrap it, but its documented `raw` escape hatch hands over the Emscripten module, so a small local wrapper can call it. No rebuild is needed.
- **Licensing stops it here.** AstroChart Bridge has no licence. `@kuntay/swisseph` is AGPL-3.0-or-later, and Swiss Ephemeris is AGPL or a paid Professional License. Shipping the library in the extension, or on the receiving page, means distributing AstroChart Bridge under the AGPL. That is the owner's decision, so the spike stopped before adding the dependency (gate 1).
- **Swiss Ephemeris has edges a wrapper must handle** (Verified natively, and in the WebAssembly at gate 4, §8). It returns stale results when only the atmosphere changes between calls. It reports impossible input as success with NaN results, or as "below horizon". It falls back from Swiss Ephemeris files to the Moshier ephemeris without telling the caller. Its limiting magnitude jumps about 1.1 magnitudes where photopic vision switches to scotopic.
- **Helioscope V1 wasn't ready for implementation until a licensing route was chosen** (§4). With route A chosen, the next step is the prototype in §10. The route from there is short: the published binary, a wrapper of about 40 lines, the Moshier ephemeris (no data files), and the existing Stellarium links with two small additions each (§7).

| Gate | Result | Basis |
|---|---|---|
| 1. Licensing | **Decided: route A**, AGPL-3.0-or-later. Before that, a material concern that needed the owner's decision | §4 |
| 2. Browser compatibility | Not run, because gate 1 stopped incorporation. Nothing found that blocks it | §5 (Read, plus binary decoding) |
| 3. Visibility function | Passed | §3 (Verified in the binary and the glue) |
| 4. Numerical validation | **Passed in Node**, after the decision. In 3,757 calls, the published WebAssembly matches native Swiss Ephemeris built from the same C sources | §8 (Verified) |
| 5. Integration | Passed at design level | §6, §7 |

## 2. Repository findings

- **Manifest V3** with `activeTab`, `scripting` and `storage`, and optional host permissions for `http://127.0.0.1/*` and `https://www.astro.com/*` (`extension/manifest.json:20-21`). There's no background script or service worker: everything runs in extension pages, which are the popup and the screenshot, paste, import and receiving pages.
- **Content security policy** for extension pages: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` (`extension/manifest.json:22-24`), there for Tesseract.
- **WebAssembly already ships.** Tesseract.js-core 5.1.1 is vendored unchanged in `extension/vendor/tesseract/` with its licences and a README, and `extension/screenshot.js` starts it in a worker from its file. A Swiss Ephemeris build would follow the same pattern.
- **No build step and no npm dependencies.** `extension/` is loaded as is, as ES modules. The tests are `node --test`, and CI runs them on Node 24. The same workflow is set up to publish the receiving page, `chart.html` and the files it loads, to GitHub Pages (`.github/workflows/pages.yml`), but Pages isn't turned on for the repository yet.
- **Browsers:** Chrome, Brave, Edge, Firefox 128 or later, Safari 26 or later on macOS, and Safari on iPad inside an Xcode-built app (`README.md`; the minimums are pinned by `test/manifest.test.js:48-53`).
- **The normalized chart** is `{ kind: "natal", site, local, zoneLabel, lat, lng, utc, utcSource, offsetMinutes }`. `utc` is `YYYY-MM-DDTHH:MM:SSZ`, or `null` while the UTC isn't decided (`extension/core/index.js:101-117` and `:123-174`; `extension/core/civiltime.js:6-43`). It has **no elevation**. Charts dated before 15 October 1582 are refused before any of this runs.
- **Reusable pieces:** `julianDay()` and `utcFromJulianDay()` (`extension/core/stellarium-desktop.js:31-54`), `stellariumUrl()` (`extension/core/stellarium.js:8-25`), and the Stellarium Desktop request plan and check (`extension/core/stellarium-desktop.js:90-134`).
- **Licence**, before the decision in §4: there's no `LICENSE` file and no `license` field in `package.json`, and GitHub reports no licence for the public repository. All 90 commits carry one author name, in two spellings.

## 3. WebAssembly export investigation

This covers the repository `kuntayerkus/swisseph-wasm` at commit `0490fcf` (6 August 2026) and the published package `@kuntay/swisseph` 0.2.2.

| Question | Finding |
|---|---|
| Swiss Ephemeris version | 2.10.03 (`vendor/swisseph/sweph.h:65`). **Verified:** ignoring line endings, the nine C files the build compiles, and all the headers, are identical to upstream's tag `v2.10.3final` (14 April 2026), a 2.10.03 maintenance release. Only `swetest.c`, a command-line program that isn't compiled in, differs. The later tag `v2.10.3bfinal` (1 August 2026) adds only a Windows-only define in `sweodef.h`, besides changes to `swetest.c`. |
| npm version | 0.2.2, published 31 July 2026, is the latest. **Verified:** the tarball's SHA-512 matches the registry's integrity value, and the registry holds an SLSA provenance attestation naming commit `4c4b0f4`. The repository's `packages/core/package.json` already says 0.3.0, which isn't published. |
| Does the build export `swe_vis_limit_mag()`? | **Read:** `tools/build-wasm.mjs:54-62` collects every `ext_def(...) swe_*` declaration in `swephexp.h`, 106 in all, and passes them as `EXPORTED_FUNCTIONS` (`:105`, `:135`). `swe_vis_limit_mag` is declared at `swephexp.h:678`. |
| Is it in the compiled binary? | **Verified:** `wasm/swisseph.wasm` (562,903 bytes) exports 112 functions under minified names. Its type section gives export `ib` the signature `(f64, i32, i32, i32, i32, i32, i32, i32) → i32`. On wasm32 that is `int32 swe_vis_limit_mag(double, double*, double*, double*, char*, int32, double*, char*)`. |
| Can the JavaScript glue reach it? | **Verified:** `wasm/swisseph.mjs` assigns `Module["_swe_vis_limit_mag"] = wasmExports["ib"]`. All 106 functions are mapped, along with `ccall`, `cwrap`, `getValue`, `setValue`, `stringToUTF8`, `UTF8ToString`, `_malloc` and `_free`. |
| Is there an undocumented wrapper? | No. The TypeScript layer wraps 22 functions, and this isn't one of them (`packages/core/src/instance.ts:340-381`, and `dist/instance.js` in 0.2.2). The documented escape hatch `get raw()` returns the Emscripten module (`instance.ts:515-518`). |
| What would expose it | No upstream change is needed. Call `swe.raw.cwrap("swe_vis_limit_mag", "number", [...])` with buffers the wrapper owns: 3, 4 and 6 doubles in, at least 8 doubles out, and 256-byte name and error strings. Upstream, the equivalent would be a method beside `heliacal()` (`instance.ts:1485-1526`). |
| Is a rebuild needed? | No. |
| Is `swe_heliacal_pheno_ut()` exported? | **Verified:** yes, as export `lb`, `(f64, i32 × 8) → i32`. `swe_heliacal_ut` is `mb`, wrapped as `heliacal()`. |
| Are there visibility tests? | None for `swe_vis_limit_mag`. `heliacal()` has three integration tests, which check only bounds and ordering (`packages/core/test/events.integration.test.ts:483-531`); two of them need star data. The native reference corpus (`tools/golden/gen-golden.c`) covers dates, positions, ayanamsa, ΔT and house names, and no visibility function. |

Classification: **supported internally, not publicly exposed.** It needs a wrapper, not a rebuild. The smallest viable change is a local wrapper over `raw` that validates its own input (§6).

## 4. Licensing assessment

What each licence says:

- **AstroChart Bridge** has no licence (§2), and its source is public on GitHub. Builds can reach people three ways: as an unpacked extension, as an Xcode-built Safari app, and, once Pages is turned on, as the receiving page on GitHub Pages. TestFlight and the App Store are documented as options nobody has tried (`docs/safari-ipad.md:59-64`).
- **Swiss Ephemeris** is dual-licensed under the AGPL or the Swiss Ephemeris Professional License (`vendor/swisseph/LICENSE`, identical to upstream's). Astrodienst's text says a developer who chooses the AGPL must place the whole software project under the AGPL or a compatible licence.
- **swisseph-wasm** chose the AGPL for all of it, wrapper and build tools included: `AGPL-3.0-or-later` (`LICENSE`, `NOTICE`, `package.json`). Its `NOTICE` makes two points. Distributing software that uses the package means offering that software's complete source under the AGPL or a compatible licence. And a Professional License is between the user and Astrodienst, and the project can't pass it on.
- **The Professional License** is in upstream's `doc/secont_e_2609.pdf`, edition September 2026, changed in upstream commit `3186eed` ("important license update"). It costs CHF 700 and covers unlimited projects of the licensee. It's valid for six years, then has to be renewed or the use stopped. The app's copyright must be the licensee's, and third parties using the licensee's API services need licences of their own. It covers Astrodienst's code only, not swisseph-wasm's AGPL wrapper.
- **Already vendored:** Tesseract.js (Apache-2.0) and lean-qr (MIT). Both are permissive licences, generally considered compatible with inclusion in an AGPL-3.0 work.
- **Stellarium Web and Desktop** are separate programs, reached by a link or over HTTP. Nothing of theirs is distributed with the extension.

The assessment below is an engineering reading of these licences, not legal advice.

- Loading swisseph-wasm's JavaScript and WebAssembly into an extension page and calling them makes them part of one program with AstroChart Bridge's code. Both licensors' notices expect the whole to be distributed under the AGPL. Shipping Helioscope on this library therefore means licensing at least every distributed build that contains it under AGPL-3.0-or-later, with its source. AstroChart Bridge has no licence today, so that's a licence change, which needs the owner's explicit authorization. **This is the material concern that stops the spike at gate 1.**
- **App Store:** in 2010 the Free Software Foundation took the position that the App Store's usage rules conflict with GPL-family licences. Apple then removed GNU Go ([The Register, 2010](https://www.theregister.com/2010/05/27/gnu_go_fsf_apple_itunes/)) and VLC ([Engadget, 2011](https://www.engadget.com/2011-01-09-the-gpl-the-app-store-and-you.html)). The terms have changed since, and the question is disputed. AstroChart Bridge's author can't grant an exception for code whose copyright belongs to Astrodienst or to swisseph-wasm's author. So TestFlight and App Store builds stay a risk whatever licence the project chooses.
- **Receiving page:** if Helioscope joined `chart.html`'s module graph, GitHub Pages would distribute the WebAssembly to every visitor. `test/site.test.js` already pins which files the site publishes. Keep Helioscope out of that list unless the licence decision covers the page.

The owner chooses between four routes. None was started.

| Route | What it takes | Trade-off |
|---|---|---|
| A. License AstroChart Bridge under AGPL-3.0-or-later | A `LICENSE` file and notices. The source is already public | The shortest technical route: the published package, as it is. App Store builds stay a risk, and every later distribution is AGPL |
| B. Swiss Ephemeris Professional License | CHF 700 for six years, an Emscripten build of Astrodienst's sources, and a wrapper of the project's own. swisseph-wasm's is AGPL unless its author licenses it otherwise | The project keeps its own licence, for more build and maintenance work |
| C. A permissive engine | [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 (MIT) has positions, magnitudes, elongation, rise and set, and altitude searches. **Read** in its type declarations: it has no sky-brightness or limiting-magnitude model. That model would have to be written independently from Schaefer's published papers, not from `swehel.c` | No copyleft. The most work, with its own validation burden. Not started, as the brief asks |
| D. A separate AGPL page | Helioscope as its own web page, which the extension opens with a link the way it opens Stellarium Web | Keeps the extension's licence open, but Helioscope wouldn't be a module inside AstroChart Bridge as the brief asks |

**Decision, 1 November 2026: route A.** AstroChart Bridge is licensed under AGPL-3.0-or-later: `LICENSE` holds the FSF's text, `package.json` names it, and the README has a Licence section. Two points carry over to Helioscope. TestFlight and App Store builds that include Swiss Ephemeris stay a risk. And when Helioscope ships, its page should show the notices the AGPL asks of interactive interfaces (section 5(d) of the licence).

## 5. Browser compatibility assessment

This wasn't run: no prototype was built, because gate 1 stopped incorporation (§4). Reading the package and decoding its binary shows the following. The speed and isolation rows also give what gate 4 measured in Node, after the decision.

| Concern | Finding |
|---|---|
| WebAssembly under Manifest V3 | Compiling WebAssembly needs `'wasm-unsafe-eval'`, which extension pages already have for Tesseract. No security setting would change |
| Remote code | The glue loads the binary from `new URL("swisseph.wasm", import.meta.url)`, a file packaged next to it. Nothing comes from a CDN |
| `eval`, `new Function` | None in the glue |
| Threads, `SharedArrayBuffer` | None, so no cross-origin isolation is needed |
| Loading without a bundler | `dist/` imports only relative paths. Node's `fs` and `path` are imported dynamically inside the function that reads files from disk (`dist/ephemeris/sources.js:93-94`), so a browser never loads them |
| Initialization | `fetch` and `WebAssembly.instantiateStreaming`. If streaming fails, for example on a wrong MIME type, the glue logs to the console and instantiates from an `ArrayBuffer` instead. Which path each browser takes is unknown; if those messages appear, they would fail manual test 13's empty-console check |
| Ephemeris data | None needed with the Moshier ephemeris, which is compiled in and covers 3000 BCE to 3000 CE. Swiss Ephemeris files would have to be copied into the module's in-memory file system |
| Memory | **Verified** from the binary: 16.3 MiB of linear memory at start, growing to at most 2 GiB, not shared |
| Size | In 0.2.2, `swisseph.wasm` is 562,903 bytes and `swisseph.mjs` 76,449 bytes. The vendored Tesseract files come to about 7 MB |
| Service worker | There isn't one, and none is needed. Helioscope should run in an extension page in a tab, like the screenshot page, because the popup closes when it loses focus |
| Speed | **Verified natively:** under 0.03 ms a call. The search in §6 makes about 600 calls a chart. **Verified in Node 24** at gate 4: the WebAssembly takes about 23 µs a call, and about 1.3 ms to create an instance |
| Isolation | **Read:** each `createSwissEph()` call makes a new WebAssembly instance (`tools/build-wasm.mjs:114-118`). **Verified in Node** at gate 4: a new instance starts with empty caches (§8) |

Manual test 13 checks that each supported browser runs Tesseract's WebAssembly under this policy. This spike didn't run it.

## 6. Visibility calculation design

### What Swiss Ephemeris provides

From the programmer's documentation (upstream `doc/swephprg.pdf`, sections 8.17 to 8.19) and from `swehel.c`:

- `swe_vis_limit_mag(tjd_ut, dgeo, datm, dobs, name, helflag, dret, serr)` gives the faintest magnitude visible at the object's position at one instant. It accounts for where the Sun and Moon are, the atmosphere and the observer, using Schaefer's contrast-threshold model as implemented by Reijs and Koch. It returns −1 for an error and −2 when the object is below the horizon. Otherwise it returns 0 for photopic vision, or bit 0 set for scotopic vision.
  - `dret[0]` is the limiting magnitude and `dret[7]` the object's magnitude.
  - `dret[1]` and `dret[2]` are the object's altitude and azimuth, `[3]` and `[4]` the Sun's, and `[5]` and `[6]` the Moon's.
  - The object is predicted visible when `dret[0] > dret[7]`. The **margin** is `dret[0] − dret[7]`, in magnitudes.
- `swe_heliacal_ut()` searches for the dates of heliacal events with the same model. It's documented for latitudes 60° S to 60° N only. Its dates aren't instantaneous predictions, and V1 doesn't use them.
- `swe_heliacal_pheno_ut()` returns details such as the arcus visionis. The documentation says it's mostly for testing.

The documentation and the behaviour differ in four places (**Verified**, §8):

1. The documentation describes the limiting magnitude "in dark skies". In fact the real Sun and Moon count unless `SE_HELFLAG_VISLIM_DARK` or `SE_HELFLAG_VISLIM_NOMOON` is set. For the same Venus, the result is 3.01 by default and 6.43 with `VISLIM_DARK`.
2. The documented "near limit photopic/scotopic" return bit (2) is never set. With `BNIGHT_FACTOR` at 1.0, its condition can't be true (`swehel.c:78-79` and `:1421-1424`).
3. A comment in `swehel.c`, and swisseph-wasm's `Atmosphere` type, say `datm[3] = −1` derives extinction from the other values. It actually removes aerosol extinction. As the programmer's documentation says, `0` is the derived case.
4. The documentation declares the function as returning `double`. The header and the binary return `int32`.

### Four results, kept apart

| Result | Computed from | Notes |
|---|---|---|
| Traditional solar condition | The difference in geocentric apparent ecliptic longitude, Δλ = λ(planet) − λ(Sun), in (−180°, 180°] | Cazimi, combust, under the beams, or clear of them. The limits differ between traditions; 17′, 8°30′, and 15° or 17° are the values most often cited. Which to use is a domain decision, recorded with each result |
| True solar elongation | The angle between the planet and the Sun (`swe_pheno_ut`, `attr[2]`) | Differs from Δλ by the planet's ecliptic latitude. At Venus's 2025 inferior conjunction, Δλ was 0.08° and the elongation 8.4° |
| Apparition | The side of the Sun: east is the evening sky, west the morning sky | Needs explicit rules near conjunction and opposition: Jupiter at opposition came out "west", at Δλ −179.86°. It also needs one for an inferior conjunction at a large latitude, when a planet can be in both skies (§8) |
| Predicted visibility | `swe_vis_limit_mag` across the observation windows | Never taken from the natal instant: a planet below the horizon at birth says nothing about glare |

### Observation windows

For the chart's UTC and place:

1. The **evening window** runs from the sunset nearest the chart's instant to the end of astronomical twilight, when the Sun's centre reaches −18°. The **morning window** runs from the start of astronomical twilight to the sunrise nearest the chart's instant. Both come from `swe_rise_trans`, which the binary exports.
2. Each window is sampled every 2 minutes with `swe_vis_limit_mag`.
3. The **best opportunity** is the sample with the largest margin while the planet is above the horizon.
4. The result reports each window's bounds, the best sample with its raw values, and how many samples were above the horizon.

The windows come from the Sun at the observer's coordinates, so time zones, local date boundaries and daylight saving don't decide them. The chart's offset is used only to show local times.

**Verified gap:** at Tromsø (69.65° N), the Sun doesn't set on 7 December 2024 (polar night) or on 21 June 2025 (midnight sun), so neither window exists. V1 needs a rule for that, such as "indeterminate: no twilight window", or windows defined by the Sun's altitude alone. That's a decision for the owner.

### Classification

| Result | Rule |
|---|---|
| Predicted detectable | Best margin above 0 |
| Predicted undetectable | Samples above the horizon, with a best margin of 0 or less |
| Below horizon at the evaluated instants | Every sample in both windows returned −2 |
| Calculation unavailable or indeterminate | No window, invalid input, an engine error, or a result that isn't finite |
| Marginal | **Not defined yet** |

There's no threshold for "marginal", because the evidence says any single number would be arbitrary. For Venus from New York at one instant (§8), the limiting magnitude moved by:

- 2.4 magnitudes between meteorological ranges of 40 km and 10 km
- 0.8 between 40 % and 90 % humidity
- 0.5 between observers aged 36 and 70

It also jumps 1.1 magnitudes within a second at the photopic-to-scotopic switch.

That leaves two options for the owner. One is to show the raw margin with its assumptions and have no "marginal" class. The other is to call a result marginal when it is visible under one documented atmosphere and not under another, citing each scenario's values and running each in a fresh instance (§8, item 5).

### Assumptions reported with every result

- Swiss Ephemeris 2.10.03, and the Moshier ephemeris, always requested explicitly (`SEFLG_MOSEPH`).
- The `helflag` bits.
- The atmosphere and observer **as Swiss Ephemeris completed them**, since it fills in defaults in place (§8, item 2).
- The observer's elevation: 0 m unless the user gives one, since charts don't carry it.
- Whether the Moon was included.
- The window rule and the sampling step.

The defaults should be Helioscope's own, and explicit. swisseph-wasm's `heliacal()` defaults (15 °C and a 40 km meteorological range, `packages/core/src/derived/heliacal.ts:80-87`) differ from the C library's. At the Venus instant in §8, the 40 km range alone gives 2.55 instead of 3.01.

### Shape of the code (proposed, not written)

- `extension/core/helioscope.js` would hold the windows, sampling, classification and traditional condition, with no browser APIs and nothing about any site. It would take the engine as an argument, the way `core/stellarium-desktop.js` plans the requests that `extension/stellarium-desktop.js` sends.
- `extension/helioscope-engine.js` would be the only file that loads the WebAssembly. It would wrap `swe_vis_limit_mag` and `swe_rise_trans`, validate input, and refuse results that aren't finite.
- `extension/vendor/swisseph/` would hold the package's `dist/` and `wasm/` unchanged, with its `LICENSE`, `NOTICE` and a README, as Tesseract's folder does.
- The input is the normalized chart. Only `kind: "natal"` charts with a decided `utc` are taken, converted with `julianDay()`.
- The output, for each planet, holds:
  - the four results above
  - the windows, with their best samples
  - the classification and the assumptions
  - the raw values: `ret`, `dret`, `serr`, and the completed `datm` and `dobs`

## 7. Stellarium integration findings

### Stellarium Web

| Needed | AstroChart Bridge today (`extension/core/stellarium.js:18-25`) | Stellarium Web |
|---|---|---|
| Any date and time | Yes: `stellariumUrl()` takes any decided UTC | `date` |
| Latitude and longitude | Yes | `lat`, `lng` |
| Observer elevation | No | `elev` |
| Selecting a planet | No | The path `/skysource/<name>`, which selects the object and locks the view on it |
| Field of view and direction | No: Stellarium keeps its default view | `fov`, `az`, `alt` |

**Verified** on stellarium-web.org on 1 November 2026 with `https://stellarium-web.org/skysource/Venus?date=2025-01-10T23:14:31Z&lat=40.7128&lng=-74.006&elev=10&fov=60`. The engine started at that instant, then its clock ran on in real time. It showed that place at an elevation of 10 m, with a 60° field and Venus selected and locked.

**Read** in the frontend source (`apps/web-frontend/src/App.vue`): the name is looked up through the NoctuaSky API, and the clock always starts running.

Smallest change: let `stellariumUrl()` take an optional elevation and object name, which add `elev` and the `skysource/` path. A calculated observation time is just another UTC, in whole seconds with a `Z` as now.

### Stellarium Desktop

`extension/core/stellarium-desktop.js` can already set any time (as a Julian Day in UT, with the clock paused) and any latitude and longitude, then check them against Stellarium's status. **Read** in the Remote Control plugin's source (Stellarium master, 1 November 2026; not run against a Stellarium):

- **Elevation** isn't sent. `POST /api/location/setlocationfields` takes `altitude` in **whole metres**. A value like `10.5` fails its integer parse and is ignored without an error (`plugins/RemoteControl/src/LocationService.cpp`). The status reports `location.altitude`, so `checkApplied()` could check it.
- **Focus** isn't sent. `POST /api/main/focus?target=Venus` selects and centres an object, with `mode=zoom` and `mode=mark` as alternatives. It answers `true` or `false`, not `ok` (`MainService.cpp`). `sendSky()` treats any answer but `ok` as a rejection (`extension/stellarium-desktop.js:60-65`), so a focus request needs its own check.

So "View in Stellarium" needs no new transport, just two optional fields for Stellarium Web and two for Stellarium Desktop.

## 8. Testing and validation results

### What ran

- **AstroChart Bridge's tests:** on Node 24.14.1, 721 of 721 passed at the start of the spike and 749 of 749 at the end. In between, other work moved the checkout to a branch with more tests. This spike changed only this file.
- **Binary and glue:** the export table and type section of the 0.2.2 binary were decoded without running it, and the glue's mapping was read (§3).
- **Native reference:** Swiss Ephemeris was built from the library sources of upstream's `v2.10.3final` tag, the same sources swisseph-wasm compiles (§3). It was compiled with Apple clang 17 at `-O2` on arm64 macOS and driven by a small C harness, which isn't committed. Unless a row says otherwise, each run used:
  - the Moshier ephemeris (`helflag` 4)
  - the C library's default atmosphere and observer (all inputs 0): pressure and temperature from the elevation, 40 % humidity, aerosol from humidity, age 36, Snellen ratio 1, naked eye
  - the Moon included
- **The WebAssembly, in Node**, after the licence decision: the published 0.2.2 package against that native reference, for gate 4 (below).

What didn't run: the WebAssembly in a browser extension page (gate 2, §1), and any Helioscope code, since none exists.

### `swe_vis_limit_mag` behaviour, verified natively

These are for Venus from New York (40.7128° N, 74.006° W, 10 m) at 2025-01-10 22:35 UTC unless noted.

| # | Behaviour | Observed |
|---|---|---|
| 1 | Output | `ret` 0 (photopic). Limiting magnitude 3.0116 and Venus −4.5282, for a margin of 7.54, at an altitude of 30.45° with the Sun at −8.86°. Exactly 8 doubles are written |
| 2 | Inputs are rewritten | `datm` 0, 0, 0, 0 comes back as 1012.05 hPa, 14.935 °C, 40 %, 0. `dobs` comes back as 36, 1, 1, 1, 0, 0, and `"Venus"` as `"venus"` |
| 3 | The observer moves for later calls | A topocentric Moon position was set up for Sydney. After a call for New York, it came back as New York's |
| 4 | Below the horizon | −2, with `dret[0]` −100 and "object is below local horizon". It's decided on the **unrefracted** altitude: at −0.016° true and +0.458° apparent, it returned −2. `dret[1]` is the unrefracted altitude |
| 5 | **Stale extinction** | See below this table |
| 6 | `datm[3] = −1` | 3.2261, the same as a 1,000,000 km range, that is, no aerosol. `0` (derived) gives 3.0105. No warning reaches `serr` |
| 7 | Vision modes | Jupiter with the Moon excluded: with the Sun at −11.53° the result switches from photopic to scotopic. The limit jumps from 3.6597 to 4.7465 between two samples a second apart. Bit 2 wasn't set in any of the 3,041 successful returns among 3,600 samples |
| 8 | **Silent ephemeris fallback** | With Swiss Ephemeris files requested and none present, it returns 0 with an empty `serr`, and its results are identical to Moshier's. `swe_calc_ut` in the same state does report the fallback ("using Moshier eph."). With the files present, the limit differs from Moshier's by 2×10⁻⁶ magnitudes |
| 9 | Invalid observer | Latitude 95 returns −2, "below horizon". Latitude −91 returns 0 with plausible-looking numbers. Latitude NaN returns 1 with NaN results. An elevation of 1,000,000 m returns 1 with a NaN limit. 30,000 m and −2,000 m are accepted; **Read:** `swe_heliacal_ut` refuses anything outside −500 m to 25,000 m. Longitudes 400 and −320 give results identical to 40 |
| 10 | Dates | Outside Julian Days 625000.5 to 2818000.5, the Moshier range, it returns −1 with a message naming that range. 1000 BCE and 2800 CE work |
| 11 | The Sun, unknown names | The Sun returns −1 with a message. An unknown name is taken for a fixed star, and returns −1 when the star file is missing |
| 12 | Determinism | Results are bit-identical across processes |
| 13 | Speed | 2,000 calls took 58 ms, including starting the process |

Item 5, the stale extinction, is the one most likely to produce wrong results without anyone noticing. Two calls at the same instant and place differed only in the atmosphere:

- **Meteorological range:** a call with a 40 km range, then one with 10 km in the same process, returned 2.5534 for the second, the 40 km value. A fresh process gives 0.1214 for 10 km.
- **Humidity:** a call at 40 %, then one at 90 %, returned 2.9503 for the second. A fresh process gives 2.1979.
- **What clears it:** a call at a different instant does; `swe_close()` doesn't. The observer's age isn't cached.

The results are memoised on the Sun's and the object's altitudes and the Sun's right ascension only (`swehel.c:818`, `:888`, `:1040`). Neither call reports an error or a warning.

### Reference cases

These were computed natively with the defaults above, the windows of §6 and 2-minute samples. Margins are in magnitudes, and times are UTC. The chart instants for conjunctions and the opposition are not exact event times: a scan picked the quarter-day nearest the smallest |Δλ|, or nearest 180°.

| Case | Chart instant, place | Δλ | Elongation | Evening window | Morning window |
|---|---|---|---|---|---|
| Mercury, superior conjunction | 2024-06-14 18:00, New York | +0.08° | 0.96° | −14.83 at sunset, altitude 0.1° | −14.95 at sunrise |
| Venus, evening | 2025-01-10 22:35, New York | +47.16° | 47.17° | **+9.02** at 23:14 (Sun −16.0°, scotopic) | Below horizon throughout |
| Venus, inferior conjunction | 2025-03-23 00:00, New York | +0.08° | 8.42° (latitude +8.41°) | −6.38 at sunset | −1.08 at 10:34 (Sun −4.7°) |
| Mars, conjunction | 2023-11-18 06:00, New York | −0.00° | 0.12° | Below horizon throughout | Below horizon throughout |
| Jupiter, opposition | 2024-12-07 18:00, New York | −179.86° | 179.32° | **+7.99** at 23:07 (Sun −18.0°) | **+8.78** at 10:29 (Sun −18.0°) |
| Saturn, conjunction | 2025-03-12 12:00, New York | −0.06° | 1.92° | Below horizon throughout | Below horizon throughout |
| Venus, southern hemisphere | 2025-01-10 09:00, Sydney | +47.17° | 47.17° | **+7.25** at 10:12 (Sun −11.8°, photopic) | Below horizon throughout |
| Jupiter, polar night | 2024-12-07 18:00, Tromsø | −179.86° | 179.32° | No window | No window |
| Venus, midnight sun | 2025-06-21 00:00, Tromsø | −44.66° | 44.73° | No window | No window |

The Mercury, Mars and Saturn rows separate glare from geometry. Mercury is above the horizon at the edges of its windows and still 15 magnitudes too faint, while Mars and Saturn never rise during either window.

The Venus inferior-conjunction row is the case a rule based only on longitude gets wrong. Venus was 0.08° from the Sun in longitude but 8.4° from it on the sky. Although it was east of the Sun, its best chance came in the morning sky, about a magnitude short of detection.

Agreement between the WebAssembly and this native build would show that the port is faithful, and nothing more. Both run the same C code, so neither validates Schaefer's model against what people actually see. That would need records of observations, and is out of scope.

### Gate 4: the WebAssembly against native

**Verified** on 1 November 2026, after the licence decision. The published `@kuntay/swisseph` 0.2.2 ran in Node 24.14.1 through a local wrapper over `raw.cwrap`, about 40 lines long. The wrapper writes every input afresh for each call, because Swiss Ephemeris rewrites them in place (item 2). The same 3,757 `swe_vis_limit_mag` calls ran, in the same order, through the WebAssembly and through two native builds of the harness. One was Apple clang 17 at `-O2`, and the other added `-ffp-contract=off`, which stops the compiler fusing multiplications and additions. The calls were grouped into 22 sessions, and each session ran in a fresh process or a fresh instance:

- the reference call, and 25 calls for the edge cases above
- the stale-extinction pairs of item 5, each with a fresh run of its second call
- 20 calls a second apart across the photopic-to-scotopic switch of item 7
- every 2-minute sample in the 14 observation windows of the reference cases
- 3,000 seeded random calls from 1600 to 2400, covering the five planets and the Moon, latitudes from 60° S to 60° N, elevations up to 3,000 m, five atmospheres, three observers and four sets of flags

| Comparison | Return codes | Bit-identical calls | Largest difference |
|---|---|---|---|
| WebAssembly against native `-O2 -ffp-contract=off` | The same in all 3,757 | 2,892 | 5.9×10⁻¹³ magnitudes, 1.3×10⁻¹¹° |
| WebAssembly against native `-O2` | The same in all 3,757 | 1,512 | 8.6×10⁻⁹ magnitudes, 1.8×10⁻⁷° (the Sun's azimuth) |
| Native `-O2` against native `-O2 -ffp-contract=off` | The same in all 3,757 | 1,513 | The same as the row above |

- **The port is faithful**, which is all this comparison can show. The default native build's larger gap comes from the compiler, since the two native builds differ from each other by exactly as much.
- **Strings:** the error strings and the rewritten object names were identical in every call.
- **Behaviour:** items 2, 4, 5, 7, 8, 9 and 10, and the Sun in item 11, came out the same in the WebAssembly.
- **Repeatability and speed:** the WebAssembly's results were bit-identical from one run to the next. It took about 23 µs a call, and about 1.3 ms to create an instance.

The reference values in §8 and §10 come from the default `-O2` build. A test that compares the WebAssembly with them therefore needs a tolerance above that build's differences.

The comparison script and the native harness aren't committed.

### Test plan for V1, to be written before the code

- **Engine boundary:** the reference cases above as fixtures. The WebAssembly must match the native values within a tolerance measured at gate 4, not assumed.
- **Astronomy:** the nine cases, which include morning against evening (Venus near inferior conjunction), the southern hemisphere and a high latitude.
- **Time:**
  - UTC to Julian Day through `julianDay()`.
  - A chart whose UTC date differs from its local date: an evening in Sydney is a morning in UTC.
  - A chart near local midnight.
  - The daylight saving gap, with `fixtures/astroseek/ny-2021-03-14-gap.json`.
  - An older date, with the 1944 New York fixture.
  - Julian-calendar dates never reach Helioscope, because charts before 15 October 1582 are refused earlier. A test should keep it that way.
- **Failures:**
  - The engine failing to load.
  - Swiss Ephemeris files requested: the wrapper must always pass Moshier and check the flag (item 8).
  - A date outside the Moshier range.
  - Invalid coordinates, validated before the call (item 9).
  - A chart with no location, or with no decided UTC (`needs-offset`, `needs-choice`).
  - A result that isn't finite.
  - Two atmospheres at one instant, which must not return the cached value (item 5).

## 9. Remaining risks

- **Licensing** (§4) blocks everything else.
- **Runtime in browsers** isn't verified. Unknown: streaming instantiation and the `.wasm` MIME type in each browser, console messages, and Safari 26 on the Mac and the iPad.
- **Model validity:** in the cases tried, the margin moved by 0.5 to 2.4 magnitudes with assumptions nobody records for a birth, and it has a discontinuity of 1.1 magnitudes. A "detectable" with a small margin is weak evidence.
- **Hidden state:** the extinction memo (item 5) and the global observer (item 3). Any sweep over atmospheres needs a fresh instance for each scenario, or calls at different instants.
- **Magnitudes:** Swiss Ephemeris uses Mallama and Hilton's 2018 formulas. **Read:** Mercury's is applied at every phase angle without a range check (`swecl.c:3923-3926`), and only Venus gets a warning, beyond 179°. Near superior conjunction, the object's magnitude is extrapolated.
- **High latitudes:** the window rule needs a decision (§6), and `swe_heliacal_ut()` is documented only for 60° S to 60° N.
- **Elevation** isn't in the chart model, so V1 assumes 0 m unless the user gives one.
- **Upstream:**
  - swisseph-wasm has one maintainer.
  - Its CI builds with the unpinned `emscripten/emsdk:latest` image (`tools/build-wasm.mjs:32`), so binaries can differ by build date.
  - The repository's 0.3.0 isn't on npm.
  - Astrodienst fixed an undersized array in `heliacal_ut_arc_vis` after the vendored tag (upstream `94621ab`, 25 October 2026). **Read:** the vendored `swehel.c:2215` still declares `xaz[2]` where `swe_azalt` writes three values. It affects only arcus visionis heliacal searches, which V1 doesn't use.
- **Stellarium Web:** selecting a planet depends on the NoctuaSky API answering, and the clock can't be paused by a link.

## 10. Recommended next step

1. **Choose the licensing route** (§4). Done: route A, on 1 November 2026.
2. **Build an isolated prototype for gates 2 and 4**, outside the production extension. A scratch extension page loads the vendored package and calls `swe_vis_limit_mag` through `raw.cwrap` for Venus from New York at 2025-01-10 22:35:00 UTC, with the C defaults and Moshier. It compares the result with the native one: `ret` 0, limiting magnitude 3.01164805937693, Venus −4.528168498295062, altitude 30.449427707878943. Run it in Chrome, Firefox and Safari, and run the same comparison in Node from `test/`. Gate 4 is done: it ran in Node on 1 November 2026, from a script outside the repository (§8). The browser runs are still to do.
3. **Then the proof of concept** the brief describes: Venus, New York, the evening window of 10 January 2025, and one visibility calculation returning the structured result of §6, with the tests written first.
