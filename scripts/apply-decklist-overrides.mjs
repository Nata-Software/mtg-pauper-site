/**
 * Apply player-confirmed decks for events where melee has no decklist.
 *
 *   DATABASE_URL="$PROD" node scripts/apply-decklist-overrides.mjs [--apply]
 *
 * Some players finish an event with no list attached on melee — not in the
 * match records and not in the standings — so there is nothing to recover and
 * their games would otherwise count as "Unknown Deck", dropping them out of the
 * archetype statistics. scripts/decklist-overrides.json records what the player
 * says they played.
 *
 * Only `deck` and `archetype` are set, never `decklistId`: pointing at a list
 * registered for a *different* tournament would make the deck page show the
 * wrong event for that row, and inventing an id would break the melee link.
 * Statistics key off the archetype, which is what this restores.
 *
 * NOT self-healing: importing a tournament replaces its rows, so re-run this
 * afterwards. Dry-run by default.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const { overrides } = JSON.parse(
  fs.readFileSync(path.join(DIR, "decklist-overrides.json"), "utf8"),
);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let touched = 0;

for (const o of overrides) {
  const { rows } = await client.query(
    `SELECT
       (SELECT count(*)::int FROM "Match"
         WHERE store='default' AND "tournamentId"=$1 AND lower(player)=lower($2)) own,
       (SELECT count(*)::int FROM "Match"
         WHERE store='default' AND "tournamentId"=$1 AND lower(opponent)=lower($2)) opp,
       (SELECT count(*)::int FROM "Standing"
         WHERE store='default' AND "tournamentId"=$1 AND lower(nickname)=lower($2)) st`,
    [o.tournamentId, o.player],
  );
  const { own, opp, st } = rows[0];
  console.log(
    `${o.player} @ ${o.event}: ${own} own rows, ${opp} opponent refs, ${st} standing -> "${o.archetype}"`,
  );
  touched += own + opp + st;

  if (!APPLY) continue;

  await client.query(
    `UPDATE "Match" SET deck=$3, archetype=$4
      WHERE store='default' AND "tournamentId"=$1 AND lower(player)=lower($2)
        AND "decklistId" IS NULL`,
    [o.tournamentId, o.player, o.deck, o.archetype],
  );
  await client.query(
    `UPDATE "Match" SET "opponentDeck"=$3, "opponentArchetype"=$4
      WHERE store='default' AND "tournamentId"=$1 AND lower(opponent)=lower($2)
        AND "opponentDecklistId" IS NULL`,
    [o.tournamentId, o.player, o.deck, o.archetype],
  );
  await client.query(
    `UPDATE "Standing" SET deck=$3, archetype=$4
      WHERE store='default' AND "tournamentId"=$1 AND lower(nickname)=lower($2)
        AND (archetype IS NULL OR archetype='')`,
    [o.tournamentId, o.player, o.deck, o.archetype],
  );
}

console.log(
  APPLY ? `\napplied to ${touched} rows ✅` : `\nDRY RUN — ${touched} rows would change. Re-run with --apply.`,
);
await client.end();
