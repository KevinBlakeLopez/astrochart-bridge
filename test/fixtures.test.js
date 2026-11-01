import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";

const root = new URL("../fixtures/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const sites = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

// Every fixture in every site's folder is tested, so a new capture is checked
// as soon as it is added. One whose expected block is still null fails
// instead of being skipped.
for (const site of sites.sort()) {
  for (const file of readdirSync(new URL(`${site}/`, root)).filter((name) => name.endsWith(".json")).sort()) {
    test(`fixture ${site}/${file}`, () => {
      const { url, input, expected } = read(`${site}/${file}`);
      assert.notEqual(expected, null, "expected block not filled in yet");
      assert.deepEqual(analyzePage({ url, input }), expected);
    });
  }
}

// Astro-Seek fixtures keep only the page's header block, the lines Chart Bridge
// reads; tools/trim-fixture.mjs trims a new capture and records what the whole
// page showed in capture. On every natal page, each label readChart looks for
// appeared exactly once.
for (const file of readdirSync(new URL("astroseek/", root)).filter((name) => name.endsWith(".json")).sort()) {
  const { expected, capture } = read(`astroseek/${file}`);
  test(`fixture astroseek/${file} is trimmed`, () => {
    assert.ok(capture, "run tools/trim-fixture.mjs on it before committing");
  });
  if (expected?.kind !== "natal" || !capture) continue;
  test(`fixture astroseek/${file}: each label appeared once on the whole page`, () => {
    for (const [label, count] of Object.entries(capture.labelCounts)) assert.equal(count, 1, label);
  });
}

test("a readChart refusal comes back unchanged", () => {
  const { url } = read("astroseek/ny-2024-04-17.json");
  assert.deepEqual(analyzePage({ url, input: { text: "" } }), { kind: "refused", reason: "unreadable-page" });
});
