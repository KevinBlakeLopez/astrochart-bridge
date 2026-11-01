// Trims an Astro-Seek fixture to the header block Chart Bridge reads, and
// records what the full page showed in a "capture" summary. The rest of the
// page is Astro-Seek's own text, which this repo doesn't republish, so run
// this on every new capture before committing it:
//
//   node tools/trim-fixture.mjs fixtures/astroseek/<file>.json...
//
// It trims the files in place and leaves an already trimmed fixture alone.
import { readFileSync, writeFileSync } from "node:fs";

const LABELS = ["Date of Birth (local time):", "Universal Time (UT/GMT):", "Latitude, Longitude:"];
// The first header line on each kind of page: natal and its variants, transit,
// love compatibility.
const STARTS = ["Date of Birth (local time):", "Birth chart (local time):", "Partner A"];

export function trimFixture(json) {
  const fixture = JSON.parse(json);
  if (fixture.capture) return json;
  const lines = fixture.input.text.split("\n");
  const start = lines.findIndex((line) => STARTS.includes(line.trim()));
  if (start < 0) throw new Error(`no header start in ${fixture.url}`);

  // Natal and transit headers end with the (last) coordinates line; the
  // compatibility header ends just before "Aspects & Compatibility:".
  const lastCoords = lines.findLastIndex((line) => line.trim() === "Latitude, Longitude:");
  const aspects = lines.findIndex((line) => line.trim() === "Aspects & Compatibility:");
  const end = lastCoords >= start ? lastCoords + 1 : aspects - 1;
  if (end < start) throw new Error(`no header end in ${fixture.url}`);

  const capture = {
    lines: lines.length,
    headerLine: start + 1,
    labelCounts: Object.fromEntries(LABELS.map((label) => [label, lines.filter((line) => line.trim() === label).length])),
  };
  const trimmed = {};
  for (const [key, value] of Object.entries(fixture)) {
    trimmed[key] = key === "input" ? { ...value, text: lines.slice(start, end + 1).join("\n") } : value;
    if (key === "capturedAt") trimmed.capture = capture;
  }
  return JSON.stringify(trimmed, null, 2) + "\n";
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  for (const file of process.argv.slice(2)) {
    const before = readFileSync(file, "utf8");
    const after = trimFixture(before);
    writeFileSync(file, after);
    console.log(`${file}: ${before.length} -> ${after.length} characters`);
  }
}
