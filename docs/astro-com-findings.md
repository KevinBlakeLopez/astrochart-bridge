# Astro.com findings

What astro.com pages expose of a chart's birth data, gathered on 2026-11-01 before any astro.com code was written. Each finding says how it was seen and on how many samples. Hypotheses are marked as such.

The account chart below, "Test", uses the same invented birth data as the Astro-Seek New York fixture: 17 April 2024, 08:00, New York, 40°43'N 74°0'W.

## Two kinds of chart

- **Account charts.** Birth data saved in an astro.com account; making one needs an account. The chart URL refers to the saved entry by number (`nhor`) and carries no birth data:

  ```
  https://www.astro.com/cgi/chart.cgi?btyp=w2gw&rs=2&;&nhor=26
  https://www.astro.com/cgi/chart.cgi?gm=a1&nhor=26&nho2=1&btyp=2&mth=gw&sday=1&smon=11&syr=2026&rs=0
  https://www.astro.com/cgi/chart.cgi?;smon=11;rs=0;sday=2;btyp=2;syr=2026;mth=gw;clang=e;gm=a1;nhor=13
  ```

  The last address separates its parameters with `;`, which astro.com reads like `&`. `URL.searchParams` splits on `&` only, so it reads that query as one parameter named `;smon`.

- **Astro-Databank charts.** Public entries such as `https://www.astro.com/astro-databank/Stallone,_Sylvester`. The chart thumbnail on that page links to `chart.cgi?wgid=…`, and the `wgid` value carries the birth data.

## The chart page shows birth data only in the image

- **Seen:** the `btyp=2` account chart (captured logged in), and the Einstein and Stallone Databank chart pages (logged out).
- The page text (`document.body.innerText`) has no birth time, place or Universal Time. The account chart's text has no birth date either, and a Databank chart's text has only the date, in its heading. The header with all of those values is drawn into the chart PNG:

  ```
  Name: Test
  date: We., 17 April 2024          Time:        8:00 a.m.
  in New York, NY (US)              Univ.Time:  12:00
  74w00, 40n43                      Sid. Time:  20:48:26
  Event Chart (Method: Web Style / Placidus)
  ```

- The `btyp=w2gw` layout of the same chart prints the header without the `Name:`, `date:` and `in` prefixes. Neither layout prints a zone name.
- Image alt text: "Free Astrology Chart 100%" on the account chart; "Astro-Databank chart of Sylvester Stallone, born on 6 July 1946 90%" on a Databank chart. The Databank page's title and heading repeat that sentence without the percentage. Only the date can be read from any of them.
- On an account chart, the page text includes the "Horoscope for:" list, which names every chart saved in the account. Chart Bridge should not read `innerText` on astro.com chart pages, and fixtures must not store it.
- `sday=1&smon=11&syr=2026` on the `btyp=2` URL was the day of the visit. That page was an ordinary natal chart ("Event Chart"), not transits. What the parameters do is unknown.

## The `nd=` record

Account charts and Databank charts carry the birth data in the same comma-separated record, `nd=`. Fields by position, from five samples: the account chart "Test", the Databank entries for Albert Einstein, Donald Trump and Sylvester Stallone, and one further account entry (`nd2=`, below).

| # | Test (account) | Stallone (Databank) | Meaning |
|---|---|---|---|
| 1 | *(empty)* | `Stallone` | Last name |
| 2 | `Test` | `Sylvester` | First name, or the chart's name |
| 3 | `e` | `m` | `m` male. `e` matches "Event Chart" in the image header. |
| 4–6 | `17,4,2024` | `6,7,1946` | Day, month, year |
| 7 | `8:00` | `19:20` | Local time, `H:MM`. `H:MM:SS` seen once (`7:30:03`). |
| 8 | `h4w` | `h4w` | Zone code, see below |
| 9 | `gad` | `gad` | Unknown. `gad` with every daylight-saving `h` zone seen, `gas` with the one standard-time `h` zone (below), `gal` with every `m` zone. **Hypothesis:** the last letter is the zone kind (`d` daylight saving, `s` standard time, `l` local mean time). The `ga` before it is unexplained. |
| 10 | `0` | `0` | Unknown |
| 11 | `New York` | `New%20York` | Place. Percent-encoded inside `wgid` only. |
| 12 | `NY (US)` | `NY%20(US)` | State or country |
| 13 | `74w00` | `74w0` | Longitude |
| 14 | `40n43` | `40n43` | Latitude |
| 15 | `f` | `u` | Unknown. `u` on every Databank sample, `f` on every account entry. |
| 16–17 | `45,-24500` | `45,-24500` | Unknown. The same in all three New York samples (Einstein in Ulm has `2519,2516`), so probably an atlas or zone reference. |
| 18 | `61` | `0` | Unknown |

The full Databank records, decoded from their `wgid`:

```
Einstein,Albert,m,14,3,1879,11:30,m10e0,gal,0,Ulm,GER,10e0,48n24,u,2519,2516,0
Trump,Donald,m,14,6,1946,10:54,h4w,gad,0,Jamaica%20Hospital%20Queens%20(Queens%20County),NY%20(US),73w4859,40n42,u,45,-24500,0
Stallone,Sylvester,m,6,7,1946,19:20,h4w,gad,0,New%20York,NY%20(US),74w0,40n43,u,45,-24500,0
```

Place names contain no commas in any sample, but a reader should split the record on commas before percent-decoding.

### Names and place, as AstroChart Bridge reads them

The reader takes fields 1, 2 and 11 as an account chart's last name, first name and town, for Astro-Seek's Name and Birth city. Unlike the date, time, zone and coordinates, a chart opens without them, so any of the three it can't read cleanly is left out rather than refusing the chart: empty or blank, containing a `%`, or not valid UTF-8. Not yet seen:

- **An account chart with both names.** "Test" has only field 2. That field 1 holds the last name rests on the Databank records above.
- **A non-ASCII name or place.** Inside a `pgid`, the record arrives one character per byte, since `atob` decodes the base64. The reader decodes those bytes as UTF-8. If astro.com writes Latin-1 instead, a name like "Zürich" isn't valid UTF-8 and is left out, and the person types the town.
- **A percent-encoded account record.** Only the Databank's `wgid` records are percent-encoded. A `%` in an account record's name or place is left out rather than decoded.

### Zone codes

- **`h4w`:** whole hours west of Universal Time, with daylight saving already applied. **Verified** on "Test": 8:00 local at UTC−04:00 gives 12:00, the Univ.Time printed in its image. The Databank pages for Trump and Stallone print it as `EDT h4w (is daylight saving time)`.
- **`h5w` with field 9 `gas`:** standard time, seen once, on an account chart for 6 January 1947, 7:01, in Pennsylvania (read on 2026-11-01 with a console snippet that printed fields 4 to 10 only). 7:01 local at UTC−05:00 gives 12:01, the Univ.Time printed in its image, so the `h` code is the offset as it stands whether field 9 says `gad` or `gas`.
- **`m10e0`:** local mean time for the meridian 10°0'E. Einstein's Databank page prints `LMT m10e0 (is local mean time)`. The offset is 4 minutes per degree, so 40 minutes here.
- **`m0w10`:** local mean time for 0°10'W, seen once. Its offset is 40 seconds, which shows local-mean-time offsets are not always whole minutes.
- **Not yet seen:** half-hour and quarter-hour zones, and `h` zones east of Universal Time. A form such as `h5e30` would fit the pattern but is a guess.

### Coordinates

Degrees, then `n`, `s`, `e` or `w`, then either minutes in one or two digits (`74w0`, `74w00`) or minutes and seconds in four digits (`73w4859`, 73°48'59"W). Any other form is unexplained and should be refused.

## Where each kind of chart keeps `nd=`

### Databank chart URL: `wgid`

- **Format:** `wg` followed by base64url of zlib-compressed text. The text is `;`-separated `key=value` pairs:

  ```
  wiki=2;gm=a1;nd=Stallone,Sylvester,…;adbname=Sylvester%20Stallone,;adbdate=6%20July%201946;btyp=2;mth=atw;rs=1;otm=1WG
  ```

- The keys `gm`, `btyp`, `mth` and `rs` are also `chart.cgi` query parameters, so `wgid` looks like a packed query string in which a Databank chart carries `nd=` where an account chart carries `nhor=`.
- Every sample ends in `WG`. Its meaning is unknown.
- **Decoding:** Node's `zlib.inflateSync` and the standard `DecompressionStream("deflate")` both read it (checked in Node 24 on four samples from three Databank entries). `DecompressionStream` also exists in Chrome but hasn't been run there on a sample yet. It is asynchronous, so a reader built on it can't stay synchronous like the Astro-Seek one.
- The Stallone chart page, viewed logged out, has no `pgid` link (below).

### Databank person page: labelled text

The page at `/astro-databank/<Name>` prints the birth data as text, each line a label, a tab and a value. On the Stallone page each label appears exactly once:

```
born on	6 July 1946 at 19:20 (= 7:20 PM )
Place	New York, New York, 40n43, 74w0
Timezone	EDT h4w (is daylight saving time)
```

- **Seen** on the Einstein, Trump and Stallone pages. The label counts were checked on Stallone only.
- The zone line gives a name and a code, which can be checked against each other. `EDT` is already in `ZONE_OFFSETS` at −240, which matches `h4w`.
- The time is printed twice, in 24-hour and 12-hour form.
- The chart thumbnail (alt "Sylvester Stallone, - natal chart (Placidus)") links to the chart page, whose `wgid` holds the same record.

### Account chart page: the `pgid` link

- **Seen** once, on the `btyp=2` account chart, logged in to an account without a subscription.
- The "Drawing (for subscribers)" link reads `https://www.astro.com/cgi/sub.cgi?&sumode=spg&lang=e&pgid=L496L…&ajax=1`.
- `pgid` is `L`, a number, `L`, then base64url text with no compression. The number is the length of that text (496 in the sample). The text decodes to a chart URL whose query includes:

  ```
  gm=a1  btyp=2  mth=gw  sday=1  smon=11  syr=2026  rs=0  lang=e  refpl=go
  nd=,Test,e,17,4,2024,8:00,h4w,gad,0,New York,NY (US),74w00,40n43,f,45,-24500,61
  nd2=<the chart in the second slot>
  tit=Free Astrology Chart  titn=Test  secc=<32 hex digits>
  ```

- `nd2=` is the chart in the account's second slot (`nho2`), not the one drawn. A reader must take `nd=`.
- `gm`, `btyp`, `mth`, `sday`, `smon`, `syr` and `rs` match the page's own URL, which can show that the link belongs to the page.
- `secc` is unknown. Its length fits a hash, possibly a signature over the rest.
- **On the `btyp=w2gw` layout,** seen signed in on 2026-11-05 in Firefox, with a console snippet that printed the parameter names and the `btyp`, `mth` and `rs` values only: the page has one drawing link. Its chart URL carries `btyp`, `rs`, `lang`, `refpl`, `nd`, `tit`, `titn` and `secc`, in that order. It says `btyp=w2gw` and `rs=2`, like the page's own URL, and has no `mth`, `gm`, dates or `nd2` (that page's URL had no `nho2`). The `nd=` record itself wasn't printed.
- **Not yet known:** whether the link exists on other chart types, or for subscribers.

Other links on the same page carry no birth data. `ade.cgi?ract=xx…` (edit birth data) and `bugrep.cgi?…&purl=xx…` carry the chart URL hex-encoded after `xx`. `bugrep.cgi` links also carry an account identifier in `cid=`, and the chart image's path (`/tmpd/c…/`) contains the same identifier. Fixtures must leave both out.

## Sidereal time as a check

The image's `Sid. Time: 20:48:26` is the local sidereal time at the birthplace. Computed from Universal Time 12:00 on 17 April 2024 and longitude 74°0'W with the usual approximate formula for Greenwich mean sidereal time, it comes to 20:48:26.3. Because it depends only on Universal Time and longitude, it could confirm both. It is in the image, though, so Chart Bridge can't read it today. One sample.

## Birth data form: the time zone

Seen signed out on 2026-11-01, on `/cgi/ade.cgi` with test dates only. Nothing was submitted.

- **The time zone select, `szon`,** starts on `au`, "automatic time zone", which astro.com recommends. Its other values are zone codes in the same form as `nd=` field 8: `h0w` is " 00:00 GMT / UT", and a half-hour zone is written like `h3w30` ("w03:30 Newfoundl.T"). Choosing any of them makes the page warn "Attention! manual time zone settings are not recommended. Most likely a false chart will be the result."
- **Choosing a town** from the list the page shows as you type fills a hidden field, `spli`, with astro.com's atlas record for it: `New York,NY (US),74w00,40n43,f,45,-24500,61`, the same as `nd=` fields 11 to 18. The list comes from `adejs.cgi?func=place_query`, one match per line, the text shown and that record separated by `|`.
- **The zone astro.com picks** then appears in `#zz`, inside the extended settings, floated right of the select. The page gets it from `adejs.cgi?func=get_su_mo_asc_map`, sending the date, time, `szon` and `spli`; its JSON's `zz_content_html` is the line. What it said for New York unless noted:

  | Date and time | `#zz` after "time zone:" |
  |---|---|
  | 17 April 2024, 08:00 | `4 h west, Daylight Saving T.` |
  | 15 January 2024, 08:00 | `5 h west, Standard Time` |
  | 10 January 1944, 08:00 | `4 h west, War Time` |
  | 15 January 1850, 08:00 | `Local Mean Time`, with no offset |
  | 14 March 2021, 02:30 (skipped) | `5 h west, Standard Time` and "ATTENTION: Clock time was skipped over by shifting time meridian to the east. Unchanged clock assumed." |
  | 7 November 2021, 01:30 (repeated) | `4 h west, Daylight Saving T.` and "ATTENTION: Same hour occurs twice, could be daylight time or standard time." |
  | St. John's, 15 January 2024 | `3 h 30 min west, Standard Time` |
  | Kolkata / Kathmandu, 15 January 2024 | `5 h 30 min east` / `5 h 45 min east, Standard Time` |
  | London, England, 15 January / 17 April 2024 | `GMT/UT, Standard Time` / `1 h east, Daylight Saving T.` |

  The comma is followed by a no-break space, and `<br>`s separate "time zone:", the zone and any warning, so in `textContent` they run together. With no hour chosen, the request returns nothing.
- **Typing "London" lists London (Conecuh County), Alabama first,** whose zone on 17 April 2024 is `5 h west`. A town picked in a hurry can give a zone hours away from the chart's, with no warning from astro.com.

AstroChart Bridge fills in a chart's local time with `au` and reads `#zz` to check astro.com's zone against the chart's offset (`watchZone` in `extension/core/astrocom.js`). A chart whose local time is Universal Time goes in with `au` too, and is checked against GMT/UT. Only a chart with no local time, such as a Stellarium sky, is filled in with `h0w`.

## Birth data form: the town list and the name

Seen signed out on 2026-11-01, on `/cgi/ade.cgi` with test dates only. Nothing was submitted.

- **The town list is jQuery UI's autocomplete** on `scit`, not the browser's own: one `ul.ui-autocomplete` added to the page, hidden with an inline `display: none` while closed. An `input` event sent by a script opens it, as typing does.
- **Each match's text ends in its coordinates**, written as in `nd=`: `London, ENG (UK) = England (UK), 51n30, 0w10`, `São Paulo, BRAS = Brazil, 23s3309, 46w3729`. "London" listed 42 matches, "New York" 23, and "Sao Paulo" without its accent found São Paulo. "New York, NY", "New York, USA" and "Paris, France" listed the same towns as the town alone.
- **A script's click on a match does what a person's choice does,** even once the list is hidden because focus moved: it fills `spli`, puts the match's text in `scit`, closes the list and looks the time zone up.
- **"New York" lists two matches at the same place,** `New York, NY (US) = New York` and `New York City, NY (US) = New York`, both 40n43, 74w00, whose `spli` records differ only in the name.
- **The form won't take a chart with no first name.** Not seen in the session above, which submitted nothing: on the same day, continuing a filled-in form with only a last name showed "Please check your data: Please write something as 'first name'."

AstroChart Bridge chooses the chart's town among the matches by the chart's coordinates (`chooseTown` in `extension/core/astrocom.js`), and asks when more than one is near and none is named as the chart's town.

## Other observations

- The first visit to astro.com showed "Checking your browser..." and cleared by itself after a few seconds. Chart Bridge reads pages the user already has open, so this doesn't affect it.

## Proposed direction (not decided)

- **Account charts:** read `nd=` from the `pgid` link, asking the tab for that link's address only, never the page text. The alternative is fetching the edit page (`ade.cgi`) in the background. That page hasn't been seen, and the fetch would be a second request made with the user's login and would need wider extension permissions.
- **Databank charts:** read the person page's text and check the zone name against the zone code. The thumbnail's `wgid` could add a cross-check later.
- **First version:** refuse local mean time (`m` zones), since `offsetMinutes` holds whole minutes only.
- **Account charts have no independent offset check.** The popup's Offset row is the only way to spot a wrong one.
- **Fixtures:** store the URL and the `pgid` link only. Make both chart slots invented charts before capturing, and leave out `cid` and the image path.

## Open questions

- Do subscribers see it?
- How are half-hour zones written in `nd=`? The form writes them like `h3w30`; no `nd=` record with one has been seen.
- What do fields 9, 10, 15 to 18, `WG` and `secc` mean?
- Does an account chart with a first and last name write them as fields 2 and 1, as the Databank does? In what encoding does astro.com write a non-ASCII name or place, UTF-8 or Latin-1? An invented chart such as Zoë Example, born in Zürich, would answer both.
- Does a chart saved with a skipped or repeated local time keep the zone the form showed? The form assumes the clock before a skip, picks daylight time for a repeated hour, and warns about both (above).
- What fields does the edit page (`ade.cgi`) show?
