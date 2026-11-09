import { test } from "node:test";
import assert from "node:assert/strict";
import { isExtensionCopy } from "../extension/extension-copy.js";

test("a page from the extension's own files is the extension's copy, in every browser", () => {
  assert.equal(isExtensionCopy("moz-extension://0d3a91c2-7f4e-4b8a-9c1d-2e5f6a7b8c9d/paste.html"), true);
  assert.equal(isExtensionCopy("chrome-extension://abcdefghijklmnopabcdefghijklmnop/import.html"), true);
  assert.equal(isExtensionCopy("safari-web-extension://3F2504E0-4F89-11D3-9A0C-0305E82C3301/screenshot.html"), true);
});

test("a page from the web, or from a copy of the site served on this computer, is the web's copy", () => {
  assert.equal(isExtensionCopy("https://kevinblakelopez.github.io/astrochart-bridge/chart.html#c=1"), false);
  assert.equal(isExtensionCopy("http://127.0.0.1:8000/paste.html"), false);
  assert.equal(isExtensionCopy("http://localhost:8000/import.html"), false);
  assert.equal(isExtensionCopy("file:///Users/someone/site/screenshot.html"), false);
});

test("only the address's scheme counts, not a host or path that mentions an extension", () => {
  assert.equal(isExtensionCopy("https://moz-extension.example/paste.html"), false);
  assert.equal(isExtensionCopy("https://example.org/chrome-extension:/paste.html"), false);
});
