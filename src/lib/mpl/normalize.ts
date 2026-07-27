/**
 * MPL identity + source helpers.
 *
 * Melee's per-tournament player `ID` is NOT stable (a fresh id per
 * registration), so a player is aggregated across Opens by their account
 * `username`, lowercased. Display names are shown as-is.
 */

/** Stable per-account key: lowercased, trimmed melee username. */
export function normUsername(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export type MplSourceType =
  | "open"
  | "parallel_mont"
  | "partner_store"
  | "last_chance";

/**
 * Classify a "classified by" source label from the sheet into a type + store.
 *   "1º Open MPL - Mont" / "Super Pauper 35k - Mont" -> open (Mont)
 *   "Ranking Paralelo Maio Mont - Sexta"             -> parallel_mont (Mont)
 *   "Arcade - Vaga 1" / "Imperium TCG - Vaga 3"      -> partner_store (Arcade…)
 *   "Last Chance …"                                  -> last_chance
 */
export function classifySource(source: string): {
  sourceType: MplSourceType;
  store: string | null;
} {
  const s = source.trim();
  const lower = s.toLowerCase();

  if (/last\s*chance/.test(lower)) return { sourceType: "last_chance", store: null };

  if (/\bopen\b|super pauper/.test(lower))
    return { sourceType: "open", store: "Mont" };

  if (/ranking paralelo/.test(lower))
    return { sourceType: "parallel_mont", store: "Mont" };

  // Partner store: "<Store> - Vaga N" — the store is the part before " - ".
  const store = s.split(" - ")[0].trim() || null;
  return { sourceType: "partner_store", store };
}
