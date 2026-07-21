/**
 * Deck-label normalization — one canonical display label for every deck name,
 * whether it came from the card-based classifier or a raw player-typed name.
 *
 * Why this exists: the classifier's signature rules emit Title-Case labels
 * ("Mono-Blue Delver") while its centroid labels are lowercase ("grixis
 * affinity"), and ~900 non-league / no-decklist 2026 matches keep the raw name
 * the player typed. Left alone that produces near-duplicate rows that differ
 * only in casing or wording. Running every label through canonicalDeck() here
 * collapses them to a single consistent label everywhere (matrix, standings,
 * per-deck breakdown).
 *
 * Three stages:
 *   1. clean()      lowercase, strip the internal "rogue:" prefix, tidy spacing
 *   2. SYNONYMS     merge non-casing variants ("mono-black aristocrats" ->
 *                   "mono-black sacrifice", "cawgate" -> "caw-gates", …)
 *   3. bare fold    a color-only name ("mono-red", "azorius", "dimir") can't be
 *                   pinned to a specific archetype from the name alone, so it is
 *                   folded into that player's dominant same-color archetype
 *                   (resolved by the caller). If the player has no classified
 *                   deck in that color, it falls back to the cleaned title-case.
 *   + display()     consistent Title-Case with special tokens (RDW, W-U-B-R …).
 */

/** lowercase, drop internal "rogue:" prefix, unify separators/spacing. */
export function clean(name) {
  let s = String(name ?? "").trim().toLowerCase();
  s = s.replace(/^rogue:\s*/, "");
  s = s.replace(/\s+/g, " ");
  // Spelling unifications that are pure aliases, not judgment calls.
  s = s.replace(/\bcawgate\b/g, "caw-gates").replace(/\bcaw-gate\b/g, "caw-gates");
  return s.trim();
}

/**
 * Non-casing merges: cleaned variant -> cleaned canonical key.
 * Casing-only duplicates need no entry here — display() handles those.
 * Kept intentionally conservative; archetype judgment calls the user cares
 * about live here and are easy to review/extend.
 */
export const SYNONYMS = {
  // Mono-Black Sacrifice (renamed from Aristocrats per user).
  "mono-black aristocrats": "mono-black sacrifice",
  "mono-black black sacrifice": "mono-black sacrifice",
  // Mono-red: "burn" is the madness build; generic "aggro" is RDW.
  "mono-red madness burn": "mono-red madness",
  "mono-red burn": "mono-red madness",
  "mono-red aggro": "mono-red rdw",
  // Rakdos madness burn spelling variants.
  "rakdos burn": "rakdos madness burn",
  "rakdos madness": "rakdos madness burn",
  // Terror wording.
  "mono-blue blue terror": "mono-blue terror",
};

/**
 * Color identity of a deck from its (cleaned) name. Returns a canonical color
 * key like "R" or "B,R,U" (WUBRG-sorted), or "" if it can't be determined.
 */
const GUILDS = {
  azorius: "WU", dimir: "UB", rakdos: "BR", gruul: "RG", selesnya: "GW",
  orzhov: "WB", izzet: "UR", golgari: "BG", boros: "RW", simic: "GU",
  bant: "GWU", esper: "WUB", grixis: "UBR", jund: "BRG", naya: "RGW",
  mardu: "RWB", temur: "GUR", abzan: "WBG", jeskai: "URW", sultai: "BGU",
};
const MONO = { white: "W", blue: "U", black: "B", red: "R", green: "G" };
const ORDER = "WUBRG";

function sortColors(letters) {
  return [...new Set(letters.split(""))]
    .filter((c) => ORDER.includes(c))
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .join(",");
}

export function colorKey(cleaned) {
  const words = cleaned.split(/[\s-]+/);
  if (words[0] === "mono" && MONO[words[1]]) return MONO[words[1]];
  for (const w of words) if (GUILDS[w]) return sortColors(GUILDS[w]);
  // color-code sequence like "w-u-r-g …"
  const codes = words.filter((w) => /^[wubrg]$/.test(w));
  if (codes.length >= 2) return sortColors(codes.join("").toUpperCase());
  if (cleaned.includes("colorless")) return "C";
  return "";
}

/**
 * Is this a bare color-only name that names no archetype (just a color/guild)?
 * Such names get folded into the player's dominant same-color archetype.
 */
export function isBare(cleaned) {
  if (/^mono[- ](white|blue|black|red|green)$/.test(cleaned)) return true;
  return !!(GUILDS[cleaned] || cleaned === "colorless");
}

const UPPER = new Set(["rdw"]);

/** Consistent Title-Case for a cleaned label. */
export function display(cleaned) {
  return cleaned
    .split(" ")
    .map((tok) => {
      if (UPPER.has(tok)) return tok.toUpperCase();
      // color-code token: w-u-b-r -> W-U-B-R
      if (/^[wubrg](-[wubrg])+$/.test(tok)) return tok.toUpperCase();
      return tok
        .split("-")
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join("-");
    })
    .join(" ");
}

/**
 * Canonical display label for a deck.
 *
 * @param archetype card-based archetype label, or null/"" if unclassified
 * @param deck      the raw player-typed name (used when archetype is absent)
 * @param resolve   optional (colorKey) => label|undefined, the player's dominant
 *                  same-color archetype, used to fold bare color-only names
 */
export function canonicalDeck(archetype, deck, resolve) {
  const fromCards = archetype != null && String(archetype).trim() !== "";
  let cleaned = clean(fromCards ? archetype : deck);
  // A player who forgot to register a decklist has no archetype and no typed
  // name. Label it so their games still show (and count) in per-deck/player
  // views instead of vanishing; the matrix filters it out via BYE_DECKS.
  if (!cleaned) return "Unknown Deck";

  // Bare color-only raw names get folded into the player's dominant deck.
  if (!fromCards && isBare(cleaned) && resolve) {
    const folded = resolve(colorKey(cleaned));
    if (folded) return folded; // already a canonical display label
  }

  cleaned = SYNONYMS[cleaned] ?? cleaned;
  return display(cleaned);
}
