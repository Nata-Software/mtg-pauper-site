import { classifyDeck as classifyRaw } from "./archetype/classify.mjs";
import model from "./archetype/model.json";

export type Card = {
  qty: number;
  slug: string;
  name: string;
  /** Which board the card was registered in. Absent on rows scraped before
   *  melee's category blocks were parsed; treat a missing value as maindeck. */
  board?: "main" | "side";
  /** melee's own category heading ("Creature", "Land", "Sideboard", …). */
  category?: string;
};

/**
 * Classify a decklist's cards into an archetype (card-based, deterministic).
 * Shares the exact classifier + frozen model used by the offline tooling in
 * scripts/backfill, so imports and re-classification agree.
 */
export function classifyDeck(cards: Card[], typedName = ""): string {
  return classifyRaw(cards, typedName, model);
}
