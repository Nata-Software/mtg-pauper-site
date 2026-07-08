import Link from "next/link";
import type { PlayerStat } from "@/lib/stats";
import { t, type Locale } from "@/lib/i18n";

function pctP(n: number): string {
  return `${parseFloat((n * 100).toFixed(2))}%`;
}

export function PlayerTable({
  title,
  subtitle,
  stats,
  limit = 100,
  hrefFor,
  selected,
  locale,
}: {
  title: string;
  subtitle: string;
  stats: PlayerStat[];
  limit?: number;
  /** When provided, player names link here (for the per-deck drill-down). */
  hrefFor?: (player: string) => string;
  /** Currently drilled-into player, highlighted in the list. */
  selected?: string;
  locale: Locale;
}) {
  const shown = stats.slice(0, limit);

  return (
    <section className="mb-8">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">{title}</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {t(locale, "table.noMatchesPeriod")}
        </p>
      ) : (
        <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <th className="px-3 py-2">{t(locale, "table.player")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.matches")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.winPct")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.lossPct")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.drawPct")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const isSel = selected === s.player;
                return (
                  <tr
                    key={s.player}
                    className={
                      isSel
                        ? "border-t border-neutral-200 bg-violet-100/50 dark:border-neutral-800/60 dark:bg-violet-950/40"
                        : "border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
                    }
                  >
                    <td className="px-3 py-1.5 font-medium">
                      {hrefFor ? (
                        <Link
                          href={hrefFor(s.player)}
                          className="text-violet-600 hover:underline dark:text-violet-400"
                        >
                          {s.player}
                        </Link>
                      ) : (
                        s.player
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                      {s.matches.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                      {pctP(s.winPct)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                      {pctP(s.lossPct)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                      {pctP(s.drawPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {stats.length > shown.length && (
        <p className="mt-1 text-right text-xs text-neutral-400 dark:text-neutral-500">
          {t(locale, "table.showingTop", {
            shown: shown.length,
            total: stats.length.toLocaleString(),
          })}
        </p>
      )}
    </section>
  );
}
