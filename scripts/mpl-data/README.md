# MPL seed data

Inputs for `scripts/seed-mpl.mjs` (season 2026).

- **`opens.json`** — the melee Opens standings, produced by `scripts/mpl-scrape.mjs`
  (standings only; no matches/decklists). Aggregation key is the melee account
  `username` (the per-registration `ID` is not stable). Regenerate with
  `node scripts/mpl-scrape.mjs`.

- **`classified.json`** — the store's "classified players" sheet (42 Final spots):
  real name, source, date, standings ref. Transcribed from
  `Jogadores classificados MPL 2026.xlsx`.

- **`aliases.json`** — bridges a classified row (`ordinal`) to its Opens
  `username`, so the ranking knows who already holds a spot. Melee's public API
  only exposes handles, so this map was built two ways:
  1. **PDF ↔ scrape alignment** — the downloaded Opens standings PDFs carry the
     players' *real names* (melee registration names, not the public handle).
     Decoding each PDF (ToUnicode CMap) and aligning it to the scrape **by rank**
     yields `handle → real name`, which then matches the classified real names.
     Verified: every aligned row's points matched the scrape exactly.
  2. **Manual** — high-confidence handle/nickname matches (e.g. `boletoagiota` =
     "Boleto" = Victor Toon).

  Unmatched rows (15) are players who never played a Mont Open — almost all
  partner-store qualifiers (Arcade, Imperium TCG, …) — plus 3 Super Pauper
  handle-users whose PDF is a website screenshot (no extractable names). Add a
  row here (`"<ordinal>": "<username>"`) to bridge one manually, then re-seed.
