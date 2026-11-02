import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { astroSeekUrl } from "../extension/core/astroseek.js";
import { analyzePage } from "../extension/core/index.js";
import { withDesktopSend } from "../extension/desktop-model.js";
import { viewFor, viewForSky, withOtherWays } from "../extension/popup-model.js";
import { render } from "../extension/view.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const analyze = (name) => {
  const { url, input } = fixture(name);
  return analyzePage({ url, input });
};

// Just enough of a page for view.js to draw into: elements keep their text,
// class, children and listeners, and the container keeps what it was given.
globalThis.document = {
  createElement: (tag) => {
    const element = {
      tag, className: "", textContent: "", disabled: false, children: [], listeners: {},
      append: (...nodes) => element.children.push(...nodes),
      addEventListener: (type, listener) => (element.listeners[type] = listener),
    };
    return element;
  },
};

// The screen's buttons in order, with the group labels and the Stellarium
// Desktop line where they fall.
function drawn(view) {
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  render(container, view, () => {});
  return container.parts
    .filter(({ tag, className }) => tag === "button" || tag === "h2" || className.includes("desktop-hint"))
    .map(({ tag, textContent }) => (tag === "button" ? textContent : tag === "h2" ? `[${textContent}]` : "(Stellarium Desktop line)"));
}

test("a chart screen's buttons are drawn under their labels, with the Stellarium Desktop line under its button", () => {
  const view = withDesktopSend(viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" }));
  assert.deepEqual(drawn(view), [
    "[See the sky]",
    "Open Stellarium Web",
    "Send to Stellarium Desktop",
    "(Stellarium Desktop line)",
    "[Take the chart elsewhere]",
    "Share…",
    "Enter in astro.com…",
  ]);
});

test("with Stellarium Desktop the default, its line follows it to the top", () => {
  const view = withDesktopSend(viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" }), { preferred: true });
  assert.deepEqual(drawn(view).slice(0, 4), [
    "[See the sky]",
    "Send to Stellarium Desktop",
    "(Stellarium Desktop line)",
    "Open Stellarium Web",
  ]);
});

test("on a Stellarium Web tab's screen, the line follows the button there too", () => {
  const view = withDesktopSend(viewForSky({ utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 }));
  assert.deepEqual(drawn(view), [
    "[Take the chart elsewhere]",
    "Open chart in Astro-Seek",
    "Save in Astro-Seek…",
    "Enter in astro.com…",
    "[See the sky]",
    "Send to Stellarium Desktop",
    "(Stellarium Desktop line)",
  ]);
});

test("on a Stellarium Web tab's screen, every button gets the tab's sky, Send to Stellarium Desktop too", () => {
  const sky = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  const clicks = [];
  render(container, withDesktopSend(viewForSky(sky)), (button, decided) => clicks.push([button.does ?? button.url ?? "saves", decided]));
  const buttons = container.parts.filter(({ tag, textContent }) => tag === "button" && textContent !== "Enter in astro.com…");
  for (const button of buttons) button.listeners.click();
  assert.deepEqual(clicks, [
    [astroSeekUrl(sky), sky],
    ["saves", sky],
    ["send-to-desktop", sky],
  ]);
});

test("the buttons that wait for the sky still wait for it, whichever group they're in", () => {
  const view = withDesktopSend(viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" }));
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  render(container, { ...view, sky: undefined }, () => {});
  const disabled = container.parts.filter(({ tag, disabled }) => tag === "button" && disabled).map(({ textContent }) => textContent);
  assert.deepEqual(disabled, ["Open Stellarium Web", "Send to Stellarium Desktop", "Share…"]);
});

// The popup's chart screen, with Read a different chart, as drawn, and what its clicks passed on.
function popupScreen(view) {
  const clicked = [];
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  render(container, withOtherWays(withDesktopSend(view)), (button) => clicked.push(button));
  return { parts: container.parts, clicked };
}

test("Read a different chart comes last, closed, with the other ways in their groups", () => {
  const { parts } = popupScreen(viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" }));
  const box = parts.at(-1);
  assert.equal(box.tag, "details");
  assert.equal(box.className, "more");
  assert.equal(box.open, undefined);
  assert.deepEqual(
    box.children.map(({ tag, textContent }) => (tag === "button" ? textContent : `${tag}: ${textContent}`)),
    [
      "summary: Read a different chart",
      "h2: Read a chart you have",
      "Read a screenshot",
      "Paste chart text",
      "Open an AAF or Morinus file",
      "Open an AstroChart Bridge file",
      "h2: Or use the sky in Stellarium Desktop",
      "Import from Stellarium Desktop",
    ],
  );
});

test("a click in Read a different chart passes on the page it opens, or what it does", () => {
  const { parts, clicked } = popupScreen(viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" }));
  const buttons = parts.at(-1).children.filter(({ tag }) => tag === "button");
  buttons.find(({ textContent }) => textContent === "Read a screenshot").listeners.click();
  buttons.find(({ textContent }) => textContent === "Import from Stellarium Desktop").listeners.click();
  assert.deepEqual(clicked, [
    { label: "Read a screenshot", page: "screenshot.html" },
    { label: "Import from Stellarium Desktop", does: "import-from-desktop" },
  ]);
});

test("Read a different chart's buttons don't wait for the sky", () => {
  const view = viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" });
  const { parts } = popupScreen({ ...view, sky: undefined });
  assert.deepEqual(parts.at(-1).children.filter(({ tag, disabled }) => tag === "button" && disabled), []);
});
