import type { StandingStat } from "@/lib/stats";
import { t, type Locale } from "@/lib/i18n";

function pctP(n: number): string {
  return `${parseFloat((n * 100).toFixed(2))}%`;
}

export function StandingsTable({
  stats,
  locale,
}: {
  stats: StandingStat[];
  locale: Locale;
}) {
  if (stats.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {t(locale, "table.noMatchesMonth")}
      </p>
    );
  }

  return (
    <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <th className="px-3 py-2 text-right">#</th>
            <th className="px-3 py-2">{t(locale, "table.player")}</th>
            <th className="px-3 py-2 text-right">{t(locale, "table.points")}</th>
            <th className="px-3 py-2 text-right">{t(locale, "table.matches")}</th>
            <th className="px-3 py-2 text-center">{t(locale, "table.wld")}</th>
            <th className="px-3 py-2 text-right">{t(locale, "table.winPct")}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr
              key={s.player}
              className="border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
            >
              <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                {i + 1}
              </td>
              <td className="px-3 py-1.5 font-medium">{s.player}</td>
              <td className="px-3 py-1.5 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {s.points}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                {s.matches}
              </td>
              <td className="px-3 py-1.5 text-center tabular-nums text-neutral-500 dark:text-neutral-400">
                {s.wins}–{s.losses}–{s.draws}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                {pctP(s.winPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
