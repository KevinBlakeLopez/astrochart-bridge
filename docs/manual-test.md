# Manual test checklist

`popup.js` talks to the browser and has no automated tests, so run this list in Chrome after changing it. Everything it calls, from `analyzePage` to the view model, is covered by `npm test`.

The chart URLs are the `url` fields of the fixtures in `fixtures/astroseek/`. The asteroids URL is in `docs/astroseek-known-issues.md`.

## Setup

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `extension/` folder.
2. Pin Chart Bridge to the toolbar.
3. For every check below, right-click the popup, choose **Inspect**, and confirm the console shows no errors.

## Checks

- [ ] **New York 2024** (`ny-2024-04-17`): the popup shows
  - Local time `17 Apr 2024, 08:00 (EDT, DST)`, Offset `UTC-04:00`, UTC `2024-04-17 12:00`, Place `40°43'N, 74°0'W`, matching the page header
  - the clock note, then the privacy note, just above **Open sky**
  - **Open sky** opens a tab whose address contains `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`, and the popup closes
- [ ] **Sydney** (`sydney-2024-01-15`): Offset `UTC+11:00`, UTC `2024-01-14 21:00`, Place `33°52'S, 151°12'E`.
- [ ] **New York 1944** (`ny-1944-01-10`): Offset `UTC-04:00`, UTC `1944-01-10 16:00`.
- [ ] **Skipped time** (`ny-2021-03-14-gap`): the contradiction message and two readings.
  - **Open sky** is disabled until a reading is picked.
  - The first reading opens `date=2021-03-14T06%3A30%3A00Z`; the second opens `date=2021-03-14T07%3A30%3A00Z`.
- [ ] **Transit** (`transit-sydney-2026-11-01`): "This is a transit chart. Chart Bridge opens natal charts only." No button.
- [ ] **Compatibility** (`compatibility-sydney-ny`): "This is a synastry or compatibility chart. Chart Bridge opens natal charts only."
- [ ] **Asteroids**: "Open an Astro-Seek birth chart to use Chart Bridge."
- [ ] **Another site** (for example `https://example.com/`): the same sentence, with no error.
- [ ] **A browser page** (`chrome://extensions`): the same sentence, with no error.

## Not covered by hand yet

- **Enter offset**: no real Astro-Seek page has been seen without a Universal Time line, so this screen can't be reached in Chrome yet. `test/popup-model.test.js` covers what it shows and its preview.
