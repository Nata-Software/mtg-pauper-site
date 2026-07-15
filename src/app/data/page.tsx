import Link from "next/link";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";

import { CopyCurrentUrlButton } from "@/components/CopyCurrentUrlButton";
import { MatrixTable } from "@/components/MatrixTable";
import { TournamentDataTab } from "@/components/TournamentDataTab";
import { getLocale } from "@/lib/i18n.server";
import type { Locale } from "@/lib/i18n";
import { prettyDeck } from "@/lib/stats";
import {
  getAllPlayersData,
  getSinglePlayerData,
  getTournamentData,
  listEvents,
  listPlayersForData,
  listStores,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

type View = "tournament-data" | "all-players" | "single-player";

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function parseView(value: string | undefined): View {
  if (
    value === "tournament-data" ||
    value === "all-players" ||
    value === "single-player"
  ) {
    return value;
  }

  return "tournament-data";
}

function currentYearRange() {
  const year = new Date().getFullYear();

  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

function pct(value: number | null | undefined): string {
  if (value == null) return "—";

  return `${parseFloat((value * 100).toFixed(2))}%`;
}

function wld(row: { wins: number; losses: number; draws: number }) {
  return `${row.wins}-${row.losses}-${row.draws}`;
}

function copy(locale: Locale) {
  if (locale === "pt-BR") {
    return {
      title: "Data",
      subtitle:
        "Dados agregados de torneios, jogadores e desempenho individual.",
      tournamentData: "Tournament Data",
      allPlayersData: "All Players Data",
      singlePlayerData: "Single Player Data",
      store: "Loja",
      event: "Evento",
      allEvents: "Todos os eventos",
      player: "Jogador",
      selectPlayer: "Selecione um jogador",
      from: "De",
      to: "Até",
      apply: "Aplicar",
      reset: "Resetar",
      copyLink: "Copiar link",
      copied: "Copiado!",
      noPlayerSelected: "Selecione um jogador para ver os dados individuais.",
      noData: "Nenhum dado encontrado para esses filtros.",
      matches: "Partidas",
      participations: "Participações",
      tournamentWins: "Vitórias em torneios",
      winPct: "Win%",
      record: "V-D-E",
      playerName: "Jogador",
      tournamentsEntered: "Torneios jogados",
      tournamentsWon: "Torneios vencidos",
      uniqueOpponents: "Oponentes únicos",
      uniqueArchetypes: "Decks diferentes jogados",
      mostPlayedDeck: "Deck mais jogado",
      mostPlayedOpponent: "Oponente mais enfrentado",
      decksPlayed: "Decks jogados",
      deck: "Deck",
      matchupMatrix: "Matriz de matchups do jogador",
      searchPlayer: "Buscar jogador...",
      typeAtLeast3: "Digite pelo menos 3 letras",
      noPlayerFound: "Nenhum jogador encontrado",
    };
  }

  return {
    title: "Data",
    subtitle:
      "Aggregated tournament, player, and single-player performance data.",
    tournamentData: "Tournament Data",
    allPlayersData: "All Players Data",
    singlePlayerData: "Single Player Data",
    store: "Store",
    event: "Event",
    allEvents: "All events",
    player: "Player",
    selectPlayer: "Select a player",
    from: "From",
    to: "To",
    apply: "Apply",
    reset: "Reset",
    copyLink: "Copy link",
    copied: "Copied!",
    noPlayerSelected: "Select a player to see single-player data.",
    noData: "No data found for these filters.",
    matches: "Matches",
    participations: "Participations",
    tournamentWins: "Tournament wins",
    winPct: "Win%",
    record: "W-L-D",
    playerName: "Player",
    tournamentsEntered: "Tournaments entered",
    tournamentsWon: "Tournaments won",
    uniqueOpponents: "Unique opponents",
    uniqueArchetypes: "Different Decks Played",
    mostPlayedDeck: "Most played deck",
    mostPlayedOpponent: "Most played opponent",
    decksPlayed: "Decks played",
    deck: "Deck",
    matchupMatrix: "Player matchup matrix",
    searchPlayer: "Search player...",
    typeAtLeast3: "Type at least 3 letters",
    noPlayerFound: "No player found",
  };
}

function makeHref(params: Record<string, string | undefined>) {
  const url = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) url.set(key, value);
  }

  const query = url.toString();

  return query ? `/data?${query}` : "/data";
}

function card(label: string, value: string | number) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
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

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const c = copy(locale);
  const sp = await searchParams;

  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";
  const events = await listEvents(store);

  const view = parseView(first(sp.view));
  const defaults = currentYearRange();

  const from = first(sp.from) || defaults.from;
  const to = first(sp.to) || defaults.to;
  const event = first(sp.event) || "";
  const player = first(sp.player) || "";
  const focus = first(sp.focus) || undefined;

  const players = await listPlayersForData({
    store,
    from,
    to,
    event: event || undefined,
  });

  const tabs: { view: View; label: string }[] = [
    { view: "tournament-data", label: c.tournamentData },
    { view: "all-players", label: c.allPlayersData },
    { view: "single-player", label: c.singlePlayerData },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
          {c.title}
        </h1>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
          {c.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = view === tab.view;

          return (
            <Link
              key={tab.view}
              href={makeHref({
                view: tab.view,
              })}
              className={
                active
                  ? "rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
                  : "rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {view !== "tournament-data" && (
        <form
          key={`${view}:${store}:${event}:${from}:${to}:${player}`}
          action="/data"
          className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <input type="hidden" name="view" value={view} />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                name="from"
                type="date"
                defaultValue={from}
                className="rounded-md border border-neutral-300 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {c.to}
              <input
                name="to"
                type="date"
                defaultValue={to}
                className="rounded-md border border-neutral-300 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-950"
              />
            </label>

            {(view === "single-player" || view === "all-players") && (
              <PlayerSearchInput
                key={`${view}:${player || "no-player-selected"}`}
                players={players}
                selectedPlayer={player}
                label={c.player}
                placeholder={c.searchPlayer}
                minimumLabel={c.typeAtLeast3}
                noResultsLabel={c.noPlayerFound}
              />
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            >
              {c.apply}
            </button>

            <Link
              href={
                view === "single-player"
                  ? makeHref({ view: "single-player" })
                  : makeHref({ view: "all-players" })
              }
              className="rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {c.reset}
            </Link>

            {view === "single-player" && (
              <CopyCurrentUrlButton label={c.copyLink} copiedLabel={c.copied} />
            )}
          </div>
        </form>
      )}

      {view === "tournament-data" ? (
        <TournamentDataSection store={store} locale={locale} />
      ) : view === "all-players" ? (
        <AllPlayersSection
          store={store}
          from={from}
          to={to}
          event={event || undefined}
          player={player || undefined}
          c={c}
        />
      ) : (
        <SinglePlayerSection
          store={store}
          from={from}
          to={to}
          event={event || undefined}
          player={player}
          focus={focus}
          c={c}
          locale={locale}
        />
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
  store,
  from,
  to,
  event,
  player,
  c,
}: {
  store: string;
  from: string;
  to: string;
  event?: string;
  player?: string;
  c: ReturnType<typeof copy>;
}) {
  const rows = await getAllPlayersData({
    store,
    from,
    to,
    event,
    player,
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 p-6 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        {c.noData}
      </div>
    );
  }

  return (
    <div className="max-h-[63rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
          <tr>
            <th className="h-12 px-4 py-0 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {c.playerName}
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
                  href={makeHref({
                    store,
                    view: "single-player",
                    from,
                    to,
                    event,
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
  );
}

async function SinglePlayerSection({
  store,
  from,
  to,
  event,
  player,
  focus,
  c,
  locale,
}: {
  store: string;
  from: string;
  to: string;
  event?: string;
  player: string;
  focus?: string;
  c: ReturnType<typeof copy>;
  locale: Locale;
}) {
  if (!player) {
    return (
      <div className="rounded-xl border border-neutral-200 p-6 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        {c.noPlayerSelected}
      </div>
    );
  }

  const data = await getSinglePlayerData({
    store,
    player,
    from,
    to,
    event,
  });

  if (!data) {
    return (
      <div className="rounded-xl border border-neutral-200 p-6 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        {c.noData}
      </div>
    );
  }

  const matrixBaseHref = makeHref({
    store,
    view: "single-player",
    from,
    to,
    event,
    player,
  });

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-neutral-50 p-6 shadow-sm dark:border-violet-900/70 dark:from-violet-950/40 dark:via-neutral-950 dark:to-neutral-900">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              {c.playerName}
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {card(c.tournamentsEntered, data.tournamentsEntered)}
          {card(c.tournamentsWon, data.tournamentsWon)}
          {card(c.uniqueOpponents, data.uniqueOpponents)}
          {card(c.uniqueArchetypes, data.uniqueArchetypesPlayed)}
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
                <th className="px-4 py-3 text-right">{c.tournamentWins}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.decks.map((row) => {
                const href = makeHref({
                  store,
                  view: "single-player",
                  from,
                  to,
                  event,
                  player,
                  focus: row.deck,
                });

                return (
                  <tr key={row.deck}>
                    <td className="px-4 py-3 font-semibold">
                      <Link
                        href={href}
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
                      {row.tournamentWins.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
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
    </div>
  );
}