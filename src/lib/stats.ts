/**
 * Matchup-matrix statistics.
 *
 * Winrate ignores draws:  winrate = wins / (wins + losses).
 * "matches" counts every decided or drawn game between the two archetypes.
 * Confidence interval is the 95% Wilson score interval on the winrate.
 */

export type MatchRow = {
  deck: string;
  opponentDeck: string;
  result: string; // "win" | "loss" | "draw"
};

export type CellStat = {
  wins: number;
  losses: number;
  draws: number;
  matches: number; // wins + losses + draws
  winrate: number | null; // null when no decided games
  ciLow: number;
  ciHigh: number;
};

export type ArchetypeRow = {
  deck: string;
  matches: number; // total appearances (across all opponents)
  overall: CellStat;
  vs: Record<string, CellStat>;
};

export type Matrix = {
  archetypes: string[]; // present archetypes, default order = most matches first
  rows: ArchetypeRow[];
  totalMatches: number; // total mirrored rows considered
  minPct: number;
};

const BYE_DECKS = new Set(["no deck (bye)", "bye", ""]);

function isByeDeck(deck: string): boolean {
  return BYE_DECKS.has(deck.trim().toLowerCase());
}

function emptyCell(): CellStat {
  return {
    wins: 0,
    losses: 0,
    draws: 0,
    matches: 0,
    winrate: null,
    ciLow: 0,
    ciHigh: 0,
  };
}

function tally(cell: CellStat, result: string): void {
  const r = result.trim().toLowerCase();
  if (r === "win") cell.wins++;
  else if (r === "loss") cell.losses++;
  else cell.draws++; // draw or anything unexpected
  cell.matches++;
}

/** 95% Wilson score interval for wins out of (wins+losses). */
export function wilson(wins: number, losses: number): {
  winrate: number | null;
  low: number;
  high: number;
} {
  const n = wins + losses;
  if (n === 0) return { winrate: null, low: 0, high: 0 };
  const z = 1.96;
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin =
    (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    winrate: p,
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function finalize(cell: CellStat): void {
  const w = wilson(cell.wins, cell.losses);
  cell.winrate = w.winrate;
  cell.ciLow = w.low;
  cell.ciHigh = w.high;
}

export function computeMatrix(
  matches: MatchRow[],
  opts: { minPct?: number } = {},
): Matrix {
  const minPct = opts.minPct ?? 2;

  // deck -> ArchetypeRow
  const map = new Map<string, ArchetypeRow>();
  let totalRows = 0;

  const getRow = (deck: string): ArchetypeRow => {
    let row = map.get(deck);
    if (!row) {
      row = { deck, matches: 0, overall: emptyCell(), vs: {} };
      map.set(deck, row);
    }
    return row;
  };

  for (const m of matches) {
    const deck = m.deck.trim().toLowerCase();
    if (isByeDeck(deck)) continue; // can't attribute a blank/bye player deck

    const opp = m.opponentDeck.trim().toLowerCase();
    const row = getRow(deck);
    // OVERALL counts every match the deck played (incl. byes and matches whose
    // opponent deck wasn't recorded) — this is how Looker counts "Qtd partidas".
    row.matches++;
    totalRows++;
    tally(row.overall, m.result);

    // Per-opponent cells only exist for known opponents.
    if (!isByeDeck(opp)) {
      if (!row.vs[opp]) row.vs[opp] = emptyCell();
      tally(row.vs[opp], m.result);
    }
  }

  // Presence filter: keep archetypes with >= minPct% of all rows.
  const threshold = (minPct / 100) * totalRows;
  const present = [...map.values()]
    .filter((r) => r.matches >= threshold)
    .sort((a, b) => b.matches - a.matches);

  // Finalize stats for kept rows (overall + every cell).
  for (const row of present) {
    finalize(row.overall);
    for (const opp of Object.keys(row.vs)) finalize(row.vs[opp]);
  }

  return {
    archetypes: present.map((r) => r.deck),
    rows: present,
    totalMatches: totalRows,
    minPct,
  };
}

export type PlayerStat = {
  player: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number;
  lossPct: number;
  drawPct: number;
};

export type PlayerRow = {
  player: string;
  result: string;
  opponent: string;
  opponentDeck: string;
};

type Tally = { matches: number; wins: number; losses: number; draws: number };

/** Aggregate raw rows into per-player win/loss/draw tallies (byes included,
 * matching Looker's "Qtd partidas"). */
function tallyPlayers(rows: PlayerRow[]): Map<string, Tally> {
  const map = new Map<string, Tally>();
  for (const r of rows) {
    const player = r.player.trim().toLowerCase();
    if (!player) continue;
    let s = map.get(player);
    if (!s) {
      s = { matches: 0, wins: 0, losses: 0, draws: 0 };
      map.set(player, s);
    }
    s.matches++;
    const res = r.result.trim().toLowerCase();
    if (res === "win") s.wins++;
    else if (res === "loss") s.losses++;
    else s.draws++;
  }
  return map;
}

/**
 * Per-player win/loss/draw analysis (the "Análise do jogador" view).
 * Percentages are over total matches (win% + loss% + draw% = 100%).
 * Byes are included, matching Looker. Sorted by matches desc.
 */
export function computePlayerAnalysis(rows: PlayerRow[]): PlayerStat[] {
  return [...tallyPlayers(rows).entries()]
    .map(([player, s]) => ({
      player,
      matches: s.matches,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      winPct: s.matches ? s.wins / s.matches : 0,
      lossPct: s.matches ? s.losses / s.matches : 0,
      drawPct: s.matches ? s.draws / s.matches : 0,
    }))
    .sort((a, b) => b.matches - a.matches || b.winPct - a.winPct);
}

export type StandingStat = PlayerStat & { points: number };

/**
 * Points-based league standings: win = 3, draw = 1, loss = 0.
 * Sorted by points desc, then win% as tiebreaker.
 */
export function computePointsStandings(rows: PlayerRow[]): StandingStat[] {
  return [...tallyPlayers(rows).entries()]
    .map(([player, s]) => ({
      player,
      matches: s.matches,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      points: s.wins * 3 + s.draws,
      winPct: s.matches ? s.wins / s.matches : 0,
      lossPct: s.matches ? s.losses / s.matches : 0,
      drawPct: s.matches ? s.draws / s.matches : 0,
    }))
    .sort(
      (a, b) => b.points - a.points || b.winPct - a.winPct || b.matches - a.matches,
    );
}

/** Title-case a lowercase deck name for display. */
export function prettyDeck(deck: string): string {
  return deck
    .split(/\s+/)
    .map((w) =>
      w.length ? w[0].toUpperCase() + w.slice(1) : w,
    )
    .join(" ");
}
