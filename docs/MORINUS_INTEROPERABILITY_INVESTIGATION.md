# Morinus interoperability investigation

Investigation date: 2026-11-01. The investigation changed nothing in Chart Bridge's source, and its proof of concept was written outside the repository (§5.1).

**Since then:** approach A has been built. The import page opens `.hor` files, as [Morinus files](morinus-hor.md) describes, and that code supersedes the proof of concept. Chart Bridge has also been licensed AGPL-3.0-or-later, which answers what §8.2, §8.3 and §12 (question 5) say about its missing licence. Whether upstream sample `.hor` files can be fixtures is still open. The rest of this document is as written during the investigation.

## How to read the evidence

Every finding carries one of these tags:

| Tag | Meaning |
|---|---|
| **[R]** | Verified at runtime here: a command was run and its output observed. The machine was macOS 26.6.2, arm64, with CPython 3.9.9 (pyenv) and 3.13.11 (Homebrew), and Node 24.14.1. |
| **[S]** | Read in the source. This describes control flow and literal effects, not observed behaviour. |
| **[M]** | Repository or package-index metadata: GitHub API or PyPI JSON. |
| **[A]** | Assumption or inference that has not been verified. |

### Repositories investigated

| Short name | Repository | Commit | Commit date | Version |
|---|---|---|---|---|
| **9x** | https://github.com/shin10567/Morinus-Source-Codes | `bbe3ebe1bb5b9a7d62cb6662ff413e61522cc6c6` | 2026-09-05 | Morinus 9.6.4 ("Updated Version from 8.1.0") |
| **SE** | https://github.com/IngenieriaAstrologica/Morinus | `020492d5fce1c7a3d6b81186cef6cf04d93fb694` | 2026-09-28 | Morinus SE 8.0.0-se (Campus Astrología Special Edition, Python 3) |
| **U** | https://github.com/Uthopik/morinus-astrology | `f4c12c79e36f6878be6896c00f93d48ce24d3c88` | 2026-09-23 | Morinus 8.1/8.2 Python 3 port |
| **C** | https://github.com/financial-astrology-research/morinus-console | `b73106824b579a863691e858980882d5bc72c510` | 2021-05-08 | Partial command-line extraction |

References are written `repo:path:line`. Clone a repository at the commit above to reproduce them.

---

## 1. Executive summary

- **A `.hor` file is binary: 27 Python pickles, one after another, each holding one plain `str`, `int` or `bool`.** It holds no objects, classes or containers [S][R]. Every investigated version writes and reads the same 27 fields in the same order: 9x, SE, U, C, and SE's first, Python 2 commit `620a922` [S]. Only the pickle protocol differs between versions (0, 2, 3 or 4) [R].
- **Opening a `.hor` with unrestricted `pickle.load` is unsafe.** That is exactly what Morinus does. A crafted file can run arbitrary code inside Morinus itself [S], and CPython executes such a payload when loading it [R]. This is a security issue worth reporting upstream, privately.
- **A restricted parser is easy and safe.** It needs about 15 value and memo opcodes. The proof of concept is 394 lines of JavaScript, with no dependencies and no Python. It reads all 102 generated test files (17 charts × protocols 0–5) and the upstream samples, and refuses `GLOBAL`/`REDUCE`/`STACK_GLOBAL` payloads by name and offset [R].
- **What a `.hor` file stores:**
  - wall-clock date and time to the second;
  - calendar (Gregorian or Julian) and a BC flag;
  - time basis (zone, Greenwich, local mean, local apparent);
  - a fixed zone offset, ±hours:minutes, plus a daylight-saving boolean that always means exactly +1 hour;
  - degrees, minutes and seconds of latitude and longitude;
  - altitude as an integer in metres;
  - name, sex, chart type, place name and notes.
- **What it does not store:** an IANA zone, a zone name, birth-time uncertainty, house system, zodiac or ayanamsha, or the topocentric setting. Those last three are global application options, pickled separately under `Opts/` [S].
- **A converted chart reproduces Morinus's UT exactly [R].** For every fixture the PoC opens, the UTC equals the UT that Morinus 9.x's own `chart.Time` computes. That code was run headless against the Swiss Ephemeris extension, built here for arm64.
- **Two silent quirks to surface:**
  - Every loader discards the stored longitude seconds; 9x passes `0` at `9x:morin.py:983` [S].
  - Daylight saving ticked on a Greenwich time still subtracts an hour [R].
- **Recommendation: approach A, a native `.hor` importer in Chart Bridge, built on the existing AAF import pipeline. Modify no Morinus version for the first implementation.** A clipboard exporter (approach B) is a worthwhile *later* upstream contribution for the data a `.hor` lacks (house system, zodiac, topocentric setting). If it is done, target **Morinus SE**, after its licence metadata is clarified.
- **Helioscope:** 9x has a substantial custom heliacal visibility model (`phasiscalc.py`) and a whole-day paran solver (`paranwnd.py`).
  - They are untested, use hard-coded atmospheric parameters, and are entangled with wx through imports. No output is compared against any reference.
  - They are useful as **reference implementations and historical comparisons**, not as production code or test oracles.
  - Any reuse brings in GPL-3.0-or-later or AGPL-3.0 obligations and needs legal review.

---

## 2. Repository comparison

### 2.1 Matrix

| Criterion | 9x (9.6.4) | SE (8.0.0-se) | U (8.2 py3) | C (console) |
|---|---|---|---|---|
| Commits in the last 12 months [R] | 89 (247 total, all "Add files via upload") | 34 (39 total, descriptive messages) | 29 | 0 (last 2021-05-08) |
| Python | Python 3 syntax. All but 2 of 210 files parse under 3.13; those 2 are UTF-16 help files [R]. The shipped Windows `.pyd` links `python37.dll` (32-bit) [R]. One stale header says "Python 2.7, wxClassic" (`9x:zodiacalreleasing.py:3`) | README says 3.11+. 177/177 files parse under 3.13 [R]. Prebuilt `sweastrology.cpython-313-x86_64-linux-gnu.so` | 175/175 parse under 3.13 [R] | 6 of 64 files fail to parse under 3.13 (Python 2 prints, tab/space mixes) [R] |
| wxPython | 4.x, Phoenix (`hiddenimports=['wx.adv']`, `9x:Morinus.spec`) [S] | 4.x (README) [S] | 4.x [A] | wx imported by many modules [S] |
| Swiss Ephemeris binding | Custom `sweastrology` C module, version 2.09.01 in the `.pyd` [R]. **The repo's C source is the Python 2 API** (`Py_InitModule`, `9x:SWEP/src/astrologymodule.c:960-963`), so the Python 3 `.pyd` cannot be rebuilt from it [R]. The `.so` is a Python 2 x86-64 build (`Py_InitModule4_64`) [R] | Custom `sweastrology`, with a Python 3 `PyInit_sweastrology` added (`SE:SWEP/src/astrologymodule.c:977-980`) and a setuptools `setup.py` [S] | **Replaced by a 140-line `pyswisseph` shim**, `U:sweastrology.py`. Its `swe_calc_ut_adaptado` returns `[0.0]*6, -1` on any exception [S] | `pyswisseph` (README) |
| Windows | Primary target: PyInstaller spec with Windows paths, 32-bit `.pyd` [S][R] | Run from source. The bundled `.pyd` is a stale **python27** 32-bit build [R], so the extension must be built locally [A] | Stale python27 `.pyd` [R]; the shim makes it pure Python plus `pyswisseph` [S] | python27 `.pyd` [R] |
| Linux | Python 2 `.so` only [R] | AppImage release; py3.13 `.so` [R][M] | AppImage and AUR [M] | — |
| macOS | No `__WXMAC__`/darwin code [R] | No `__WXMAC__`/darwin code [R]; **the extension builds natively on arm64** [R] (§7) | Depends on `pyswisseph` wheels (§7) | — |
| Tests | None. Grepping finds no unittest/pytest/asserts [S] | None [S] | None [S] | None [S] |
| Licence (file / GitHub metadata) | `LICENSE`: **AGPL-3.0**; GitHub says AGPL-3.0 [M]. `Res/COPYING.txt` and the About text (`9x:mtexts.py:228`) say **GPLv3**; headers say GPL-3.0-or-later (`9x:morinus.py:5-19`) | `LICENSE.txt` holds **only the LGPL-3.0 text** (165 lines); GitHub says LGPL-3.0 [M]. The README badge says **GPL v3**; headers say GPL-3.0-or-later | GPL-3.0 [M] | **No licence file**, though the code derives from GPL Morinus |
| Chart-model separation | Poor: `chart.py:13` imports `options`, which imports `wx` (`options.py:4`). Importing `chart` without wx fails with `ModuleNotFoundError: No module named 'wx'` [R] | Same import chain [S] | Same [S] | Partly extracted; `console/*.py` re-implements the `.hor` loader (`C:console/eclipses.py:19-45`) [S] |
| Main window (where interop code goes) | `morin.py`, 4,000+ lines. The Horoscope menu is built twice (`9x:morin.py:224-320` and again at `:3453-3532`) [S] | `morin.py`; menu built once (`SE:morin.py:154-219`), bindings at `:383-384`, `enableMenus` at `:2840` [S] | `morin.py`, similar to SE [S] | n/a |
| Upstream contribution | Uploads without commit messages, 1 open issue, no PR history visible [M]. Hard to review against | Conventional commits, active in September 2026, small codebase delta from 8.x [R] | README-centred; the code is a mechanical port [S] | Dormant |
| Helioscope-relevant modules | Heliacal (phasis), paranatellonta, angle at birth, fixed-star directions (§6) | Rise/set only [S] | Rise/set only [S] | — |

### 2.2 Do 9x and SE share a chart serialization?

**Yes [S][R].** The 27 fields, their order and their Python types are identical in:

- `9x:morin.py:1025-1051` (`save`) and `:945-990` (`subLoad`);
- `SE:morin.py:830-856` and `:751-795`;
- `U:morin.py:818-844` and `:736-786`;
- `C:console/eclipses.py:19-45`;
- SE's Python 2 first commit (`git show 620a922:morin.py`: 27 `pickle.load(f)` calls).

The only difference is the pickle protocol (§3.4), and a byte-level reader is indifferent to it. **One importer covers every version.**

---

## 3. `.hor` serialization findings

### 3.1 Functions

| Version | Save | Load | Load is called from |
|---|---|---|---|
| 9x | `MFrame.save`, `9x:morin.py:1002-1061`: `pickle.dump(value, f, 2)` × 27 (`:1025-1051`) | `MFrame.subLoad`, `9x:morin.py:945-990`: `pickle.Unpickler(f).load()` × 27 (`:950-977`) | `onLoad` `:899`, file history `:1163`, `:1276`; `findtimedlg.py:1275` has its own copy |
| SE | `SE:morin.py:807-868`: `pickle.dump(value, f)` × 27 (`:830-856`) | `SE:morin.py:751-795`: `pickle.load(f)` × 27 (`:756-782`) | `onLoad` `:705` |
| U | `U:morin.py:800-857`: `pickle.dump(value, f)` (`:818-844`) | `U:morin.py:736-786`: `pickle.load(f)` (`:743-769`) | `onLoad` `:690` |
| C | — | `C:console/eclipses.py:19-45`, `console/transits_chart.py:78-104` (hard-coded paths) | scripts |

### 3.2 Field map

The field order comes from save: 9x lines 1025–1051. The meaning comes from `9x:chart.py` `Time.__init__` (`:47-171`) and `Place.__init__` (`:178-201`). The ranges come from `9x:personaldatadlg.py`.

| # | Field | Type | Meaning and range |
|---|---|---|---|
| 0 | `name` | str | Chart name, free text |
| 1 | `male` | bool | Sex |
| 2 | `htype` | int | Chart type: 0 Radix, 1 Solar, 2 Lunar, 3 Revolution, 4 Transit, 5 Horary, 6 Profections, 7 PDs in chart (`chart.py:217-224`; the dialog offers all eight, `mtexts.py:3645`, `personaldatadlg.py:74`) |
| 3 | `bc` | bool | Year is BC. Morinus sets `year = 1 - year`, i.e. astronomical numbering (`chart.py:91-92`) |
| 4–6 | `year`, `month`, `day` | int | **As entered** (`time.origyear/origmonth/origday`). Year 0–3000 or 0–5000 (`personaldatadlg.py:87-90`) |
| 7–9 | `hour`, `minute`, `second` | int | Wall clock as entered, 0–23, 0–59, 0–59 |
| 10 | `cal` | int | 0 Gregorian, 1 Julian (`chart.py:36-37`), passed to `swe_julday` (`:102-105`). Gregorian may be proleptic: nothing stops a Gregorian date before 1582 [S] |
| 11 | `zt` | int | Time basis: 0 Zone, 1 Greenwich, 2 Local mean, 3 Local apparent (`chart.py:40-43`) |
| 12 | `plus` | bool | Zone is east of Greenwich (UTC+): Morinus *subtracts* the zone (`chart.py:78-83`) |
| 13–14 | `zh`, `zm` | int | Zone offset, hours 0–12 (`personaldatadlg.py:255`) and minutes 0–59. **Stored but unused unless `zt == 0`.** The upstream `U:Hors/Morinus.hor` has `zt=1` with `zh=1` [R] |
| 15 | `daylightsaving` | bool | Subtract exactly one hour, **whatever `zt` is** (`chart.py:68-76`) [S][R] |
| 16 | `place` | str | Place name, free text |
| 17–20 | `deglon`, `minlon`, `seclon`, `east` | int, int, int, bool | Longitude. The dialog has no seconds field (`morin.py:692` passes 0). Find Time builds places with seconds (`morin.py:896`). **Every loader replaces `seclon` with 0** (`9x:morin.py:983`, `SE:morin.py:788`, `U:morin.py:775`) |
| 21–24 | `deglat`, `minlat`, `seclat`, `north` | int, int, int, bool | Latitude. `seclat` *is* kept on load |
| 25 | `altitude` | int | "Altitude of the Place", 0–10000 (`personaldatadlg.py:285`). Passed to `swe_set_topo` (`chart.py:289`), which takes metres [S][A] |
| 26 | `notes` | str | Free text, multi-line |

**UT, as Morinus computes it** (`chart.py:66-105`):

> local − 1 h if `daylightsaving` − (`plus` ? +1 : −1)·(`zh` + `zm`/60) if `zt == ZONE`

For `zt == LOCALMEAN` the correction is the longitude × 4 min, using **degrees and minutes only** (`:84-89`). For `zt == LOCALAPPARENT` it is the equation of time from `swe_time_equ` plus that longitude correction (`:107-127`). The result goes to `swe_julday` with the calendar flag.

### 3.3 The ten questions

| # | Question | Answer |
|---|---|---|
| 1 | Binary or textual? | **Binary container.** Protocol-0 files happen to be printable ASCII, apart from raw Latin-1 bytes in text: `VMorinus\np0\n.I01\n.` [R] |
| 2 | Pickle? | **Yes:** 27 independent top-level pickles [S][R] |
| 3 | Enough to rebuild a natal chart? | **For the moment and place, yes:** date, time, calendar, time basis, offset, DST and coordinates [S]. Settings are missing; see 9 |
| 4 | Timezone? | **Only a fixed offset**, ±HH:MM with hours limited to 0–12, as entered. There is no zone identifier or name [S] |
| 5 | Calendar convention? | **Yes:** explicit Gregorian/Julian flag and BC flag [S] |
| 6 | Coordinates? | **Yes**, as degrees, minutes, seconds and hemisphere. The dialog only produces arc-minutes, and Morinus drops longitude seconds on load [S] |
| 7 | DST and historical zone? | **DST only as a boolean meaning exactly +1 h.** There is no double summer time (e.g. UK 1941–45, +2 h), no half-hour DST, and no history. A historical offset is whatever the user typed [S] |
| 8 | Elevation? | **Yes**, as an integer (metres [A]) [S] |
| 9 | Chart settings? | **No.** House system (`options.hsys`), ayanamsha, topocentric and the rest are application-wide options pickled under `Opts/` (`SE:options.py:661-814`) and applied at calculation time (`SE:chart.py:289-307`) [S] |
| 10 | Can a browser extension parse it safely? | **Yes, with a restricted parser that never deserializes objects** (§3.6, §5) [R] |

Other things a `.hor` lacks [S]:

- birth-time precision or uncertainty;
- the source of the data;
- a Julian Day or stored UT (unlike AAF `#B93`);
- a format version or magic number.

### 3.4 Version differences: pickle protocols

| Writer | Protocol | Evidence |
|---|---|---|
| Python 2 Morinus (≤ 8.x on py2) | 0 (text) | `U:Hors/Morinus.hor`, identical to `C:Hors/Morinus.hor`, and 36 of 37 9x samples are protocol 0 [R] |
| Python 3.0–3.7 default (an earlier 9x build) | 3 | `9x:Hors/Morinus.hor` is protocol 3 [R] |
| 9x today | **2**, explicit | `9x:morin.py:1025` [S] |
| SE and U on Python 3.8–3.13 | 4 (interpreter default) | `pickle.DEFAULT_PROTOCOL` is 4 on 3.9.9 and on 3.13.11 [R] |
| SE and U on Python 3.14+ | 5 | Python 3.14 changed the default to 5 [A: from release notes; no 3.14 here] |

Opcodes actually observed in all upstream and generated files [R]:

- `PROTO`, `FRAME`, `STOP`;
- `INT` (including protocol 0's `I01`/`I00` booleans), `BININT1`, `BININT2`, `NEWTRUE`, `NEWFALSE`;
- `UNICODE`, `BINUNICODE`, `SHORT_BINUNICODE`;
- `PUT`, `BINPUT`, `MEMOIZE`.

### 3.5 Encoding

| Opcode | Encoding |
|---|---|
| `UNICODE` (protocol 0) | Python *raw-unicode-escape*. Characters below 256 are raw Latin-1 bytes; others are `\uXXXX`; a backslash is `\` and a newline `\u000a` [R: `pickle.dumps(s, 0)` output] |
| `BINUNICODE` / `SHORT_BINUNICODE` | UTF-8 [S] |
| Python 2 byte strings (`STRING`/`BINSTRING`) | Possible from a non-unicode wx build [A]. **They name no code page.** |

Byte strings matter in practice. On Python 3, Morinus's `pickle.load(f)` passes no `encoding=`, so a non-ASCII byte string raises `UnicodeDecodeError: 'ascii' codec can't decode byte 0xf5` [R]. 9x and SE catch only `IOError` (`9x:morin.py:986`, `SE:morin.py:791`), so that exception escapes `subLoad` [S]. U catches `Exception` and shows a dialog (`U:morin.py:781`) [S].

### 3.6 Security

- **Morinus's own loaders are unsafe.** `pickle.Unpickler(f)` and `pickle.load(f)` run without a `find_class` override [S]. CPython runs a callable embedded in a pickle on load: `cbuiltins\nprint\n(S'…'\ntR.` printed its argument [R]. **Opening a crafted `.hor` in any investigated Morinus can run arbitrary code.**
  - The same applies to `Opts/*` (`options.py:667+`) and the place database (`placedb.py:42`) [S].
  - Report this privately to the maintainers. A safe loader is a small upstream patch: a `find_class` that raises, or the restricted reader below ported to Python.
- **Chart Bridge never needs Python semantics.** The PoC accepts only opcodes that push a single str, int, float, bool or None, plus memo writes, protocol and frame markers.
  - Everything else is refused **by name and byte offset** [R]: `GLOBAL`, `STACK_GLOBAL`, `REDUCE`, `BUILD`, `INST`, `OBJ`, `NEWOBJ`, `MARK`, `GET`, containers, persistent IDs and extensions.
  - Each pickle must leave exactly one value on the stack, and there must be exactly 27 pickles and nothing after them [R].
  - Size is capped at 256 KiB; real files are 137–200 bytes [R].

---

## 4. Recommended interoperability architecture

### 4.1 Decision

**A. Native `.hor` importer, in Chart Bridge, with no Morinus changes.** The format is safely parseable [R], identical across versions [S], and carries the moment and place exactly as Morinus computes them [R]. Approach B is a later, optional upstream contribution. Approaches C and D are not needed:

| | Verdict | Reason |
|---|---|---|
| **A** Native importer | **Recommended first** | No Python or backend. The extension's existing file-import pipeline (AAF) is the template. Works for files from every version and platform |
| **B** Clipboard exporter in Morinus | Later, optional, upstream | Adds what `.hor` lacks (house system, zodiac, topocentric flag, Morinus's computed UT), but needs a patched Morinus on the user's machine |
| **C** External conversion utility | Not needed | The format needs no Python-specific handling |
| **D** Fork | Not recommended | Nothing in chart interchange needs it |

### 4.2 How A fits the existing pipeline (no parallel model)

```text
.hor file ── import.js (File API) ──┬─ .aaf: decodeAafFile → parseAaf → chartFromRecord ─┐
                                    └─ .hor: parseHor ─────────────────→ chartFromHor ───┤
                                                                                         ▼
                        natal result { kind, site, local, zoneLabel, lat, lng, utc, utcSource, offsetMinutes, warnings?, name, place, morinus }
                                                                                         ▼
                                  viewFor (popup-model.js) · toPortable (portable.js) · exportRecord/writeAaf (aaf.js)
```

- `chartFromHor` returns **the same shape `chartFromRecord` returns for AAF**: `site`, `local`, `lat`, `lng`, `utc`, `utcSource: "declared"`, `offsetMinutes`, `warnings`, `name`, `place`.
  - What the file states beyond that goes in a `morinus` provenance block, as `aaf` does for AAF: chart type, time basis, zone offset as entered, DST, calendar, altitude, raw coordinate parts, pickle protocol, and whether notes exist.
  - It reuses `utcFromOffset` (`extension/core/civiltime.js`) and `localIso`/`angle` (`extension/core/printed-chart.js`) rather than copying them [R: the PoC imports them].
- The PoC's integration tests show the result passes unchanged through:
  - `viewFor` (state `ready`);
  - `toPortable` → `serialize` → `parse` → `skyFor`, a round trip with the same UTC and place;
  - `exportRecord`/`writeAaf`, which writes UT [R].
- **Language.** The task suggests TypeScript, but the extension is plain ES modules with JSDoc, tested by `node --test`, with no build step (`package.json`). A TypeScript adapter would add a build or type-stripping step to a codebase that has none. **Recommendation: JavaScript with JSDoc types, like `core/aaf.js`.**
- **Site code.** The PoC uses `site: "morinus"`, the code the screenshot reader already uses (`extension/core/morinus.js`). Portable charts distinguish the two by `source.via` (`"file"` versus `"screenshot"`). Whether `via: "file"` should be added to the documented `via` values (`docs/portable-charts.md`) is an open question.
- **Elevation.** Chart Bridge's model has none. It stays in `morinus.altitudeMeters`. Adding elevation to the shared model, for example for Stellarium Desktop, is a separate decision, not part of this import.

### 4.3 What the importer opens and refuses

These reason codes match the AAF and screenshot readers where one exists.

| Case | Behaviour | Reason code |
|---|---|---|
| Radix or Horary | Opens | — (`morinus.chartType`) |
| Solar, Lunar, Revolution, Transit, Profections, PDs | Refused | `chart-type-unsupported` |
| BC flag | Refused | `bce-date` |
| Julian calendar | Refused | `julian-calendar` (as AAF) |
| Gregorian date before 1582-10-15 | Refused | `pre-gregorian-date` (as AAF) |
| Local mean time | Refused | `local-mean-time` (as AAF and astro.com) |
| Local apparent time | Refused | `local-apparent-time` (new) |
| Offset outside −12:00 to +14:00 | Refused | `offset-out-of-range` |
| Greenwich time with DST ticked | Opens at UT+1, as Morinus computes it | warning `daylight-saving-on-ut` |
| Nonzero longitude seconds | Opens with the file's longitude | warning `longitude-seconds-ignored-by-morinus` |
| Python 2 non-ASCII byte string | Opens, read as Windows-1252 | warning `text-encoding-guessed` (as AAF's `decodeAafFile`) |
| Malformed or hostile file | Refused | `unsupported-opcode` (opcode, offset, field), `truncated`, `trailing-data`, `field-type`, `field-range`, `bad-text`, `too-large` |

---

## 5. Minimal modification points

### 5.1 Chart Bridge, for approach A (as proposed; since built)

| File | Change |
|---|---|
| `extension/core/morinus-hor.js` (new) | `parseHor`, `chartFromHor`, `HOR_FIELDS`, ported from the PoC |
| `extension/hor-model.js` (new), or added to `aaf-model.js` | Refusal and warning messages and a `viewForHorFile` that reuses `viewFor`, as `viewForAafChart` does |
| `extension/import.js` | Dispatch by content. A `.hor` starts with `0x80`, `V`, `S`, `X`, `\x8c`… while AAF starts with `#` or a byte-order mark; the file extension is only a hint. Keep using `file.arrayBuffer()` |
| `extension/import.html` | Accept `.hor` in the file input. Text only through `textContent`, as now |
| `extension/popup-model.js` `WARNINGS` | Messages for the three new warning codes. Today an unknown code is shown raw [R] |
| `fixtures/morinus/` | **Generated fixtures only.** The upstream sample `.hor` files belong to GPL/AGPL repositories; copying them needs a licence decision (§8) |
| `docs/` | A page for the format and what a trip loses, like `docs/aaf.md` |

**Proof of concept**, written outside the repository during the investigation and since superseded by the shipped importer:

| File | Contents |
|---|---|
| `hor.js` (394 lines) | Restricted pickle reader and adapter |
| `test/hor.test.js` (23 tests) | Parser and adapter tests |
| `test/pipeline.test.js` (4 tests) | Chart Bridge integration |
| `make_fixtures.py` | Writes `fixtures/generated/*.hor`, 17 charts × protocols 0–5, with the 27 `pickle.dump` calls of Morinus's `save()`. It reads each file back with `pickle.load` |
| `fixtures/generated/morinus-oracle.json` | Morinus 9x's own `chart.Time` UT for each chart (`scripts/morinus_oracle.py`, with wx stubbed and the arm64 extension built in §7) |
| `fixtures/upstream/` | Three upstream sample files, for local testing only |

Result: `node --test` gives **27 pass, 0 fail** [R]. The tests were written first and failed with "not implemented" before the implementation existed [R].

### 5.2 Morinus, for approach B: Copy Chart Data for AstroChart Bridge (proposal, not implemented)

**Target: SE.** It has a single menu build, a Python 3 C module, active maintenance, and an extension that builds on arm64. **Swiss Ephemeris integration: unchanged.** The exporter only reads values already computed (`time.jd`) and calls the existing `swe_revjul` binding.

| File and function | Change |
|---|---|
| `bridgeexport.py` (new) | `chart_text(horoscope, options) -> str`: a pure function over `horoscope.name`, `.htype`, `.time.*`, `.place.*` and `options.hsys`/`.ayanamsha`/`.topocentric`. It is testable without a GUI if the module avoids importing `chart`/`options`; it only reads attributes of the object passed in |
| `SE:morin.py` `MFrame.__init__`, after `:212` | `self.ID_CopyBridge = wx.NewIdRef()` (avoids the hand-numbered `range()` blocks at `:164-182`) and `self.mhoros.Append(self.ID_CopyBridge, …)` |
| `SE:morin.py` around `:383-384` | `self.Bind(wx.EVT_MENU, self.onCopyBridge, id=self.ID_CopyBridge)` |
| `SE:morin.py` `enableMenus` `:2840-2850` | Enable it with `ID_Save` |
| `SE:morin.py` `onCopyBridge` (new) | `wx.TheClipboard.Open()` → `SetData(wx.TextDataObject(bridgeexport.chart_text(self.horoscope, self.options)))` → `Close()`, with an error dialog if the clipboard can't be opened. There is no existing clipboard code to follow: `TheClipboard` is not used anywhere in any version [S] |
| `SE:mtexts.py` | Menu label and help text, at least English and Spanish, with the others falling back |

For 9x the same change touches **both** menu builds (`9x:morin.py:309-312` and `:3526+`) and `enableMenus` at `:4319`.

**Payload.** The paste page reads "Label: value" lines and ignores unknown labels (`extension/core/text.js:8-10`, `LABELS` `:24-38`). It **silently drops a `Calendar: Julian` line** and reads the date as given: `readText` returned `date 1900-02-28, offset 121`, with no calendar field [R]. The exporter must therefore never emit a date the paste page would misread:

```text
AstroChart Bridge chart data (Morinus SE 8.0.0)
Name: …
Chart type: Radix
Birth date: 1583-02-23            ← only for Gregorian, AD, zone or Greenwich charts
Time of birth: 08:29:00
UTC offset: +01:00               ← zone ± DST as Morinus applies it; omitted for LMT/LAT
Time zone: Zone +01:00, daylight saving no (as entered in Morinus)
Calendar: Gregorian
Universal time: 1583-02-23 07:29:00 (computed by Morinus)
Latitude: 45°59'N
Longitude: 4°43'E
Elevation: 100 m
House system: Placidus
Zodiac: Tropical
Topocentric: no
```

Rules for the exporter:

- For Julian, BC, local-mean or local-apparent charts, write `Julian date:` or `Universal time:` lines **instead of** `Birth date:`/`UTC offset:`. The paste page then asks rather than misreading.
- Never write an IANA zone.
- Never write a precision the data lacks. Morinus has no birth-time uncertainty.

**Chart Bridge follow-up, independent of Morinus.** `text.js` should learn a `calendar` label and refuse non-Gregorian pasted dates. This gap exists today for every pasted source.

---

## 6. Helioscope calculation inventory (9x)

Source reading throughout: nothing in Morinus's GUI was run. Each item was read by a delegated review; I re-checked the key ones against the source.

| Phenomenon | Module and function | Swiss Ephemeris or custom | wx? | Headless? | Model |
|---|---|---|---|---|---|
| Heliacal rising/setting ("phasis": MF/ML/EF/EL) | `phasiscalc.py` (1,312 lines); GUI in `phasiswnd.py`, `phasisframe.py` | **Custom visibility model.** `swe_heliacal_ut` is exported by the C wrapper but **never called from Python** [S, re-checked]. Uses `swe_rise_trans`, `swe_azalt`, `swe_pheno_ut`, `swe_calc_ut` | Indirect: imports `chart`, `angleatbirth` → `common` → `options` → wx | Not as is [R: the chart import needs wx]; the calculation is pure `math` | Planets only (Saturn–Mercury), ±10 days, 1-minute scan. Limiting magnitude `mlim_unified` (`:476`): Patat-2006 twilight, Krisciunas–Schaefer 1991 moonlight, a veiling term, an aureole penalty, capped at NELM 6.0. Ray-traced airmass. Mallama–Hilton 2018 magnitudes |
| Extinction | `kV_from_altitude` `phasiscalc.py:647`; constants `KV0_SEA = 0.30`, `H0_M = 8000` (`:644-645`) [re-checked] | Custom | — | yes | Single kV scaled by site altitude |
| Refraction | `_refr_params` (`phasiscalc.py:242-263`, ISA from altitude); `swe_azalt` at `:97-101` reads `xaz[1]` [re-checked] | SE | — | — | In the Swiss Ephemeris API, `xaz[1]` is *true* (unrefracted) altitude, so refraction likely affects only sunrise and sunset [A: needs a run] |
| Limiting magnitude, moonlight | `phasiscalc.py:387`, `:404-443`, `:476-506` | Custom | — | yes | Hard-coded parameters; no observer age or acuity; humidity computed but not passed (`:235`, `:1059`) |
| Rise/set/culmination | `riseset.py` `RiseSet.calcTimes` `:36-87` (`swe_rise_trans` `:61-65`) [re-checked] | SE | `risesetwnd.py` only | yes, given the `sweastrology` import | Disc centre, **no refraction**, 0° horizon, planets only. SE's `riseset.py` instead uses refraction **on** and the upper limb |
| Paranatellonta | `paranwnd.py` (calculation and wx/PIL GUI in one file); `_angle_times_planet_in` `:364-397`; tolerance `ANGLE_TOL_MIN = 2.0` (`:18`, test `:999`) [re-checked] | Custom local-sidereal-time solver plus `swe_calc_ut`/`swe_fixstar_ut` | **Same file** | Must be split out | **Whole-day paran at the birth latitude** (sunrise to sunrise), Sun–Saturn × selected stars, all four angles, ±2 min. Geometric horizon, no refraction or dip. Actual body RA/Dec, planets topocentric |
| Angle at Birth | `angleatbirth.py` `compute_contacts` `:317-440` | Custom spherical trigonometry; `swe_fixstar_mag` | Indirect (`common`) | needs decoupling | Stars on the angles within ±N min (default 10) of birth; geometric. Bold rules by magnitude are interpretive emphasis |
| Fixed-star angular directions | `fixstardirs.py` | Custom primary-direction arcs | Indirect | — | **Symbolic technique, not an observation** |
| Fixed stars | `fixstars.py:13-43` (`swe_fixstar_ut`); catalogue `SWEP/Ephem/sefstars.txt` and `fixstars.cat` | SE | Indirect | — | Geocentric tropical ecliptic, then RA/Dec |
| Combustion / under the beams / cazimi | None. Only `combust_today` (`phasiscalc.py:1296-1305`), never displayed | — | — | — | — |

Answers to the ten questions:

1. **Swiss Ephemeris directly:** rise/set, fixed stars, star magnitudes, and the positions inside phasis and paran.
2. **Custom:** the visibility model, the paran solver, angle-at-birth contacts, primary-direction arcs.
3. **wx:** every module that imports `chart` or `common` [R for `chart`].
4. **Headless:** none as is. The phasis maths and the paran solver functions can be with an adapter object [A].
5. **Needs `sweastrology`:** all, in its 9x form. 9x's Python code unpacks the returns inconsistently: 2-tuples at `planets.py:64` and `paranwnd.py:258`, 3-tuples at `asteroids.py:10` and `phasiscalc.py:107`. The C source for the Python 3 binary that actually runs is **not in the repository** [R: the `.pyd` links `python37.dll`; the C source is Python 2].
6. **Reproducible with maintained libraries:** positions, rise/set and fixed stars (e.g. pyswisseph, Skyfield or Astronomy Engine) [A]. The visibility model is literature formulas and could be re-implemented from its cited papers.
7. **Paran definition:** whole-day co-angularity at the birth latitude with a ±2-minute window. Whether that matches Helioscope's definition is a product decision (open question).
8. **Frame:** observer-dependent and partly topocentric (planets in parans, sunrise). The rise/set and paran horizon is geometric.
9. **Atmosphere configurable:** **No.** Every atmospheric parameter is a module constant with no user interface.
10. **Validation:** **None.** The 36 `Hors/Heliacal Risings&Settings/*.hor` files are input charts only (we decoded Saturn EL5: −574 Julian, Baghdad, noon) [R]. Nothing compares outputs against them [S].

**Use as:**

| Use | Verdict |
|---|---|
| Production | No |
| Test oracle | No: unvalidated |
| Reference implementation | Yes, for the twilight, moonlight and extinction composition and the paran solver |
| Historical comparison | Yes: the Babylonian and Ammisaduqa sample inputs are a ready-made set to compare Helioscope against published dates, which must come from independent sources |
| Starting point for independent re-implementation | Yes, from the cited papers rather than the code (see §8 E) |

Morinus SE has none of these modules except rise/set [S].

---

## 7. Apple Silicon feasibility

### 7.1 Confirmed (macOS 26.6.2, arm64)

| Experiment | Result |
|---|---|
| Build 9x `SWEP/src` with Python 3.9 | **Fails**: `astrologymodule.c:961: error: call to undeclared function 'Py_InitModule'` [R] |
| Build 9x `SWEP/src` with Python 3.13 | **Fails**: `ModuleNotFoundError: No module named 'distutils'` (`setup.py:1`) [R] |
| Build SE `SWEP/src` with Python 3.9 | **Succeeds**: `sweastrology.cpython-39-darwin.so: Mach-O 64-bit bundle arm64`, 24 compiler warnings, Apple clang 17 [R] |
| SE's build on Homebrew Python 3.13 | Needs `setuptools`, which is not installed (`No module named 'setuptools'`) [R]. Not attempted further, to avoid installing packages |
| Run 9x `chart.Time` on the arm64 SE extension (wx stubbed) | **Works.** It gave Julian Days for all 17 fixtures, e.g. `ny-edt-as-zone-4` → JD 2460418.0 = 2024-04-17T12:00:00Z [R] |
| Import `chart` without wx | **Fails** (`options.py:4`) [R] |
| Bundled binaries | 9x: `.pyd` PE32 i386 (python37), `.so` ELF x86-64 (Python 2). SE: `.pyd` PE32 i386 (python27), `.so` ELF x86-64 (cpython-313). **No macOS binaries in any repository** [R] |
| wxPython wheels | 4.3.2 has `macosx_11_0_arm64` wheels for CPython 3.10–3.15 and requires Python ≥ 3.10 [M]. 4.2.1 has `universal2` for 3.8–3.12 [M] |
| pyswisseph wheels (U) | Latest 2.10.3.2 publishes macOS `universal2` wheels only for cp38–cp311 [M]. Newer Pythons need a source build [A] |

### 7.2 Speculative risks [A]

- Writable state is under the program directory: `Opts/`, `Hors/`, and `os.chdir` to the script directory (`9x:morinus.py:22-25`, `options.py:406`). A signed `.app` bundle is read-only.
- There is no macOS menu-bar or accelerator handling; Windows-only branches use `wx.Platform == '__WXMSW__'`.
- Fonts in `Res/` may render differently.
- No macOS packaging (no `.spec` or `py2app`).
- Notarization.
- In U, the shim's zero-on-error return values could silently produce wrong charts if a `pyswisseph` call fails [S].

### 7.3 Estimated modernization effort (macOS arm64, run from source)

| Version | Effort | Main work |
|---|---|---|
| **SE** | **Low: about 1–3 days** | venv with Python 3.12/3.13, setuptools and the wxPython 4.3.2 arm64 wheel, build `sweastrology` (compiles on arm64, confirmed), move writable paths, smoke-test the GUI |
| **9x** | **Moderate to high: about 1–2 weeks, uncertain** | Rebuild the Python 3 C wrapper. Its source isn't published, and the Python code expects return shapes the repo's C source doesn't produce. Alternatively, port the binding layer to pyswisseph and reconcile the tuple shapes. Then Windows path assumptions, packaging and the SE work above |
| **U** | Low to moderate | pyswisseph source build on ≥ 3.12, and an audit of the shim's silent zero returns |
| **C** | Not worth it | Python 2 remnants, dormant, no licence |

Chart Bridge's `.hor` importer needs **none** of this: it reads files any Morinus produced, on any platform.

---

## 8. Licensing considerations

No legal conclusions are given here. Each point is something to verify or review.

### 8.1 What the files say

| Item | Licence text found | Mismatch |
|---|---|---|
| Original Morinus (Robert Nagy, 2008–) | GPL-3.0-or-later headers (`9x:morinus.py:5-19`; also in SE and U) | — |
| 9x | `LICENSE` = AGPL-3.0; GitHub = AGPL-3.0 [M]; `Res/COPYING.txt` = GPL-3.0; About text "GPLv3" (`mtexts.py:228`) | **Repository licence (AGPL) differs from the in-app and header licence (GPL).** The new modules (phasis, paran and others) have no headers [S] |
| SE | `LICENSE.txt` = LGPL-3.0 text only; GitHub = LGPL-3.0 [M]; README badge = GPL v3; headers GPL-3.0-or-later | **LGPL text without the GPL-3.0 text it supplements, contradicting the README and headers.** Relicensing GPL code as LGPL needs the copyright holders' permission |
| U | GPL-3.0 | — |
| C | None | Derived from GPL code with no licence file |
| Swiss Ephemeris C source (`SWEP/src/LICENSE`, © 1997–2008) | Dual: **GPL-2.0-or-later** or Swiss Ephemeris Professional | An old notice. Current releases are AGPL or Professional [A] |
| Swiss Ephemeris data (`SWEP/Ephem/LICENSE`, © 1997–2021, plus `agpl-3.0.txt`) | Dual: **AGPL** or Professional | Differs from the bundled C source notice |
| `sefstars.txt`, `fixstars.cat`, `.se1` files | Astrodienst Swiss Ephemeris distribution [S] | Covered by the Swiss Ephemeris notice. The underlying star catalogues' own terms are not checked |

### 8.2 Architectures

| Architecture | Likely obligation profile (for review) |
|---|---|
| **A.** Extension imports `.hor` | Our own reader of a file format, documented from observation. No Morinus code or Swiss Ephemeris is copied, linked or run. **Watch:** don't copy Morinus code into the parser (the PoC contains none); don't ship upstream sample `.hor` files without a licence decision (the PoC uses generated ones); Chart Bridge itself has **no LICENSE file** in the repository today |
| **B.** Morinus clipboard exporter | A modification of a GPL-3.0-or-later or AGPL-3.0 program. The contributed code is distributed under that program's licence; whoever distributes the modified Morinus has source obligations. Chart Bridge reading the clipboard text is a separate program |
| **C.** Chart Bridge talks to a separate Morinus process | Clipboard, files or a local socket between separate programs is commonly treated as non-combining [A]. A *converter that imports Morinus modules* would be a derivative of Morinus |
| **D.** Helioscope incorporates modified Morinus algorithms | A derivative of GPL-3.0-or-later or AGPL-3.0 (9x) code. With AGPL, **network use counts as distribution (§13)**, which matters if Helioscope runs as a web service. If it also uses the Swiss Ephemeris, its AGPL or Professional licence applies separately |
| **E.** Helioscope re-implements the mathematics independently | Formulas and published models are not the code's expression. Re-implementing from the cited papers (Patat 2006, Krisciunas & Schaefer 1991, Mallama & Hilton 2018, Schaefer) with a documented clean-room process avoids Morinus obligations [A]. Using Swiss Ephemeris through any binding still brings its licence; MIT-licensed alternatives (Skyfield, Astronomy Engine) avoid that [A] |

### 8.3 Needs legal review

- Which licence actually applies to 9x's new modules: AGPL or GPL.
- The validity of SE's LGPL relicensing.
- Whether Helioscope's deployment (desktop versus service) triggers AGPL §13.
- The Swiss Ephemeris licence choice for Helioscope, and the GPL-2 versus AGPL notice mismatch in the bundled copies.
- The licence for Chart Bridge itself, needed before accepting upstream fixtures.

---

## 9. Test strategy

### 9.1 Principles (applied in the PoC)

- **Expected values never come from the parser under test.**
  - Input values come from the script that wrote the files with CPython's `pickle`, and that script reads each file back.
  - UTCs come from **Morinus's own `chart.Time`** (the oracle).
  - Upstream sample values come from `pickletools` disassembly, which never unpickles.
- **Refusals are exact.** Each test asserts a reason code and the field, opcode and offset.
- **Silent changes are pinned by tests that state them:**
  - longitude seconds (file −12.582222° versus Morinus's drawn −12.566667°);
  - Greenwich with DST (07:00Z, not 08:00Z);
  - an ignored zone on a Greenwich chart (`morinus.zoneOffsetMinutes` keeps the entry).

### 9.2 Coverage matrix

| Case | Fixture | Status |
|---|---|---|
| Modern chart, known zone (NY, EDT entered as −4) | `ny-edt-as-zone-4` | Opens; UTC matches the oracle |
| Same moment as EST + DST box | `ny-est-plus-dst` | Opens; offset −240 matches the oracle |
| Non-integer offsets | `kolkata-0530`, `kathmandu-0545` | +330, +345, match the oracle |
| Southern hemisphere, DST | `sydney-south` | +660, −33.866667°; matches the oracle |
| High latitude | `tromso-high-lat` | Opens; matches the oracle |
| Greenwich; Greenwich with DST | `greenwich`, `greenwich-with-dst` | 0 / UT; +60 with a warning; match the oracle |
| Local mean, local apparent | `local-mean`, `local-apparent` | Refused (oracle UT recorded: 12:56:00Z and 12:56:24Z) |
| Julian calendar | `julian-1900` (29 Feb 1900, Julian only) | Refused. The oracle gives 1900-03-13T05:59Z Gregorian, for a future Julian import |
| Gregorian, just after the reform | `gregorian-1583` | Opens |
| BCE | `bce-julian`; upstream `Saturn EL5` | Refused; upstream file read correctly |
| Chart types | `horary` (opens), `solar-return` (refused) | ✔ |
| Seconds in coordinates | `seconds-in-coords` | Opens with a warning |
| Non-ASCII, backslash, newline | `unicode-text` | ✔ all protocols |
| Python 2 byte string | hand-built `STRING` | ✔ with an encoding warning |
| File versions | protocols 0–5 × all charts; upstream p0 and p3 | ✔ |
| Hostile or malformed | `GLOBAL` at start and in notes, `STACK_GLOBAL`, `GET`, `MARK`, `EMPTY_DICT`, truncation, trailing bytes, wrong type, out of range, oversize | ✔ refused |

### 9.3 Not yet covered

- **Unknown birth time.** `.hor` has no way to say it; Morinus always stores a time. Nothing to test, but document that Chart Bridge can't tell.
- **Historical chart with an uncertain zone.** The file holds only what the user typed. Chart Bridge should present the offset as "declared by the Morinus user" and never infer a zone. A historical-zone check (for example against tzdb) would be a separate, explicitly labelled feature.
- **Different house systems and sidereal charts.** These are not in `.hor` (§3.3, question 9). Testable only through approach B.
- **Daylight-saving transition instants** (gap or overlap). `.hor` states the offset explicitly, so no ambiguity reaches Chart Bridge. Add one fixture at a transition to pin that no zone database is consulted.
- **A real Python 2 Morinus file with non-ASCII text.** None was found; no Python 2 interpreter was available.

---

## 10. Recommended implementation sequence

Each step is a separate, reviewable change.

1. **Decide the open questions in §12** that affect the code: site code, `via: "file"`, fixture licensing.
2. **`core/morinus-hor.js` and tests.** Port the PoC as is, with generated fixtures committed under `fixtures/morinus/` and the generator script under `tools/`.
3. **Import page.** Dispatch `.hor` versus `.aaf` by content, plus refusal and warning messages and a docs page.
4. **Manual test** in Chrome, Firefox and Safari with real Morinus-saved files, one per protocol, in `docs/manual-test.md`.
5. *(Independent)* **`text.js` calendar label.** Refuse non-Gregorian pasted dates.
6. *(Optional, upstream)* **Privately report the unsafe `pickle.load` to SE and 9x**, offering a safe loader.
7. *(Optional, upstream)* **Clipboard exporter for SE**, per §5.2, after the licence question is clarified with its maintainer.
8. *(Helioscope, separate project)* Clean-room re-implementation from the literature. Use 9x outputs only as a historical comparison, after legal review.

## 11. Estimated effort

| Work | Size | Estimate |
|---|---|---|
| Step 2: parser and adapter (PoC exists: 394 lines plus 282 test lines) | Small | 1 day to productionize and review |
| Step 3: import page dispatch, messages, docs | Small | 1–2 days |
| Step 4: cross-browser manual test | Small | 0.5 day |
| Step 5: calendar label in `text.js` | Small | 0.5 day |
| Step 6: safe-loader patch for Morinus | Small | 0.5–1 day, plus maintainer coordination |
| Step 7: SE clipboard exporter, ~100–150 lines of Python plus strings | Small to medium | 2–3 days including a macOS or Linux run (§7.3) and an upstream PR |
| SE on macOS arm64 from source | Small | 1–3 days |
| 9x on macOS arm64 | Medium to large | 1–2 weeks, uncertain |

## 12. Open questions

1. Should a `.hor` chart use `site: "morinus"` (shared with the screenshot reader) or a new code, and should `via: "file"` be documented in `docs/portable-charts.md`?
2. Should Julian and BC charts eventually open? A `.hor` states its calendar explicitly, unlike pasted text, so it would be the safest first Julian source. But the portable v1 format refuses non-Gregorian charts, and Stellarium Web needs a UTC instant.
3. Should local mean and local apparent time open, using Morinus's rule (longitude degrees and minutes only; equation of time for LAT)? The second requires an equation-of-time implementation in Chart Bridge.
4. Should elevation enter the shared chart model, for Stellarium Desktop?
5. What licence does Chart Bridge carry? Can GPL/AGPL sample `.hor` files be committed as fixtures?
6. Does Helioscope's "paran" mean whole-day co-angularity at the birth latitude (9x's definition) or something else? Over what time window?
7. Who maintains SE's licensing, and will they confirm GPL-3.0-or-later?
8. Should the unsafe-unpickling finding be reported to the 9x and SE maintainers, and through which channel?

---

## Conclusion

**Modify no Morinus version for the first implementation.**

The smallest useful first implementation is a **native `.hor` import on Chart Bridge's existing import page**:

- `parseHor` and `chartFromHor`, as proven in the scratch PoC;
- opening Gregorian AD Radix and Horary charts entered in zone or Greenwich time;
- refusing everything else with explicit reasons;
- surfacing Morinus's silent quirks as warnings.

It works with files from every investigated Morinus version and platform, needs no Python, backend or new dependency, never deserializes objects, and produces the same chart shape as the AAF import, so the popup screens, sharing and AAF export work unchanged.

If a Morinus change is later wanted, for house system, zodiac or topocentric settings, which `.hor` cannot carry, it should be a small clipboard exporter contributed upstream to **Morinus SE**, once SE's licence is clarified. **Morinus 9.x** matters for Helioscope as a reference and historical comparison, not as a codebase to modify.
