/**
 * Write one scraped MPL Open into the yearly-league tables.
 *
 * ISOLATION IS THE POINT: this module touches MplStage and MplResult and
 * nothing else. It never writes Match, Standing or Decklist, so importing an
 * Open cannot leak yearly-league games into the weekly matchup statistics. The
 * legacy CSV import did leak them and had to be unpicked afterwards
 * (scripts/split-mpl-events.mjs) — keeping the write path separate is what
 * stops that recurring.
 *
 * Idempotent: a stage is identified by its melee id, so re-importing the same
 * URL refreshes that stage's results in place instead of duplicating them.
 */
import { prisma } from "@/lib/prisma";
import type { ScrapedMplResult } from "@/lib/melee";
import { MPL_SEASON } from "./queries";

export type MplImportResult = {
  stageId: number;
  ordinal: number;
  results: number;
  /** True when an existing stage was refreshed rather than created. */
  replaced: boolean;
};

export async function addMplOpen(opts: {
  season?: number;
  ordinal: number;
  meleeId: string;
  name: string;
  date: Date | null;
  /** Team events (Trios) are recorded but excluded from the points ranking. */
  isTeamEvent: boolean;
  results: ScrapedMplResult[];
}): Promise<MplImportResult> {
  const {
    season = MPL_SEASON,
    ordinal,
    meleeId,
    name,
    date,
    isTeamEvent,
    results,
  } = opts;

  const kind = "open";
  const format = isTeamEvent ? "trios" : "individual";

  // Guard the (season, kind, ordinal) unique key: refuse to silently overwrite a
  // *different* tournament that already owns this stage number.
  const clash = await prisma.mplStage.findFirst({
    where: { season, kind, ordinal, NOT: { meleeId } },
    select: { meleeId: true, name: true },
  });
  if (clash) {
    throw new Error(
      `Stage ${ordinal} of season ${season} is already "${clash.name}" ` +
        `(melee id ${clash.meleeId}). Pick a different stage number, or re-import ` +
        `that tournament to refresh it.`,
    );
  }

  const existing = await prisma.mplStage.findFirst({
    where: { season, meleeId },
    select: { id: true },
  });

  const stage = existing
    ? await prisma.mplStage.update({
        where: { id: existing.id },
        data: {
          ordinal,
          name,
          date,
          format,
          countsForRanking: !isTeamEvent,
          playerCount: results.length,
        },
        select: { id: true },
      })
    : await prisma.mplStage.create({
        data: {
          season,
          kind,
          ordinal,
          name,
          date,
          meleeId,
          format,
          countsForRanking: !isTeamEvent,
          playerCount: results.length,
        },
        select: { id: true },
      });

  // Replace this stage's results wholesale — a re-import is a refresh, and
  // melee can revise standings (a fixed result, a late drop).
  await prisma.$transaction([
    prisma.mplResult.deleteMany({ where: { stageId: stage.id } }),
    prisma.mplResult.createMany({
      data: results.map((r) => ({
        stageId: stage.id,
        username: r.username,
        player: r.player,
        rank: r.rank,
        record: r.record,
        points: r.points,
        omw: r.omw,
        tgw: r.tgw,
        ogw: r.ogw,
      })),
    }),
  ]);

  return {
    stageId: stage.id,
    ordinal,
    results: results.length,
    replaced: Boolean(existing),
  };
}
