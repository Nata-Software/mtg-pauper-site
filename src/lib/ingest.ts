import Papa from "papaparse";
import { buildDateResolver } from "./dates";
import type { ScrapedMatch, ScrapedStanding } from "./melee";
import { prisma } from "./prisma";

export type MatchInput = {
  eventName: string;
  date: Date | null;
  round: number;
  player: string;
  deck: string;
  playerScore: number;
  result: string;
  opponent: string;
  opponentDeck: string;
  opponentScore: number;
};

export type StandingInput = {
  eventName: string;
  date: Date | null;
  nickname: string;
  fullName: string;
  points: number;
  position: number;
  deck: string;
};

/** Parse a CSV string into row objects keyed by normalized (lowercase/trim) headers. */
function parseRows(csv: string): Record<string, string>[] {
  const out = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  return out.data ?? [];
}

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** Rounds tab: date, round, player_1, deck_player_1, points_player_1, result, player_2, deck_player_2, points_player_2, event_name */
export function parseRoundsCsv(csv: string): MatchInput[] {
  const rows = parseRows(csv);
  const resolveDate = buildDateResolver(rows.map((r) => r["date"]));
  const matches: MatchInput[] = [];
  for (const r of rows) {
    const player = str(r["player_1"]);
    if (!player) continue; // only skip rows with no player (aux/blank rows)
    // Keep matches even when the deck wasn't recorded: the player still played,
    // so it must count for player analysis. Deck-based views ignore blanks.
    const deck = str(r["deck_player_1"]);
    matches.push({
      eventName: str(r["event_name"]),
      date: resolveDate(r["date"]),
      round: num(r["round"]),
      player,
      deck,
      playerScore: num(r["points_player_1"]),
      result: str(r["result"]) || "draw",
      opponent: str(r["player_2"]) || "bye",
      opponentDeck: str(r["deck_player_2"]) || "no deck (bye)",
      opponentScore: num(r["points_player_2"]),
    });
  }
  return matches;
}

/** Ranking tab: nick_name, full_name, points, position, deck, date, event_name */
export function parseRankingCsv(csv: string): StandingInput[] {
  const rows = parseRows(csv);
  const resolveDate = buildDateResolver(rows.map((r) => r["date"]));
  const standings: StandingInput[] = [];
  for (const r of rows) {
    const nickname = str(r["nick_name"] ?? r["nickname"]);
    if (!nickname) continue;
    standings.push({
      eventName: str(r["event_name"]),
      date: resolveDate(r["date"]),
      nickname,
      fullName: str(r["full_name"]) || nickname,
      points: num(r["points"]),
      position: num(r["position"]),
      deck: str(r["deck"]),
    });
  }
  return standings;
}

async function chunkedCreate<T>(
  items: T[],
  create: (chunk: T[]) => Promise<unknown>,
  size = 500,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await create(items.slice(i, i + size));
  }
}

/**
 * Replace data for a store with an uploaded full dump.
 * The sheet export is the entire history, so a full replace is the correct,
 * idempotent semantic. Only the categories actually provided are touched, so
 * uploading just Rounds won't wipe existing Standings (and vice versa).
 */
export async function replaceStoreData(opts: {
  store: string;
  matches?: MatchInput[] | null;
  standings?: StandingInput[] | null;
}): Promise<{ matches: number; standings: number }> {
  const { store, matches, standings } = opts;

  if (matches) {
    await prisma.match.deleteMany({ where: { store } });
    await chunkedCreate(matches, (chunk) =>
      prisma.match.createMany({ data: chunk.map((m) => ({ ...m, store })) }),
    );
  }

  if (standings) {
    await prisma.standing.deleteMany({ where: { store } });
    await chunkedCreate(standings, (chunk) =>
      prisma.standing.createMany({ data: chunk.map((s) => ({ ...s, store })) }),
    );
  }

  return { matches: matches?.length ?? 0, standings: standings?.length ?? 0 };
}

/**
 * Add one scraped melee tournament to a store, tagged with the chosen event
 * (e.g. "Tuesday"). Re-importing the same tournament replaces just its rows,
 * so it's idempotent and never touches other tournaments' data.
 */
export async function addTournamentData(opts: {
  store: string;
  event: string;
  tournamentId: string;
  tournamentName: string;
  date: Date | null;
  matches: ScrapedMatch[];
  standings: ScrapedStanding[];
}): Promise<{ matches: number; standings: number }> {
  const { store, event, tournamentId, tournamentName, date, matches, standings } =
    opts;

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { store, tournamentId } }),
    prisma.standing.deleteMany({ where: { store, tournamentId } }),
  ]);

  await chunkedCreate(matches, (chunk) =>
    prisma.match.createMany({
      data: chunk.map((m) => ({
        store,
        eventName: event,
        date,
        round: m.round,
        player: m.player,
        deck: m.deck,
        playerScore: m.playerScore,
        result: m.result,
        opponent: m.opponent,
        opponentDeck: m.opponentDeck,
        opponentScore: m.opponentScore,
        tournamentId,
        tournamentName,
      })),
    }),
  );

  await chunkedCreate(standings, (chunk) =>
    prisma.standing.createMany({
      data: chunk.map((s) => ({
        store,
        eventName: event,
        date,
        nickname: s.nickname,
        fullName: s.fullName,
        points: s.points,
        position: s.position,
        deck: s.deck,
        tournamentId,
        tournamentName,
      })),
    }),
  );

  return { matches: matches.length, standings: standings.length };
}
