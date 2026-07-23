/**
 * Reads scraped tournament dumps straight from disk (data/tournaments/<eventId>.json).
 * Stand-in for the real DB-backed lookup — once tournaments are ingested into
 * Postgres, getEventDecklist should read from there instead and this file goes away.
 */
import { readFile } from "fs/promises";
import path from "path";

export type CardEntry = {
  name: string;
  quantity: number;
};

export type PlayerDecklist = {
  categories: Record<string, CardEntry[]>;
  mainboard: CardEntry[];
  sideboard: CardEntry[];
  id: string;
  url: string;
};

export type TournamentPlayer = {
  player_name: string;
  username: string;
  rank: number;
  points: number;
  match_record: string;
  game_record: string;
  decklist_id: string;
  decklist_name: string;
  decklist: PlayerDecklist;
};

export type TournamentDump = {
  tournament: {
    id: string;
    name: string;
    format: string;
    game: string;
    url: string;
    round_used_for_standings: string;
  };
  players: TournamentPlayer[];
};

const DATA_DIR = path.join(process.cwd(), "data", "tournaments");

/** Guards against path traversal — event ids are only ever digits. */
function isSafeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function getTournamentDump(
  eventId: string,
): Promise<TournamentDump | null> {
  if (!isSafeId(eventId)) return null;

  try {
    const raw = await readFile(
      path.join(DATA_DIR, `${eventId}.json`),
      "utf-8",
    );
    return JSON.parse(raw) as TournamentDump;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function getEventDecklist(
  eventId: string,
  deckId: string,
): Promise<{ tournament: TournamentDump["tournament"]; player: TournamentPlayer } | null> {
  const dump = await getTournamentDump(eventId);
  if (!dump) return null;

  const player = dump.players.find((p) => p.decklist_id === deckId);
  if (!player) return null;

  return { tournament: dump.tournament, player };
}
