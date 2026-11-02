# AAF files

AstroChart Bridge opens charts from AAF files and saves the charts it reads as AAF. AAF, the Astrologisches Austauschformat, is a plain-text format for birth data that several astrology programs read and write. AstroChart Bridge follows AAF'97, the last published version, plus the forms Astrolog 8.00 writes.

AAF is not Solar Fire's `.SFcht` format and not Astro-Databank's XML. AstroChart Bridge reads neither.

The parser and writer are in `extension/core/aaf.js`; the screens are in `extension/aaf-model.js`.

## Opening an AAF file

1. Open the popup on any page that isn't a chart, and click **Open an AAF or Morinus file**. A new tab opens the import page (`import.html`), which also opens Morinus files ([docs/morinus-hor.md](morinus-hor.md)).
2. Choose or drop a `.aaf` file anywhere on the page, or paste the text and click **Read pasted text**. The file is read in the browser and isn't sent anywhere.
3. The page lists every chart in the file by name, local date and time, and birthplace. A file with one chart shows it at once.
4. Choose a chart. Its screen is the popup's: name, local time, offset, UTC, birthplace and coordinates, with **Open Stellarium Web**, **Open chart in Astro-Seek**, **Save as AAF file** and **Enter in astro.com…**. The astro.com screen puts the file's first and last name in astro.com's First name and Last name boxes, where you can change them before opening the form.

A chart that can't be opened is still listed, and choosing it says why (see [What isn't opened](#what-isnt-opened)). A record that can't be read is listed as "Line N: unreadable record", and choosing it names the line and the value.

## Saving a chart as AAF

**Save as AAF file** appears on every screen that has a decided UTC:

- an Astro-Seek or astro.com chart page
- a Stellarium Web tab
- a chart opened from an AAF file or a Morinus file

It doesn't appear while you still have to choose between readings or type an offset. The screenshot page doesn't offer it yet.

The file is named `chart-YYYY-MM-DD.aaf` after the date it gives. It is made in the browser, saved through the browser's own download, and holds one chart.

## What AstroChart Bridge reads

A file is a stream of records. Each starts with a line `#A93:` and may go on with `#B93:`, `#ZNAM:` and other chunks.

- **Before the first record:** everything is ignored.
- **`#:` lines:** comments, ignored.
- **Lines that don't start with `#`:** continue the chunk above.
- **Spaces around fields:** ignored.
- **`*` in any field:** the value is unknown.

| Chunk | Fields | Read as |
| --- | --- | --- |
| `#A93` | last name, first name, sex, date, time, place, country | Date `d.m.y` with an optional `g` or `j` for the calendar; without one, dates before 15 October 1582 are Julian. Time `h:m:s`, `22h30`, `19h` or `7`. |
| `#B93` | Julian Day, latitude, longitude, offset, time type | Coordinates like `40n43` or `15s53:03` (Astrolog writes `40N43`). Offset like `5hw00`, `1he` or `0h` (Astrolog writes `5W` or `5:30E`). The time types are listed under [Time zones](#time-zones). |
| `#ZNAM` | zone name | Shown beside the local time, never checked. |
| any other | | Kept as written while reading. Not used, and not written back. |

A record whose `#A93` doesn't have exactly 7 fields, or whose `#B93` doesn't have exactly 5, is refused: AAF has no way to put a comma inside a field.

## Time zones

AAF gives the local civil time in `#A93`, then in `#B93` the offset from Greenwich **without daylight saving**, and a time type that says how much daylight saving to add:

| Time type | Meaning | Added |
| --- | --- | --- |
| `0` | standard time | 0 |
| `1` | daylight saving | 1 hour |
| `w` | war time (the same as `1`) | 1 hour |
| `2` | double daylight saving | 2 hours |
| `h` | half-hour daylight saving | 30 minutes |
| `L` | local mean time | refused |
| `m` | a special meridian, such as a capital's local time | refused |

The UTC is the local time minus the offset and the daylight saving.

AAF'97 says a Julian Day in `#B93`, when it isn't `*`, takes precedence over the date, time and time type. AstroChart Bridge doesn't pick one: when the Julian Day and the UTC worked out from the other fields differ by more than a minute, the chart is refused as `julian-day-mismatch`.

`#ZNAM` is only a label. AAF'97 notes that no standard defines zone abbreviations, so AstroChart Bridge shows it and never uses it to decide the time.

## Unknown and approximate birth times

- **A time of `*`:** the chart is listed but refused as `no-birth-time`. AstroChart Bridge never fills in noon or any other time.
- **A time given only to the hour, such as `19h`:** opened at the hour, with a warning that the file gives the hour only.
- **"Approximate" times:** AAF has no field for them. A rating or note in `#SRC` or `#COM` isn't read, so a chart is never marked as more or less certain than its fields say.

## What isn't opened

Each of these is refused with its own message and code, rather than guessed:

| Code | Why |
| --- | --- |
| `no-birth-date`, `no-birth-time` | The date or time is `*`. |
| `no-coordinates` | The latitude or longitude is `*`, or there is no `#B93`. Never treated as 0°, 0°. |
| `no-offset` | The offset is `*`. Never treated as UTC. |
| `unknown-daylight-saving` | The time type is `*`. |
| `local-mean-time`, `meridian-time` | Time type `L` or `m`, as the astro.com reader refuses local mean time. |
| `offset-seconds` | An offset such as `0he21:48`, which AstroChart Bridge can't send to Stellarium or Astro-Seek yet. |
| `offset-out-of-range` | Offset and daylight saving together outside -12:00 to +14:00. |
| `julian-calendar` | A Julian date, marked `j` or before 15 October 1582. |
| `pre-gregorian-date` | A Gregorian date (marked `g`) before 15 October 1582. |
| `julian-day-mismatch` | See [Time zones](#time-zones). |

## What AstroChart Bridge writes

- **Chunks:** only `#A93` and `#B93`, in the AAF'97 forms (`40n43`, `74w00:15`, `5hw00`, `5he30`, `0h`).
- **Julian Day:** written as `*`, as AAF'97 recommends.
- **Unknown names and places:** written as `*`. Nothing is filled in.
- **The time:**
  - **Local time with the standard offset and a time type**, when the source states both: a chart opened from AAF, or an Astro-Seek chart whose zone label AstroChart Bridge checks against the printed UT (EST, EDT, EWT, AEST, AEDT).
  - **Universal Time** (`0h`, time type `0`) for every other chart, and the screen and a `#:` comment in the file say so. That covers an astro.com chart (astro.com states only the total offset, daylight saving included), a Stellarium Web tab (no birthplace time zone) and an Astro-Seek chart whose label isn't checked. The UTC is the same either way; only the local wall-clock time is lost.
- **War time** is written as `1`. AAF'97 calls `w` and `1` the same, and Astrolog 8.00 reads `1` but not `w`. Time types `2` and `h` from an imported file are written as they are.
- **A `#ZNAM` zone name** goes in a `#: Zone name:` comment, because Astrolog 8.00 refuses any file that contains `#ZNAM`. Other chunks of an imported file (`#SRC`, `#COM` and the rest) aren't written.
- **A comma** in a name or place becomes a semicolon, as Astrolog writes it, and **a line break** becomes a space. AAF has no escape for either.
- **Encoding and line endings:** UTF-8 without a byte order mark, with LF line endings. AAF'97 names no encoding. A file that isn't UTF-8 is read as Windows-1252, with a warning to check the names.

## Compatibility

### Checked

**Astrolog 8.00**, built from its published source (`ast80src.zip`) on 2026-11-01 without X11:

- **Reading AstroChart Bridge's files:** it loaded every file AstroChart Bridge saved from the Astro-Seek fixtures (New York 2024, Sydney 2024, New York 1944 war time), from an astro.com-style chart and a Stellarium sky in Universal Time, and from AAF charts with seconds, a half-hour offset, Unicode names and two records in one file. For each, the Julian Day it wrote back matched AstroChart Bridge's UTC to within 0.03 seconds. With two records it shows the last one, as its documentation says.
- **AstroChart Bridge reading Astrolog's files:** AstroChart Bridge reads the files Astrolog writes, kept in `fixtures/aaf/`.
- **Astrolog's limits:**
  - It refuses a file with a `#ZNAM` line ("has a line that can't be parsed").
  - With time types `w`, `h`, `m` or `*` it computed a different instant: an April 2024 chart came back with a Julian Day in February 2023. It handled `0`, `1` and `2`.

### Not checked

- **astro.com's AAF export.** No export has been captured. Astrolog's documentation says astro.com shows each saved chart as two lines of AAF, and astro.com's wiki says the option appears only for profiles with more than 10 saved charts. Until a real export is added to `fixtures/aaf/`, nothing here relies on how astro.com writes AAF.
- **Other programs that read AAF**, including the German-language programs AAF came from. Their encodings and line endings haven't been checked.
- **Solar Fire and Astro Gold.** astro.com's wiki says Solar Fire doesn't support AAF.

## Sources

- AAF'97, as excerpted at https://www.astro.com/astrowiki/en/AAF (read 2026-11-01).
- Astrolog 8.00 documentation, https://www.astrolog.org/ftp/astrolog.htm, and its source, `io.cpp` (`FProcessAAFFile`, `FOutputAAFFile`).
