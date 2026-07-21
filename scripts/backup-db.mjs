/**
 * Read-only logical backup of the Postgres DB to a timestamped JSON file under
 * backups/ (gitignored). Restore by inserting the rows back.
 *
 * Run:  node scripts/backup-db.mjs
 * Uses DATABASE_URL from .env.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "..", "backups");
fs.mkdirSync(OUT, { recursive: true });

const TABLES = ["Match", "Standing"]; // RateLimit is transient, skip

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const dump = { exportedAt: new Date().toISOString(), tables: {} };
for (const t of TABLES) {
  const { rows } = await client.query(`SELECT * FROM "${t}"`);
  dump.tables[t] = rows;
  console.log(`  ${t}: ${rows.length} rows`);
}
await client.end();

const stamp = dump.exportedAt.replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(OUT, `db-backup-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(dump));
console.log(
  `\nbackup written: ${path.relative(path.join(DIR, ".."), file)} (${(fs.statSync(file).size / 1e6).toFixed(2)} MB)`,
);
