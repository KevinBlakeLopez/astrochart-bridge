/**
 * Turkish names and notes for the built-in lots.
 *
 * The lot definitions themselves are English, because they are **data that
 * leaves the process**: `LotResult.name`, `.source` and `.note` end up in a
 * caller's UI, in an MCP answer handed to a model, and in error messages. The
 * package is published to npm in English, so a Turkish string in that path is
 * undiagnosable for most of the people reading it.
 *
 * That is a separate question from whether the Turkish is worth keeping — it
 * is, and this file keeps it. Nothing reads this map by default; it is here for
 * a Turkish-language caller who wants it:
 *
 * ```ts
 * const lots = calculateLots(points, sect);
 * const label = LOT_NAMES_TR[lots.Fortune.key]?.name ?? lots.Fortune.name;
 * ```
 *
 * Keys match {@link ALL_LOTS}; {@link LOT_VARIANTS} entries are keyed by their
 * variant name.
 */
/** A lot's Turkish name, and its note where one exists. */
export interface LocalisedLot {
    name: string;
    note?: string;
}
/** Turkish names for {@link ALL_LOTS}. */
export declare const LOT_NAMES_TR: Record<string, LocalisedLot>;
/** Turkish names for the {@link LOT_VARIANTS} definitions. */
export declare const LOT_VARIANT_NAMES_TR: Record<string, LocalisedLot>;
//# sourceMappingURL=lot-names-tr.d.ts.map