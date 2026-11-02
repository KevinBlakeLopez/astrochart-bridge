import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../extension/import.html", import.meta.url), "utf8");

// An accept list greyed out .hor files in the macOS file dialog, since no app
// on the computer registers the extension. import.js tells AAF from Morinus by
// content and refuses anything else with a message, so the dialog offers all files.
test("the import page's file input offers every file", () => {
  const input = /<input id="file"[^>]*>/.exec(html)?.[0];
  assert.ok(input, "the file input is on the page");
  assert.doesNotMatch(input, /\saccept=/);
});
