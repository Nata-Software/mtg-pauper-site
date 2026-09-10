import Link from "next/link";
import { notFound } from "next/navigation";

import { CardLink } from "@/components/CardLink";
import { ManaCost } from "@/components/ManaCost";
import {
  getDeckResults,
  getDecklist,
  getFeaturedDecklistId,
  groupDeckCards,
  listDecks,
  type DeckCard,
  type DeckResult,
} from "@/lib/cards/queries";
import { getLocale } from "@/lib/i18n.server";
import { monthsAgoISO, toISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const RANGES = { "2m": 2, "6m": 6, "12m": 12, all: 600 } as const;
type RangeKey = keyof typeof RANGES;
const parseRange = (v: string | undefined): RangeKey =>
  v && v in RANGES ? (v as RangeKey) : "2m";

/** Minimum match wins for a list to be worth featuring over the newest one. */
const MIN_WINS = 3;

export default async function DeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ deck: string }>;
  searchParams: Promise<SP>;
}) {
  const { deck } = await params;
  const sp = await searchParams;
  const wanted = decodeURIComponent(deck);
  const locale = await getLocale();
  const pt = locale === "pt-BR";

  const range = parseRange(first(sp.range));
  const to = toISODate(new Date());
  const from = monthsAgoISO(RANGES[range]);

  const decks = await listDecks("default", from, to);
  const row = decks.find((d) => d.deck.toLowerCase() === wanted.toLowerCase());
  if (!row) notFound();

  const [featured, results] = await Promise.all([
    getFeaturedDecklistId("default", row.archetypes, from, to, MIN_WINS),
    getDeckResults("default", row.archetypes, from, to),
  ]);
  if (!featured) notFound();

  // ?list= picks a specific pilot's list from the results table. Only honoured
  // when that list actually belongs to this deck, so a hand-edited URL can't
  // render someone else's archetype under this deck's name and stats.
  const asked = first(sp.list);
  const picked = asked && results.some((r) => r.decklistId === asked) ? asked : null;

  const list = await getDecklist(picked ?? featured.id);
  if (!list) notFound();

  const groups = groupDeckCards(list.main);
  const mainTotal = list.main.reduce((n, c) => n + c.qty, 0);
  const sideTotal = list.side.reduce((n, c) => n + c.qty, 0);
  const winPct = row.matches ? (100 * row.wins) / row.matches : 0;
  const unresolved = [...list.main, ...list.side].filter(
    (c) => !c.resolved,
  ).length;

  const events = groupByEvent(results);
  const hrefFor = (listId: string | null) =>
    `/decks/${encodeURIComponent(row.deck)}?range=${range}${listId ? `&list=${listId}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href={`/decks?range=${range}`}
        className="text-sm text-violet-600 hover:underline dark:text-violet-400"
      >
        ← {pt ? "Todos os decks" : "All decks"}
      </Link>

      <h1 className="mt-2 text-2xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
        {row.deck}
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {picked
          ? pt
            ? "Lista de "
            : "List by "
          : featured.featured
            ? pt
              ? `Lista com ${featured.wins} vitórias, por `
              : `${featured.wins}-win list by `
            : pt
              ? "Lista mais recente por "
              : "Latest list by "}
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {list.player}
        </span>
        {list.date ? ` · ${toISODate(list.date)}` : ""}
        {list.tournamentName ? ` · ${list.tournamentName}` : ""}
        {picked && (
          <>
            {" · "}
            <Link href={hrefFor(null)} className="text-violet-600 hover:underline dark:text-violet-400">
              {pt ? "voltar à lista destaque" : "back to featured list"}
            </Link>
          </>
        )}
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Stat label={pt ? "Partidas" : "Matches"} value={row.matches.toLocaleString()} />
        <Stat label={pt ? "Vitórias" : "Win%"} value={`${winPct.toFixed(1)}%`} />
        <Stat label={pt ? "Listas" : "Lists"} value={String(row.decklists)} />
        <Stat label={pt ? "Pilotos" : "Pilots"} value={String(row.pilots)} />
      </div>

      {unresolved > 0 && (
        <p className="mt-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
          {unresolved}{" "}
          {pt
            ? "carta(s) sem correspondência no Scryfall — exibidas sem imagem."
            : "card(s) with no Scryfall match — shown without a preview."}
        </p>
      )}

      {/* One panel for the maindeck, one for the sideboard. A plain grid, not
          CSS columns: multi-column re-balances its blocks when anything changes
          height, which made the list jump around under the hover preview. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title={pt ? "Deck principal" : "Maindeck"} count={mainTotal}>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {groups.map(([group, cards]) => (
              <div key={group}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  {group} ({cards.reduce((n, c) => n + c.qty, 0)})
                </h3>
                <CardList cards={cards} />
              </div>
            ))}
          </div>
        </Panel>

        {list.side.length > 0 && (
          <Panel title="Sideboard" count={sideTotal}>
            <CardList cards={list.side} />
          </Panel>
        )}
      </div>

      <a
        href={`https://melee.gg/Decklist/View/${list.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
      >
        {pt ? "Ver no melee.gg" : "View on melee.gg"} ↗
      </a>

      {events.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {pt ? "Resultados recentes" : "Recent results"}
          </h2>

          <div className="mt-3 space-y-5">
            {events.map((ev) => (
              <div key={ev.key}>
                <h3 className="text-sm font-medium text-violet-700 dark:text-violet-400">
                  {ev.name}
                  <span className="ml-2 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                    {ev.date}
                  </span>
                </h3>

                <div className="mt-1 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                      <tr>
                        <th className="px-3 py-2 text-left">{pt ? "Pos." : "Pl"}</th>
                        <th className="px-3 py-2 text-left">{pt ? "Jogador" : "Player"}</th>
                        <th className="px-3 py-2 text-right">V-D-E</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                      {ev.rows.map((r, i) => {
                        const isShown = r.decklistId === list.id;
                        return (
                          <tr
                            key={`${r.decklistId ?? "x"}-${i}`}
                            className={
                              isShown
                                ? "bg-violet-50 dark:bg-violet-950/40"
                                : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                            }
                          >
                            <td className="px-3 py-2 tabular-nums text-neutral-500 dark:text-neutral-400">
                              {r.position ?? "—"}
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {r.decklistId ? (
                                <Link
                                  href={hrefFor(r.decklistId)}
                                  className="text-violet-700 hover:underline dark:text-violet-400"
                                >
                                  {r.player}
                                </Link>
                              ) : (
                                <span className="text-neutral-900 dark:text-neutral-100">
                                  {r.player}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                              {r.wins}-{r.losses}-{r.draws}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Results split per event, newest first — the way a deck site reads. */
function groupByEvent(
  results: DeckResult[],
): { key: string; name: string; date: string; rows: DeckResult[] }[] {
  const out = new Map<
    string,
    { key: string; name: string; date: string; rows: DeckResult[] }
  >();

  for (const r of results) {
    const date = r.date ? toISODate(r.date) : "—";
    const name = r.tournamentName ?? r.eventName;
    const key = `${name}|${date}`;

    if (!out.has(key)) out.set(key, { key, name, date, rows: [] });
    out.get(key)!.rows.push(r);
  }

  for (const ev of out.values())
    ev.rows.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));

  return [...out.values()];
}

function CardList({ cards }: { cards: DeckCard[] }) {
  return (
    <ul>
      {cards.map((c) => (
        <li key={c.key} className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <CardLink
              name={c.name}
              cardKey={c.key}
              qty={c.qty}
              imageNormal={c.imageNormal}
              resolved={c.resolved}
            />
          </span>
          <ManaCost cost={c.manaCost} />
        </li>
      ))}
    </ul>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-3 flex items-baseline justify-between text-sm font-semibold uppercase tracking-wide text-neutral-950 dark:text-white">
        <span>{title}</span>
        <span className="text-neutral-400 dark:text-neutral-500">{count}</span>
      </h2>
      {children}
    </section>
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
