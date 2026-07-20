import { cache } from "react";

import { prisma } from "./prisma";
import { toISODate } from "./dates";
import {
  computeMatrix,
  isByeDeck,
  type MatchRow,
  type Matrix,
} from "./stats";
import type { Card } from "./archetype";
import {
  canonicalDeck,
  clean,
  colorKey,
  display,
  SYNONYMS,
} from "./archetype/normalize.mjs";

const LOW_SAMPLE_MATCHES = 10;

export type Filters = {
  store: string;
  from?: string;
  to?: string;
  event?: string;
};

function dateWhere(from?: string, to?: string) {
  const date: { gte?: Date; lte?: Date } = {};

  if (from) date.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) date.lte = new Date(`${to}T23:59:59.999Z`);

  return Object.keys(date).length ? date : undefined;
}

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

export async function listEvents(store: string): Promise<string[]> {
  const rows = await prisma.match.findMany({
    where: { store },
    distinct: ["eventName"],
    select: { eventName: true },
  });

  return rows
    .map((r) => r.eventName)
    .filter(Boolean)
    .sort();
}

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

const buildDeckResolver = cache(
  async (
    store: string,
  ): Promise<(player: string) => (ck: string) => string | undefined> => {
    const rows = await prisma.match.findMany({
      where: { store, archetype: { not: null } },
      select: { player: true, archetype: true },
    });

    const counts = new Map<string, Map<string, Map<string, number>>>();

    for (const r of rows) {
      const a = r.archetype;

      if (!a) continue;

      const c = clean(a);
      const ck = colorKey(c);

      if (!ck) continue;

      const label = display(SYNONYMS[c] ?? c);

      let byColor = counts.get(r.player);

      if (!byColor) {
        byColor = new Map<string, Map<string, number>>();
        counts.set(r.player, byColor);
      }

      let byLabel = byColor.get(ck);

      if (!byLabel) {
        byLabel = new Map<string, number>();
        byColor.set(ck, byLabel);
      }

      byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
    }

    const dominant = new Map<string, Map<string, string>>();

    for (const [player, byColor] of counts) {
      const best = new Map<string, string>();

      for (const [ck, byLabel] of byColor) {
        let label = "";
        let n = -1;

        for (const [l, count] of byLabel) {
          if (count > n) {
            n = count;
            label = l;
          }
        }

        best.set(ck, label);
      }

      dominant.set(player, best);
    }

    return (player) => (ck) => dominant.get(player)?.get(ck);
  },
);

export async function getMatchRows(f: Filters): Promise<MatchRow[]> {
  const date = dateWhere(f.from, f.to);

  const [rows, resolver] = await Promise.all([
    prisma.match.findMany({
      where: {
        store: f.store,
        ...(f.event ? { eventName: f.event } : {}),
        ...(date ? { date } : {}),
      },
      select: {
        player: true,
        deck: true,
        archetype: true,
        opponent: true,
        opponentDeck: true,
        opponentArchetype: true,
        result: true,
      },
    }),
    buildDeckResolver(f.store),
  ]);

  return rows.map((r) => ({
    deck: canonicalDeck(r.archetype, r.deck, resolver(r.player)),
    opponentDeck: canonicalDeck(
      r.opponentArchetype,
      r.opponentDeck,
      resolver(r.opponent),
    ),
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
  const date = dateWhere(f.from, f.to);

  return prisma.standing.findMany({
    where: {
      store: f.store,
      ...(f.event ? { eventName: f.event } : {}),
      ...(date ? { date } : {}),
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
  participationKey?: string;
};

export async function getPlayerRows(f: Filters): Promise<PlayerMatchRow[]> {
  const date = dateWhere(f.from, f.to);

  const rows = await prisma.match.findMany({
    where: {
      store: f.store,
      ...(f.event ? { eventName: f.event } : {}),
      ...(date ? { date } : {}),
    },
    select: {
      player: true,
      result: true,
      opponent: true,
      opponentDeck: true,
      tournamentId: true,
      eventName: true,
      date: true,
    },
  });

  return rows.map((row) => ({
    player: row.player,
    result: row.result,
    opponent: row.opponent,
    opponentDeck: row.opponentDeck,
    participationKey: tournamentKey(row),
  }));
}

function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

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

export async function getPlayerDeckRows(opts: {
  store: string;
  player: string;
  from?: string;
  to?: string;
  event?: string;
}): Promise<{ deck: string; result: string }[]> {
  const date = dateWhere(opts.from, opts.to);

  const [rows, resolver] = await Promise.all([
    prisma.match.findMany({
      where: {
        store: opts.store,
        player: opts.player,
        ...(opts.event ? { eventName: opts.event } : {}),
        ...(date ? { date } : {}),
      },
      select: { deck: true, archetype: true, result: true },
    }),
    buildDeckResolver(opts.store),
  ]);

  const resolve = resolver(opts.player);

  return rows.map((r) => ({
    deck: canonicalDeck(r.archetype, r.deck, resolve),
    result: r.result,
  }));
}

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
  const m = max.date.getUTCMonth();
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

function displayName(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function isRealArchetype(value: string | null | undefined): boolean {
  const deck = normalizeName(value);

  return deck !== "" && deck !== "bye" && deck !== "no deck (bye)";
}

function isByeMatch(row: {
  opponent: string | null | undefined;
  opponentDeck: string | null | undefined;
}): boolean {
  // Only an actual bye (no opponent) — NOT a real match whose opponent simply
  // forgot to register a decklist. The latter is a genuine game for this player
  // and must count (e.g. a 4-0 vs a deckless opponent should read 4-0, not 3-0).
  return (
    normalizeName(row.opponent) === "bye" ||
    normalizeName(row.opponentDeck) === "no deck (bye)"
  );
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

    if (player && (!group.winner || row.position < group.winner.position)) {
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
    const playerCount = group.players.size || matchGroup?.players.size || 0;

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

export type MetagameDeckRow = {
  deck: string;
  entrants: number;
  sharePct: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number | null;
  representativeCardName: string | null;
};

const BASIC_LAND_NAMES = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
]);

export async function getMetagameData(
  f: Filters,
): Promise<MetagameDeckRow[]> {
  const date = dateWhere(f.from, f.to);

  const [rows, resolver] = await Promise.all([
    prisma.match.findMany({
      where: {
        store: f.store,
        ...(f.event ? { eventName: f.event } : {}),
        ...(date ? { date } : {}),
      },
      select: {
        player: true,
        deck: true,
        archetype: true,
        result: true,
        tournamentId: true,
        eventName: true,
        date: true,
        decklistId: true,
      },
    }),
    buildDeckResolver(f.store),
  ]);

  type Tally = {
    wins: number;
    losses: number;
    draws: number;
    matches: number;
  };

  const tally = new Map<string, Tally>();
  const entrants = new Map<
    string,
    { count: number; decklistIds: Set<string> }
  >();
  const entrantSeen = new Set<string>();
  let totalEntrants = 0;

  for (const r of rows) {
    const deck = canonicalDeck(r.archetype, r.deck, resolver(r.player));

    if (isByeDeck(deck)) continue;

    let t = tally.get(deck);

    if (!t) {
      t = { wins: 0, losses: 0, draws: 0, matches: 0 };
      tally.set(deck, t);
    }

    t.matches++;

    const res = r.result.trim().toLowerCase();

    if (res === "win") t.wins++;
    else if (res === "loss") t.losses++;
    else t.draws++;

    const entrantKey = `${tournamentKey(r)}::${r.player}`;

    if (!entrantSeen.has(entrantKey)) {
      entrantSeen.add(entrantKey);
      totalEntrants++;

      let e = entrants.get(deck);

      if (!e) {
        e = { count: 0, decklistIds: new Set<string>() };
        entrants.set(deck, e);
      }

      e.count++;

      if (r.decklistId) e.decklistIds.add(r.decklistId);
    }
  }

  const allDecklistIds = [
    ...new Set([...entrants.values()].flatMap((e) => [...e.decklistIds])),
  ];

  const decklists = allDecklistIds.length
    ? await prisma.decklist.findMany({
        where: { id: { in: allDecklistIds } },
        select: { id: true, cards: true },
      })
    : [];

  const cardsById = new Map(
    decklists.map((d) => [d.id, d.cards as unknown as Card[]]),
  );

  const representativeCard = new Map<string, string | null>();

  for (const [deck, e] of entrants) {
    const freq = new Map<string, number>();

    for (const id of e.decklistIds) {
      const cards = cardsById.get(id) ?? [];
      const seen = new Set<string>();

      for (const c of cards) {
        const name = c.name?.trim();

        if (!name || BASIC_LAND_NAMES.has(name.toLowerCase())) continue;
        if (seen.has(name)) continue;

        seen.add(name);
        freq.set(name, (freq.get(name) ?? 0) + 1);
      }
    }

    let best: string | null = null;
    let bestCount = 0;

    for (const [name, count] of freq) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }

    representativeCard.set(deck, best);
  }

  return [...tally.entries()]
    .map(([deck, t]) => {
      const e = entrants.get(deck);
      const decided = t.wins + t.losses;

      return {
        deck,
        entrants: e?.count ?? 0,
        sharePct: totalEntrants ? ((e?.count ?? 0) / totalEntrants) * 100 : 0,
        matches: t.matches,
        wins: t.wins,
        losses: t.losses,
        draws: t.draws,
        winrate: decided ? t.wins / decided : null,
        representativeCardName: representativeCard.get(deck) ?? null,
      };
    })
    .sort((a, b) => b.entrants - a.entrants || b.matches - a.matches);
}

export type DeckMatchLogRow = {
  date: string;
  tournamentName: string;
  player: string;
  opponent: string;
  opponentDeck: string;
  result: string;
  round: number;
};

export async function getDeckMatchLog(
  f: Filters,
  deck: string,
): Promise<DeckMatchLogRow[]> {
  const date = dateWhere(f.from, f.to);

  const [rows, resolver] = await Promise.all([
    prisma.match.findMany({
      where: {
        store: f.store,
        ...(f.event ? { eventName: f.event } : {}),
        ...(date ? { date } : {}),
      },
      orderBy: { date: "desc" },
      select: {
        player: true,
        deck: true,
        archetype: true,
        opponent: true,
        opponentDeck: true,
        opponentArchetype: true,
        result: true,
        date: true,
        eventName: true,
        tournamentName: true,
        round: true,
      },
      take: 5000,
    }),
    buildDeckResolver(f.store),
  ]);

  return rows
    .filter((r) => canonicalDeck(r.archetype, r.deck, resolver(r.player)) === deck)
    .filter((r) => normalizeName(r.opponent) !== "bye")
    .map((r) => ({
      date: toISODate(r.date),
      tournamentName: r.tournamentName || r.eventName,
      player: r.player,
      opponent: r.opponent,
      opponentDeck: canonicalDeck(
        r.opponentArchetype,
        r.opponentDeck,
        resolver(r.opponent),
      ),
      result: r.result,
      round: r.round,
    }));
}

export type AllPlayersDataRow = {
  player: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number;
  participations: number;
  tournamentWins: number;
};

export type SinglePlayerDeckRow = {
  deck: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number;
  tournamentWins: number;
  lowSample: boolean;
};

export type SinglePlayerOpponentRow = {
  opponent: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number | null;
  lowSample: boolean;
};

export type SinglePlayerData = {
  player: string;
  tournamentsEntered: number;
  tournamentsWon: number;
  matchesPlayed: number;
  uniqueOpponents: number;
  uniqueArchetypesPlayed: number;
  total: {
    wins: number;
    losses: number;
    draws: number;
    winPct: number;
  };
  mostPlayedDeck: string | null;
  mostPlayedOpponent: string | null;
  bestOpponent: SinglePlayerOpponentRow | null;
  worstOpponent: SinglePlayerOpponentRow | null;
  usedLowSampleFallback: boolean;
  decks: SinglePlayerDeckRow[];
  opponents: SinglePlayerOpponentRow[];
  matrix: Matrix;
};

function matchWinPct(
  wins: number,
  losses: number,
  draws: number,
): number | null {
  const total = wins + losses + draws;

  return total ? wins / total : null;
}

function resultToTally(
  stat: { wins: number; losses: number; draws: number; matches: number },
  result: string,
): void {
  const normalized = result.trim().toLowerCase();

  if (normalized === "win") stat.wins++;
  else if (normalized === "loss") stat.losses++;
  else stat.draws++;

  stat.matches++;
}

export async function listPlayersForData(f: {
  store: string;
  from?: string;
  to?: string;
  event?: string;
}): Promise<string[]> {
  const date = dateWhere(f.from, f.to);

  const rows = await prisma.match.findMany({
    where: {
      store: f.store,
      ...(f.event ? { eventName: f.event } : {}),
      ...(date ? { date } : {}),
    },
    distinct: ["player"],
    select: { player: true },
  });

  return [...new Set(rows.map((row) => row.player.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export async function getAllPlayersData(f: {
  store: string;
  from?: string;
  to?: string;
  event?: string;
  player?: string;
}): Promise<AllPlayersDataRow[]> {
  const date = dateWhere(f.from, f.to);

  const [matches, standings] = await Promise.all([
    prisma.match.findMany({
      where: {
        store: f.store,
        ...(f.event ? { eventName: f.event } : {}),
        ...(f.player ? { player: f.player } : {}),
        ...(date ? { date } : {}),
      },
      select: {
        player: true,
        result: true,
        opponent: true,
        opponentDeck: true,
        tournamentId: true,
        eventName: true,
        date: true,
      },
    }),
    prisma.standing.findMany({
      where: {
        store: f.store,
        ...(f.event ? { eventName: f.event } : {}),
        ...(date ? { date } : {}),
      },
      orderBy: [{ date: "desc" }, { position: "asc" }],
      select: {
        tournamentId: true,
        eventName: true,
        date: true,
        nickname: true,
        position: true,
      },
    }),
  ]);

  const rows = new Map<string, AllPlayersDataRow>();
  const participationSets = new Map<string, Set<string>>();
  const tournamentWinners = new Map<
    string,
    { player: string; position: number }
  >();

  for (const row of matches) {
    if (isByeMatch(row)) {
      continue;
    }

    const key = normalizeName(row.player);
    const player = displayName(row.player);

    if (!key || !player) continue;

    let stat = rows.get(key);

    if (!stat) {
      stat = {
        player,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winPct: 0,
        participations: 0,
        tournamentWins: 0,
      };

      rows.set(key, stat);
    }

    resultToTally(stat, row.result);

    let participations = participationSets.get(key);

    if (!participations) {
      participations = new Set<string>();
      participationSets.set(key, participations);
    }

    participations.add(tournamentKey(row));
  }

  for (const row of standings) {
    const key = tournamentKey(row);
    const player = normalizeName(row.nickname);

    if (!player) continue;

    const existing = tournamentWinners.get(key);

    if (!existing || row.position < existing.position) {
      tournamentWinners.set(key, {
        player,
        position: row.position,
      });
    }
  }

  for (const winner of tournamentWinners.values()) {
    const stat = rows.get(winner.player);

    if (stat) {
      stat.tournamentWins++;
    }
  }

  for (const [key, stat] of rows.entries()) {
    stat.participations = participationSets.get(key)?.size ?? 0;
    stat.winPct = matchWinPct(stat.wins, stat.losses, stat.draws) ?? 0;
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.matches - a.matches ||
      b.winPct - a.winPct ||
      a.player.localeCompare(b.player),
  );
}

export async function getSinglePlayerData(f: {
  store: string;
  player: string;
  from?: string;
  to?: string;
  event?: string;
}): Promise<SinglePlayerData | null> {
  const date = dateWhere(f.from, f.to);
  const selectedPlayerKey = normalizeName(f.player);

  if (!selectedPlayerKey) {
    return null;
  }

  const [matches, standings, resolver] = await Promise.all([
    prisma.match.findMany({
      where: {
        store: f.store,
        player: f.player,
        ...(f.event ? { eventName: f.event } : {}),
        ...(date ? { date } : {}),
      },
      orderBy: [{ date: "desc" }, { round: "asc" }],
      select: {
        player: true,
        deck: true,
        archetype: true,
        result: true,
        opponent: true,
        opponentDeck: true,
        opponentArchetype: true,
        tournamentId: true,
        eventName: true,
        date: true,
      },
    }),
    prisma.standing.findMany({
      where: {
        store: f.store,
        ...(f.event ? { eventName: f.event } : {}),
        ...(date ? { date } : {}),
      },
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
    buildDeckResolver(f.store),
  ]);

  const filteredMatches = matches.filter((row) => !isByeMatch(row));

  if (filteredMatches.length === 0) {
    return null;
  }

  const resolvePlayerDeck = resolver(f.player);

  const total = {
    wins: 0,
    losses: 0,
    draws: 0,
    matches: 0,
  };

  const tournamentEntries = new Set<string>();
  const uniqueOpponents = new Set<string>();
  const uniqueArchetypesPlayed = new Set<string>();

  const deckMap = new Map<
    string,
    {
      deck: string;
      matches: number;
      wins: number;
      losses: number;
      draws: number;
    }
  >();

  const opponentMap = new Map<
    string,
    {
      opponent: string;
      matches: number;
      wins: number;
      losses: number;
      draws: number;
    }
  >();

  const matrixRows: MatchRow[] = [];

  for (const row of filteredMatches) {
    const deck = canonicalDeck(row.archetype, row.deck, resolvePlayerDeck);
    const opponentDeck = canonicalDeck(
      row.opponentArchetype,
      row.opponentDeck,
      resolver(row.opponent),
    );

    resultToTally(total, row.result);

    tournamentEntries.add(tournamentKey(row));
    uniqueOpponents.add(normalizeName(row.opponent));
    uniqueArchetypesPlayed.add(deck);

    let deckStat = deckMap.get(deck);

    if (!deckStat) {
      deckStat = {
        deck,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      };

      deckMap.set(deck, deckStat);
    }

    resultToTally(deckStat, row.result);

    const opponentKey = normalizeName(row.opponent);
    const opponentName = displayName(row.opponent);

    if (opponentKey && opponentName) {
      let opponentStat = opponentMap.get(opponentKey);

      if (!opponentStat) {
        opponentStat = {
          opponent: opponentName,
          matches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
        };

        opponentMap.set(opponentKey, opponentStat);
      }

      resultToTally(opponentStat, row.result);
    }

    matrixRows.push({
      deck,
      opponentDeck,
      result: row.result,
    });
  }

  const tournamentWinners = new Map<
    string,
    {
      player: string;
      position: number;
      deck: string;
    }
  >();

  for (const row of standings) {
    const key = tournamentKey(row);
    const winnerKey = normalizeName(row.nickname);

    if (!winnerKey) continue;

    const existing = tournamentWinners.get(key);

    if (!existing || row.position < existing.position) {
      tournamentWinners.set(key, {
        player: winnerKey,
        position: row.position,
        deck: canonicalDeck(null, row.deck),
      });
    }
  }

  let tournamentsWon = 0;
  const deckTournamentWins = new Map<string, number>();

  for (const [key, winner] of tournamentWinners.entries()) {
    if (winner.player !== selectedPlayerKey) continue;

    tournamentsWon++;

    if (!tournamentEntries.has(key)) {
      tournamentEntries.add(key);
    }

    deckTournamentWins.set(
      winner.deck,
      (deckTournamentWins.get(winner.deck) ?? 0) + 1,
    );
  }

  const decks: SinglePlayerDeckRow[] = [...deckMap.values()]
    .map((row) => {
      const winPct = matchWinPct(row.wins, row.losses, row.draws) ?? 0;

      return {
        deck: row.deck,
        matches: row.matches,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        winPct,
        tournamentWins: deckTournamentWins.get(row.deck) ?? 0,
        lowSample: row.matches < LOW_SAMPLE_MATCHES,
      };
    })
    .sort(
      (a, b) =>
        b.matches - a.matches ||
        b.winPct - a.winPct ||
        a.deck.localeCompare(b.deck),
    );

  const opponents: SinglePlayerOpponentRow[] = [...opponentMap.values()]
    .map((row) => ({
      opponent: row.opponent,
      matches: row.matches,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      winPct: matchWinPct(row.wins, row.losses, row.draws),
      lowSample: row.matches < LOW_SAMPLE_MATCHES,
    }))
    .sort(
      (a, b) =>
        b.matches - a.matches ||
        (b.winPct ?? -1) - (a.winPct ?? -1) ||
        a.opponent.localeCompare(b.opponent),
    );

  const eligibleOpponents = opponents.filter(
    (row) => row.matches >= LOW_SAMPLE_MATCHES && row.winPct !== null,
  );

  const opponentPool =
    eligibleOpponents.length > 0
      ? eligibleOpponents
      : opponents.filter((row) => row.winPct !== null);

  const bestOpponent =
    opponentPool.length > 0
      ? [...opponentPool].sort(
          (a, b) =>
            (b.winPct ?? -1) - (a.winPct ?? -1) ||
            b.matches - a.matches,
        )[0]
      : null;

  const worstOpponent =
    opponentPool.length > 0
      ? [...opponentPool].sort(
          (a, b) =>
            (a.winPct ?? 2) - (b.winPct ?? 2) ||
            b.matches - a.matches,
        )[0]
      : null;

  const mostPlayedDeck = decks[0]?.deck ?? null;
  const mostPlayedOpponent = opponents[0]?.opponent ?? null;

  return {
    player: f.player,
    tournamentsEntered: tournamentEntries.size,
    tournamentsWon,
    matchesPlayed: total.matches,
    uniqueOpponents: [...uniqueOpponents].filter(Boolean).length,
    uniqueArchetypesPlayed: uniqueArchetypesPlayed.size,
    total: {
      wins: total.wins,
      losses: total.losses,
      draws: total.draws,
      winPct: matchWinPct(total.wins, total.losses, total.draws) ?? 0,
    },
    mostPlayedDeck,
    mostPlayedOpponent,
    bestOpponent,
    worstOpponent,
    usedLowSampleFallback:
      eligibleOpponents.length === 0 &&
      opponents.some((row) => row.winPct !== null),
    decks,
    opponents,
    matrix: computeMatrix(matrixRows, {
      minPct: 0,
      columnMode: "opponents",
    }),
  };
}