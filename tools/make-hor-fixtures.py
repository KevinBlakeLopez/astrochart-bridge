#!/usr/bin/env python3
# Writes the Morinus .hor test files in fixtures/morinus/ from the invented
# charts in tools/hor-fixtures.json. Run it by hand, after changing that file:
#
#   python3 -I tools/make-hor-fixtures.py
#
# It is Python because the files must come from the program that writes real
# ones: CPython's pickle module, called as Morinus's save() calls it (morin.py,
# 27 pickle.dump calls, one per field). It pickles only strs, ints and bools,
# and reads every file back with pickle.load to check that it holds those
# values and nothing else. The tests never run it.
import os
import json
import pickle

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(ROOT, "tools", "hor-fixtures.json")
OUT = os.path.join(ROOT, "fixtures", "morinus")


def main():
    with open(SPEC, encoding="utf-8") as f:
        spec = json.load(f)
    fields = spec["fields"]
    os.makedirs(OUT, exist_ok=True)
    written = 0
    for key, chart in spec["charts"].items():
        values = [chart["values"][field] for field in fields]
        assert all(type(v) in (str, int, bool) for v in values), key
        for protocol in chart["protocols"]:
            path = os.path.join(OUT, f"{key}.p{protocol}.hor")
            with open(path, "wb") as f:
                for value in values:
                    pickle.dump(value, f, protocol)
            with open(path, "rb") as f:
                back = [pickle.load(f) for _ in fields]
                assert f.read() == b"", path
            assert back == values and [type(v) for v in back] == [type(v) for v in values], path
            written += 1
    print(f"{written} files in {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
