/**
 * Re-scrape stored decklists to record which board each card was in.
 *
 *   DATABASE_URL="$PROD" node scripts/backfill-decklist-boards.mjs [--apply] [--limit N]
 *
 * Decklist.cards was stored as a flat list, so maindeck and sideboard copies of
 * the same card were indistinguishable (and a card in both appeared twice). The
 * scraper now tags each card with `board` from melee's category headings; this
 * backfills rows scraped before that.
 *
 * Only rows missing `board` are fetched, so it can be re-run and resumed. A
 * decklist that no longer loads keeps its existing cards rather than being
 * blanked — a 404 must not destroy data.
 *
 * Dry-run by default; --apply writes and snapshots first.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const POOL = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- mirrors parseDecklistHtml() + decodeEntities() in src/lib/melee.ts ---
const decodeEntities = (s) =>
  String(s ?? "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

function parseDecklistHtml(html) {
  const cardRe =
    /<span class="decklist-record-quantity">(\d+)<\/span>\s*<a class="decklist-record-name" href="\/Card\/View\/([^?"]+)[^"]*">([^<]+)<\/a>/g;
  const catRe = /<div class="decklist-category-title"[^>]*>([\s\S]*?)<\/div>/g;
  const marks = [...html.matchAll(catRe)].map((m) => ({
    title: m[1].replace(/<[^>]+>/g, "").replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim(),
    idx: m.index ?? 0,
  }));
  return [...html.matchAll(cardRe)].map((m) => {
    const at = m.index ?? 0;
    let category = "";
    for (const mk of marks) {
      if (mk.idx < at) category = mk.title;
      else break;
    }
    return {
      qty: Number(m[1]),
      slug: m[2],
      name: decodeEntities(m[3]),
      board: /sideboard/i.test(category) ? "side" : "main",
      category,
    };
  });
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`SELECT id, cards FROM "Decklist"`);
const todo = rows
  .filter((r) => !r.cards.some((c) => c.board))
  .slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`decklists: ${rows.length} | missing board tags: ${todo.length}`);

if (todo.length === 0) {
  console.log("nothing to do ✅");
  await client.end();
  process.exit(0);
}

const results = new Map();
const failed = [];
let done = 0;
for (let i = 0; i < todo.length; i += POOL) {
  const batch = todo.slice(i, i + POOL);
  await Promise.all(
    batch.map(async (r) => {
      try {
        const res = await fetch(`https://melee.gg/Decklist/View/${r.id}`, {
          headers: { "user-agent": UA },
        });
        if (res.status !== 200) return failed.push({ id: r.id, why: `HTTP ${res.status}` });
        const cards = parseDecklistHtml(await res.text());
        if (cards.length === 0) return failed.push({ id: r.id, why: "no cards parsed" });
        results.set(r.id, cards);
      } catch (e) {
        failed.push({ id: r.id, why: e.message });
      }
    }),
  );
  done += batch.length;
  if (done % 100 < POOL) console.log(`  ${done}/${todo.length}…`);
  await sleep(200);
}

// Sanity: how do the re-scrapes split?
let clean60 = 0;
let noSide = 0;
for (const cards of results.values()) {
  const main = cards.filter((c) => c.board === "main").reduce((n, c) => n + c.qty, 0);
  const side = cards.filter((c) => c.board === "side").reduce((n, c) => n + c.qty, 0);
  if (main === 60 && side === 15) clean60++;
  if (side === 0) noSide++;
}
console.log(`\nre-scraped: ${results.size} | failed: ${failed.length}`);
console.log(`  exactly 60 main / 15 side: ${clean60}`);
console.log(`  no sideboard registered:   ${noSide}`);
if (failed.length) console.log("  failures:", failed.slice(0, 10));

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.");
  await client.end();
  process.exit(0);
}

const outDir = path.join(DIR, "..", "backups");
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(outDir, `decklist-boards-premigration-${stamp}.json`);
fs.writeFileSync(
  file,
  JSON.stringify(rows.filter((r) => results.has(r.id))),
);
console.log(`\nsnapshot -> ${path.relative(path.join(DIR, ".."), file)}`);

await client.query("BEGIN");
try {
  let n = 0;
  for (const [id, cards] of results) {
    await client.query(`UPDATE "Decklist" SET cards = $1 WHERE id = $2`, [
      JSON.stringify(cards),
      id,
    ]);
    n++;
  }
  await client.query("COMMIT");
  console.log(`updated ${n} decklists ✅ (${failed.length} left untouched)`);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
