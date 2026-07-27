import Link from "next/link";
import { MplRankingTable } from "@/components/mpl/MplRankingTable";
import { MplStagesList } from "@/components/mpl/MplStagesList";
import { MplClassifiedTable } from "@/components/mpl/MplClassifiedTable";
import {
  getClassified,
  getOpensRanking,
  getStages,
  MPL_SEASON,
} from "@/lib/mpl/queries";
import { t, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

type View = "ranking" | "stages" | "classified";
const VIEWS: { id: View; key: TranslationKey }[] = [
  { id: "ranking", key: "mpl.view.ranking" },
  { id: "stages", key: "mpl.view.stages" },
  { id: "classified", key: "mpl.view.classified" },
];

export default async function MplPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;
  const view = (first(sp.view) as View) || "ranking";
  const hideClassified = first(sp.hc) === "1";

  const tabActive =
    "rounded-md bg-[#8b2fb0] px-3.5 py-1.5 text-sm font-semibold text-white";
  const tabInactive =
    "rounded-md border border-neutral-300 px-3.5 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

  return (
    <div>
      {/* MPL identity header — purple + gold */}
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b2fb0] to-[#5a1e73] text-sm font-black tracking-tight text-white shadow-sm ring-1 ring-[#d4a72c]/40">
          MPL
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
            {t(locale, "mpl.title")}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {t(locale, "mpl.subtitle", { season: MPL_SEASON })}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/mpl?view=${v.id}`}
            className={view === v.id ? tabActive : tabInactive}
          >
            {t(locale, v.key)}
          </Link>
        ))}
      </div>

      {view === "ranking" && (
        <MplRankingTable
          ranking={await getOpensRanking({ hideClassified })}
          locale={locale}
        />
      )}
      {view === "stages" && (
        <MplStagesList stages={await getStages()} locale={locale} />
      )}
      {view === "classified" && (
        <MplClassifiedTable rows={await getClassified()} locale={locale} />
      )}
    </div>
  );
}
