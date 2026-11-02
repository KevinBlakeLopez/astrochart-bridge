import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { OTHER_WAYS, withOtherWays } from "../extension/popup-model.js";

test("the other ways in come in two groups: what you have, then Stellarium Desktop", () => {
  assert.deepEqual(
    OTHER_WAYS.map(({ label, buttons }) => [label, ...buttons.map((button) => button.label)]),
    [
      ["Read a chart you have", "Read a screenshot", "Paste chart text", "Open an AAF or Morinus file", "Open an AstroChart Bridge file"],
      ["Or use the sky in Stellarium Desktop", "Import from Stellarium Desktop"],
    ],
  );
});

test("each other way opens a page the extension has, or imports from Stellarium Desktop", () => {
  for (const { label, page, does } of OTHER_WAYS.flatMap(({ buttons }) => buttons)) {
    if (page) assert.equal(existsSync(new URL(`../extension/${page}`, import.meta.url)), true, label);
    else assert.equal(does, "import-from-desktop", label);
  }
});

test("a popup chart screen gets the other ways as Read a different chart, and keeps the rest", () => {
  const view = { state: "ready", notes: [], buttons: [] };
  assert.deepEqual(withOtherWays(view), { ...view, more: { label: "Read a different chart", groups: OTHER_WAYS } });
});
