#!/usr/bin/env python3
# Works out the reference values the parans tests compare AstroChart Bridge
# with: test/parans-reference.json. They come from astro-research's parans
# proof of concept (angular_events and paran_gaps, conventions parans-v1), a
# separate Python engine on Swiss Ephemeris's data files, whose events are
# checked against ERFA. AstroChart Bridge follows the same conventions on the
# Moshier ephemeris, so the two differ by the ephemeris and nothing else; the
# tests decide how much difference is allowed.
#
# Run it by hand, from this repository, in astro-research's environment:
#
#   uv run --project <astro-research> python -I tools/make-parans-reference.py <astro-research>
#       checks the committed values
#   uv run --project <astro-research> python -I tools/make-parans-reference.py <astro-research> --write
#       writes them
#
# <astro-research> is a checkout of astro-research with its ephemeris files
# fetched (its ephe/ folder). The tests never run this script, so they need
# neither Python nor astro-research.
#
# The time scale is CLOCK_AS_UT1: the chart's UTC reading is used as UT1 and
# Swiss Ephemeris applies its own delta-T, which is what AstroChart Bridge
# does when it hands swe_rise_trans the Julian Day of a chart's UTC.
#
# Each case's claim (a body moving backward in right ascension, a Sun that
# never sets) is checked here, so a case can't quietly stop showing what it's
# for. A changed value is a change to review, never one to accept unread.
import json
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from astro_research.astronomical_time import TimeScale
from astro_research.civil_time import UtcTime, resolve
from astro_research.ephemeris import Ephemeris
from astro_research.geo import GeoPosition
from astro_research.parans import (
    PARAN_CONVENTIONS,
    Disc,
    HorizonConvention,
    HorizonEvent,
    Refraction,
    angular_events,
    paran_gaps,
)
from astro_research.positions import Body

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "test" / "parans-reference.json"

TIME_SCALE = TimeScale.CLOCK_AS_UT1
# astro-research's research platform: the birth's UTC +-12 hours of clock time.
WINDOW = timedelta(hours=12)

HORIZONS = {
    # The body's centre on the geometric horizon, no refraction.
    "geometric": HorizonConvention(disc=Disc.CENTRE, refraction=None),
    # The upper limb, refracted for 1013.25 hPa and 10 °C: an almanac's sunrise.
    "almanac": HorizonConvention(
        disc=Disc.UPPER_LIMB, refraction=Refraction(pressure_hpa=1013.25, temperature_c=10.0)
    ),
}

# Invented charts. AstroChart Bridge's charts carry no elevation, so every
# place is at 0 m.
CASES = [
    {
        "name": "london-mercury-retrograde",
        "note": "Mid-latitude; Mercury moves backward in right ascension.",
        "utc": "2024-04-10T14:30:00Z",
        "lat": 51.5074,
        "lng": -0.1278,
    },
    {
        "name": "tromso-midnight-sun",
        "note": "Above the Arctic Circle at the June solstice: the Sun, Mercury, Venus and "
        "Jupiter never set, and the Moon and Pluto never rise.",
        "utc": "2024-06-21T12:00:00Z",
        "lat": 69.6492,
        "lng": 18.9553,
    },
    {
        "name": "sydney-1987",
        "note": "Southern hemisphere, east of Greenwich, and a window that crosses UTC midnight.",
        "utc": "1987-12-05T03:20:00Z",
        "lat": -33.8688,
        "lng": 151.2093,
    },
]


TROMSO_NEVER_SET = {"sun", "mercury", "venus", "jupiter"}
TROMSO_MISSING = TROMSO_NEVER_SET | {"moon", "pluto"}


def check_claims(case, eph, place, birth, events):
    """Fail if a case no longer shows what its note says."""
    missing = {(point.value, event.value) for point, event in events.no_rise_or_set}
    if case["name"] == "london-mercury-retrograde":
        mercury = eph.positions(birth, (Body.MERCURY,))[Body.MERCURY]
        if not mercury.right_ascension_speed < 0:
            sys.exit(f"{case['name']}: Mercury's right ascension speed is {mercury.right_ascension_speed}")
        if missing:
            sys.exit(f"{case['name']}: expected every body to rise and set, got {sorted(missing)}")
    if case["name"] == "tromso-midnight-sun":
        expected = {(point, event) for point in TROMSO_MISSING for event in ("rise", "set")}
        if missing != expected:
            sys.exit(f"{case['name']}: expected {sorted(TROMSO_MISSING)} not to rise or set, got {sorted(missing)}")
        # Swiss Ephemeris can't tell circumpolar from never rising; the
        # altitude at the upper transit can.
        for body in map(Body, TROMSO_MISSING):
            altitude = eph.positions(birth, (body,))[body].declination + 90 - place.latitude
            if (altitude > 0) != (body.value in TROMSO_NEVER_SET):
                sys.exit(f"{case['name']}: {body.value} culminates at {altitude:.1f}°")
    if case["name"] == "sydney-1987":
        if missing:
            sys.exit(f"{case['name']}: expected every body to rise and set, got {sorted(missing)}")
        start = birth.instant.utc - WINDOW
        end = birth.instant.utc + WINDOW
        if start.date() == end.date():
            sys.exit(f"{case['name']}: the window doesn't cross UTC midnight")


def at(eph, utc, place):
    return eph.time(resolve(UtcTime(utc=utc), place), TIME_SCALE)


def reference_case(case, horizon_name, eph):
    place = GeoPosition(latitude=case["lat"], longitude=case["lng"])
    utc = datetime.fromisoformat(case["utc"].replace("Z", "+00:00")).astimezone(UTC)
    birth = at(eph, utc, place)
    start, end = at(eph, utc - WINDOW, place), at(eph, utc + WINDOW, place)
    events = angular_events(
        eph,
        place,
        start=start,
        end=end,
        bodies=tuple(Body),
        stars=(),
        horizon=HORIZONS[horizon_name],
    )
    check_claims(case, eph, place, birth, events)
    index = {id(event): i for i, event in enumerate(events.events)}
    return {
        "name": f"{case['name']}/{horizon_name}",
        "note": case["note"],
        "utc": case["utc"],
        "lat": case["lat"],
        "lng": case["lng"],
        "elevation": 0,
        "horizon": horizon_name,
        "window": {"startJdUt": start.jd_ut1, "endJdUt": end.jd_ut1},
        # In time order. jdUt is the UT Julian Day swe_rise_trans returns;
        # armc is in degrees, at the event.
        "events": [
            {"point": e.point.value, "event": e.event.value, "jdUt": e.time.jd_ut1, "armc": e.armc}
            for e in events.events
        ],
        # The point and event Swiss Ephemeris said don't happen (its -2):
        # circumpolar or never rising, it can't say which.
        "noRiseOrSet": sorted([point.value, event.value] for point, event in events.no_rise_or_set),
        # Every pair of events of two different points, earlier first:
        # [index of the first event, index of the second, seconds between
        # them in TT, the second's ARMC less the first's in (-180, 180]].
        "gaps": [
            [index[id(g.first)], index[id(g.second)], g.seconds, g.armc] for g in paran_gaps(events)
        ],
    }


def astro_research_commit(checkout):
    def git(*args):
        return subprocess.run(
            ["git", "-C", str(checkout), *args], check=True, capture_output=True, text=True
        ).stdout.strip()

    commit = git("rev-parse", "HEAD")
    if git("status", "--porcelain", "--untracked-files=no", "--", "src"):
        sys.exit(f"{checkout}: src/ has uncommitted changes; commit or set them aside first")
    return commit


def build(checkout):
    eph = Ephemeris.open(checkout / "ephe")
    provenance = eph.provenance
    return {
        "generatedBy": "tools/make-parans-reference.py",
        "astroResearch": {
            "commit": astro_research_commit(checkout),
            "conventions": PARAN_CONVENTIONS,
            "binding": provenance.binding,
            "swissEphemeris": provenance.swisseph_version,
            "de": provenance.de_number,
            "timeScale": TIME_SCALE.value,
        },
        "bodies": [body.value for body in Body],
        "events": [event.value for event in HorizonEvent],
        "horizons": {
            name: {
                "disc": h.disc.value,
                "refraction": None
                if h.refraction is None
                else {"pressureHpa": h.refraction.pressure_hpa, "temperatureC": h.refraction.temperature_c},
            }
            for name, h in HORIZONS.items()
        },
        "windowHours": WINDOW.total_seconds() / 3600,
        "cases": [reference_case(case, name, eph) for case in CASES for name in HORIZONS],
    }


def dump(reference):
    """JSON with each event and gap on a line of its own, so a change shows as the rows it moves."""
    rows = {}

    def row(value):
        key = f"@row{len(rows)}@"
        rows[key] = json.dumps(value)
        return key

    shaped = {
        **reference,
        "cases": [
            {**case, "events": [row(e) for e in case["events"]], "gaps": [row(g) for g in case["gaps"]]}
            for case in reference["cases"]
        ],
    }
    text = json.dumps(shaped, indent=1)
    for key, value in rows.items():
        text = text.replace(f'"{key}"', value, 1)
    return text + "\n"


def main():
    args = sys.argv[1:]
    write = "--write" in args
    paths = [a for a in args if a != "--write"]
    if len(paths) != 1:
        sys.exit(__doc__ or "usage: make-parans-reference.py <astro-research> [--write]")
    reference = build(Path(paths[0]).resolve())
    text = dump(reference)
    if write:
        OUT.write_text(text)
        cases = reference["cases"]
        print(f"wrote {os.path.relpath(OUT)}: {len(cases)} cases, "
              f"{sum(len(c['events']) for c in cases)} events, {sum(len(c['gaps']) for c in cases)} gaps")
        return
    if not OUT.exists():
        sys.exit(f"{os.path.relpath(OUT)} is missing; review, then --write")
    committed = json.loads(OUT.read_text())
    was, now = committed["astroResearch"].pop("commit"), reference["astroResearch"].pop("commit")
    if committed != reference:
        sys.exit(f"{os.path.relpath(OUT)} differs from what astro-research gives now; review, then --write")
    if was != now:
        print(f"{os.path.relpath(OUT)} matches; astro-research has moved from {was[:7]} to {now[:7]}")
    else:
        print(f"{os.path.relpath(OUT)} matches")


if __name__ == "__main__":
    main()
