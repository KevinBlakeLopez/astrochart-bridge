// The only file that talks to the browser for the popup. Every decision about
// what to show is made in popup-model.js and drawn by view.js; this file reads
// the tab, renders the view and opens what its button links to.
import { fillForm, formValues, isAstroComPage, isBirthDataForm, readFormPage } from "./core/astrocom.js";
import { analyzePage, classifyUrl, extractorFor } from "./core/index.js";
import { isStellariumWeb, skyFromEngine } from "./core/stellarium.js";
import { linkFor } from "./chart-model.js";
import { heldForTab, holdForTab, releaseTab } from "./pending.js";
import { chartToShare, viewFor, viewForAstroComTab, viewForShareRefusal, viewForSky } from "./popup-model.js";
import { render } from "./view.js";

const app = document.getElementById("app");

// Where the values for an astro.com tab are kept. The browser empties it when it quits.
const held = chrome.storage.session;

main().catch((error) => {
  const view = { state: "refused", message: "Chart Bridge couldn't read this tab.", code: String(error?.message ?? error) };
  show(view, { offerScreenshot: true });
});

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

  // On Stellarium Web, the sky comes from its engine: the address doesn't change
  // when the time or place does.
  if (isStellariumWeb(url)) {
    const [{ result: engine }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: readEngine,
    });
    show(engine ? viewForSky(skyFromEngine(engine)) : viewFor({ kind: "refused", reason: "stellarium-unreadable" }));
    return;
  }

  // Pages Chart Bridge doesn't handle are refused before any script runs on them.
  // A page on a site Chart Bridge doesn't read may still have a chart on screen,
  // in an image or a PDF; a screenshot of a transit or compatibility page wouldn't help.
  const page = classifyUrl(url);

  // An astro.com page that isn't a chart Chart Bridge reads may be a tab opened
  // for a chart's values: the form, or a sign-in page on the way to it. A
  // chart page, even with values kept, opens its own sky as before.
  if (page.kind === "refused" && isAstroComPage(url)) {
    const sky = await heldForTab(held, tab.id);
    if (sky) {
      await showAstroComTab(tab, url, sky);
      return;
    }
  }

  if (page.kind === "refused") {
    show(viewFor(page), { offerScreenshot: page.reason === "unsupported" });
    return;
  }

  // Each site's extractor reads only what that site's reader needs.
  const [{ result: input }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractorFor(url),
  });
  showChart(analyzePage({ url, input }));
}

// A chart page's screen. Share… opens the extension's copy of the receiving
// page in a tab, with the chart in its link, for the sky the screen decided;
// the other buttons open their links as before. A chart the format can't
// carry says why, and Cancel goes back to it.
function showChart(result) {
  const view = viewFor(result);
  const onButton = async (button, sky) => {
    if (button.does !== "share") return openLink(button, sky);
    const shared = chartToShare(result, sky, "page");
    if (shared.kind === "refused") {
      render(app, viewForShareRefusal(shared.reason), onButton, view);
      return;
    }
    await chrome.tabs.create({ url: linkFor(chrome.runtime.getURL("chart.html"), shared.chart) });
    window.close();
  };
  show(view, { onButton });
}

// Runs inside the Stellarium Web page itself (world "MAIN"), where its engine
// lives. Firefox runs scripts there from version 128, the manifest's
// strict_min_version. The browser copies this function into the page, so it
// can't use anything else from this file. The path to the engine was read from
// frontend 1.16.0.
function readEngine() {
  const core = document.querySelector("#app")?.__vue_app__?.config?.globalProperties?.$stel?.core;
  const engine = core && { utcMjd: core.utc, latitudeRad: core.latitude, longitudeRad: core.longitude };
  return engine && Object.values(engine).every(Number.isFinite) ? engine : null;
}

// The popup was opened on this tab, so activeTab lets it read and fill in the
// form here, and only here.
async function showAstroComTab(tab, url, sky) {
  let page = { kind: "other" };
  if (isBirthDataForm(url)) {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readFormPage });
    page = { kind: "form", ...(result ?? { auth: "unknown", form: "unrecognised" }) };
  }
  show(viewForAstroComTab(sky, page), { onButton: astroComTabButtons(tab, sky) });
}

// What the astro.com tab's buttons do. The values are forgotten once filled
// in or cancelled; a form that changed since it was read is shown again as it now is.
function astroComTabButtons(tab, sky) {
  return async (button) => {
    if (button.does === "fill") {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillForm,
        args: [formValues(sky)],
      });
      if (!result?.filled) {
        const form = result?.form ?? "unrecognised";
        show(viewForAstroComTab(sky, { kind: "form", auth: "unknown", form }), { onButton: astroComTabButtons(tab, sky) });
        return;
      }
    }
    if (button.does === "fill" || button.does === "release") await releaseTab(held, tab.id);
    if (button.here) await chrome.tabs.update(tab.id, { url: button.url });
    window.close();
  };
}

// A page Chart Bridge doesn't read can still lead to a chart: a screenshot of
// one, or a .astrochart.json file, each opened in a tab of its own.
function show(view, { offerScreenshot = false, onButton = openLink } = {}) {
  render(app, view, onButton);
  if (offerScreenshot) app.append(screenshotButton(), chartFileButton());
}

async function openLink({ url, holds }, sky) {
  if (!holds) {
    await chrome.tabs.create({ url });
    window.close();
    return;
  }
  // Opened behind the popup, which closes when the new tab comes to the front,
  // so the values are kept for the tab before it does.
  const tab = await chrome.tabs.create({ url, active: false });
  await holdForTab(held, tab.id, sky);
  await chrome.tabs.update(tab.id, { active: true });
  window.close();
}

function screenshotButton() {
  return pageButton("Read a screenshot instead", "screenshot.html");
}

// The receiving page, with no link, opens files. The file chooser isn't opened
// from the popup itself, which can close when the chooser takes the focus.
function chartFileButton() {
  return pageButton("Open a chart file", "chart.html");
}

function pageButton(label, page) {
  const button = document.createElement("button");
  button.className = "secondary";
  button.textContent = label;
  button.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL(page) });
    window.close();
  });
  return button;
}
