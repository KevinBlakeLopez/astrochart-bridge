# Ideas: an account's saved charts

Ideas only: none of this is built or planned. Today AstroChart Bridge reads one chart, the one on screen, when its toolbar button is clicked.

## What AstroChart Bridge sees today

- **astro.com:** an account chart page's text lists every chart saved in the account. The extractor therefore takes only the links that contain `pgid=`, and `readPgid` reads just the drawn chart's `nd=` record from the drawing link among them. The chart URL inside that link can also carry the account's second chart slot as `nd2=`, which is never read.
- **Astro-Seek:** the extractor takes the page's whole text, and `readChart` uses only its labelled header lines.

Saved charts are often other people's. A birth date, time and place identifies someone who never used AstroChart Bridge, so reading the list is a privacy decision as much as a feature.

## Ideas, most useful first

1. **A second opinion on civil time.** When the same birth is saved on both sites, compare the two UTCs and warn when they differ: one of them would open the sky at the wrong time. Astro-Seek has already contradicted itself on a skipped hour (`fixtures/astroseek/ny-2021-03-14-gap.json`). Both readings are needed together, so AstroChart Bridge would either remember one chart until the other is opened, as `extension/pending.js` already keeps a chart's UTC and place for astro.com's form, or read a second tab, which needs host permissions the browser asks the user to grant. Match charts by date, time and place, never by name.
2. **Choosing which saved chart to open.** On an account page, pick from the list instead of opening only the chart on screen. The cheapest of the four.
3. **Moving a saved chart between sites.** `astroSeekUrl` already builds an Astro-Seek chart link from a UTC and a place, and an astro.com record holds both: a local time with a stated offset, and coordinates. If the list carries each record, a saved chart could move without being opened first. A file export for desktop Stellarium fits here too.
4. **Two skies side by side.** Possible, but of little use.

## Ground rules if any of these is built

- Read the list only when the toolbar button is clicked, keep it in the popup, and drop it when the popup closes.
- Only the chart chosen leaves the popup. Each open sends that chart's date, time and place to the site it opens, and Stellarium Web's page passes its link on to Google's advertising tags, so never open charts in bulk.
- Never store the list. Idea 1 may remember one chart on the same terms as `pending.js`: session storage, a visible note, Cancel, and 30 minutes at most.
- Add no permissions beyond `activeTab`, `scripting` and `storage` if at all possible.
- Never use real saved charts as fixtures. Capture invented charts instead.

## Not yet known

- What each entry in astro.com's saved-chart list carries: the whole record, or only a link to the chart's page. If only a link, reading a saved chart means opening its page first, as today.
- Whether a signed-in Astro-Seek chart page lists saved charts. If it does, they already reach the popup with the rest of the page's text, though only the header lines are used and nothing is kept.
