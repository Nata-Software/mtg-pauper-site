/**
 * Fill in Match rows whose decklist reference is missing.
 *
 *   DATABASE_URL="$PROD" node scripts/backfill-match-decklists.mjs [--apply]
 *
 * A player plays one deck per tournament, but melee does not always attach it
 * to every match record — one event carried a decklist on 107 of 123 competitor
 * entries. That left the same player showing their deck in some rounds and
 * nothing in others, so per-tournament views could pick the empty row and
 * render "Unknown Deck" for a player who did register a list.
 *
 * The scraper now fills these at import time (src/lib/melee.ts); this repairs
 * rows imported before that. It only copies from a Decklist row that already
 * exists for the same tournament and player, so nothing is invented: a player
 * who genuinely registered no list stays unknown.
 *
 * Dry-run by default.
 */
import pg from "pg";
import "dotenv/config";

const APPLY = process.argv.includes("--apply");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const preview = await client.query(`
  SELECT m.player, m."tournamentId", m."tournamentName",
         to_char(max(m.date),'YYYY-MM-DD') date,
         count(*)::int rows, d."rawName", d.archetype
    FROM "Match" m
    JOIN "Decklist" d
      ON d."tournamentId" = m."tournamentId"
     AND lower(d.player) = lower(m.player)
   WHERE m.store = 'default' AND m."decklistId" IS NULL
   GROUP BY m.player, m."tournamentId", m."tournamentName", d."rawName", d.archetype
   ORDER BY date DESC`);

console.log(`player-events to repair: ${preview.rows.length}`);
console.table(preview.rows.slice(0, 12));

const oppCount = (
  await client.query(`
    SELECT count(*)::int n FROM "Match" m
     WHERE m.store='default' AND m."opponentDecklistId" IS NULL
       AND EXISTS (SELECT 1 FROM "Decklist" d
                    WHERE d."tournamentId" = m."tournamentId"
                      AND lower(d.player) = lower(m.opponent))`)
).rows[0].n;
console.log(`opponent-side references to repair: ${oppCount}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.");
  await client.end();
  process.exit(0);
}

await client.query("BEGIN");
try {
  const own = await client.query(`
    UPDATE "Match" m
       SET "decklistId" = d.id, deck = d."rawName", archetype = d.archetype
      FROM "Decklist" d
     WHERE m.store = 'default' AND m."decklistId" IS NULL
       AND d."tournamentId" = m."tournamentId"
       AND lower(d.player) = lower(m.player)`);

  // The mirrored row for the same match carries the opponent's copy.
  const opp = await client.query(`
    UPDATE "Match" m
       SET "opponentDecklistId" = d.id,
           "opponentDeck" = d."rawName",
           "opponentArchetype" = d.archetype
      FROM "Decklist" d
     WHERE m.store = 'default' AND m."opponentDecklistId" IS NULL
       AND d."tournamentId" = m."tournamentId"
       AND lower(d.player) = lower(m.opponent)`);

  // Standings share the problem and the same fix.
  const st = await client.query(`
    UPDATE "Standing" s
       SET archetype = d.archetype, deck = d."rawName"
      FROM "Decklist" d
     WHERE s.store = 'default' AND (s.archetype IS NULL OR s.archetype = '')
       AND d."tournamentId" = s."tournamentId"
       AND lower(d.player) = lower(s.nickname)`);

  await client.query("COMMIT");
  console.log(`repaired ${own.rowCount} own rows, ${opp.rowCount} opponent refs, ${st.rowCount} standings ✅`);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  await client.end();
}
