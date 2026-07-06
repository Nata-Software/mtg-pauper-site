# Maintaining & updating MTG Pauper Stats

How to keep the site running and refresh its data. For what the app *does* and
the roadmap, see [README.md](./README.md).

## Where everything lives

| Piece | Service | Notes |
|---|---|---|
| Code | GitHub — `Nata-Software/mtg-pauper-site` (public) | Source of truth |
| Hosting | **Vercel** (free Hobby plan) | Auto-deploys on every push to `main` |
| Database | **Neon** (free Postgres) | Connection string = `DATABASE_URL` env var |
| Source data | **Google Sheet** (`Ranking` + `Rounds` tabs) | Fed by the melee.gg Apps Script scraper (`code.gs` / `Dowloader.gs`) |

**Data flow:** melee.gg → Apps Script (Sheet menu **MTGMelee → Run All**) →
Google Sheet tabs → export CSV → upload to the site → Neon → site reads Neon.

## Updating the data (the routine task)

Do this after each event (or batch of events):

1. In the Google Sheet, refresh the tournament data (Sheet menu
   **MTGMelee → Run All**) so the **Ranking** and **Rounds** tabs are current.
2. Export **both** tabs as CSV: for each tab, **File → Download →
   Comma-separated values (.csv)**. You'll get two files (Ranking, Rounds).
3. Open the live site's **`/admin/upload`**.
4. Enter the **upload password** (the `UPLOAD_PASSWORD` value — ask an admin;
   it's stored in Vercel, not in this repo), choose the two CSVs, and upload.
5. Done — the site updates immediately.

> **Uploading is a full replace, not incremental.** The sheet export is the
> entire history, so each upload wipes and reloads that store's data. Always
> upload the **complete** Ranking + Rounds exports, not a partial slice.

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
