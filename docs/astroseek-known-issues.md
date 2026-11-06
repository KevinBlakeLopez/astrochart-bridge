# Astro-Seek known issues

Behaviour of astro-seek.com that AstroChart Bridge has to work around or that should be reported upstream. Each entry separates what has been verified from what has not.

## Asteroids chart: Vertex sometimes shown at an equinoctial degree

- **Page:** `/calculate-asteroids/`
- **Symptom:** when viewing the asteroids chart, the Vertex is sometimes displayed at an equinoctial degree (0° Aries or 0° Libra). For the same birth data, the natal page shows the Vertex at Scorpio 0°24′ (`fixtures/astroseek/ny-2024-04-17.json`, page text line 405).
- **Status:** known defect, deferred. Observed manually in the browser. Not yet captured in the defective state, and not checked against an independent Vertex calculation. The asteroids capture in `fixtures/astroseek/asteroids-ny-2024-04-17.json` shows the Vertex at 0°24′ in its text, the same as the natal page, so the defect did not appear that time; it may only show in the drawn chart or only sometimes.
- **Not yet known:** which tab or view state shows it, and whether it affects every chart or only some.
- **Hypothesis (unverified):** the asteroids URL sends `hid_vertex=on&hid_vertex_check=`, while the natal URL sends `hid_vertex=1`. A longitude of exactly 0° or 180° would fit a Vertex that was never calculated.
- **Impact on AstroChart Bridge:** none. AstroChart Bridge reads only the birth date, time, place and Universal Time, never the Vertex, and it accepts the asteroids page as a natal chart. The page's header uses the same format as the natal page.
- **When picked up:**
  1. Capture the page in the defective state with the download snippet.
  2. Compare its Vertex with an independent calculation.
  3. If it is confirmed, report it through the Contact link in the site footer.

Example URL (invented chart data, same birth data as the New York fixture):

```
https://horoscopes.astro-seek.com/calculate-asteroids/?narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024&narozeni_hodina=08&narozeni_minuta=00&narozeni_sekunda=00&narozeni_mesto_hidden=New%20York&narozeni_stat_hidden=US&narozeni_podstat_kratky_hidden=NY&narozeni_tzid_id=156&narozeni_city=New%20York,%20USA,%20New%20York&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1&narozeni_timezone_form=auto&narozeni_timezone_dst_form=auto&house_system=placidus&styl_graf=&hid_fortune=on&hid_fortune_check=&hid_spirit=&hid_spirit_check=on&hid_syzygy=&hid_syzygy_check=on&hid_vertex=on&hid_vertex_check=&hid_chiron=&hid_chiron_check=on&hid_lilith=&hid_lilith_check=on&hid_uzel=&hid_uzel_check=on&tolerance=1&tolerance_paral=0&nick=&hide_aspects=0&duha=&hide_trans=&display_trans=&aya=&house_start=&naksha_posun=&naksha_nasobek=&custom_aya=&&&radix=1&aktivni_tab=1&ast_symbol=text&asteroidy_ukazat=1
```

Other specialised charts (draconic, harmonic, heliocentric and similar) may have similar problems. None has been checked yet.

## Birth chart: a longitude of 180° is drawn at 0°

- **Page:** `/calculate-birth-chart-horoscope-online/`, with the place entered as coordinates.
- **Symptom:** sent 16°30'S at 180°0'E or at 180°0'W, Astro-Seek prints the place as 0°0'E or 0°0'W and draws the chart at Greenwich (`fixtures/astroseek/date-line-180-east.json` and `date-line-180-west.json`, captured 6 November 2026).
- **Status:** worked around. Sent 179°59'W for the same chart, it prints and draws 179°59'W (`fixtures/astroseek/golden-fiji-180-west.json`). Not checked: 179°59'E, a place typed as a city rather than coordinates, and whether Astro-Seek's own form allows 180 at all.
- **Workaround in AstroChart Bridge:** `astroSeekUrl` and `astroSeekSaveUrl` send a longitude that rounds to 180°0' as 179°59' on the same side, 1' away, and every screen with an Astro-Seek button warns that it does (`test/date-line.test.js`). The extension also refuses to read back an Astro-Seek page whose place doesn't match its address, so a page drawn at 0° is never read as the chart.
- **When picked up:** report it through the Contact link in the site footer, with the two date-line captures' addresses.
