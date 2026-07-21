import Link from "next/link";

import { MatrixTable } from "@/components/MatrixTable";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";
import type {
  DeckDrilldownData,
  DeckDrilldownMetricRow,
  DeckDrilldownPilotRow,
} from "@/lib/queries";
import { prettyDeck } from "@/lib/stats";
import type { Locale } from "@/lib/i18n";

type Copy = ReturnType<typeof copy>;

function copy(locale: Locale) {
  if (locale === "pt-BR") {
    return {
      back: "Voltar ao Metagame",
      noData: "Nenhum dado encontrado para esse deck.",
      overallWinrate: "Winrate geral",
      record: "V-D-E",
      matches: "Partidas",
      pilots: "Pilotos",
      bestMatchup: "Melhor matchup",
      worstMatchup: "Pior matchup",
      mostPlayedOpponentDeck: "Deck oponente mais enfrentado",
      bestPilot: "Melhor piloto",
      recentPlayers: "Jogadores recentes",
      matchupMatrix: "Matriz de matchups",
      player: "Jogador",
      winner: "Vencedor",
      lastPlayed: "Última vez",
      tournaments: "Torneios",
      tournamentsWon: "Torneios vencidos",
      biggestTournamentWon: "Maior torneio vencido",
      tournamentWins: "Vitórias em torneios",
      players: "jogadores",
      winrate: "Win%",
      lowSampleMatches: "Amostra baixa, <10 partidas",
      lowSampleTournament: "Amostra baixa, 1 torneio",
      filterPlayer: "Filtrar jogador",
      searchPlayer: "Buscar jogador...",
      typeAtLeast3: "Digite pelo menos 3 letras",
      noPlayerFound: "Nenhum jogador encontrado",
      apply: "Aplicar",
      reset: "Limpar",
      none: "—",
    };
  }

  return {
    back: "Back to Metagame",
    noData: "No data found for this deck.",
    overallWinrate: "Overall Winrate",
    record: "W-L-D",
    matches: "Matches",
    pilots: "Pilots",
    bestMatchup: "Best Matchup",
    worstMatchup: "Worst Matchup",
    mostPlayedOpponentDeck: "Most Played Opponent Deck",
    bestPilot: "Best Pilot",
    recentPlayers: "Recent Players",
    matchupMatrix: "Matchup Matrix",
    player: "Player",
    winner: "Winner",
    lastPlayed: "Last Played",
    tournaments: "Tournaments",
    tournamentsWon: "Tournaments Won",
    biggestTournamentWon: "Biggest Tournament Won",
    tournamentWins: "Tournament Wins",
    players: "players",
    winrate: "Win%",
    lowSampleMatches: "Low Sample Size, <10 Matches",
    lowSampleTournament: "Low Sample Size, 1 Tournament",
    filterPlayer: "Filter player",
    searchPlayer: "Search player...",
    typeAtLeast3: "Type at least 3 letters",
    noPlayerFound: "No player found",
    apply: "Apply",
    reset: "Reset",
    none: "—",
  };
}

function pct(value: number | null | undefined): string {
  if (value == null) return "—";

  return `${parseFloat((value * 100).toFixed(2))}%`;
}

function wld(row: { wins: number; losses: number; draws: number }): string {
  return `${row.wins}-${row.losses}-${row.draws}`;
}

function number(value: number): string {
  return value.toLocaleString();
}

function playerHref(baseHref: string, player: string): string {
  const sep = baseHref.includes("?") ? "&" : "?";

  return `${baseHref}${sep}player=${encodeURIComponent(player)}`;
}

function lowSampleBadge(label: string) {
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {label}
    </span>
  );
}

function statCard(label: string, value: string | number) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-neutral-950 dark:text-white">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function biggestTournamentCard({
  label,
  tournament,
  playersLabel,
  winnerLabel,
  none,
}: {
  label: string;
  tournament: {
    tournamentName: string;
    date: string;
    player: string;
    playerCount: number;
  } | null;
  playersLabel: string;
  winnerLabel: string;
  none: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>

      {tournament ? (
        <div className="mt-2 space-y-1">
          <div className="text-lg font-bold leading-snug text-neutral-950 dark:text-white">
            {tournament.tournamentName}
          </div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {winnerLabel}: {tournament.player}
          </div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {tournament.playerCount.toLocaleString()} {playersLabel}
            {tournament.date ? ` · ${tournament.date}` : ""}
          </div>
        </div>
      ) : (
        <div className="mt-2 text-2xl font-bold text-neutral-950 dark:text-white">
          {none}
        </div>
      )}
    </div>
  );
}

function matchupCard({
  title,
  row,
  c,
}: {
  title: string;
  row: DeckDrilldownMetricRow | null;
  c: Copy;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </div>

      {row ? (
        <div className="mt-3 space-y-2">
          <div className="text-xl font-bold text-neutral-950 dark:text-white">
            {prettyDeck(row.name)}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <span>
              {c.record}: {wld(row)}
            </span>
            <span>·</span>
            <span>
              {c.winrate}: {pct(row.winPct)}
            </span>
            <span>·</span>
            <span>
              {c.matches}: {number(row.matches)}
            </span>
          </div>

          {row.lowSample && lowSampleBadge(c.lowSampleMatches)}
        </div>
      ) : (
        <div className="mt-3 text-xl font-bold text-neutral-950 dark:text-white">
          {c.none}
        </div>
      )}
    </div>
  );
}

function pilotSampleBadge(row: DeckDrilldownPilotRow, c: Copy) {
  if (row.matches < 10) return lowSampleBadge(c.lowSampleMatches);
  if (row.tournaments < 2) return lowSampleBadge(c.lowSampleTournament);

  return null;
}

function bestPilotCard({
  row,
  c,
}: {
  row: DeckDrilldownPilotRow | null;
  c: Copy;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {c.bestPilot}
      </div>

      {row ? (
        <div className="mt-3 space-y-2">
          <div className="text-xl font-bold text-neutral-950 dark:text-white">
            {row.player}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <span>
              {c.record}: {wld(row)}
            </span>
            <span>·</span>
            <span>
              {c.winrate}: {pct(row.winPct)}
            </span>
            <span>·</span>
            <span>
              {c.matches}: {number(row.matches)}
            </span>
            <span>·</span>
            <span>
              {c.tournaments}: {number(row.tournaments)}
            </span>
            <span>·</span>
            <span>
              {c.tournamentWins}: {number(row.tournamentWins)}
            </span>
            <span>·</span>
            <span>
              {c.lastPlayed}: {row.lastPlayed || "—"}
            </span>
          </div>

          {pilotSampleBadge(row, c)}
        </div>
      ) : (
        <div className="mt-3 text-xl font-bold text-neutral-950 dark:text-white">
          {c.none}
        </div>
      )}
    </div>
  );
}

export function DeckDrilldown({
  deck,
  data,
  backHref,
  filterBaseHref,
  store,
  range,
  selectedPlayer,
  players,
  locale,
}: {
  deck: string;
  data: DeckDrilldownData | null;
  backHref: string;
  filterBaseHref: string;
  store: string;
  range: string;
  selectedPlayer: string;
  players: string[];
  locale: Locale;
}) {
  const c = copy(locale);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={backHref}
            className="inline-flex rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {c.back}
          </Link>

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
            {prettyDeck(deck)}
          </h2>
        </div>
      </div>

      <form
        method="get"
        action="/metagame"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <input type="hidden" name="store" value={store} />
        <input type="hidden" name="range" value={range} />
        <input type="hidden" name="deck" value={deck} />

        <div className="min-w-64">
          <PlayerSearchInput
            key={selectedPlayer || "all-players"}
            players={players}
            selectedPlayer={selectedPlayer}
            label={c.filterPlayer}
            placeholder={c.searchPlayer}
            minimumLabel={c.typeAtLeast3}
            noResultsLabel={c.noPlayerFound}
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          {c.apply}
        </button>

        {selectedPlayer && (
          <Link
            href={filterBaseHref}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {c.reset}
          </Link>
        )}
      </form>

      {!data ? (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {c.noData}
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {statCard(c.overallWinrate, pct(data.winPct))}
            {statCard(c.record, wld(data))}
            {statCard(c.matches, data.matches)}
            {statCard(c.pilots, data.pilots)}
            {statCard(c.tournamentsWon, data.tournamentsWon)}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {biggestTournamentCard({
              label: c.biggestTournamentWon,
              tournament: data.biggestTournamentWon,
              playersLabel: c.players,
              winnerLabel: c.winner,
              none: c.none,
            })}

            {bestPilotCard({ row: data.bestPilot, c })}

            {matchupCard({
              title: c.bestMatchup,
              row: data.bestMatchup,
              c,
            })}

            {matchupCard({
              title: c.worstMatchup,
              row: data.worstMatchup,
              c,
            })}

            {matchupCard({
              title: c.mostPlayedOpponentDeck,
              row: data.mostPlayedOpponentDeck,
              c,
            })}
          </div>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-neutral-950 dark:text-white">
              {c.matchupMatrix}
            </h3>

            <MatrixTable
              matrix={data.matrix}
              sort="matches"
              baseHref={filterBaseHref}
              locale={locale}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-neutral-950 dark:text-white">
              {c.recentPlayers}
            </h3>

            <div className="max-h-[18rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
                  <tr>
                    <th className="h-12 px-4 py-0 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {c.player}
                    </th>
                    <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {c.lastPlayed}
                    </th>
                    <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {c.tournaments}
                    </th>
                    <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {c.tournamentWins}
                    </th>
                    <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {c.matches}
                    </th>
                    <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {c.record}
                    </th>
                    <th className="h-12 px-4 py-0 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {c.winrate}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {data.recentPlayers.map((row) => (
                    <tr key={row.player}>
                      <td className="h-12 px-4 py-0 text-sm font-semibold">
                        <Link
                          href={playerHref(filterBaseHref, row.player)}
                          className="text-violet-600 hover:underline dark:text-violet-400"
                        >
                          {row.player}
                        </Link>
                        {row.lowSample && (
                          <span className="ml-2">
                            {pilotSampleBadge(row, c)}
                          </span>
                        )}
                      </td>
                      <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                        {row.lastPlayed || "—"}
                      </td>
                      <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                        {number(row.tournaments)}
                      </td>
                      <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                        {number(row.tournamentWins)}
                      </td>
                      <td className="h-12 px-4 py-0 text-right text-sm text-neutral-600 dark:text-neutral-300">
                        {number(row.matches)}
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
        </>
      )}
    </section>
  );
}
