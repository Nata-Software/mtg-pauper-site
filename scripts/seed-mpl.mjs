/**
 * Seed the MPL tables (MplStage / MplResult / MplSpot) for one season.
 *
 *   node scripts/seed-mpl.mjs            # uses DATABASE_URL from .env
 *   DATABASE_URL="$PROD" node scripts/seed-mpl.mjs
 *
 * Idempotent: replaces the season's rows only. Touches no other tables, so it
 * is safe against prod. Inputs come from scripts/mpl-data/ (opens.json is the
 * melee scrape from scripts/mpl-scrape.mjs; classified.json is the store's
 * "classified players" sheet; aliases.json bridges a sheet row to its Opens
 * `username` where a handle could be confidently matched).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const SEASON = 2026;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(DIR, "mpl-data");
const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

const opens = load("opens.json");
const classified = load("classified.json");
const aliases = load("aliases.json"); // { "<ordinal>": "<username>" }

const norm = (s) => String(s ?? "").trim().toLowerCase();

/** Mirror of src/lib/mpl/normalize.ts classifySource (kept inline for the script). */
function classifySource(source) {
  const s = String(source).trim();
  const lower = s.toLowerCase();
  if (/last\s*chance/.test(lower)) return { sourceType: "last_chance", store: null };
  if (/\bopen\b|super pauper/.test(lower)) return { sourceType: "open", store: "Mont" };
  if (/ranking paralelo/.test(lower)) return { sourceType: "parallel_mont", store: "Mont" };
  return { sourceType: "partner_store", store: s.split(" - ")[0].trim() || null };
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Backup anything already there (first run: empty).
const existing = {};
for (const t of ["MplStage", "MplResult", "MplSpot"]) {
  const { rows } = await client.query(`SELECT * FROM "${t}" WHERE ${t === "MplResult" ? "true" : `"season" = $1`}`, t === "MplResult" ? [] : [SEASON]);
  existing[t] = rows;
}
const hadRows = Object.values(existing).some((r) => r.length);
if (hadRows) {
  const outDir = path.join(DIR, "..", "backups");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(outDir, `mpl-preseed-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(existing));
  console.log(`backed up existing MPL rows -> ${path.relative(path.join(DIR, ".."), file)}`);
}

await client.query("BEGIN");
try {
  // Clear this season (MplResult cascades from MplStage).
  await client.query(`DELETE FROM "MplStage" WHERE "season" = $1`, [SEASON]);
  await client.query(`DELETE FROM "MplSpot" WHERE "season" = $1`, [SEASON]);

  let nStages = 0, nResults = 0;
  for (const o of opens) {
    const countsForRanking = o.format !== "trios";
    const { rows } = await client.query(
      `INSERT INTO "MplStage"
         ("season","kind","ordinal","name","date","meleeId","format","countsForRanking","playerCount")
       VALUES ($1,'open',$2,$3,$4,$5,$6,$7,$8) RETURNING "id"`,
      [SEASON, o.ordinal, o.name, o.date ? new Date(o.date) : null, o.id, o.format, countsForRanking, o.count],
    );
    const stageId = rows[0].id;
    nStages++;

    // Multi-row insert of the standings.
    const cols = ["stageId", "username", "player", "rank", "record", "points", "omw", "tgw", "ogw"];
    const values = [];
    const tuples = o.standings.map((s, i) => {
      const b = i * cols.length;
      values.push(
        stageId,
        norm(s.username) || norm(s.display),
        s.display || s.username || "",
        s.rank,
        s.record || null,
        s.points,
        s.omw,
        s.tgw,
        s.ogw,
      );
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
    });
    if (tuples.length) {
      await client.query(
        `INSERT INTO "MplResult" ("stageId","username","player","rank","record","points","omw","tgw","ogw") VALUES ${tuples.join(",")}`,
        values,
      );
      nResults += tuples.length;
    }
  }

  let nSpots = 0;
  for (const c of classified) {
    const { sourceType, store } = classifySource(c.source);
    await client.query(
      `INSERT INTO "MplSpot"
         ("season","ordinal","player","meleeUsername","source","sourceType","store","date","standingsRef","mural")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        SEASON,
        c.ordinal,
        c.player,
        aliases[String(c.ordinal)] ?? null,
        c.source,
        sourceType,
        store,
        c.date ? new Date(c.date) : null,
        c.standingsRef || null,
        c.mural || null,
      ],
    );
    nSpots++;
  }

  await client.query("COMMIT");
  console.log(`seeded season ${SEASON}: ${nStages} stages, ${nResults} results, ${nSpots} spots (${Object.keys(aliases).length} classified↔Opens bridges)`);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
