/**
 * Matchup-matrix statistics.
 *
<<<<<<< Updated upstream
 * Winrate counts draws as non-wins:
 * winrate = wins / (wins + losses + draws).
 *
 * "matches" counts every decided or drawn game between the two archetypes.
 * Confidence interval is the 95% Wilson score interval on wins vs non-wins.
=======
 * Winrate ignores draws: winrate = wins / (wins + losses).
 * "matches" counts every decided or drawn game between the two archetypes.
 * Confidence interval is the 95% Wilson score interval on the winrate.
>>>>>>> Stashed changes
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
  matches: number; // total appearances across all opponents
  overall: CellStat;
  vs: Record<string, CellStat>;
};

export type Matrix = {
  archetypes: string[]; // column archetypes
  rows: ArchetypeRow[];
  totalMatches: number; // total mirrored rows considered
  minPct: number;
};

export type PlayerStat = {
  player: string;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  winPct: number;
  lossPct: number;
  drawPct: number;
};

export type StandingStat = {
  player: string;
  points: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number;
  participations: number;
};

export type DeckBreakdown = {
  deck: string;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  winPct: number;
  lossPct: number;
  drawPct: number;
};

// "unknown deck" = a player who didn't register a decklist.
// Kept OUT of the matchup matrix, like byes.
const BYE_DECKS = new Set(["no deck (bye)", "bye", "", "unknown deck"]);

export function isByeDeck(deck: string): boolean {
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
  else cell.draws++;

  cell.matches++;
}

/**
 * 95% Wilson score interval for wins out of (wins+losses).
 */
export function wilson(
  wins: number,
  nonWins: number,
): {
  winrate: number | null;
  low: number;
  high: number;
} {
  const n = wins + nonWins;

  if (n === 0) return { winrate: null, low: 0, high: 0 };

  const z = 1.96;
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  return {
    winrate: p,
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function finalize(cell: CellStat): void {
  const w = wilson(cell.wins, cell.losses + cell.draws);

  cell.winrate = w.winrate;
  cell.ciLow = w.low;
  cell.ciHigh = w.high;
}

export function computeMatrix(
  matches: MatchRow[],
  opts: { minPct?: number; columnMode?: "rows" | "opponents" } = {},
): Matrix {
  const minPct = opts.minPct ?? 2;
  const columnMode = opts.columnMode ?? "rows";

  // deck -> ArchetypeRow
  const map = new Map<string, ArchetypeRow>();
  const opponentTotals = new Map<string, number>();
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
    const deck = m.deck.trim();

    if (isByeDeck(deck)) continue;

    const opp = m.opponentDeck.trim();
    const row = getRow(deck);

    // OVERALL counts every match the deck played.
    row.matches++;
    totalRows++;
    tally(row.overall, m.result);

    // Per-opponent cells only exist for known opponents.
    if (!isByeDeck(opp)) {
      if (!row.vs[opp]) row.vs[opp] = emptyCell();

      tally(row.vs[opp], m.result);
      opponentTotals.set(opp, (opponentTotals.get(opp) ?? 0) + 1);
    }
  }

  // Presence filter: keep row decks with >= minPct% of all rows.
  const threshold = (minPct / 100) * totalRows;

  const present = [...map.values()]
    .filter((r) => r.matches >= threshold)
    .sort((a, b) => b.matches - a.matches);

  // Finalize stats for kept rows.
  for (const row of present) {
    finalize(row.overall);

    for (const opp of Object.keys(row.vs)) {
      finalize(row.vs[opp]);
    }
  }

  const archetypes =
    columnMode === "opponents"
      ? [
          ...new Set(
            present.flatMap((row) =>
              Object.keys(row.vs).filter((deck) => !isByeDeck(deck)),
            ),
          ),
        ].sort(
          (a, b) =>
            (opponentTotals.get(b) ?? 0) - (opponentTotals.get(a) ?? 0) ||
            a.localeCompare(b),
        )
      : present.map((r) => r.deck);

  return {
    archetypes,
    rows: present,
    totalMatches: totalRows,
    minPct,
  };
}

function rate(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

function tallyResult(
  row: { wins: number; losses: number; draws: number; matches: number },
  result: string,
): void {
  const r = result.trim().toLowerCase();

  if (r === "win") row.wins++;
  else if (r === "loss") row.losses++;
  else row.draws++;

  row.matches++;
}

export function computePlayerAnalysis(
  rows: { player: string; result: string }[],
): PlayerStat[] {
  const map = new Map<string, PlayerStat>();

  for (const r of rows) {
    const player = r.player.trim();

    if (!player) continue;

    let stat = map.get(player);

    if (!stat) {
      stat = {
        player,
        wins: 0,
        losses: 0,
        draws: 0,
        matches: 0,
        winPct: 0,
        lossPct: 0,
        drawPct: 0,
      };

      map.set(player, stat);
    }

    tallyResult(stat, r.result);
  }

  const out = [...map.values()];

  for (const stat of out) {
    stat.winPct = rate(stat.wins, stat.matches);
    stat.lossPct = rate(stat.losses, stat.matches);
    stat.drawPct = rate(stat.draws, stat.matches);
  }

  return out.sort(
    (a, b) => b.matches - a.matches || a.player.localeCompare(b.player),
  );
}

export function computePointsStandings(
  rows: { player: string; result: string; participationKey?: string }[],
): StandingStat[] {
  const map = new Map<string, StandingStat>();
  const participationSets = new Map<string, Set<string>>();

  for (const r of rows) {
    const player = r.player.trim();

    if (!player) continue;

    let stat = map.get(player);

    if (!stat) {
      stat = {
        player,
        points: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winPct: 0,
        participations: 0,
      };

      map.set(player, stat);
    }

    const result = r.result.trim().toLowerCase();

    if (result === "win") {
      stat.wins++;
      stat.points += 3;
    } else if (result === "loss") {
      stat.losses++;
    } else {
      stat.draws++;
      stat.points += 1;
    }

    stat.matches++;

    if (r.participationKey) {
      let set = participationSets.get(player);

      if (!set) {
        set = new Set<string>();
        participationSets.set(player, set);
      }

      set.add(r.participationKey);
    }
  }

  const out = [...map.values()];

  for (const stat of out) {
    stat.winPct = rate(stat.wins, stat.matches);
    stat.participations = participationSets.get(stat.player)?.size ?? 0;
  }

  return out.sort(
    (a, b) =>
      b.points - a.points ||
      b.winPct - a.winPct ||
      b.matches - a.matches ||
      a.player.localeCompare(b.player),
  );
}

export function computeDeckBreakdown(
  rows: { deck: string; result: string }[],
): DeckBreakdown[] {
  const map = new Map<string, DeckBreakdown>();

  for (const r of rows) {
    const deck = r.deck.trim();

    if (!deck) continue;

    let stat = map.get(deck);

    if (!stat) {
      stat = {
        deck,
        wins: 0,
        losses: 0,
        draws: 0,
        matches: 0,
        winPct: 0,
        lossPct: 0,
        drawPct: 0,
      };

      map.set(deck, stat);
    }

    tallyResult(stat, r.result);
  }

  const out = [...map.values()];

  for (const stat of out) {
    stat.winPct = rate(stat.wins, stat.matches);
    stat.lossPct = rate(stat.losses, stat.matches);
    stat.drawPct = rate(stat.draws, stat.matches);
  }

  return out.sort(
    (a, b) =>
      b.matches - a.matches ||
      b.winPct - a.winPct ||
      a.deck.localeCompare(b.deck),
  );
}

export function prettyDeck(deck: string): string {
  const trimmed = deck.trim();

  if (!trimmed) return "Unknown";
  if (/[A-Z]/.test(trimmed)) return trimmed;

  return trimmed
    .split(/(\s+|-|\/|\(|\))/)
    .map((part) => {
      if (/^\s+$|^-$|^\/$|^\($|^\)$/.test(part)) return part;
      if (!part) return part;

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}
