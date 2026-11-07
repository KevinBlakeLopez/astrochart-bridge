# Swiss Ephemeris, vendored

Helioscope predicts naked-eye planetary visibility with Swiss Ephemeris 2.10.03, compiled to WebAssembly by [swisseph-wasm](https://github.com/kuntayerkus/swisseph-wasm) and published on npm as `@kuntay/swisseph`. Manifest V3 extensions can't load code from the web, so the files it needs are here, unchanged from the npm package. `helioscope-engine.js`, two folders up, is the only file that loads them.

| Files | From | Licence |
|---|---|---|
| `dist/` | `@kuntay/swisseph@0.2.2`, `dist/`: the JavaScript API, with its type declarations and source maps | AGPL-3.0-or-later, `LICENSE` and `NOTICE` |
| `wasm/swisseph.mjs`, `wasm/swisseph.wasm` | `@kuntay/swisseph@0.2.2`, `wasm/`: the Emscripten glue and the compiled Swiss Ephemeris | AGPL-3.0-or-later. Swiss Ephemeris is Astrodienst AG's, under the AGPL or its Professional License, `NOTICE` |

The package's tarball has the SHA-512 the npm registry gives as its integrity value, `sha512-Jzh//qDF/zXu8yOmeCPDHGIDOURW/4Zls2AoouISPmiyVPZN0Pl9wI5qPWPoXmdJVoSHg149jU5xRlz79IwIgQ==`. The registry also holds an SLSA provenance attestation for it, naming swisseph-wasm's commit `4c4b0f4`.

## Source

`wasm/swisseph.wasm` is compiled code. Its source is swisseph-wasm at commit [`4c4b0f4`](https://github.com/kuntayerkus/swisseph-wasm/tree/4c4b0f4): the Swiss Ephemeris C sources it compiles, in `vendor/swisseph/`, and its build script, `tools/build-wasm.mjs`. `dist/` is compiled from that repository's `packages/core/src/`, which the npm package also ships as `src/`. `docs/HELIOSCOPE_V1_FEASIBILITY.md` (§3) records that, at swisseph-wasm's commit `0490fcf`, those C sources were identical to upstream's tag `v2.10.3final`.

## What Helioscope uses

Only `createSwissEph()`, for a fresh WebAssembly instance, and its `raw` Emscripten module, through which `helioscope-engine.js` calls `swe_rise_trans`, `swe_calc_ut`, `swe_pheno_ut` and `swe_vis_limit_mag`. It always asks for the Moshier ephemeris, which is compiled into the binary, and mounts no ephemeris files: the package's `FetchEphemeris`, and the CDN it downloads them from by default, are never used.

## Updating

Unpack the new version in a scratch folder and check its tarball against the registry's integrity value. Copy `dist/`, `wasm/`, `LICENSE` and `NOTICE` over. If the Swiss Ephemeris version changed, build the native harness from the new C sources and regenerate `test/helioscope-venus-new-york.json` with `tools/make-helioscope-reference.mjs`. Then run `npm test`: the engine's tests compare the WebAssembly with native Swiss Ephemeris built from the same sources.
