/**
 * Separate the MPL events that the legacy CSV import mixed into the weekly
 * matchup data.
 *
 *   DATABASE_URL="$PROD" node scripts/split-mpl-events.mjs [--apply]
 *
 * Background: the Google Sheet history recorded the MPL Opens under generic
 * event names ("Saturday", "open sabado"), so 670 Match rows and 121 Standing
 * rows from three Opens have been counted in the site's matchup/metagame/player
 * stats. They are yearly-league games and must not be.
 *
 * The fix moves them to `store = 'mpl'` and gives them a self-describing event
 * name. Every stats query in src/lib/queries.ts already filters `where: {store}`,
 * so a different store excludes them everywhere at once — no per-query filter to
 * forget — while listStores() hides the store from the picker. Nothing is
 * deleted: the rows stay queryable if the MPL page ever wants matchup data.
 *
 * Identified by date + current event name, cross-checked against the melee org
 * listing (the distinct-player counts match melee's participant counts exactly).
 * Idempotent: re-running finds nothing left to move. Dry-run unless --apply.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");

export const MPL_STORE = "mpl";

/**
 * The three 2026 Opens. 2026-02-28 is "open sabado" in Match but "Saturday" in
 * Standing — the two CSV tabs disagree — so both names are accepted per date.
 * 2025 events are deliberately excluded (user's call), as is the 3º Open
 * (Trios, 2026-04-25), which was never imported into the weekly tables.
 */
const STAGES = [
  { date: "2026-02-28", from: ["Saturday", "open sabado"], to: "1º Open MPL" },
  { date: "2026-03-28", from: ["Saturday", "open sabado"], to: "2º Open MPL" },
  { date: "2026-06-20", from: ["Saturday", "open sabado"], to: "5º Open MPL" },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Snapshot exactly the rows we are about to touch, so this is reversible on its
// own terms and not only via the full-DB backup.
const snapshot = { movedAt: new Date().toISOString(), Match: [], Standing: [] };
let total = 0;

for (const s of STAGES) {
  for (const table of ["Match", "Standing"]) {
    const { rows } = await client.query(
      `SELECT * FROM "${table}"
        WHERE store = 'default' AND "eventName" = ANY($1)
          AND to_char(date,'YYYY-MM-DD') = $2`,
      [s.from, s.date],
    );
    snapshot[table].push(...rows);
    total += rows.length;
    if (rows.length)
      console.log(`  ${table.padEnd(8)} ${s.date}  ${String(rows.length).padStart(4)} rows  →  store='${MPL_STORE}', eventName='${s.to}'`);
  }
}

if (total === 0) {
  console.log("nothing to move — already separated ✅");
  await client.end();
  process.exit(0);
}

if (!APPLY) {
  console.log(`\nDRY RUN — ${total} rows would move. Re-run with --apply to write.`);
  await client.end();
  process.exit(0);
}

const outDir = path.join(DIR, "..", "backups");
fs.mkdirSync(outDir, { recursive: true });
const stamp = snapshot.movedAt.replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(outDir, `mpl-split-premigration-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(snapshot));
console.log(`\nsnapshot -> ${path.relative(path.join(DIR, ".."), file)}`);

await client.query("BEGIN");
try {
  let moved = 0;
  for (const s of STAGES) {
    for (const table of ["Match", "Standing"]) {
      const { rowCount } = await client.query(
        `UPDATE "${table}" SET store = $1, "eventName" = $2
          WHERE store = 'default' AND "eventName" = ANY($3)
            AND to_char(date,'YYYY-MM-DD') = $4`,
        [MPL_STORE, s.to, s.from, s.date],
      );
      moved += rowCount;
    }
  }
  await client.query("COMMIT");
  console.log(`moved ${moved} rows out of the weekly data ✅`);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
