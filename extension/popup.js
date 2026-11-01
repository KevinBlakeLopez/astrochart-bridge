// The only file that talks to the browser for the popup. Every decision about
// what to show is made in popup-model.js and drawn by view.js; this file reads
// the tab, renders the view and opens the sky.
import { classifyUrl } from "./core/astroseek.js";
import { analyzePage } from "./core/index.js";
import { viewFor } from "./popup-model.js";
import { render } from "./view.js";

const app = document.getElementById("app");

main().catch((error) => {
  const view = { state: "refused", message: "Chart Bridge couldn't read this tab.", code: String(error?.message ?? error) };
  show(view, { offerScreenshot: true });
});

async function main() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";

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

function show(view, { offerScreenshot = false } = {}) {
  render(app, view, openSky);
  if (offerScreenshot) app.append(screenshotButton());
}

async function openSky(url) {
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
