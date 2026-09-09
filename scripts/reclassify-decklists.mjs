/**
 * Re-run the classifier over every stored decklist and propagate the result.
 *
 *   DATABASE_URL="$PROD" node scripts/reclassify-decklists.mjs [--apply]
 *
 * Archetypes are *stored* (Decklist.archetype, Match.archetype /
 * Match.opponentArchetype, Standing.archetype), so changing the rules in
 * src/lib/archetype/classify.mjs only affects future imports — existing rows
 * need this migration. The cards are the source of truth, so nothing is
 * re-scraped.
 *
 * Also repairs HTML-escaped card names ("Pirate&#39;s Pillage") stored before
 * melee.ts decoded them; escaped names break Scryfall art lookups and any
 * classifier rule matching a name with an apostrophe.
 *
 * Dry-run by default: prints the full before/after breakdown and writes
 * nothing. Pass --apply to commit, which snapshots the affected rows first.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";
import { classifyDeck } from "../src/lib/archetype/classify.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const model = JSON.parse(
  fs.readFileSync(path.join(DIR, "../src/lib/archetype/model.json"), "utf8"),
);

/** Mirror of decodeEntities() in src/lib/melee.ts. */
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

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  `SELECT id, player, "rawName", archetype, cards FROM "Decklist"`,
);

const changes = [];
const nameFixes = [];
for (const r of rows) {
  const cards = r.cards.map((c) => {
    const name = decodeEntities(c.name);
    if (name !== c.name) nameFixes.push(r.id);
    return { ...c, name };
  });
  const after = classifyDeck(cards, r.rawName, model);
  const cardsChanged = JSON.stringify(cards) !== JSON.stringify(r.cards);
  if (after !== r.archetype || cardsChanged)
    changes.push({
      id: r.id,
      player: r.player,
      rawName: r.rawName,
      before: r.archetype,
      after,
      cards,
      cardsChanged,
      archetypeChanged: after !== r.archetype,
    });
}

const reclass = changes.filter((c) => c.archetypeChanged);
console.log(`decklists: ${rows.length}`);
console.log(`archetype changes: ${reclass.length}`);
console.log(`decklists with escaped card names to repair: ${new Set(nameFixes).size}`);

const byPair = new Map();
for (const c of reclass) {
  const k = `${c.before}  ->  ${c.after}`;
  byPair.set(k, (byPair.get(k) || 0) + 1);
}
console.table(
  [...byPair.entries()]
    .map(([change, decks]) => ({ change, decks }))
    .sort((a, b) => b.decks - a.decks),
);

// How many Match/Standing rows ride along with those decklists.
const ids = reclass.map((c) => c.id);
let matchRows = 0;
let standingRows = 0;
if (ids.length) {
  matchRows = (
    await client.query(
      `SELECT count(*)::int n FROM "Match" WHERE "decklistId" = ANY($1) OR "opponentDecklistId" = ANY($1)`,
      [ids],
    )
  ).rows[0].n;
  standingRows = (
    await client.query(
      `SELECT count(*)::int n FROM "Standing" s
        WHERE EXISTS (SELECT 1 FROM "Decklist" d
                       WHERE d.id = ANY($1) AND d."tournamentId" = s."tournamentId"
                         AND lower(d.player) = lower(s.nickname))`,
      [ids],
    )
  ).rows[0].n;
}
console.log(`Match rows referencing them: ${matchRows}`);
console.log(`Standing rows referencing them: ${standingRows}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.");
  await client.end();
  process.exit(0);
}

if (changes.length === 0) {
  console.log("nothing to do ✅");
  await client.end();
  process.exit(0);
}

// Snapshot every row this touches, so the change is reversible on its own.
const snap = { at: new Date().toISOString(), Decklist: [], Match: [], Standing: [] };
snap.Decklist = (
  await client.query(`SELECT * FROM "Decklist" WHERE id = ANY($1)`, [
    changes.map((c) => c.id),
  ])
).rows;
if (ids.length) {
  snap.Match = (
    await client.query(
      `SELECT * FROM "Match" WHERE "decklistId" = ANY($1) OR "opponentDecklistId" = ANY($1)`,
      [ids],
    )
  ).rows;
  snap.Standing = (
    await client.query(
      `SELECT * FROM "Standing" s
        WHERE EXISTS (SELECT 1 FROM "Decklist" d
                       WHERE d.id = ANY($1) AND d."tournamentId" = s."tournamentId"
                         AND lower(d.player) = lower(s.nickname))`,
      [ids],
    )
  ).rows;
}
const outDir = path.join(DIR, "..", "backups");
fs.mkdirSync(outDir, { recursive: true });
const stamp = snap.at.replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(outDir, `reclassify-premigration-${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(snap));
console.log(`\nsnapshot -> ${path.relative(path.join(DIR, ".."), file)}`);

await client.query("BEGIN");
try {
  for (const c of changes) {
    await client.query(
      `UPDATE "Decklist" SET archetype = $1, cards = $2 WHERE id = $3`,
      [c.after, JSON.stringify(c.cards), c.id],
    );
    if (!c.archetypeChanged) continue;

    await client.query(
      `UPDATE "Match" SET archetype = $1 WHERE "decklistId" = $2`,
      [c.after, c.id],
    );
    await client.query(
      `UPDATE "Match" SET "opponentArchetype" = $1 WHERE "opponentDecklistId" = $2`,
      [c.after, c.id],
    );
    // Standing has no decklistId — join it the way the importer pairs them.
    await client.query(
      `UPDATE "Standing" s SET archetype = $1
         FROM "Decklist" d
        WHERE d.id = $2 AND d."tournamentId" = s."tournamentId"
          AND lower(d.player) = lower(s.nickname)`,
      [c.after, c.id],
    );
  }
  await client.query("COMMIT");
  console.log(
    `applied: ${changes.length} decklists updated (${reclass.length} re-classified) ✅`,
  );
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
