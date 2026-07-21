/**
 * Applies the frozen model (via the per-deck classifier) to the cached data and
 * prints the archetype distribution. Use this to sanity-check that the
 * deterministic per-deck classifier reproduces the intended classification.
 *
 * Run:  node scripts/backfill/apply.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyDeck } from "../../src/lib/archetype/classify.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(
  fs.readFileSync(path.join(DIR, "../../src/lib/archetype/model.json")),
);
const decks = JSON.parse(
  fs.readFileSync(path.join(DIR, "data/decklists.json")),
);
const matches = JSON.parse(
  fs.readFileSync(path.join(DIR, "data/matches.json")),
);

// classify every decklist once
const deckArch = {};
for (const id in decks)
  if (decks[id].cards?.length)
    deckArch[id] = classifyDeck(decks[id].cards, decks[id].name, model);

// tally by match-sides
const tally = {};
let noDeck = 0;
for (const m of matches) {
  if (m.opp === "bye") continue;
  const a = m.deckId && deckArch[m.deckId];
  if (!a) {
    noDeck++;
    continue;
  }
  tally[a] = (tally[a] || 0) + 1;
}
const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
const real = ranked.filter(([a]) => !a.startsWith("rogue:"));
const rogue = ranked.filter(([a]) => a.startsWith("rogue:"));
const total = ranked.reduce((n, [, c]) => n + c, 0);

console.log(
  `archetypes: ${real.length} | rogue buckets: ${rogue.length} | rogue sides: ${rogue.reduce((n, [, c]) => n + c, 0)} | no-deck: ${noDeck}`,
);
console.log("\n=== top archetypes ===");
for (const [a, c] of real.slice(0, 30))
  console.log(
    `  ${String(c).padStart(4)} (${((100 * c) / total).toFixed(1)}%)  ${a}`,
  );
