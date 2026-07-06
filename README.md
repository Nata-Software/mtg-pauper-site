# MTG Pauper Stats

A website to show matchup winrates and standings for our MTG Pauper events —
a better-looking, more flexible replacement for the current Looker Studio
dashboard. Data comes from the same Google Sheet (`Ranking` + `Rounds` tabs),
which is fed by the melee.gg scraper (`code.gs` / `Dowloader.gs`).

> **Maintaining or updating the site (refresh data, deploy, env vars)?**
> See [MAINTENANCE.md](./MAINTENANCE.md).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **Prisma 7** + **SQLite** (via the `better-sqlite3` driver adapter).
  Swappable to Postgres later by changing the datasource + adapter.

## Running it

First time setup:

```bash
npm install                 # also runs `prisma generate` via postinstall
cp .env.example .env        # DATABASE_URL="file:./dev.db"
npx prisma migrate deploy   # creates dev.db and applies all migrations
npm run dev
```

Open http://localhost:3000 (works from Windows too — WSL2 forwards localhost).

If `npm run dev` errors with `The table main.Match does not exist`, it means
`.env` is missing or migrations haven't been applied — rerun the last two
steps above.

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
  minimum % presence (defaults to the current year and a 1% presence cutoff).
  Header row + first column stay frozen while scrolling. Draws are excluded
  from winrate (`wins / (wins+losses)`).
- `/standings` — three tabbed views:
  - **Whole year** — per-player win/loss/draw analysis (byes included), ranked
    by matches. Click a player to drill into their **win rate by deck**.
  - **Monthly Terça / Sexta** — points standings (win 3 · draw 1 · loss 0) with
    a ← Older / Newer → month switcher, defaulting to the latest month with data.
- `/admin/upload` — CSV upload (no auth yet — see next steps).

Counting matches Looker: totals count every match a deck/player played,
including byes and matches with an unrecorded opponent deck.

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

## Done so far

- Matchup matrix (Wilson CI, color scale, sort, filters, frozen header/column,
  fast HTML-string rendering of the large grid).
- Standings: yearly player analysis, monthly points tables, month switcher.
- Player → win-rate-by-deck drill-down.
- CSV upload (full-replace per store) with the messy-date resolver.
- Counts reconciled to match Looker; verified against the source sheet.

## Next steps (what's missing)

Roughly in priority order:

1. **Deploy / hosting** — currently local-only. Pick a host (Vercel + a hosted
   Postgres is the natural fit), migrate Prisma from SQLite to Postgres (swap
   the datasource/adapter), and set up env/secrets. Decide how data gets in
   (upload vs. sync).
2. **Admin auth** — `/admin/upload` is unprotected. Add login (NextAuth or a
   simple admin password) so only admins can upload/replace data.
3. **Multi-store** — the `store` column exists on every row and the UI has a
   store selector, but there's no per-store admin or auth scoping yet.
4. **Automation** — port `code.gs` / `Dowloader.gs` (plain-JS melee.gg scraping)
   to a Node job that writes straight to the DB, removing the spreadsheet
   middle-man. Or, as a lighter first step, a **"Sync from Google Sheet"**
   button (the sheet is public, so the app can pull it directly).
5. **Archetype icons + name normalization / classification** — show mana-symbol
   icons and resolve deck names to canonical archetypes.
   - Deck names today are **free-text from the players**, so they're unreliable.
     Simple aliasing handles obvious variants (`mono-red` / `mono-red aggro`),
     but the real problem is **genuine ambiguity**: a bare `mono red` could be
     Mono-Red Madness/Burn *or* Mono-Red Rally / Red Deck Wins — different decks
     we can't tell apart from the name alone. Players also just type `mono red`
     and leave us guessing.
   - Proper fix needs the **card lists** (depends on #7): classify each deck by
     its actual cards, the way mtgtop8.com does (match against archetype
     signatures / key cards), and fall back to the typed name only when no
     decklist is available. This makes the matrix and meta share trustworthy.
6. **Extend drill-down** — offer the win-rate-by-deck drill-down on the monthly
   Terça/Sexta views too (currently yearly only).
7. **Player decklists** — a page (e.g. `/players/[name]/decklists`, or expand the
   player drill-down) that shows the actual **card lists** a player ran, not just
   the deck name.
   - *Needs investigation first:* confirm we can scrape full decklists from
     melee.gg. The current scraper only reads the decklist **name** via
     `Player/GetPlayerDetails` (which also returns each decklist's **id**), so
     the card lists would come from a separate decklist-detail endpoint
     (something like `melee.gg/Decklist/View/{id}`). Verify the endpoint,
     response shape, and rate limits before building.
   - Then: store cards per decklist, link matches to their decklist id, and
     render the list (mainboard/sideboard) on the player page.
8. **Polish / smaller items**:
   - Matrix perf on very low presence cutoffs (large grids are ~2–3 MB of DOM);
     consider capping columns to the meta while keeping all decks as rows.
   - Deck drill-down of its own (click a deck → its full matchup spread).
   - Configurable event→weekday mapping instead of the hardcoded `terca`/`sexta`.
   - Handle the `historic_rounds` tab if it ever diverges from `Rounds`.
   - Tests around the date resolver and the stats functions.

## Key files

- `src/lib/ingest.ts` — CSV parsing + full-replace ingest.
- `src/lib/dates.ts` — the per-year date-format resolver.
- `src/lib/stats.ts` — matrix, Wilson interval, player analysis, points
  standings, deck breakdown.
- `src/lib/queries.ts` — Prisma queries + filters.
- `src/app/page.tsx` + `src/components/MatrixTable.tsx` — matchup matrix.
- `src/app/standings/page.tsx` + `PlayerTable` / `StandingsTable` /
  `DeckBreakdownTable` — standings and drill-down.
- `prisma/schema.prisma` — `Match` and `Standing` models.
