# Manual test checklist

`popup.js` talks to the browser and has no automated tests, so run this list in Chrome, Brave, Microsoft Edge, Firefox and Safari after changing it, and test 18 in Safari on an iPad. Everything it calls, from `analyzePage` to the view model, is covered by `npm test`.

The chart URLs below are the `url` fields of the fixtures in `fixtures/astroseek/`, plus the asteroids example from `docs/astroseek-known-issues.md`. All of them use invented birth data.

Natal charts are read from three Astro-Seek pages: the birth chart (`/calculate-birth-chart-horoscope-online/`, tests 1 to 4), the asteroids chart (`/calculate-asteroids/`, test 7) and the traditional chart (`/calculate-traditional-chart/`, test 11).

## Setup (once per browser)

### Chrome

1. Go to `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked**. Press **Cmd+Shift+G**, paste the path to this repo's `extension` folder (for example `/Users/you/code/astrochart-bridge/extension`), press Return and click **Select**. The folder you select must contain `manifest.json`.
3. Click the puzzle-piece icon in Chrome's toolbar and click the pin next to **AstroChart Bridge**, so its icon stays in the toolbar.

After changing any file in `extension/`, click the reload arrow on the AstroChart Bridge card in `chrome://extensions` before testing again.

### Brave

Brave's extensions page is the same as Chrome's. Follow the Chrome steps above at `brave://extensions`, and reload from there too.

### Edge

1. Go to `edge://extensions` and turn on **Developer mode** (in the panel on the left).
2. Click **Load unpacked** and select the same `extension` folder as in Chrome's step 2.
3. Click the Extensions icon (a puzzle piece) in Edge's toolbar and click the eye icon next to **AstroChart Bridge** (**Show in toolbar**), so its icon stays in the toolbar.

After changing any file in `extension/`, click **Reload** on the AstroChart Bridge card in `edge://extensions` before testing again.

### Firefox

AstroChart Bridge needs Firefox 140 or later.

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**. Press **Cmd+Shift+G**, paste the path to the same `extension` folder, press Return, select `manifest.json` inside it and click **Open**. Firefox asks for a file in the folder, not the folder itself.
3. Click the Extensions button (a puzzle piece) in Firefox's toolbar, click the gear next to **AstroChart Bridge** and choose **Pin to Toolbar**.

Firefox removes a temporary add-on when it quits, so load it again after restarting Firefox. After changing any file in `extension/`, click **Reload** on the AstroChart Bridge card in `about:debugging` before testing again.

### Safari

AstroChart Bridge needs Safari 26 or later on macOS.

1. Choose **Safari → Settings**, select the **Advanced** tab and check **Show features for web developers**.
2. Select the **Developer** tab and check **Allow unsigned extensions**. Safari asks for your Mac password.
3. On the same tab, click **Add Temporary Extension…**, select the same `extension` folder and click **Select**. Safari switches to the **Extensions** tab and lists AstroChart Bridge under **Temporary**.
4. Check the box next to **AstroChart Bridge** if it isn't checked, and close Settings. Its icon appears in Safari's toolbar.

The first time you click the icon on a site, Safari may ask whether AstroChart Bridge can see that page. Allow it for that site.

Safari removes a temporary extension after 24 hours or when it quits, and turns **Allow unsigned extensions** off when it quits, so repeat steps 2 to 4 after restarting Safari. After changing any file in `extension/`, click **Reload** next to AstroChart Bridge in the **Extensions** tab before testing again.

### Safari on iPad

Follow `docs/safari-ipad.md` to build the app with Xcode and install it on the iPad, then run test 18. After changing any file in `extension/`, run the app from Xcode again before testing.

## For every test

1. Open the test's URL in a new tab and wait for the page to finish loading.
2. Click the AstroChart Bridge icon in the toolbar. A small popup opens.
3. Right-click inside the popup, choose **Inspect**, and open the **Console** tab. It must stay empty. While DevTools is open the popup stays open too, which makes it easier to read.

   In Firefox, click **Inspect** on the AstroChart Bridge card in `about:debugging` instead. In the toolbox that opens, choose **Disable Popup Auto-Hide** from the **⋯** menu at the top right, open the popup, then pick `popup.html` with the frame-picker button next to that menu. The Console must stay empty.

   In Safari, right-click inside the popup and choose **Inspect Element**. Web Inspector opens on the popup; open its **Console** tab. It must stay empty.

## Test 1: New York 2024

```
https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024&narozeni_hodina=08&narozeni_minuta=00&narozeni_sekunda=00&narozeni_city=New+York%2C+USA%2C+New+York&narozeni_mesto_hidden=New+York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_vertex=1&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0#tabs_redraw
```

- [ ] The popup shows Local time `17 Apr 2024, 08:00 (EDT, DST)`, Offset `UTC-04:00`, UTC `2024-04-17 12:00` and Place `40°43'N, 74°0'W`.
- [ ] Below them are two grey notes, the one about Google last, then a blue **Open Stellarium Web** button and an outlined **Share…** button (test 20).
- [ ] The first note names the time Stellarium's clock will show in your computer's time zone, and says that's 08:00 on 17 Apr at the birthplace. On a Mac set to Pacific time it says 05:00 on 17 Apr.
- [ ] After **Open Stellarium Web**, Stellarium's clock (bottom right) shows the time the note named, give or take the seconds it has been running.
- [ ] Clicking **Open Stellarium Web** opens a Stellarium Web tab and closes the popup. The new tab's address contains `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`.

## Test 2: Sydney

```
https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=15&narozeni_mesic=1&narozeni_rok=2024&narozeni_hodina=08&narozeni_minuta=00&narozeni_sekunda=00&narozeni_city=Sydney%2C+Australia%2C+NSW&narozeni_mesto_hidden=Sydney&narozeni_stat_hidden=AU&narozeni_podstat_kratky_hidden=NSW&narozeni_tzid_id=306&narozeni_sirka_stupne=33&narozeni_sirka_minuty=52&narozeni_sirka_smer=1&narozeni_delka_stupne=151&narozeni_delka_minuty=12&narozeni_delka_smer=0&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_vertex=1&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0&zmena_nastaveni=1&aktivni_tab=&hide_aspects=0&dominanta_metoda=1&dominanta_rulership=1#tabs_redraw
```

- [ ] The popup shows Offset `UTC+11:00`, UTC `2024-01-14 21:00` (the day before the local date) and Place `33°52'S, 151°12'E`.

## Test 3: New York 1944

```
https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=10&narozeni_mesic=1&narozeni_rok=1944&narozeni_hodina=12&narozeni_minuta=00&narozeni_sekunda=00&narozeni_city=New+York%2C+USA%2C+New+York&narozeni_mesto_hidden=New+York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_vertex=1&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0&zmena_nastaveni=1&aktivni_tab=&hide_aspects=0&dominanta_metoda=1&dominanta_rulership=1#tabs_redraw
```

- [ ] The popup shows Offset `UTC-04:00` (War Time, even in January) and UTC `1944-01-10 16:00`.

## Test 4: a skipped time

```
https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=14&narozeni_mesic=3&narozeni_rok=2021&narozeni_hodina=02&narozeni_minuta=30&narozeni_sekunda=00&narozeni_city=New+York%2C+USA%2C+New+York&narozeni_mesto_hidden=New+York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_vertex=1&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0&zmena_nastaveni=1&aktivni_tab=&hide_aspects=0&dominanta_metoda=1&dominanta_rulership=1#tabs_redraw
```

- [ ] The popup shows "Astro-Seek's page contradicts itself…", two readings with round buttons, and faded **Open Stellarium Web** and **Share…** buttons.
- [ ] Clicking the faded **Open Stellarium Web** does nothing.
- [ ] Pick the first reading (06:30) and click **Open Stellarium Web**. The new tab's address contains `date=2021-03-14T06%3A30%3A00Z`.
- [ ] Go back to the chart tab, open the popup again, pick the second reading (07:30) and click **Open Stellarium Web**. The new tab's address contains `date=2021-03-14T07%3A30%3A00Z`.

## Test 5: a transit page

```
https://horoscopes.astro-seek.com/calculate-transit-chart/?muz_narozeni_den=15&muz_narozeni_mesic=1&muz_narozeni_rok=2024&muz_narozeni_hodina=08&muz_narozeni_minuta=00&muz_narozeni_mesto_hidden=Sydney&muz_narozeni_stat_hidden=AU&muz_narozeni_podstat_kratky_hidden=NSW&muz_narozeni_tzid_id=306&muz_narozeni_city=Sydney,%20Australia,%20NSW&muz_narozeni_sirka_stupne=33&muz_narozeni_sirka_minuty=52&muz_narozeni_sirka_smer=1&muz_narozeni_delka_stupne=151&muz_narozeni_delka_minuty=12&muz_narozeni_delka_smer=0&muz_narozeni_timezone_form=auto&muz_narozeni_timezone_dst_form=auto&zena_narozeni_den=1&zena_narozeni_mesic=11&zena_narozeni_rok=2026&zena_narozeni_hodina=06&zena_narozeni_minuta=57&zena_narozeni_mesto_hidden=Sydney&zena_narozeni_stat_hidden=AU&zena_narozeni_podstat_kratky_hidden=NSW&zena_narozeni_tzid_id=&zena_narozeni_city=Sydney,%20Australia,%20NSW&zena_narozeni_sirka_stupne=33&zena_narozeni_sirka_minuty=52&zena_narozeni_sirka_smer=1&zena_narozeni_delka_stupne=151&zena_narozeni_delka_minuty=12&zena_narozeni_delka_smer=0&zena_narozeni_timezone_form=auto&zena_narozeni_timezone_dst_form=auto&house_system=placidus&styl_graf=&hid_fortune=on&hid_fortune_check=&hid_vertex=on&hid_vertex_check=&hid_chiron=&hid_chiron_check=on&hid_lilith=&hid_lilith_check=on&hid_uzel=&hid_uzel_check=on&aya=&nick=&hide_aspects=0&rocni_pohyb=1&&orb2=3
```

- [ ] The popup shows only "This is a transit chart. AstroChart Bridge opens natal charts only." There is no button.

## Test 6: a compatibility page

```
https://horoscopes.astro-seek.com/calculate-love-compatibility/?send_calculation=1&muz_narozeni_den=15&muz_narozeni_mesic=1&muz_narozeni_rok=1970&muz_narozeni_hodina=08&muz_narozeni_minuta=00&muz_narozeni_city=Sydney%2C+Australia%2C+NSW&muz_narozeni_mesto_hidden=Sydney&muz_narozeni_stat_hidden=AU&muz_narozeni_podstat_kratky_hidden=NSW&muz_narozeni_tzid_id=306&muz_narozeni_sirka_stupne=33&muz_narozeni_sirka_minuty=52&muz_narozeni_sirka_smer=1&muz_narozeni_delka_stupne=151&muz_narozeni_delka_minuty=12&muz_narozeni_delka_smer=0&muz_narozeni_timezone_form=auto&muz_narozeni_timezone_dst_form=auto&send_calculation=1&zena_narozeni_den=17&zena_narozeni_mesic=4&zena_narozeni_rok=2024&zena_narozeni_hodina=08&zena_narozeni_minuta=00&zena_narozeni_city=New+York%2C+USA%2C+New+York&zena_narozeni_mesto_hidden=New+York&zena_narozeni_stat_hidden=US&zena_narozeni_podstat_kratky_hidden=NY&zena_narozeni_tzid_id=0&zena_narozeni_sirka_stupne=40&zena_narozeni_sirka_minuty=43&zena_narozeni_sirka_smer=0&zena_narozeni_delka_stupne=74&zena_narozeni_delka_minuty=0&zena_narozeni_delka_smer=1&zena_narozeni_timezone_form=auto&zena_narozeni_timezone_dst_form=auto&switch_interpretations=3&house_system=placidus&hid_fortune=1&hid_vertex=1&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&uhel_orbis=&hide_aspects=0&zmena_nastaveni=1&aktivni_tab=#tabs_redraw
```

- [ ] The popup shows only "This is a synastry or compatibility chart. AstroChart Bridge opens natal charts only."

## Test 7: an asteroids page

```
https://horoscopes.astro-seek.com/calculate-asteroids/?narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024&narozeni_hodina=08&narozeni_minuta=00&narozeni_sekunda=00&narozeni_mesto_hidden=New%20York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_city=New%20York,%20USA,%20New%20York&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&styl_graf=&hid_fortune=on&hid_fortune_check=&hid_spirit=&hid_spirit_check=on&hid_syzygy=&hid_syzygy_check=on&hid_vertex=on&hid_vertex_check=&hid_chiron=&hid_chiron_check=on&hid_lilith=&hid_lilith_check=on&hid_uzel=&hid_uzel_check=on&tolerance=1&tolerance_paral=0&nick=&hide_aspects=0&duha=&hide_trans=&display_trans=&aya=&house_start=&naksha_posun=&naksha_nasobek=&custom_aya=&&&radix=1&aktivni_tab=1&ast_symbol=text&asteroidy_ukazat=1
```

- [ ] The popup shows the same rows and notes as test 1, and **Open Stellarium Web** opens an address containing `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`.

## Test 8: another website

Go to `https://example.com`.

- [ ] The popup shows "Open an Astro-Seek or astro.com birth chart to use AstroChart Bridge." and five buttons in two groups: under "Read a chart you have", **Read a screenshot**, **Paste chart text**, **Open an AAF or Morinus file** and **Open an AstroChart Bridge file**; under "Or use the sky in Stellarium Desktop", **Import from Stellarium Desktop**. The Console has no errors. Until AstroChart Bridge has been allowed to connect to `127.0.0.1` (test 17), nothing connects there and no grey line follows the last button.
- [ ] Go to `https://www.astro.com/astro-databank/Stallone,_Sylvester`. The popup shows "Astro-Databank charts aren't supported yet…" and the same five buttons. A transit or compatibility page (tests 5 and 6) still shows none.
- [ ] AstroChart Bridge's toolbar button shows its icon, a gold star above a blue arch, and AstroChart Bridge's card on the browser's extensions page shows it too.

## Test 9: a browser page

Go to `chrome://extensions` in Chrome, `brave://extensions` in Brave, `edge://extensions` in Edge, or `about:debugging` in Firefox. In Safari, open a new tab (**Cmd+T**) and leave it on the Start Page.

- [ ] The popup shows the same sentence and buttons as test 8, and the Console has no errors.

## Test 10: light and dark mode

Switch the Mac's appearance (System Settings → Appearance) and reopen the popup on test 1.

- [ ] In both modes the text is readable and the **Open Stellarium Web** button has clear contrast.

## Test 11: traditional charts

Traditional chart pages print times with seconds. They should behave exactly like the natal pages in tests 1 and 4.

New York 2024:

```
https://horoscopes.astro-seek.com/calculate-traditional-chart/?narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024&narozeni_hodina=08&narozeni_minuta=00&narozeni_sekunda=00&narozeni_mesto_hidden=New%20York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_city=New%20York,%20USA,%20New%20York&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&styl_graf=&hid_fortune=on&hid_fortune_check=&hid_spirit=&hid_spirit_check=on&hid_syzygy=&hid_syzygy_check=on&hid_vertex=on&hid_vertex_check=&hid_chiron=&hid_chiron_check=on&hid_lilith=&hid_lilith_check=on&hid_uzel=&hid_uzel_check=on&tolerance=1&tolerance_paral=0&nick=&hide_aspects=0&duha=&hide_trans=&display_trans=&aya=&house_start=&naksha_posun=&naksha_nasobek=&custom_aya=&&radix=1&aktivni_tab=1&house_system=whole_horizon&terms=
```

- [ ] The popup shows the same rows and notes as test 1, and **Open Stellarium Web** opens an address containing `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`.

The skipped time:

```
https://horoscopes.astro-seek.com/calculate-traditional-chart/?narozeni_den=14&narozeni_mesic=3&narozeni_rok=2021&narozeni_hodina=02&narozeni_minuta=30&narozeni_sekunda=00&narozeni_mesto_hidden=New%20York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_city=New%20York,%20USA,%20New%20York&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&styl_graf=&hid_fortune=on&hid_fortune_check=&hid_spirit=&hid_spirit_check=on&hid_syzygy=&hid_syzygy_check=on&hid_vertex=on&hid_vertex_check=&hid_chiron=&hid_chiron_check=on&hid_lilith=&hid_lilith_check=on&hid_uzel=&hid_uzel_check=on&tolerance=1&tolerance_paral=0&nick=&hide_aspects=0&duha=&hide_trans=&display_trans=&aya=&house_start=&naksha_posun=&naksha_nasobek=&custom_aya=&&radix=1&aktivni_tab=1&house_system=whole_horizon&terms=
```

- [ ] The popup shows the same contradiction message and two readings as test 4, and each reading opens the same `date=` as there.

## Test 12: from Stellarium Web back to Astro-Seek

Open this Stellarium Web link (New York, 17 April 2024, 12:00 UTC) and pause its clock with the pause button in the time panel:

```
https://stellarium-web.org/?date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74
```

- [ ] The popup shows Stellarium time matching Stellarium's own clock (05:00 on 17 Apr 2024 on a Mac set to Pacific time), UTC `2024-04-17 12:00` and Place `40°43'N, 74°0'W`, two grey notes, and an **Open chart in Astro-Seek** button.
- [ ] **Open chart in Astro-Seek** opens an Astro-Seek birth chart whose header shows `17 Apr 2024 - 12:00  (Manually: GMT+00:00)`, Universal Time `17 Apr 2024 - 12:00` and `40°43'N, 74°0'W`.
- [ ] On that Astro-Seek chart, the popup shows UTC `2024-04-17 12:00` and the same place, so the round trip comes back to the same sky.
- [ ] Back on the Stellarium tab, change the time (for example the hour arrow in the time panel) and reopen the popup. It shows the new time, not the time in the address bar.

## Test 13: a screenshot

The screenshot page reads the image on this computer with the Tesseract.js files in `extension/vendor/tesseract/`. These steps check what only the installed extension can show: its script policy allows the WebAssembly, and nothing is fetched from the web.

1. Open the test 1 URL. Press **Cmd+Ctrl+Shift+4** and drag over everything from **Date of Birth** down into the chart. This copies the screenshot instead of saving a file.
2. Open a tab on another website, click the AstroChart Bridge icon, then **Read a screenshot**. An AstroChart Bridge tab opens and the popup closes.
3. In that tab, open DevTools (**Cmd+Option+I**) on the **Network** tab, then reload the page.
4. Press **Cmd+V**.

- [ ] Within a few seconds the page shows the same rows as test 1. The first grey note says to compare the rows with the screenshot.
- [ ] The Console is empty, and every request in the Network tab is a `chrome-extension://` address (`moz-extension://` in Firefox, `safari-web-extension://` in Safari).
- [ ] **What AstroChart Bridge read** opens to show the text read from the screenshot.
- [ ] **Open Stellarium Web** opens a Stellarium Web tab whose address contains `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`, and the screenshot tab stays open.
- [ ] Below it is **Open chart in Astro-Seek**, and the last two grey notes say Astro-Seek will draw the chart in UT/GMT with no city, and that opening it sends the date, time and place to astro-seek.com.
- [ ] **Open chart in Astro-Seek** opens the same chart as test 12: its header shows `17 Apr 2024 - 12:00  (Manually: GMT+00:00)`, Universal Time `17 Apr 2024 - 12:00` and `40°43'N, 74°0'W`.
- [ ] Save the same screenshot as a file (**Cmd+Shift+4**). Dropping it onto the page and choosing it with **Choose File** give the same result.
- [ ] Open the file in Preview, use **Tools → Adjust Size** to halve its width, and save. Dropping it gives the same result.
- [ ] A screenshot of only the chart wheel shows "AstroChart Bridge couldn't find the birth data in this screenshot…" and `Code: unreadable-screenshot`.
- [ ] In light and dark mode the page is readable, like the popup in test 10.
- [ ] Open a chart drawing on astro.com and paste a screenshot of the whole drawing. The rows show the header's local date and time, its Univ.Time as UTC, and its coordinates. There is no zone label in the Local time row, and the page offers **Open Stellarium Web** and **Open chart in Astro-Seek**.

## Test 14: entering a chart in astro.com

AstroChart Bridge keeps a chart's values for the astro.com tab it opens, for 30 minutes. With access to www.astro.com, asked for the first time **Open astro.com's form** is clicked, it fills in the form as it opens. Without it, it fills in the form when you click its icon on that tab. It never submits the form or signs you in. It can only tell that a browser is signed out (astro.com's menu says "Hello [not logged in]"); any other page counts as unknown and is never held up. Run part A in a browser profile that isn't signed in to astro.com, and part B, if you have an astro.com account, in one that is. Never type a real birth date into astro.com for this test, and don't submit the form in part A.

If AstroChart Bridge already has access to www.astro.com, remove it first, as in test 17 step 2.

### A: signed out

Open the test 1 URL and open the popup.

- [ ] Below **Open Stellarium Web** and **Share…** is **Enter in astro.com…**. On an astro.com account chart, if you have one, it isn't there.
- [ ] **Enter in astro.com…** replaces the popup's screen with Birthday `17 April 2024`, Hour, min `08:00`, Time zone `automatic time zone, the form's default`, Offset `UTC-04:00`, Place `40°43'N, 74°0'W` and Town `New York`; "AstroChart Bridge opens astro.com's form and fills it in as it opens…"; empty **First name** and **Last name** boxes, each with its label to its left; six grey notes (the first saying the time zone should be 4 h west (UTC-04:00) and that AstroChart Bridge checks it on the page, the second that it fills in the town New York, the third about the name boxes, the last about the browser asking for access); the buttons **Open astro.com's form**, **Sign in** and **Create account**; and **Cancel**.
- [ ] **Cancel** brings back the test 1 screen.
- [ ] **Open astro.com's form** makes the browser ask whether AstroChart Bridge may read and change www.astro.com. Note whether the popup stays open while it asks, in each browser. Click **Deny**: no tab opens, and the popup says "AstroChart Bridge can't fill in the form without access to www.astro.com.", shows the same six rows, the grey note about checking the time zone, the grey note "After the astro.com tab opens, click the AstroChart Bridge icon in the toolbar again to fill in the form." and one **Open astro.com's form** button.
- [ ] That button opens `https://www.astro.com/cgi/ade.cgi`, "Step 1: Birth Data Entry", in a new tab and closes the popup, without asking again. Open the popup on that tab: it shows **Sign in to astro.com**, the same six rows, "astro.com requires an account to generate charts…", and **Sign in**, **Create account**, **Fill in anyway** and **Cancel**. Its Console is empty. Close the tab.
- [ ] Back on the test 1 popup, **Enter in astro.com…**, **Open astro.com's form**, and this time allow it. The popup says "Opening astro.com's form to fill it in…" while a tab opens behind it, then shows **Sign in to astro.com** as above, with the form's tab still behind it.
- [ ] **Fill in anyway** brings the form's tab to the front and closes the popup. The form shows birthday `17` `April` `2024`, hour `8 [am]`, min `00`, the extended settings open with time zone `automatic time zone`, and birth town `New York, NY (US) = New York, 40n43, 74w00`, chosen from astro.com's list, and nothing else changed. Under the town a grey box says "AstroChart Bridge: chose "New York, NY (US) = New York, 40n43, 74w00" from astro.com's list, less than 1 km from the chart's coordinates." with **Choose another**. If astro.com's privacy dialog covers the page, the form is filled in behind it.
- [ ] The extended settings show "time zone: 4 h west, Daylight Saving T." and no AstroChart Bridge box under the time zone.
- [ ] Click **Choose another**: the box goes, the town is `New York` again with the cursor in it, and astro.com lists its matches. Choose `New York, NY (US) = New York, 40n43, 74w00`.
- [ ] Fill in a chart whose town is `Manhattan` at 40°43'N, 74°0'W, for example from the paste page. A red box under the town says more than one of astro.com's matches for "Manhattan" is within 25 km of the chart's coordinates, and astro.com's list closed so the box shows, with a button for each, nearest first: `New York, NY (US) = New York, 40n43, 74w00 (less than 1 km)` and `New York City, …` first. Click the New York City one: the town becomes that match, the time zone line shows 4 h west, and the box turns grey and says it chose it.
- [ ] Fill in a chart whose town is `London` at 40°43'N, 74°0'W. A red box says none of astro.com's matches for "London" is within 25 km of the chart's coordinates, with **List the matches again**, and astro.com's list is closed so the box shows. **List the matches again** makes the box go and astro.com list its matches. Fill it in again and type in the town field instead: the box goes.
- [ ] Retype the town as `London` and choose the first match, `London (Conecuh County), AL (US)`. astro.com shows "5 h west", and under the time zone row a box says "AstroChart Bridge: this chart is 4 h west of Universal Time, but astro.com's automatic time zone for this town is 5 h west. Check that the town is right. If it is, enter the chart in Universal Time instead." with **Enter in Universal Time**. The time zone select stays beside its label. Choose New York, NY again: the box goes.
- [ ] Choose the Alabama London again and click **Enter in Universal Time**. The hour becomes `12 [noon]`, min `00` and the time zone `00:00 GMT / UT`; astro.com shows its warning about manual time zone settings, and the box says AstroChart Bridge entered 2024-04-17 12:00 with the 00:00 GMT / UT time zone. Choosing other towns changes nothing in the box after that.
- [ ] Reload the form, fill it in again from test 1, then change the hour to `9` before choosing the Alabama London: no box appears, since the time is now yours. The Console is empty throughout.
- [ ] Open the popup on that tab again. It shows "Open an Astro-Seek or astro.com birth chart…": the values were forgotten once filled in.
- [ ] Back on the test 1 tab, open **Enter in astro.com…** and **Open astro.com's form** again, and choose **Sign in** on the popup's sign-in screen. The form's tab comes to the front on astro.com's "My Astro – Login" page. Don't sign in. Open the popup there: it shows "AstroChart Bridge is keeping these values for this tab." with **Open astro.com's form** and **Cancel**, and nothing opens or reloads by itself. **Open astro.com's form** loads the form in this tab. On the form, type `1` in the birthday's day field, then open the popup: it says the form already has a date or time in it and offers **Open a blank form**, which reloads the form in the same tab. Open the popup again: it offers to fill in. Type `Brooklyn` in the birth town and click **Fill in anyway**: the date and time are filled in and the town stays `Brooklyn`.
- [ ] From the test 1 popup, **Open astro.com's form** again and choose **Cancel** on the sign-in screen. The form's tab comes to the front, unfilled, and the popup closes. Opening the popup on that tab shows "Open an Astro-Seek or astro.com birth chart…".
- [ ] From the test 1 popup, **Enter in astro.com…**, type `Example` in **First name** and `Person` in **Last name**, then **Open astro.com's form** and **Fill in anyway**. The form's first name is `Example` and its last name `Person`. Typing more than 40 characters in either box stops at 40.
- [ ] Again from test 1, type `  Sam ` in **First name** only, **Open astro.com's form**, then type `Lee` in the form's last name before opening the popup on that tab. The popup's rows show First name `Sam`, with no Last name row and no spaces. **Fill in anyway** fills in the date and time, the first name `Sam`, and leaves the last name `Lee`.
- [ ] Open the form from the test 1 popup, then from the test 2 (Sydney) popup. Each astro.com tab's popup shows its own chart's values: Birthday `17 April 2024` and Offset `UTC-04:00` on the first, `15 January 2024` and Offset `UTC+11:00` on the second.
- [ ] Open the form from the test 1 popup, wait 30 minutes, then open the popup on it: it shows "Open an Astro-Seek or astro.com birth chart…".
- [ ] Open the test 12 Stellarium link and **Enter in astro.com…**: there is no Town row, Hour, min is `12:00` with Time zone `00:00 GMT / UT…` and no Offset row (a Stellarium sky has no local time), the first note says the date and time are Universal Time, the second says to choose the town nearest this place, and the filled-in form leaves the birth town empty and shows no AstroChart Bridge box whatever town is chosen.
- [ ] Open an astro.com chart in Astro-Seek with **Open chart in Astro-Seek**, then **Enter in astro.com…** from that Astro-Seek page. Its time was entered in UT and its address names no town, so there is no Town row, Time zone is `automatic time zone, the form's default` and Offset `UTC+00:00`, and the note says the zone should be GMT/UT. On the filled-in form, choose a town outside GMT such as `New York, NY`: the box under the time zone says "this chart is at Universal Time, but astro.com's automatic time zone for this town is 4 h west" (or 5 h west in winter), and **Enter in Universal Time** enters the same hour with `00:00 GMT / UT`.
- [ ] On the screenshot page from test 13, **Enter in astro.com…** and **Open astro.com's form** open the form in a tab behind the page, which then says "astro.com's form is open, but something needs your choice first, such as signing in." with **Go to the astro.com tab**. On that tab, the popup offers to fill in the same values.
- [ ] Turn off the Mac's Wi-Fi, then **Open astro.com's form** from the test 1 popup. Within about 20 seconds the popup says "astro.com's form didn't finish opening…" and "Switch to the astro.com tab, then click the AstroChart Bridge icon in the toolbar again to fill in the form.", and **Go to the astro.com tab** brings that tab to the front. Turn Wi-Fi back on.

### B: signed in (needs an astro.com account)

- [ ] **Open astro.com's form** says "Opening astro.com's form to fill it in…", then brings the form to the front already filled in, with no sign-in prompt, and closes the popup. Note whether it showed **Sign in to astro.com** instead: that would mean a signed-in page also says "Hello [not logged in]".
- [ ] Choose an invented name and astro.com's New York match for the town and continue. Note whether astro.com draws the chart, whether it adds an entry to your saved charts, and whether its header shows `Univ.Time: 12:00` and `74w00, 40n43`. Delete the entry afterwards if it was saved.
- [ ] Open an existing saved chart's birth data for editing, if astro.com offers that from ade.cgi, then open the popup from a chart's **Enter in astro.com…** on a tab where that form is showing. The popup must say the form already has a date or time in it and must not offer to fill it in.
- [ ] Sign out, open the form from test 1, choose **Sign in** in the popup, sign in, and note where astro.com goes afterwards. Open the form in that tab and check that the popup there offers to fill it in.
- [ ] Remove AstroChart Bridge's access to www.astro.com, open the form from test 1, and click **Deny**. The two-click way from part A fills in the form, with no sign-in prompt.

## Test 15: AAF files

`docs/aaf.md` explains what AstroChart Bridge reads and writes. The files are `fixtures/aaf/` in this repo, written by Astrolog 8.00 for invented charts.

### Saving

- [ ] On the test 1 popup, below **Open Stellarium Web** and above **Enter in astro.com…**, is **Save as AAF file**. Clicking it saves `chart-2024-04-17.aaf` to the browser's downloads folder without asking for a permission. Note whether the popup stays open.
- [ ] The saved file reads `#: AstroChart Bridge`, then `#A93:*,*,*,17.4.2024,8:00,*,*`, then `#B93:*,40n43,74w00,5hw00,1`.
- [ ] On an astro.com account chart, if you have one, **Save as AAF file** has a grey note below it saying the file gives the chart in Universal Time, and the file's `#B93` line ends `,0h,0`.
- [ ] On the Stellarium Web tab from test 12, the popup has **Save as AAF file** with a note that the file gives the moment in Universal Time.
- [ ] On the test 4 popup (choose a reading), there is no **Save as AAF file**.
- [ ] If Astrolog is installed, open each saved file in it (**File / Open Chart**). It shows the same date, time and place.

### Opening

- [ ] On the test 8 popup (another website), below **Paste chart text**, is **Open an AAF or Morinus file**. It opens the import page in a new tab and closes the popup.
- [ ] Choose `fixtures/aaf/astrolog-8.00-new-york.aaf`. The page says "1 chart in this file." and shows Name `New York Test`, Local time `17 Apr 2024, 08:00`, Offset `UTC-04:00`, UTC `2024-04-17 12:00`, Birthplace `New York, NY (US)` and Place `40°43'N, 74°0'W`. The Console is empty.
- [ ] **Open Stellarium Web** opens Stellarium Web with `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74` in the address. **Open chart in Astro-Seek** opens the same chart at 12:00 UT, as in test 12.
- [ ] **Enter in astro.com…** shows the test 14 screen with First name `New York Test` and Last name empty, since Astrolog leaves the last name unknown. **Open astro.com's form** asks for access as in test 14, opens the form in a tab behind the page, and says something needs your choice first, as the screenshot page does in test 14. On that tab, the popup's rows include First name `New York Test`, and **Fill in anyway** fills in the form's first name.
- [ ] Drag `fixtures/aaf/astrolog-8.00-delhi-seconds.aaf` onto the page. It shows Local time `1 Mar 1990, 06:15`, Offset `UTC+05:30` and UTC `1990-03-01 00:45`.
- [ ] Paste these lines into the box and click **Read pasted text**:

  ```
  #A93:Test,Sydney,*,15.1.2024,8:00,Sydney,NSW (AU)
  #B93:*,33s52,151e12,10he00,1
  #A93:Test,No time,*,15.1.2024,*,Sydney,NSW (AU)
  #B93:*,33s52,151e12,10he00,1
  ```

  The page lists both charts. Choosing the first shows UTC `2024-01-14 21:00`. Choosing the second says the chart has no birth time and shows `Code: no-birth-time`, with no buttons.
- [ ] In light and dark mode the page is readable, like the screenshot page.

## Test 16: pasted chart text

The paste page reads text with no help from the web. These steps check what only the installed extension can show: the page loads under the extension's script policy, the clipboard button behaves in each browser, and nothing is fetched. `test/paste-model.test.js`, `test/paste-programs.test.js` and `test/text.test.js` cover what the form shows for each kind of text. The sample uses test 1's invented New York data.

1. Go to `https://example.com`, click the AstroChart Bridge icon, then **Paste chart text**. An AstroChart Bridge tab opens and the popup closes.
2. In that tab, open DevTools (**Cmd+Option+I**) on the **Network** tab, then reload the page.
3. Copy this text, click the big box and press **Cmd+V**:

```
Natal Chart

Born: 17 April 2024 at 8:00 AM
Location: New York
Coordinates: 40°43'N 74°0'W
Time Zone: EDT (UTC-4)
House System: Whole Sign
Sun: 27°53' Aries
```

- [ ] The form appears without clicking anything: Date `2024-04-17`, Local time `08:00`, Latitude `40.716667`, Longitude `-74` and UTC offset `-04:00`. Under them, the lines read `17 April 2024`, `08:00 at the birthplace`, `40°43'0"N`, `74°0'0"W` and `UTC-04:00`, and the grey lines say they came from lines 3, 3, 5, 5 and 6.
- [ ] An orange warning says the text uses Whole Sign houses but Astro-Seek's chart will open with Placidus houses. Place, Time zone and Houses are listed as written, and the Sun line appears nowhere.
- [ ] The Console is empty, and every request in the Network tab is a `chrome-extension://` address (`moz-extension://` in Firefox).
- [ ] **Continue** shows Local time `17 Apr 2024, 08:00`, Offset `UTC-04:00`, UTC `2024-04-17 12:00` and Place `40°43'N, 74°0'W`. The first grey note says nothing checks the offset, and the last two are Astro-Seek's notes from test 13.
- [ ] **Open Stellarium Web** opens a Stellarium Web tab whose address contains `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`, and the paste tab stays open.
- [ ] **Open chart in Astro-Seek** opens the same chart as test 12: its header shows `17 Apr 2024 - 12:00  (Manually: GMT+00:00)`, Universal Time `17 Apr 2024 - 12:00` and `40°43'N, 74°0'W`.
- [ ] Below the two blue buttons is **Share…**. It opens an AstroChart Bridge chart page in a new tab, and the paste tab stays open. That page shows the same Local time, Offset, UTC and Place rows, a From row reading `pasted text`, and an orange warning that the chart was read from pasted text and nothing checked its UTC offset.
- [ ] On that page, **Download file** saves a `.astrochart.json` file. Open it in a text editor: it has the date, time, offset and coordinates, `"via": "paste"` and `"utcBasis": "declared"`, and no "New York", "EDT" or "Whole Sign".
- [ ] **Back to the form**, add `Name: Example Person` as the first line of the big box and click **Read the text**. The form lists Name `Example Person`. **Continue**, then **Enter in astro.com…**: First name is `Example Person` and Last name is empty. **Cancel** goes back to the chart. A file downloaded through **Share…** has no "Example Person" in it.
- [ ] Make the name line `Name: Moon landing commemoration of the year 1969 crew` and open **Enter in astro.com…** again. First name holds all of it, and an orange line under the boxes says astro.com's name fields take 40 characters. Delete from the end until it fits: the line disappears.
- [ ] **Back to the form** brings back the form with the same values. Change UTC offset to `-4` by typing it, **Continue**, **Share…**, and download the file again. It still says `"utcBasis": "declared"`, since -4 is the offset the text gave. Type `-5` instead and it says `"entered"`.
- [ ] Change the Date to `1500-04-17` and **Continue**. **Open Stellarium Web** still works, but **Share…** says AstroChart Bridge can't share a chart dated before 15 October 1582, with **Cancel** back to the chart.
- [ ] Change Longitude to `74°0'E`. The line under it says `74°0'0"E`. **Continue** then shows Place `40°43'N, 74°0'E`. Change it back.
- [ ] Clear the UTC offset box. **Continue** fades and does nothing when clicked. Type `-4` and it comes back.
- [ ] Copy the sample again and click **Paste from clipboard**. Note which of these happens, in each browser: the form appears at once; the browser asks for permission first (allow it once, then try again and deny it); or an orange line says the browser didn't let AstroChart Bridge read the clipboard. If the browser refuses or you deny it, pasting with **Cmd+V** still works.
- [ ] Replace the text with the lines below and click **Read the text**. The Date box is empty, with **4 May 1985** and **5 April 1985** to pick; the UTC offset box is empty, and its grey line names the zone `BST`. **Continue** stays faded until a date is picked and `+01:00` typed.

```
Birth date: 04/05/1985
Birth time: 22:15
Latitude: 51.5074
Longitude: -0.1278
Time Zone: BST
```

- [ ] Replace the text with Jagannatha Hora's birth data block below and click **Read the text**. All five boxes fill (Date `1955-10-26`, Local time `21:17:59`, UTC offset `-08:00`), each grey line under them says "Read as Jagannatha Hora's text.", and a grey note below the form says the text was read as Jagannatha Hora's. **Continue** shows UTC `1955-10-27 05:17`. Then change `West of GMT` to `East of GMT` and read it again: the boxes are empty, and an orange warning ends with `(sidereal-mismatch)`.

```
Bill Gates
Natal Chart
Date:          October 26, 1955
Time:          9:17:59 pm
Time Zone:     8:00:00 (West of GMT)
Place:         122 W 20' 30", 47 N 36' 32"
               Seattle, Washington, USA
Sidereal Time: 23:27:48
```

- [ ] Replace the text with `Name: <b>Example</b>` and `Date of Birth: 15 June 1985` on two lines and click **Read the text**. The Name row shows the angle brackets as typed, not bold text.
- [ ] Replace the text with `Sun: 24°15' Gemini` and click **Read the text**. The page says it found no birth data and shows `Code: no-birth-data`.
- [ ] In light and dark mode the page is readable, like the popup in test 10.

## Test 17: Stellarium Desktop

Needs Stellarium 25.1 or later with its Remote Control server on: the setup steps in `docs/stellarium-desktop.md`. `test/desktop-model.test.js` covers what each screen says, and `test/stellarium-desktop-client.test.js` the requests, against a stand-in server. These steps check what only the browser can show: the permission prompt, and that the requests reach Stellarium.

1. Note Stellarium's place and time, to put back afterwards.
2. If AstroChart Bridge already has access to `127.0.0.1`, remove it first: in Chrome, the extension's **Details** → **Site access**; in Firefox, `about:addons` → AstroChart Bridge → **Permissions**.
3. Open the test 3 URL (New York 1944) and click the AstroChart Bridge icon.

- [ ] Below **Open Stellarium Web** is a **Send to Stellarium Desktop** button with the secondary style, and no grey line under it: without access, the popup doesn't check Stellarium.
- [ ] Clicking it makes the browser ask whether AstroChart Bridge may connect to `127.0.0.1`. Note whether the popup stays open while it asks, in each browser. Click **Deny**: the popup says "AstroChart Bridge needs your permission", with **Try again** and **Cancel**.
- [ ] **Try again**, then allow it. The popup says "Sent to Stellarium Desktop" with UTC `1944-01-10 16:00` and Place `40°43'N, 74°0'W`. In Stellarium the clock is paused at 16:00 UTC on 10 January 1944, shown in Stellarium's own time zone, and the location is named `40.7167, -74`.
- [ ] **Done** closes the popup. Nothing else in Stellarium changed: the view, landscape and selected object are as they were.
- [ ] Open the popup on test 3 again. Within a second, a grey line under **Send to Stellarium Desktop** says "Stellarium Desktop is open and ready." Stellarium's time and place don't change.
- [ ] In Stellarium, untick **Server enabled** in Remote Control's settings. Open the popup on test 2 (Sydney): the grey line says "Stellarium Desktop isn't reachable right now. The button shows how to set it up." Click **Send to Stellarium Desktop**. Without asking again, the popup says "Stellarium Desktop isn't reachable", with six numbered steps, a grey note about other devices on the network, **Try again** and **Cancel**. **Cancel** shows the Sydney chart again.
- [ ] Tick **Server enabled** again and click **Try again** on that screen. Stellarium shows 21:00 UTC on 14 January 2024 at 33°52'S, 151°12'E.
- [ ] Go to `https://example.com` and click the AstroChart Bridge icon. **Import from Stellarium Desktop** is the last button, with "Stellarium Desktop is open and ready." under it. It shows "From Stellarium Desktop" with UTC `2024-01-14 21:00` and Place `33°52'S, 151°12'E`, then **Open chart in Astro-Seek** and **Enter in astro.com…** under "Take the chart elsewhere", and **Open Stellarium Web** under "See the sky".
- [ ] **Open Stellarium Web** opens a Stellarium Web tab whose address contains `date=2024-01-14T21%3A00%3A00Z&lat=-33.86667&lng=151.2`.
- [ ] In Stellarium's Remote Control settings, tick **Access requires authentication**, type any password, click **Save settings**, then untick and tick **Server enabled**. **Import from Stellarium Desktop** says "Stellarium asks for a password", and the browser doesn't show its own password box. Untick it again the same way.
- [ ] The Console stays empty throughout.
- [ ] Open the popup on test 3 and click **Send to Stellarium Desktop**. Under **Done**, the sent screen has a **Use Stellarium Desktop by default** button. Click it: the screen stays, and a line says "Stellarium Desktop is now your default for charts. Every chart screen has a link to change it back." with an **Undo** link.
- [ ] Open the popup on test 1. **Send to Stellarium Desktop** is first, in blue; **Open Stellarium Web** follows in the secondary style; and under them a line says "Stellarium Desktop is your default for charts." with a **Make Stellarium Web the default** link. Close the browser and open it again: the popup on test 1 still leads with **Send to Stellarium Desktop**.
- [ ] On test 4 (a skipped time), both buttons are faded until a reading is picked, whichever is first.
- [ ] Click **Make Stellarium Web the default**. Without closing, the popup shows **Open Stellarium Web** first in blue again, **Send to Stellarium Desktop** below it, and "Stellarium Web is the default again." with **Undo**. **Undo** brings back the order of the step before. Make Stellarium Web the default again, close the popup and reopen it on test 1: there is no default line.
- [ ] On a Stellarium Web tab (test 12), with Stellarium Desktop the default, **Open chart in Astro-Seek** stays first and the default line is under the buttons.
- [ ] On an iPad or another touch screen, the **Make Stellarium Web the default** link sits on its own line and is easy to tap.
- [ ] On the import page, open `fixtures/morinus/ny-est-plus-dst.p2.hor`. Below **Open Stellarium Web** is **Send to Stellarium Desktop**; within a second a grey line under it says "Stellarium Desktop is open and ready." Click it: Stellarium shows 2024-04-17 12:00 UTC at 40.7167, -74, the page says **Sent to Stellarium Desktop**, and **Done** shows the chart again, with the page still open.
- [ ] Do the same from the screenshot page (test 13) and the paste page (test 16), each with a chart that has its UTC decided.
- [ ] Put Stellarium's place and time back as noted in step 1, and start its clock. Make Stellarium Web the default if it isn't.

## Test 18: Safari on iPad

Run this on each iPad you have, and note its model, size and iPadOS version. Where a step says to open the popup, tap the menu in Safari's address bar, then **AstroChart Bridge**. Note anything Safari asks the first time on each site.

- [ ] Tests 1, 2, 3, 4, 7, 8 and 11 show what they say on a Mac, and the addresses they open contain the same `date=`, `lat=` and `lng=`.
- [ ] On `https://example.com`, tap **Import from Stellarium Desktop** and note what the popup shows. There's no Stellarium Desktop on an iPad for it to reach at `127.0.0.1`.
- [ ] In portrait and in landscape, the popup's text isn't cut off and it doesn't scroll sideways. Every button and each reading in test 4 is easy to tap with a finger.
- [ ] With a keyboard and trackpad attached, note whether the buttons are the same size as without them. Without them they are at least 44 points tall; with them they may be smaller.
- [ ] **Open Stellarium Web** opens Stellarium Web in a new tab and the popup closes.
- [ ] On that Stellarium tab:
  - [ ] Drag with one finger to look around.
  - [ ] Pinch to zoom.
  - [ ] Tap the clock (bottom right) and pause it.
  - [ ] Step the hour with its arrows.
  - [ ] For test 1, a daytime chart, turn off the atmosphere (the cloud button) and check that the planets show.
  - [ ] Note whatever is hard to do with a finger, and anything the screen's size gets in the way of.
- [ ] Test 12 on the iPad: the popup on a Stellarium tab reads its sky and opens the Astro-Seek chart.
- [ ] On an iPad mini, note whether Astro-Seek shows the same page as on a Mac or a phone layout, and whether test 1 still reads. If it doesn't, note the popup's message and code.
- [ ] Test 14 part A, up to **Fill in anyway**: note whether Safari asks for access to www.astro.com, whether the popup stays open while the form opens behind it, and whether the popup on that tab offers to fill in the form. If it shows "Open an Astro-Seek or astro.com birth chart…" instead, the values weren't kept (see `docs/safari-ipad.md`).
- [ ] Test 13 with a screenshot taken on the iPad:
  - [ ] Choose it with **Choose File** from Photos, or paste it with **Cmd+V** on a keyboard.
  - [ ] Note how long it takes, and whether the tab reloads or shows an error instead.
- [ ] On the Stellarium tab from test 1, use Safari's Share button to copy the link. Open the link in a browser on a Mac: it shows the same date, time and place.
- [ ] Switch to another tab and back, then open the popup again on the test 1 tab: it shows the same rows.
## Test 19: the receiving page

The page that opens an AstroChart Bridge link, without the extension. Serve the `extension` folder (the launch config's `receiving-page` entry runs the same command):

```
python3 -m http.server 8778 --bind 127.0.0.1 --directory extension
```

The New York 2024 chart from test 1, as a link:

```
http://127.0.0.1:8778/chart.html#v1=eyJmb3JtYXQiOiJjaGFydC1icmlkZ2UiLCJ2ZXJzaW9uIjoxLCJjaGFydCI6eyJjYWxlbmRhciI6ImdyZWdvcmlhbiIsImxvY2FsIjoiMjAyNC0wNC0xN1QwODowMDowMCIsInV0Y09mZnNldFNlY29uZHMiOi0xNDQwMCwibGF0aXR1ZGUiOjQwLjcxNjY2NywibG9uZ2l0dWRlIjotNzR9LCJzb3VyY2UiOnsic2l0ZSI6ImFzdHJvLXNlZWsiLCJ2aWEiOiJwYWdlIiwiem9uZUxhYmVsIjoiRURULCBEU1QiLCJ1dGNCYXNpcyI6InByaW50ZWQifX0
```

### A: desktop

- [ ] The page shows Local time `17 Apr 2024, 08:00 (EDT, DST)`, Offset `UTC-04:00`, UTC `2024-04-17 12:00`, Place `40°43'N, 74°0'W` and From `Astro-Seek page`, four grey notes, **Open Stellarium Web**, **Open chart in Astro-Seek**, **Copy link**, **Show QR code**, **Download file** and **Open an AstroChart Bridge file**. In a browser with a share sheet (test 22), **Share link…** and possibly **Share file…** are there too. There is no **Enter in astro.com…** or **Share…**.
- [ ] The address bar shows `chart.html` with nothing after it, and **Back** doesn't bring the `#v1=…` part back.
- [ ] Nothing opens by itself. **Open Stellarium Web** opens the same Stellarium address as test 1; **Open chart in Astro-Seek** opens a chart for 17 April 2024 12:00 UT at 40°43'N, 74°0'W.
- [ ] **Copy link** says "Link copied.", and pasting gives exactly the link above. If the browser refuses, the link appears selected in a field below the message instead.
- [ ] **Download file** saves `chart-2024-04-17.astrochart.json`. Opened in a text editor, it shows the chart's fields indented, with `"utcOffsetSeconds": -14400`.
- [ ] Open the browser's History list. Note whether it shows the address with `#v1=…`: the page removes it from the tab's address and its Back entry, but whether a browser's History list keeps the original address hasn't been checked in any browser.
- [ ] Delete the last ten characters of the link and open it: the page says the link is incomplete or damaged, shows `Code: malformed`, and has no buttons.
- [ ] Open `http://127.0.0.1:8778/chart.html` with nothing after it: the page asks for an AstroChart Bridge link or chart file, and its only button is a blue **Open an AstroChart Bridge file**.
- [ ] The Console stays empty throughout.

### B: phones and tablets (needs the devices)

A phone reaches the page through the Mac's address on the local network, which makes the folder visible to that network while the server runs. Serve it with `--bind 0.0.0.0` instead, find the Mac's address in System Settings → Network, and replace `127.0.0.1` in the link with it. That address is plain http, so browsers refuse **Copy link** there and show the field instead; only an https host can test copying.

- [ ] On iPhone Safari, iPad Safari (portrait and landscape), Chrome for Android and Firefox for Android: the same rows and buttons as in A, nothing wider than the screen, and the buttons easy to tap.
- [ ] **Open Stellarium Web** opens Stellarium Web in a new tab at the same time and place.
- [ ] **Copy link** shows the field with the link selected, and the system's copy works on it.

## Test 20: sharing a chart from the extension

Copied links point at `RECEIVER_URL` in `extension/share-config.js`, the receiving page on GitHub Pages. Until that page is deployed, a copied link opens a 404 there; check its address and contents instead.

- [ ] On the test 1 chart, **Share…** opens a tab at `chrome-extension://…/chart.html` (`moz-extension://…` in Firefox) and closes the popup. The tab shows the same rows as test 19 A, From `Astro-Seek page`, and the address has nothing after `chart.html`.
- [ ] **Copy link** says "Link copied.", and the pasted link starts `https://kevinblakelopez.github.io/astrochart-bridge/chart.html#v1=`. Pasting it after `http://127.0.0.1:8778/chart.html` in place of that address, with the test 19 server running, shows the same chart.
- [ ] **Download file** saves `chart-2024-04-17.astrochart.json`, in Chrome and in Firefox.
- [ ] **Open Stellarium Web** on that tab opens the same Stellarium address as test 1.
- [ ] On the test 4 chart, **Share…** is faded until a reading is picked. Pick the second reading (the label EST), then **Share…**: the tab shows Offset `UTC-05:00` and UTC `2021-03-14 07:30`.
- [ ] On an astro.com account chart (test 14's), **Share…** opens a tab showing From `astro.com page`.
- [ ] On the screenshot page from test 13, **Share…** opens a tab showing From `Astro-Seek screenshot` and the warning to compare the rows. The screenshot page stays open.
- [ ] On a Stellarium Web tab (test 12) and on astro.com's form tab (test 14), the popup has no **Share…**.
- [ ] Each Console stays empty: the popup's, and the new tab's (right-click → Inspect).

## Test 21: scanning a QR code

Scanning needs a phone or tablet whose camera app reads QR codes. On the desktop, open a chart's tab with **Share…** (test 20), or the test 19 link. A code from the extension's tab holds the GitHub Pages address, which opens nothing until that page is deployed: check the address the camera shows before opening it. A code from the test 19 page holds `127.0.0.1`, which only that computer can open; to open it on the device too, serve the page with `--bind 0.0.0.0` and open it at the Mac's network address, as in test 19 B.

- [ ] **Show QR code** draws a black-on-white code with a white border under the buttons, the note about who can read it, and **Hide QR code**, which removes it. In dark mode the code stays black on white.
- [ ] At the browser's normal size, from about 30 cm, the camera on an iPhone, an iPad and an Android phone each recognises the code within a few seconds. Note the device and the distance.
- [ ] The address each camera shows is the whole link, ending in the same characters as **Copy link**'s.
- [ ] The same at 200% browser zoom, and with the window narrowed until the code is at its smallest.
- [ ] Opened on the device, the link shows the same rows as on the desktop.

## Test 22: opening chart files and the share sheet

Use the file **Download file** saved in test 19, `chart-2024-04-17.astrochart.json`.

### A: opening a file

- [ ] On the test 19 page, **Open an AstroChart Bridge file** and choose the file: the page shows the test 19 rows, "Opened chart-2024-04-17.astrochart.json." under the buttons, and the address has nothing after `chart.html`.
- [ ] Drag the file from Finder onto the page: the same. The browser doesn't leave the page to show the file.
- [ ] Choose any other file, such as a photo: the page says it isn't an AstroChart Bridge chart, with its code, and **Open an AstroChart Bridge file** is still there.
- [ ] In the popup on a page AstroChart Bridge doesn't read (test 8), **Open an AstroChart Bridge file** opens the extension's page in a tab, where choosing the file shows the chart. Chrome and Firefox.
- [ ] On an iPhone and an iPad, send the file to the device (AirDrop or Files), open the test 19 page there (test 19 B), and choose the file from Files. On Android, from Downloads. Each shows the chart.

### B: the share sheet

Note which buttons each browser shows: the page offers each only where the browser says it can share that thing.

- [ ] Desktop Firefox: neither **Share link…** nor **Share file…**.
- [ ] Desktop Safari and desktop Chrome: note whether each appears. **Share link…** opens the system's share sheet with the link; closing the sheet without sharing shows no message.
- [ ] iPhone and iPad Safari: **Share link…** opens the share sheet, and AirDrop to a Mac opens the link there with the same chart. Note whether **Share file…** appears; if it does, AirDrop the file and open it as in A.
- [ ] Chrome for Android and Firefox for Android: **Share link…** opens the share sheet; sending the link to yourself in a messaging app and opening it shows the same chart. Note whether **Share file…** appears.
- [ ] On the extension's page (test 20), note whether either appears in Chrome and Firefox.

## Test 23: Morinus files

`docs/morinus-hor.md` explains what AstroChart Bridge reads. The files are `fixtures/morinus/` in this repo: invented charts, each saved with several pickle protocols. If Morinus is installed, also open a chart you saved in it yourself.

- [ ] On the import page (test 15), choose `fixtures/morinus/ny-est-plus-dst.p2.hor`. The page says "1 chart in this file." and shows Name `Test`, Local time `17 Apr 2024, 08:00`, Offset `UTC-04:00`, Entered as `UTC-05:00 zone, with daylight saving`, UTC `2024-04-17 12:00`, Birthplace `New York` and Place `40°43'N, 74°0'W`, with a note that Morinus saves the offset entered, not the time zone. The Console is empty.
- [ ] **Open Stellarium Web** opens Stellarium Web with `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74` in the address. **Save as AAF file** saves a file whose `#B93` line is `#B93:*,40n43,74w00,5hw00,1`.
- [ ] **Enter in astro.com…** shows the test 14 screen with First name `Test` and Last name empty. Choose `fixtures/morinus/unicode-text.p2.hor` and do the same: First name is `Nagy Róbert 東京 \ test`, with its accents and Japanese letters intact.
- [ ] Drag `fixtures/morinus/sydney-south.p0.hor` onto the page. It shows Offset `UTC+11:00`, UTC `2024-01-14 21:00` and Place `33°52'S, 151°12'E`.
- [ ] Choose `fixtures/morinus/greenwich-with-dst.p4.hor`. It shows Entered as `Greenwich time, with daylight saving`, UTC `2024-04-17 07:00` and a warning that Morinus takes an hour off.
- [ ] Choose `fixtures/morinus/julian-1900.p4.hor`. It says the date is in the Julian calendar and shows `Code: julian-calendar`, with no buttons.
- [ ] Choose any `.aaf` file from test 15 again. It still opens as AAF.
- [ ] If Morinus is installed: save a chart in it, open the `.hor` here, and check the UTC against the one Morinus shows.

## Not covered by hand yet

- **Enter offset**: no real Astro-Seek page has been seen without a Universal Time line, so this screen can't be reached in a browser yet. `test/popup-model.test.js` covers what it shows and its preview.

## If a check fails

Note the test number, take a screenshot of the popup, copy anything in its Console, for tests 1, 4, 7 and 11 copy the Stellarium tab's full address, and for test 12 the Astro-Seek tab's full address. For test 16, copy the text you pasted.
