import Link from "next/link";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/CardLink";
import { getDecklist, groupDeckCards, listDecks } from "@/lib/cards/queries";
import { getLocale } from "@/lib/i18n.server";
import { toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * One archetype's most recent decklist.
 *
 * Hidden while we evaluate it: reachable by URL, deliberately absent from
 * ResponsiveNav (same as /admin/upload). The plan is for this to become the
 * landing page once it's proven.
 */
export default async function DeckPage({
  params,
}: {
  params: Promise<{ deck: string }>;
}) {
  const { deck } = await params;
  const wanted = decodeURIComponent(deck);
  const locale = await getLocale();
  const pt = locale === "pt-BR";

  const decks = await listDecks("default");
  const row = decks.find(
    (d) => d.deck.toLowerCase() === wanted.toLowerCase(),
  );
  if (!row?.latestDecklistId) notFound();

  const list = await getDecklist(row.latestDecklistId);
  if (!list) notFound();

  const groups = groupDeckCards(list.cards);
  const total = list.cards.reduce((n, c) => n + c.qty, 0);
  const winPct = row.matches ? (100 * row.wins) / row.matches : 0;
  const unresolved = list.cards.filter((c) => !c.resolved).length;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/decks"
        className="text-sm text-violet-600 hover:underline dark:text-violet-400"
      >
        ← {pt ? "Todos os decks" : "All decks"}
      </Link>

      <h1 className="mt-2 text-2xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
        {row.deck}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {pt ? "Última lista por" : "Latest list by"}{" "}
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {list.player}
        </span>
        {list.date ? ` · ${toISODate(list.date)}` : ""}
        {list.tournamentName ? ` · ${list.tournamentName}` : ""}
        {list.rawName ? ` · "${list.rawName}"` : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Stat label={pt ? "Partidas" : "Matches"} value={row.matches.toLocaleString()} />
        <Stat label={pt ? "Vitórias" : "Win%"} value={`${winPct.toFixed(1)}%`} />
        <Stat label={pt ? "Listas" : "Lists"} value={String(row.decklists)} />
        <Stat label={pt ? "Cartas" : "Cards"} value={String(total)} />
      </div>

      {unresolved > 0 && (
        <p className="mt-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
          {unresolved}{" "}
          {pt
            ? "carta(s) sem correspondência no Scryfall — exibidas sem imagem."
            : "card(s) with no Scryfall match — shown without a preview."}
        </p>
      )}

      <div className="mt-6 columns-1 gap-6 sm:columns-2 lg:columns-3">
        {groups.map(([group, cards]) => (
          <section
            key={group}
            className="mb-6 break-inside-avoid rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
              {group} ({cards.reduce((n, c) => n + c.qty, 0)})
            </h2>
            <ul>
              {cards.map((c) => (
                <li key={c.key}>
                  <CardLink
                    name={c.name}
                    cardKey={c.key}
                    qty={c.qty}
                    imageNormal={c.imageNormal}
                    resolved={c.resolved}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {list.tournamentId && (
        <a
          href={`https://melee.gg/Decklist/View/${list.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          {pt ? "Ver no melee.gg" : "View on melee.gg"} ↗
        </a>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="font-bold text-neutral-950 dark:text-white">{value}</div>
    </div>
  );
}
