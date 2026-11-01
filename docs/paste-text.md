# Pasting chart text

Chart Bridge can read birth data from text you copy out of an astrology program, a chart report, a PDF or your own notes. You check the values on a form, correct any that are wrong, and then open the sky in Stellarium Web or the chart in Astro-Seek.

The text is read on your computer. Nothing is sent anywhere until you click **Open sky** or **Open chart in Astro-Seek**, and then only the date, time and coordinates go to that site. The text isn't saved: closing the tab forgets it.

## How to

1. Click the Chart Bridge icon on any page that isn't a chart, then **Paste chart text instead**. A Chart Bridge tab opens.
2. Click the big box and paste with **⌘V** (Mac) or **Ctrl+V**. The form appears at once.

   Or click **Paste from clipboard**. Your browser may ask whether Chart Bridge can read the clipboard, or refuse; if it does, paste into the box instead. Chart Bridge never reads the clipboard without that click.

   If you type the text instead of pasting it, click **Read the text** when you're done.
3. Check each of the five boxes. Under each box, a grey line shows the line of your text it came from, and the line just below the box shows what Chart Bridge made of it, such as `122°19'56"W` or `22:30 at the birthplace`.
4. Fill in any empty box. You can type a value in any form the text could have used.
5. Click **Continue**. It stays faded until all five boxes read.
6. Check the Local time, Offset, UTC and Place rows, then click **Open sky** or **Open chart in Astro-Seek**. **Back to the form** returns to the form as you left it.

## What it reads

Chart Bridge reads lines that have a label it knows, followed by a colon or an equals sign. It ignores every other line, so planet positions, aspects, transit dates and interpretation text can stay in what you paste.

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
- **Offsets**: `-07:00`, `-0700`, `-7`, `UTC-7`, `GMT -7`, `+05:30`, or `UTC` or `GMT` alone for zero. A date and time written in ISO form, such as `1985-06-15T10:30:00-07:00`, carry their offset.
- **House systems**: Placidus, Koch, Whole Sign, Equal, Porphyry, Regiomontanus, Campanus, Topocentric, Alcabitius, Morinus and Meridian. Any other name is shown as written.
- **Zodiac**: Tropical or Sidereal.

Signs follow the usual convention: a negative latitude is south, a negative longitude is west, and a negative offset is behind UTC.

## Required and optional fields

The sky and the chart need all five of:

- the birth date,
- the local birth time,
- the latitude,
- the longitude,
- the UTC offset in force at the birthplace at that time, daylight saving included.

Everything else is shown on the form for you to compare and is never sent: the name, the place, the time zone as written, the house system, the zodiac and the ayanamsa.

## Time zones and offsets

Chart Bridge works out the UTC time from the local time and the offset, and nothing else. It doesn't look up time zones or their history.

- **An offset in the text** fills the offset box, for example from `Timezone: PDT (UTC-7)`, `Time Zone: GMT -7` or `utc_offset=-07:00`.
- **A zone name with no offset**, such as `PDT`, `BST` or `America/Los_Angeles`, leaves the box empty, and the form names the zone so you can enter its offset. Abbreviations like these mean different offsets in different places and years.
- **Two different offsets** in the text leave the box empty and offer each, with its line, for you to pick.
- **Nothing checks the offset** against the birthplace and date. Daylight saving, war time and historical zone changes are all up to the offset you confirm, so check it in an atlas when you're unsure.

Because the offset fixes the instant, a time skipped or repeated when the clocks changed doesn't need a separate choice: the offset you enter decides which one is meant.

## What else the form asks about

- **An ambiguous date**, such as `04/05/1985`, leaves the date box empty and offers both readings, 4 May and 5 April. Chart Bridge never picks one.
- **A missing or unreadable birth time** leaves the time box empty or as written. It is never filled in as noon or midnight.
- **A place with no coordinates** isn't looked up. Enter the latitude and longitude yourself.
- **More than one birth date or name** means the text may hold more than one chart, and Chart Bridge asks you to paste one at a time.

## Known limitations

- **Astro-Seek's settings**: the Astro-Seek chart always opens with Placidus houses in UT/GMT at the coordinates, rounded to the minute, with no city. When the text names another house system or the sidereal zodiac, the form warns you to set it in Astro-Seek. Stellarium Web shows the sky, which has no houses or zodiac.
- **One value per line**: a label whose value is on the next line, as in text copied from an Astro-Seek chart page, isn't read. Open the Astro-Seek page itself and use the Chart Bridge icon there instead.
- **Unlabelled lines**: text with no labels, such as `15 Jun 1985` and `10:30 AM PDT` on lines of their own, isn't read yet.
- **West-positive programs**: some astrology programs write west longitudes or west-of-UTC offsets as positive numbers without a letter. Those are read the usual way round, so check the hemisphere letter under each box.
- **Calendars**: dates are read in the Gregorian calendar, including dates before a country adopted it.
- **Desktop programs**: no program's copied text has been tested yet. Text in the labelled or key-value forms above should read whichever program wrote it; anything else may not.
- **Size**: up to 100,000 characters. Longer text is refused; paste only the part with the birth data.

## Reporting text it can't read

If text from an astrology program or website doesn't read, or reads wrong, open an issue at <https://github.com/KevinBlakeLopez/chart-bridge/issues> with:

- the program or site, and its version,
- how you copied the text (a menu command, selecting and copying, a saved file),
- the text itself, with **invented birth data** in place of any real person's,
- what the form showed, and what you expected.

A few real examples of a program's text are more useful than a description of it.
