/**
 * Add classified players from the store's spreadsheet export.
 *
 *   DATABASE_URL="$PROD" node scripts/import-classified-sheet.mjs <rows.json> [--apply]
 *
 * ADDITIVE on purpose. seed-mpl.mjs deletes the season's spots and rebuilds
 * them from classified.json, which now destroys the stage links and anything
 * added through /admin/mpl — the same trap that made it stop owning stages.
 * This only inserts players who aren't already recorded, matched by name.
 *
 * Spots sourced from a numbered Open ("8º Open MPL - Mont") are linked to that
 * stage, and bridged to a melee username only on an exact name match inside
 * that Open's standings. Nothing is guessed: fuzzy matching previously proposed
 * "Tim" -> tatimi1 and put Felipe Darbello on his namesake's account.
 */
import fs from "node:fs";
import pg from "pg";
import "dotenv/config";

const [, , rowsPath] = process.argv;
const APPLY = process.argv.includes("--apply");
if (!rowsPath) {
  console.error("usage: import-classified-sheet.mjs <rows.json> [--apply]");
  process.exit(1);
}

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Mirror of classifySource() in src/lib/mpl/normalize.ts. */
function classifySource(source) {
  const s = String(source).trim();
  const lower = s.toLowerCase();
  if (/last\s*chance/.test(lower)) return { sourceType: "last_chance", store: null };
  if (/\bopen\b|super pauper|pauper 50k/.test(lower))
    return { sourceType: "open", store: "Mont" };
  if (/ranking paralelo/.test(lower)) return { sourceType: "parallel_mont", store: "Mont" };
  return { sourceType: "partner_store", store: s.split(" - ")[0].trim() || null };
}

/**
 * Which Open a source names, when it names one unambiguously.
 * Only the "<n>º Open" form and the main 50K are linked — "Super Pauper 35k"
 * disagrees with the stage's own name (30K), and the 50K Side Event is its own
 * thing, so both are left unlinked rather than guessed into the wrong stage.
 */
function stageOrdinalFor(source) {
  const s = String(source).trim();
  const m = s.match(/^(\d{1,2})\s*[ºo°ª]\s*Open/i);
  if (m) return Number(m[1]);
  if (/^pauper 50k\s*-\s*mont$/i.test(s)) return 9;
  return null;
}

const rows = JSON.parse(fs.readFileSync(rowsPath, "utf8"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const season = 2026;
const { rows: existing } = await client.query(
  `SELECT player FROM "MplSpot" WHERE season = $1`,
  [season],
);
const have = new Set(existing.map((r) => norm(r.player)));

const { rows: stages } = await client.query(
  `SELECT id, ordinal, name FROM "MplStage" WHERE season = $1`,
  [season],
);
const stageByOrdinal = new Map(stages.map((s) => [s.ordinal, s]));

const { rows: results } = await client.query(
  `SELECT r."stageId", r.username, r.player FROM "MplResult" r
     JOIN "MplStage" s ON s.id = r."stageId" WHERE s.season = $1`,
  [season],
);
const resultsByStage = new Map();
for (const r of results) {
  if (!resultsByStage.has(r.stageId)) resultsByStage.set(r.stageId, []);
  resultsByStage.get(r.stageId).push(r);
}

const { rows: maxRow } = await client.query(
  `SELECT COALESCE(max(ordinal), 0) AS m FROM "MplSpot" WHERE season = $1`,
  [season],
);
let ordinal = Number(maxRow[0].m) + 1;

const toAdd = [];
for (const r of rows) {
  if (have.has(norm(r.player))) continue;
  const { sourceType, store } = classifySource(r.source);
  const stageOrd = stageOrdinalFor(r.source);
  const stage = stageOrd != null ? stageByOrdinal.get(stageOrd) : null;

  let meleeUsername = null;
  if (stage) {
    const hit = (resultsByStage.get(stage.id) ?? []).find(
      (x) => norm(x.player) === norm(r.player),
    );
    if (hit) meleeUsername = hit.username;
  }

  toAdd.push({
    ordinal: ordinal++,
    player: r.player,
    source: r.source,
    sourceType,
    store,
    date: r.date,
    standingsRef: r.standingsRef,
    mural: r.mural,
    stageId: stage?.id ?? null,
    stageName: stage?.name ?? null,
    meleeUsername,
  });
}

console.log(`sheet rows: ${rows.length} | already recorded: ${rows.length - toAdd.length} | to add: ${toAdd.length}`);
console.table(
  toAdd.map((r) => ({
    "#": r.ordinal,
    player: r.player.slice(0, 32),
    source: r.source.slice(0, 34),
    stage: r.stageName ? r.stageName.slice(0, 22) : "—",
    melee: r.meleeUsername ?? "—",
  })),
);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.");
  await client.end();
  process.exit(0);
}

await client.query("BEGIN");
try {
  for (const r of toAdd) {
    await client.query(
      `INSERT INTO "MplSpot"
         ("season","ordinal","player","meleeUsername","stageId","source","sourceType","store","date","standingsRef","mural")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        season, r.ordinal, r.player, r.meleeUsername, r.stageId, r.source,
        r.sourceType, r.store, r.date ? new Date(`${r.date}T12:00:00.000Z`) : null,
        r.standingsRef, r.mural,
      ],
    );
  }
  await client.query("COMMIT");
  console.log(`\nadded ${toAdd.length} spots ✅`);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
