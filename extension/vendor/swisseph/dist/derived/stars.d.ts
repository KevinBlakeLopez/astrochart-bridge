/**
 * Fixed star curation.
 *
 * There is **no new data** here — `sefstars.txt` already carries every star
 * brighter than magnitude 5 with ICRS coordinates, proper motion and
 * parallax. What was missing is which stars matter to which tradition, and
 * how to look them up unambiguously.
 *
 * The table itself is **generated** from the catalogue (`generated/stars.ts`).
 * A hand-written first version gave Betelgeuse magnitude 0.50 instead of
 * 0.42; fields like designation and magnitude have to come from the source,
 * not from memory.
 *
 * Rebuilding the catalogue from Gaia would not help: Gaia saturates on bright
 * stars and effectively runs out around magnitude 3, and every traditional
 * astrological star sits in that range. See `docs/ROADMAP.md`.
 */
import { BRIGHT_MAGNITUDE_LIMIT, CURATED_STARS, STAR_GROUP_COUNTS, type CuratedStar, type StarGroup } from '../generated/stars.js';
export { BRIGHT_MAGNITUDE_LIMIT, CURATED_STARS, STAR_GROUP_COUNTS, type CuratedStar, type StarGroup, };
/** The stars in a group, brightest first. */
export declare function starsInGroup(group: StarGroup): CuratedStar[];
/**
 * The four Royal Stars of Persia — the Watchers.
 *
 * Around 3000 BCE they sat near the equinoctial and solstitial points,
 * dividing the sky into four seasons. Precession has long since broken that
 * alignment.
 */
export declare const ROYAL_STARS: readonly CuratedStar[];
/**
 * The 15 Behenian stars of the medieval magical tradition, listed in
 * Agrippa's *De Occulta Philosophia*, each with a stone and a plant.
 */
export declare const BEHENIAN_STARS: readonly CuratedStar[];
/** Other stars that recur throughout the astrological literature. */
export declare const NOTABLE_STARS: readonly CuratedStar[];
/**
 * Stars brighter than {@link BRIGHT_MAGNITUDE_LIMIT}.
 * This group is not curated by hand — it falls out of the catalogue.
 */
export declare const BRIGHT_STARS: readonly CuratedStar[];
/**
 * A lookup string that finds a star by its **designation**.
 *
 * `sefstars.txt` carries some stars under several traditional spellings —
 * "Zubenelgenubi" and "Zuben Elgenubi", both al-2Lib. Their search keys are
 * identical, so which one comes back depends on the stability of `qsort`,
 * which C does not guarantee and which varies between platforms. The
 * positions agree, but getting a different **name** back is a surprise.
 *
 * Searching by designation removes the ambiguity: `,alTau` always resolves to
 * exactly one record.
 */
export declare function byDesignation(designation: string): string;
/** Finds a curated star by name, ignoring case and spaces. */
export declare function findCuratedStar(name: string): CuratedStar | undefined;
/** Finds a curated star by designation, e.g. `"alTau"`. */
export declare function findByDesignation(designation: string): CuratedStar | undefined;
//# sourceMappingURL=stars.d.ts.map