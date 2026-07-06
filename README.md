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

Live site: **https://liga-pauper-mont.vercel.app** (Vercel + Neon Postgres).

## Updating data

**Import a tournament — the main way.** Go to `/admin/upload`, paste a melee.gg
tournament URL, choose the league (**Tuesday / Friday**), enter the password, and
**Import**. It scrapes melee (matches + standings + deck names) and adds just
that tournament. Re-importing the same URL **refreshes** it — keyed on the
tournament id, so double-clicking never duplicates.

**Bulk CSV upload — fallback.** Export the sheet's Ranking + Rounds tabs as CSV
and upload both. This **replaces all data** for the store (full-history reload),
so don't use it after importing individual tournaments unless you mean to reset.

Both endpoints are password-gated (`UPLOAD_PASSWORD`) and rate-limited
(20 requests / 10 min per IP). See [MAINTENANCE.md](./MAINTENANCE.md).

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
  - **Monthly Tuesday / Friday** — points standings (win 3 · draw 1 · loss 0)
    with a ← Older / Newer → month switcher, defaulting to the latest month with
    data.
- `/admin/upload` — import a melee tournament by URL, or bulk-upload CSVs.
  Password-gated + rate-limited.

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
- Counts reconciled to match Looker; verified against the source sheet.
- **Deployed** to Vercel + Neon Postgres (functions pinned to `gru1`/São Paulo,
  co-located with the DB). Public repo.
- **Melee tournament import by URL** — scrapes matches + standings + deck names
  (no per-player calls; decklists are embedded), incremental & idempotent per
  tournament. CSV upload kept as a full-replace fallback.
- **Light/dark theme**, English event labels (Tuesday/Friday).
- **Security**: shared-password gate + DB-backed rate limiting on the admin
  endpoints.

## Next steps (what's missing)

Roughly in priority order:

1. **Stronger admin secret / real auth** — the upload+scrape are gated by one
   shared `UPLOAD_PASSWORD` (+ rate limiting). Good enough for now; harden by
   using a long random password, and later real accounts if more than one admin
   needs separate access.
2. **Multi-store** — the `store` column exists on every row and the UI has a
   store selector, but there's no per-store admin or auth scoping yet.
3. **Archetype icons + name normalization / classification** — show mana-symbol
   icons and resolve deck names to canonical archetypes.
   - Deck names today are **free-text from the players**, so they're unreliable.
     Simple aliasing handles obvious variants (`mono-red` / `mono-red aggro`),
     but the real problem is **genuine ambiguity**: a bare `mono red` could be
     Mono-Red Madness/Burn *or* Mono-Red Rally / Red Deck Wins — different decks
     we can't tell apart from the name alone. Players also just type `mono red`
     and leave us guessing.
   - Proper fix needs the **card lists** (depends on #4): classify each deck by
     its actual cards, the way mtgtop8.com does (match against archetype
     signatures / key cards), and fall back to the typed name only when no
     decklist is available. This makes the matrix and meta share trustworthy.
4. **Player decklists** — a page (e.g. `/players/[name]/decklists`, or expand the
   player drill-down) that shows the actual **card lists** a player ran, not just
   the deck name.
   - Groundwork done: the melee import already captures each deck's
     **`DecklistId`** (embedded in the match/standings responses). The remaining
     piece is fetching the card list from the decklist-detail endpoint (likely
     `melee.gg/Decklist/View/{id}`) — verify its response shape first.
   - Then: store cards per decklist, link matches to their decklist id, and
     render the list (mainboard/sideboard) on the player page.
5. **Extend drill-down** — offer the win-rate-by-deck drill-down on the monthly
   Tuesday / Friday views too (currently yearly only).
6. **Polish / smaller items**:
   - Matrix perf on very low presence cutoffs (large grids are ~2–3 MB of DOM);
     consider capping columns to the meta while keeping all decks as rows.
   - Deck drill-down of its own (click a deck → its full matchup spread).
   - Import result could say "refreshed (already imported)" vs "added (new)".
   - Bulk CSV upload is a full-store replace — a guard/confirm would prevent an
     accidental wipe of scraped tournaments.
   - Tests around the date resolver, the melee parser, and the stats functions.

## Key files

- `src/lib/melee.ts` — scrapes a tournament by URL (rounds, matches, standings,
  embedded deck names).
- `src/lib/ingest.ts` — CSV parsing, full-replace upload, and per-tournament
  incremental ingest (`addTournamentData`).
- `src/lib/dates.ts` — the per-year date-format resolver.
- `src/lib/stats.ts` — matrix, Wilson interval, player analysis, points
  standings, deck breakdown.
- `src/lib/queries.ts` — Prisma queries + filters.
- `src/lib/auth.ts` + `src/lib/ratelimit.ts` — admin password + rate limiting.
- `src/app/api/scrape/route.ts` + `api/upload/route.ts` — import endpoints.
- `src/app/page.tsx` + `src/components/MatrixTable.tsx` — matchup matrix.
- `src/app/standings/page.tsx` + `PlayerTable` / `StandingsTable` /
  `DeckBreakdownTable` — standings and drill-down.
- `prisma/schema.prisma` — `Match`, `Standing`, `RateLimit` models.
