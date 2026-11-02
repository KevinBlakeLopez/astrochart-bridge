// The only file that talks to the browser for the popup. Every decision about
// what to show is made in popup-model.js and drawn by view.js; this file reads
// the tab, renders the view and opens what its button links to.
import { withAafExport } from "./aaf-model.js";
import { linkFor } from "./chart-model.js";
import { ASTRO_COM_ACCESS, openAndFill } from "./astro-com-open.js";
import { fillForm, formValues, isAstroComPage, isBirthDataForm, readFormPage } from "./core/astrocom.js";
import { townFromUrl } from "./core/astroseek.js";
import { analyzePage, classifyUrl, extractorFor } from "./core/index.js";
import { isStellariumWeb, skyFromEngine } from "./core/stellarium.js";
import { BUSY, desktopHint, viewForDesktopImport, viewForDesktopSend, withDesktopSend } from "./desktop-model.js";
import { heldForTab, holdForTab, releaseTab } from "./pending.js";
import {
  ASTRO_COM_BUSY,
  chartToShare,
  offersOtherWays,
  viewFor,
  viewForAstroComManual,
  viewForAstroComNotFilled,
  viewForAstroComTab,
  viewForShareRefusal,
  viewForSky,
} from "./popup-model.js";
import { desktopPreferred, setDesktopPreferred } from "./preference.js";
import { HOST_PERMISSION, probe, readSky, sendSky } from "./stellarium-desktop.js";
import { desktopHintLine, render } from "./view.js";

const app = document.getElementById("app");

// Where the values for an astro.com tab are kept. The browser empties it when it quits.
const held = chrome.storage.session;

// Where the user's default between Stellarium Web and Stellarium Desktop is
// kept: on this computer, until they change it.
const prefs = chrome.storage.local;

// Whether Stellarium Desktop is that default, read as the popup opens and
// changed only by the user's click.
let preferred = false;

// The chart page's analyzePage result, for Share…. A Stellarium tab's screen
// has no Share…: it has no birthplace time.
let sharing = null;

main().catch((error) => {
  const view = { state: "refused", message: "AstroChart Bridge couldn't read this tab.", code: String(error?.message ?? error) };
  show(view, { offerScreenshot: true });
});

async function main() {
  // A preference that can't be read leaves Stellarium Web the default.
  const [[tab], desktop] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    desktopPreferred(prefs).catch(() => false),
  ]);
  preferred = desktop;
  const url = tab?.url ?? "";

  // On Stellarium Web, the sky comes from its engine: the address doesn't change
  // when the time or place does.
  if (isStellariumWeb(url)) {
    const [{ result: engine }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: readEngine,
    });
    if (!engine) {
      show(viewFor({ kind: "refused", reason: "stellarium-unreadable" }));
      return;
    }
    const sky = skyFromEngine(engine);
    showChart(withAafExport(viewForSky(sky), sky));
    return;
  }

  // Pages AstroChart Bridge doesn't handle are refused before any script runs on them.
  // A page it doesn't read may still have a chart on screen, in an image or a PDF.
  const page = classifyUrl(url);

  // An astro.com page that isn't a chart AstroChart Bridge reads may be a tab opened
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
    show(viewFor(page), { offerScreenshot: offersOtherWays(page) });
    return;
  }

  // Each site's extractor reads only what that site's reader needs.
  const [{ result: input }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractorFor(url),
  });
  const result = analyzePage({ url, input });
  if (result.kind === "refused") {
    show(viewFor(result), { offerScreenshot: offersOtherWays(result) });
    return;
  }
  // Share… needs the result the screen was drawn from: its local time, and
  // how its UTC was decided.
  sharing = result;
  // An Astro-Seek chart's address names its town, which astro.com's form can take.
  showChart(withAafExport(viewFor(result, { town: townFromUrl(url) }), result));
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
// in or cancelled; a form that changed since it was read is shown again as it
// now is. The tab may be behind the popup, opened by openForm, so every button
// brings it to the front: the popup closes as it does.
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
    await chrome.tabs.update(tab.id, button.here ? { url: button.url, active: true } : { active: true });
    window.close();
  };
}

// The form button: asks for access to www.astro.com first, while the click
// still counts as the user's, then opens the form behind the popup and fills
// it in. Declined, it shows the two-click way instead.
async function openForm(url, values) {
  const granted = await chrome.permissions.request(ASTRO_COM_ACCESS).catch(() => false);
  if (!granted) {
    show(viewForAstroComManual(values));
    return;
  }
  show(ASTRO_COM_BUSY);
  const result = await openAndFill({ tabs: chrome.tabs, scripting: chrome.scripting, storage: held }, { url, values });
  const tab = { id: result.tabId };
  if (result.outcome === "choose") {
    show(viewForAstroComTab(values, result.page), { onButton: astroComTabButtons(tab, values) });
    return;
  }
  if (result.outcome === "not-filled") {
    show(viewForAstroComNotFilled(values), { onButton: () => showTab(tab) });
    return;
  }
  await showTab(tab);
}

async function showTab(tab) {
  await chrome.tabs.update(tab.id, { active: true });
  window.close();
}

// A page AstroChart Bridge doesn't read can still lead to a chart: a screenshot,
// pasted text, an AAF or Morinus file, a .astrochart.json file, or Stellarium Desktop.
function show(view, { offerScreenshot = false, onButton = openLink } = {}) {
  render(app, view, onButton);
  if (offerScreenshot) {
    const fromDesktop = document.createElement("button");
    fromDesktop.className = "secondary";
    fromDesktop.textContent = "Import from Stellarium Desktop";
    fromDesktop.addEventListener("click", importFromDesktop);
    app.append(
      pageButton("Read a screenshot instead", "screenshot.html"),
      pageButton("Paste chart text instead", "paste.html"),
      pageButton("Open an AAF or Morinus file", "import.html"),
      pageButton("Open a chart file", "chart.html"),
      fromDesktop,
      desktopHintLine(),
    );
  }
  checkDesktop(app.querySelector(".desktop-hint")).catch(() => {});
}

// Once AstroChart Bridge has access to 127.0.0.1, the popup checks Stellarium as
// it opens and says what it found under the desktop button. Without access it
// doesn't check: the request would fail like a closed Stellarium. The screen
// is drawn first and the line filled in when the answer comes, so nothing
// waits on it; a line whose screen has since been replaced is left alone.
async function checkDesktop(hint) {
  if (!hint || !(await chrome.permissions.contains(HOST_PERMISSION))) return;
  const text = desktopHint(await probe({ timeoutMs: 1000 }));
  if (hint.isConnected) hint.textContent = text;
}

// A chart screen, its desktop button placed by the user's default. changed
// says they have just switched it, so the screen confirms it with Undo.
function showChart(base, changed = false) {
  const view = withDesktopSend(base, { preferred, changed });
  show(view, { onButton: chartButtons(view, base) });
}

// What a chart screen's buttons do: open a link, send the sky to Stellarium
// Desktop (coming back to this screen on Cancel), or switch the default and
// draw this chart again with its buttons swapped.
function chartButtons(view, base) {
  const onButton = (button, sky) => {
    if (button.does === "send-to-desktop") return sendToDesktop(sky, view);
    if (button.does === "prefer-desktop" || button.does === "prefer-web") {
      return switchDefault(button.does === "prefer-desktop", () => showChart(base, true));
    }
    if (button.does === "share") return share(sky, view, onButton);
    return openLink(button, sky);
  };
  return onButton;
}

// Share… opens the extension's copy of the receiving page in a tab, with the
// chart in its link, for the sky the screen decided. A chart the format can't
// carry says why, and Cancel goes back to the chart.
async function share(sky, back, onButton) {
  const shared = chartToShare(sharing, sky, "page");
  if (shared.kind === "refused") {
    render(app, viewForShareRefusal(shared.reason), onButton, back);
    return;
  }
  await chrome.tabs.create({ url: linkFor(chrome.runtime.getURL("chart.html"), shared.chart) });
  window.close();
}

async function switchDefault(toDesktop, redraw) {
  await setDesktopPreferred(prefs, toDesktop);
  preferred = toDesktop;
  redraw();
}

// Stellarium Desktop is reached only from these two clicks. Each asks for
// access to 127.0.0.1 first, while the click still counts as the user's: the
// browser asks only the first time, and may refuse a request made after an
// await. Without access, a request would fail like a closed Stellarium.
async function sendToDesktop(sky, back) {
  if (!(await chrome.permissions.request(HOST_PERMISSION))) {
    showDesktop(viewForDesktopSend({ state: "no-permission" }, sky), back);
    return;
  }
  showDesktop(BUSY.send, null);
  showDesktop(viewForDesktopSend(await sendSky(sky), sky, { preferred }), back);
}

async function importFromDesktop() {
  if (!(await chrome.permissions.request(HOST_PERMISSION))) {
    showDesktop(viewForDesktopImport({ state: "no-permission" }), null);
    return;
  }
  showDesktop(BUSY.import, null);
  showDesktop(viewForDesktopImport(await readSky()), null);
}

// A problem screen gets Cancel back to the chart; the sent screen has Done instead.
function showDesktop(view, back) {
  render(app, view, desktopButtons(back), view.state === "desktop-problem" ? back : null);
}

function desktopButtons(back) {
  return (button, sky) => {
    if (button.does === "send-to-desktop") return sendToDesktop(sky, back);
    if (button.does === "import-from-desktop") return importFromDesktop();
    if (button.does === "close") return window.close();
    // Only the sent screen offers these, so it is what's drawn again.
    if (button.does === "prefer-desktop" || button.does === "prefer-web") {
      return switchDefault(button.does === "prefer-desktop", () =>
        showDesktop(viewForDesktopSend({ state: "sent" }, sky, { preferred, changed: true }), back),
      );
    }
    return openLink(button, sky);
  };
}

// holds is what an astro.com button keeps for the tab it opens.
async function openLink({ url, holds, fills }) {
  if (fills) return openForm(url, holds);
  if (!holds) {
    await chrome.tabs.create({ url });
    window.close();
    return;
  }
  // Opened behind the popup, which closes when the new tab comes to the front,
  // so the values are kept for the tab before it does.
  const tab = await chrome.tabs.create({ url, active: false });
  await holdForTab(held, tab.id, holds);
  await chrome.tabs.update(tab.id, { active: true });
  window.close();
}

// A button that opens one of the extension's own pages in a new tab.
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
