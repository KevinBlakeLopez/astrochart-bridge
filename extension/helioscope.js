// Helioscope's page: which planets could be seen with the naked eye in the
// twilight around a chart's moment. The chart arrives in the page's link, as
// on the receiving page. Every decision is made in helioscope-model.js; this
// script starts Swiss Ephemeris, keeps the settings, asks Open-Meteo for
// that night's weather when the user clicks for it, and draws with
// helioscope-view.js.
import { createEngine } from "./helioscope-engine.js";
import {
  DEFAULT_SETTINGS,
  chartFromLink,
  helioscopeSettings,
  nightWeather,
  readElevation,
  setHelioscopeSettings,
  viewForRefusal,
  viewForVisibility,
  visibilities,
  visibilitiesWithAir,
  weatherOffer,
  weatherRequestFor,
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

// Firefox asks before an extension sends location data anywhere, through its
// built-in consent for data collection, and only from a click. Its
// permissions list that consent; other browsers have none, and the click is
// the consent.
const permissions = globalThis.chrome?.permissions ?? null;
const asksFirst = permissions?.getAll
  ? await permissions.getAll().then((granted) => Object.hasOwn(granted, "data_collection"), () => false)
  : false;

// Check that night's weather, for the chart on screen: where it stands, and
// the engines with that night's air once the weather is in. Nothing of it is
// kept: a new chart, or a reload, starts again from the offer.
let check = null;

// The UTC date: the archive answers up to it.
const today = () => new Date().toISOString().slice(0, 10);

function show() {
  if (engine === null) {
    drawScreen(app, viewForRefusal("engine-failed"));
    return;
  }
  const link = chartFromLink(location.hash);
  if (link === null || link.kind === "refused") {
    forget();
    drawScreen(app, viewForRefusal(link?.reason ?? null));
    return;
  }
  const worked = visibilities(link.chart, engine, settings);
  if (worked.kind === "refused") {
    forget();
    drawScreen(app, viewForRefusal(worked.reason));
    return;
  }
  if (check?.hash !== location.hash) {
    forget();
    check = { hash: location.hash, state: weatherOffer(link.chart, worked.results, today()), engines: null };
  }
  const withAir = check.engines ? visibilitiesWithAir(link.chart, check.engines, settings) : null;
  const results = withAir?.kind === "results" ? withAir.results : worked.results;
  const asked = check;
  drawScreen(app, viewForVisibility(link.chart, results, check.state), () => askWeather(asked, link.chart, worked.results));
}

// The click on Check that night's weather. Firefox's consent is asked in the
// click itself, before anything is sent. Then Open-Meteo is asked, its answer
// read and, once the weather is in, an engine made with each twilight's air.
function askWeather(asked, chart, results) {
  const request = weatherRequestFor(chart, results, today());
  if (request.kind === "refused") {
    settle(asked, request);
    return;
  }
  const consent = asksFirst ? permissions.request({ data_collection: ["locationInfo"] }) : Promise.resolve(true);
  asked.state = { kind: "asking" };
  show();
  consent
    .then(
      async (allowed) => {
        if (!allowed) return { kind: "refused", reason: "declined" };
        const answer = await fetchWeather(request.url);
        if (answer.kind === "failed") return answer;
        const weather = nightWeather(answer.json, request.hours, today());
        if (weather.kind === "weather") asked.engines = await nightEngines(weather);
        return weather;
      },
      () => ({ kind: "failed", reason: "consent-failed" }),
    )
    .catch(() => ({ kind: "failed", reason: "engine-failed" }))
    .then((state) => settle(asked, state));
}

// Where a check ended up, shown if its chart is still the one on screen.
function settle(asked, state) {
  if (asked !== check) {
    dispose(asked.engines);
    return;
  }
  asked.state = state;
  show();
}

// Open-Meteo's answer, asked for with no cookies and no referrer, and given
// 20 seconds.
async function fetchWeather(url) {
  try {
    const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return { kind: "failed", reason: `http-${response.status}` };
    return { kind: "answer", json: await response.json().catch(() => null) };
  } catch (error) {
    return { kind: "failed", reason: error?.name === "TimeoutError" ? "timeout" : "network" };
  }
}

// An engine for each twilight with a reading. A twilight without one has no
// window, and shares the other's. If the second can't start, the first goes too.
async function nightEngines({ evening, morning }) {
  const dusk = evening ? await createEngine({ atmosphere: evening.air }) : null;
  try {
    const dawn = morning ? await createEngine({ atmosphere: morning.air }) : null;
    return { evening: dusk ?? dawn, morning: dawn ?? dusk };
  } catch (error) {
    dusk?.dispose();
    throw error;
  }
}

function dispose(engines) {
  if (engines) for (const night of new Set(Object.values(engines))) night.dispose();
}

// The chart on screen changed: its check, and its engines, go.
function forget() {
  dispose(check?.engines);
  check = null;
}

// A setting changed: the planets are worked out again, with that night's air
// if the weather is in, and the choice kept.
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
