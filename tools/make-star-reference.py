#!/usr/bin/env python3
# Works out the reference values the fixed-star parans tests compare
# AstroChart Bridge with: test/parans-star-reference.json. They come from
# astro-research's parans proof of concept (angular_events, conventions
# parans-v1) on Swiss Ephemeris's data files, for the stars in
# extension/core/parans.js's FIXED_STARS, in tools/make-parans-reference.py's
# six cases. AstroChart Bridge finds the same events on the Moshier
# ephemeris, from the same star catalogue.
#
# Run it by hand, from this repository, in astro-research's environment:
#
#   uv run --project <astro-research> python -I tools/make-star-reference.py <astro-research>
#       checks the committed values
#   uv run --project <astro-research> python -I tools/make-star-reference.py <astro-research> --write
#       writes them
#
# astro-research's ephe/sefstars.txt has to be the vendored one,
# extension/vendor/swisseph/ephe/sefstars.txt, byte for byte. The tests never
# run this script. A changed value is a change to review, never one to accept
# unread.
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import swisseph as swe
from astro_research.astronomical_time import TimeScale
from astro_research.civil_time import UtcTime, resolve
from astro_research.ephemeris import Ephemeris
from astro_research.geo import GeoPosition
from astro_research.parans import (
    PARAN_CONVENTIONS,
    Disc,
    FixedStar,
    HorizonConvention,
    Refraction,
    angular_events,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "test" / "parans-star-reference.json"
CATALOGUE = ROOT / "extension" / "vendor" / "swisseph" / "ephe" / "sefstars.txt"
STARS_SOURCE = ROOT / "extension" / "core" / "parans.js"

TIME_SCALE = TimeScale.CLOCK_AS_UT1
WINDOW = timedelta(hours=12)

# As tools/make-parans-reference.py has them.
HORIZONS = {
    "geometric": HorizonConvention(disc=Disc.CENTRE, refraction=None),
    "almanac": HorizonConvention(
        disc=Disc.UPPER_LIMB, refraction=Refraction(pressure_hpa=1013.25, temperature_c=10.0)
    ),
}
CASES = [
    {"name": "london-mercury-retrograde", "utc": "2024-04-10T14:30:00Z", "lat": 51.5074, "lng": -0.1278},
    {"name": "tromso-midnight-sun", "utc": "2024-06-21T12:00:00Z", "lat": 69.6492, "lng": 18.9553},
    {"name": "sydney-1987", "utc": "1987-12-05T03:20:00Z", "lat": -33.8688, "lng": 151.2093},
]


def stars():
    """FIXED_STARS's designations, in its order, from core/parans.js."""
    found = re.findall(r'\{ designation: "(,[^"]+)", name: "[^"]*", otherNames: \[[^\]]*\], magnitude: [-\d.]+ \}', STARS_SOURCE.read_text())
    if not found:
        sys.exit(f"{STARS_SOURCE}: no FIXED_STARS found")
    return found


def check_claims(name, latitude, events, declinations):
    """A star that doesn't rise or set really never rises or never sets, by its declination, and misses both."""
    missing = {}
    for point, event in events.no_rise_or_set:
        missing.setdefault(point.designation, set()).add(event.value)
    for designation, which in missing.items():
        if which != {"rise", "set"}:
            sys.exit(f"{name}: {designation} misses only {sorted(which)}")
        toward = declinations[designation] if latitude > 0 else -declinations[designation]
        upper, lower = toward + 90 - abs(latitude), toward - (90 - abs(latitude))
        if not (upper < 0 or lower > 0):
            sys.exit(f"{name}: {designation} at declination {declinations[designation]:.2f}° should rise and set")
    return missing


def at(eph, utc, place):
    return eph.time(resolve(UtcTime(utc=utc), place), TIME_SCALE)


def reference_case(case, horizon_name, eph, designations):
    place = GeoPosition(latitude=case["lat"], longitude=case["lng"])
    utc = datetime.fromisoformat(case["utc"].replace("Z", "+00:00")).astimezone(UTC)
    start, end = at(eph, utc - WINDOW, place), at(eph, utc + WINDOW, place)
    events = angular_events(
        eph,
        place,
        start=start,
        end=end,
        bodies=(),
        stars=tuple(FixedStar(designation=d) for d in designations),
        horizon=HORIZONS[horizon_name],
    )
    # Each star's apparent declination at the chart's moment, from the same
    # catalogue astro-research has Swiss Ephemeris hold.
    jd = at(eph, utc, place).jd_ut1
    declinations = {d: swe.fixstar2_ut(d, jd, swe.FLG_SWIEPH | swe.FLG_EQUATORIAL)[0][1] for d in designations}
    name = f"{case['name']}/{horizon_name}"
    missing = check_claims(name, case["lat"], events, declinations)
    return {
        "name": name,
        "utc": case["utc"],
        "lat": case["lat"],
        "lng": case["lng"],
        "elevation": 0,
        "horizon": horizon_name,
        "window": {"startJdUt": start.jd_ut1, "endJdUt": end.jd_ut1},
        "events": [
            {"point": e.point.designation, "event": e.event.value, "jdUt": e.time.jd_ut1, "armc": e.armc}
            for e in events.events
        ],
        "noRiseOrSet": sorted([point.designation, event.value] for point, event in events.no_rise_or_set),
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
    theirs = (checkout / "ephe" / "sefstars.txt").read_bytes()
    ours = CATALOGUE.read_bytes()
    if theirs != ours:
        sys.exit(f"{checkout}/ephe/sefstars.txt isn't {os.path.relpath(CATALOGUE)}")
    eph = Ephemeris.open(checkout / "ephe")
    provenance = eph.provenance
    designations = stars()
    return {
        "generatedBy": "tools/make-star-reference.py",
        "astroResearch": {
            "commit": astro_research_commit(checkout),
            "conventions": PARAN_CONVENTIONS,
            "binding": provenance.binding,
            "swissEphemeris": provenance.swisseph_version,
            "de": provenance.de_number,
            "timeScale": TIME_SCALE.value,
        },
        "catalogue": {"file": "sefstars.txt", "sha256": hashlib.sha256(ours).hexdigest()},
        "stars": designations,
        "results": [reference_case(case, name, eph, designations) for case in CASES for name in HORIZONS],
    }


def dump(reference):
    """JSON with each event on a line of its own, so a change shows as the rows it moves."""
    rows = {}

    def row(value):
        key = f"@row{len(rows)}@"
        rows[key] = json.dumps(value)
        return key

    shaped = {**reference, "results": [{**r, "events": [row(e) for e in r["events"]]} for r in reference["results"]]}
    text = json.dumps(shaped, indent=1)
    for key, value in rows.items():
        text = text.replace(f'"{key}"', value, 1)
    return text + "\n"


def main():
    args = sys.argv[1:]
    write = "--write" in args
    paths = [a for a in args if a != "--write"]
    if len(paths) != 1:
        sys.exit("usage: make-star-reference.py <astro-research> [--write]")
    reference = build(Path(paths[0]).resolve())
    text = dump(reference)
    if write:
        OUT.write_text(text)
        results = reference["results"]
        print(f"wrote {os.path.relpath(OUT)}: {len(reference['stars'])} stars, "
              f"{sum(len(r['events']) for r in results)} events, "
              f"{sum(len(r['noRiseOrSet']) for r in results) // 2} stars not rising or setting, each checked by declination")
        return
    committed = json.loads(OUT.read_text())
    was, now = committed["astroResearch"].pop("commit"), reference["astroResearch"].pop("commit")
    if committed != reference:
        sys.exit(f"{os.path.relpath(OUT)} differs from what astro-research gives now; review, then --write")
    print(f"{os.path.relpath(OUT)} matches" + (f"; astro-research has moved from {was[:7]} to {now[:7]}" if was != now else ""))


if __name__ == "__main__":
    main()
