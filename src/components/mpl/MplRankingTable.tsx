import Link from "next/link";
import type { OpensRanking } from "@/lib/mpl/queries";
import { t, type Locale } from "@/lib/i18n";

function shortStage(name: string, ordinal: number): string {
  // Prefer a compact "Nº" label; fall back to the ordinal.
  const m = name.match(/^(\d+)\s*[º°ª]/);
  return m ? `${m[1]}º` : `${ordinal}º`;
}

export function MplRankingTable({
  ranking,
  locale,
}: {
  ranking: OpensRanking;
  locale: Locale;
}) {
  const { stages, rows, cutoff, hideClassified } = ranking;

  const toggleHref = hideClassified ? "/mpl?view=ranking" : "/mpl?view=ranking&hc=1";
  const toggleLabel = hideClassified
    ? t(locale, "mpl.ranking.show")
    : t(locale, "mpl.ranking.hide");

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">
          {t(locale, "mpl.ranking.subtitle", { spots: cutoff })}
        </p>
        <Link
          href={toggleHref}
          className={
            hideClassified
              ? "shrink-0 rounded-md bg-[#8b2fb0] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#7a299b]"
              : "shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          }
        >
          {toggleLabel}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t(locale, "mpl.noData")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">{t(locale, "table.player")}</th>
                {stages.map((s) => (
                  <th key={s.id} className="px-2 py-2.5 text-right" title={s.name}>
                    {shortStage(s.name, s.ordinal)}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right">{t(locale, "mpl.col.events")}</th>
                <th className="px-3 py-2.5 text-right">{t(locale, "mpl.col.avgRank")}</th>
                <th className="px-3 py-2.5 text-right font-bold">{t(locale, "table.points")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {rows.map((r, i) => {
                const lastQualifier =
                  hideClassified && r.qualifies && !rows[i + 1]?.qualifies;
                return (
                  <tr
                    key={r.username}
                    className={
                      (r.qualifies
                        ? "bg-[#8b2fb0]/[0.06] dark:bg-[#c77dff]/[0.08] "
                        : "") +
                      (lastQualifier
                        ? "border-b-2 border-b-[#d4a72c] dark:border-b-[#e6c04d]"
                        : "")
                    }
                  >
                    <td className="px-3 py-2.5 text-neutral-400 dark:text-neutral-500">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-neutral-950 dark:text-white">
                        {r.player}
                      </span>
                      {r.qualifies && (
                        <span className="ml-2 rounded-full bg-[#8b2fb0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          {t(locale, "mpl.badge.qualifies")}
                        </span>
                      )}
                      {r.classified && !r.qualifies && (
                        <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          {t(locale, "mpl.badge.classified")}
                        </span>
                      )}
                    </td>
                    {stages.map((s) => {
                      const cell = r.perStage[s.ordinal];
                      return (
                        <td
                          key={s.id}
                          className="px-2 py-2.5 text-right text-neutral-500 dark:text-neutral-400"
                        >
                          {cell ? cell.points : <span className="text-neutral-300 dark:text-neutral-700">·</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right text-neutral-500 dark:text-neutral-400">
                      {r.plays}
                    </td>
                    <td className="px-3 py-2.5 text-right text-neutral-500 dark:text-neutral-400">
                      {r.avgRank.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-base font-bold text-neutral-950 dark:text-white">
                      {r.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hideClassified && rows.some((r) => r.qualifies) && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="mr-2 inline-block h-2 w-4 rounded-sm bg-[#8b2fb0]/40 align-middle" />
          {t(locale, "mpl.cutoff", { spots: cutoff })}
        </p>
      )}
    </section>
  );
}
