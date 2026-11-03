import { test } from "node:test";
import assert from "node:assert/strict";
import { desktopPreferred, setDesktopPreferred, setShareIncludes, shareIncludes } from "../extension/preference.js";

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

test("a shared chart carries neither its name nor its town until the user ticks one", async () => {
  assert.deepEqual(await shareIncludes(storage()), { name: false, town: false });
});

test("the boxes ticked are kept, and clearing both forgets the choice", async () => {
  const area = storage();
  await setShareIncludes(area, { name: true, town: false });
  assert.deepEqual(await shareIncludes(area), { name: true, town: false });
  await setShareIncludes(area, { name: true, town: true });
  assert.deepEqual(await shareIncludes(area), { name: true, town: true });
  // The choice, never the name or town themselves.
  assert.deepEqual(area.items, { "share-labels": { name: true, town: true } });
  await setShareIncludes(area, { name: false, town: false });
  assert.deepEqual(await shareIncludes(area), { name: false, town: false });
  assert.deepEqual(area.items, {});
});

test("anything but true stored for a box reads as unticked", async () => {
  assert.deepEqual(await shareIncludes(storage({ "share-labels": { name: "yes", town: 1 } })), { name: false, town: false });
  assert.deepEqual(await shareIncludes(storage({ "share-labels": "name" })), { name: false, town: false });
  assert.deepEqual(await shareIncludes(storage({ "share-labels": null })), { name: false, town: false });
});
