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
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        {position}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${medal}`}
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
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-xl font-bold text-neutral-950 dark:text-white">
        {title}
      </h2>

      {stats.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          {t(locale, "league.noData")}
        </p>
      ) : (
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">{t(locale, "table.player")}</th>
                <th className="px-2 py-2 text-right">
                  {t(locale, "table.points")}
                </th>
                <th className="px-2 py-2 text-right">Participations</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {stats.map((s, i) => {
                const position = i + 1;

                return (
                  <tr key={s.player}>
                    <td className="px-2 py-3">
                      <PositionBadge position={position} />
                    </td>
                    <td className="px-2 py-3 font-semibold text-neutral-950 dark:text-white">
                      {s.player}
                    </td>
                    <td className="px-2 py-3 text-right font-bold">
                      {s.points}
                    </td>
                    <td className="px-2 py-3 text-right">
                      {s.participations.toLocaleString()}
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
