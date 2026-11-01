# Pasting chart text

AstroChart Bridge can read birth data from text you copy out of an astrology program, a chart report, a PDF or your own notes. You check the values on a form, correct any that are wrong, and then open the sky in Stellarium Web or the chart in Astro-Seek, or enter it in astro.com's form.

The text is read on your computer. Nothing is sent anywhere until you click **Open sky** or **Open chart in Astro-Seek**, and then only the date, time and coordinates go to that site. astro.com's form gets the name as well (see [Required and optional fields](#required-and-optional-fields)), and astro.com gets it all when you submit that form. **Share…** sends nothing either: it opens a chart page in this browser, and the chart leaves it only if you copy, show or download it there. The text isn't saved: closing the tab forgets it.

## How to

1. Click the AstroChart Bridge icon on any page that isn't a chart, then **Paste chart text instead**. An AstroChart Bridge tab opens.
2. Click the big box and paste with **⌘V** (Mac) or **Ctrl+V**. The form appears at once.

   Or click **Paste from clipboard**. Your browser may ask whether AstroChart Bridge can read the clipboard, or refuse; if it does, paste into the box instead. AstroChart Bridge never reads the clipboard without that click.

   If you type the text instead of pasting it, click **Read the text** when you're done.
3. Check each of the five boxes. Under each box, a grey line shows the line of your text it came from, and the line just below the box shows what AstroChart Bridge made of it, such as `122°19'56"W` or `22:30 at the birthplace`.
4. Fill in any empty box. You can type a value in any form the text could have used.
5. Click **Continue**. It stays faded until all five boxes read.
6. Check the Local time, Offset, UTC and Place rows, then click **Open sky** or **Open chart in Astro-Seek**, **Share…** (see [Sharing](#sharing)) or **Enter in astro.com…**. **Back to the form** returns to the form as you left it.

## Sharing

**Share…** opens AstroChart Bridge's chart page in a new tab with the chart in its link, as it does for a chart page or a screenshot. From there you can copy the link, show it as a QR code or download it as a `.astrochart.json` file. See `docs/portable-charts.md`.

A shared chart holds only the local date and time, the UTC offset and the coordinates, and says it came from pasted text and whether the offset was one the text gave or one you typed. The name, place, time zone, house system and zodiac from the text aren't in it. Whoever opens it sees a warning that nothing checked its offset against the birthplace and date.

A chart dated before 15 October 1582 opens the sky but can't be shared yet.

## What it reads

AstroChart Bridge reads lines that have a label it knows, followed by a colon or an equals sign. It ignores every other line, so planet positions, aspects, transit dates and interpretation text can stay in what you paste.

Labelled fields:

```
Name: Example Person
Date of Birth: June 15, 1985
Time of Birth: 10:30 AM
Place: Seattle, Washington, USA
Timezone: PDT (UTC-7)
House System: Placidus
Zodiac: Tropical
```

A report, with the date and time on one line and coordinates in degrees and minutes:

```
Natal Chart

Born: 15 June 1985 at 10:30 AM
Location: Seattle, Washington
Coordinates: 47°36'N 122°19'W
Time Zone: GMT -7
House System: Placidus
```

Key-value text:

```
birth_date=1985-06-15
birth_time=10:30
latitude=47.6062
longitude=-122.3321
utc_offset=-07:00
house_system=placidus
zodiac=tropical
```

All three examples use invented birth data.

### Labels

Capitals, underscores, dashes and words in brackets don't matter: `Date of Birth (local time)`, `birth_date` and `Birth-Date` all read as the birth date.

| Field | Labels |
|---|---|
| Date, and optionally time | Born, Date of Birth, Birth Date, Birthdate, DOB, Date and Time of Birth, Birth Date and Time |
| Time | Time of Birth, Birth Time |
| Latitude and longitude together | Coordinates, Coords, Latitude, Longitude |
| Latitude | Latitude, Lat |
| Longitude | Longitude, Long, Lng, Lon |
| UTC offset | UTC Offset, GMT Offset, Offset |
| Time zone | Time Zone, Timezone, Zone, TZ |
| Name | Name, Chart Name |
| Place | Place, Place of Birth, Birth Place, Birthplace, Location, City |
| House system | House System, Houses |
| Zodiac | Zodiac |
| Ayanamsa | Ayanamsa, Ayanamsha |

A bare `Date:` or `Time:` isn't read, because reports use those labels for when the report was printed.

### Values

- **Dates**: `1985-06-15`, `15 June 1985`, `15 Jun 1985`, `June 15, 1985`, `15/06/1985`, with or without a weekday in front. The year must have four digits.
- **Times**: `10:30`, `22:30:15`, `10:30 AM`, `10:30pm`, `10 a.m.`.
- **Coordinates**: decimal degrees (`47.6062`, `-122.3321`, `47.6062 N`), degrees and minutes (`47°36'N`, `47° 36' 15" N`), or a letter between degrees and minutes (`47n36`, `122w19`). In a Coordinates line, values with N, S, E or W can come in either order; without letters, latitude comes first.
- **Offsets**: `-07:00`, `-0700`, `-7`, `UTC-7`, `GMT -7`, `+05:30`, or `UTC` or `GMT` alone for zero. A local-mean-time offset can run to the second: `-05:42:58`. A date and time written in ISO form, such as `1985-06-15T10:30:00-07:00`, carry their offset.
- **House systems**: Placidus, Koch, Whole Sign, Equal, Porphyry, Regiomontanus, Campanus, Topocentric, Alcabitius, Morinus and Meridian. Any other name is shown as written.
- **Zodiac**: Tropical or Sidereal.

Signs follow the usual convention: a negative latitude is south, a negative longitude is west, and a negative offset is behind UTC.

## Text from astrology programs

AstroChart Bridge also knows the birth data layouts of Solar Fire, Astro Gold, Morinus, Valens, Planetdance, Jagannatha Hora, Kepler, Sirius, Janus, Win*Star, TimePassages and Astrolog, the same ones its screenshot page reads. When the text you paste is laid out like one of them, that program's reader fills the boxes too, and a note below the form names the program. A box filled this way says "Read as Jagannatha Hora's text" (or whichever program it was) under it, in place of a line number.

These readers check what the program printed with it: a sidereal time must fit the time and longitude, a weekday must fall on the date, and a zone label must give the offset. Text that fails a check isn't used. The form then shows only what the labelled lines give, with a warning naming the check, such as `sidereal-mismatch`, so you can enter the values by hand.

The two readings are compared box by box:

- **Both read a value alike**: the box keeps the line it came from.
- **Only the program's reader reads it**: the box says so. This is how Jagannatha Hora's `Time Zone: 8:00:00 (West of GMT)` fills the offset box.
- **They read it differently**: the box stays empty and offers both, so you pick. An ambiguous date stays ambiguous, with the program's reading among the choices.

Solar Fire, Astro Gold, Janus and Win*Star write an offset west of Greenwich with a plus sign: their `PDT +7:00` is UTC−07:00. The form says so when it reads one of them. Win*Star labels its offset `ZONE:`, which the labelled-line reader also reads, the usual way round, so its offset box always offers both. Text from somewhere else can look like Astro Gold's, with a `Latitude` row and a `Timezone` row. Then `Timezone: -07:00` is offered both ways round, but `Timezone: PDT -07:00` fills the box with `+07:00`, since only Astro Gold's reader reads an offset after a zone label. Check the line under the offset box against what the text means.

Morinus doesn't print the offset, so its offset box stays empty for you to fill in.

## Required and optional fields

The sky and the chart need all five of:

- the birth date,
- the local birth time,
- the latitude,
- the longitude,
- the UTC offset in force at the birthplace at that time, daylight saving included.

Everything else is shown on the form for you to compare and is never sent: the place, the time zone as written, the house system, the zodiac and the ayanamsa.

The name goes only to astro.com's form. **Enter in astro.com…** puts all of it in the Last name box, as astro.com keeps an event's name, and you can move part of it to First name, change it or clear it before opening the form. Astro-Seek, Stellarium Web and shared links and files never get it.

## Time zones and offsets

AstroChart Bridge works out the UTC time from the local time and the offset, and nothing else. It doesn't look up time zones or their history.

- **An offset in the text** fills the offset box, for example from `Timezone: PDT (UTC-7)`, `Time Zone: GMT -7` or `utc_offset=-07:00`.
- **A zone name with no offset**, such as `PDT`, `BST` or `America/Los_Angeles`, leaves the box empty, and the form names the zone so you can enter its offset. Abbreviations like these mean different offsets in different places and years.
- **Two different offsets** in the text leave the box empty and offer each, with its line, for you to pick.
- **Nothing checks the offset** against the birthplace and date. Daylight saving, war time and historical zone changes are all up to the offset you confirm, so check it in an atlas when you're unsure.

Because the offset fixes the instant, a time skipped or repeated when the clocks changed doesn't need a separate choice: the offset you enter decides which one is meant.

## What else the form asks about

- **An ambiguous date**, such as `04/05/1985`, leaves the date box empty and offers both readings, 4 May and 5 April. AstroChart Bridge never picks one.
- **A missing or unreadable birth time** leaves the time box empty or as written. It is never filled in as noon or midnight.
- **A place with no coordinates** isn't looked up. Enter the latitude and longitude yourself.
- **More than one birth date or name** means the text may hold more than one chart, and AstroChart Bridge asks you to paste one at a time.

## Known limitations

- **Astro-Seek's settings**: the Astro-Seek chart always opens with Placidus houses in UT/GMT at the coordinates, rounded to the minute, with no city. When the text names another house system or the sidereal zodiac, the form warns you to set it in Astro-Seek. Stellarium Web shows the sky, which has no houses or zodiac.
- **One value per line**: a label whose value is on the next line, as in text copied from an Astro-Seek chart page, isn't read. Open the Astro-Seek page itself and use the AstroChart Bridge icon there instead.
- **Unlabelled lines**: text with no labels, such as `15 Jun 1985` and `10:30 AM PDT` on lines of their own, isn't read yet.
- **West-positive programs**: some astrology programs write west longitudes or west-of-UTC offsets as positive numbers without a letter. In labelled lines, those are read the usual way round, so check the hemisphere letter under each box. Only the program layouts above are read their own way round.
- **Calendars**: dates are read in the Gregorian calendar, including dates before a country adopted it.
- **Desktop programs**: the program layouts were tested with text written out from each program's screenshots and guides. Of these, only Jagannatha Hora's block is known to be text the program itself gives to copy. How the others' text comes out of a copy command hasn't been checked.
- **Size**: up to 100,000 characters. Longer text is refused; paste only the part with the birth data.

## Reporting text it can't read

If text from an astrology program or website doesn't read, or reads wrong, open an issue at <https://github.com/KevinBlakeLopez/astrochart-bridge/issues> with:

- the program or site, and its version,
- how you copied the text (a menu command, selecting and copying, a saved file),
- the text itself, with **invented birth data** in place of any real person's,
- what the form showed, and what you expected.

A few real examples of a program's text are more useful than a description of it.
