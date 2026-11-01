# Tesseract.js, vendored

Chart Bridge reads screenshots with Tesseract.js. Manifest V3 extensions can't load code from the web, and the screenshot never leaves the computer, so every file Tesseract.js needs is here, unchanged from its npm package.

| File | From | License |
|---|---|---|
| `tesseract.esm.min.js`, `.map` | `tesseract.js@5.1.1`, `dist/` | Apache-2.0, `LICENSE-tesseract.js.md` |
| `worker.min.js`, `.map` | `tesseract.js@5.1.1`, `dist/` | Apache-2.0, `LICENSE-tesseract.js.md` |
| `tesseract-core-simd-lstm.wasm.js` | `tesseract.js-core@5.1.1` | Apache-2.0, `LICENSE-tesseract.js-core` |
| `eng.traineddata.gz` | `@tesseract.js-data/eng@1.0.0`, `4.0.0_best_int/` | Apache-2.0, from Tesseract's `tessdata_best` |

`eng.traineddata.gz` is the language data Tesseract.js 5.1.1 downloads by default when the LSTM engine is used.

Only the SIMD core is included: `screenshot.js` names it directly instead of letting Tesseract.js choose, and WebAssembly SIMD has been supported since Chrome 91 and Firefox 89. The core embeds its WebAssembly, which is why the manifest allows `'wasm-unsafe-eval'`.

To update, install the new versions in a scratch folder, copy the same files over, and run the screenshot tests in `docs/manual-test.md`.
