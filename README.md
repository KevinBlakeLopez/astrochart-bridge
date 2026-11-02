# AstroChart Bridge

AstroChart Bridge is a browser extension that takes the birth data from an astrology chart and opens the same moment and place somewhere else: the sky in Stellarium Web or Stellarium Desktop, the chart in Astro-Seek, or astro.com's birth data form.

It reads a chart from the page you're on, a screenshot, pasted text, an AAF file or a Morinus chart file. It works out the chart's Universal Time from what the source prints and refuses a chart rather than guess a time, an offset or a calendar.

It runs in Chrome, Brave, Microsoft Edge, Firefox 140 or later and Safari 26 or later on macOS. In Safari on iPad it has to be wrapped in an app with Xcode; see [docs/safari-ipad.md](docs/safari-ipad.md).

## What it reads

- **Astro-Seek chart pages:** the birth chart, the asteroids chart and the traditional chart.
- **astro.com chart pages**, including a chart saved in an astro.com account.
- **Stellarium Web**, the sky it's showing, and **Stellarium Desktop**, through its Remote Control plugin.
- **A screenshot** of a chart from Astro-Seek, astro.com, Solar Fire, Astro Gold, Morinus, Valens, Planetdance, Jagannatha Hora, Kepler, Sirius, Janus, Win\*Star, TimePassages or Astrolog. The text is read on your computer with Tesseract.
- **Pasted text** from an astrology program, a chart report, a PDF or your own notes. You check each value on a form before anything opens. See [docs/paste-text.md](docs/paste-text.md).
- **AAF files**, the Astrologisches Austauschformat, as AAF'97 and Astrolog 8.00 write them. See [docs/aaf.md](docs/aaf.md).
- **Morinus chart files** (`.hor`), from every Morinus version, read without running anything in them. See [docs/morinus-hor.md](docs/morinus-hor.md).
- **AstroChart Bridge links, QR codes and `.astrochart.json` files**, on the receiving page. See [docs/portable-charts.md](docs/portable-charts.md).

It opens natal charts, plus horary charts from a screenshot. Transit, synastry, compatibility, return, profection and direction charts are refused, as are dates before 15 October 1582, when the Gregorian calendar began.

## Where it sends a chart

- **Stellarium Web**, with **Open Stellarium Web**.
- **Stellarium Desktop**, at `127.0.0.1` on your computer. See [docs/stellarium-desktop.md](docs/stellarium-desktop.md) for turning on the Remote Control plugin.
- **Astro-Seek**, with **Open chart in Astro-Seek**.
- **astro.com's birth data form**, with **Enter in astro.com…**. AstroChart Bridge fills in the form, with the chart's town and name when it has them, but never submits it or signs you in. A chart's local time goes in with astro.com's automatic time zone, and once you choose the town AstroChart Bridge checks the zone astro.com picks against the chart's offset, offering Universal Time on the page if they differ.
- **An AAF file**, with **Save as AAF file**.
- **Another device**, with **Share…**: a link, a QR code of the link, a `.astrochart.json` file or the system's share sheet. The receiving page, `chart.html`, opens the chart without the extension.

## Privacy

There is no server, account or tracking. Charts are read in the browser, and nothing leaves your computer until you click a button that opens a site, which then gets only the chart's moment and place. astro.com's form also gets the chart's town and name, both shown on the screen before it opens, where the name can be changed or cleared. A shared chart travels inside its link or file, which never carries a name.

The extension asks for `activeTab`, `scripting` and `storage`. It asks for three more only when a feature needs them, and the browser asks you first: `127.0.0.1`, to talk to Stellarium Desktop, `www.astro.com`, to fill in astro.com's form as it opens, and `www.astro-seek.com`, to choose the town in Astro-Seek's form when saving a chart there.

[docs/privacy.md](docs/privacy.md) has the details. It's the privacy policy the store listings link to.

## Installing for development

The extension isn't packaged for any store. Load the `extension` folder as an unpacked extension:

- **Chrome, Brave, Edge:** on the extensions page (`chrome://extensions`, `brave://extensions`, `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and select `extension`.
- **Firefox:** at `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and select `extension/manifest.json`. Firefox removes it when it quits.
- **Safari on macOS:** turn on **Allow unsigned extensions** in Safari's developer settings, then **Add Temporary Extension…** and select `extension`. Safari removes it after 24 hours or when it quits.

[docs/manual-test.md](docs/manual-test.md) has the step-by-step setup for each browser.

## Development

There are no dependencies to install. The tests need Node; CI runs them on Node 24.

```bash
npm test
```

`popup.js` talks to the browser and has no automated tests. After changing it, run the checklist in [docs/manual-test.md](docs/manual-test.md) in each browser.

### Layout

| Path | What's there |
|---|---|
| `extension/` | The extension, loaded as is. `manifest.json`, the popup, and the screenshot, paste, import and receiving pages, each with a view model (`*-model.js`) that the tests cover. |
| `extension/core/` | Reading and converting charts, with no browser APIs: one module per site or program, civil time, sidereal time, AAF and the portable chart format. |
| `extension/vendor/` | Tesseract.js for reading screenshots and lean-qr for QR codes, each with its licence. |
| `test/` | `node --test` tests. |
| `fixtures/` | Astro-Seek page captures, trimmed to their header block, and AAF files written by Astrolog. All use invented birth data. |
| `tools/` | `package-safari.sh` makes the Xcode project for Safari; `package-stores.sh` packs a commit for the Chrome Web Store and Firefox Add-ons; `site.mjs` builds the receiving page's site; `make-icons.mjs` draws the icons; `trim-fixture.mjs` trims a new Astro-Seek capture before it's committed. |
| `docs/` | Feature guides, the manual test checklist and notes on known issues. |

### Receiving page

Pushes to `main` run `.github/workflows/pages.yml`, which runs the tests and publishes `chart.html` and the files it loads to GitHub Pages. [docs/portable-charts.md](docs/portable-charts.md) covers deploying it.

## Documentation

- [docs/aaf.md](docs/aaf.md): opening and saving AAF files
- [docs/paste-text.md](docs/paste-text.md): reading pasted chart text
- [docs/stellarium-desktop.md](docs/stellarium-desktop.md): sending to and importing from Stellarium Desktop
- [docs/portable-charts.md](docs/portable-charts.md): links, QR codes, chart files and the receiving page
- [docs/safari-ipad.md](docs/safari-ipad.md): building for Safari on iPad
- [docs/store-listing.md](docs/store-listing.md): submitting to the Chrome Web Store and Firefox Add-ons
- [docs/privacy.md](docs/privacy.md): what AstroChart Bridge reads, sends and keeps
- [docs/manual-test.md](docs/manual-test.md): the manual test checklist
- [docs/astroseek-known-issues.md](docs/astroseek-known-issues.md): Astro-Seek behaviour worked around or to report
- [docs/saved-charts-ideas.md](docs/saved-charts-ideas.md): ideas, not planned, for an account's saved charts

## Licence

Copyright © 2026 Kevin Blake Lopez.

AstroChart Bridge is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. The full text is in [LICENSE](LICENSE).

The files in `extension/vendor/` keep their own licences, which sit beside them: Apache-2.0 for Tesseract.js and MIT for lean-qr. The captures in `fixtures/astroseek/` are text from Astro-Seek's pages, kept as test input.
