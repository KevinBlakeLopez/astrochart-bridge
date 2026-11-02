import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyUrl, parseNd, readChart, readPgid } from "../extension/core/astrocom.js";

// The nd= record of a captured astro.com account chart, "Test", which uses the
// invented New York birth data of the Astro-Seek fixtures.
const TEST = ",Test,e,17,4,2024,8:00,h4w,gad,0,New York,NY (US),74w00,40n43,f,45,-24500,61";
const TEST_RESULT = {
  local: "2024-04-17T08:00:00",
  zone: { kind: "offset", offsetMinutes: -240 },
  field9: "gad",
  lat: 40.716667,
  lng: -74,
  name: { first: "Test", last: "" },
  town: "New York",
};

// The Test record with some fields replaced, by position counting from 1:
// 1 last name, 2 first name, 4-6 date, 7 time, 8 zone, 9 field 9, 11 town,
// 13 longitude, 14 latitude.
const variant = (changes) => {
  const fields = TEST.split(",");
  for (const [position, value] of Object.entries(changes)) fields[position - 1] = value;
  return fields.join(",");
};

test("reads the captured account chart record", () => {
  assert.deepEqual(parseNd(TEST), TEST_RESULT);
});

test("one-digit minutes read like two, as Astro-Databank writes 74w0", () => {
  assert.deepEqual(parseNd(variant({ 13: "74w0" })), TEST_RESULT);
});

test("four digits after the direction are minutes and seconds", () => {
  assert.deepEqual(parseNd(variant({ 13: "73w4859" })), { ...TEST_RESULT, lng: -73.816389 });
});

test("a time with seconds keeps them", () => {
  assert.deepEqual(parseNd(variant({ 7: "7:30:03" })), { ...TEST_RESULT, local: "2024-04-17T07:30:03" });
});

test("east and south are positive and negative, as in Sydney", () => {
  assert.deepEqual(parseNd(variant({ 8: "h11e", 13: "151e12", 14: "33s52" })), {
    ...TEST_RESULT,
    zone: { kind: "offset", offsetMinutes: 660 },
    lat: -33.866667,
    lng: 151.2,
  });
});

test("a local-mean-time zone is returned with its meridian", () => {
  assert.deepEqual(parseNd(variant({ 8: "m10e0", 9: "gal" })), {
    ...TEST_RESULT,
    zone: { kind: "local-mean-time", meridian: 10 },
    field9: "gal",
  });
  assert.deepEqual(parseNd(variant({ 8: "m0w10", 9: "gal" })).zone, { kind: "local-mean-time", meridian: -0.166667 });
});

test("standard time is field 9 gas, beside an offset that has no daylight saving", () => {
  assert.deepEqual(parseNd(variant({ 4: "10", 5: "1", 8: "h5w", 9: "gas" })), {
    ...TEST_RESULT,
    local: "2024-01-10T08:00:00",
    zone: { kind: "offset", offsetMinutes: -300 },
    field9: "gas",
  });
});

test("fields 1 and 2 are the last and first names, and field 11 the town", () => {
  assert.deepEqual(parseNd(variant({ 1: "Example", 2: "Ada", 11: "Ulm" })), {
    ...TEST_RESULT,
    name: { first: "Ada", last: "Example" },
    town: "Ulm",
  });
  assert.deepEqual(parseNd(variant({ 1: "Example", 2: "" })).name, { first: "", last: "Example" });
});

test("an empty or blank name or town is left out, and the chart still reads", () => {
  assert.deepEqual(parseNd(variant({ 2: " ", 11: "" })), { ...TEST_RESULT, name: null, town: null });
});

test("a name or town with a % is left out, as an account's records haven't been seen percent-encoded", () => {
  assert.deepEqual(parseNd(variant({ 11: "New%20York" })), { ...TEST_RESULT, town: null });
});

test("0°0' west is 0, not -0", () => {
  assert.ok(Object.is(parseNd(variant({ 13: "0w0" })).lng, 0));
  assert.ok(Object.is(parseNd(variant({ 8: "h0w" })).zone.offsetMinutes, 0));
});

test("the edges of each range are accepted", () => {
  assert.equal(parseNd(variant({ 14: "90n0" })).lat, 90);
  assert.equal(parseNd(variant({ 13: "180w0" })).lng, -180);
  assert.equal(parseNd(variant({ 8: "h12w" })).zone.offsetMinutes, -720);
  assert.equal(parseNd(variant({ 8: "h14e" })).zone.offsetMinutes, 840);
});

test("a record without exactly 18 fields is refused", () => {
  assert.equal(parseNd(TEST.replace("New York", "New York, Manhattan")), null);
  assert.equal(parseNd(TEST.slice(0, TEST.lastIndexOf(","))), null);
  assert.equal(parseNd(""), null);
});

test("zone codes not seen before are refused", () => {
  for (const code of ["h5e30", "h13w", "h15e", "h4", "x4w", "m10e0030", "m181e0", "m10e60", ""]) {
    assert.equal(parseNd(variant({ 8: code })), null, JSON.stringify(code));
  }
});

test("field 9 values not seen before are refused", () => {
  for (const value of ["gaw", "jul", ""]) {
    assert.equal(parseNd(variant({ 9: value })), null, JSON.stringify(value));
  }
});

test("coordinates out of range or in an unseen form are refused", () => {
  const cases = [
    [14, "40n60"], [14, "40n4360"], [14, "40n435"], [14, "90n1"], [14, "40e43"], [14, "40n"],
    [13, "180w1"], [13, "74n00"], [13, "74w0060"], [13, "-74w0"],
  ];
  for (const [position, code] of cases) {
    assert.equal(parseNd(variant({ [position]: code })), null, `field ${position}: ${code}`);
  }
});

test("times and dates that don't exist are refused", () => {
  const cases = [
    [7, "24:00"], [7, "8:60"], [7, "8:00:60"], [7, "8"], [7, "8:0"],
    [4, "31"], [4, "0"], [4, "1a"], [5, "13"], [5, "0"], [6, ""], [6, "12345"],
  ];
  for (const [position, value] of cases) {
    assert.equal(parseNd(variant({ [position]: value })), null, `field ${position}: ${value}`);
  }
});

// readPgid

// The captured account chart page, and the chart URL its drawing link carries,
// with nd2 (the account's second chart slot) replaced by an invented record
// and secc by zeros. Re-encoding the captured URL the way base64url() does
// reproduced the captured pgid exactly.
const PAGE_URL = "https://www.astro.com/cgi/chart.cgi?gm=a1&nhor=26&nho2=1&btyp=2&mth=gw&sday=1&smon=11&syr=2026&rs=0";
const SLOT_2 = ",Other,e,15,1,2024,8:00,h11e,gad,0,Sydney,NSW (AU),151e12,33s52,f,0,0,0";
const CHART_URL =
  "https://www.astro.com/cgi/chart.cgi?gm=a1&btyp=2&mth=gw&sday=1&smon=11&syr=2026&rs=0&lang=e&refpl=go" +
  `&nd=${TEST}&nd2=${SLOT_2}&tit=Free Astrology Chart&titn=Test &secc=${"0".repeat(32)}`;

const base64url = (text) => btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const pgidFor = (chartUrl) => {
  const body = base64url(chartUrl);
  return `L${body.length}L${body}`;
};
const linkWith = (pgid) => `https://www.astro.com/cgi/sub.cgi?&sumode=spg&lang=e&pgid=${pgid}&ajax=1`;
const LINK = linkWith(pgidFor(CHART_URL));
const read = (links, url = PAGE_URL) => readPgid({ url, links });
const refused = (reason) => ({ kind: "refused", reason });

test("reads nd from the drawing link, never nd2", () => {
  assert.deepEqual(read([LINK]), { nd: TEST });
});

test("unpadded base64url of every length decodes", () => {
  const remainders = new Set();
  for (const name of ["Test", "Test1", "Test12"]) {
    const chartUrl = CHART_URL.replace("titn=Test ", `titn=${name} `);
    remainders.add(base64url(chartUrl).length % 4);
    assert.deepEqual(read([linkWith(pgidFor(chartUrl))]), { nd: TEST }, name);
  }
  assert.equal(remainders.size, 3, "the names should cover every unpadded length");
});

test("the same pgid in two links is one link", () => {
  assert.deepEqual(read([LINK, LINK.replace("lang=e", "lang=g")]), { nd: TEST });
});

test("a page without a drawing link is refused", () => {
  assert.deepEqual(read([]), refused("no-drawing-link"));
  for (const link of [
    LINK.replace("/cgi/sub.cgi", "/cgi/other.cgi"),
    LINK.replace("https://www.astro.com", "https://astro.example"),
    LINK.replace("https://", "http://"),
    "not a link",
  ]) {
    assert.deepEqual(read([link]), refused("no-drawing-link"), link);
  }
});

test("two different drawing links make the page ambiguous", () => {
  const other = linkWith(pgidFor(CHART_URL.replace("sday=1&", "sday=2&")));
  assert.deepEqual(read([LINK, other]), refused("ambiguous-page"));
});

// The chart URL, lengthened until its base64 needs padding, written with the
// padding and a length that counts it: everything right except the padding.
function paddedPgid() {
  let chartUrl = CHART_URL;
  while (!btoa(chartUrl).endsWith("=")) chartUrl += "&x=1";
  const body = btoa(chartUrl).replaceAll("+", "-").replaceAll("/", "_");
  return `L${body.length}L${body}`;
}

test("a pgid that doesn't unwrap to one chart record is unreadable", () => {
  const body = base64url(CHART_URL);
  const cases = {
    "length one too many": linkWith(`L${body.length + 1}L${body}`),
    "padded, a form not seen": linkWith(paddedPgid()),
    "a character outside base64url": linkWith(`L${body.length}L${body.slice(1)}.`),
    "not a URL inside": linkWith(pgidFor("not a url")),
    "another path inside": linkWith(pgidFor(CHART_URL.replace("/cgi/chart.cgi", "/cgi/sub.cgi"))),
    "another site inside": linkWith(pgidFor(CHART_URL.replace("https://www.astro.com", "https://astro.example"))),
    "no nd": linkWith(pgidFor(CHART_URL.replace(`&nd=${TEST}`, ""))),
    "two nd": linkWith(pgidFor(`${CHART_URL}&nd=${TEST}`)),
  };
  for (const [name, link] of Object.entries(cases)) {
    assert.deepEqual(read([link]), refused("unreadable-link"), name);
  }
});

test("a key both URLs carry with different values is a mismatch", () => {
  for (const [from, to] of [["btyp=2", "btyp=3"], ["sday=1&", "sday=2&"], ["gm=a1", "gm=a3"]]) {
    assert.deepEqual(read([linkWith(pgidFor(CHART_URL.replace(from, to)))]), refused("page-url-mismatch"), to);
  }
});

test("both URLs must carry btyp", () => {
  assert.deepEqual(read([LINK], PAGE_URL.replace("&btyp=2", "")), refused("page-url-mismatch"));
  assert.deepEqual(read([linkWith(pgidFor(CHART_URL.replace("&btyp=2", "")))]), refused("page-url-mismatch"));
});

// astro.com also separates parameters with ";", as in the address of a chart
// page seen on 2026-11-01: ?;smon=11;rs=0;sday=2;btyp=2;syr=2026;mth=gw;clang=e;gm=a1;nhor=13.
// The page and chart URLs here are PAGE_URL and CHART_URL written that way.
const SEMICOLONS = (url) => url.replace("?", "?;").replaceAll("&", ";");

test("a page or chart URL that separates its parameters with ; reads the same", () => {
  assert.deepEqual(read([LINK], SEMICOLONS(PAGE_URL)), { nd: TEST });
  assert.deepEqual(read([linkWith(pgidFor(SEMICOLONS(CHART_URL)))]), { nd: TEST });
  assert.deepEqual(read([linkWith(pgidFor(SEMICOLONS(CHART_URL)))], SEMICOLONS(PAGE_URL)), { nd: TEST });
  assert.deepEqual(read([LINK], SEMICOLONS(PAGE_URL).replace("btyp=2", "btyp=3")), refused("page-url-mismatch"));
});

test("a ; written inside nd= splits the record, which parseNd refuses", () => {
  const link = linkWith(pgidFor(CHART_URL.replace(",Test,", ",Te;st,")));
  assert.deepEqual(readChart({ url: PAGE_URL, links: [link] }), refused("unreadable-record"));
});

test("a key on one side only is fine", () => {
  assert.deepEqual(read([LINK], `${PAGE_URL}&pa=nmo&lang=e`), { nd: TEST });
  assert.deepEqual(read([linkWith(pgidFor(CHART_URL.replace("&sday=1", "")))]), { nd: TEST });
});

test("a page address that isn't a URL is unsupported", () => {
  assert.deepEqual(read([LINK], "not a url"), refused("unsupported"));
});

// readChart

// A drawing link like LINK whose nd= record has some fields replaced, as variant() does.
const linkWithNd = (changes) => linkWith(pgidFor(CHART_URL.replace(`&nd=${TEST}`, `&nd=${variant(changes)}`)));
const chartFrom = (links) => readChart({ url: PAGE_URL, links });

test("reads the captured chart as a local time, offset and place", () => {
  assert.deepEqual(chartFrom([LINK]), {
    local: "2024-04-17T08:00:00",
    offsetMinutes: -240,
    lat: 40.716667,
    lng: -74,
    name: { first: "Test", last: "" },
    town: "New York",
  });
});

test("a drawing link refusal comes back unchanged", () => {
  assert.deepEqual(chartFrom([]), refused("no-drawing-link"));
});

test("a record parseNd can't read is unreadable", () => {
  assert.deepEqual(chartFrom([linkWithNd({ 8: "h5e30" })]), refused("unreadable-record"));
});

test("local mean time is refused, whatever field 9 says", () => {
  assert.deepEqual(chartFrom([linkWithNd({ 8: "m74w0", 9: "gal" })]), refused("local-mean-time"));
  assert.deepEqual(chartFrom([linkWithNd({ 8: "m74w0" })]), refused("local-mean-time"));
});

test("a date before the Gregorian calendar began is refused, two-digit years too", () => {
  assert.deepEqual(chartFrom([linkWithNd({ 4: "14", 5: "10", 6: "1582" })]), refused("calendar-unsupported"));
  assert.deepEqual(chartFrom([linkWithNd({ 6: "50" })]), refused("calendar-unsupported"));
  // Checked before local mean time, which most of these charts use.
  assert.deepEqual(chartFrom([linkWithNd({ 6: "1500", 8: "m74w0", 9: "gal" })]), refused("calendar-unsupported"));
  assert.equal(chartFrom([linkWithNd({ 4: "15", 5: "10", 6: "1582" })]).local, "1582-10-15T08:00:00");
  // 29 February in a year 1 to 99 is checked as that year, not as 1900 to 1999.
  assert.equal(parseNd(`,Test,e,29,2,4,8:00,h4w,gad,0,New York,NY (US),74w00,40n43,f,45,-24500,61`).local, "0004-02-29T08:00:00");
  assert.equal(parseNd(`,Test,e,29,2,1,8:00,h4w,gad,0,New York,NY (US),74w00,40n43,f,45,-24500,61`), null);
});

// An invented New York chart in January, when the city keeps standard time:
// 08:00 at UTC-05:00, as astro.com wrote a captured standard-time record.
test("reads a standard-time chart with its offset as written", () => {
  assert.deepEqual(chartFrom([linkWithNd({ 4: "10", 5: "1", 8: "h5w", 9: "gas" })]), {
    local: "2024-01-10T08:00:00",
    offsetMinutes: -300,
    lat: 40.716667,
    lng: -74,
    name: { first: "Test", last: "" },
    town: "New York",
  });
});

// The Test chart's drawing link, with its name and town replaced, for the
// decoding a pgid's bytes go through: base64, the chart URL, its query.
const linkNamed = (changes, toBytes = (url) => url) =>
  linkWith(pgidFor(toBytes(CHART_URL.replace(`&nd=${TEST}`, `&nd=${variant(changes)}`))));
const utf8 = (text) => String.fromCharCode(...new TextEncoder().encode(text));

test("a name and town in UTF-8 inside the drawing link are read whole", () => {
  const chart = chartFrom([linkNamed({ 1: "Müller", 2: "Zoë", 11: "Zürich" }, utf8)]);
  assert.deepEqual([chart.name, chart.town], [{ first: "Zoë", last: "Müller" }, "Zürich"]);
});

test("a name or town in bytes that aren't UTF-8, as Latin-1 would give, is left out, and the chart still opens", () => {
  const chart = chartFrom([linkNamed({ 2: "Zo\xeb", 11: "Z\xfcrich" })]);
  assert.deepEqual(chart, {
    local: "2024-04-17T08:00:00",
    offsetMinutes: -240,
    lat: 40.716667,
    lng: -74,
    name: null,
    town: null,
  });
});

test("an offset zone beside field 9 gal is refused", () => {
  assert.deepEqual(chartFrom([linkWithNd({ 9: "gal" })]), refused("unseen-field-9"));
});

// classifyUrl

const CHART = "https://www.astro.com/cgi/chart.cgi";

test("account charts of a seen type are natal", () => {
  for (const url of [
    PAGE_URL,
    // Links on the captured page that reach the same chart with other extras.
    `${CHART}?smon=11&nhor=26&sday=1&btyp=2&nho2=1&pa=nmo&syr=2026&lang=e&gm=a1&mth=gw`,
    `${PAGE_URL}&lang=g`,
    `${PAGE_URL}#top`,
    // Parameters separated by ";", as astro.com also writes them.
    SEMICOLONS(PAGE_URL),
    `${CHART}?;smon=11;rs=0;sday=2;btyp=2;syr=2026;mth=gw;clang=e;gm=a1;nhor=26`,
  ]) {
    assert.deepEqual(classifyUrl(url), { kind: "natal" }, url);
  }
});

test("Astro-Databank pages and charts are refused as databank", () => {
  for (const url of [
    `${CHART}?wgid=wgeJw9TsEKgzAU`,
    `${PAGE_URL}&wgid=wgeJw9TsEKgzAU`,
    `${SEMICOLONS(PAGE_URL)};wgid=wgeJw9TsEKgzAU`,
    "https://www.astro.com/astro-databank/Stallone,_Sylvester",
  ]) {
    assert.deepEqual(classifyUrl(url), refused("databank"), url);
  }
});

test("other astro.com chart pages are refused as a chart type not supported yet", () => {
  for (const url of [
    // Seen on astro.com, but not with a readable drawing link.
    `${CHART}?btyp=w2gw&rs=2&;&nhor=26`,
    `${CHART}?btyp=w2gw&rs=2&usechpref=1&nhor=26&nho2=1`,
    `${CHART}?btyp=vip&nhor=26&nho2=1`,
    `${CHART}?pdf=d&gm=a1&nhor=26&nho2=1&btyp=2&mth=gw&sday=1&smon=11&syr=2026&rs=0`,
    `${CHART}?showgif&lang=e&gif=chart.png&res=100`,
    // Made-up variations on the natal page.
    PAGE_URL.replace("nhor=26&", ""),
    PAGE_URL.replace("nhor=26", "nhor=x"),
    `${PAGE_URL}&nhor=27`,
    PAGE_URL.replace("mth=gw", "mth=atw"),
    PAGE_URL.replace("&mth=gw", ""),
    `${PAGE_URL}&btyp=3`,
    SEMICOLONS(PAGE_URL).replace("mth=gw", "mth=atw"),
    `${SEMICOLONS(PAGE_URL)};nhor=27`,
  ]) {
    assert.deepEqual(classifyUrl(url), refused("unsupported-chart"), url);
  }
});

test("every other page is unsupported", () => {
  for (const url of [
    "https://www.astro.com/cgi/genchart.cgi?nhor=26&nho2=1",
    "https://www.astro.com/",
    PAGE_URL.replace("https://", "http://"),
    PAGE_URL.replace("www.astro.com", "astro.com"),
    // Not astro.com at all.
    "https://horoscopes.astro-seek.com/calculate-birth-chart-horoscope-online/",
    "chrome://extensions",
    "not a url",
    "",
  ]) {
    assert.deepEqual(classifyUrl(url), refused("unsupported"), url);
  }
});
