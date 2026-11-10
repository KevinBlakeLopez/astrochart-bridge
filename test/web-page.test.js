import { test } from "node:test";
import assert from "node:assert/strict";
import { astroSeekSaveUrl } from "../extension/core/astroseek.js";
import { linkFor, readLink } from "../extension/chart-model.js";
import { chartFromLink } from "../extension/helioscope-model.js";
import { chartForEntry } from "../extension/paste-model.js";
import { openLink, openPage, pageUrl, showHomeLink } from "../extension/web-page.js";

// Just enough of a page for view.js to draw into, as in view.test.js, and a
// window whose open is recorded.
globalThis.document = {
  createElement: (tag) => {
    const element = {
      tag, className: "", textContent: "", disabled: false, children: [], listeners: {},
      append: (...nodes) => element.children.push(...nodes),
      addEventListener: (type, listener) => (element.listeners[type] = listener),
      click: () => {},
    };
    return element;
  },
};
const opened = [];
globalThis.window = { open: (...args) => opened.push(args) };
const container = () => {
  const box = { replaceChildren: (...parts) => (box.parts = parts) };
  return box;
};
const buttons = (box) => box.parts.filter(({ tag }) => tag === "button");

const SKY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };

test("the web's receiving page and Helioscope's page are beside the page, wherever the site is served", () => {
  assert.equal(
    pageUrl("chart.html", "https://kevinblakelopez.github.io/astrochart-bridge/paste.html?x=1#y"),
    "https://kevinblakelopez.github.io/astrochart-bridge/chart.html",
  );
  assert.equal(pageUrl("chart.html", "http://127.0.0.1:8000/import.html"), "http://127.0.0.1:8000/chart.html");
  assert.equal(
    pageUrl("helioscope.html", "https://kevinblakelopez.github.io/astrochart-bridge/import.html"),
    "https://kevinblakelopez.github.io/astrochart-bridge/helioscope.html",
  );
});

test("Share… on the web opens the receiving page beside this one, with the chart in its link, in a new tab", () => {
  opened.length = 0;
  const { chart } = chartForEntry({ date: "2024-04-17", time: "08:00:00", lat: SKY.lat, lng: SKY.lng, offsetMinutes: -240 }, []);
  openPage("chart.html", chart, "https://kevinblakelopez.github.io/astrochart-bridge/screenshot.html");
  assert.deepEqual(opened, [[linkFor("https://kevinblakelopez.github.io/astrochart-bridge/chart.html", chart), "_blank", "noopener"]]);
  assert.notEqual(readLink(new URL(opened[0][0]).hash)?.kind, "refused");
});

test("Which planets were visible on the web opens Helioscope's page beside this one, with the chart in its link", () => {
  opened.length = 0;
  const { chart } = chartForEntry({ date: "2024-04-17", time: "08:00:00", lat: SKY.lat, lng: SKY.lng, offsetMinutes: -240 }, []);
  openPage("helioscope.html", chart, "https://kevinblakelopez.github.io/astrochart-bridge/paste.html");
  assert.deepEqual(opened, [[linkFor("https://kevinblakelopez.github.io/astrochart-bridge/helioscope.html", chart), "_blank", "noopener"]]);
  assert.equal(chartFromLink(new URL(opened[0][0]).hash).kind, "chart");
});

test("the way back to the home page shows on the web and stays hidden in the extension", () => {
  const pageWith = () => {
    const home = { hidden: true };
    return { home, getElementById: (id) => (id === "home" ? home : null) };
  };
  for (const href of ["https://kevinblakelopez.github.io/astrochart-bridge/paste.html", "http://127.0.0.1:8000/chart.html"]) {
    const page = pageWith();
    showHomeLink(page, href);
    assert.equal(page.home.hidden, false, href);
  }
  for (const href of ["chrome-extension://abcdefghijklmnop/paste.html", "moz-extension://1234/chart.html", "safari-web-extension://5678/helioscope.html"]) {
    const page = pageWith();
    showHomeLink(page, href);
    assert.equal(page.home.hidden, true, href);
  }
});

test("a link on the web opens in a new tab, and nothing is drawn", () => {
  opened.length = 0;
  const box = container();
  openLink(box, { label: "Open astro.com's form", url: "https://www.astro.com/cgi/ade.cgi" }, SKY);
  assert.deepEqual(opened, [["https://www.astro.com/cgi/ade.cgi", "_blank", "noopener"]]);
  assert.equal(box.parts, undefined);
});

test("Save in Astro-Seek… on the web draws the form's screen for the sky decided, whose button opens the form", () => {
  opened.length = 0;
  const box = container();
  openLink(box, { label: "Save in Astro-Seek…", savesByHand: { town: "New York", name: "Test", gender: null }, secondary: true }, SKY);
  assert.equal(opened.length, 0);
  assert.equal(box.parts[0].textContent, "This page can't choose the town in Astro-Seek's form for you.");
  const [form] = buttons(box);
  assert.equal(form.textContent, "Open Astro-Seek's form");
  form.listeners.click();
  assert.deepEqual(opened, [[astroSeekSaveUrl(SKY, { name: "Test" }), "_blank", "noopener"]]);
});
