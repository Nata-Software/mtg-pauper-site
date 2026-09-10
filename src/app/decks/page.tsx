import Link from "next/link";

import { listDecks } from "@/lib/cards/queries";
import { getLocale } from "@/lib/i18n.server";

export const dynamic = "force-dynamic";

/**
 * Metagame grid with a decklist behind every tile.
 *
 * Hidden while we evaluate it: reachable by URL, deliberately absent from
 * ResponsiveNav (same as /admin/upload). Intended to become the landing page,
 * with the matchup matrix moving off "/".
 */
export default async function DecksPage() {
  const locale = await getLocale();
  const pt = locale === "pt-BR";

  const decks = (await listDecks("default")).filter((d) => d.matches > 0);
  const totalMatches = decks.reduce((n, d) => n + d.matches, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
        {pt ? "Metagame Pauper" : "Pauper Metagame"}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {decks.length} {pt ? "decks" : "decks"} ·{" "}
        {totalMatches.toLocaleString()} {pt ? "partidas" : "matches"}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {decks.map((d) => {
          const share = totalMatches ? (100 * d.matches) / totalMatches : 0;
          const winPct = d.matches ? (100 * d.wins) / d.matches : 0;

          return (
            <Link
              key={d.deck}
              href={`/decks/${encodeURIComponent(d.deck)}`}
              className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
            >
              <h2 className="font-semibold text-violet-700 group-hover:underline dark:text-violet-400">
                {d.deck}
              </h2>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400">
                    {pt ? "META%" : "META%"}
                  </dt>
                  <dd className="font-bold tabular-nums text-neutral-950 dark:text-white">
                    {share.toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400">
                    {pt ? "Vitórias" : "Win%"}
                  </dt>
                  <dd className="font-bold tabular-nums text-neutral-950 dark:text-white">
                    {winPct.toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500 dark:text-neutral-400">
                    {pt ? "Partidas" : "Matches"}
                  </dt>
                  <dd className="font-bold tabular-nums text-neutral-950 dark:text-white">
                    {d.matches.toLocaleString()}
                  </dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
