import Link from "next/link";

import { MatrixTable } from "@/components/MatrixTable";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";
import { TournamentDataTab } from "@/components/TournamentDataTab";
import { toISODate } from "@/lib/dates";
import { getLocale } from "@/lib/i18n.server";
import type { Locale } from "@/lib/i18n";
import {
  getAllPlayersData,
  getSinglePlayerData,
  getTournamentData,
  listEvents,
  listPlayersForData,
  listStores,
} from "@/lib/queries";
import { prettyDeck } from "@/lib/stats";

type SP = Record<string, string | string[] | undefined>;
type ViewKey = "tournament-data" | "all-players" | "single-player";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseView(value: string | undefined): ViewKey {
  if (value === "all-players" || value === "single-player") return value;

  return "tournament-data";
}

function currentYearFrom(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function href(params: Record<string, string | undefined>): string {
  const url = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) url.set(key, value);
  }

  const query = url.toString();

  return `/data${query ? `?${query}` : ""}`;
}

function copy(locale: Locale) {
  if (locale === "pt-BR") {
    return {
      title: "Dados",
      subtitle: "Visões gerais de torneios, jogadores e desempenho individual.",
      tournamentData: "Dados dos torneios",
      allPlayersData: "Dados de todos os jogadores",
      singlePlayerData: "Dados de jogador",
      store: "Loja",
      event: "Evento",
      allEvents: "Todos os eventos",
      from: "De",
      to: "Até",
      player: "Jogador",
      searchPlayer: "Buscar jogador...",
      typeAtLeast3: "Digite pelo menos 3 letras",
      noPlayerFound: "Nenhum jogador encontrado",
      apply: "Aplicar",
      reset: "Limpar",
      choosePlayer: "Selecione um jogador para ver os dados individuais.",
      players: "Jogadores",
      matches: "Partidas",
      record: "V-D-E",
      winPct: "Win%",
      fieldWinrate: "Win% do field",
      participations: "Torneios",
      tournamentWins: "Vitórias em torneios",
      tournamentsEntered: "Torneios jogados",
      tournamentsWon: "Torneios vencidos",
      uniqueOpponents: "Oponentes diferentes",
      uniqueArchetypes: "Decks diferentes jogados",
      bestDeck: "Melhor deck",
      decksPlayed: "Decks jogados",
      matchupMatrix: "Matriz de matchups",
      tournamentHistory: "Histórico de torneios",
      tournament: "Torneio",
      deck: "Deck",
      finish: "Colocação",
      lowSample: "Amostra baixa",
      noData: "Nenhum dado encontrado.",
    };
  }

  return {
    title: "Data",
    subtitle: "Tournament, player, and single-player performance views.",
    tournamentData: "Tournament Data",
    allPlayersData: "All Players Data",
    singlePlayerData: "Single Player Data",
    store: "Store",
    event: "Event",
    allEvents: "All events",
    from: "From",
    to: "To",
    player: "Player",
    searchPlayer: "Search player...",
    typeAtLeast3: "Type at least 3 letters",
    noPlayerFound: "No player found",
    apply: "Apply",
    reset: "Reset",
    choosePlayer: "Select a player to see single-player data.",
    players: "Players",
    matches: "Matches",
    record: "W-L-D",
    winPct: "Win%",
    fieldWinrate: "Field Win%",
    participations: "Tournaments",
    tournamentWins: "Tournament Wins",
    tournamentsEntered: "Tournaments Entered",
    tournamentsWon: "Tournaments Won",
    uniqueOpponents: "Unique Opponents",
    uniqueArchetypes: "Different Decks Played",
    bestDeck: "Best Deck",
    decksPlayed: "Decks Played",
    matchupMatrix: "Matchup Matrix",
    tournamentHistory: "Tournament History",
    tournament: "Tournament",
    deck: "Deck",
    finish: "Finish",
    lowSample: "Low Sample",
    noData: "No data found.",
  };
}

function pct(value: number | null | undefined): string {
  if (value == null) return "—";

  return `${parseFloat((value * 100).toFixed(2))}%`;
}

function wld(row: { wins: number; losses: number; draws: number }): string {
  return `${row.wins}-${row.losses}-${row.draws}`;
}

function card(label: string, value: string | number) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function heroStat(label: string, value: string | number) {
  return (
    <div className="rounded-xl border border-violet-200 bg-white/70 p-4 dark:border-violet-900/70 dark:bg-neutral-950/40">
      <div className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-neutral-950 dark:text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function playerHref(opts: {
  store: string;
  event?: string;
  from?: string;
  to?: string;
  player: string;
}): string {
  return href({
    view: "single-player",
    store: opts.store,
    event: opts.event,
    from: opts.from,
    to: opts.to,
    player: opts.player,
  });
}

function FilterForm({
  c,
  view,
  stores,
  events,
  players,
  store,
  event,
  from,
  to,
  player,
}: {
  c: ReturnType<typeof copy>;
  view: ViewKey;
  stores: string[];
  events: string[];
  players: string[];
  store: string;
  event: string;
  from: string;
  to: string;
  player: string;
}) {
  return (
    <form
      method="get"
      action="/data"
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <input type="hidden" name="view" value={view} />

      <label className="flex flex-col gap-1 text-sm">
        {c.store}
        <select
          name="store"
          defaultValue={store}
          className="rounded-md border border-neutral-300 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-950"
        >
          {stores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {c.event}
        <select
          name="event"
          defaultValue={event}
          className="rounded-md border border-neutral-300 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">{c.allEvents}</option>
          {events.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {c.from}
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="rounded-md border border-neutral-300 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {c.to}
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="rounded-md border border-neutral-300 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-950"
        />
      </label>

      {(view === "single-player" || view === "all-players") && (
        <div className="min-w-64">
          <PlayerSearchInput
            key={`${view}:${player || "all"}`}
            players={players}
            selectedPlayer={player}
            label={c.player}
            placeholder={c.searchPlayer}
            minimumLabel={c.typeAtLeast3}
            noResultsLabel={c.noPlayerFound}
          />
        </div>
      )}

      <button
        type="submit"
        className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
      >
        {c.apply}
      </button>

      <Link
        href={href({ view })}
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {c.reset}
      </Link>
    </form>
  );
}

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const c = copy(locale);
  const sp = await searchParams;

  const view = parseView(first(sp.view));
  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";
  const event = first(sp.event) || "";
  const from = first(sp.from) || currentYearFrom();
  const to = first(sp.to) || toISODate(new Date());
  const player = first(sp.player) || "";
  const focus = first(sp.focus);

  const [events, players] =
    view === "tournament-data"
      ? await Promise.all([listEvents(store), Promise.resolve<string[]>([])])
      : await Promise.all([
          listEvents(store),
          listPlayersForData({ store, event, from, to }),
        ]);

  const tabs: { view: ViewKey; label: string }[] = [
    { view: "tournament-data", label: c.tournamentData },
    { view: "all-players", label: c.allPlayersData },
    { view: "single-player", label: c.singlePlayerData },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
          {c.title}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {c.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.view === view;

          return (
            <Link
              key={tab.view}
              href={href({ view: tab.view })}
              className={
                active
                  ? "rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {view === "tournament-data" ? (
        <TournamentDataSection store={store} locale={locale} />
      ) : (
        <>
          <FilterForm
            c={c}
            view={view}
            stores={stores}
            events={events}
            players={players}
            store={store}
            event={event}
            from={from}
            to={to}
            player={player}
          />

          {view === "all-players" ? (
            <AllPlayersSection
              c={c}
              store={store}
              event={event}
              from={from}
              to={to}
              player={player}
            />
          ) : (
            <SinglePlayerSection
              c={c}
              store={store}
              event={event}
              from={from}
              to={to}
              player={player}
              focus={focus}
              locale={locale}
            />
          )}
        </>
      )}
    </div>
  );
}

async function TournamentDataSection({
  store,
  locale,
}: {
  store: string;
  locale: Locale;
}) {
  const data = await getTournamentData(store);

  return <TournamentDataTab data={data} locale={locale} />;
}

async function AllPlayersSection({
  c,
  store,
  event,
  from,
  to,
  player,
}: {
  c: ReturnType<typeof copy>;
  store: string;
  event: string;
  from: string;
  to: string;
  player: string;
}) {
  const rows = await getAllPlayersData({ store, event, from, to, player });

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {c.noData}
      </p>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-neutral-950 dark:text-white">
        {c.players}
      </h2>

      <div className="max-h-[63rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
            <tr>
              <th className="h-12 px-4 py-0 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {c.player}
              </th>
              <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {c.matches}
              </th>
              <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {c.record}
              </th>
              <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {c.winPct}
              </th>
              <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {c.participations}
              </th>
              <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {c.tournamentWins}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((row) => (
              <tr key={row.player}>
                <td className="h-12 px-4 py-0 text-sm font-semibold">
                  <Link
                    href={playerHref({
                      store,
                      event,
                      from,
                      to,
                      player: row.player,
                    })}
                    className="text-violet-600 hover:underline dark:text-violet-400"
                  >
                    {row.player}
                  </Link>
                </td>
                <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                  {row.matches.toLocaleString()}
                </td>
                <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                  {wld(row)}
                </td>
                <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                  {pct(row.winPct)}
                </td>
                <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                  {row.participations.toLocaleString()}
                </td>
                <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                  {row.tournamentWins.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function SinglePlayerSection({
  c,
  store,
  event,
  from,
  to,
  player,
  focus,
  locale,
}: {
  c: ReturnType<typeof copy>;
  store: string;
  event: string;
  from: string;
  to: string;
  player: string;
  focus?: string;
  locale: Locale;
}) {
  if (!player) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {c.choosePlayer}
      </p>
    );
  }

  const data = await getSinglePlayerData({ store, event, from, to, player });

  if (!data) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {c.noData}
      </p>
    );
  }

  const matrixBaseHref = href({
    view: "single-player",
    store,
    event,
    from,
    to,
    player,
  });

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-neutral-50 p-6 shadow-sm dark:border-violet-900/70 dark:from-violet-950/40 dark:via-neutral-950 dark:to-neutral-900">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              {c.player}
            </div>
            <h2 className="mt-2 text-4xl font-bold tracking-tight text-neutral-950 dark:text-white">
              {data.player}
            </h2>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {heroStat(c.matches, data.matchesPlayed)}
            {heroStat(c.winPct, pct(data.total.winPct))}
            {heroStat(c.record, wld(data.total))}
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {card(c.tournamentsEntered, data.tournamentsEntered)}
          {card(c.tournamentsWon, data.tournamentsWon)}
          {card(c.uniqueOpponents, data.uniqueOpponents)}
          {card(c.uniqueArchetypes, data.uniqueArchetypesPlayed)}
          {card(c.bestDeck, data.bestDeck ? prettyDeck(data.bestDeck) : "—")}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-neutral-950 dark:text-white">
          {c.decksPlayed}
        </h2>

        <div className="overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 text-left">{c.deck}</th>
                <th className="px-4 py-3 text-right">{c.matches}</th>
                <th className="px-4 py-3 text-right">{c.record}</th>
                <th className="px-4 py-3 text-right">{c.winPct}</th>
                <th className="px-4 py-3 text-right">{c.fieldWinrate}</th>
                <th className="px-4 py-3 text-right">{c.tournamentWins}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.decks.map((row) => (
                <tr key={row.deck}>
                  <td className="px-4 py-3 font-semibold">
                    <Link
                      href={href({
                        view: "single-player",
                        store,
                        event,
                        from,
                        to,
                        player,
                        focus: row.deck,
                      })}
                      className="text-violet-600 hover:underline dark:text-violet-400"
                    >
                      {prettyDeck(row.deck)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.matches.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">{wld(row)}</td>
                  <td className="px-4 py-3 text-right">{pct(row.winPct)}</td>
                  <td className="px-4 py-3 text-right">
                    {pct(row.fieldWinPct)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.tournamentWins.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-neutral-950 dark:text-white">
          {c.matchupMatrix}
        </h2>

        <MatrixTable
          matrix={data.matrix}
          sort="matches"
          focus={focus}
          baseHref={matrixBaseHref}
          locale={locale}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-neutral-950 dark:text-white">
          {c.tournamentHistory}
        </h2>

        <div className="max-h-[18rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="h-12 px-4 py-0 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {c.from}
                </th>
                <th className="h-12 px-4 py-0 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {c.tournament}
                </th>
                <th className="h-12 px-4 py-0 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {c.deck}
                </th>
                <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {c.finish}
                </th>
                <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {c.matches}
                </th>
                <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {c.record}
                </th>
                <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {c.winPct}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.tournamentHistory.map((row) => (
                <tr key={row.tournamentKey}>
                  <td className="h-12 px-4 py-0 text-sm text-neutral-600 dark:text-neutral-300">
                    {row.date || "—"}
                  </td>
                  <td className="h-12 px-4 py-0 text-sm font-semibold text-neutral-950 dark:text-white">
                    {row.tournamentName}
                  </td>
                  <td className="h-12 px-4 py-0 text-sm text-neutral-600 dark:text-neutral-300">
                    {prettyDeck(row.deck)}
                  </td>
                  <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                    {row.position ? `#${row.position}` : "—"}
                  </td>
                  <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                    {row.matches.toLocaleString()}
                  </td>
                  <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                    {wld(row)}
                  </td>
                  <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                    {pct(row.winPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
