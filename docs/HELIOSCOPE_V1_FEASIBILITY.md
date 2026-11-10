# Helioscope V1 feasibility: planetary visibility

This spike, on 1 November 2026, asked whether AstroChart Bridge can predict naked-eye planetary visibility in the browser, using Swiss Ephemeris compiled to WebAssembly by [swisseph-wasm](https://github.com/kuntayerkus/swisseph-wasm) (`@kuntay/swisseph`). Nothing in `extension/` changed.

Findings are marked by how they were established. **Verified** means observed: decoded from the published binary, seen on a live site, or measured by running Swiss Ephemeris. **Read** means read in source or documentation, not run.

## 1. Executive conclusion

**Decision, 1 November 2026:** route A (§4). AstroChart Bridge is licensed under AGPL-3.0-or-later, and gate 1 passes once that licence is on `main`. The rest of this document records the spike as it stood before the decision, except for gate 4 and the Chrome run of gate 2, which came after it (§8), and the proof of concept that followed them (§10).

- **The function exists and can be reached.** `swe_vis_limit_mag()` is compiled into the published `@kuntay/swisseph` 0.2.2 binary and exported (Verified). The package doesn't wrap it, but its documented `raw` escape hatch hands over the Emscripten module, so a small local wrapper can call it. No rebuild is needed.
- **Licensing stops it here.** AstroChart Bridge has no licence. `@kuntay/swisseph` is AGPL-3.0-or-later, and Swiss Ephemeris is AGPL or a paid Professional License. Shipping the library in the extension, or on the receiving page, means distributing AstroChart Bridge under the AGPL. That is the owner's decision, so the spike stopped before adding the dependency (gate 1).
- **Swiss Ephemeris has edges a wrapper must handle** (Verified natively, and in the WebAssembly at gate 4, §8). It returns stale results when only the atmosphere changes between calls. It reports impossible input as success with NaN results, or as "below horizon". It falls back from Swiss Ephemeris files to the Moshier ephemeris without telling the caller. Its limiting magnitude jumps about 1.1 magnitudes where photopic vision switches to scotopic.
- **Helioscope V1 wasn't ready for implementation until a licensing route was chosen** (§4). With route A chosen, the next step is the prototype in §10. The route from there is short: the published binary, a wrapper of about 40 lines, the Moshier ephemeris (no data files), and the existing Stellarium links with two small additions each (§7).

| Gate | Result | Basis |
|---|---|---|
| 1. Licensing | **Decided: route A**, AGPL-3.0-or-later. Before that, a material concern that needed the owner's decision | §4 |
| 2. Browser compatibility | **Passed in Chrome**, after the decision. In an extension page under AstroChart Bridge's script policy, gate 4's 3,757 calls give results bit-identical to Node's. Firefox and Safari were skipped, by the owner's decision | §8 (Verified in Chrome), §5 (Read, plus binary decoding) |
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

Before the decision this wasn't run: no prototype was built, because gate 1 stopped incorporation (§4). Reading the package and decoding its binary shows the following. Some rows also give what was measured after the decision, by gate 4 in Node and gate 2 in Chrome (§8).

| Concern | Finding |
|---|---|
| WebAssembly under Manifest V3 | Compiling WebAssembly needs `'wasm-unsafe-eval'`, which extension pages already have for Tesseract. No security setting would change. **Verified in Chrome 155** at gate 2: the binary compiled and ran under this policy, and no violation was reported |
| Remote code | The glue loads the binary from `new URL("swisseph.wasm", import.meta.url)`, a file packaged next to it. Nothing comes from a CDN |
| `eval`, `new Function` | None in the glue |
| Threads, `SharedArrayBuffer` | None, so no cross-origin isolation is needed |
| Loading without a bundler | `dist/` imports only relative paths. Node's `fs` and `path` are imported dynamically inside the function that reads files from disk (`dist/ephemeris/sources.js:93-94`), so a browser never loads them |
| Initialization | `fetch` and `WebAssembly.instantiateStreaming`. If streaming fails, for example on a wrong MIME type, the glue logs to the console and instantiates from an `ArrayBuffer` instead. Which path each browser takes is unknown; if those messages appear, they would fail manual test 13's empty-console check. **Verified in Chrome 155** at gate 2: the binary was served as `application/wasm` and nothing was logged, so the glue didn't fall back |
| Ephemeris data | None needed with the Moshier ephemeris, which is compiled in and covers 3000 BCE to 3000 CE. Swiss Ephemeris files would have to be copied into the module's in-memory file system |
| Memory | **Verified** from the binary: 16.3 MiB of linear memory at start, growing to at most 2 GiB, not shared |
| Size | In 0.2.2, `swisseph.wasm` is 562,903 bytes and `swisseph.mjs` 76,449 bytes. The vendored Tesseract files come to about 7 MB |
| Service worker | There isn't one, and none is needed. Helioscope should run in an extension page in a tab, like the screenshot page, because the popup closes when it loses focus |
| Speed | **Verified natively:** under 0.03 ms a call. The search in §6 makes about 600 calls a chart. **Verified in Node 24** at gate 4: the WebAssembly takes about 23 µs a call, and about 1.3 ms to create an instance. **Verified in Chrome 155** at gate 2: about 22 µs a call and 2.0 ms an instance |
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

**Verified** in the WebAssembly on 6 November 2026, through Helioscope: for a chart at local noon in New York on every day of 2015 to 2034, the share predicted detectable among charts with the planet 12° to 20° from the Sun in longitude. There were 4,844 charts, from 40 to 426 in each cell.

| Planet | 12–13° | 13–14° | 14–15° | 15–16° | 16–17° | 17–18° | 18–19° | 19–20° |
|---|---|---|---|---|---|---|---|---|
| Mercury | 3 % | 15 % | 21 % | 24 % | 39 % | 52 % | 54 % | 38 % |
| Venus | 47 % | 52 % | 56 % | 61 % | 73 % | 85 % | 86 % | 87 % |
| Mars | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 4 % |
| Jupiter | 15 % | 29 % | 45 % | 43 % | 50 % | 57 % | 55 % | 61 % |
| Saturn | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 14 % | 35 % |

Between 15° and 17° Venus is usually detectable, and Mars and Saturn never are, so no single limit for under the beams means hidden by the Sun for every planet. The choice is between conventions, and Helioscope's prediction answers the question of visibility separately.

**Decision, 6 November 2026:** under the beams is within 15° of the Sun unless the caller chooses 17°. `visibility()` takes `underTheBeams` as 15 or 17, nothing else, and each result records the limits it used. Cazimi stays within 17′ and combust within 8°30′.

The side of the Sun, which the apparition follows, is the traditional distinction between oriental and occidental: west of the Sun, a planet rises before it. **Verified** in the WebAssembly on 6 November 2026, through Helioscope, for a chart at local noon in New York on every third day of 2015 to 2034. The table counts charts predicted detectable, how many of those had the side of the Sun differ from the window the planet was best in, and how many were detectable in both windows:

| Planet | Within 30° of the Sun | 30° to 150° | Beyond 150° |
|---|---|---|---|
| Mercury | 406 detectable, 0 differ | None detectable | None detectable |
| Venus | 656, 0 differ | 1,264, 0 differ | None detectable |
| Mars | 108, 0 differ | 1,535, 0 differ, 11 in both windows | 141, 13 differ, 111 in both windows |
| Jupiter | 185, 0 differ | 1,625, 1 differs, 38 in both windows | 343, 57 differ, 283 in both windows |
| Saturn | 95, 0 differ | 1,603, 0 differ, 5 in both windows | 363, 62 differ, 273 in both windows |

The two part company only near opposition, where an outer planet is up all night. Jupiter at −179.86° is still oriental, and Helioscope finds it detectable in both windows. Venus at its 2025 inferior conjunction, which can be in both skies at its large latitude, is undetectable in both from New York.

**Decision, 6 November 2026:** the apparition stays the side of the Sun: evening east of it, morning west of it, and none at exactly 0° or 180°. Where the planet can be seen is the windows' answer, each with its own result.

### Observation windows

For the chart's UTC and place:

1. The **evening window** runs from the sunset nearest the chart's instant to the end of astronomical twilight, when the Sun's centre reaches −18°. The **morning window** runs from the start of astronomical twilight to the sunrise nearest the chart's instant. Both come from `swe_rise_trans`, which the binary exports.
2. Each window is sampled every 2 minutes with `swe_vis_limit_mag`, from its start while still inside it, then at its end, so that no sample falls outside the window. The spike rounded the number of samples instead, and could sample up to a minute past the end (§8).
3. The **best opportunity** is the sample with the largest margin while the planet is above the horizon.
4. The result reports each window's bounds, the best sample with its raw values, and how many samples were above the horizon.

The windows come from the Sun at the observer's coordinates, so time zones, local date boundaries and daylight saving don't decide them. The chart's offset is used only to show local times.

**Read** in `swecl.c`: sunrise and sunset are the Sun's upper limb at the horizon, refracted for the pressure and temperature `swe_rise_trans` is given, and twilight is the Sun's centre, unrefracted. `swe_azalt` fills in a pressure of 0 from the elevation but takes a temperature of 0 as 0 °C, so the spike's windows, and the proof of concept's, refract sunset at 0 °C.

**Verified** in the WebAssembly on 2 November 2026: `swe_rise_trans`'s answer depends a little on where its search starts. Searched from 24 instants spread over the day before it, each of three sunsets came back as values up to 0.12 ms, 0.64 ms and 1.25 ms apart (Sydney in January 2024, New York in March 2021 and in January 2025). So two charts a few minutes apart can get windows that differ in their last digits. The proof of concept's time tests count bounds less than a second apart as the same.

**Verified gap:** at Tromsø (69.65° N), the Sun doesn't set on 7 December 2024 (polar night) or on 21 June 2025 (midnight sun), so neither window exists. V1 needs a rule for that, such as "indeterminate: no twilight window", or windows defined by the Sun's altitude alone. That's a decision for the owner.

The gap reaches well south of the polar circle. **Verified** natively on 2 November 2026: on 21 June 2025 the Sun sets at Paris (48.86° N) and London (51.51° N) but never reaches −18°, so `swe_rise_trans` finds no end of astronomical twilight, while at Seattle (47.61° N) it finds one. At the June solstice the Sun's lowest point stays above −18° from about 48.6° N, so charts from there have no window either. **Verified** in the WebAssembly on 6 November 2026, through Helioscope's own window search for a chart at each day's local noon, the days of 2025 with no evening window under that rule:

| City | Latitude | Days | When |
|---|---|---|---|
| Seattle | 47.6° N | 0 | |
| Paris | 48.9° N | 19 | 11 to 29 June |
| London | 51.5° N | 59 | 22 May to 19 July |
| Berlin | 52.5° N | 69 | 17 May to 24 July |
| Edinburgh | 56.0° N | 96 | 4 May to 7 August |
| Oslo | 59.9° N | 122 | 21 April to 20 August |
| Reykjavik | 64.1° N | 146 | 9 April to 1 September |
| Tromsø | 69.6° N | 219 | Through the year. On 112 of them no sunset is near the chart's instant at all |

**Decision, 6 November 2026:** on a night the Sun sets but never reaches −18°, the evening window runs from sunset to the Sun's lowest point, and the morning window from there to sunrise. With no sunset or no sunrise at all, as in polar day and night, there's still no window, and the prediction is indeterminate. There's no latitude limit. In the lightest of those nights, such as Oslo's at −6.6° or Reykjavik's at −2.4°, a prediction rests on the model in bright twilight, where it is least tested.

- **The lowest point** is the Sun's lower meridian transit, from `swe_rise_trans`. **Verified** natively that day: at London and Oslo on 21 June 2025 the lowest true altitude fell at the transit, to the 15-second step of the scan. At Edinburgh on 10 May it fell 15 s before the transit, and 0.09″ lower. The WebAssembly's transits were bit-identical to native.
- **Each window's start and end** say which Sun event they are, so a page can say when the sky never got fully dark. The rule is reported as `astronomical-twilight-or-lower-transit`.
- **The result, Verified** the same way: no day is left without an evening window at Paris, London, Berlin, Edinburgh, Oslo or Reykjavik. Their windows end at the lower transit on the 19, 59, 69, 96, 122 and 146 nights twilight never ends. Tromsø's end there on 107 nights, and its 112 days with no sunset still get no window.

### Classification

| Result | Rule |
|---|---|
| Predicted detectable | Best margin above 0 |
| Predicted undetectable | Samples above the horizon, with a best margin of 0 or less |
| Below horizon at the evaluated instants | Every sample in both windows returned −2 |
| Calculation unavailable or indeterminate | No window, invalid input, an engine error, or a result that isn't finite |
| Marginal | **None, by decision** (below): a result shows its raw margin with its assumptions |

There's no threshold for "marginal", because the evidence says any single number would be arbitrary. For Venus from New York at one instant (§8), the limiting magnitude moved by:

- 2.4 magnitudes between meteorological ranges of 40 km and 10 km
- 0.8 between 40 % and 90 % humidity
- 0.5 between observers aged 36 and 70

It also jumps 1.1 magnitudes within a second at the photopic-to-scotopic switch.

That leaves two options for the owner. One is to show the raw margin with its assumptions and have no "marginal" class. The other is to call a result marginal when it is visible under one documented atmosphere and not under another, citing each scenario's values and running each in a fresh instance (§8, item 5).

**Verified** in the WebAssembly on 6 November 2026, through Helioscope: how often the second option would call a chart marginal. There were six atmospheres, each in its own engine: Swiss Ephemeris's defaults, a 40 km meteorological range, 10 km, 90 % humidity, an observer aged 70, and those last three together. The charts were at local noon, every third day of 2025, 122 for each row:

| Charts | Detectable by default | All six disagree | One factor at a time | Defaults and 40 km | Defaults and 90 % |
|---|---|---|---|---|---|
| Venus from New York | 109 | 43 | 37 | 6 | 12 |
| Venus from London | 107 | 61 | 57 | 5 | 34 |
| Mercury from New York | 20 | 20 | 20 | 13 | 20 |
| Mercury from London | 13 | 13 | 13 | 13 | 13 |

The label would mostly say which atmospheres were chosen. Venus charts it called marginal had default margins of up to +7.1 magnitudes, and nearly every detectable Mercury got it. Among the reference cases, only London's light-sky morning changes its prediction across the six: +4.49 by default, −2.07 at 10 km. New York's Venus goes from +9.01 to +4.47, and stays detectable.

**Decision, 6 November 2026:** no "marginal" class. A result shows its raw margin with its assumptions. Reporting each scenario's margin beside a prediction, without a class, stays possible for a page later: each scenario would need its own engine.

**Measured on 10 November 2026**, after the owner said some cases look marginal in Stellarium. The charts were the repository's invented ones with a best moment: §8's New York reference chart, London's light-sky night, test 1's New York chart, Sydney on 15 January 2024 and New York on War Time in 1944. That's 25 planets, each under the defaults, a 40 km range and a 10 km range, each in its own engine:

- The defaults gave all 25 a larger margin than a 40 km range: Swiss Ephemeris's own air is very clear.
- What a 10 km range takes away depends mostly on the planet's altitude at its best moment. It took 1.75 to 2.16 magnitudes from 41° up, 2.57 to 4.58 between 14° and 34°, and 3.95 to 8.48 between 5° and 10°.
- Test 1's Jupiter, +3.62 at 9°, is −2.82 at 10 km, while §8's New York Jupiter, +6.24 at 48°, keeps +4.43. So a margin alone doesn't say how fragile a prediction is.
- How the page shows that is still for the owner to decide. Check that night's weather, below, gives the night's own humidity, from which Swiss Ephemeris estimates the haze.

### That night's weather

**Decision, 10 November 2026:** for an optional weather check on Helioscope's page, the owner chose Open-Meteo's archive of the ERA5 reanalysis alone, over NOAA's station reports or both.

**Read and tried with curl on 10 November 2026**, with §8's invented New York chart:

- Open-Meteo's archive (`archive-api.open-meteo.com/v1/archive`) has ERA5 from 1940, on a 0.25° grid, about 5 days behind. Each hour has cloud cover, in all and low, mid and high, with humidity, temperature and surface pressure. None of its datasets has visibility.
- It needs no key and answers with `access-control-allow-origin: *`. It's free for non-commercial use, under CC BY 4.0, and its terms say its server logs may hold coordinates for up to 90 days.
- It answers a day before 1940, or after today, with HTTP 400, and the days ERA5 hasn't reached with nulls.
- A month at 40.75, −74 is about 33 KB. With ERA5 alone, the reference evening has 90 % cloud at 23:00 UTC. Open-Meteo's default mix, which adds a 9 km model from 2017, gave 100 %.
- NOAA's global hourly station reports have real visibility, but US automated stations report 10 miles at most, and older or rural charts may have no station near.

**As built** in `extension/core/open-meteo.js`, with the page's decisions in `extension/helioscope-model.js`:

- Nothing is asked until the user clicks **Check that night's weather**, whose note says what it sends.
  - One request asks for every hour of the month, or months, the twilights fall in, up to today, so the day isn't sent, at ERA5's grid point nearest the place. The time, name and town are never sent.
  - In Firefox, the click first asks Firefox's optional consent for location information.
- Each twilight's reading is the hour nearest its middle. The page shows its cloud and never turns it into a verdict, since a bright planet can show through thin high cloud or a gap.
- Each twilight is worked out again in its own engine, with that night's pressure, temperature and humidity. Swiss Ephemeris takes those as given when the pressure isn't 0, and the meteorological range is left for it to estimate from the humidity.
  - For §8's New York chart, the margins move by 0.29 at most: Mercury's goes from −0.94 to −1.23.
  - For test 1's chart, Jupiter, 9° up in 83 % humidity, goes from 28 to 6.9 times brighter than needed.
- An answer that isn't in the shape asked for is refused. A night ERA5 hasn't reached is refused too, rather than half shown. Nothing is kept.
- `test/open-meteo-era5-new-york-2025-01.json` is the archive's answer for the reference chart's month, recorded on 10 November 2026, so the tests never go to the network.

### Assumptions reported with every result

- Swiss Ephemeris 2.10.03, and the Moshier ephemeris, always requested explicitly (`SEFLG_MOSEPH`).
- The `helflag` bits.
- The atmosphere and observer **as Swiss Ephemeris completed them**, since it fills in defaults in place (§8, item 2). **Read** in `swehel.c`: it fills in a temperature or humidity of 0 only when the pressure is 0 too. With a pressure given, a temperature of 0 is 0 °C. Once that night's weather is in, the page lists each twilight's air from ERA5 instead, and its cloud at each height.
- The observer's elevation: 0 m unless the user gives one, since charts don't carry it.
- Whether the Moon was included.
- The window rule and the sampling step.

The defaults should be Helioscope's own, and explicit. swisseph-wasm's `heliacal()` defaults (15 °C and a 40 km meteorological range, `packages/core/src/derived/heliacal.ts:80-87`) differ from the C library's. At the Venus instant in §8, the 40 km range alone gives 2.55 instead of 3.01.

### Shape of the code

- `extension/core/helioscope.js` would hold the windows, sampling, classification and traditional condition, with no browser APIs and nothing about any site. It would take the engine as an argument, the way `core/stellarium-desktop.js` plans the requests that `extension/stellarium-desktop.js` sends.
- `extension/helioscope-engine.js` would be the only file that loads the WebAssembly. It would wrap `swe_vis_limit_mag` and `swe_rise_trans`, validate input, and refuse results that aren't finite.
- `extension/vendor/swisseph/` would hold the package's `dist/` and `wasm/` unchanged, with its `LICENSE`, `NOTICE` and a README, as Tesseract's folder does.
- The input is the normalized chart. Only `kind: "natal"` charts with a decided `utc` are taken, converted with `julianDay()`.
- The output, for each planet, holds:
  - the four results above
  - the windows, with their best samples
  - the classification and the assumptions
  - the raw values: `ret`, `dret`, `serr`, and the completed `datm` and `dobs`

The proof of concept (§10) is written to this shape. Its engine also wraps `swe_calc_ut` and `swe_pheno_ut`, for the longitudes and the elongation.

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
- **The WebAssembly, in Chrome 155**, on 2 November 2026: the same calls in a browser extension page, for gate 2 (below).
- **Helioscope's proof of concept, in Node**, on 2 November 2026: its engine and core against native values for Venus from New York (§10).

What didn't run: the WebAssembly in Firefox and Safari, which the owner chose to skip (gate 2, §1), and Helioscope's code in any browser, since no page uses it yet.

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

The proof of concept (§10) samples each window up to its end and no further (§6). Rerun natively that way on 2 November 2026, every case keeps its result, but two best samples change, because the spike's came from samples past the window's end:

- **Mercury, morning:** −15.21 at sunrise itself, where the spike's −14.95 came from a sample 20.5 s after it.
- **Jupiter, evening:** +7.98 at the end of astronomical twilight, 23:06:32, where the spike's +7.99 came from a sample 9.1 s after it.

Four windows also gain a sample at their end: Venus's at inferior conjunction in the evening, Mars's in the evening and both of Saturn's. `test/helioscope-reference-cases.json` holds the rerun, and the tests run all nine cases through Helioscope against it. It also holds London on 21 June 2025, for the rule in §6 for nights that never get fully dark: Venus is below the horizon through the evening window, and detectable in the morning one, best at +4.49, at 02:38 UTC with the Sun at −7.6°.

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

The reference values in §8 and §10 come from the default `-O2` build. A test that compares the WebAssembly with them therefore needs a tolerance above that build's differences. The proof of concept's tests allow 10⁻⁸ magnitudes and 2×10⁻⁷°.

Gate 4 compared `swe_vis_limit_mag` only, but the windows come from `swe_rise_trans`, and a window that started even one representable instant later, about 40 µs, would move every sample in it. **Verified** on 2 November 2026, the same way as gate 4:

- **Rise and set:** in 96 `swe_rise_trans` calls around the nine reference cases, which include every search the window rule makes, the WebAssembly found the same events as both native builds, at bit-identical times. The proof of concept's tests compare times exactly.
- **Longitudes and elongation:** at the Venus chart instant, `swe_calc_ut` and `swe_pheno_ut` were within 3.1×10⁻¹²° of the `-O2` build, and identical to the other.
- **End to end:** over the 50 evening samples, with each side sampling from its own sunset, margins were within 3.6×10⁻¹⁰ magnitudes of the `-O2` build.

Gate 4's comparison script isn't committed. The native harness is, as `tools/helioscope-native.c`, with `tools/make-helioscope-reference.mjs`, which writes the proof of concept's reference values from it.

### Gate 2: the WebAssembly in a browser

**Verified** in Chrome 155 on macOS on 2 November 2026, after the licence decision. A throwaway extension loaded the published 0.2.2 package into an extension page with AstroChart Bridge's script policy, `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`. Through gate 4's wrapper, it ran the reference call and then gate 4's 3,757 calls, in the same 22 sessions, each in a new instance. It hashed every number and string the calls returned, as gate 4 did in Node: the return codes, the results, the atmosphere, observer and object name as Swiss Ephemeris rewrote them, and the error strings. To pass, the reference call had to equal Node's exactly and native's within 10⁻⁹, the digest had to equal Node's, and the page had to log no console errors or warnings and report no policy violations.

- **Loading:** Chrome served the binary from the extension's files as `application/wasm`, 562,903 bytes. Nothing was logged, so the glue didn't fall back from streaming compilation (§5). Loading the module and creating the first instance took 47 ms.
- **The reference call:** `ret` 0, limiting magnitude 3.011648059376931, Venus −4.528168498295062 and altitude 30.449427707878996, Node's values to the bit. Against the native `-O2` values in §10, the limiting magnitude differs by 8.9×10⁻¹⁶ and the altitude by 5.3×10⁻¹⁴°.
- **The corpus:** the digest equals Node's, `e80cc9dc473fc1bbbdc362bb2e3fe08c4722c60e204534b434d1217077ad7b25`. Chrome's results are therefore bit-identical to Node's, and gate 4's comparisons with native hold for Chrome unchanged.
- **Speed:** about 22 µs a call and 2.0 ms to create an instance, against 23 µs and 1.3 ms in Node.

Firefox and Safari weren't run: on 2 November 2026 the owner chose to skip them, so gate 2 rests on Chrome alone (§9). Like gate 4's script, the extension isn't committed.

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

The proof of concept (§10) has the Venus case at the engine boundary, all nine reference cases and London on a night that never gets fully dark through the whole calculation, the time tests, Moshier always, a date outside the Moshier range, invalid coordinates, a chart with no location or no decided UTC, a result that isn't finite, and two atmospheres at one instant. Helioscope refuses charts before 15 October 1582 itself, as a second guard. **Verified** on 2 November 2026, the paste page's `analyzeEntry` took 1 June 1500 and returned a natal chart, so §2's statement that such charts are refused before any of this runs didn't hold for the paste page. Since 6 November 2026 it does: the paste form refuses such a date, as its tests check, and `analyzeEntry` throws on one (**Verified**).

The engine failing to load is tested too, with `swisseph.wasm` missing or not WebAssembly, so every item above now has a test. **Verified** in Node on 6 November 2026, in a copy of the engine and its package with `swisseph.wasm` missing, not WebAssembly or truncated:

- `createEngine()` rejected with a `WebAssembly.RuntimeError` within about 2 ms, and no rejection went unhandled.
- Before rejecting, the glue wrote two lines to stderr: "failed to asynchronously prepare wasm", then "Aborted(…)". For a missing file the message includes its path.

**Read** in the glue: a browser tries streaming compilation first, so its console would show up to four lines before the same rejection. Checking that, and deciding what a page shows when it happens, wait until Helioscope has a page.

## 9. Remaining risks

- **Licensing** (§4) blocks everything else.
- **Runtime in browsers** was verified in Chrome only at gate 2 (§8), since the owner chose to skip Firefox and Safari then.
  - **Firefox, 10 November 2026:** the owner opened Helioscope's page in Firefox 159, from version 0.2.0 loaded as a temporary add-on, for a Los Angeles chart, 1 September 1985 at 02:16 PDT. **Verified:** every value it showed matches Node's for the same chart, to the precision shown:
    - each planet's condition, side and angle from the Sun
    - its prediction and best time, including Jupiter's and Saturn's "20:24 on 31 Aug"
    - its margin: Mercury +1.33, Venus +6.91, Mars −2.25, Jupiter +8.10, Saturn +4.34
  - Not yet reported for Firefox: the console and network checks, the settings, the Stellarium Web links, the weather check, and the screenshot, paste and import pages (test 25).
  - Still unknown in Safari 26 on the Mac and the iPad: streaming instantiation and the `.wasm` MIME type, console messages, and whether the results match Node's.
- **Model validity:** in the cases tried, the margin moved by 0.5 to 2.4 magnitudes with assumptions nobody records for a birth. It moved much more for a planet low in the sky: a 10 km range took 3.95 to 8.48 magnitudes from planets 5° to 10° up (§6). The model also has a discontinuity of 1.1 magnitudes. A "detectable" with a small margin is weak evidence, and so is one with a large margin near the horizon.
- **Weather:** ERA5's cloud and air are a reanalysis's, on a 25 km grid, not observations, and ERA5 has no visibility (§6). Nobody has yet seen in a browser Firefox's consent prompt, the request's Origin header, or the page's answer to a real network failure (test 25).
- **Hidden state:** the extinction memo (item 5) and the global observer (item 3). Any sweep over atmospheres needs a fresh instance for each scenario, or calls at different instants.
- **Magnitudes:** Swiss Ephemeris uses Mallama and Hilton's 2018 formulas. **Read:** Mercury's is applied at every phase angle without a range check (`swecl.c:3923-3926`), and only Venus gets a warning, beyond 179°. Near superior conjunction, the object's magnitude is extrapolated.
- **High latitudes:** decided on 6 November 2026 (§6). Nights that never get fully dark, from about 48.6° N every June, have windows to and from the Sun's lowest point, and their predictions rest on the model in bright twilight. Polar day and night still get none. `swe_heliacal_ut()` is documented only for 60° S to 60° N.
- **Elevation** isn't in the chart model, so V1 assumes 0 m unless the user gives one.
- **Packaging:** the store zips and the Safari project take all of `extension/`, so once `extension/vendor/swisseph/` is on `main`, the next builds would carry Swiss Ephemeris whether or not a page uses it, with the App Store risk of §4. **Decision, 7 November 2026:** until a page uses Helioscope, it stays out of what the stores get.
  - `tools/package-stores.sh` leaves the paths in `tools/store-leave-out.txt` out of the Chrome and Firefox zip: `helioscope-engine.js`, `core/helioscope.js` and `vendor/swisseph/`. **Verified** that day under `sh`: the zip held 98 files instead of 199, none of them Helioscope's. The source zip keeps everything.
  - `test/store-packages.test.js` checks that none of the extension's pages loads anything on that list, and that everything Helioscope loads is on it or used by a page too. When a page starts using Helioscope, the first check fails and the list comes off on purpose.
  - `docs/safari-ipad.md` asks for the same files to be left out of TestFlight and App Store builds. Local Safari builds keep them.
  - When Helioscope ships, the store listings need `@kuntay/swisseph` 0.2.2 among the reviewer notes' links, and its unused jsDelivr address in the remote-code answers, as Tesseract's has. The App Store question of §4 comes back then too.
  - **9 November 2026:** Helioscope's page arrived and the list came off, so the zips carry Helioscope from then on. `docs/safari-ipad.md` now names the files an App Store build leaves out itself.
- **One extension or two:** on 9 November 2026 the owner asked whether Helioscope should also, or instead, be an extension of its own. **Decision, 9 November 2026:** it stays a feature of AstroChart Bridge, at least for V1.
  - Helioscope needs a chart, and reading charts is what the Bridge does. On its own it would need a way in: links and `.astrochart.json` files, which come from the Bridge anyway, a form to type a chart into, which would be new, or copies of the Bridge's readers.
  - **Read** in MDN's compatibility data, not run: in Chrome and Firefox, one extension can message another by its ID, which receives it in `runtime.onMessageExternal`. In Safari that event fires only for the extension's own app and, from Safari 15.4, for web pages its `externally_connectable` allows. Between two extensions in Safari, a chart could travel only as a link or a file.
  - **Read** in the Chrome Web Store's policies the same day: an extension needs a single, narrow purpose, and one developer may not publish several extensions with duplicate functionality. Inside the Bridge, the single-purpose statement in `docs/store-listing.md` needs a clause for visibility when Helioscope ships. A second extension that the Bridge also contains would risk the duplicate rule.
  - **Verified** the same day: Helioscope's modules and its WebAssembly are 27 files and 0.82 MiB, of the 9.04 MiB in `extension/`. The only one it shares with the rest of the extension is `core/stellarium-desktop.js`.
  - As a feature, it needs no product name. A listing would, and HelioScope is already the name of Aurora Solar's solar design software.
  - An App Store build without Helioscope, as `docs/safari-ipad.md` asks for, would also have to hide whatever opens it.
  - Worth revisiting if Chrome's review rejects the wider purpose, the App Store becomes a goal, Helioscope turns out to be the first of several calculations, or people want visibility without having the Bridge read the chart. A split stays cheap as long as Helioscope's page takes its chart from its link, as `chart.html` does. A second extension could then be assembled from `extension/`, the way `tools/site.mjs` assembles the receiving page's site.
- **Upstream:**
  - swisseph-wasm has one maintainer.
  - Its CI builds with the unpinned `emscripten/emsdk:latest` image (`tools/build-wasm.mjs:32`), so binaries can differ by build date.
  - The repository's 0.3.0 isn't on npm.
  - Astrodienst fixed an undersized array in `heliacal_ut_arc_vis` after the vendored tag (upstream `94621ab`, 25 October 2026). **Read:** the vendored `swehel.c:2215` still declares `xaz[2]` where `swe_azalt` writes three values. It affects only arcus visionis heliacal searches, which V1 doesn't use.
- **Stellarium Web:** selecting a planet depends on the NoctuaSky API answering, and the clock can't be paused by a link.

## 10. Recommended next step

1. **Choose the licensing route** (§4). Done: route A, on 1 November 2026.
2. **Build an isolated prototype for gates 2 and 4**, outside the production extension. A scratch extension page loads the vendored package and calls `swe_vis_limit_mag` through `raw.cwrap` for Venus from New York at 2025-01-10 22:35:00 UTC, with the C defaults and Moshier. It compares the result with the native one: `ret` 0, limiting magnitude 3.01164805937693, Venus −4.528168498295062, altitude 30.449427707878943. Run it in Chrome, Firefox and Safari, and run the same comparison in Node from `test/`. Gate 4 is done: it ran in Node on 1 November 2026, from a script outside the repository (§8). Of the browser runs, Chrome's passed on 2 November 2026 (§8), and the owner chose the same day to skip Firefox and Safari.
3. **Then the proof of concept** the brief describes: Venus, New York, the evening window of 10 January 2025, and one visibility calculation returning the structured result of §6, with the tests written first. Done on 2 November 2026, in Node:
   - `extension/helioscope-engine.js` is the only file that loads the WebAssembly, vendored unchanged with its licence in `extension/vendor/swisseph/`. It wraps `swe_rise_trans`, `swe_calc_ut`, `swe_pheno_ut` and `swe_vis_limit_mag`. It writes every input afresh, refuses impossible input and results that aren't finite, and keeps one atmosphere for each WebAssembly instance because of item 5.
   - `extension/core/helioscope.js` finds the windows, samples them every 2 minutes and classifies the result, with no browser APIs. It takes the engine as an argument.
   - For Venus from New York, the evening window is predicted detectable, with a best margin of +9.01 at 23:14:32 UTC. Results round times to the nearest second; the link in §7 cut the seconds off, so it says 23:14:31.
   - All nine of §8's reference cases come out as §8 describes them, compared with native values rerun with its sampling rule.
   - Its windows follow the chart's UTC instant and place, through the same readers as any chart: across local midnight, at Sydney's date boundary, in the 2021 daylight saving gap once a UTC is chosen, and in 1944 on War Time.
   - When the WebAssembly can't be loaded, `createEngine()` rejects quickly and leaves nothing behind, for a page to catch.
   - On a night the Sun never reaches −18°, its windows run to and from the Sun's lowest point, as the owner decided on 6 November 2026 (§6).
   - There's no "marginal" class, as the owner decided on 6 November 2026 (§6): a result shows its raw margin with its assumptions.
   - Under the beams is within 15° of the Sun unless 17° is chosen, as the owner decided the same day (§6).
   - The apparition is the side of the Sun, the traditional oriental or occidental, as the owner decided the same day (§6). The windows say where the planet can be seen.
   - No page uses it yet, so the store zips leave it out, as the owner decided on 7 November 2026 (§9).
4. **Then Helioscope's page, inside AstroChart Bridge**, which the owner chose on 9 November 2026 over an extension of its own (§9). Started the same day:
   - `extension/helioscope.html` works out the five planets for the chart in its link, which it reads as the receiving page reads one. Its decisions are in `extension/helioscope-model.js` and its drawing in `extension/helioscope-view.js`, both tested in Node with the real engine.
   - For each planet it keeps §6's results apart: the traditional condition and the side of the Sun at the chart's moment, then the prediction from the windows around it, with its raw margin. Times are at the chart's own offset, to the nearest minute.
   - Its settings are an elevation in whole metres and 15° or 17° for under the beams, kept on this computer.
   - The chart screens open it with **Which planets were visible**, under See the sky, wherever Share… is offered: the popup and the screenshot and paste pages. Its link carries the chart but not its name or town. A horary chart, which reaches a chart screen as natal with horary as its gender, gets the button too. The import page's AAF and Morinus screens, which have no Share…, offer it as well, after their Astro-Seek buttons.
   - Each planet with a best moment links to Stellarium Web at that moment, from the chart's place at the elevation the prediction used, with the planet selected: §7's form, with a 60° field. §7 tried only Venus, with an unencoded date. The other four planets, and the encoded date the extension's links use, are for test 25 to check.
   - **Check that night's weather**, which the owner chose on 10 November 2026 (§6), gets ERA5's cloud and air from Open-Meteo when it's clicked, and works each twilight out again with that air.
   - The README, the privacy page and the store listing describe it. The store listing has its single-purpose clause, `@kuntay/swisseph` among the reviewer notes' links, and the remote-code answer for the package's unused jsDelivr address.
   - First run in a browser: Firefox 159, on 10 November 2026, where its results matched Node's (§9). The rest of test 25 of `docs/manual-test.md`, and Safari, are still to run.
