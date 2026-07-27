import { prisma } from "@/lib/prisma";
import { normUsername } from "./normalize";

export const MPL_SEASON = 2026;

/** Number of Final spots awarded by the Opens Ranking (regulamento: top 8). */
export const RANKING_SPOTS = 8;

export type MplStageMeta = {
  id: number;
  ordinal: number;
  kind: string;
  name: string;
  date: Date | null;
  format: string;
  countsForRanking: boolean;
  playerCount: number | null;
  meleeId: string | null;
};

export type MplRankingRow = {
  username: string;
  player: string;
  points: number;
  plays: number;
  avgRank: number;
  classified: boolean;
  /** one of the first RANKING_SPOTS players not already holding a spot — i.e.
   * would actually take a Final spot from the Opens Ranking. */
  qualifies: boolean;
  /** points earned in each ranking Open, keyed by stage ordinal. */
  perStage: Record<number, { points: number; rank: number }>;
};

export type OpensRanking = {
  stages: MplStageMeta[]; // the Opens that count toward the ranking
  rows: MplRankingRow[];
  cutoff: number; // how many top rows are "in" (RANKING_SPOTS), for the divider
  hideClassified: boolean;
};

function toMeta(s: {
  id: number;
  ordinal: number;
  kind: string;
  name: string;
  date: Date | null;
  format: string;
  countsForRanking: boolean;
  playerCount: number | null;
  meleeId: string | null;
}): MplStageMeta {
  return {
    id: s.id,
    ordinal: s.ordinal,
    kind: s.kind,
    name: s.name,
    date: s.date,
    format: s.format,
    countsForRanking: s.countsForRanking,
    playerCount: s.playerCount,
    meleeId: s.meleeId,
  };
}

/**
 * Cumulative Opens Ranking: sum of melee points per player across every Open
 * that counts (trios/team stages excluded). Aggregated by stable `username`.
 * Ordered by points, then better average placement, then more participations
 * (regulamento tiebreakers 1 & 2). When `hideClassified`, players who already
 * hold a Final spot are dropped so the top-8 line falls on the next in queue.
 */
export async function getOpensRanking(opts?: {
  season?: number;
  hideClassified?: boolean;
}): Promise<OpensRanking> {
  const season = opts?.season ?? MPL_SEASON;
  const hideClassified = opts?.hideClassified ?? false;

  const [stages, spots] = await Promise.all([
    prisma.mplStage.findMany({
      where: { season, kind: "open", countsForRanking: true },
      orderBy: { ordinal: "asc" },
      include: { results: true },
    }),
    prisma.mplSpot.findMany({
      where: { season, meleeUsername: { not: null } },
      select: { meleeUsername: true },
    }),
  ]);

  const spotUsernames = new Set(
    spots.map((s) => normUsername(s.meleeUsername)).filter(Boolean),
  );

  const agg = new Map<
    string,
    {
      username: string;
      player: string;
      points: number;
      ranks: number[];
      perStage: Record<number, { points: number; rank: number }>;
    }
  >();

  for (const stage of stages) {
    for (const r of stage.results) {
      const username = normUsername(r.username) || normUsername(r.player);
      if (!username) continue;
      let a = agg.get(username);
      if (!a) {
        a = { username, player: r.player, points: 0, ranks: [], perStage: {} };
        agg.set(username, a);
      }
      a.points += r.points;
      a.ranks.push(r.rank);
      a.player = r.player; // most recent display name
      a.perStage[stage.ordinal] = { points: r.points, rank: r.rank };
    }
  }

  let rows: MplRankingRow[] = [...agg.values()]
    .map((a) => ({
      username: a.username,
      player: a.player,
      points: a.points,
      plays: a.ranks.length,
      avgRank: a.ranks.reduce((x, y) => x + y, 0) / a.ranks.length,
      classified: spotUsernames.has(a.username),
      qualifies: false,
      perStage: a.perStage,
    }))
    .sort(
      (x, y) =>
        y.points - x.points || x.avgRank - y.avgRank || y.plays - x.plays,
    );

  // The Opens Ranking spots skip anyone already classified, cascading down.
  let awarded = 0;
  for (const r of rows) {
    if (!r.classified && awarded < RANKING_SPOTS) {
      r.qualifies = true;
      awarded++;
    }
  }

  if (hideClassified) rows = rows.filter((r) => !r.classified);

  return {
    stages: stages.map(toMeta),
    rows,
    cutoff: RANKING_SPOTS,
    hideClassified,
  };
}

export type MplStageResult = {
  rank: number;
  player: string;
  username: string;
  record: string | null;
  points: number;
};

export type MplStageView = MplStageMeta & {
  results: MplStageResult[];
  spotWinners: { player: string; ordinal: number }[];
};

/** Does a classified "open" spot belong to the given Open stage? */
function spotMatchesStage(source: string, ordinal: number): boolean {
  const lower = source.toLowerCase();
  if (ordinal === 4 && /super pauper/.test(lower)) return true;
  return new RegExp(`^${ordinal}\\s*[º°ª]`).test(source.trim());
}

/** Every Open in the season with its standings + who took a Final spot there. */
export async function getStages(season = MPL_SEASON): Promise<MplStageView[]> {
  const [stages, openSpots] = await Promise.all([
    prisma.mplStage.findMany({
      where: { season, kind: "open" },
      orderBy: { ordinal: "asc" },
      include: { results: { orderBy: { rank: "asc" } } },
    }),
    prisma.mplSpot.findMany({
      where: { season, sourceType: "open" },
      orderBy: { ordinal: "asc" },
    }),
  ]);

  return stages.map((s) => ({
    ...toMeta(s),
    results: s.results.map((r) => ({
      rank: r.rank,
      player: r.player,
      username: r.username,
      record: r.record,
      points: r.points,
    })),
    spotWinners: openSpots
      .filter((sp) => spotMatchesStage(sp.source, s.ordinal))
      .map((sp) => ({ player: sp.player, ordinal: sp.ordinal })),
  }));
}

export type MplClassified = {
  ordinal: number;
  player: string;
  source: string;
  sourceType: string;
  store: string | null;
  date: Date | null;
  standingsRef: string | null;
};

/** The master spot list — everyone classified, from every source. */
export async function getClassified(
  season = MPL_SEASON,
): Promise<MplClassified[]> {
  const spots = await prisma.mplSpot.findMany({
    where: { season },
    orderBy: { ordinal: "asc" },
  });
  return spots.map((s) => ({
    ordinal: s.ordinal,
    player: s.player,
    source: s.source,
    sourceType: s.sourceType,
    store: s.store,
    date: s.date,
    standingsRef: s.standingsRef,
  }));
}
