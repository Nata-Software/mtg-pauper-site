import Link from "next/link";

import type { PlayerStat } from "@/lib/stats";
import { t, type Locale } from "@/lib/i18n";

export type PlayerSortKey =
  | "player"
  | "matches"
  | "winPct"
  | "lossPct"
  | "drawPct";

export type SortDir = "asc" | "desc";

function pctP(n: number): string {
  return `${parseFloat((n * 100).toFixed(2))}%`;
}

function comparePlayers(
  a: PlayerStat,
  b: PlayerStat,
  sortKey: PlayerSortKey,
  sortDir: SortDir,
): number {
  let result = 0;

  if (sortKey === "player") {
    result = a.player.localeCompare(b.player);
  } else {
    result = a[sortKey] - b[sortKey];
  }

  if (result !== 0) {
    return sortDir === "asc" ? result : -result;
  }

  // Tie-breakers keep sorting predictable when two values are equal.
  if (a.matches !== b.matches) {
    return b.matches - a.matches;
  }

  return a.player.localeCompare(b.player);
}

function nextSortDir(
  currentKey: PlayerSortKey,
  currentDir: SortDir,
  clickedKey: PlayerSortKey,
): SortDir {
  if (currentKey !== clickedKey) {
    return "desc";
  }

  return currentDir === "desc" ? "asc" : "desc";
}

function sortIndicator(
  currentKey: PlayerSortKey,
  currentDir: SortDir,
  key: PlayerSortKey,
): string {
  if (currentKey !== key) {
    return "";
  }

  return currentDir === "desc" ? " ↓" : " ↑";
}

function joinUrl(baseHref: string, params: URLSearchParams): string {
  const separator = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${separator}${params.toString()}`;
}

export function PlayerTable({
  title,
  subtitle,
  stats,
  limit = 100,
  hrefFor,
  selected,
  sortKey = "matches",
  sortDir = "desc",
  baseHref = "/standings?view=year",
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
  sortKey?: PlayerSortKey;
  sortDir?: SortDir;
  /** Base URL used by sortable table headers, without sort/dir params. */
  baseHref?: string;
  locale: Locale;
}) {
  const sorted = [...stats].sort((a, b) =>
    comparePlayers(a, b, sortKey, sortDir),
  );

  const shown = sorted.slice(0, limit);

  const headerHref = (key: PlayerSortKey) => {
    const params = new URLSearchParams({
      sort: key,
      dir: nextSortDir(sortKey, sortDir, key),
    });

    return joinUrl(baseHref, params);
  };

  const headerClass =
    "inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-50";

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
                <th className="px-3 py-2">
                  <Link href={headerHref("player")} className={headerClass}>
                    {t(locale, "table.player")}
                    {sortIndicator(sortKey, sortDir, "player")}
                  </Link>
                </th>
                <th className="px-3 py-2 text-right">
                  <Link href={headerHref("matches")} className={headerClass}>
                    {t(locale, "table.matches")}
                    {sortIndicator(sortKey, sortDir, "matches")}
                  </Link>
                </th>
                <th className="px-3 py-2 text-right">
                  <Link href={headerHref("winPct")} className={headerClass}>
                    {t(locale, "table.winPct")}
                    {sortIndicator(sortKey, sortDir, "winPct")}
                  </Link>
                </th>
                <th className="px-3 py-2 text-right">
                  <Link href={headerHref("lossPct")} className={headerClass}>
                    {t(locale, "table.lossPct")}
                    {sortIndicator(sortKey, sortDir, "lossPct")}
                  </Link>
                </th>
                <th className="px-3 py-2 text-right">
                  <Link href={headerHref("drawPct")} className={headerClass}>
                    {t(locale, "table.drawPct")}
                    {sortIndicator(sortKey, sortDir, "drawPct")}
                  </Link>
                </th>
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
