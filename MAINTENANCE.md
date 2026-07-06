# Maintaining & updating MTG Pauper Stats

How to keep the site running and refresh its data. For what the app *does* and
the roadmap, see [README.md](./README.md).

## Where everything lives

| Piece | Service | Notes |
|---|---|---|
| Site | **https://liga-pauper-mont.vercel.app** | Live URL |
| Code | GitHub — `Nata-Software/mtg-pauper-site` (public) | Source of truth |
| Hosting | **Vercel** (free Hobby plan) | Auto-deploys on every push to `main` |
| Database | **Neon** (free Postgres, São Paulo) | Connection string = `DATABASE_URL` env var |
| Source data | **melee.gg** tournaments | Scraped live by the app |

**Data flow:** melee.gg tournament → app scrapes it (`/admin/upload`) → Neon →
site reads Neon.

## Updating the data (the routine task)

After each Tuesday/Friday event:

1. Open **`/admin/upload`** on the live site.
2. Paste the **melee.gg tournament URL** (e.g.
   `https://melee.gg/Tournament/View/440596`).
3. Choose the **league** it belongs to (**Tuesday** or **Friday**).
4. Enter the **password** (the `UPLOAD_PASSWORD` value — ask an admin; it's in
   Vercel, not this repo) and click **Import**.
5. Done — the site updates immediately.

> **Re-importing is safe.** Each tournament is keyed by its melee id, so
> importing the same URL again just refreshes it — it never duplicates. If you
> pick the wrong league, just re-import into the right one (last import wins).

### Bulk CSV upload (fallback only)

`/admin/upload` also has a collapsible **CSV upload** (the sheet's `Ranking` +
`Rounds` tabs). This **replaces the entire store's data** — use it only to
reload full history, never for a single event, or it will wipe the tournaments
you imported.

Both admin actions are **rate-limited** (20 requests / 10 min per IP).

## Environment variables

Set in **Vercel → Project → Settings → Environment Variables**, and for local
dev in a gitignored **`.env`** (copy from `.env.example`):

| Name | What it is |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
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
