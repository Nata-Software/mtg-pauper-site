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
    const opp = m.opponentDeck.trim().toLowerCase();
    if (isByeDeck(deck) || isByeDeck(opp)) continue; // ignore byes in matchups

    const row = getRow(deck);
    row.matches++;
    totalRows++;
    tally(row.overall, m.result);

    if (!row.vs[opp]) row.vs[opp] = emptyCell();
    tally(row.vs[opp], m.result);
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

/** Title-case a lowercase deck name for display. */
export function prettyDeck(deck: string): string {
  return deck
    .split(/\s+/)
    .map((w) =>
      w.length ? w[0].toUpperCase() + w.slice(1) : w,
    )
    .join(" ");
}
