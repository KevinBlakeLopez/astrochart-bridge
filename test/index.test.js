import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzePage, classifyUrl, extractorFor } from "../extension/core/index.js";

const astroSeekUrl = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/astroseek/${name}.json`, import.meta.url), "utf8")).url;
const refused = (reason) => ({ kind: "refused", reason });

// The captured astro.com account chart page, and a drawing link for its chart
// built as test/astrocom.test.js builds LINK, with an invented second slot.
const ASTRO_COM_URL = "https://www.astro.com/cgi/chart.cgi?gm=a1&nhor=26&nho2=1&btyp=2&mth=gw&sday=1&smon=11&syr=2026&rs=0";
const CHART_URL =
  "https://www.astro.com/cgi/chart.cgi?gm=a1&btyp=2&mth=gw&sday=1&smon=11&syr=2026&rs=0&lang=e&refpl=go" +
  "&nd=,Test,e,17,4,2024,8:00,h4w,gad,0,New York,NY (US),74w00,40n43,f,45,-24500,61" +
  "&nd2=,Other,e,15,1,2024,8:00,h11e,gad,0,Sydney,NSW (AU),151e12,33s52,f,0,0,0" +
  `&tit=Free Astrology Chart&titn=Test &secc=${"0".repeat(32)}`;
const body = btoa(CHART_URL).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const LINK = `https://www.astro.com/cgi/sub.cgi?&sumode=spg&lang=e&pgid=L${body.length}L${body}&ajax=1`;

test("each site's pages go to that site's classifyUrl", () => {
  assert.deepEqual(classifyUrl(astroSeekUrl("ny-2024-04-17")), { kind: "natal" });
  assert.deepEqual(classifyUrl(astroSeekUrl("transit-sydney-2026-11-01")), refused("transit"));
  assert.deepEqual(classifyUrl(ASTRO_COM_URL), { kind: "natal" });
  assert.deepEqual(classifyUrl("https://www.astro.com/astro-databank/Stallone,_Sylvester"), refused("databank"));
});

test("pages on other sites are unsupported and get no extractor", () => {
  for (const url of ["https://example.com/", "https://astro.com/cgi/chart.cgi", "chrome://extensions", "not a url"]) {
    assert.deepEqual(classifyUrl(url), refused("unsupported"), url);
    assert.equal(extractorFor(url), null, url);
  }
});

// Chrome sends the tab only an extractor's source, so each one is rebuilt from
// its source here and run against a stand-in for the page's document.
function runInPage(extract, document) {
  const rebuilt = new Function("document", `return (${extract})();`);
  return rebuilt(document);
}

test("the Astro-Seek extractor returns the page text", () => {
  const input = runInPage(extractorFor(astroSeekUrl("ny-2024-04-17")), { body: { innerText: "page text" } });
  assert.deepEqual(input, { text: "page text" });
});

test("the astro.com extractor returns only the addresses of pgid links", () => {
  const selectors = [];
  const document = {
    body: { innerText: "the account's saved charts" },
    querySelectorAll(selector) {
      selectors.push(selector);
      return [{ href: LINK }, { href: "https://www.astro.com/other" }];
    },
  };
  const input = runInPage(extractorFor(ASTRO_COM_URL), document);
  assert.deepEqual(selectors, ['a[href*="pgid="]']);
  assert.deepEqual(input, { links: [LINK, "https://www.astro.com/other"] });
});

test("an astro.com chart opens at the offset astro.com states", () => {
  assert.deepEqual(analyzePage({ url: ASTRO_COM_URL, input: { links: [LINK] } }), {
    kind: "natal",
    local: "2024-04-17T08:00:00",
    zoneLabel: null,
    lat: 40.716667,
    lng: -74,
    utc: "2024-04-17T12:00:00Z",
    utcSource: "declared",
    offsetMinutes: -240,
  });
});

test("an astro.com refusal comes back unchanged", () => {
  assert.deepEqual(analyzePage({ url: ASTRO_COM_URL, input: { links: [] } }), refused("no-drawing-link"));
});

test("a page that isn't natal never reaches its site's reader", () => {
  const databank = "https://www.astro.com/cgi/chart.cgi?wgid=wgeJw9TsEKgzAU";
  assert.deepEqual(analyzePage({ url: databank, input: { links: [LINK] } }), refused("databank"));
});

test("a missing input reads like an empty page", () => {
  assert.deepEqual(analyzePage({ url: ASTRO_COM_URL, input: undefined }), refused("no-drawing-link"));
  assert.deepEqual(analyzePage({ url: ASTRO_COM_URL, input: {} }), refused("no-drawing-link"));
  assert.deepEqual(analyzePage({ url: astroSeekUrl("ny-2024-04-17"), input: {} }), refused("unreadable-page"));
});
