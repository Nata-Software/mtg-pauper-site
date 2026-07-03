# MTG Pauper Stats

A website to show matchup winrates and standings for our MTG Pauper events —
a better-looking, more flexible replacement for the current Looker Studio
dashboard. Data comes from the same Google Sheet (`Ranking` + `Rounds` tabs),
which is fed by the melee.gg scraper (`code.gs` / `Dowloader.gs`).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Prisma 7** + **SQLite** (via the `better-sqlite3` driver adapter).
  Swappable to Postgres later by changing the datasource + adapter.

## Running it

Node is installed at `~/.local/node`. Make it available, then start the dev server:

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # or add to ~/.bashrc
cd ~/mtg-pauper-site
npm run dev
```

Open http://localhost:3000 (works from Windows too — WSL2 forwards localhost).

## Loading data

1. In the Google Sheet, export the **Ranking** and **Rounds** tabs as CSV.
2. Go to `/admin/upload`, pick a store name, and upload the two CSVs.
   Uploading **replaces** all data for that store (the sheet export is the full
   history, so this is the correct, idempotent behavior).

CLI equivalent (used for seeding):

```bash
curl -X POST http://localhost:3000/api/upload \
  -F store=default \
  -F rounds=@data/Rounds.csv \
  -F ranking=@data/Ranking.csv
```

## Pages

- `/` — **Matchup matrix**: winrate of each archetype vs each other archetype,
  95% Wilson confidence interval per cell, green→red coloring, sortable by
  matches / winrate / alphabetical, filterable by event, date range, and
  minimum % presence. Draws are excluded from winrate (`wins / (wins+losses)`).
- `/standings` — player results per event, filterable by event/date.
- `/admin/upload` — CSV upload (no auth yet — see roadmap).

## Data notes / known limitations

- **Dates are messy in the source**: the `Ranking` tab uses Excel serial
  numbers; the `Rounds` tabs use slash strings whose format *changed over time*
  (older rows `DD/MM/YYYY`, newer rows `M/D/YYYY`). `src/lib/dates.ts` infers
  the orientation **per year** from that year's unambiguous dates. A year with
  only ambiguous dates would fall back to `DD/MM`.
- **Deck names** are shown as stored (lowercased in the sheet, title-cased for
  display). No archetype aliasing/normalization or icons yet.
- `historic_rounds` is already contained in `Rounds`, so only `Rounds` +
  `Ranking` are ingested.

## Roadmap

1. ✅ MVP: matchup matrix + standings + CSV upload.
2. Admin-only upload (auth).
3. Multi-store: the `store` column already exists on every row and the UI has a
   store selector; needs auth scoping + per-store admin.
4. Automation: port `code.gs` / `Dowloader.gs` (plain JS melee.gg scraping) to a
   Node job that writes straight to the DB, removing the spreadsheet middle-man.

## Key files

- `src/lib/ingest.ts` — CSV parsing + full-replace ingest.
- `src/lib/dates.ts` — the per-year date-format resolver.
- `src/lib/stats.ts` — matchup matrix + Wilson interval.
- `src/lib/queries.ts` — Prisma queries + filters.
- `src/app/page.tsx` — matrix page. `src/components/MatrixTable.tsx` — the grid.
- `prisma/schema.prisma` — `Match` and `Standing` models.
