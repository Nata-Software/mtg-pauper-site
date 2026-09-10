/**
 * Turning a decklist's card name into something Scryfall can find.
 *
 * Names come from what a player typed into melee, so a straight lookup fails on
 * 92 of our 1,137 distinct names. The failures are mechanical, in four groups:
 *
 *   [LRW] Spellstutter Sprite          a specific printing was chosen
 *   4 Grab the Prize                   the quantity leaked into the name
 *   Lunarch Veteran // Luminous Phantom  double-faced; Scryfall wants a face
 *   Chancelaria Azorius                registered in Portuguese
 *
 * `cardKey()` produces the stable lookup key (also the Card table's primary
 * key); `searchTerms()` produces the ordered list of things to try against
 * Scryfall, cheapest and most-likely first.
 */

/** Strip a leading "[SET] " printing prefix, if present. */
function stripSetPrefix(s: string): string {
  return s.replace(/^\s*\[[A-Za-z0-9]{1,6}\]\s*/, "");
}

/** Strip a leading quantity that leaked into the name ("4 Grab the Prize"). */
function stripLeadingQty(s: string): string {
  return s.replace(/^\s*\d+\s+(?=\D)/, "");
}

/** The front face of a double-faced name ("A // B" -> "A"). */
export function frontFace(s: string): string {
  const i = s.indexOf("//");
  return i < 0 ? s.trim() : s.slice(0, i).trim();
}

/** Cleaned display form: no set prefix, no leaked quantity, tidy whitespace. */
export function cleanCardName(raw: string): string {
  return stripLeadingQty(stripSetPrefix(String(raw ?? "")))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stable lookup key for a card name — case- and punctuation-insensitive, so
 * "Pirate's Pillage" and "Pirates Pillage" collapse to one row.
 */
export function cardKey(raw: string): string {
  return cleanCardName(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9/ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Names to try against Scryfall for one decklist entry, in order. The exact
 * cleaned name usually hits; the front face covers double-faced cards. Anything
 * still unresolved (mostly Portuguese) is handled by the caller's fuzzy pass,
 * which can search other languages.
 */
export function searchTerms(raw: string): string[] {
  const cleaned = cleanCardName(raw);
  const terms = [cleaned];

  const face = frontFace(cleaned);
  if (face && face !== cleaned) terms.push(face);

  return [...new Set(terms.filter(Boolean))];
}
