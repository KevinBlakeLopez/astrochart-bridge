# lean-qr, vendored

Chart Bridge draws QR codes for shared chart links with lean-qr, on the device, so a link is never sent to a QR service. Manifest V3 extensions can't load code from the web, and the receiving page loads only its own files, so the one file Chart Bridge uses is here, unchanged from its npm package.

| File | From | License |
|---|---|---|
| `index.mjs` | `lean-qr@2.7.4`, `index.mjs` | MIT, `LICENSE` |

The package tarball's sha512 matched the registry's `dist.integrity`, `sha512-tlMPFfqhAAZN7+j/djRSvl/2+AYT2+7RRuyq8bvcbV8gMiENiscquQ9WTfCSyeEdxsVaEB+tU7e9nFZC63BFnQ==`. The file's own SHA-256 is `0ce41cd6f92cc23cf057a1df7e1b3876767d678665dd65af4e1d22b4fad967dc`.

It has no imports and makes no network requests. `qr.js` uses only `generate`, `correction` and `mode.ascii`; the file's `toDataURL` and Shift-JIS support go unused.

To update, run `npm pack lean-qr@<version> --ignore-scripts` in an empty scratch folder, check the tarball against `npm view lean-qr@<version> dist.integrity`, copy `index.mjs` and `LICENSE` over, and run `npm test` and test 17 in `docs/manual-test.md`.
