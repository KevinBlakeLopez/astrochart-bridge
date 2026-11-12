import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, helioscopeSettings, setHelioscopeSettings } from "../extension/helioscope-model.js";
import { DEFAULT_SETTINGS as PARANS_DEFAULTS, paransSettings, setParansSettings } from "../extension/parans-model.js";
import { declinationsSettings, setDeclinationsSettings } from "../extension/declinations-model.js";
import { webStorageArea } from "../extension/web-storage.js";

// A stand-in for localStorage: getItem, setItem and removeItem, keeping
// strings, as the browser's does.
function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  };
}

// An elevation, and cazimi within 16′, combust 8° and under the beams 17°, in
// minutes of arc.
const CHOSEN = { elevation: 120, orbs: { cazimi: 16, combust: 480, underTheBeams: 1020 } };

test("on the web, Helioscope's settings are kept in localStorage under the site's own name, and forgotten at the defaults", async () => {
  const localStorage = memoryStorage();
  const area = webStorageArea({ localStorage });
  assert.deepEqual(await helioscopeSettings(area), DEFAULT_SETTINGS);
  await setHelioscopeSettings(area, CHOSEN);
  assert.deepEqual(Object.fromEntries(localStorage.items), {
    "astrochart-bridge:helioscope-settings": '{"elevation":120,"orbs":{"cazimi":16,"combust":480,"underTheBeams":1020}}',
  });
  assert.deepEqual(await helioscopeSettings(area), CHOSEN);
  await setHelioscopeSettings(area, DEFAULT_SETTINGS);
  assert.equal(localStorage.items.size, 0);
});

test("on the web, something that isn't JSON under the key is nothing kept, and the origin's other keys are left alone", async () => {
  // Every GitHub Pages site of the account shares the site's origin, and so
  // its localStorage.
  const others = { "helioscope-settings": '{"elevation":120}', "another-site:theme": "dark" };
  const localStorage = memoryStorage({ "astrochart-bridge:helioscope-settings": "{elevation", ...others });
  const area = webStorageArea({ localStorage });
  assert.deepEqual(await helioscopeSettings(area), DEFAULT_SETTINGS);
  await setHelioscopeSettings(area, { ...DEFAULT_SETTINGS, elevation: 5 });
  assert.deepEqual(Object.fromEntries(localStorage.items), {
    ...others,
    "astrochart-bridge:helioscope-settings": '{"elevation":5,"orbs":{"cazimi":17,"combust":510,"underTheBeams":900}}',
  });
});

test("on the web, the parans page's settings are kept in localStorage beside Helioscope's, and forgotten at the defaults", async () => {
  const localStorage = memoryStorage({ "astrochart-bridge:helioscope-settings": '{"elevation":120}' });
  const area = webStorageArea({ localStorage });
  assert.deepEqual(await paransSettings(area), PARANS_DEFAULTS);
  const chosen = { orb: 0.5, bodies: ["sun", "venus", "eris"], horizon: "almanac", elevation: 120 };
  await setParansSettings(area, chosen);
  assert.equal(localStorage.items.get("astrochart-bridge:parans-settings"), JSON.stringify(chosen));
  assert.deepEqual(await paransSettings(area), chosen);
  await setParansSettings(area, PARANS_DEFAULTS);
  // Helioscope's are left as they were.
  assert.deepEqual(Object.fromEntries(localStorage.items), { "astrochart-bridge:helioscope-settings": '{"elevation":120}' });
});

test("on the web, the declinations page's orb is kept in localStorage beside the parans page's settings, and forgotten at the default", async () => {
  const localStorage = memoryStorage({ "astrochart-bridge:parans-settings": '{"orb":0.5}' });
  const area = webStorageArea({ localStorage });
  assert.deepEqual(await declinationsSettings(area), { orb: 1 });
  await setDeclinationsSettings(area, { orb: 1.5 });
  assert.equal(localStorage.items.get("astrochart-bridge:declinations-settings"), '{"orb":1.5}');
  assert.deepEqual(await declinationsSettings(area), { orb: 1.5 });
  await setDeclinationsSettings(area, { orb: 1 });
  assert.deepEqual(Object.fromEntries(localStorage.items), { "astrochart-bridge:parans-settings": '{"orb":0.5}' });
});

test("a browser that won't let the page use localStorage leaves it nowhere to keep anything", () => {
  const blocked = {
    get localStorage() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  };
  assert.equal(webStorageArea(blocked), null);
  assert.equal(webStorageArea({ localStorage: null }), null);
  assert.equal(webStorageArea({}), null);
});

test("a write the browser refuses rejects, as a refused chrome.storage write does", async () => {
  const full = {
    ...memoryStorage(),
    setItem() {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    },
  };
  const area = webStorageArea({ localStorage: full });
  await assert.rejects(setHelioscopeSettings(area, CHOSEN), { name: "QuotaExceededError" });
});
