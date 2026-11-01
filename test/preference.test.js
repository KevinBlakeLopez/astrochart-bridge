import { test } from "node:test";
import assert from "node:assert/strict";
import { desktopPreferred, setDesktopPreferred } from "../extension/preference.js";

// A stand-in for chrome.storage.local: get, set and remove, as promises.
function storage(initial = {}) {
  const items = { ...initial };
  return {
    items,
    async get(key) {
      return Object.hasOwn(items, key) ? { [key]: items[key] } : {};
    },
    async set(entries) {
      Object.assign(items, entries);
    },
    async remove(key) {
      delete items[key];
    },
  };
}

test("Stellarium Web is the default until the user chooses otherwise", async () => {
  assert.equal(await desktopPreferred(storage()), false);
});

test("choosing Stellarium Desktop is kept, and choosing Stellarium Web again forgets it", async () => {
  const area = storage();
  await setDesktopPreferred(area, true);
  assert.equal(await desktopPreferred(area), true);
  await setDesktopPreferred(area, false);
  assert.equal(await desktopPreferred(area), false);
  assert.deepEqual(area.items, {});
});

test("anything else stored under the key reads as Stellarium Web", async () => {
  assert.equal(await desktopPreferred(storage({ "default-sky": "something-else" })), false);
  assert.equal(await desktopPreferred(storage({ "default-sky": true })), false);
});
