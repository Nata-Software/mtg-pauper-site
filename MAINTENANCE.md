# Maintaining & updating MTG Pauper Stats

How to keep the site running and refresh its data. For what the app _does_ and
the roadmap, see [README.md](./README.md).

## Where everything lives

| Piece       | Service                                           | Notes                                      |
| ----------- | ------------------------------------------------- | ------------------------------------------ |
| Site        | **https://liga-pauper-mont.vercel.app**           | Live URL                                   |
| Code        | GitHub — `Nata-Software/mtg-pauper-site` (public) | Source of truth                            |
| Hosting     | **Vercel** (free Hobby plan)                      | Auto-deploys on every push to `main`       |
| Database    | **Neon** (free Postgres, São Paulo)               | Connection string = `DATABASE_URL` env var |
| Source data | **melee.gg** tournaments                          | Scraped live by the app                    |

**Data flow:** melee.gg tournament → app scrapes it (`/admin/upload`) → Neon →
site reads Neon.

## Updating the data (the routine task)

After each Tuesday/Friday event:

1. Open **`/admin/upload`** on the live site.
2. Paste the **melee.gg tournament URL** (e.g.
   `https://melee.gg/Tournament/View/440596`).
3. Choose the **league** it belongs to (**Tuesday**, **Friday**, or **MPL
   Open** for a yearly-league stage).
4. Enter the **password** (the `UPLOAD_PASSWORD` value — ask an admin; it's in
   Vercel, not this repo) and click **Import**.
5. Done — the site updates immediately.

> **Re-importing is safe.** Each tournament is keyed by its melee id, so
> importing the same URL again just refreshes it — it never duplicates. If you
> pick the wrong league, just re-import into the right one (last import wins).

### After an import: two scripts that do NOT run themselves

An import writes only what it scraped. These two fill in the rest, and both are
easy to forget because nothing breaks visibly when you skip them — the site just
quietly shows less than it could.

Run from a checkout with `DATABASE_URL` pointing at **prod** (see
`LOCAL_CONTEXT.md`). Both are dry-run by default; add `--apply` to write.

```bash
node scripts/sync-cards.mjs --apply              # new cards -> Card table
node scripts/apply-decklist-overrides.mjs --apply # re-assert manual decks
```

**`sync-cards.mjs`** caches any card nobody has played before, so it gets a
hover preview and a card page. It only looks up names not already cached, so
running it after every import is cheap. Skip it and new cards render as plain
text with no image.

**`apply-decklist-overrides.mjs`** re-applies the decks recorded in
`scripts/decklist-overrides.json` — players who confirmed what they played at an
event where melee has no decklist at all. **An import replaces that
tournament's rows, so a re-import silently reverts those decks to "Unknown
Deck".** Re-run it after re-importing any tournament listed in that file.

### Re-importing older events to fill decklist gaps

melee doesn't always attach a decklist to every match record — one event carried
one on 107 of 123 entries. The scraper now fills a player's missing rows from
their other matches in the same event, and reads decklist ids from the standings
too, but **only for imports made after that fix**. Older tournaments keep their
gaps until re-imported.

If a player shows "Unknown Deck" for an event they did register a list for,
re-import that tournament — it's safe (keyed on melee id) and closes the gap.
If melee genuinely has no list for them (empty in both the matches *and* the
standings), leave it unknown, or add an entry to
`scripts/decklist-overrides.json` if the player confirms what they played.

### Bulk CSV upload (fallback only)

`/admin/upload` also has a collapsible **CSV upload** (the sheet's `Ranking` +
`Rounds` tabs). This **replaces the entire store's data** — use it only to
reload full history, never for a single event, or it will wipe the tournaments
you imported.

Both admin actions are **rate-limited** (20 requests / 10 min per IP).

## Environment variables

Set in **Vercel → Project → Settings → Environment Variables**, and for local
dev in a gitignored **`.env`** (copy from `.env.example`):

| Name              | What it is                                                            |
| ----------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`    | Neon Postgres connection string                                       |
| `UPLOAD_PASSWORD` | Shared password required to upload data. Unset locally = uploads open |

**Never commit these values** — the repo is public.

## Local development

Requires Node 24+ and a Postgres DB (use the Neon DB, or a Neon dev branch).

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then set DATABASE_URL to your Neon string
npx prisma migrate deploy        # only needed on a fresh/empty database
npm run dev                      # http://localhost:3000
```

Seed data locally via `/admin/upload` (no password needed when `UPLOAD_PASSWORD`
is unset). On this WSL machine Node lives at `~/.local/node` — add it with
`export PATH="$HOME/.local/node/bin:$PATH"`.

## Deploying

- **Automatic:** every push to `main` triggers a Vercel build + deploy.
- The build runs `prisma generate` (via the `postinstall` script) then
  `next build`. No database migration runs during deploy.
- To roll back, use **Vercel → Deployments → (older deploy) → Promote**.

## Changing the database schema

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <change>` against your dev DB — creates a
   migration under `prisma/migrations/` and regenerates the client.
3. Commit the new `prisma/migrations/**` folder.
4. Apply to production once: point `DATABASE_URL` at Neon and run
   `npx prisma migrate deploy`.

## Troubleshooting

- **Site shows no data** → `DATABASE_URL` is pointing at the wrong Neon DB, or no
  data has been uploaded yet.
- **Upload returns 401** → wrong or missing `UPLOAD_PASSWORD`.
- **Numbers look off vs. the Google Sheet** → re-export and re-upload; remember
  it's a full replace. Totals count every match (byes included), matching
  Looker; see the README "Counting" note.
- **Vercel build fails** → open the build logs; usually a missing env var or a
  Prisma generate error.
