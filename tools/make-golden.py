#!/usr/bin/env python3
# Works out the expected values of the golden charts in fixtures/golden/, the
# reference cases every route in and out of AstroChart Bridge is tested
# against (test/golden.test.js). Run it by hand:
#
#   python3 -I tools/make-golden.py          checks every expected block
#   python3 -I tools/make-golden.py --write  writes them
#   python3 -I tools/make-golden.py --paste  reads Astro-Databank lines on stdin
#                                            into the cases waiting for them
#
# There are two kinds of case, one file each:
#
#   "invented": the record is a wall-clock time, the IANA zone that decides
#   its offset, and a place. The offset is the zone database's.
#
#   "public-record": a well-known person's birth record, copied from their
#   Astro-Databank page by the console snippet in docs/golden-charts.md and
#   kept as copied. The offset is the one the record states, since that is
#   what a chart made from it carries; the zone database's offset for the
#   record's zone is a second opinion, and where the two differ the case is
#   marked disputed. Only Rodden ratings AA and A are accepted. A case whose
#   record hasn't been copied yet has astroDatabank null, and is skipped. To
#   swap one person for another, change or replace that one file.
#
# It is Python so the expected values don't come from the code they test: the
# offset comes from the IANA time zone database through zoneinfo, which
# AstroChart Bridge never uses, the UTC from Python's datetime rather than
# JavaScript's Date, and the Julian Day from Meeus's calendar formula rather
# than the Unix-epoch arithmetic in extension/core/stellarium-desktop.js. The
# tests never run it, so they need neither Python nor a particular tzdata.
#
# A changed expected block, after a tzdata update say, is a change to review,
# never one to accept unread: a historical offset may have been corrected.
import json
import math
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, TZPATH

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASES = os.path.join(ROOT, "fixtures", "golden")

INVENTED_KEYS = {"local", "zone", "fold", "lat", "lng"}
PUBLIC_KEYS = {"zone", "fold"}
SNIPPET_KEYS = {"url", "title", "born", "place", "timezone", "dataSource", "rodden"}
ACCEPTED_RATINGS = {"AA", "A"}

MONTHS = ["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"]


def julian_day_meeus(year, month, day_fraction):
    """Meeus, Astronomical Algorithms, 2nd ed., chapter 7, for a Gregorian date."""
    if month <= 2:
        year -= 1
        month += 12
    a = year // 100
    b = 2 - a + a // 4
    return math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day_fraction + b - 1524.5


def julian_day(utc):
    seconds = utc.hour * 3600 + utc.minute * 60 + utc.second
    return julian_day_meeus(utc.year, utc.month, utc.day + seconds / 86400)


def check_julian_day():
    # Worked examples from Meeus, chapter 7, and J2000.0 by definition. If the
    # formula above were wrong these would not all come out.
    examples = [
        ((2000, 1, 1.5), 2451545.0),
        ((1957, 10, 4.81), 2436116.31),
        ((1987, 1, 27.0), 2446822.5),
        ((1987, 6, 19.5), 2446966.0),
        ((1988, 1, 27.0), 2447187.5),
        ((1988, 6, 19.5), 2447332.0),
        ((1900, 1, 1.0), 2415020.5),
        ((1600, 1, 1.0), 2305447.5),
        ((1600, 12, 31.0), 2305812.5),
    ]
    for (year, month, day), jd in examples:
        got = julian_day_meeus(year, month, day)
        assert abs(got - jd) < 1e-6, f"Meeus formula gives {got} for {year}-{month}-{day}, not {jd}"


def local_time_kind(naive, zone):
    """normal, ambiguous (it happens twice) or nonexistent (the clocks skip it)."""
    first = naive.replace(tzinfo=zone, fold=0)
    second = naive.replace(tzinfo=zone, fold=1)
    if first.utcoffset() == second.utcoffset():
        return "normal"
    back = first.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None)
    return "ambiguous" if back == naive else "nonexistent"


def zone_offset(naive, record):
    """The zone database's offset for a wall-clock time, and what kind of time it is."""
    zone = ZoneInfo(record["zone"])
    kind = local_time_kind(naive, zone)
    # fold says which of two offsets is meant, so it is required exactly when there are two.
    if kind == "normal":
        assert "fold" not in record, "fold is only for ambiguous or nonexistent times"
    else:
        assert "fold" in record, f"a {kind} local time needs fold"
    offset = naive.replace(tzinfo=zone, fold=record.get("fold", 0)).utcoffset()
    assert offset.microseconds == 0, "offset has a fraction of a second"
    return int(offset.total_seconds()), kind


# The rows of an Astro-Databank page, as the snippet copies them, in the forms
# seen on the pages read on 2026-11-05. A row in another form stops the
# script, and the parser is fixed to match, never the row.
#
#   "born on 8 January 1947 at 09:00 (= 09:00 AM )", or "at 07:08:12"
BORN = re.compile(r"^born on\s+(\d{1,2}) ([A-Za-z]+) (\d{4}) at (\d{1,2}):(\d{2})(?::(\d{2}))?\b", re.IGNORECASE)
#   "Place Brixton (London), England, 51n29, 0w06": the coordinates are the last
#   two pieces, with whole minutes ("74w0", "51n29") or minutes and seconds
#   run together ("21s4149" is 21°41'49").
PLACE = re.compile(r"^Place\s+(.*), (\d{1,2})([ns])(\d{1,4}), (\d{1,3})([ew])(\d{1,4})$", re.IGNORECASE)
#   "Timezone GMT h0e (is standard time)", "MEDT h2e", "IST h5e30": hours, then
#   minutes, east or west of Greenwich.
TIMEZONE = re.compile(r"^Timezone\s+.*?\bh(\d{1,2})([ew])(\d{2})?\b", re.IGNORECASE)
#   "Timezone LMT m10e0 (is local mean time)": the mean time of that meridian,
#   10°0' east, four minutes of time to the degree.
MEAN_TIME = re.compile(r"^Timezone\s+.*?\bm(\d{1,3})([ew])(\d{1,2})\b", re.IGNORECASE)
#   "Rodden Rating AA"
RODDEN = re.compile(r"^Rodden Rating\s+([A-Z]{1,2})\b")


def angle(deg, rest, negative):
    """Degrees, and the digits after the direction letter: minutes, or minutes and seconds."""
    assert len(rest) in (1, 2, 4), f"can't tell minutes from seconds in {rest!r}"
    minutes, seconds = (rest[:2], rest[2:]) if len(rest) == 4 else (rest, "0")
    assert int(minutes) < 60 and int(seconds) < 60, f"minutes or seconds out of range in {rest!r}"
    value = int(deg) + int(minutes) / 60 + int(seconds) / 3600
    return round(-value if negative else value, 6) + 0.0


def from_astro_databank(copied):
    """The local time, place and stated offset of an Astro-Databank record."""
    assert set(copied) == SNIPPET_KEYS, f"the snippet's keys are {sorted(SNIPPET_KEYS)}"
    missing = [key for key in SNIPPET_KEYS if copied[key] is None]
    assert not missing, f"the snippet found no row for {missing}"

    rating = RODDEN.match(copied["rodden"])
    assert rating, f"unreadable rating row: {copied['rodden']!r}"
    assert rating[1] in ACCEPTED_RATINGS, f"Rodden Rating {rating[1]}: only {sorted(ACCEPTED_RATINGS)} are accepted"

    born = BORN.match(copied["born"])
    assert born, f"unreadable birth row: {copied['born']!r}"
    day, month_name, year, hour, minute, second = born.groups()
    assert month_name.lower() in MONTHS, f"unknown month {month_name!r}"
    local = datetime(int(year), MONTHS.index(month_name.lower()) + 1, int(day), int(hour), int(minute), int(second or 0))

    place = PLACE.match(copied["place"])
    assert place, f"unreadable place row: {copied['place']!r}"
    _, lat_deg, lat_dir, lat_rest, lng_deg, lng_dir, lng_rest = place.groups()
    lat = angle(lat_deg, lat_rest, lat_dir.lower() == "s")
    lng = angle(lng_deg, lng_rest, lng_dir.lower() == "w")

    zone = TIMEZONE.match(copied["timezone"])
    mean = MEAN_TIME.match(copied["timezone"])
    assert zone or mean, f"unreadable time zone row: {copied['timezone']!r}"
    if zone:
        hours, direction, minutes = zone.groups()
        size = int(hours) * 3600 + int(minutes or 0) * 60
    else:
        deg, direction, minutes = mean.groups()
        # 240 seconds of time to the degree, 4 to the minute of arc.
        size = int(deg) * 240 + int(minutes) * 4
    stated = size if direction.lower() == "e" else -size
    return local, lat, lng, stated, rating[1]


def expected_for(case):
    record = case["record"]
    if case["kind"] == "invented":
        unknown = set(record) - INVENTED_KEYS
        assert not unknown, f"unknown record keys {sorted(unknown)}"
        local = datetime.fromisoformat(record["local"])
        assert local.isoformat() == record["local"], "local must be YYYY-MM-DDTHH:MM:SS"
        lat, lng = record["lat"], record["lng"]
        offset, kind = zone_offset(local, record)
        extra = {}
    else:
        assert case["kind"] == "public-record", f"unknown kind {case['kind']!r}"
        unknown = set(record) - PUBLIC_KEYS
        assert not unknown, f"unknown record keys {sorted(unknown)}"
        local, lat, lng, offset, rating = from_astro_databank(case["astroDatabank"])
        zone_seconds, kind = zone_offset(local, record)
        extra = {"rodden": rating, "zoneOffsetSeconds": zone_seconds, "disputed": zone_seconds != offset}

    assert -90 <= lat <= 90 and -180 <= lng <= 180, "coordinates off the globe"
    utc = (local - timedelta(seconds=offset)).replace(tzinfo=timezone.utc)
    jd = julian_day(utc)
    # The Julian Day by a second route: days since J2000.0.
    j2000 = datetime(2000, 1, 1, 12, tzinfo=timezone.utc)
    assert abs(jd - (2451545.0 + (utc - j2000) / timedelta(days=1))) < 1e-8, "Julian Day routes disagree"
    return {
        "local": local.isoformat(),
        "lat": lat,
        "lng": lng,
        "localTime": kind,
        "offsetSeconds": offset,
        "utc": utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "julianDay": jd,
        **extra,
    }


def tzdata_version():
    for path in TZPATH:
        version = os.path.join(path, "+VERSION")
        if os.path.exists(version):
            with open(version, encoding="utf-8") as f:
                return f.read().strip()
    return "unknown"


def load(name):
    with open(os.path.join(CASES, name), encoding="utf-8") as f:
        case = json.load(f)
    assert case["id"] == name[: -len(".json")], f"{name}: id must match the file name"
    return case


def save(name, case):
    with open(os.path.join(CASES, name), "w", encoding="utf-8") as f:
        f.write(json.dumps(case, indent=2, ensure_ascii=False) + "\n")


def paste(names):
    """Puts each pasted snippet line into the waiting case whose page it is."""
    waiting = {}
    for name in names:
        case = load(name)
        if case["kind"] == "public-record":
            waiting[case["page"]] = (name, case)
    filled = 0
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        copied = json.loads(line)
        match = waiting.get(copied.get("url"))
        if match is None:
            print(f"no case has the page {copied.get('url')}: add one, or fix its page")
            continue
        name, case = match
        case["astroDatabank"] = copied
        save(name, case)
        filled += 1
        print(f"{name}: record copied in")
    print(f"{filled} records copied in; run with --write next")


def main():
    names = sorted(name for name in os.listdir(CASES) if name.endswith(".json"))
    if "--paste" in sys.argv[1:]:
        paste(names)
        return
    write = "--write" in sys.argv[1:]
    check_julian_day()
    version = tzdata_version()
    changed, failed, waiting = [], [], []
    for name in names:
        case = load(name)
        if case["kind"] == "public-record" and case.get("astroDatabank") is None:
            waiting.append(name)
            continue
        try:
            expected = expected_for(case)
        except AssertionError as error:
            failed.append(name)
            print(f"{name}: {error}")
            continue
        if case.get("expected") == expected:
            continue
        changed.append(name)
        if write:
            case["expected"] = expected
            case["oracle"] = f"IANA tzdata {version} through Python zoneinfo; Julian Day by Meeus, chapter 7"
            save(name, case)
        else:
            print(f"{name}: expected {json.dumps(expected)}, file has {json.dumps(case.get('expected'))}")
    verb = "wrote" if write else "differ"
    print(f"{len(names)} cases, tzdata {version}: {len(changed)} {verb}, {len(failed)} refused, {len(waiting)} waiting for their record")
    if failed or (changed and not write):
        sys.exit(1)


if __name__ == "__main__":
    main()
