import Link from "next/link";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";
import type { DeckMatchLogRow } from "@/lib/queries";

const RESULT_KEY: Record<string, TranslationKey> = {
  win: "metagame.result.win",
  loss: "metagame.result.loss",
  draw: "metagame.result.draw",
};

const RESULT_CLASS: Record<string, string> = {
  win: "text-emerald-600 dark:text-emerald-400",
  loss: "text-red-600 dark:text-red-400",
  draw: "text-neutral-500 dark:text-neutral-400",
};

function resultLabel(result: string, locale: Locale): string {
  const key = RESULT_KEY[result.trim().toLowerCase()];
  return key ? t(locale, key) : result;
}

function resultClass(result: string): string {
  return (
    RESULT_CLASS[result.trim().toLowerCase()] ??
    "text-neutral-500 dark:text-neutral-400"
  );
}

export function DeckMatchLog({
  deck,
  rows,
  backHref,
  locale,
}: {
  deck: string;
  rows: DeckMatchLogRow[];
  backHref: string;
  locale: Locale;
}) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
          {t(locale, "metagame.matchLog.title", { deck })}
        </h2>
        <Link
          href={backHref}
          className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {t(locale, "metagame.matchLog.back")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {t(locale, "metagame.matchLog.empty")}
        </p>
      ) : (
        <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                <th className="px-3 py-2">{t(locale, "metagame.col.date")}</th>
                <th className="px-3 py-2">{t(locale, "metagame.col.tournament")}</th>
                <th className="px-3 py-2">{t(locale, "metagame.col.player")}</th>
                <th className="px-3 py-2">{t(locale, "metagame.col.opponent")}</th>
                <th className="px-3 py-2">{t(locale, "metagame.col.opponentDeck")}</th>
                <th className="px-3 py-2 text-right">{t(locale, "metagame.col.result")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.date}-${r.player}-${r.opponent}-${i}`}
                  className="border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
                >
                  <td className="px-3 py-1.5 tabular-nums text-neutral-600 dark:text-neutral-300">
                    {r.date || "—"}
                  </td>
                  <td className="px-3 py-1.5 font-medium">{r.tournamentName}</td>
                  <td className="px-3 py-1.5">{r.player}</td>
                  <td className="px-3 py-1.5">{r.opponent}</td>
                  <td className="px-3 py-1.5">{r.opponentDeck}</td>
                  <td className={`px-3 py-1.5 text-right font-semibold ${resultClass(r.result)}`}>
                    {resultLabel(r.result, locale)}
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
