# Manual test checklist

`popup.js` talks to the browser and has no automated tests, so run this list in Chrome, Brave, Microsoft Edge, Firefox and Safari after changing it, and test 15 in Safari on an iPad. Everything it calls, from `analyzePage` to the view model, is covered by `npm test`.

The chart URLs below are the `url` fields of the fixtures in `fixtures/astroseek/`, plus the asteroids example from `docs/astroseek-known-issues.md`. All of them use invented birth data.

Natal charts are read from three Astro-Seek pages: the birth chart (`/calculate-birth-chart-horoscope-online/`, tests 1 to 4), the asteroids chart (`/calculate-asteroids/`, test 7) and the traditional chart (`/calculate-traditional-chart/`, test 11).

## Setup (once per browser)

### Chrome

1. Go to `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked**. Press **Cmd+Shift+G**, paste the path to this repo's `extension` folder (for example `/Users/you/code/chart-bridge/extension`), press Return and click **Select**. The folder you select must contain `manifest.json`.
3. Click the puzzle-piece icon in Chrome's toolbar and click the pin next to **Chart Bridge**, so its icon stays in the toolbar.

After changing any file in `extension/`, click the reload arrow on the Chart Bridge card in `chrome://extensions` before testing again.

### Brave

Brave's extensions page is the same as Chrome's. Follow the Chrome steps above at `brave://extensions`, and reload from there too.

### Edge

1. Go to `edge://extensions` and turn on **Developer mode** (in the panel on the left).
2. Click **Load unpacked** and select the same `extension` folder as in Chrome's step 2.
3. Click the Extensions icon (a puzzle piece) in Edge's toolbar and click the eye icon next to **Chart Bridge** (**Show in toolbar**), so its icon stays in the toolbar.

After changing any file in `extension/`, click **Reload** on the Chart Bridge card in `edge://extensions` before testing again.

### Firefox

Chart Bridge needs Firefox 128 or later.

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**. Press **Cmd+Shift+G**, paste the path to the same `extension` folder, press Return, select `manifest.json` inside it and click **Open**. Firefox asks for a file in the folder, not the folder itself.
3. Click the Extensions button (a puzzle piece) in Firefox's toolbar, click the gear next to **Chart Bridge** and choose **Pin to Toolbar**.

Firefox removes a temporary add-on when it quits, so load it again after restarting Firefox. After changing any file in `extension/`, click **Reload** on the Chart Bridge card in `about:debugging` before testing again.

### Safari

Chart Bridge needs Safari 26 or later on macOS.

1. Choose **Safari → Settings**, select the **Advanced** tab and check **Show features for web developers**.
2. Select the **Developer** tab and check **Allow unsigned extensions**. Safari asks for your Mac password.
3. On the same tab, click **Add Temporary Extension…**, select the same `extension` folder and click **Select**. Safari switches to the **Extensions** tab and lists Chart Bridge under **Temporary**.
4. Check the box next to **Chart Bridge** if it isn't checked, and close Settings. Its icon appears in Safari's toolbar.

The first time you click the icon on a site, Safari may ask whether Chart Bridge can see that page. Allow it for that site.

Safari removes a temporary extension after 24 hours or when it quits, and turns **Allow unsigned extensions** off when it quits, so repeat steps 2 to 4 after restarting Safari. After changing any file in `extension/`, click **Reload** next to Chart Bridge in the **Extensions** tab before testing again.

### Safari on iPad

Follow `docs/safari-ipad.md` to build the app with Xcode and install it on the iPad, then run test 15. After changing any file in `extension/`, run the app from Xcode again before testing.

## For every test

1. Open the test's URL in a new tab and wait for the page to finish loading.
2. Click the Chart Bridge icon in the toolbar. A small popup opens.
3. Right-click inside the popup, choose **Inspect**, and open the **Console** tab. It must stay empty. While DevTools is open the popup stays open too, which makes it easier to read.

   In Firefox, click **Inspect** on the Chart Bridge card in `about:debugging` instead. In the toolbox that opens, choose **Disable Popup Auto-Hide** from the **⋯** menu at the top right, open the popup, then pick `popup.html` with the frame-picker button next to that menu. The Console must stay empty.

   In Safari, right-click inside the popup and choose **Inspect Element**. Web Inspector opens on the popup; open its **Console** tab. It must stay empty.

## Test 1: New York 2024

```
https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/?input_natal=1&send_calculation=1&narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024&narozeni_hodina=08&narozeni_minuta=00&narozeni_sekunda=00&narozeni_city=New+York%2C+USA%2C+New+York&narozeni_mesto_hidden=New+York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&hid_fortune=1&hid_vertex=1&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&tolerance=1&aya=&tolerance_paral=0#tabs_redraw
```

- [ ] The popup shows Local time `17 Apr 2024, 08:00 (EDT, DST)`, Offset `UTC-04:00`, UTC `2024-04-17 12:00` and Place `40°43'N, 74°0'W`.
- [ ] Below them are two grey notes, the one about Google last, then a blue **Open sky** button.
- [ ] The first note names the time Stellarium's clock will show in your computer's time zone, and says that's 08:00 on 17 Apr at the birthplace. On a Mac set to Pacific time it says 05:00 on 17 Apr.
- [ ] After **Open sky**, Stellarium's clock (bottom right) shows the time the note named, give or take the seconds it has been running.
- [ ] Clicking **Open sky** opens a Stellarium Web tab and closes the popup. The new tab's address contains `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`.

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

- [ ] The popup shows "Astro-Seek's page contradicts itself…", two readings with round buttons, and a faded **Open sky** button.
- [ ] Clicking the faded **Open sky** does nothing.
- [ ] Pick the first reading (06:30) and click **Open sky**. The new tab's address contains `date=2021-03-14T06%3A30%3A00Z`.
- [ ] Go back to the chart tab, open the popup again, pick the second reading (07:30) and click **Open sky**. The new tab's address contains `date=2021-03-14T07%3A30%3A00Z`.

## Test 5: a transit page

```
https://horoscopes.astro-seek.com/calculate-transit-chart/?muz_narozeni_den=15&muz_narozeni_mesic=1&muz_narozeni_rok=2024&muz_narozeni_hodina=08&muz_narozeni_minuta=00&muz_narozeni_mesto_hidden=Sydney&muz_narozeni_stat_hidden=AU&muz_narozeni_podstat_kratky_hidden=NSW&muz_narozeni_tzid_id=306&muz_narozeni_city=Sydney,%20Australia,%20NSW&muz_narozeni_sirka_stupne=33&muz_narozeni_sirka_minuty=52&muz_narozeni_sirka_smer=1&muz_narozeni_delka_stupne=151&muz_narozeni_delka_minuty=12&muz_narozeni_delka_smer=0&muz_narozeni_timezone_form=auto&muz_narozeni_timezone_dst_form=auto&zena_narozeni_den=1&zena_narozeni_mesic=11&zena_narozeni_rok=2026&zena_narozeni_hodina=06&zena_narozeni_minuta=57&zena_narozeni_mesto_hidden=Sydney&zena_narozeni_stat_hidden=AU&zena_narozeni_podstat_kratky_hidden=NSW&zena_narozeni_tzid_id=&zena_narozeni_city=Sydney,%20Australia,%20NSW&zena_narozeni_sirka_stupne=33&zena_narozeni_sirka_minuty=52&zena_narozeni_sirka_smer=1&zena_narozeni_delka_stupne=151&zena_narozeni_delka_minuty=12&zena_narozeni_delka_smer=0&zena_narozeni_timezone_form=auto&zena_narozeni_timezone_dst_form=auto&house_system=placidus&styl_graf=&hid_fortune=on&hid_fortune_check=&hid_vertex=on&hid_vertex_check=&hid_chiron=&hid_chiron_check=on&hid_lilith=&hid_lilith_check=on&hid_uzel=&hid_uzel_check=on&aya=&nick=&hide_aspects=0&rocni_pohyb=1&&orb2=3
```

- [ ] The popup shows only "This is a transit chart. Chart Bridge opens natal charts only." There is no button.

## Test 6: a compatibility page

```
https://horoscopes.astro-seek.com/calculate-love-compatibility/?send_calculation=1&muz_narozeni_den=15&muz_narozeni_mesic=1&muz_narozeni_rok=1970&muz_narozeni_hodina=08&muz_narozeni_minuta=00&muz_narozeni_city=Sydney%2C+Australia%2C+NSW&muz_narozeni_mesto_hidden=Sydney&muz_narozeni_stat_hidden=AU&muz_narozeni_podstat_kratky_hidden=NSW&muz_narozeni_tzid_id=306&muz_narozeni_sirka_stupne=33&muz_narozeni_sirka_minuty=52&muz_narozeni_sirka_smer=1&muz_narozeni_delka_stupne=151&muz_narozeni_delka_minuty=12&muz_narozeni_delka_smer=0&muz_narozeni_timezone_form=auto&muz_narozeni_timezone_dst_form=auto&send_calculation=1&zena_narozeni_den=17&zena_narozeni_mesic=4&zena_narozeni_rok=2024&zena_narozeni_hodina=08&zena_narozeni_minuta=00&zena_narozeni_city=New+York%2C+USA%2C+New+York&zena_narozeni_mesto_hidden=New+York&zena_narozeni_stat_hidden=US&zena_narozeni_podstat_kratky_hidden=NY&zena_narozeni_tzid_id=0&zena_narozeni_sirka_stupne=40&zena_narozeni_sirka_minuty=43&zena_narozeni_sirka_smer=0&zena_narozeni_delka_stupne=74&zena_narozeni_delka_minuty=0&zena_narozeni_delka_smer=1&zena_narozeni_timezone_form=auto&zena_narozeni_timezone_dst_form=auto&switch_interpretations=3&house_system=placidus&hid_fortune=1&hid_vertex=1&hid_chiron=1&hid_chiron_check=on&hid_lilith=1&hid_lilith_check=on&hid_uzel=1&hid_uzel_check=on&uhel_orbis=&hide_aspects=0&zmena_nastaveni=1&aktivni_tab=#tabs_redraw
```

- [ ] The popup shows only "This is a synastry or compatibility chart. Chart Bridge opens natal charts only."

## Test 7: an asteroids page

```
https://horoscopes.astro-seek.com/calculate-asteroids/?narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024&narozeni_hodina=08&narozeni_minuta=00&narozeni_sekunda=00&narozeni_mesto_hidden=New%20York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_city=New%20York,%20USA,%20New%20York&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&styl_graf=&hid_fortune=on&hid_fortune_check=&hid_spirit=&hid_spirit_check=on&hid_syzygy=&hid_syzygy_check=on&hid_vertex=on&hid_vertex_check=&hid_chiron=&hid_chiron_check=on&hid_lilith=&hid_lilith_check=on&hid_uzel=&hid_uzel_check=on&tolerance=1&tolerance_paral=0&nick=&hide_aspects=0&duha=&hide_trans=&display_trans=&aya=&house_start=&naksha_posun=&naksha_nasobek=&custom_aya=&&&radix=1&aktivni_tab=1&ast_symbol=text&asteroidy_ukazat=1
```

- [ ] The popup shows the same rows and notes as test 1, and **Open sky** opens an address containing `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`.

## Test 8: another website

Go to `https://example.com`.

- [ ] The popup shows "Open an Astro-Seek or astro.com birth chart to use Chart Bridge." and a **Read a screenshot instead** button, and the Console has no errors.
- [ ] Chart Bridge's toolbar button shows its icon, a gold star above a blue arch, and Chart Bridge's card on the browser's extensions page shows it too.

## Test 9: a browser page

Go to `chrome://extensions` in Chrome, `brave://extensions` in Brave, `edge://extensions` in Edge, or `about:debugging` in Firefox. In Safari, open a new tab (**Cmd+T**) and leave it on the Start Page.

- [ ] The popup shows the same sentence and button as test 8, and the Console has no errors.

## Test 10: light and dark mode

Switch the Mac's appearance (System Settings → Appearance) and reopen the popup on test 1.

- [ ] In both modes the text is readable and the **Open sky** button has clear contrast.

## Test 11: traditional charts

Traditional chart pages print times with seconds. They should behave exactly like the natal pages in tests 1 and 4.

New York 2024:

```
https://horoscopes.astro-seek.com/calculate-traditional-chart/?narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024&narozeni_hodina=08&narozeni_minuta=00&narozeni_sekunda=00&narozeni_mesto_hidden=New%20York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_city=New%20York,%20USA,%20New%20York&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&styl_graf=&hid_fortune=on&hid_fortune_check=&hid_spirit=&hid_spirit_check=on&hid_syzygy=&hid_syzygy_check=on&hid_vertex=on&hid_vertex_check=&hid_chiron=&hid_chiron_check=on&hid_lilith=&hid_lilith_check=on&hid_uzel=&hid_uzel_check=on&tolerance=1&tolerance_paral=0&nick=&hide_aspects=0&duha=&hide_trans=&display_trans=&aya=&house_start=&naksha_posun=&naksha_nasobek=&custom_aya=&&radix=1&aktivni_tab=1&house_system=whole_horizon&terms=
```

- [ ] The popup shows the same rows and notes as test 1, and **Open sky** opens an address containing `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`.

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
2. Open a tab on another website, click the Chart Bridge icon, then **Read a screenshot instead**. A Chart Bridge tab opens and the popup closes.
3. In that tab, open DevTools (**Cmd+Option+I**) on the **Network** tab, then reload the page.
4. Press **Cmd+V**.

- [ ] Within a few seconds the page shows the same rows as test 1. The first grey note says to compare the rows with the screenshot.
- [ ] The Console is empty, and every request in the Network tab is a `chrome-extension://` address (`moz-extension://` in Firefox, `safari-web-extension://` in Safari).
- [ ] **What Chart Bridge read** opens to show the text read from the screenshot.
- [ ] **Open sky** opens a Stellarium Web tab whose address contains `date=2024-04-17T12%3A00%3A00Z&lat=40.716667&lng=-74`, and the screenshot tab stays open.
- [ ] Below it is **Open chart in Astro-Seek**, and the last two grey notes say Astro-Seek will draw the chart in UT/GMT with no city, and that opening it sends the date, time and place to astro-seek.com.
- [ ] **Open chart in Astro-Seek** opens the same chart as test 12: its header shows `17 Apr 2024 - 12:00  (Manually: GMT+00:00)`, Universal Time `17 Apr 2024 - 12:00` and `40°43'N, 74°0'W`.
- [ ] Save the same screenshot as a file (**Cmd+Shift+4**). Dropping it onto the page and choosing it with **Choose File** give the same result.
- [ ] Open the file in Preview, use **Tools → Adjust Size** to halve its width, and save. Dropping it gives the same result.
- [ ] A screenshot of only the chart wheel shows "Chart Bridge couldn't find the birth data in this screenshot…" and `Code: unreadable-screenshot`.
- [ ] In light and dark mode the page is readable, like the popup in test 10.

## Test 14: entering a chart in astro.com

Chart Bridge keeps a chart's values for the astro.com tab it opens, for 30 minutes, and fills in astro.com's form when you click its icon on that tab. It never submits the form or signs you in. It can only tell that a browser is signed out (astro.com's menu says "Hello [not logged in]"); any other page counts as unknown and is never held up. Run part A in a browser profile that isn't signed in to astro.com, and part B, if you have an astro.com account, in one that is. Never type a real birth date into astro.com for this test, and don't submit the form in part A.

### A: signed out

Open the test 1 URL and open the popup.

- [ ] Below **Open sky** is **Enter in astro.com…**. On an astro.com account chart, if you have one, it isn't there.
- [ ] **Enter in astro.com…** replaces the popup's screen with Birthday `17 April 2024`, Hour, min `12:00`, Time zone `00:00 GMT / UT, under show / hide extended settings` and Place `40°43'N, 74°0'W`, four grey notes (the last two about signing in and how long the values are kept), the buttons **Open astro.com's form**, **Sign in** and **Create account**, and **Cancel**.
- [ ] **Cancel** brings back the test 1 screen.
- [ ] **Open astro.com's form** opens `https://www.astro.com/cgi/ade.cgi`, "Step 1: Birth Data Entry", in a new tab and closes the popup.
- [ ] On that tab, open the popup. It shows **Sign in to astro.com**, the same four rows, "astro.com requires an account to generate charts…", and **Sign in**, **Create account**, **Fill in anyway** and **Cancel**. Its Console is empty.
- [ ] **Fill in anyway** closes the popup. The form shows birthday `17` `April` `2024`, hour `12`, min `00`, the extended settings open with time zone `00:00 GMT / UT`, an empty birth town with the cursor in it, and nothing else changed. If astro.com's privacy dialog covers the page, the form is filled in behind it.
- [ ] Open the popup on that tab again. It shows "Open an Astro-Seek or astro.com birth chart…": the values were forgotten once filled in.
- [ ] Back on the test 1 tab, open **Enter in astro.com…** and **Open astro.com's form** again. On the new tab, type `1` in the birthday's day field, then open the popup: it says the form already has a date or time in it and offers **Open a blank form**, which reloads the form in the same tab. Open the popup again: it offers to fill in.
- [ ] On that tab, choose **Sign in**. The same tab goes to astro.com's "My Astro – Login" page. Don't sign in. Open the popup there: it shows "Chart Bridge is keeping these values for this tab." with **Open astro.com's form** and **Cancel**. Nothing opens or reloads by itself.
- [ ] **Cancel** closes the popup. Opening it again on that tab shows "Open an Astro-Seek or astro.com birth chart…".
- [ ] Open the form from the test 1 popup, then from the test 2 (Sydney) popup. Each astro.com tab's popup shows its own chart's values: Birthday `17 April 2024` on the first, `14 January 2024` on the second.
- [ ] Open the form from the test 1 popup, wait 30 minutes, then open the popup on it: it shows "Open an Astro-Seek or astro.com birth chart…".
- [ ] On the screenshot page from test 13, **Enter in astro.com…** and **Open astro.com's form** open a tab whose popup offers to fill in the same values.

### B: signed in (needs an astro.com account)

- [ ] **Open astro.com's form** opens the form without asking you to sign in first.
- [ ] The popup on the form tab shows "Fill in astro.com's form with these values?", **Fill in the form** and **Cancel**, and no sign-in prompt. Note whether it showed **Sign in to astro.com** instead: that would mean a signed-in page also says "Hello [not logged in]".
- [ ] **Fill in the form**, then choose an invented name and a New York town and continue. Note whether astro.com draws the chart, whether it adds an entry to your saved charts, and whether its header shows `Univ.Time: 12:00` and `74w00, 40n43`. Delete the entry afterwards if it was saved.
- [ ] Open an existing saved chart's birth data for editing, if astro.com offers that from ade.cgi, then open the popup from a chart's **Enter in astro.com…** on a tab where that form is showing. Note whether the popup says the form changes a saved chart, and whether the address or form has a `cid`.
- [ ] Sign out, open the form from test 1, choose **Sign in** in the popup, sign in, and note where astro.com goes afterwards. Open the form in that tab and check that the popup offers to fill it in.

## Test 15: Safari on iPad

Run this on each iPad you have, and note its model, size and iPadOS version. Where a step says to open the popup, tap the menu in Safari's address bar, then **Chart Bridge**. Note anything Safari asks the first time on each site.

- [ ] Tests 1, 2, 3, 4, 7, 8 and 11 show what they say on a Mac, and the addresses they open contain the same `date=`, `lat=` and `lng=`.
- [ ] In portrait and in landscape, the popup's text isn't cut off and it doesn't scroll sideways. Every button and each reading in test 4 is easy to tap with a finger.
- [ ] With a keyboard and trackpad attached, note whether the buttons are the same size as without them. Without them they are at least 44 points tall; with them they may be smaller.
- [ ] **Open sky** opens Stellarium Web in a new tab and the popup closes.
- [ ] On that Stellarium tab:
  - [ ] Drag with one finger to look around.
  - [ ] Pinch to zoom.
  - [ ] Tap the clock (bottom right) and pause it.
  - [ ] Step the hour with its arrows.
  - [ ] For test 1, a daytime chart, turn off the atmosphere (the cloud button) and check that the planets show.
  - [ ] Note whatever is hard to do with a finger, and anything the screen's size gets in the way of.
- [ ] Test 12 on the iPad: the popup on a Stellarium tab reads its sky and opens the Astro-Seek chart.
- [ ] On an iPad mini, note whether Astro-Seek shows the same page as on a Mac or a phone layout, and whether test 1 still reads. If it doesn't, note the popup's message and code.
- [ ] Test 14 part A, up to the popup on the astro.com tab: note whether the tab came to the front before the popup closed, and whether the popup on that tab offers to fill in the form. If it shows "Open an Astro-Seek or astro.com birth chart…" instead, the values weren't kept (see `docs/safari-ipad.md`).
- [ ] Test 13 with a screenshot taken on the iPad:
  - [ ] Choose it with **Choose File** from Photos, or paste it with **Cmd+V** on a keyboard.
  - [ ] Note how long it takes, and whether the tab reloads or shows an error instead.
- [ ] On the Stellarium tab from test 1, use Safari's Share button to copy the link. Open the link in a browser on a Mac: it shows the same date, time and place.
- [ ] Switch to another tab and back, then open the popup again on the test 1 tab: it shows the same rows.

## Not covered by hand yet

- **Enter offset**: no real Astro-Seek page has been seen without a Universal Time line, so this screen can't be reached in a browser yet. `test/popup-model.test.js` covers what it shows and its preview.

## If a check fails

Note the test number, take a screenshot of the popup, copy anything in its Console, for tests 1, 4, 7 and 11 copy the Stellarium tab's full address, and for test 12 the Astro-Seek tab's full address.
