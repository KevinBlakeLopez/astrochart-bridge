# Golden charts

`fixtures/golden/` holds reference charts, one file each. `test/golden.test.js` sends every one through every way a chart leaves AstroChart Bridge (Stellarium Web, Astro-Seek, astro.com's form, Stellarium Desktop, an AAF file and a shared link) and checks that each destination gets the chart's instant and place to within what it can hold. The test's header has the table of tolerances.

The expected values come from `tools/make-golden.py`, not from the extension: the offset from the IANA time zone database through Python's `zoneinfo`, the UTC from Python's `datetime`, and the Julian Day from Meeus's calendar formula. Adding or changing a case needs Python 3.9 or later; running the tests needs only Node.

```bash
python3 -I tools/make-golden.py --write
```

```bash
python3 -I tools/make-golden.py
```

The first writes each case's `expected` block; the second checks them and fails on any that has changed. Read a changed block before keeping it: after a tzdata update it may be a corrected historical offset.

## Invented charts

`"kind": "invented"`. The record is a wall-clock time, the IANA zone that decides its offset and a place. A time that happens twice, or that the clocks skip, needs `fold`: 0 for the earlier offset, 1 for the later. The coordinates are a place in the zone; nothing depends on their being a town's.

## Well-known people's charts

`"kind": "public-record"`. The record is the person's Astro-Databank entry, copied from their page, kept as copied. The offset the chart carries is the one the entry states. The record's `zone` is the IANA zone chosen for the birthplace, a second opinion: where its offset differs from the entry's, `expected.disputed` is true, and the case still checks that the stated offset is the one carried. Only Rodden ratings AA and A are accepted; the script refuses any other.

A case waiting for its entry has `"astroDatabank": null`. The script skips it and the test lists it as a todo.

### Copying an entry

astro.com checks the browser before it shows a page, so entries are copied by hand. Open the person's page, open the browser's console (in Firefox, type `allow pasting` before the first paste) and run:

```js
(() => {
  const lines = document.body.innerText.split("\n").map((line) => line.trim());
  const at = (label) => lines.findIndex((line) => new RegExp(`^${label}\\b`, "i").test(line));
  const row = (label) => lines[at(label)] ?? null;
  // The data source is on the line after its label.
  const source = at("Data source");
  const record = {
    url: decodeURI(location.href),
    title: document.title,
    born: row("born on"),
    place: row("Place"),
    timezone: row("Timezone"),
    dataSource: source < 0 ? null : (lines[source + 1] ?? null),
    rodden: row("Rodden Rating"),
  };
  const text = JSON.stringify(record);
  copy(text);
  console.log(text);
})();
```

It prints one line, copied to the clipboard too. Put the lines in a file, one per person, and run:

```bash
python3 -I tools/make-golden.py --paste < entries.txt
```

Each line goes into the case whose `page` is its address. Then run the script with `--write`. A row the script can't read stops it with the row quoted: the parser in `make-golden.py` is fixed to read it, never the row edited.

### Swapping a person

Each person is one file. To swap one, delete it, or change its `id` (and the file name with it), `person`, `page` and `zone`, set `astroDatabank` and `expected` back to null, and copy the new person's entry in.

## Golden charts on Astro-Seek

A golden chart can also come in from Astro-Seek's own page. An Astro-Seek fixture with `"golden": "<id>"` is read by `test/golden.test.js` as well as `test/fixtures.test.js`, and must give that case's instant to the second and its place to the minute of arc Astro-Seek prints.

Astro-Seek's Cloudflare check keeps automated browsers out, so captures are made by hand, signed out or in a private window so the page shows no account. Open the case's Astro-Seek link, which `astroSeekUrl` builds from its UTC and place, with `#golden=<id>` on the end. Then run this in the console:

```js
(() => {
  const golden = new URLSearchParams(location.hash.slice(1)).get("golden");
  if (location.hostname !== "horoscopes.astro-seek.com" || !golden) {
    return console.error("Not a golden link: open the case's calculator link, ending in #golden=<id>, and run this again.");
  }
  const url = location.href.replace(/#.*$/, "");
  const fixture = { url, input: { text: document.body.innerText }, capturedAt: new Date().toISOString(), golden, expected: null };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(fixture, null, 2) + "\n"], { type: "application/json" }));
  link.download = `golden-${golden}.json`;
  link.click();
})();
```

It downloads `golden-<id>.json`. Move it to `fixtures/astroseek/`, trim it with `node tools/trim-fixture.mjs`, which keeps only the header block, and fill in its `expected` block from `analyzePage` once the golden test passes.
