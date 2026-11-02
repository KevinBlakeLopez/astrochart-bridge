# Morinus files

AstroChart Bridge opens the chart files Morinus saves (`.hor`). Morinus is a free astrology program by Robert Nagy, continued as Morinus 9.x, Morinus SE and several Python 3 ports. Every version looked at saves charts the same way, so one reader opens them all. That covers Python 2 Morinus 8.x, Morinus 9.6.4, Morinus SE 8.0.0 and the Python 3 port of 8.1/8.2.

The file is read in `extension/core/pickle.js` and `extension/core/morinus-hor.js`, and shown by `extension/hor-model.js` on the import page.

## Opening a Morinus file

1. Open the popup on any page that isn't a chart, and click **Open an AAF or Morinus file**. A new tab opens the import page (`import.html`).
2. Choose or drop a `.hor` file anywhere on the page. The file is read in the browser and isn't sent anywhere. A file is taken for a Morinus chart when its name ends in `.hor`, or when its first byte is pickle's `PROTO` opcode, which every Morinus on Python 3 writes.
3. The chart's screen is the popup's, as for an AAF chart. It shows:
   - name, local time, offset, the time as entered in Morinus, UTC, birthplace and coordinates;
   - **Open Stellarium Web**, **Open chart in Astro-Seek**, **Save as AAF file** and **Enter in astro.com…**. Morinus keeps the name in one field, so the astro.com screen puts all of it in the Last name box, where you can change it before opening the form.

A chart that can't be opened is still listed by its name, date and place, and choosing it says why. A file that isn't a readable chart says which field it stopped at.

## What a .hor file is

A `.hor` file is 27 Python pickles, one after another. Each holds one string, whole number or yes/no value, written by Morinus's `save()` in `morin.py` with one `pickle.dump` per field. Versions differ only in the pickle protocol:

| Writer | Protocol |
|---|---|
| Morinus on Python 2 | 0 |
| An earlier Morinus 9.x on Python 3.7 or before | 3 |
| Morinus 9.x today | 2 |
| Morinus SE and the Python 3 ports | Python's default: 4, or 5 from Python 3.14 |

| # | Field | Meaning |
|---|---|---|
| 0 | `name` | Chart name |
| 1 | `male` | Sex |
| 2 | `htype` | Chart type: 0 radix, 1 solar, 2 lunar, 3 revolution, 4 transit, 5 horary, 6 profections, 7 primary directions in chart |
| 3 | `bc` | The year is BC |
| 4–9 | `year` … `second` | Date and wall-clock time as entered |
| 10 | `cal` | 0 Gregorian, 1 Julian |
| 11 | `zt` | How the time was given: 0 in a zone, 1 at Greenwich, 2 local mean time, 3 local apparent time |
| 12 | `plus` | The zone is east of Greenwich |
| 13–14 | `zh`, `zm` | Zone offset in hours and minutes. Kept for every chart, but used only for a time in a zone |
| 15 | `daylightsaving` | Take one hour off. Morinus does this whatever the time type |
| 16 | `place` | Place name |
| 17–20 | `deglon`, `minlon`, `seclon`, `east` | Longitude |
| 21–24 | `deglat`, `minlat`, `seclat`, `north` | Latitude |
| 25 | `altitude` | Altitude of the place in metres, which Morinus uses for topocentric positions |
| 26 | `notes` | Free text |

Morinus works out the Universal Time as:

> time entered − 1 hour if daylight saving is ticked − the zone offset if the time is in a zone

AstroChart Bridge does the same. For every invented chart in `fixtures/morinus/`, its UTC equals the one Morinus's own code gives (`tools/hor-fixtures.json`).

A `.hor` file has none of these, so AstroChart Bridge shows none:

- a time zone or zone name;
- a history of the zone's offsets;
- double summer time;
- birth-time accuracy;
- the house system, zodiac or any other setting.

Morinus keeps its settings for all charts alike, outside the files. The offset is the one typed into Morinus, and nothing checks it against the birthplace and date; the screen says so. The notes are never read into the chart or shown.

## Safety

Morinus opens these files with Python's `pickle.load`. That builds whatever objects a file names and runs the functions it names, so a crafted `.hor` file can run code in Morinus.

AstroChart Bridge never does this. `core/pickle.js` reads the opcodes itself and knows only those that push one plain value, write the memo, or mark the protocol and its frames. Any other opcode is refused by name and byte offset, for example `GLOBAL`, `REDUCE` or `STACK_GLOBAL`, as are containers and memo reads. The file must be exactly 27 pickles of the right types, at most 256 KiB.

## What isn't opened

| The file has | The screen says | Code |
|---|---|---|
| A chart type other than radix or horary | It opens radix and horary charts only | `chart-type-unsupported` |
| A date BC | Can't open yet | `bce-date` |
| A Julian date | Can't open yet | `julian-calendar` |
| A Gregorian date before 15 October 1582 | Opens dates from then on | `pre-gregorian-date` |
| Local mean time | Can't open yet | `local-mean-time` |
| Local apparent time | Can't open yet | `local-apparent-time` |
| An offset outside −12:00 to +14:00 | Out of range | `offset-out-of-range` |
| A date not on the calendar, or coordinates past 90° or 180° | Not a real date or place | `bad-date`, `bad-coordinates` |

## Warnings

| When | What the screen says |
|---|---|
| Daylight saving is ticked on a Greenwich time | Morinus takes an hour off, and so does AstroChart Bridge |
| The file gives longitude seconds | Morinus drops them when it opens the file, so its own chart is drawn up to 59" east or west. AstroChart Bridge keeps them |
| A Python 2 Morinus saved a name or place as bytes that aren't ASCII | The bytes are read as Windows-1252; check the name and place |

## Saving as AAF

A chart entered in a zone is saved in its local time. AAF's standard offset is the zone, and its time type is 1 with daylight saving or 0 without. A chart in Greenwich time is saved in Universal Time.

## Test files

`fixtures/morinus/` holds invented charts, each written with several pickle protocols. `tools/make-hor-fixtures.py` writes them from `tools/hor-fixtures.json` with CPython's own `pickle`, the way Morinus's `save()` does, and reads each file back to check it. Run it by hand after changing that file:

```bash
python3 -I tools/make-hor-fixtures.py
```

The UT each chart gives in Morinus is in `tools/hor-fixtures.json`, computed once from Morinus 9.6.4's own code. The sample `.hor` files that Morinus repositories ship are not copied here.
