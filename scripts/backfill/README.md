# Deck archetype classification

Classifies each decklist into a Pauper archetype **by its cards** (not the
player-typed name), so mislabeled/under-named decks land in the right bucket.
This is the tooling; the per-deck classifier is meant to be reused by the app so
newly-imported tournaments classify automatically.

## Pieces

| File | Role |
|---|---|
| `classify.mjs` | **The per-deck classifier.** `classifyDeck(cards, typedName, model)` → archetype. Deterministic — one deck in, same archetype out, no corpus needed. Holds the signature rules (red/blue/gruul splits, color-from-lands). **Port this to the app** to classify on import. |
| `archetype-model.json` | **The frozen model** (learned): IDF weights + one TF-IDF centroid per clustered archetype. The other half of the classification. |
| `train.mjs` | Rebuilds `archetype-model.json` from `data/decklists.json`. Re-run to re-derive archetypes from accumulated data. |
| `apply.mjs` | Runs the frozen classifier over the cache and prints the archetype distribution (sanity check). |
| `scrape.mjs` | Scrapes the org's league tournaments + decklists (matches + standings + card lists) into `data/`. For new backfills. |
| `data/*.json` | Cached scrape (matches + 900+ decklists with cards). Lets you re-train **without re-scraping**. |

## Flow

```
scrape.mjs  → data/matches.json + data/decklists.json   (scrape melee)
train.mjs   → archetype-model.json                       (learn centroids)
apply.mjs   → distribution                               (verify)
```

## How classification works (classify.mjs)

1. **Signature rules first** — the splits we care about, by cards:
   - Red: Madness (Voldaren Epicure / Kessig Flamebreather package) vs RDW.
   - Blue: Delver > Terror (Tolarian Terror) > Faeries (tribal package).
   - Gruul: Ponza (land destruction) vs Ramp (Utopia Sprawl) vs Aggro.
2. **Nearest frozen centroid** (TF-IDF cosine, small same-color bonus) for the rest.
3. **Rogue** when nothing matches confidently → rare / new decks keep their name.

Colors come from lands (basics + colored artifact lands + common duals). Land
detection under-reads mana-dork/ramp decks, so gruul is re-split by signature
after centroid matching.

## Changing the classification later

Because the decklist **cards** are stored (here in `data/`, and in the app's DB
once integrated), changing the rules or re-training **does not require
re-scraping** — just re-run over the stored cards.

## Next: app integration (Phase 2)

Port `classifyDeck` to `src/lib/archetype.ts`, add a `Decklist` table (cards +
archetype) and `decklistId` on `Match`, classify on import, and have the matrix
/ standings / player-drilldown read the archetype (falling back to the typed
name for legacy CSV data with no cards).
