import { prisma } from "./prisma";
import { toISODate } from "./dates";
import type { MatchRow } from "./stats";

export type Filters = {
  store: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
  event?: string;
};

function dateWhere(from?: string, to?: string) {
  const date: { gte?: Date; lte?: Date } = {};

  if (from) date.gte = new Date(from + "T00:00:00.000Z");
  if (to) date.lte = new Date(to + "T23:59:59.999Z");

  return Object.keys(date).length ? date : undefined;
}

/** Distinct stores that have any data. */
export async function listStores(): Promise<string[]> {
  const [m, s] = await Promise.all([
    prisma.match.findMany({
      distinct: ["store"],
      select: { store: true },
    }),
    prisma.standing.findMany({
      distinct: ["store"],
      select: { store: true },
    }),
  ]);

  const set = new Set([...m, ...s].map((r) => r.store));

  return [...set].sort();
}

/** Distinct event names for a store. */
export async function listEvents(store: string): Promise<string[]> {
  const rows = await prisma.match.findMany({
    where: { store },
    distinct: ["eventName"],
    select: { eventName: true },
  });

  return rows.map((r) => r.eventName).filter(Boolean).sort();
}

/** Min/max match dates for a store (for default filter bounds). */
export async function dateBounds(
  store: string,
): Promise<{ min: string; max: string }> {
  const [min, max] = await Promise.all([
    prisma.match.findFirst({
      where: { store, date: { not: null } },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.match.findFirst({
      where: { store, date: { not: null } },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);

  return { min: toISODate(min?.date), max: toISODate(max?.date) };
}

/** The card-based archetype when present, else the player-typed deck name.
 * Strips the "rogue:" prefix used internally by the classifier. */
function effectiveDeck(archetype: string | null, deck: string): string {
  return (archetype ?? deck).replace(/^rogue:\s*/i, "");
}

export async function getMatchRows(f: Filters): Promise<MatchRow[]> {
  const rows = await prisma.match.findMany({
    where: {
      store: f.store,
      ...(f.event ? { eventName: f.event } : {}),
      ...(dateWhere(f.from, f.to) ? { date: dateWhere(f.from, f.to) } : {}),
    },
    select: {
      deck: true,
      archetype: true,
      opponentDeck: true,
      opponentArchetype: true,
      result: true,
    },
  });

  return rows.map((r) => ({
    deck: effectiveDeck(r.archetype, r.deck),
    opponentDeck: effectiveDeck(r.opponentArchetype, r.opponentDeck),
    result: r.result,
  }));
}

export type StandingRow = {
  position: number;
  nickname: string;
  fullName: string;
  deck: string;
  points: number;
  eventName: string;
  date: Date | null;
};

export async function getStandings(f: Filters): Promise<StandingRow[]> {
  return prisma.standing.findMany({
    where: {
      store: f.store,
      ...(f.event ? { eventName: f.event } : {}),
      ...(dateWhere(f.from, f.to) ? { date: dateWhere(f.from, f.to) } : {}),
    },
    orderBy: [{ date: "desc" }, { position: "asc" }],
    select: {
      position: true,
      nickname: true,
      fullName: true,
      deck: true,
      points: true,
      eventName: true,
      date: true,
    },
    take: 2000,
  });
}

export type PlayerMatchRow = {
  player: string;
  result: string;
  opponent: string;
  opponentDeck: string;
};

/** Rows for per-player win/loss/draw analysis in a scope. */
export async function getPlayerRows(f: Filters): Promise<PlayerMatchRow[]> {
  return prisma.match.findMany({
    where: {
      store: f.store,
      ...(f.event ? { eventName: f.event } : {}),
      ...(dateWhere(f.from, f.to) ? { date: dateWhere(f.from, f.to) } : {}),
    },
    select: {
      player: true,
      result: true,
      opponent: true,
      opponentDeck: true,
    },
  });
}

function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

/** Distinct "YYYY-MM" months that have matches for an event, newest first. */
export async function listMonths(
  store: string,
  event: string,
): Promise<string[]> {
  const rows = await prisma.match.findMany({
    where: { store, eventName: event, date: { not: null } },
    distinct: ["date"],
    select: { date: true },
  });

  const set = new Set<string>();

  for (const r of rows) {
    if (r.date) set.add(ym(r.date));
  }

  return [...set].sort().reverse();
}

/** from/to ISO bounds + label for a "YYYY-MM" month string. */
export function monthRange(yyyymm: string): {
  from: string;
  to: string;
  label: string;
} {
  const [y, m] = yyyymm.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 0));
  const label = from.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return { from: toISODate(from), to: toISODate(to), label };
}

/** One player's matches (deck they piloted + result) in a scope. */
export async function getPlayerDeckRows(opts: {
  store: string;
  player: string;
  from?: string;
  to?: string;
  event?: string;
}): Promise<{ deck: string; result: string }[]> {
  const rows = await prisma.match.findMany({
    where: {
      store: opts.store,
      player: opts.player,
      ...(opts.event ? { eventName: opts.event } : {}),
      ...(dateWhere(opts.from, opts.to)
        ? { date: dateWhere(opts.from, opts.to) }
        : {}),
    },
    select: { deck: true, archetype: true, result: true },
  });
  return rows.map((r) => ({
    deck: effectiveDeck(r.archetype, r.deck),
    result: r.result,
  }));
}

/** The calendar month (from/to + label) of the most recent match with a date. */
export async function latestDataMonth(
  store: string,
): Promise<{ from: string; to: string; label: string } | null> {
  const max = await prisma.match.findFirst({
    where: { store, date: { not: null } },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  if (!max?.date) return null;

  const y = max.date.getUTCFullYear();
  const m = max.date.getUTCMonth(); // 0-based
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));
  const label = from.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return { from: toISODate(from), to: toISODate(to), label };
}

export type TournamentWinRow = {
  tournamentKey: string;
  tournamentName: string;
  date: string;
  player: string;
  archetype: string;
  playerCount: number;
};

export type ArchetypeTournamentWinRow = {
  archetype: string;
  wins: number;
};

export type PlayerTournamentWinRow = {
  player: string;
  wins: number;
};

export type TournamentData = {
  uniqueTournaments: number;
  uniquePlayers: number;
  uniqueArchetypes: number;
  matchesPlayed: number;
  tournamentWins: TournamentWinRow[];
  archetypeWins: ArchetypeTournamentWinRow[];
  playerWins: PlayerTournamentWinRow[];
};

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isRealArchetype(value: string | null | undefined): boolean {
  const deck = normalizeName(value);

  return deck !== "" && deck !== "bye" && deck !== "no deck (bye)";
}

function tournamentKey(row: {
  tournamentId: string | null;
  eventName: string;
  date: Date | null;
}): string {
  if (row.tournamentId) {
    return `id:${row.tournamentId}`;
  }

  return `fallback:${row.eventName}:${toISODate(row.date) || "no-date"}`;
}

function fallbackTournamentName(row: {
  tournamentName: string | null;
  eventName: string;
  date: Date | null;
}): string {
  if (row.tournamentName?.trim()) {
    return row.tournamentName.trim();
  }

  const date = toISODate(row.date);

  if (row.eventName && date) {
    return `${row.eventName} — ${date}`;
  }

  if (row.eventName) {
    return row.eventName;
  }

  return "Unknown tournament";
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Aggregated tournament-level dashboard data.
 *
 * Melee imports are grouped by tournamentId.
 * CSV history has no tournamentId, so it is grouped by event + date.
 */
export async function getTournamentData(store: string): Promise<TournamentData> {
  const [standings, matches] = await Promise.all([
    prisma.standing.findMany({
      where: { store },
      orderBy: [{ date: "desc" }, { position: "asc" }],
      select: {
        tournamentId: true,
        tournamentName: true,
        eventName: true,
        date: true,
        nickname: true,
        deck: true,
        position: true,
      },
    }),
    prisma.match.findMany({
      where: { store },
      select: {
        tournamentId: true,
        tournamentName: true,
        eventName: true,
        date: true,
        player: true,
        deck: true,
      },
    }),
  ]);

  const uniquePlayers = new Set<string>();
  const uniqueArchetypes = new Set<string>();
  const tournamentKeys = new Set<string>();

  type StandingGroup = {
    tournamentName: string;
    date: string;
    players: Set<string>;
    winner?: {
      position: number;
      player: string;
      archetype: string;
    };
  };

  type MatchGroup = {
    tournamentName: string;
    date: string;
    players: Set<string>;
    matchRows: number;
  };

  const standingGroups = new Map<string, StandingGroup>();
  const matchGroups = new Map<string, MatchGroup>();

  for (const row of standings) {
    const key = tournamentKey(row);
    const player = normalizeName(row.nickname);
    const archetype = normalizeName(row.deck);

    tournamentKeys.add(key);

    if (player) uniquePlayers.add(player);
    if (isRealArchetype(archetype)) uniqueArchetypes.add(archetype);

    let group = standingGroups.get(key);

    if (!group) {
      group = {
        tournamentName: fallbackTournamentName(row),
        date: toISODate(row.date),
        players: new Set<string>(),
      };

      standingGroups.set(key, group);
    }

    if (player) group.players.add(player);

    if (
      player &&
      (!group.winner || row.position < group.winner.position)
    ) {
      group.winner = {
        position: row.position,
        player,
        archetype,
      };
    }
  }

  for (const row of matches) {
    const key = tournamentKey(row);
    const player = normalizeName(row.player);
    const archetype = normalizeName(row.deck);

    tournamentKeys.add(key);

    if (player) uniquePlayers.add(player);
    if (isRealArchetype(archetype)) uniqueArchetypes.add(archetype);

    let group = matchGroups.get(key);

    if (!group) {
      group = {
        tournamentName: fallbackTournamentName(row),
        date: toISODate(row.date),
        players: new Set<string>(),
        matchRows: 0,
      };

      matchGroups.set(key, group);
    }

    if (player) group.players.add(player);
    group.matchRows++;
  }

  const tournamentWins: TournamentWinRow[] = [];
  const archetypeWins = new Map<string, number>();
  const playerWins = new Map<string, number>();

  for (const [key, group] of standingGroups.entries()) {
    if (!group.winner) continue;

    const matchGroup = matchGroups.get(key);
    const playerCount =
      group.players.size || matchGroup?.players.size || 0;

    tournamentWins.push({
      tournamentKey: key,
      tournamentName: group.tournamentName,
      date: group.date,
      player: group.winner.player,
      archetype: group.winner.archetype,
      playerCount,
    });

    if (isRealArchetype(group.winner.archetype)) {
      increment(archetypeWins, group.winner.archetype);
    }

    increment(playerWins, group.winner.player);
  }

  tournamentWins.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.tournamentName.localeCompare(b.tournamentName);
  });

  const matchesPlayed = [...matchGroups.values()].reduce(
    (sum, group) => sum + Math.ceil(group.matchRows / 2),
    0,
  );

  return {
    uniqueTournaments: tournamentKeys.size,
    uniquePlayers: uniquePlayers.size,
    uniqueArchetypes: uniqueArchetypes.size,
    matchesPlayed,
    tournamentWins,
    archetypeWins: [...archetypeWins.entries()]
      .map(([archetype, wins]) => ({ archetype, wins }))
      .sort((a, b) => b.wins - a.wins || a.archetype.localeCompare(b.archetype)),
    playerWins: [...playerWins.entries()]
      .map(([player, wins]) => ({ player, wins }))
      .sort((a, b) => b.wins - a.wins || a.player.localeCompare(b.player)),
  };
}