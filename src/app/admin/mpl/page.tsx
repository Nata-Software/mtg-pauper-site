import { MplAdmin } from "@/components/mpl/MplAdmin";
import { getStages, MPL_SEASON } from "@/lib/mpl/queries";
import {
  DEFAULT_OPEN_SPOTS,
  getStageForAwarding,
  listSpots,
} from "@/lib/mpl/spots";
import { getLocale } from "@/lib/i18n.server";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * MPL admin: import an Open, award its Final spots, and record spots won
 * elsewhere.
 *
 * Off-menu like /admin/upload. The page itself only shows what /mpl already
 * shows publicly; every write goes through /api/mpl/spots and /api/scrape,
 * which check the admin password per request.
 *
 * The chosen Open is a query param rather than client state so its standings
 * are server-rendered with the cascade already applied — no loading spinner
 * between picking the event and seeing who should get the spots.
 */
export default async function MplAdminPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;

  const stages = await getStages();
  const askedStage = Number(first(sp.stage));
  const chosen = Number.isInteger(askedStage) ? askedStage : null;
  const count = Number(first(sp.spots)) || DEFAULT_OPEN_SPOTS;

  const [awarding, spots] = await Promise.all([
    chosen ? getStageForAwarding(chosen, MPL_SEASON, count) : null,
    listSpots(),
  ]);

  return (
    <MplAdmin
      locale={locale}
      season={MPL_SEASON}
      stages={stages.map((s) => ({
        ordinal: s.ordinal,
        name: s.name,
        date: s.date ? s.date.toISOString().slice(0, 10) : null,
        players: s.results.length,
        spotWinners: s.spotWinners.map((w) => w.player),
      }))}
      awarding={
        awarding && {
          ...awarding,
          date: awarding.date ? awarding.date.toISOString().slice(0, 10) : null,
        }
      }
      spotCount={count}
      spots={spots.map((s) => ({
        ...s,
        date: s.date ? s.date.toISOString().slice(0, 10) : null,
      }))}
    />
  );
}
