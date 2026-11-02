import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage } from "../extension/core/index.js";
import { withDesktopSend } from "../extension/desktop-model.js";
import { viewFor, viewForSky } from "../extension/popup-model.js";
import { render } from "../extension/view.js";

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8"));
const analyze = (name) => {
  const { url, input } = fixture(name);
  return analyzePage({ url, input });
};

// Just enough of a page for view.js to draw into: elements keep their text,
// class and children, and the container keeps what it was given.
globalThis.document = {
  createElement: (tag) => {
    const element = {
      tag, className: "", textContent: "", disabled: false, children: [],
      append: (...nodes) => element.children.push(...nodes),
      addEventListener: () => {},
    };
    return element;
  },
};

// The screen's buttons in order, with the Stellarium Desktop line where it falls.
function drawn(view) {
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  render(container, view, () => {});
  return container.parts
    .filter(({ tag, className }) => tag === "button" || className.includes("desktop-hint"))
    .map(({ tag, textContent }) => (tag === "button" ? textContent : "(Stellarium Desktop line)"));
}

test("the Stellarium Desktop line sits right under its button, not after Share…", () => {
  const view = withDesktopSend(viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" }));
  assert.deepEqual(drawn(view), [
    "Open Stellarium Web",
    "Send to Stellarium Desktop",
    "(Stellarium Desktop line)",
    "Share…",
    "Enter in astro.com…",
  ]);
});

test("with Stellarium Desktop the default, its line follows it to the top", () => {
  const view = withDesktopSend(viewFor(analyze("ny-2024-04-17"), { timeZone: "America/Los_Angeles" }), { preferred: true });
  assert.deepEqual(drawn(view).slice(0, 4), [
    "Send to Stellarium Desktop",
    "(Stellarium Desktop line)",
    "Open Stellarium Web",
    "Share…",
  ]);
});

test("on a Stellarium Web tab's screen, the line follows the button there too", () => {
  const view = withDesktopSend(viewForSky({ utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 }));
  assert.deepEqual(drawn(view).slice(0, 3), ["Open chart in Astro-Seek", "Send to Stellarium Desktop", "(Stellarium Desktop line)"]);
});
