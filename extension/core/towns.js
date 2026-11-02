// Choosing a chart's town from a site's list of matching towns. Each site
// reads its own list's text into a name and coordinates (astrocom.js
// chooseTown, astroseek.js chooseCity); the rules for choosing are the same.

// How far a match may be from the chart's coordinates to count as its town.
export const TOWN_LIMIT_KM = 25;

/**
 * Which of a site's matches for a chart's town to choose, from their names,
 * their coordinates and the chart's. Only matches within TOWN_LIMIT_KM count.
 * Of those, the one named as the chart's town, ignoring case and accents and
 * anything after the town's first comma, is chosen, so "New York" chooses New
 * York over New York City at the same place; or, when none is so named, the
 * only one. Otherwise the person is asked, nearest first. A match whose place
 * the site couldn't read is left out, but still counts as listed.
 *
 * @param {{ text: string, place: { name: string, lat: number, lng: number } | null }[]} listed
 *   each match's text, in the site's order, with the name and coordinates read from it
 * @param {{ town: string, lat: number, lng: number }} chart
 * @returns {{ kind: "pick", match: Match } | { kind: "ask", matches: Match[] } | { kind: "none", listed: number }}
 *   where a Match is { text, away }: its text and its distance in words
 */
export function chooseListedTown(listed, { town, lat, lng }) {
  const near = listed
    .filter(({ place }) => place !== null)
    .map(({ text, place }) => ({ text, name: place.name, km: distanceKm(lat, lng, place.lat, place.lng) }))
    .filter(({ km }) => km <= TOWN_LIMIT_KM)
    .sort((a, b) => a.km - b.km);
  const match = ({ text, km }) => ({ text, away: km < 1 ? "less than 1 km" : `${Math.round(km)} km` });
  const named = near.filter(({ name }) => sameName(name, town.split(",")[0]));
  if (named.length === 1) return { kind: "pick", match: match(named[0]) };
  if (named.length === 0 && near.length === 1) return { kind: "pick", match: match(near[0]) };
  if (near.length === 0) return { kind: "none", listed: listed.length };
  return { kind: "ask", matches: near.map(match) };
}

const plainName = (name) => name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const sameName = (a, b) => plainName(a) === plainName(b);

// Great-circle distance on a sphere of the Earth's mean radius.
function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
