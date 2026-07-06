import Link from "next/link";
import { prettyDeck, type DeckBreakdown } from "@/lib/stats";

function pctP(n: number): string {
  return `${parseFloat((n * 100).toFixed(2))}%`;
}

export function DeckBreakdownTable({
  player,
  rows,
  backHref,
}: {
  player: string;
  rows: DeckBreakdown[];
  backHref: string;
}) {
  const total = rows.reduce((n, r) => n + r.matches, 0);

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            Win rate by deck — <span className="text-emerald-600 dark:text-emerald-400">{player}</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {total.toLocaleString()} matches across {rows.length} deck
            {rows.length === 1 ? "" : "s"}. Byes included.
          </p>
        </div>
        <Link
          href={backHref}
          className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          ← Back to players
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          No matches for this player in this period.
        </p>
      ) : (
        <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <th className="px-3 py-2">Deck</th>
                <th className="px-3 py-2 text-right">Matches</th>
                <th className="px-3 py-2 text-center">W–L–D</th>
                <th className="px-3 py-2 text-right">Win %</th>
                <th className="px-3 py-2 text-right">Loss %</th>
                <th className="px-3 py-2 text-right">Draw %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.deck}
                  className="border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
                >
                  <td className="px-3 py-1.5 font-medium">{prettyDeck(r.deck)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                    {r.matches.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-neutral-500 dark:text-neutral-400">
                    {r.wins}–{r.losses}–{r.draws}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {pctP(r.winPct)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                    {pctP(r.lossPct)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                    {pctP(r.drawPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
