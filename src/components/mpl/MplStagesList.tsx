import type { MplStageView } from "@/lib/mpl/queries";
import { t, type Locale } from "@/lib/i18n";

const TOP_N = 8;

function fmtDate(date: Date | null, locale: Locale): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(
    locale === "pt-BR" ? "pt-BR" : "en-US",
    { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" },
  );
}

export function MplStagesList({
  stages,
  locale,
}: {
  stages: MplStageView[];
  locale: Locale;
}) {
  if (stages.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t(locale, "mpl.noData")}
      </p>
    );
  }

  return (
    <section className="space-y-5">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t(locale, "mpl.stages.subtitle")}
      </p>

      {stages.map((s) => {
        const extra = s.results.length - TOP_N;
        return (
          <div
            key={s.id}
            className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-gradient-to-r from-[#8b2fb0]/[0.08] to-transparent px-4 py-3 dark:border-neutral-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[#8b2fb0] px-1.5 text-xs font-bold text-white">
                    {s.ordinal}º
                  </span>
                  <h3 className="truncate font-bold text-neutral-950 dark:text-white">
                    {s.name}
                  </h3>
                </div>
                <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {fmtDate(s.date, locale)}
                  {s.playerCount ? ` · ${s.playerCount} ${t(locale, "mpl.stages.players")}` : ""}
                  {s.format === "trios" ? ` · ${t(locale, "mpl.stages.trios")}` : ""}
                </div>
              </div>
              {s.meleeId && (
                <a
                  href={`https://melee.gg/Tournament/View/${s.meleeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-[#8b2fb0] hover:underline dark:text-[#c77dff]"
                >
                  {t(locale, "mpl.stages.viewMelee")} ↗
                </a>
              )}
            </div>

            {s.spotWinners.length > 0 && (
              <div className="border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-900">
                <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-[#8b2fb0] dark:text-[#c77dff]">
                  {t(locale, "mpl.stages.spotWinners")}:
                </span>
                <span className="inline-flex flex-wrap gap-1.5 align-middle">
                  {s.spotWinners.map((w) => (
                    <span
                      key={w.ordinal}
                      className="rounded-full border border-[#d4a72c]/50 bg-[#d4a72c]/10 px-2.5 py-0.5 text-xs font-medium text-neutral-800 dark:text-neutral-100"
                    >
                      {w.player}
                    </span>
                  ))}
                </span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm tabular-nums">
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                  {s.results.slice(0, TOP_N).map((r) => (
                    <tr key={`${s.id}-${r.rank}-${r.username}`}>
                      <td className="w-10 px-3 py-2 text-neutral-400 dark:text-neutral-500">
                        {r.rank}
                      </td>
                      <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                        {r.player}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-500 dark:text-neutral-400">
                        {r.record}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-neutral-950 dark:text-white">
                        {r.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {extra > 0 && (
              <div className="px-3 py-2 text-xs text-neutral-400 dark:text-neutral-500">
                {t(locale, "mpl.stages.more", { n: extra })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
