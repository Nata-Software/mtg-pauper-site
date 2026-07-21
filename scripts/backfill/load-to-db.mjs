/**
 * Backfill the classified 2026 league data into the database.
 *
 * Loads the cached scrape (data/*.json), classifies each decklist, and inserts
 * Decklist + Match rows (with archetype) into DATABASE_URL, replacing the
 * existing 2026 Tuesday/Friday rows. Views only use Match, so scores are
 * defaulted from the result (they aren't displayed); a full re-import via the
 * UI later would add real scores + standings.
 *
 * Run against the DEV BRANCH:  node scripts/backfill/load-to-db.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import "dotenv/config";
import { classifyDeck } from "../../src/lib/archetype/classify.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const matches = JSON.parse(
  fs.readFileSync(path.join(DIR, "data/matches.json")),
);
const decks = JSON.parse(
  fs.readFileSync(path.join(DIR, "data/decklists.json")),
);
const model = JSON.parse(
  fs.readFileSync(path.join(DIR, "../../src/lib/archetype/model.json")),
);

const STORE = "default";

// classify every decklist
const archetypeOf = {};
const deckRows = [];
for (const id in decks) {
  const d = decks[id];
  if (!d.cards?.length) continue;
  const a = classifyDeck(d.cards, d.name, model);
  archetypeOf[id] = a;
  deckRows.push({
    id,
    tournamentId: null,
    player: "",
    rawName: d.name || "",
    archetype: a,
    cards: d.cards,
  });
}
// fill each decklist's player + tournament from the matches that reference it
const tourOf = {},
  playerOf = {};
for (const m of matches) {
  if (m.deckId) {
    tourOf[m.deckId] = String(m.t);
    if (!playerOf[m.deckId]) playerOf[m.deckId] = m.player;
  }
}
for (const r of deckRows) {
  r.tournamentId = tourOf[r.id] ?? null;
  r.player = playerOf[r.id] ?? "";
}

const SCORE = { win: [2, 0], loss: [0, 2], draw: [1, 1] };
function matchRow(m) {
  const [ps, os] = SCORE[m.result] || [1, 1];
  const oppDeck =
    m.opp === "bye" ? "no deck (bye)" : decks[m.oppDeckId]?.name || "";
  return {
    store: STORE,
    eventName: m.day,
    date: m.date + "T00:00:00Z",
    round: m.round,
    player: m.player,
    deck: m.deckName || "",
    decklistId: m.deckId || null,
    archetype: m.deckId ? (archetypeOf[m.deckId] ?? null) : null,
    playerScore: ps,
    result: m.result,
    opponent: m.opp,
    opponentDeck: oppDeck,
    opponentDecklistId: m.oppDeckId || null,
    opponentArchetype: m.oppDeckId ? (archetypeOf[m.oppDeckId] ?? null) : null,
    opponentScore: os,
    tournamentId: String(m.t),
    tournamentName: null,
  };
}

async function insertBatch(client, table, cols, rows, jsonCols = []) {
  const size = 400;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const params = [];
    const tuples = batch.map((row) => {
      const ph = cols.map((c) => {
        params.push(jsonCols.includes(c) ? JSON.stringify(row[c]) : row[c]);
        return jsonCols.includes(c)
          ? `$${params.length}::jsonb`
          : `$${params.length}`;
      });
      return `(${ph.join(",")})`;
    });
    const q = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")}`;
    await client.query(q, params);
  }
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
console.log("host:", process.env.DATABASE_URL.match(/@([^.]+)/)[1]);

// clear existing 2026 Tuesday/Friday league data + any decklists from these tournaments
const del1 = await client.query(
  `DELETE FROM "Match" WHERE store=$1 AND "eventName" IN ('Tuesday','Friday') AND date >= '2026-01-01' AND date <= '2026-12-31'`,
  [STORE],
);
const del2 = await client.query(`DELETE FROM "Decklist"`);
console.log(
  `cleared: ${del1.rowCount} old 2026 league matches, ${del2.rowCount} decklists`,
);

await insertBatch(
  client,
  "Decklist",
  ["id", "tournamentId", "player", "rawName", "archetype", "cards"],
  deckRows,
  ["cards"],
);
console.log(`inserted ${deckRows.length} decklists`);

const mRows = matches.map(matchRow);
await insertBatch(
  client,
  "Match",
  [
    "store",
    "eventName",
    "date",
    "round",
    "player",
    "deck",
    "decklistId",
    "archetype",
    "playerScore",
    "result",
    "opponent",
    "opponentDeck",
    "opponentDecklistId",
    "opponentArchetype",
    "opponentScore",
    "tournamentId",
    "tournamentName",
  ],
  mRows,
);
console.log(`inserted ${mRows.length} matches`);

await client.end();
console.log("done.");
