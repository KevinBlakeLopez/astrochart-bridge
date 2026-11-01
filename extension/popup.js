// The only file that talks to the browser for the popup. Every decision about
// what to show is made in popup-model.js and drawn by view.js; this file reads
// the tab, renders the view and opens what its button links to.
import { classifyUrl } from "./core/astroseek.js";
import { analyzePage } from "./core/index.js";
import { isStellariumWeb, skyFromEngine } from "./core/stellarium.js";
import { viewFor, viewForSky } from "./popup-model.js";
import { render } from "./view.js";

const app = document.getElementById("app");

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
  // Any page but Astro-Seek's may still have a chart on screen, in an image or a
  // PDF; a screenshot of a transit or compatibility page wouldn't help.
  const page = classifyUrl(url);
  if (page.kind === "refused") {
    show(viewFor(page), { offerScreenshot: page.reason === "unsupported" });
    return;
  }

  const [{ result: text }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText,
  });
  show(viewFor(analyzePage({ url, text: text ?? "" })));
}

// Runs inside the Stellarium Web page itself (world "MAIN"), where its engine
// lives. Chrome copies this function into the page, so it can't use anything
// else from this file. The path to the engine was read from frontend 1.16.0.
function readEngine() {
  const core = document.querySelector("#app")?.__vue_app__?.config?.globalProperties?.$stel?.core;
  const engine = core && { utcMjd: core.utc, latitudeRad: core.latitude, longitudeRad: core.longitude };
  return engine && Object.values(engine).every(Number.isFinite) ? engine : null;
}

function show(view, { offerScreenshot = false } = {}) {
  render(app, view, openLink);
  if (offerScreenshot) app.append(screenshotButton());
}

async function openLink(url) {
  await chrome.tabs.create({ url });
  window.close();
}

function screenshotButton() {
  const button = document.createElement("button");
  button.className = "secondary";
  button.textContent = "Read a screenshot instead";
  button.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("screenshot.html") });
    window.close();
  });
  return button;
}
