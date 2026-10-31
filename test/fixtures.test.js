import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";

const dir = new URL("../fixtures/astroseek/", import.meta.url);
const fixture = (file) => JSON.parse(readFileSync(new URL(file, dir), "utf8"));

// Every fixture is tested, so a new capture is checked as soon as it is added.
// One whose expected block is still null fails instead of being skipped.
for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
  test(`fixture ${file}`, () => {
    const { url, input, expected } = fixture(file);
    assert.notEqual(expected, null, "expected block not filled in yet");
    assert.deepEqual(analyzePage({ url, text: input.text }), expected);
  });
}

test("a readChart refusal comes back unchanged", () => {
  const { url } = fixture("ny-2024-04-17.json");
  assert.deepEqual(analyzePage({ url, text: "" }), { kind: "refused", reason: "unreadable-page" });
});
