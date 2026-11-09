# Store listings

How AstroChart Bridge goes to the Chrome Web Store and to Firefox Add-ons (addons.mozilla.org, AMO), with the text and the answers each store asks for. Safari needs an app signed by Apple instead: see [safari-ipad.md](safari-ipad.md).

## Before the first submission

1. **Turn on GitHub Pages** for the repository, with GitHub Actions as its source, and run the Pages workflow again. Until then a shared link opens a 404, because `extension/share-config.js` points every copied link at `chart.html` there. See [portable-charts.md](portable-charts.md).
2. **Keep the Firefox add-on ID**, `astrochart-bridge@kevinblakelopez.github.io` in `browser_specific_settings.gecko.id`. AMO ties the listing, and every installed copy's updates, to it, so it can't change after the first upload. `test/manifest.test.js` pins it.
3. **Merge to `main`**, run `npm test`, and take the screenshots below.
4. **Make the developer accounts**: one for the Chrome Web Store, and a Firefox account for AMO.

## Packing

```bash
npm run package:stores
```

`tools/package-stores.sh` packs `main`. To pack another commit, pass it: `npm run package:stores -- <commit>`. It writes two files to `build/stores/`:

- `astrochart-bridge-<version>.zip`, the extension with `manifest.json` at its top, which both stores take. It leaves out the paths in `tools/store-leave-out.txt`, which lists none at the moment.
- `astrochart-bridge-<version>-source.zip`, the whole repository at that commit, in case an AMO reviewer asks for the source.

It packs a commit rather than the working tree, so a store gets what was committed and tested. Every upload needs a version the store hasn't had, so raise `version` in `manifest.json` before packing an update.

## Listing text

The same text serves both stores. English is the default listing. Both stores also take a listing per language, so the Spanish and Slovenian ones below go with the interface's two other languages.

**Name:** AstroChart Bridge

**Summary:** the `extDescription` message in `extension/_locales/<language>/messages.json`, which the manifest's `description` names. The Chrome Web Store takes it from there for each language, and `test/manifest.test.js` keeps every language within the store's 132 characters. AMO asks for it in a field of its own:

> Open a natal chart's sky in Stellarium, or the chart in Astro-Seek or astro.com, from a chart page, screenshot, pasted text or file.

**Description:**

> AstroChart Bridge takes the birth data from an astrology chart and opens the same moment and place somewhere else: the sky in Stellarium Web or Stellarium Desktop, the chart in Astro-Seek, or astro.com's birth data form.
>
> It reads a chart from:
> • an Astro-Seek chart page (the birth chart, asteroids chart or traditional chart), or an astro.com chart page, including a chart saved in an astro.com account
> • Stellarium Web, and Stellarium Desktop through its Remote Control plugin
> • a screenshot of a chart from Astro-Seek, astro.com, Solar Fire, Astro Gold, Morinus, Valens, Planetdance, Jagannatha Hora, Kepler, Sirius, Janus, Win*Star, TimePassages or Astrolog, read on your computer
> • text pasted from an astrology program, a chart report, a PDF or your own notes, which you check on a form before anything opens
> • an AAF file, or a Morinus chart file (.hor)
>
> It sends a chart to Stellarium Web or Stellarium Desktop, to Astro-Seek, or to astro.com's birth data form, which it fills in but never submits. With Save in Astro-Seek… it opens Astro-Seek's Add person form with the chart's date, time, place and name filled in and its town chosen, ready to save in your Astro-Seek account. It never presses Add person itself. It can also save the chart as an AAF file, or share it as a link, a QR code or a file that opens on another device without the extension.
>
> Which planets were visible works out, on your computer, whether Mercury, Venus, Mars, Jupiter and Saturn could be seen with the naked eye in the twilight around the chart's moment, with each one's traditional condition (cazimi, combust or under the beams) and side of the Sun. It uses Swiss Ephemeris, built into the extension. Each planet opens in Stellarium Web at its best moment.
>
> It works out the chart's Universal Time from what the source prints, and refuses a chart rather than guess a time, an offset or a calendar. It opens natal charts, plus horary charts from a screenshot. Transit, synastry, compatibility, return, profection and direction charts are refused, as are dates before the Gregorian calendar began on 15 October 1582.
>
> Privacy: there's no server, account or tracking. Charts are read in your browser, and nothing leaves it until you click a button that opens a site. A shared chart carries its name and town only when you tick them. Details: https://github.com/KevinBlakeLopez/astrochart-bridge/blob/main/docs/privacy.md
>
> Its interface is in English, Spanish and Slovenian, following your browser's language.
>
> AstroChart Bridge is free software under the GNU Affero General Public License, version 3 or later. Source: https://github.com/KevinBlakeLopez/astrochart-bridge
>
> AstroChart Bridge isn't affiliated with Astrodienst (astro.com), Astro-Seek, Stellarium, or the makers of the programs it reads.

### Spanish and Slovenian

Add these in each store's listing for that language: Chrome picks the language from a list on the Store listing page, and AMO from **Translations** on the add-on's edit page. The name stays AstroChart Bridge. Each summary is that language's `extDescription`, which Chrome fills in on its own. Have a native speaker read both descriptions before they go live: they were written alongside the interface's translations, and the interface's own wording for its buttons and screens is used here.

**Spanish summary:**

> Abre el cielo de una carta natal en Stellarium, o la carta en Astro-Seek o astro.com, desde una página, captura, texto o archivo.

**Spanish description:**

> AstroChart Bridge toma los datos de nacimiento de una carta astral y abre el mismo momento y lugar en otro sitio: el cielo en Stellarium Web o Stellarium Desktop, la carta en Astro-Seek o el formulario de datos de nacimiento de astro.com.
>
> Lee una carta desde:
> • una página de carta de Astro-Seek (carta natal, carta de asteroides o carta tradicional), o una página de carta de astro.com, incluida una carta guardada en una cuenta de astro.com
> • Stellarium Web, y Stellarium Desktop mediante su complemento Remote Control
> • una captura de pantalla de una carta de Astro-Seek, astro.com, Solar Fire, Astro Gold, Morinus, Valens, Planetdance, Jagannatha Hora, Kepler, Sirius, Janus, Win*Star, TimePassages o Astrolog, leída en tu equipo
> • texto pegado de un programa de astrología, un informe, un PDF o tus propias notas, que revisas en un formulario antes de que se abra nada
> • un archivo AAF o una carta de Morinus (.hor)
>
> Envía una carta a Stellarium Web o Stellarium Desktop, a Astro-Seek o al formulario de datos de nacimiento de astro.com, que rellena pero nunca envía. Con Guardar en Astro-Seek… abre el formulario Add person de Astro-Seek con la fecha, la hora, el lugar y el nombre de la carta ya puestos y su ciudad elegida, listo para guardarla en tu cuenta de Astro-Seek. Nunca pulsa Add person por sí mismo. También puede guardar la carta como archivo AAF, o compartirla como enlace, código QR o archivo que se abre en otro dispositivo sin la extensión.
>
> Qué planetas eran visibles calcula en tu equipo si Mercurio, Venus, Marte, Júpiter y Saturno podían verse a simple vista en el crepúsculo cercano al momento de la carta, con la condición tradicional de cada uno (cazimi, combusto o bajo los rayos) y su lado del Sol. Usa Swiss Ephemeris, incluida en la extensión. Cada planeta se abre en Stellarium Web en su mejor momento.
>
> Calcula el tiempo universal de la carta a partir de lo que muestra la fuente, y rechaza una carta antes que adivinar una hora, un desfase horario o un calendario. Abre cartas natales, y cartas horarias desde una captura de pantalla. Rechaza las cartas de tránsitos, sinastría, compatibilidad, revoluciones, profecciones y direcciones, y las fechas anteriores al 15 de octubre de 1582, cuando empezó el calendario gregoriano.
>
> Privacidad: no hay servidor, cuenta ni seguimiento. Las cartas se leen en tu navegador, y nada sale de él hasta que haces clic en un botón que abre un sitio. Una carta compartida lleva su nombre y su ciudad solo si los marcas. Detalles (en inglés): https://github.com/KevinBlakeLopez/astrochart-bridge/blob/main/docs/privacy.md
>
> La interfaz está en español, inglés y esloveno, según el idioma del navegador.
>
> AstroChart Bridge es software libre bajo la Licencia Pública General Affero de GNU, versión 3 o posterior. Código fuente: https://github.com/KevinBlakeLopez/astrochart-bridge
>
> AstroChart Bridge no está afiliado a Astrodienst (astro.com), Astro-Seek, Stellarium ni a los creadores de los programas que lee.

**Slovenian summary:**

> Nebo rojstnega horoskopa odpre v Stellariumu, horoskop pa na Astro-Seeku ali astro.com. Bere strani, posnetke, besedilo in datoteke.

**Slovenian description:**

> AstroChart Bridge vzame rojstne podatke iz astrološkega horoskopa in isti trenutek in kraj odpre drugje: nebo v Stellarium Web ali Stellarium Desktop, horoskop na Astro-Seeku ali obrazec za rojstne podatke na astro.com.
>
> Horoskop prebere:
> • s strani s horoskopom na Astro-Seeku (rojstni horoskop, horoskop asteroidov ali tradicionalni horoskop) ali na astro.com, tudi horoskop, shranjen v računu na astro.com
> • iz Stellarium Web ter iz Stellarium Desktop prek vtičnika Remote Control
> • s posnetka zaslona horoskopa iz Astro-Seeka, astro.com ali programov Solar Fire, Astro Gold, Morinus, Valens, Planetdance, Jagannatha Hora, Kepler, Sirius, Janus, Win*Star, TimePassages in Astrolog, ki ga prebere na vašem računalniku
> • iz besedila, prilepljenega iz astrološkega programa, poročila, PDF-ja ali vaših zapiskov, ki ga preverite v obrazcu, preden se karkoli odpre
> • iz datoteke AAF ali horoskopa Morinus (.hor)
>
> Horoskop pošlje v Stellarium Web ali Stellarium Desktop, na Astro-Seek ali v obrazec za rojstne podatke na astro.com, ki ga izpolni, nikoli pa ne odda. Z ukazom Shrani na Astro-Seeku … odpre obrazec Add person na Astro-Seeku z že vpisanimi datumom, časom, krajem in imenom horoskopa ter izbranim mestom, tako da ga lahko shranite v svoj račun na Astro-Seeku. Gumba Add person nikoli ne pritisne sam. Horoskop lahko shrani tudi kot datoteko AAF ali ga deli kot povezavo, kodo QR ali datoteko, ki se odpre na drugi napravi brez razširitve.
>
> Kateri planeti so bili vidni na vašem računalniku izračuna, ali so se Merkur, Venera, Mars, Jupiter in Saturn videli s prostim očesom v somraku okoli trenutka horoskopa, skupaj s tradicionalnim stanjem vsakega (kazimi, zgorevanje ali pod žarki) in njegovo stranjo od Sonca. Uporablja Swiss Ephemeris, vgrajen v razširitev. Vsak planet se odpre v Stellarium Web ob svojem najboljšem trenutku.
>
> Univerzalni čas horoskopa izračuna iz tega, kar izpiše vir, in horoskop raje zavrne, kot da bi ugibal čas, časovni zamik ali koledar. Odpira rojstne horoskope, s posnetka zaslona pa tudi horarne. Zavrne horoskope tranzitov, sinastrije, združljivosti, revolucij, profekcij in direkcij ter datume pred 15. oktobrom 1582, ko se je začel gregorijanski koledar.
>
> Zasebnost: ni strežnika, računa ali sledenja. Horoskopi se preberejo v vašem brskalniku in nič ga ne zapusti, dokler ne kliknete gumba, ki odpre spletno mesto. Deljeni horoskop vsebuje ime in mesto samo, če ju označite. Podrobnosti (v angleščini): https://github.com/KevinBlakeLopez/astrochart-bridge/blob/main/docs/privacy.md
>
> Vmesnik je v slovenščini, angleščini in španščini, glede na jezik brskalnika.
>
> AstroChart Bridge je prosto programje pod licenco GNU Affero General Public License, različica 3 ali novejša. Izvorna koda: https://github.com/KevinBlakeLopez/astrochart-bridge
>
> AstroChart Bridge ni povezan z Astrodienstom (astro.com), Astro-Seekom, Stellariumom ali avtorji programov, ki jih bere.

**Links:**

| Field | Value |
|---|---|
| Homepage | https://github.com/KevinBlakeLopez/astrochart-bridge |
| Support | https://github.com/KevinBlakeLopez/astrochart-bridge/issues |
| Privacy policy | https://github.com/KevinBlakeLopez/astrochart-bridge/blob/main/docs/privacy.md |
| Licence | AGPL-3.0-or-later |

## Chrome Web Store

Brave installs from the Chrome Web Store as it is, and Microsoft Edge does once **Allow extensions from other stores** is turned on, so this one listing covers three of the five browsers.

### Store listing

| Field | Value |
|---|---|
| Category | Productivity › Tools |
| Language | English |
| Store icon | `extension/icons/icon-128.png` |
| Screenshots | Up to five of the six below, at 1280 × 800 |
| Small promo tile, 440 × 280 | Optional, but the store shows listings that have one ahead of listings that don't |

### Privacy practices

**Single purpose:**

> Moves an astrology chart's birth moment and place between astrology sites, astrology programs and planetarium software, so the same chart opens in each, and works out which planets could be seen in the sky at that moment.

Its last clause is for Which planets were visible, added on 9 November 2026 when Helioscope's page arrived ([HELIOSCOPE_V1_FEASIBILITY.md](HELIOSCOPE_V1_FEASIBILITY.md), §9).

**Permission justifications:**

| Permission | Justification |
|---|---|
| `activeTab` | Reads the chart on the page the user is viewing, only when they click the toolbar button. |
| `scripting` | Runs the script that reads that chart's birth data from the page, fills in astro.com's birth data form in the tab the extension opens for it, and chooses the town in Astro-Seek's Add person form in the tab it opens for that. |
| `storage` | Keeps the user's choice of Stellarium Web or Stellarium Desktop as the default, whether a chart they share includes its name and town, and the elevation and limit for under the beams they last chose when working out which planets were visible. In session storage, it keeps the chart whose astro.com form it is filling in, for 30 minutes at most, and the town and name of a chart it opened in Astro-Seek, for saving it there, until the browser quits. |
| Host permissions | All three are optional and requested the first time the user needs them. `http://127.0.0.1/*` sends the chart to Stellarium Desktop's Remote Control plugin on the user's own computer. `https://www.astro.com/*` fills in astro.com's birth data form in the tab the extension opens. `https://www.astro-seek.com/*` chooses the town in Astro-Seek's Add person form, and keeps the chart's coordinates and time zone there, in the tab the extension opens to save a chart in the user's Astro-Seek account. |

**Remote code:** No. All of the extension's code is in the package, including the WebAssembly Tesseract uses to read screenshots and the Swiss Ephemeris WebAssembly that works out which planets were visible, which is what `'wasm-unsafe-eval'` in the content security policy is for. Reviewers search a package for web addresses, and Tesseract.js's minified files contain its default jsDelivr addresses. `extension/screenshot.js` replaces all three (`workerPath`, `corePath` and `langPath`) with files in `vendor/tesseract/`, so the defaults are never used. `@kuntay/swisseph`'s `dist/ephemeris/sources.js` names one more, `https://cdn.jsdelivr.net/npm/@kuntay/swisseph-data/ephe`, where its `FetchEphemeris` downloads ephemeris files by default. `extension/helioscope-engine.js` uses the Moshier ephemeris compiled into the WebAssembly and never calls `FetchEphemeris`, so nothing is fetched from it. Say so in the remote-code field if it asks why.

**Data usage:** the store's guidance says to disclose data the extension handles even when it's only processed on the user's device. Tick:

- **Website content**: it reads the chart's text from the page the user is on.
- **Personally identifiable information**: a chart's name and birth data, which go to astro.com's form when the user asks, and into a link or file they share when they tick the name or town.

Leave **Location** unticked: a birthplace's coordinates aren't the user's location. Tick all three certifications. They're true here: nothing is sold, nothing is used outside the single purpose, and nothing is used for creditworthiness or lending.

**Privacy policy URL:** the privacy policy link above. The store requires one whenever an extension handles user data.

### Distribution

| Field | Value |
|---|---|
| Visibility | **Unlisted** while the first testers try it: the listing opens only from its link and doesn't appear in search. Switch to **Public** to announce it. |
| Regions | All regions |

**Trader declaration:** every developer account declares whether it's a trader under EU law, meaning it acts for business or professional purposes. A trader's legal name, address and phone number are verified and shown on the listing. A non-trader's listing tells EU users that consumer-protection rights don't apply. Either way, the publisher name and contact email appear on the listing.

## Firefox Add-ons

| Field | Value |
|---|---|
| Distribution | **On this site** for a public listing. **On your own** signs the zip for you to hand out without a listing. |
| Name, summary, description | The listing text above |
| Licence | AGPL-3.0-or-later |
| Support site | The support link above |
| Privacy policy | The privacy policy link above. A listing needs one when any data leaves the user's device, and the Stellarium Web and Astro-Seek links carry birth data to those sites. |

**Source code:** not needed. AMO asks for source only for code the developer minified, bundled or generated. Unmodified libraries need links instead, in the notes below, and reviewers compare checksums, so the vendored files have to stay byte-identical to their releases.

**Notes to reviewer:**

> There's no build step: the zip is the repository's extension/ folder as committed, loaded as is. The minified and compiled files are unmodified files from these npm releases, as listed in extension/vendor/tesseract/README.md, extension/vendor/lean-qr/README.md and extension/vendor/swisseph/README.md:
> - tesseract.js 5.1.1, dist/tesseract.esm.min.js and dist/worker.min.js, with their .map files: https://www.npmjs.com/package/tesseract.js/v/5.1.1
> - tesseract.js-core 5.1.1, tesseract-core-simd-lstm.wasm.js: https://www.npmjs.com/package/tesseract.js-core/v/5.1.1
> - @tesseract.js-data/eng 1.0.0, 4.0.0_best_int/eng.traineddata.gz: https://www.npmjs.com/package/@tesseract.js-data/eng/v/1.0.0
> - lean-qr 2.7.4, index.mjs: https://www.npmjs.com/package/lean-qr/v/2.7.4
> - @kuntay/swisseph 0.2.2, dist/ and wasm/ (swisseph.mjs and swisseph.wasm): https://www.npmjs.com/package/@kuntay/swisseph/v/0.2.2
>
> The jsDelivr addresses in the Tesseract files are its defaults, which extension/screenshot.js replaces with the packaged files. The one in @kuntay/swisseph's dist/ephemeris/sources.js is where its FetchEphemeris downloads ephemeris files, which extension/helioscope-engine.js never calls: it uses the Moshier ephemeris compiled into the WebAssembly. The source is at https://github.com/KevinBlakeLopez/astrochart-bridge. To try it, open an Astro-Seek birth chart, for example the url in fixtures/astroseek/ny-2024-04-17.json, click the toolbar button, then Which planets were visible.

**Data collection:** declared in `manifest.json`, under `browser_specific_settings.gecko.data_collection_permissions`. Firefox shows it when the extension is installed.

## Screenshots

The Chrome Web Store takes up to five, at 1280 × 800. Every one uses invented birth data.

Four were taken on 2 November 2026 from the store zip of `1d4f178`, loaded into Playwright's Chromium. They're kept in `build/store-screenshots/`, which isn't committed:

1. `1-chart.png`: the chart screen for `fixtures/aaf/astrolog-8.00-new-york.aaf`, opened on the import page, with its See the sky and Take the chart elsewhere buttons.
2. `2-stellarium-web.png`: the night sky Stellarium Web opens for an invented chart, Example Person, 15 June 1985 at 23:30 in Seattle. Stellarium Web's cookie notice was hidden for the picture, not answered.
3. `3-paste.png`: the paste page's form for that chart, with the values to check before anything opens.
4. `4-share.png`: the share page for that chart, with the name and town ticks, the share buttons and its QR code.

Retake them when the screens they show change, before the next upload.

**Still to take by hand: the popup on a chart page.** It's the fifth shot, and the most useful one. The toolbar popup is part of the browser's own window, so a screenshot of a page can't include it, and Astro-Seek's bot check stops automated browsers. In Chrome, with the extension loaded:

1. Open an invented chart: the `url` of a chart in `fixtures/astroseek/`, as in [manual-test.md](manual-test.md).
2. Size the window to 1280 × 800, with nothing personal in its tabs or bookmarks bar.
3. Click the toolbar button, and wait for the ready screen with the chart's clock time and its buttons.
4. Press ⌘⇧4, then Space, and click the window. Check the picture is 1280 × 800 without its shadow (hold ⌥ as you click to leave the shadow out), and crop or resize it if not.

astro.com's filled-in form and the screenshot page weren't taken: the first needs access to www.astro.com granted in the browser, and the second a chart picture to read. With five slots, they aren't needed.
