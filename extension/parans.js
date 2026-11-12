// The parans page: which of a chart's bodies were on the angles together in
// the 24 hours around its moment. The chart arrives in the page's link, as on
// the receiving page. Every decision is made in parans-model.js; this script
// starts Swiss Ephemeris, keeps the settings, and draws with parans-view.js.
// Nothing is sent anywhere.
import { createEngine } from "./helioscope-engine.js";
import { localizePage } from "./messages/index.js";
import {
  DEFAULT_SETTINGS,
  EPHEMERIS_FILES,
  chartFromLink,
  lockedBodies,
  orbLabel,
  paransFor,
  paransSettings,
  readElevation,
  setParansSettings,
  viewForFailure,
  viewForParans,
  viewForRefusal,
} from "./parans-model.js";
import { drawScreen } from "./parans-view.js";
import { keepForOffline } from "./web-app.js";
import { showHomeLink } from "./web-page.js";
import { webStorageArea } from "./web-storage.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

// The way back to the home page, on the web.
showHomeLink(document, location.href);
keepForOffline(location.href);

const app = document.getElementById("app");
const elevationBox = document.getElementById("elevation");
const elevationRefused = document.getElementById("elevation-refused");
const orbBoxes = [...document.querySelectorAll('input[name="orb"]')];
const horizonBoxes = [...document.querySelectorAll('input[name="horizon"]')];
const bodyBoxes = [...document.querySelectorAll('input[name="body"]')];

// Each orb in the language's numbers.
for (const box of orbBoxes) box.parentElement.querySelector(".orb").textContent = orbLabel(Number(box.value));

// The settings, kept on this computer: in the extension's storage, or, for
// the copy of the page on the web, in the site's localStorage, as Helioscope's
// page keeps its own. When the browser won't let the page use it, there's
// nowhere to keep them, and the page starts from the defaults each time.
const remembered = globalThis.chrome?.storage?.local ?? webStorageArea(globalThis);
let settings = remembered ? await paransSettings(remembered).catch(() => DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
elevationBox.value = settings.elevation === null ? "" : String(settings.elevation);
for (const box of orbBoxes) box.checked = Number(box.value) === settings.orb;
for (const box of horizonBoxes) box.checked = box.value === settings.horizon;
showBodies();

// The dwarf planets' files, from this copy's own vendor/swisseph/ephe/.
// Without them the engine still works out the Sun, the Moon and the planets,
// and a dwarf planet ticked says it couldn't be worked out.
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
  const worked = paransFor(link.chart, engine, settings);
  if (worked.kind === "refused") drawScreen(app, viewForRefusal(worked.reason));
  else if (worked.kind === "failed") drawScreen(app, viewForFailure(worked));
  else drawScreen(app, viewForParans(link.chart, worked, settings));
}

// The bodies' boxes as the settings have them, the last two locked.
function showBodies() {
  const locked = lockedBodies(settings.bodies);
  for (const box of bodyBoxes) {
    box.checked = settings.bodies.includes(box.value);
    box.disabled = locked.includes(box.value);
  }
}

// A setting changed: the parans are worked out again, and the choice kept.
function choose(next) {
  settings = next;
  showBodies();
  show();
  if (remembered) setParansSettings(remembered, settings).catch(() => {});
}

// An elevation that doesn't fit is said under the boxes, and the parans keep
// the last one that did.
elevationBox.addEventListener("change", () => {
  const typed = readElevation(elevationBox.value);
  const refused = typed.kind === "refused";
  elevationRefused.textContent = refused ? typed.message : "";
  elevationRefused.hidden = !refused;
  elevationBox.setAttribute("aria-invalid", String(refused));
  if (!refused) choose({ ...settings, elevation: typed.metres });
});

for (const box of orbBoxes) {
  box.addEventListener("change", () => {
    if (box.checked) choose({ ...settings, orb: Number(box.value) });
  });
}

for (const box of horizonBoxes) {
  box.addEventListener("change", () => {
    if (box.checked) choose({ ...settings, horizon: box.value });
  });
}

for (const box of bodyBoxes) {
  box.addEventListener("change", () => {
    choose({ ...settings, bodies: bodyBoxes.filter((each) => each.checked).map((each) => each.value) });
  });
}

show();
// A link pasted into this tab's address bar changes only the fragment, which
// doesn't reload the page.
window.addEventListener("hashchange", show);
