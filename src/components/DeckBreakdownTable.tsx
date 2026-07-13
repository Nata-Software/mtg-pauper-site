import Link from "next/link";
import { prettyDeck, type DeckBreakdown } from "@/lib/stats";
import { t, type Locale } from "@/lib/i18n";

function pctP(n: number): string {
  return `${parseFloat((n * 100).toFixed(2))}%`;
}

export function DeckBreakdownTable({
  player,
  rows,
  backHref,
  locale,
}: {
  player: string;
  rows: DeckBreakdown[];
  backHref: string;
  locale: Locale;
}) {
  const total = rows.reduce((n, r) => n + r.matches, 0);

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            {t(locale, "deck.titlePrefix")} —{" "}
            <span className="text-violet-600 dark:text-violet-400">{player}</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t(locale, "deck.subtitle", {
              total: total.toLocaleString(),
              count: rows.length,
              deckWord: t(
                locale,
                rows.length === 1 ? "deck.deckWord.singular" : "deck.deckWord.plural",
              ),
            })}
          </p>
        </div>
        <Link
          href={backHref}
          className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {t(locale, "deck.back")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {t(locale, "deck.noMatches")}
        </p>
      ) : (
        <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <th className="px-3 py-2">{t(locale, "table.deck")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.matches")}</th>
                <th className="px-3 py-2 text-center">{t(locale, "table.wld")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.winPct")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.lossPct")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "table.drawPct")}</th>
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
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-violet-600 dark:text-violet-400">
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
