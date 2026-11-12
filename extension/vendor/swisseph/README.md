# Swiss Ephemeris, vendored

Helioscope predicts naked-eye planetary visibility with Swiss Ephemeris 2.10.03, compiled to WebAssembly by [swisseph-wasm](https://github.com/kuntayerkus/swisseph-wasm) and published on npm as `@kuntay/swisseph`. The parans page works out risings, settings and culminations with it too. Manifest V3 extensions can't load code from the web, so the files they need are here, unchanged from the npm package and from Astrodienst. `helioscope-engine.js`, two folders up, is the only file that loads them.

| Files | From | Licence |
|---|---|---|
| `dist/` | `@kuntay/swisseph@0.2.2`, `dist/`: the JavaScript API, with its type declarations and source maps | AGPL-3.0-or-later, `LICENSE` and `NOTICE` |
| `wasm/swisseph.mjs`, `wasm/swisseph.wasm` | `@kuntay/swisseph@0.2.2`, `wasm/`: the Emscripten glue and the compiled Swiss Ephemeris | AGPL-3.0-or-later. Swiss Ephemeris is Astrodienst AG's, under the AGPL or its Professional License, `NOTICE` |
| `ephe/seas_12.se1`, `ephe/seas_18.se1`, `ephe/seas_24.se1` | Astrodienst's [aloistr/swisseph](https://github.com/aloistr/swisseph/tree/cae9ecd4b201544d85e411aced17660932514d43/ephe) at commit `cae9ecd` (29 May 2026), `ephe/`: the main asteroid files for 1200–1799, 1800–2399 and 2400–2999, made from JPL's DE441, with Ceres in them | As Swiss Ephemeris's, `NOTICE` |

Each `.se1` file's Git blob hash is the one upstream's tree lists for it at that commit:

| File | Bytes | Git blob | SHA-256 |
|---|---|---|---|
| `ephe/seas_12.se1` | 223,396 | `75a837be6323d4580dfbdae51f1828be8f7b7799` | `3345555097e2080f4e2582026a6008ebbccfdca27600ba48019ca9c6e3e7a211` |
| `ephe/seas_18.se1` | 223,004 | `8f900cab7e557e4c41f758a6bf3a3c3967e7e3db` | `a2cd8fc33807c78ca9a700c91c2e042258b12fc4796519e00781440b5ad8b2e2` |
| `ephe/seas_24.se1` | 222,674 | `5ec748ae331ed982484f559deab5eedb94db8771` | `1b4160a4d289c3d2df55efcc016d407a1516c079b725b2bf2b073a70211aa391` |

The package's tarball has the SHA-512 the npm registry gives as its integrity value, `sha512-Jzh//qDF/zXu8yOmeCPDHGIDOURW/4Zls2AoouISPmiyVPZN0Pl9wI5qPWPoXmdJVoSHg149jU5xRlz79IwIgQ==`. The registry also holds an SLSA provenance attestation for it, naming swisseph-wasm's commit `4c4b0f4`.

## Source

`wasm/swisseph.wasm` is compiled code. Its source is swisseph-wasm at commit [`4c4b0f4`](https://github.com/kuntayerkus/swisseph-wasm/tree/4c4b0f4): the Swiss Ephemeris C sources it compiles, in `vendor/swisseph/`, and its build script, `tools/build-wasm.mjs`. `dist/` is compiled from that repository's `packages/core/src/`, which the npm package also ships as `src/`. `docs/HELIOSCOPE_V1_FEASIBILITY.md` (§3) records that, at swisseph-wasm's commit `0490fcf`, those C sources were identical to upstream's tag `v2.10.3final`.

## What Helioscope and parans use

Only `createSwissEph()`, for a fresh WebAssembly instance, its `mountEphemeris()`, and its `raw` Emscripten module, through which `helioscope-engine.js` calls `swe_rise_trans`, `swe_calc_ut`, `swe_pheno_ut`, `swe_vis_limit_mag` and `swe_sidtime`. It always asks for the Moshier ephemeris, which is compiled into the binary. When it's given the files in `ephe/`, it mounts them, and Swiss Ephemeris reads Ceres from them, with the Sun and Earth still from Moshier; without them, Ceres can't be worked out. The parans page fetches them from its own copy and gives them to the engine; Helioscope's page doesn't. `test/parans-asteroid-reference.json`, which `tools/make-asteroid-reference.py` writes with native Swiss Ephemeris on the same files, is what the engine's Ceres is checked against. The package's `FetchEphemeris`, and the CDN it downloads files from by default, are never used.

## Updating

Unpack the new version in a scratch folder and check its tarball against the registry's integrity value. Copy `dist/`, `wasm/`, `LICENSE` and `NOTICE` over. If the Swiss Ephemeris version changed, build the native harness from the new C sources and regenerate `test/helioscope-venus-new-york.json` with `tools/make-helioscope-reference.mjs`. Then run `npm test`: the engine's tests compare the WebAssembly with native Swiss Ephemeris built from the same sources.

To update the files in `ephe/`, download them from upstream's `ephe/` at a named commit, check each one's Git blob hash against upstream's tree, and update the table above.
