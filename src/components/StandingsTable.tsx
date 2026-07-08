import Link from "next/link";

import type { StandingStat } from "@/lib/stats";
import { t, type Locale } from "@/lib/i18n";

export type StandingSortKey = "player" | "points" | "matches" | "winPct";
export type StandingSortDir = "asc" | "desc";

function pctP(n: number): string {
  return `${parseFloat((n * 100).toFixed(2))}%`;
}

function compareStandings(
  a: StandingStat,
  b: StandingStat,
  sortKey: StandingSortKey,
  sortDir: StandingSortDir,
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

  // Stable tie-breakers.
  if (a.points !== b.points) return b.points - a.points;
  if (a.winPct !== b.winPct) return b.winPct - a.winPct;
  if (a.matches !== b.matches) return b.matches - a.matches;

  return a.player.localeCompare(b.player);
}

function nextSortDir(
  currentKey: StandingSortKey,
  currentDir: StandingSortDir,
  clickedKey: StandingSortKey,
): StandingSortDir {
  if (currentKey !== clickedKey) {
    return "desc";
  }

  return currentDir === "desc" ? "asc" : "desc";
}

function sortIndicator(
  currentKey: StandingSortKey,
  currentDir: StandingSortDir,
  key: StandingSortKey,
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

export function StandingsTable({
  stats,
  sortKey = "points",
  sortDir = "desc",
  baseHref,
  locale,
}: {
  stats: StandingStat[];
  sortKey?: StandingSortKey;
  sortDir?: StandingSortDir;
  baseHref: string;
  locale: Locale;
}) {
  if (stats.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {t(locale, "table.noMatchesMonth")}
      </p>
    );
  }

  const sorted = [...stats].sort((a, b) =>
    compareStandings(a, b, sortKey, sortDir),
  );

  const headerHref = (key: StandingSortKey) => {
    const params = new URLSearchParams({
      sort: key,
      dir: nextSortDir(sortKey, sortDir, key),
    });

    return joinUrl(baseHref, params);
  };

  const headerClass =
    "inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-50";

  return (
    <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <th className="px-3 py-2 text-right">#</th>
            <th className="px-3 py-2">
              <Link href={headerHref("player")} className={headerClass}>
                {t(locale, "table.player")}
                {sortIndicator(sortKey, sortDir, "player")}
              </Link>
            </th>
            <th className="px-3 py-2 text-right">
              <Link href={headerHref("points")} className={headerClass}>
                {t(locale, "table.points")}
                {sortIndicator(sortKey, sortDir, "points")}
              </Link>
            </th>
            <th className="px-3 py-2 text-right">
              <Link href={headerHref("matches")} className={headerClass}>
                {t(locale, "table.matches")}
                {sortIndicator(sortKey, sortDir, "matches")}
              </Link>
            </th>
            <th className="px-3 py-2 text-center">{t(locale, "table.wld")}</th>
            <th className="px-3 py-2 text-right">
              <Link href={headerHref("winPct")} className={headerClass}>
                {t(locale, "table.winPct")}
                {sortIndicator(sortKey, sortDir, "winPct")}
              </Link>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr
              key={s.player}
              className="border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
            >
              <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                {i + 1}
              </td>
              <td className="px-3 py-1.5 font-medium">{s.player}</td>
              <td className="px-3 py-1.5 text-right font-bold tabular-nums text-violet-600 dark:text-violet-400">
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
