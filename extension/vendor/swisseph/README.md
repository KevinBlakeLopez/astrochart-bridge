# Swiss Ephemeris, vendored

Helioscope predicts naked-eye planetary visibility with Swiss Ephemeris 2.10.03, compiled to WebAssembly by [swisseph-wasm](https://github.com/kuntayerkus/swisseph-wasm) and published on npm as `@kuntay/swisseph`. The parans page works out risings, settings and culminations with it too. Manifest V3 extensions can't load code from the web, so the files they need are here, unchanged from the npm package and from Astrodienst. `helioscope-engine.js`, two folders up, is the only file that loads them.

| Files | From | Licence |
|---|---|---|
| `dist/` | `@kuntay/swisseph@0.2.2`, `dist/`: the JavaScript API, with its type declarations and source maps | AGPL-3.0-or-later, `LICENSE` and `NOTICE` |
| `wasm/swisseph.mjs`, `wasm/swisseph.wasm` | `@kuntay/swisseph@0.2.2`, `wasm/`: the Emscripten glue and the compiled Swiss Ephemeris | AGPL-3.0-or-later. Swiss Ephemeris is Astrodienst AG's, under the AGPL or its Professional License, `NOTICE` |
| `ephe/seas_12.se1`, `ephe/seas_18.se1`, `ephe/seas_24.se1` | Astrodienst's [aloistr/swisseph](https://github.com/aloistr/swisseph/tree/cae9ecd4b201544d85e411aced17660932514d43/ephe) at commit `cae9ecd` (29 May 2026), `ephe/`: the main asteroid files for 1200–1799, 1800–2399 and 2400–2999, made from JPL's DE441, with Ceres in them | As Swiss Ephemeris's, `NOTICE` |
| `ephe/sefstars.txt` | Astrodienst's [aloistr/swisseph](https://github.com/aloistr/swisseph/blob/bb65079744e63e6610ab24f188e88b27ac1965f9/ephe/sefstars.txt) at commit `bb65079` (23 March 2025), `ephe/`: Swiss Ephemeris's star catalogue, for the parans page's fixed stars | As Swiss Ephemeris's, `NOTICE` |
| `ephe/s136199.se1` and the six others below | Alois Treindl's public [Swiss Ephemeris Dropbox](https://www.dropbox.com/scl/fo/y3naz62gy6f6qfrhquu7u/h?rlkey=ejltdhb262zglm7eo6yfj2940&dl=0), which [Astrodienst's download page](https://www.astro.com/ftp/swisseph/ephe/) names, `all_ast/astN/`, downloaded on 12 November 2026: each dwarf planet's long file, for 3000 BC to 2999 | As Swiss Ephemeris's, `NOTICE` |

Each `.se1` file's Git blob hash is the one upstream's tree lists for it at that commit:

| File | Bytes | Git blob | SHA-256 |
|---|---|---|---|
| `ephe/seas_12.se1` | 223,396 | `75a837be6323d4580dfbdae51f1828be8f7b7799` | `3345555097e2080f4e2582026a6008ebbccfdca27600ba48019ca9c6e3e7a211` |
| `ephe/seas_18.se1` | 223,004 | `8f900cab7e557e4c41f758a6bf3a3c3967e7e3db` | `a2cd8fc33807c78ca9a700c91c2e042258b12fc4796519e00781440b5ad8b2e2` |
| `ephe/seas_24.se1` | 222,674 | `5ec748ae331ed982484f559deab5eedb94db8771` | `1b4160a4d289c3d2df55efcc016d407a1516c079b725b2bf2b073a70211aa391` |
| `ephe/sefstars.txt` | 136,618 | `0c6a40a880c4fa9d1b93d09474c923a3284f81e2` | `18b0dcafbe5b7240773daba2c038a325f5b3fc4163f61e0a7f4e92abd4f517c6` |

The parans page's 83 stars come from `sefstars.txt`, as `tools/fixed-stars.mjs` picks them: every star in it brighter than magnitude 2.0, and the 64 Bernadette Brady uses, four of them star clusters, each with the catalogue's other names and Brady's spelling where it differs. `test/parans-star-reference.json`, which `tools/make-star-reference.py` writes with astro-research on the same catalogue, is what the engine's star events are checked against.

The Dropbox publishes no hashes, so the dwarf planets' files can't be checked against one. Each arrived at the size Dropbox gave for it, and each file's own header names its asteroid and says it was "Created for Astrodienst in Switzerland … based on JPL Ephemeris DE441, long": on 12 March 2026 from L. H. Wasserman's orbits, Ixion's on 3 November 2026 from the Minor Planet Center's.

| File | Body | Bytes | Git blob | SHA-256 |
|---|---|---|---|---|
| `ephe/s136199.se1` | 136199 Eris | 139,140 | `08acb767ffaa964423bc98a264b60de5d83952d1` | `b26cd86e1d0a6f6d1b3a45ec9b3de7771d540f281f56a0b86c9e828c3aaba152` |
| `ephe/s136472.se1` | 136472 Makemake | 149,509 | `5b79a25711874becf892e10944fa5df62b496f2c` | `81bd2f212fadc2b855ef05b0537ac1e4927e0caae4702954ef29b8862565d63d` |
| `ephe/s136108.se1` | 136108 Haumea | 151,806 | `111a87d44c55d4cad1bff56363175ba39731dd7f` | `48a46d498031b060d55de5465a1416864baef19e23a76f470aa233b3b8547f78` |
| `ephe/se20000.se1` | 20000 Varuna | 152,063 | `d3eb61de10ee808d309effdac48769bab5866a22` | `27a7009e7722401801c13240cb5032ae01a5d55b1a8d9c4abc2e845563ff71da` |
| `ephe/se28978.se1` | 28978 Ixion | 155,889 | `38852cb537f2fbf330c6f88d383c7387fd02cdde` | `0a05bff0237f69c834d422b4f1b0262c556a76b18e5374d36d99f901d8908253` |
| `ephe/se90482.se1` | 90482 Orcus | 155,640 | `97a988db2b511cb6bacf32f2a61d843948fbead8` | `fc45f7dd52561881e322044cc14c2bf430fca60c44732f342286324a9da63f25` |
| `ephe/se90377.se1` | 90377 Sedna | 94,613 | `dddb064b321f3eb13e1dd7bb652c9ed3ead959d9` | `2ee55a7cbe1644f820671e957b0036f8c9dcf168398e20173f2c58fc6a42d292` |

An independent check of what's in them, on 12 November 2026: at London on 10 April 2024, every rising, culmination and setting of Ceres and the seven dwarf planets that native Swiss Ephemeris works out from these files is within 55 seconds of JPL Horizons's own, to the minute it gives, on its unrefracted horizon (`R_T_S_ONLY=RAD`).

The package's tarball has the SHA-512 the npm registry gives as its integrity value, `sha512-Jzh//qDF/zXu8yOmeCPDHGIDOURW/4Zls2AoouISPmiyVPZN0Pl9wI5qPWPoXmdJVoSHg149jU5xRlz79IwIgQ==`. The registry also holds an SLSA provenance attestation for it, naming swisseph-wasm's commit `4c4b0f4`.

## Source

`wasm/swisseph.wasm` is compiled code. Its source is swisseph-wasm at commit [`4c4b0f4`](https://github.com/kuntayerkus/swisseph-wasm/tree/4c4b0f4): the Swiss Ephemeris C sources it compiles, in `vendor/swisseph/`, and its build script, `tools/build-wasm.mjs`. `dist/` is compiled from that repository's `packages/core/src/`, which the npm package also ships as `src/`. `docs/HELIOSCOPE_V1_FEASIBILITY.md` (§3) records that, at swisseph-wasm's commit `0490fcf`, those C sources were identical to upstream's tag `v2.10.3final`.

## What Helioscope and parans use

Only `createSwissEph()`, for a fresh WebAssembly instance, its `mountEphemeris()`, and its `raw` Emscripten module, through which `helioscope-engine.js` calls `swe_rise_trans`, `swe_calc_ut`, `swe_pheno_ut`, `swe_vis_limit_mag` and `swe_sidtime`. It always asks for the Moshier ephemeris, which is compiled into the binary. When it's given the files in `ephe/`, it mounts them, and Swiss Ephemeris reads Ceres from them, with the Sun and Earth still from Moshier; without them, Ceres can't be worked out. The parans page fetches them from its own copy and gives them to the engine; Helioscope's page doesn't. `test/parans-asteroid-reference.json`, which `tools/make-asteroid-reference.py` writes with native Swiss Ephemeris on the same files, is what the engine's Ceres is checked against. The package's `FetchEphemeris`, and the CDN it downloads files from by default, are never used.

## Updating

Unpack the new version in a scratch folder and check its tarball against the registry's integrity value. Copy `dist/`, `wasm/`, `LICENSE` and `NOTICE` over. If the Swiss Ephemeris version changed, build the native harness from the new C sources and regenerate `test/helioscope-venus-new-york.json` with `tools/make-helioscope-reference.mjs`. Then run `npm test`: the engine's tests compare the WebAssembly with native Swiss Ephemeris built from the same sources.

To update the files in `ephe/`, download them from upstream's `ephe/` at a named commit, check each one's Git blob hash against upstream's tree, and update the table above.
