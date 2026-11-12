#!/usr/bin/env python3
# Works out the reference values the declinations tests compare AstroChart
# Bridge with: test/declinations-reference.json. They come from native Swiss
# Ephemeris, pysweph, two ways:
#
# - with the engine's settings: Moshier, the asteroid files the extension
#   vendors in extension/vendor/swisseph/ephe/, and the Ascendant, MC and
#   Vertex from swe_houses_ex, turned into declinations by swe_cotrans rather
#   than by core/declinations.js's formula. So the two differ by the
#   WebAssembly build and that formula alone;
# - on Swiss Ephemeris's DE-based files, sepl_18.se1 and semo_18.se1, from
#   astro-research's ephe/ folder, for the dates they cover, 1800 to 2400: how
#   far Moshier's declinations are from them.
#
# Run it by hand, from this repository, in astro-research's environment,
# which has pysweph:
#
#   uv run --project <astro-research> python -I tools/make-declinations-reference.py <astro-research>
#       checks the committed values
#   uv run --project <astro-research> python -I tools/make-declinations-reference.py <astro-research> --write
#       writes them
#
# The tests never run this script, so they need neither Python nor pysweph.
# Each case's claim is checked here, so a case can't quietly stop showing what
# it's for. A changed value is a change to review, never one to accept unread.
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path

import swisseph as swe

ROOT = Path(__file__).resolve().parent.parent
EPHE = ROOT / "extension" / "vendor" / "swisseph" / "ephe"
OUT = ROOT / "test" / "declinations-reference.json"

PLANETS = {
    "sun": swe.SUN, "moon": swe.MOON, "mercury": swe.MERCURY, "venus": swe.VENUS, "mars": swe.MARS,
    "jupiter": swe.JUPITER, "saturn": swe.SATURN, "uranus": swe.URANUS, "neptune": swe.NEPTUNE, "pluto": swe.PLUTO,
}
DWARF_PLANETS = {
    "ceres": swe.CERES,
    "eris": swe.AST_OFFSET + 136199,
    "makemake": swe.AST_OFFSET + 136472,
    "haumea": swe.AST_OFFSET + 136108,
    "varuna": swe.AST_OFFSET + 20000,
    "ixion": swe.AST_OFFSET + 28978,
    "orcus": swe.AST_OFFSET + 90482,
    "sedna": swe.AST_OFFSET + 90377,
}
BODIES = {**DWARF_PLANETS, **PLANETS}
DE_FILES = ["sepl_18.se1", "semo_18.se1"]
# What sepl_18.se1 and semo_18.se1 cover.
DE_YEARS = (1800, 2400)

# The parans cases' places and moments, and three of this page's own: on the
# equator, where the Vertex is an equinox; and in 1700 and 2900, read from
# the first and last of Ceres's main asteroid files.
CASES = [
    {"name": "london-2024", "utc": "2024-04-10T14:30:00Z", "lat": 51.5074, "lng": -0.1278},
    {"name": "tromso-2024", "utc": "2024-06-21T12:00:00Z", "lat": 69.6492, "lng": 18.9553},
    {"name": "sydney-1987", "utc": "1987-12-05T03:20:00Z", "lat": -33.8688, "lng": 151.2093},
    {"name": "equator-2010", "utc": "2010-03-20T17:00:00Z", "lat": 0.0, "lng": -78.4678},
    {"name": "london-1700", "utc": "1700-06-01T12:00:00Z", "lat": 51.5074, "lng": -0.1278},
    {"name": "sydney-2900", "utc": "2900-01-01T00:00:00Z", "lat": -33.8688, "lng": 151.2093},
]


def julian_day(utc):
    moment = datetime.fromisoformat(utc.replace("Z", "+00:00"))
    hours = moment.hour + moment.minute / 60 + moment.second / 3600
    return swe.julday(moment.year, moment.month, moment.day, hours, swe.GREG_CAL)


def equatorial(jd, body, ephemeris):
    (ra, dec, *_), flags, _ = swe.calc_ut(jd, body, ephemeris | swe.FLG_EQUATORIAL)
    assert flags & ephemeris, f"{body}: asked for {ephemeris}, got flags {flags}"
    return ra, dec


def case(reference):
    jd = julian_day(reference["utc"])
    _, ascmc = swe.houses_ex(jd, reference["lat"], reference["lng"], b"O", 0)
    ascendant, midheaven, armc, vertex = ascmc[:4]
    (obliquity, *_), _, _ = swe.calc_ut(jd, swe.ECL_NUT, swe.FLG_MOSEPH)
    points = {}
    for name, longitude in {"ascendant": ascendant, "midheaven": midheaven, "vertex": vertex}.items():
        # swe_cotrans turns ecliptic into equatorial with the obliquity negated.
        _, declination, _ = swe.cotrans((longitude, 0.0, 1.0), -obliquity)
        points[name] = {"longitude": longitude, "declination": declination}
    for name, body in BODIES.items():
        ra, dec = equatorial(jd, body, swe.FLG_MOSEPH)
        points[name] = {"rightAscension": ra, "declination": dec}
    year = int(reference["utc"][:4])
    de = None
    if DE_YEARS[0] <= year < DE_YEARS[1]:
        de = {name: equatorial(jd, body, swe.FLG_SWIEPH)[1] for name, body in BODIES.items()}
    return {**reference, "jdUt": jd, "obliquity": obliquity, "armc": armc, "points": points, "deDeclinations": de}


def check_claims(results):
    """On the equator the Vertex is an equinox, 0° or 180°, at declination 0. Somewhere, a dwarf planet's declination is more than
    10° from its zodiacal degree's, so a page that used the degree would be wrong."""
    by_name = {result["name"]: result for result in results}
    vertex = by_name["equator-2010"]["points"]["vertex"]
    # 0° or 180°: Swiss Ephemeris gives either, by the moment. Rounding leaves 1e-15° or so.
    assert vertex["longitude"] % 180 == 0 and abs(vertex["declination"]) < 1e-12, vertex
    widest = (0, None)
    for result in results:
        for name, body in DWARF_PLANETS.items():
            (longitude, *_), _, _ = swe.calc_ut(result["jdUt"], body, swe.FLG_MOSEPH)
            _, from_degree, _ = swe.cotrans((longitude, 0.0, 1.0), -result["obliquity"])
            gap = abs(result["points"][name]["declination"] - from_degree)
            widest = max(widest, (gap, f"{result['name']}: {name}"))
    assert widest[0] > 10, widest
    print(f"widest gap from the zodiacal degree's declination: {widest[0]:.2f}°, {widest[1]}")


def build(astro_research):
    de_ephe = Path(astro_research) / "ephe"
    for name in DE_FILES:
        assert (de_ephe / name).is_file(), f"{de_ephe / name} isn't there; fetch astro-research's ephemeris files"
    swe.set_ephe_path(f"{EPHE}:{de_ephe}")
    files = sorted(path.name for path in EPHE.glob("*.se1"))
    data = {
        "generatedBy": "tools/make-declinations-reference.py",
        "binding": f"pysweph {swe.__version__}",
        "swissEphemeris": swe.version,
        "flags": "moshier, and on sepl_18 and semo_18 for deDeclinations",
        "files": {name: hashlib.sha256((EPHE / name).read_bytes()).hexdigest() for name in files},
        "deFiles": {name: hashlib.sha256((de_ephe / name).read_bytes()).hexdigest() for name in DE_FILES},
        "houseSystem": "porphyry",
        "results": [case(reference) for reference in CASES],
    }
    swe.close()
    return data


def dump(data):
    return json.dumps(data, indent=1) + "\n"


def main():
    args = [arg for arg in sys.argv[1:] if arg != "--write"]
    if len(args) != 1:
        sys.exit("usage: make-declinations-reference.py <astro-research> [--write]")
    data = build(args[0])
    check_claims(data["results"])
    if "--write" in sys.argv[1:]:
        OUT.write_text(dump(data))
        print(f"wrote {OUT.relative_to(ROOT)}: {len(data['results'])} cases")
        return
    committed = json.loads(OUT.read_text())
    if committed != json.loads(dump(data)):
        sys.exit(f"{OUT.relative_to(ROOT)} differs from what this script works out; run it with --write and review the diff")
    print(f"{OUT.relative_to(ROOT)} is what this script works out")


if __name__ == "__main__":
    main()
