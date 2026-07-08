import type { StandingStat } from "@/lib/stats";
import { t, type Locale } from "@/lib/i18n";

const MEDAL_CLS: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-neutral-300 text-neutral-800",
  3: "bg-orange-400 text-orange-950",
};

function PositionBadge({ position }: { position: number }) {
  const medal = MEDAL_CLS[position];
  if (!medal) {
    return (
      <span className="flex h-6 w-6 items-center justify-center text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
        {position}
      </span>
    );
  }
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${medal}`}
    >
      {position}
    </span>
  );
}

export function LeagueTable({
  title,
  stats,
  locale,
}: {
  title: string;
  stats: StandingStat[];
  locale: Locale;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-neutral-950 dark:text-white">{title}</h2>

      {stats.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {t(locale, "league.noData")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <th className="w-12 px-3 py-2 text-center">#</th>
                <th className="px-3 py-2">{t(locale, "table.player")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.points")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const position = i + 1;
                const isTop3 = position <= 3;
                return (
                  <tr
                    key={s.player}
                    className={
                      isTop3
                        ? "border-t border-neutral-200 bg-amber-50/60 dark:border-neutral-800/60 dark:bg-amber-950/10"
                        : "border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
                    }
                  >
                    <td className="px-3 py-1.5">
                      <PositionBadge position={position} />
                    </td>
                    <td
                      className={
                        isTop3
                          ? "px-3 py-1.5 font-semibold"
                          : "px-3 py-1.5 font-medium"
                      }
                    >
                      {s.player}
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-violet-600 dark:text-violet-400">
                      {s.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
