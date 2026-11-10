# Privacy

AstroChart Bridge has no server, no account and no tracking. Its developer receives nothing from it: no charts, no usage counts, no error reports. Everything below happens in your browser, and a chart leaves it only when you click a button that sends it somewhere.

## What it reads

- **The page you're on**, when you click its toolbar button: the chart's birth data on an Astro-Seek or astro.com chart page, with its name and town when the page gives them, or the sky Stellarium Web is showing and the name it gives that place, for astro.com's and Astro-Seek's forms. It reads that one tab, at that moment, and no other. It doesn't read where Stellarium Web has detected you are.
- **A screenshot you choose.** Its text is read on your computer by Tesseract, which is built into the extension. The screenshot isn't uploaded anywhere.
- **Text you paste**, and **chart files you open**: AAF files, Morinus `.hor` files and `.astrochart.json` files. A Morinus file is read without running anything in it.
- **Stellarium Desktop's moment and place**, through its Remote Control plugin at `127.0.0.1` on your own computer, when you import from it, and after a send, to check the values took. An import also reads the name Stellarium gives that place, for astro.com's and Astro-Seek's forms. Once you've allowed `127.0.0.1`, AstroChart Bridge also asks Stellarium whether it's ready each time a screen with the desktop button opens. That request carries no chart and changes nothing.

## What it sends, and when

Only when you click the button for it:

- **Stellarium Web and Astro-Seek** get the chart's moment and place, in the address of the page AstroChart Bridge opens.
- **Stellarium Desktop** gets the moment and place through its Remote Control plugin, at `127.0.0.1` on your own computer.
- **Astro-Seek's Add person form**, when you click Save in Astro-Seek…, gets the chart's date, time and place in its address, and its name when it has one. AstroChart Bridge then types the chart's town into the form's Birth city, which sends it to Astro-Seek's city search, and chooses the match nearest the chart's coordinates. When the chart's file gives a gender, it sets the form's Gender to it, in the page; Astro-Seek gets it only when you press Add person. It never presses Add person or signs you in. To know whether to go on, it reads whether the page's menu links to Astro-Seek's sign-in or sign-out page.
- **astro.com's birth data form** gets the chart's date, time and place, and its town, name and gender when it has them. All of them are on the screen before astro.com opens, and the name can be changed or cleared there. AstroChart Bridge fills the form in but never submits it or signs you in. Once you choose the town, it reads the time zone astro.com picked, to check it against the chart's offset.
- **A shared link, QR code or `.astrochart.json` file** carries the chart's local time, its offset from UTC, the birthplace's latitude and longitude, and a note of where the chart came from, such as the site it was read on. It carries the chart's name and its town only when you tick them on the share page, where both start unticked, and anyone with the link, code or file can then read them. The receiving page reads the chart from the part of the link after `#`, which browsers don't send to the server.
- **Which planets were visible** opens a page of the extension's own in a new tab, with the chart's local time, offset and place, and a note of where the chart came from, but not its name or town, in the part of the page's address after `#`. Swiss Ephemeris, built into the extension, works out the planets on your computer, and the page itself sends nothing. Its **See it in Stellarium Web**, beside a planet, sends Stellarium Web that planet's best moment, the chart's place and the page's elevation, in the address of the page it opens.

Those sites then handle what they receive under their own privacy policies.

## What it keeps

- **Your default sky**, Stellarium Web or Stellarium Desktop, once you choose one. It's kept in the browser's extension storage on this computer, and isn't synced to your browser account.
- **Whether a shared chart includes its name and its town**, once you tick either on the share page, so the next chart you share starts the same way. It's kept like your default sky. The name and town themselves aren't kept. The receiving page on the web keeps nothing, so its boxes always start unticked.
- **A chart it opened astro.com for**: the chart's time, place, town and name, so the form can still be filled in after the popup closes. They're used for 30 minutes at most, and kept in session storage, which the browser empties when it quits.
- **A chart it opened in Astro-Seek** that has a town or a name: the chart's time, place, town and name, so Save in Astro-Seek… in the popup on that tab can fill in the town and name, used only while the tab still shows that chart. They're kept in session storage until the browser quits.
- **The elevation and the limit for under the beams** you last chose when working out which planets were visible, so the next chart starts the same way. They're kept like your default sky. The chart isn't kept.
- **The website's own files**, on the website, once its home page has been opened: a service worker keeps a copy of each of the site's pages and the files they load, so they work offline, and installing the site as an app keeps the same. The copies are kept under their addresses without anything after a `#`, where a chart's link carries the chart, so no chart is kept. Clearing the site's data in the browser removes them.

Nothing else is kept.

## Permissions

- **activeTab** and **scripting**: to read the chart on the page you're on, only when you click the toolbar button.
- **storage**: for the five things it keeps, above.
- **`http://127.0.0.1/*`**, asked for the first time you use Stellarium Desktop.
- **`https://www.astro.com/*`**, asked for the first time you enter a chart in astro.com, to fill in the form in the tab it opens.
- **`https://www.astro-seek.com/*`**, asked for the first time you save a chart in Astro-Seek, to choose the town in the form in the tab it opens, and keep the chart's coordinates and time zone there.

The browser asks you before granting any of the last three, and you can take them back on the browser's extensions page.

Firefox also shows, when you install AstroChart Bridge, that it handles personally identifying information and website content. That's the chart's name and birth data, read from the page you're on, which go only to the sites above and only when you click the button for them, or into a link or file you share when you tick them.

## Questions

Open an issue at <https://github.com/KevinBlakeLopez/astrochart-bridge/issues>. Changes to this page are in the repository's history.
