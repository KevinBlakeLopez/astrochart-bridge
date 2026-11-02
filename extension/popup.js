// The only file that talks to the browser for the popup. Every decision about
// what to show is made in popup-model.js and drawn by view.js; this file reads
// the tab, renders the view and opens what its button links to.
import { withAafExport } from "./aaf-model.js";
import { linkFor } from "./chart-model.js";
import { ASTRO_COM_ACCESS, chooseFilledTown, openAndFill, watchFilledZone } from "./astro-com-open.js";
import { ASTRO_SEEK_ACCESS, openAndSave } from "./astro-seek-open.js";
import { fillForm, formValues, isAstroComPage, isBirthDataForm, readFormPage } from "./core/astrocom.js";
import { townFromUrl } from "./core/astroseek.js";
import { analyzePage, classifyUrl, extractorFor } from "./core/index.js";
import { isStellariumWeb, readEngine, skyFromEngine, townFromPlace } from "./core/stellarium.js";
import { BUSY, viewForDesktopImport } from "./desktop-model.js";
import { checkDesktop, renderChart } from "./desktop-page.js";
import { heldForTab, holdForTab, releaseTab } from "./pending.js";
import {
  ASTRO_COM_BUSY,
  ASTRO_SEEK_SAVE_BUSY,
  OTHER_WAYS,
  chartToShare,
  offersOtherWays,
  viewFor,
  viewForAstroComManual,
  viewForAstroComNotFilled,
  viewForAstroComTab,
  viewForAstroSeekSave,
  viewForShareRefusal,
  viewForSky,
  withOtherWays,
} from "./popup-model.js";
import { HOST_PERMISSION, readSky } from "./stellarium-desktop.js";
import { desktopHintLine, render, wayGroups } from "./view.js";

const app = document.getElementById("app");

// Where the values for an astro.com tab are kept. The browser empties it when it quits.
const held = chrome.storage.session;

// The chart page's analyzePage result, for Share…. A Stellarium tab's screen
// has no Share…: it has no birthplace time.
let sharing = null;

main().catch((error) => {
  const view = { state: "refused", message: "AstroChart Bridge couldn't read this tab.", code: String(error?.message ?? error) };
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
    if (!engine) {
      show(viewFor({ kind: "refused", reason: "stellarium-unreadable" }));
      return;
    }
    // Stellarium Web names the place it shows, which astro.com's and
    // Astro-Seek's forms can take as the town.
    const sky = skyFromEngine(engine);
    showChart(withAafExport(viewForSky(sky, { town: townFromPlace(engine.place, sky) }), sky));
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
      await watchFilledZone(chrome.scripting, tab.id, sky);
      await chooseFilledTown(chrome.scripting, tab.id, sky);
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

// Save in Astro-Seek…: asks for access to www.astro-seek.com first, while the
// click still counts as the user's, then opens Astro-Seek's Add person form
// behind the popup and chooses its town. Filled in, the form's tab comes to
// the front for the person to finish; otherwise the popup says why, with a
// way to the tab. Declined, it offers the form filled in by its address alone.
async function saveInAstroSeek(sky, saves) {
  const granted = await chrome.permissions.request(ASTRO_SEEK_ACCESS).catch(() => false);
  if (!granted) {
    show(viewForAstroSeekSave({ outcome: "declined" }, sky, saves));
    return;
  }
  show(ASTRO_SEEK_SAVE_BUSY);
  const result = await openAndSave({ tabs: chrome.tabs, scripting: chrome.scripting }, { values: { ...sky, ...saves } });
  const tab = { id: result.tabId };
  if (result.outcome === "filled") {
    await showTab(tab);
    return;
  }
  show(viewForAstroSeekSave(result, sky, saves), { onButton: (button) => (button.does === "show-tab" ? showTab(tab) : openLink(button)) });
}

// A page AstroChart Bridge doesn't read can still lead to a chart: a screenshot,
// pasted text, an AAF or Morinus file, a .astrochart.json file, or Stellarium
// Desktop, in popup-model.js's OTHER_WAYS groups.
function show(view, { offerScreenshot = false, onButton = openLink } = {}) {
  render(app, view, onButton);
  if (offerScreenshot) app.append(...otherWays());
  checkDesktop(app.querySelector(".desktop-hint")).catch(() => {});
}

// Each OTHER_WAYS group under its label. Import from Stellarium Desktop is
// the last button, so the line about Stellarium goes right under it, as under
// Send to Stellarium Desktop.
function otherWays() {
  return [...wayGroups(OTHER_WAYS, otherWay), desktopHintLine()];
}

// An OTHER_WAYS button: one of the extension's pages in a tab, or Import from
// Stellarium Desktop, called straight from the click as it needs.
function otherWay({ page }) {
  return page ? openPage(page) : importFromDesktop();
}

// A chart screen, with Send to Stellarium Desktop from desktop-page.js and
// Read a different chart from withOtherWays. The sent screen's Done closes the popup.
function showChart(base) {
  renderChart(app, withOtherWays(base), chartButtons, { onDone: () => window.close() }).catch((error) => {
    show({ state: "refused", message: "AstroChart Bridge couldn't show this chart.", code: String(error?.message ?? error) });
  });
}

// What a chart screen's own buttons do: open a link, Share…, whose refusal
// goes back to the screen on Cancel, or one of Read a different chart's other
// ways. desktop-page.js takes the desktop ones.
function chartButtons(button, sky, screen) {
  if (button.does === "share") return share(sky, screen.view, screen.onButton);
  if (button.page || button.does === "import-from-desktop") return otherWay(button);
  return openLink(button, sky);
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

// Import from Stellarium Desktop. Access to 127.0.0.1 is asked for first,
// while the click still counts as the user's, as desktop-page.js does for
// Send to Stellarium Desktop.
async function importFromDesktop() {
  if (!(await chrome.permissions.request(HOST_PERMISSION))) {
    showImport(viewForDesktopImport({ state: "no-permission" }));
    return;
  }
  showImport(BUSY.import);
  showImport(viewForDesktopImport(await readSky()));
}

// A problem screen's Try again imports again; the imported sky's buttons are links.
function showImport(view) {
  render(app, view, (button, sky) => {
    if (button.does === "import-from-desktop") return importFromDesktop();
    return openLink(button, sky);
  });
}

// holds is what an astro.com button keeps for the tab it opens; saves is
// Save in Astro-Seek…'s town and name, for the sky the screen decided.
async function openLink({ url, holds, fills, saves }, sky) {
  if (saves) return saveInAstroSeek(sky, saves);
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

// Opens one of the extension's own pages in a new tab.
async function openPage(page) {
  await chrome.tabs.create({ url: chrome.runtime.getURL(page) });
  window.close();
}
