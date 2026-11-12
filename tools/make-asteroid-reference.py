#!/usr/bin/env python3
# Works out the reference values the engine's asteroid tests compare it with:
# test/parans-asteroid-reference.json. astro-research has no asteroids, so
# these come from native Swiss Ephemeris, pysweph, reading the same files the
# extension vendors in extension/vendor/swisseph/ephe/, with the same Moshier
# setting the engine uses. So the two differ by the WebAssembly build alone.
#
# The cases are test/parans-reference.json's: the same places, windows and
# horizons. Each event is found the way parans-v1 finds one (astro-research's
# _collect, ported to core/parans.js): the next one from the window's start,
# refined by a second search started 3 minutes before it, kept while in
# [start, end), the next searched for from a minute later; a rising or
# setting Swiss Ephemeris says doesn't happen is noted once, and the search
# carries on after the body's next upper transit.
#
# Run it by hand, from this repository, in astro-research's environment,
# which has pysweph:
#
#   uv run --project <astro-research> python -I tools/make-asteroid-reference.py
#       checks the committed values
#   uv run --project <astro-research> python -I tools/make-asteroid-reference.py --write
#       writes them
#
# The tests never run this script, so they need neither Python nor pysweph. A
# changed value is a change to review, never one to accept unread.
import hashlib
import json
import sys
from pathlib import Path

import swisseph as swe

ROOT = Path(__file__).resolve().parent.parent
EPHE = ROOT / "extension" / "vendor" / "swisseph" / "ephe"
CASES = ROOT / "test" / "parans-reference.json"
OUT = ROOT / "test" / "parans-asteroid-reference.json"

# The engine's setting for every body: Moshier, which Swiss Ephemeris also
# uses for the Sun and Earth when it reads an asteroid from its file.
FLAGS = swe.FLG_MOSEPH
# The bodies, by the engine's names and Swiss Ephemeris's numbers: Ceres in
# the main asteroid files, the rest numbered asteroids in files of their own.
BODIES = {
    "ceres": swe.CERES,
    "eris": swe.AST_OFFSET + 136199,
    "makemake": swe.AST_OFFSET + 136472,
    "haumea": swe.AST_OFFSET + 136108,
    "varuna": swe.AST_OFFSET + 20000,
    "ixion": swe.AST_OFFSET + 28978,
    "orcus": swe.AST_OFFSET + 90482,
    "sedna": swe.AST_OFFSET + 90377,
}

EVENTS = {
    "rise": swe.CALC_RISE,
    "set": swe.CALC_SET,
    "upper-transit": swe.CALC_MTRANSIT,
    "lower-transit": swe.CALC_ITRANSIT,
}
DISCS = {"upper_limb": 0, "centre": swe.BIT_DISC_CENTER}
REFINE_LEAD = 3 / 1440
NEXT_SEARCH = 1 / 1440
NOT_FOUND = -2


def rsmi(event, horizon):
    flags = EVENTS[event]
    if event in ("rise", "set"):
        flags |= DISCS[horizon["disc"]]
    if horizon["refraction"] is None:
        flags |= swe.BIT_NO_REFRACTION
    return flags


def search(jd, body, event, geo, horizon):
    """The next event's Julian Day (UT), or None when Swiss Ephemeris says it doesn't happen."""
    refraction = horizon["refraction"] or {"pressureHpa": 0.0, "temperatureC": 0.0}
    res, tret = swe.rise_trans(
        jd, BODIES[body], rsmi(event, horizon), geo, refraction["pressureHpa"], refraction["temperatureC"], FLAGS,
    )
    if res == NOT_FOUND:
        return None
    if res < 0:
        sys.exit(f"rise_trans failed for {body} {event} at {jd}")
    return tret[0]


def collect(body, event, geo, horizon, start, end, events, missing):
    at = start
    while at < end:
        first = search(at, body, event, geo, horizon)
        if first is None:
            if (body, event) not in missing:
                missing.append((body, event))
            transit = search(at, body, "upper-transit", geo, horizon)
            if transit is None or transit >= end:
                return
            at = transit + NEXT_SEARCH
            continue
        if first - REFINE_LEAD >= end:
            return
        refined = search(first - REFINE_LEAD, body, event, geo, horizon)
        jd = first if refined is None else refined
        if jd >= end:
            return
        if jd >= start:
            events.append({"point": body, "event": event, "jdUt": jd})
        at = jd + NEXT_SEARCH


def case(reference, horizons):
    horizon = horizons[reference["horizon"]]
    geo = (reference["lng"], reference["lat"], reference["elevation"])
    start, end = reference["window"]["startJdUt"], reference["window"]["endJdUt"]
    events, missing = [], []
    for body in BODIES:
        for event in EVENTS:
            collect(body, event, geo, horizon, start, end, events, missing)
    events.sort(key=lambda e: e["jdUt"])
    return {
        "name": reference["name"],
        "utc": reference["utc"],
        "lat": reference["lat"],
        "lng": reference["lng"],
        "elevation": reference["elevation"],
        "horizon": reference["horizon"],
        "window": reference["window"],
        "events": events,
        "noRiseOrSet": sorted([list(pair) for pair in missing]),
    }


def check_claims(results):
    """A body with no rising or setting really never rises, its upper culmination below the horizon, or never sets,
    its lower one above it, by its declination at its upper culmination; and each misses both. Ceres never rises at
    Tromsø that day."""
    for result in results:
        lat = abs(result["lat"])
        bodies = sorted({body for body, _ in result["noRiseOrSet"]})
        for body in bodies:
            assert [body, "rise"] in result["noRiseOrSet"] and [body, "set"] in result["noRiseOrSet"], f"{result['name']}: {body}"
            jd = next(e["jdUt"] for e in result["events"] if e["point"] == body and e["event"] == "upper-transit")
            (_, declination, *_), _, _ = swe.calc_ut(jd, BODIES[body], FLAGS | swe.FLG_EQUATORIAL)
            # Towards the pole the observer is near, for either hemisphere.
            toward = declination if result["lat"] > 0 else -declination
            upper, lower = toward + 90 - lat, toward - (90 - lat)
            assert upper < 0 or lower > 0, f"{result['name']}: {body} at declination {declination:.2f}° should rise and set"
            kind = "never rises" if upper < 0 else "never sets"
            print(f"{result['name']}: {body} {kind}, at declination {declination:.2f}°")
        if result["name"].startswith("tromso"):
            assert "ceres" in bodies, result["name"]


def build():
    swe.set_ephe_path(str(EPHE))
    cases = json.loads(CASES.read_text())
    files = sorted(path.name for path in EPHE.glob("*.se1"))
    return {
        "generatedBy": "tools/make-asteroid-reference.py",
        "binding": f"pysweph {swe.__version__}",
        "swissEphemeris": swe.version,
        "flags": "moshier",
        "files": {name: hashlib.sha256((EPHE / name).read_bytes()).hexdigest() for name in files},
        "cases": "test/parans-reference.json's",
        "bodies": list(BODIES),
        "results": [case(reference, cases["horizons"]) for reference in cases["cases"]],
    }


def dump(data):
    # One line for each event, so a diff shows which changed.
    text = json.dumps(data, indent=1)
    return text + "\n"


def main():
    data = build()
    check_claims(data["results"])
    if "--write" in sys.argv[1:]:
        OUT.write_text(dump(data))
        events = sum(len(result["events"]) for result in data["results"])
        print(f"wrote {OUT.relative_to(ROOT)}: {events} events")
        return
    committed = json.loads(OUT.read_text())
    if committed != json.loads(dump(data)):
        sys.exit(f"{OUT.relative_to(ROOT)} differs from what this script works out; run it with --write and review the diff")
    print(f"{OUT.relative_to(ROOT)} is what this script works out")


if __name__ == "__main__":
    main()
