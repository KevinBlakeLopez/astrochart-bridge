# Manual test checklist

`popup.js` talks to the browser and has no automated tests, so run this list in Chrome after changing it. Everything it calls, from `analyzePage` to the view model, is covered by `npm test`.

The chart URLs below are the `url` fields of the fixtures in `fixtures/astroseek/`, plus the asteroids example from `docs/astroseek-known-issues.md`. All of them use invented birth data.

Natal charts are read from two Astro-Seek pages: the birth chart (`/calculate-birth-chart-horoscope-online/`, tests 1 to 4) and the traditional chart (`/calculate-traditional-chart/`, test 11).

## Setup (once)

1. Go to `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked**. Press **Cmd+Shift+G**, paste the path to this repo's `extension` folder (for example `/Users/you/code/chart-bridge/extension`), press Return and click **Select**. The folder you select must contain `manifest.json`.
3. Click the puzzle-piece icon in Chrome's toolbar and click the pin next to **Chart Bridge**, so its icon stays in the toolbar.

After changing any file in `extension/`, click the reload arrow on the Chart Bridge card in `chrome://extensions` before testing again.

## For every test

1. Open the test's URL in a new tab and wait for the page to finish loading.
2. Click the Chart Bridge icon in the toolbar. A small popup opens.
3. Right-click inside the popup, choose **Inspect**, and open the **Console** tab. It must stay empty. While DevTools is open the popup stays open too, which makes it easier to read.

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

- [ ] The popup shows only "Open an Astro-Seek birth chart to use Chart Bridge."

## Test 8: another website

Go to `https://example.com`.

- [ ] The popup shows the same sentence as test 7, and the Console has no errors.

## Test 9: a Chrome page

Go to `chrome://extensions`.

- [ ] The popup shows the same sentence again, and the Console has no errors.

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

## Not covered by hand yet

- **Enter offset**: no real Astro-Seek page has been seen without a Universal Time line, so this screen can't be reached in Chrome yet. `test/popup-model.test.js` covers what it shows and its preview.

## If a check fails

Note the test number, take a screenshot of the popup, copy anything in its Console, and for tests 1, 4 and 11 copy the Stellarium tab's full address.
