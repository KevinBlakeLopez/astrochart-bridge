// Helioscope's page: which planets could be seen with the naked eye in the
// twilight around a chart's moment. The chart arrives in the page's link, as
// on the receiving page. Every decision is made in helioscope-model.js; this
// script starts Swiss Ephemeris, keeps the settings and draws with
// helioscope-view.js.
import { createEngine } from "./helioscope-engine.js";
import {
  DEFAULT_SETTINGS,
  chartFromLink,
  helioscopeSettings,
  readElevation,
  setHelioscopeSettings,
  viewForRefusal,
  viewForVisibility,
  visibilities,
} from "./helioscope-model.js";
import { drawScreen } from "./helioscope-view.js";
import { localizePage } from "./messages/index.js";

// The browser's language, chosen before anything is drawn.
localizePage(document, navigator.languages);

const app = document.getElementById("app");
const elevationBox = document.getElementById("elevation");
const elevationRefused = document.getElementById("elevation-refused");
const limitBoxes = [...document.querySelectorAll('input[name="under-the-beams"]')];

// The settings, kept in the extension's storage on this computer. A copy of
// the page outside the extension has nowhere to keep them, so it starts from
// the defaults each time.
const remembered = globalThis.chrome?.storage?.local ?? null;
let settings = remembered ? await helioscopeSettings(remembered).catch(() => DEFAULT_SETTINGS) : DEFAULT_SETTINGS;
elevationBox.value = settings.elevation === null ? "" : String(settings.elevation);
for (const box of limitBoxes) box.checked = Number(box.value) === settings.underTheBeams;

// One engine for the page, with Swiss Ephemeris's default atmosphere and
// observer, kept while the tab is open. null when it couldn't start.
const engine = await createEngine().catch(() => null);

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
  const worked = visibilities(link.chart, engine, settings);
  drawScreen(app, worked.kind === "refused" ? viewForRefusal(worked.reason) : viewForVisibility(link.chart, worked.results));
}

// A setting changed: the planets are worked out again, and the choice kept.
function choose(next) {
  settings = next;
  show();
  if (remembered) setHelioscopeSettings(remembered, settings).catch(() => {});
}

// An elevation that doesn't fit is said under the box, and the planets keep
// the last one that did.
elevationBox.addEventListener("change", () => {
  const typed = readElevation(elevationBox.value);
  const refused = typed.kind === "refused";
  elevationRefused.textContent = refused ? typed.message : "";
  elevationRefused.hidden = !refused;
  elevationBox.setAttribute("aria-invalid", String(refused));
  if (!refused) choose({ ...settings, elevation: typed.metres });
});

for (const box of limitBoxes) {
  box.addEventListener("change", () => {
    if (box.checked) choose({ ...settings, underTheBeams: Number(box.value) });
  });
}

show();
// A link pasted into this tab's address bar changes only the fragment, which
// doesn't reload the page.
window.addEventListener("hashchange", show);
