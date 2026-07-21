import Link from "next/link";

import { prettyDeck } from "@/lib/stats";
import type {
  DeckDrilldownData,
  DeckDrilldownMetricRow,
  DeckDrilldownPilotRow,
} from "@/lib/queries";
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
      bestMatchup: "Melhor matchup",
      worstMatchup: "Pior matchup",
      mostPlayedOpponentDeck: "Deck oponente mais enfrentado",
      bestPilot: "Melhor piloto",
      recentPlayers: "Jogadores recentes",
      player: "Jogador",
      lastPlayed: "Última vez",
      tournaments: "Torneios",
      winrate: "Win%",
      deck: "Deck",
      lowSampleMatches: "Low Sample Size, <10 Matches",
      lowSampleTournament: "Low Sample Size, 1 Tournament",
      tournamentsWon: "Torneios vencidos",
      biggestTournamentWon: "Maior torneio vencido",
      players: "jogadores",
      tournamentWins: "Vitórias em torneios",
      none: "—",
    };
  }

  return {
    back: "Back to Metagame",
    noData: "No data found for this deck.",
    overallWinrate: "Overall Winrate",
    record: "W-L-D",
    matches: "Matches",
    bestMatchup: "Best Matchup",
    worstMatchup: "Worst Matchup",
    mostPlayedOpponentDeck: "Most Played Opponent Deck",
    bestPilot: "Best Pilot",
    recentPlayers: "Recent Players",
    player: "Player",
    lastPlayed: "Last Played",
    tournaments: "Tournaments",
    winrate: "Win%",
    deck: "Deck",
    lowSampleMatches: "Low Sample Size, <10 Matches",
    lowSampleTournament: "Low Sample Size, 1 Tournament",
    tournamentsWon: "Tournaments Won",
    biggestTournamentWon: "Biggest Tournament Won",
    players: "players",
    tournamentWins: "Tournament Wins",
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
  none,
}: {
  label: string;
  tournament: {
    tournamentName: string;
    date: string;
    playerCount: number;
  } | null;
  playersLabel: string;
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
            <span>{c.record}: {wld(row)}</span>
            <span>·</span>
            <span>{c.winrate}: {pct(row.winPct)}</span>
            <span>·</span>
            <span>{c.matches}: {number(row.matches)}</span>
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
            <span>{c.record}: {wld(row)}</span>
            <span>·</span>
            <span>{c.winrate}: {pct(row.winPct)}</span>
            <span>·</span>
            <span>{c.matches}: {number(row.matches)}</span>
            <span>·</span>
            <span>{c.tournaments}: {number(row.tournaments)}</span>
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
  locale,
}: {
  deck: string;
  data: DeckDrilldownData | null;
  backHref: string;
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
            {statCard(c.tournamentsWon, data.tournamentsWon)}
            {biggestTournamentCard({
                label: c.biggestTournamentWon,
                tournament: data.biggestTournamentWon,
                playersLabel: c.players,
                none: c.none,
            })}
            </div>

          <div className="grid gap-4 lg:grid-cols-2">
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

            {bestPilotCard({ row: data.bestPilot, c })}
          </div>

          <section className="space-y-3">
            <h3 className="text-xl font-bold text-neutral-950 dark:text-white">
              {c.recentPlayers}
            </h3>

            {data.recentPlayers.length === 0 ? (
              <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                {c.noData}
              </p>
            ) : (
              <div className="max-h-[33rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
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
                        <td className="h-12 px-4 py-0 text-sm font-semibold text-neutral-950 dark:text-white">
                          {row.player}
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
            )}
          </section>
        </>
      )}
    </section>
  );
}