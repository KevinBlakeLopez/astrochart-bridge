// Astro-Seek draws a longitude of 180°0', east or west, at 0°0': seen on
// 2026-11-06 (fixtures/astroseek/date-line-180-*.json). So a longitude that
// rounds to 180°0' goes to Astro-Seek as 179°59' on the same side, and every
// screen with an Astro-Seek button warns that the chart is 1' off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartFromRecord, parseAaf } from "../extension/core/aaf.js";
import { astroSeekSaveUrl, astroSeekUrl, onAstroSeekDateLine, sameAstroSeekChart } from "../extension/core/astroseek.js";
import { chartFromHor, parseHor } from "../extension/core/morinus-hor.js";
import { fromFragment, toFragment, toPortable } from "../extension/core/portable.js";
import { viewForAafChart } from "../extension/aaf-model.js";
import { viewForImport } from "../extension/chart-model.js";
import { viewForDesktopImport } from "../extension/desktop-model.js";
import { viewForHorChart } from "../extension/hor-model.js";
import { text } from "../extension/messages/index.js";
import { viewForEntry } from "../extension/paste-model.js";
import { viewFor, viewForSky } from "../extension/popup-model.js";
import { viewForScreenshot } from "../extension/screenshot-model.js";

const LA = { timeZone: "America/Los_Angeles" };
const UTC = "2010-06-01T00:00:00Z";
const WARNING = text().popup.astroSeekDateLine;

const longitudeSent = (url) => {
  const params = new URL(url).searchParams;
  return ["stupne", "minuty", "smer"].map((part) => params.get(`narozeni_delka_${part}`));
};

test("Astro-Seek's own page drew 180°0' at 0°0', east and west, so the reader refuses it", () => {
  for (const side of ["east", "west"]) {
    const { input } = JSON.parse(readFileSync(new URL(`../fixtures/astroseek/date-line-180-${side}.json`, import.meta.url), "utf8"));
    assert.match(input.text, new RegExp(`16°30'S, 0°0'${side === "east" ? "E" : "W"}$`), side);
  }
});

test("a longitude that rounds to 180°0' goes to Astro-Seek as 179°59' on the same side", () => {
  const cases = [
    [180, ["179", "59", "0"]],
    [-180, ["179", "59", "1"]],
    // Within half a minute of 180°, which rounds to 180°0'.
    [179.991667, ["179", "59", "0"]],
    [-179.995, ["179", "59", "1"]],
    // Already 179°59', and nowhere near.
    [179.99, ["179", "59", "0"]],
    [-74, ["74", "0", "1"]],
  ];
  for (const [lng, sent] of cases) {
    const sky = { utc: UTC, lat: -16.5, lng };
    assert.deepEqual(longitudeSent(astroSeekUrl(sky)), sent, `open ${lng}`);
    assert.deepEqual(longitudeSent(astroSeekSaveUrl(sky)), sent, `save ${lng}`);
  }
});

test("only a longitude that rounds to 180°0' is on Astro-Seek's date line", () => {
  for (const lng of [180, -180, 179.991667, -179.995]) assert.equal(onAstroSeekDateLine(lng), true, lng);
  for (const lng of [179.99, -179.99, 0, -74, 151.2]) assert.equal(onAstroSeekDateLine(lng), false, lng);
});

test("an Astro-Seek tab opened for 180° shows the chart AstroChart Bridge sent", () => {
  // The tab's page reads back as 179°59', the coordinates Astro-Seek was given.
  assert.equal(sameAstroSeekChart({ utc: UTC, lat: -16.5, lng: 180 }, { utc: UTC, lat: -16.5, lng: 179 + 59 / 60 }), true);
  assert.equal(sameAstroSeekChart({ utc: UTC, lat: -16.5, lng: -180 }, { utc: UTC, lat: -16.5, lng: 179 + 59 / 60 }), false);
});

// Each screen with an Astro-Seek button, built for a longitude.
const natal = (site, lng) => ({
  kind: "natal",
  site,
  local: "2010-06-01T12:00:00",
  zoneLabel: null,
  utc: UTC,
  utcSource: "printed",
  offsetMinutes: 720,
  lat: -16.5,
  lng,
});
const morinus = new Uint8Array(readFileSync(new URL("../fixtures/morinus/ny-est-plus-dst.p2.hor", import.meta.url)));
const AAF = "#A93:Test,New York,*,17.4.2024,8:00,New York,NY (US)\n#B93:*,40n43,74w00,5hw00,1\n";
const shared = (lng) => {
  const built = toPortable({ local: "2010-06-01T12:00:00", utc: UTC, lat: -16.5, lng }, { via: "paste", utcBasis: "entered" }, {});
  assert.equal(built.kind, "portable", built.reason);
  return fromFragment(`#${toFragment(built.chart)}`);
};
const SCREENS = {
  "an astro.com chart in the popup": (lng) => viewFor(natal("astro-com", lng), LA),
  "a Stellarium Web tab": (lng) => viewForSky({ utc: UTC, lat: -16.5, lng }, LA),
  "a sky from Stellarium Desktop": (lng) => viewForDesktopImport({ state: "connected", sky: { utc: UTC, lat: -16.5, lng } }),
  "a Morinus chart": (lng) => viewForHorChart({ ...chartFromHor(parseHor(morinus)), lng }, LA),
  "an AAF chart": (lng) => viewForAafChart({ ...chartFromRecord(parseAaf(AAF)[0]), lng }, LA),
  "a pasted chart": (lng) => viewForEntry({ date: "2010-06-01", time: "12:00:00", lat: -16.5, lng, offsetMinutes: 720 }, LA),
  "a shared chart": (lng) => viewForImport(shared(lng), LA),
  "a screenshot": (lng) => viewForScreenshot(natal("astro-seek", lng), LA),
};

test("the drawn screen shows the warning, and its Astro-Seek button opens 179°59'", async () => {
  // Just enough of a page for view.js, as in view.test.js.
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
  const { render } = await import("../extension/view.js");
  const container = { replaceChildren: (...parts) => (container.parts = parts) };
  let opened = null;
  render(container, SCREENS["a pasted chart"](-180), (button) => (opened = button.url));
  const all = (nodes) => nodes.flatMap((node) => [node, ...all(node.children ?? [])]);
  const elements = all(container.parts);
  assert.deepEqual(elements.filter(({ className }) => className === "warning").map(({ textContent }) => textContent), [WARNING]);
  elements.find(({ tag, textContent }) => tag === "button" && textContent === text().popup.buttons.openInAstroSeek).listeners.click();
  assert.deepEqual(longitudeSent(opened), ["179", "59", "1"]);
});

for (const [screen, viewOf] of Object.entries(SCREENS)) {
  test(`${screen} warns once that Astro-Seek gets 180° as 179°59'`, () => {
    for (const lng of [180, -180]) {
      const view = viewOf(lng);
      assert.ok(view.buttons.some(({ opens }) => opens === "astro-seek"), "has an Astro-Seek button");
      assert.equal((view.warnings ?? []).filter((warning) => warning === WARNING).length, 1, `${lng}`);
    }
    assert.ok(!(viewOf(-74).warnings ?? []).includes(WARNING), "no warning away from 180°");
  });
}
