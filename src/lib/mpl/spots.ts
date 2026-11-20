/**
 * Awarding and managing MPL Final spots.
 *
 * A spot is a seat in the Final. Most come from an Open — normally the top two
 * finishers — but a finisher who already holds a spot (or turns it down) passes
 * it to the next player down, so the list cannot simply be "top 2". The TO
 * decides, and this module gives the admin screen the ranked candidates with
 * the cascade already applied as a starting point.
 *
 * Spots also arrive from partner stores and parallel rankings with no melee
 * event behind them at all, so a spot can be created from a name alone.
 *
 * Writes touch MplSpot only. MPL results must never reach the weekly matchup
 * tables — see scripts/split-mpl-events.mjs for the cleanup when they once did.
 */
import { prisma } from "@/lib/prisma";
import { MPL_SEASON } from "./queries";
import { normUsername } from "./normalize";
import { classifySource } from "./normalize";

/** Spots an Open normally awards. The TO can change it per event. */
export const DEFAULT_OPEN_SPOTS = 2;

export type AwardCandidate = {
  rank: number;
  username: string;
  player: string;
  record: string | null;
  points: number;
  /** Already holds a spot from any source — the cascade skips these. */
  alreadyClassified: boolean;
  /** Already recorded as a spot winner for this very stage. */
  spotHere: boolean;
};

export type StageForAwarding = {
  id: number;
  ordinal: number;
  name: string;
  date: Date | null;
  candidates: AwardCandidate[];
  /** Top finishers not already classified — the cascade, pre-applied. */
  suggested: string[];
};

/**
 * One Open's standings, annotated for the spot picker.
 *
 * `suggested` walks the standings from the top and takes the first `count`
 * players who don't already hold a spot — exactly the cascade the regulamento
 * describes — but it is only a default; the form submits whatever is ticked.
 */
export async function getStageForAwarding(
  ordinal: number,
  season = MPL_SEASON,
  count = DEFAULT_OPEN_SPOTS,
): Promise<StageForAwarding | null> {
  const stage = await prisma.mplStage.findFirst({
    where: { season, kind: "open", ordinal },
    include: { results: { orderBy: { rank: "asc" } } },
  });
  if (!stage) return null;

  const spots = await prisma.mplSpot.findMany({
    where: { season },
    select: { meleeUsername: true, stageId: true },
  });

  const classified = new Set(
    spots.map((s) => s.meleeUsername).filter(Boolean) as string[],
  );
  const here = new Set(
    spots
      .filter((s) => s.stageId === stage.id)
      .map((s) => s.meleeUsername)
      .filter(Boolean) as string[],
  );

  const candidates: AwardCandidate[] = stage.results.map((r) => ({
    rank: r.rank,
    username: r.username,
    player: r.player,
    record: r.record,
    points: r.points,
    alreadyClassified: classified.has(r.username),
    spotHere: here.has(r.username),
  }));

  const suggested: string[] = [];
  for (const c of candidates) {
    if (suggested.length >= count) break;
    if (!c.alreadyClassified) suggested.push(c.username);
  }

  return {
    id: stage.id,
    ordinal: stage.ordinal,
    name: stage.name,
    date: stage.date,
    candidates,
    suggested,
  };
}

/** Next free row number in the spot list. */
async function nextOrdinal(season: number): Promise<number> {
  const top = await prisma.mplSpot.findFirst({
    where: { season },
    orderBy: { ordinal: "desc" },
    select: { ordinal: true },
  });
  return (top?.ordinal ?? 0) + 1;
}

/**
 * Record the spot winners for one Open.
 *
 * Replaces whatever was recorded for that stage, so re-picking after a player
 * declines corrects the list instead of stacking a second set of winners on
 * top. The melee username is kept, which is what lets the Opens Ranking know
 * this player is already in and cascade past them.
 */
export async function awardOpenSpots(opts: {
  stageOrdinal: number;
  usernames: string[];
  season?: number;
}): Promise<{ added: number; removed: number; stage: string }> {
  const season = opts.season ?? MPL_SEASON;
  const stage = await prisma.mplStage.findFirst({
    where: { season, kind: "open", ordinal: opts.stageOrdinal },
    include: { results: true },
  });
  if (!stage) throw new Error(`No Open with stage number ${opts.stageOrdinal}.`);

  const wanted = new Set(opts.usernames.map(normUsername).filter(Boolean));
  const byUsername = new Map(stage.results.map((r) => [r.username, r]));

  for (const u of wanted) {
    if (!byUsername.has(u)) {
      throw new Error(`"${u}" did not play ${stage.name}.`);
    }
  }

  const removed = await prisma.mplSpot.deleteMany({
    where: { season, stageId: stage.id },
  });

  let ordinal = await nextOrdinal(season);
  const source = `${stage.ordinal}º Open MPL - Mont`;
  let added = 0;

  // Insert in finishing order so the list reads the way the standings did.
  for (const u of [...wanted].sort(
    (a, b) => (byUsername.get(a)!.rank ?? 0) - (byUsername.get(b)!.rank ?? 0),
  )) {
    const r = byUsername.get(u)!;
    await prisma.mplSpot.create({
      data: {
        season,
        ordinal: ordinal++,
        player: r.player || r.username,
        meleeUsername: r.username,
        stageId: stage.id,
        source,
        sourceType: "open",
        store: "Mont",
        date: stage.date,
        standingsRef: `Standings ${stage.ordinal}º Open MPL`,
      },
    });
    added++;
  }

  return { added, removed: removed.count, stage: stage.name };
}

/**
 * A spot with no melee event behind it — a partner store, a parallel ranking,
 * a last-chance qualifier. Only the name and where it came from are required.
 */
export async function addManualSpot(opts: {
  player: string;
  source: string;
  date?: string | null;
  season?: number;
}): Promise<{ ordinal: number; player: string }> {
  const season = opts.season ?? MPL_SEASON;
  const player = opts.player.trim();
  const source = opts.source.trim();

  if (!player) throw new Error("Enter the player's name.");
  if (!source) throw new Error("Enter where the spot came from.");

  const { sourceType, store } = classifySource(source);
  const ordinal = await nextOrdinal(season);

  await prisma.mplSpot.create({
    data: {
      season,
      ordinal,
      player,
      source,
      sourceType,
      store,
      date: opts.date ? new Date(`${opts.date}T12:00:00.000Z`) : null,
      standingsRef: source,
    },
  });

  return { ordinal, player };
}

export async function removeSpot(id: number): Promise<{ player: string }> {
  const spot = await prisma.mplSpot.delete({ where: { id } });
  return { player: spot.player };
}

/** The whole spot list, newest row last, for the admin table. */
export async function listSpots(season = MPL_SEASON) {
  return prisma.mplSpot.findMany({
    where: { season },
    orderBy: { ordinal: "asc" },
    select: {
      id: true,
      ordinal: true,
      player: true,
      source: true,
      sourceType: true,
      date: true,
      meleeUsername: true,
      stageId: true,
    },
  });
}
