# Portable charts

Chart Bridge can pass a chart to another device that doesn't have the extension: as a link, a QR code of that link, a `.astrochart.json` file, or through the system's share sheet. The other device opens the link or file on the receiving page, `import.html`, which shows the chart and opens it in Stellarium Web or Astro-Seek. There is no server, account, database or tracking: the chart travels inside the link or file, and every page that reads it runs on the device.

## How it fits together

```text
Astro-Seek page ─┐
astro.com page ──┼─ analyzePage / analyzeScreenshot ─ decided chart (popup screens)
screenshot ──────┘                                          │
                                                            ├─ stellariumUrl, astroSeekUrl  (unchanged)
                                                            │
                                                            └─ chartToShare ─ toPortable ─ portable chart
                                                                                              │
                                     serialize ─┬─ toFragment ─ link (#v1=…) ─┬─ Copy link    │
                                                │                              ├─ QR code      │
                                                │                              └─ Share link…  │
                                                └─ fileFor ─ .astrochart.json ─┬─ Download     │
                                                                               └─ Share file…  │
                                                                                               │
  link ─ fromFragment ─┐                                                                       │
  file ─ readChartFile ┴─ parse ─ portable chart ─ skyFor ─ stellariumUrl, astroSeekUrl ───────┘
```

- `extension/core/portable.js` is the format: building, validating, serializing and reading charts, and link fragments. It uses no browser API and knows no site.
- The popup and the screenshot page offer **Share…** on any screen with a chart of its own, once a reading or an offset decides the UTC. It opens the extension's copy of `import.html` with the chart in its link.
- `import.html` is the same page in the extension and on the web. It reuses the popup's view model and `view.js`, so a received chart shows the popup's rows and notes, and opens through the same `stellariumUrl` and `astroSeekUrl` as the popup.
- A source added later needs only to produce a decided chart; the format, page and sharing don't change. A destination added later needs only to take `skyFor`'s `{ utc, lat, lng }`.

## The format

```json
{
  "format": "chart-bridge",
  "version": 1,
  "chart": {
    "calendar": "gregorian",
    "local": "2024-04-17T08:00:00",
    "utcOffsetSeconds": -14400,
    "latitude": 40.716667,
    "longitude": -74
  },
  "source": { "site": "astro-seek", "via": "page", "zoneLabel": "EDT, DST", "utcBasis": "printed" }
}
```

| Field | Required | Meaning |
|---|---|---|
| `format` | yes | Always `"chart-bridge"`. |
| `version` | yes | `1`. Any other integer is refused as `unsupported-version`. |
| `chart.calendar` | yes | Always `"gregorian"` in version 1. |
| `chart.local` | yes | The wall-clock time at the birthplace, `YYYY-MM-DDTHH:MM:SS`, no zone. |
| `chart.utcOffsetSeconds` | yes | Seconds east of UTC, an integer from −43200 to +50400. Local-mean-time offsets run to the second. |
| `chart.latitude`, `chart.longitude` | yes | Degrees north and east, as the readers round them (6 decimals). |
| `source.site` | no | Where the chart was first read: `astro-seek`, `astro-com`, or a later site's code. |
| `source.via` | no | `page` or `screenshot`. A screenshot's chart was read by OCR, and nothing checked its latitude. |
| `source.zoneLabel` | no | The zone label as the page printed it, at most 64 characters, with no control or format characters. |
| `source.utcBasis` | no | How the offset was decided: `printed`, `declared`, `zone-label` or `entered`. |

The UTC isn't written: `skyFor` works it out as `local − utcOffsetSeconds`, so a chart can't hold two times that disagree.

### Rules

- **Deterministic.** `serialize` always writes the keys in the same order, so a chart always gives the same link, file and QR code. A file is indented; a link isn't.
- **Validated both ways.** `toPortable` runs the same checks as `parse`, so anything the extension shares can be read back.
- **Extensible without being misread.** A reader refuses any key it doesn't know at the top level or in `chart`, since those carry meaning: a later version's approximate time or time zone must never be read as an exact time at this offset. A change of meaning needs a new version. Unknown keys in `source` are dropped, so new provenance fields can be added within version 1.
- **No personal identifiers.** There are no names or place names. The location is its coordinates.

### What can't be represented, and what a trip loses

| | Why |
|---|---|
| Dates before 15 October 1582 | No reader says which calendar an earlier date is in, so it isn't labelled Gregorian. Sharing such a chart is refused with a message. |
| Unknown or approximate birth times | No reader produces them, and both destinations need an exact instant. A later version could add a field for them. |
| A chart whose offset is still undecided | Sharing waits until a reading is picked or an offset typed; `utcBasis` records which. |
| IANA time zones | No reader has one: Astro-Seek prints an abbreviation and astro.com an hour code. The offset is the truth, as the readers decided it. |
| Unknown `source` fields | Dropped by this version's reader, by design. |

### Links and sizes

A link is the receiving page's address, `#v1=`, and the serialized chart in base64url. The fragment is never sent to the server that serves the page. It isn't compressed: compression saved about 80 characters of 400 and would make the link unreadable.

| Chart | Link, with the GitHub Pages address | QR code, error correction M |
|---|---|---|
| The Astro-Seek fixtures | 397–405 characters | version 15, 85 modules with the quiet zone |
| Longest possible today (64-character zone label, from a screenshot) | 492–496 characters | version 17, 93 modules |

A link over 2,048 characters, or a file or JSON text over 16,384 bytes or characters, is refused before it is decoded. A link that would need a QR code past version 20 gets no code, and the page points to Copy link and Download file.

## Security and privacy

- The receiving page loads only its own files: `default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'`, set in a `<meta>` tag, and `no-referrer`. It has no third-party scripts, analytics or storage.
- It reads the fragment once and removes it from the address and from that history entry with `history.replaceState`, whether or not the chart was valid. Whether a browser's History list still keeps the original address hasn't been checked in any browser (manual test 15).
- Imported text is only ever set with `textContent`. The QR code is built element by element, with no markup parsed and no image loaded.
- Nothing opens until a button is clicked. Destinations open in a new tab with `noopener,noreferrer`.
- QR codes are made on the device by the vendored `lean-qr` (`extension/vendor/lean-qr/`), never by a QR service.
- Anyone with a link, a file or a view of its QR code can read the chart. The page says so.
- **Not covered:** a `<meta>` policy can't set `frame-ancestors`, and GitHub Pages can't send headers, so another site could put the page in a frame. Its only actions open links and copy text.

## Compatibility

✅ checked in the browser pane (Chromium; desktop, and emulated at 375×812, 812×375, 768×1024 and 1024×768). ⬜ not checked yet: the manual test named covers it. — not offered there.

| Feature | Chromium (pane) | Chrome, Edge, Brave | Firefox | Safari (macOS) | iPhone Safari | iPad Safari | Chrome Android | Firefox Android |
|---|---|---|---|---|---|---|---|---|
| Open a link, show the chart | ✅ | ⬜ 15 | ⬜ 15 | ⬜ 15 | ⬜ 15 B | ⬜ 15 B | ⬜ 15 B | ⬜ 15 B |
| Open Stellarium Web, Astro-Seek | ✅ (links checked, opening stubbed) | ⬜ 15 | ⬜ 15 | ⬜ 15 | ⬜ 15 B | ⬜ 15 B | ⬜ 15 B | ⬜ 15 B |
| Copy link | ✅ fallback field (the pane refused the clipboard) | ⬜ 15 | ⬜ 15 | ⬜ 15 | ⬜ 15 B | ⬜ 15 B | ⬜ 15 B | ⬜ 15 B |
| Download file | ✅ (save stubbed) | ⬜ 15 | ⬜ 15 | ⬜ 15 | ⬜ 18 | ⬜ 18 | ⬜ 18 | ⬜ 18 |
| Open or drop a chart file | ✅ (files made in the page) | ⬜ 18 | ⬜ 18 | ⬜ 18 | ⬜ 18 | ⬜ 18 | ⬜ 18 | ⬜ 18 |
| Show QR code | ✅ (decoded by `BarcodeDetector`) | ⬜ 17 | ⬜ 17 | ⬜ 17 | ⬜ 17 | ⬜ 17 | ⬜ 17 | ⬜ 17 |
| Scan a QR code off a monitor | — | — | — | — | ⬜ 17 | ⬜ 17 | ⬜ 17 | ⬜ 17 |
| Share link…, Share file… | — (no `navigator.share`; stubbed calls ✅) | ⬜ 18 B | ⬜ 18 B, expected absent on desktop | ⬜ 18 B | ⬜ 18 B | ⬜ 18 B | ⬜ 18 B | ⬜ 18 B |
| Share… in the extension | — | ⬜ 16 | ⬜ 16 | — | — | — | — | — |
| Open a chart file from the popup | — | ⬜ 18 A | ⬜ 18 A | — | — | — | — | — |

The share buttons appear only where the browser says it can share that thing, so a browser without a share sheet, or one that refuses JSON files, shows Copy link and Download file instead. No cell is ✅ for a physical device: none has been used yet.

## Deploying the receiving page

The page is static: `node tools/site.mjs <folder>` copies the files `import.html` loads, and `lean-qr`'s licence, into an empty folder: 16 files, about 90 KB. `test/site.test.js` checks that list against what the page actually loads. Nothing else from `extension/` is published.

`.github/workflows/pages.yml` runs `npm test`, builds the site and deploys it to GitHub Pages on a push to `main` that touches the extension, tools, tests or fixtures, or when run by hand. Its actions are pinned to release commits.

Before the first deploy:

1. In the repository's Settings → Pages, set **Source** to **GitHub Actions**.
2. Merge the branches with this work into `main`. GitHub's `github-pages` environment deploys from the default branch only.
3. After the workflow runs, check that `https://kevinblakelopez.github.io/chart-bridge/import.html` answers 200 with no redirect, and run manual test 15 against it.

To host the page elsewhere, serve the same files at any https address and set `RECEIVER_URL` in `extension/share-config.js` to that address's `import.html`. Name the file, not the folder: a folder address would be redirected, and a redirect carries the fragment along. Links already shared keep pointing at the old address. Setting `RECEIVER_URL` to `null` hides Copy link, QR codes and Share link… in the extension.

To try the page locally, serve the `extension` folder (`python3 -m http.server 8766 --bind 127.0.0.1 --directory extension`, the launch config's `receiving-page` entry) and open `http://127.0.0.1:8766/import.html` with a link's fragment; manual test 15 has one.

## Tests

`npm test` runs the Node tests:

| File | Covers |
|---|---|
| `test/portable.test.js` | Building, serializing and reading charts; round trips of every Astro-Seek fixture and of historical, local-mean-time, half-hour, southern, date-boundary and Unicode charts; refusals of malformed, truncated, corrupted, oversized, newer and invalid input. |
| `test/share.test.js` | `chartToShare` for each popup screen and how its UTC was decided; where Share… is and isn't offered; the receiving page's address. |
| `test/import-model.test.js` | The receiving page's screens, refusals for links and files, Copy link's address, file names and contents, `readChartFile`, the share buttons, QR views. |
| `test/qr.test.js` | QR versions and sizes, error correction, the SVG path against the code's modules, refusal of links too long to scan. |
| `test/site.test.js` | The published file list against what `import.html` loads, and the site build. |

The popup's and screenshot page's own scripts, the extension's Share… flow, and every physical device are covered by manual tests 15 to 18 in `docs/manual-test.md`.

## Remaining limitations

- No physical phone, tablet, camera, share sheet or AirDrop has been used. Manual tests 15 B, 17 and 18 cover them.
- The extension's Share… flow and the popup's Open a chart file haven't run in a browser: the browser pane can't load the extension. Manual tests 16 and 18 A cover them.
- Until the page is deployed, links copied in the extension open a 404.
- Whether a browser's History list keeps a link's `#v1=…` address is unknown.
- The page can be framed by another site (see Security and privacy).
- Dates before 15 October 1582, and unknown or approximate birth times, can't be shared.
