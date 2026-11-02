import { test } from "node:test";
import assert from "node:assert/strict";
import { astroSeekSaveUrl, astroSeekUrl } from "../extension/core/astroseek.js";

const NY = { utc: "2024-04-17T12:00:00Z", lat: 40.716667, lng: -74 };
const params = (url) => Object.fromEntries(new URL(url).searchParams);

// The "Add into my database" link on the chart astroSeekUrl(NY) opened, seen
// signed in on 2026-11-01. The empty "&&" is Astro-Seek's own.
const SEEN =
  "https://www.astro-seek.com/my-profile-astro-database?typ=save_birth_data&source=osobni_horoskop" +
  "&narozeni_den=17&narozeni_mesic=4&narozeni_rok=2024&narozeni_hodina=12&narozeni_minuta=00&narozeni_sekunda=00" +
  "&narozeni_sirka_stupne=40&narozeni_sirka_minuty=43&narozeni_sirka_smer=0" +
  "&narozeni_delka_stupne=74&narozeni_delka_minuty=0&narozeni_delka_smer=1" +
  "&narozeni_timezone_form=0&narozeni_timezone_dst_form=0" +
  "&narozeni_mesto_hidden=Manually%20place:%2040%C2%B043%27N,%2074%C2%B00%27W" +
  "&narozeni_stat_hidden=&narozeni_podstat_kratky_hidden=&narozeni_tzid_id=0&&birth_city_save=&nick=";

test("the save link has exactly the parameters of Astro-Seek's own Add into my database link", () => {
  const seen = new URL(SEEN);
  const built = new URL(astroSeekSaveUrl(NY));
  assert.equal(built.origin + built.pathname, seen.origin + seen.pathname);
  assert.deepEqual([...built.searchParams], [...seen.searchParams]);
});

test("the chart's name goes in nick, trimmed, and nothing else changes", () => {
  const named = params(astroSeekSaveUrl(NY, { name: "  Chart Bridge test A " }));
  assert.equal(named.nick, "Chart Bridge test A");
  assert.deepEqual({ ...named, nick: "" }, params(SEEN));
});

test("south and east, Sydney's morning is the previous UTC day", () => {
  const sent = params(astroSeekSaveUrl({ utc: "2024-01-14T21:00:00Z", lat: -33.866667, lng: 151.2 }));
  assert.deepEqual(
    [sent.narozeni_den, sent.narozeni_mesic, sent.narozeni_rok, sent.narozeni_hodina, sent.narozeni_minuta],
    ["14", "1", "2024", "21", "00"],
  );
  assert.deepEqual(
    [sent.narozeni_sirka_stupne, sent.narozeni_sirka_minuty, sent.narozeni_sirka_smer],
    ["33", "52", "1"],
  );
  assert.deepEqual(
    [sent.narozeni_delka_stupne, sent.narozeni_delka_minuty, sent.narozeni_delka_smer],
    ["151", "12", "0"],
  );
  assert.equal(sent.narozeni_mesto_hidden, "Manually place: 33°52'S, 151°12'E");
});

test("the save link and the chart link send the same date, time, place and zone", () => {
  for (const sky of [NY, { utc: "1944-01-10T17:00:00Z", lat: 40.9999, lng: -74.0001 }]) {
    const save = params(astroSeekSaveUrl(sky));
    const chart = params(astroSeekUrl(sky));
    const shared = Object.keys(save).filter((key) => /^narozeni_(den|mesic|rok|hodina|minuta|sekunda|sirka|delka|timezone)/.test(key));
    assert.equal(shared.length, 14);
    for (const key of shared) assert.equal(save[key], chart[key], `${sky.utc} ${key}`);
  }
});

test("a UTC without Z throws, naming astroSeekSaveUrl", () => {
  assert.throws(() => astroSeekSaveUrl({ ...NY, utc: "2024-04-17T12:00:00" }), /^Error: astroSeekSaveUrl needs a UTC instant/);
});
