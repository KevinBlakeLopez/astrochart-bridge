// The declinations page: the parallels and contra-parallels of a chart's
// dwarf planets with its angles and planets. The chart arrives in the page's
// link, as on the parans page. Every decision is made in
// declinations-model.js; this script starts Swiss Ephemeris with the dwarf
// planets' files, keeps the orb, and draws with declinations-view.js.
// Nothing is sent anywhere.
import { createEngine } from "./helioscope-engine.js";
import { localizePage } from "./messages/index.js";
import {
  DEFAULT_SETTINGS,
  EPHEMERIS_FILES,
  chartFromLink,
  declinationsFor,
  declinationsSettings,
  orbLabel,
  setDeclinationsSettings,
  viewForDeclinations,
  viewForFailure,
  viewForRefusal,
} from "./declinations-model.js";
import { drawScreen } from "./declinations-view.js";
import { keepForOffline } from "./web-app.js";
import { showHomeLink } from "./web-page.js";
import { webStorageArea } from "./web-storage.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

// The way back to the home page, on the web.
showHomeLink(document, location.href);
keepForOffline(location.href);

const app = document.getElementById("app");
const orbBoxes = [...document.querySelectorAll('input[name="orb"]')];

// Each orb in the language's numbers.
for (const box of orbBoxes) box.parentElement.querySelector(".orb").textContent = orbLabel(Number(box.value));

// The orb, kept on this computer as the parans page keeps its settings: in
// the extension's storage, or, on the web, in the site's localStorage. When
// the browser won't let the page use it, the page starts from the default.
const remembered = globalThis.chrome?.storage?.local ?? webStorageArea(globalThis);
let settings = remembered ? await declinationsSettings(remembered).catch(() => DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
for (const box of orbBoxes) box.checked = Number(box.value) === settings.orb;

// The dwarf planets' files, from this copy's own vendor/swisseph/ephe/.
// Without them every contact takes a dwarf planet, so the page says it
// couldn't work them out.
async function ephemerisFiles() {
  const read = async (name) => {
    const response = await fetch(new URL(`vendor/swisseph/ephe/${name}`, import.meta.url));
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return [name, new Uint8Array(await response.arrayBuffer())];
  };
  return Object.fromEntries(await Promise.all(EPHEMERIS_FILES.map(read)));
}
const files = await ephemerisFiles().catch((error) => {
  console.warn("AstroChart Bridge: couldn't load the dwarf planets' files:", error?.message ?? error);
  return {};
});

// One engine for the page, kept while the tab is open. null when it couldn't start.
const engine = await createEngine({ ephemerisFiles: files }).catch(() => null);

function show() {
  if (engine === null) {
    drawScreen(app, viewForRefusal("engine-failed"));
    return;
  }
  const link = chartFromLink(location.hash);
  if (link === null || link.kind === "refused") {
    drawScreen(app, viewForRefusal(link?.reason ?? null));
    return;
  }
  const worked = declinationsFor(link.chart, engine, settings);
  if (worked.kind === "refused") drawScreen(app, viewForRefusal(worked.reason));
  else if (worked.kind === "failed") drawScreen(app, viewForFailure(worked));
  else drawScreen(app, viewForDeclinations(link.chart, worked, settings));
}

for (const box of orbBoxes) {
  box.addEventListener("change", () => {
    if (!box.checked) return;
    settings = { ...settings, orb: Number(box.value) };
    show();
    if (remembered) setDeclinationsSettings(remembered, settings).catch(() => {});
  });
}

show();
// A link pasted into this tab's address bar changes only the fragment, which
// doesn't reload the page.
window.addEventListener("hashchange", show);
