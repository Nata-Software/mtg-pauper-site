import { prettyDeck } from "@/lib/stats";
import type { Locale } from "@/lib/i18n";
import type { TournamentData } from "@/lib/queries";

type TournamentWinRow = TournamentData["tournamentWins"][number];

function copy(locale: Locale) {
  const isPt = locale === "pt-BR";

  return {
    title: isPt ? "Dados dos Torneios" : "Tournament Data",
    subtitle: isPt
      ? "Resumo dos torneios importados, vencedores, arquétipos, jogadores e volume de partidas."
      : "Summary of imported tournaments, winners, archetypes, players, and match volume.",

    uniqueTournaments: isPt ? "Torneios Únicos" : "Unique Tournaments",
    uniquePlayers: isPt ? "Jogadores Únicos" : "Unique Players",
    uniqueArchetypes: isPt ? "Arquétipos Únicos" : "Unique Archetypes",
    matchesPlayed: isPt ? "Partidas Jogadas" : "Matches Played",

    tournamentWins: isPt ? "Vitórias em Torneios" : "Tournament Wins",
    tournamentWinsDescription: isPt
      ? "Vencedor de cada torneio. Mostra os 10 torneios mais recentes primeiro; role para ver resultados antigos."
      : "Winner of each tournament. Shows the 10 most recent tournaments first; scroll to see older results.",
    noTournamentWins: isPt
      ? "Nenhum vencedor de torneio encontrado ainda."
      : "No tournament winners found yet.",

    tournamentName: isPt ? "Nome do Torneio" : "Tournament Name",
    date: isPt ? "Data" : "Date",
    player: isPt ? "Jogador" : "Player",
    archetype: isPt ? "Arquétipo" : "Archetype",
    playersInTournament: isPt
      ? "Nº de Jogadores no Torneio"
      : "# of Players in Tournament",

    archetypeTournamentWins: isPt
      ? "Vitórias por Arquétipo"
      : "Archetype Tournament Wins",
    archetypeTournamentWinsDescription: isPt
      ? "Mostra os 5 primeiros arquétipos; role para ver o restante."
      : "Shows the top 5 archetypes first; scroll to see the rest.",
    noArchetypeWins: isPt
      ? "Nenhuma vitória por arquétipo encontrada ainda."
      : "No archetype wins found yet.",

    tournamentWinners: isPt ? "Vencedores de Torneios" : "Tournament Winners",
    tournamentWinnersDescription: isPt
      ? "Mostra os 5 primeiros jogadores; role para ver o restante."
      : "Shows the top 5 players first; scroll to see the rest.",
    noPlayerWins: isPt
      ? "Nenhuma vitória por jogador encontrada ainda."
      : "No player wins found yet.",

    wins: isPt ? "Vitórias" : "Wins",
  };
}

function numberCard(label: string, value: number) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-neutral-950 dark:text-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function emptyMessage(message: string) {
  return (
    <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
      {message}
    </p>
  );
}

function dateTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function sortTournamentWinsByMostRecent(
  rows: TournamentWinRow[],
): TournamentWinRow[] {
  return [...rows].sort((a, b) => {
    const dateDiff = dateTimestamp(b.date) - dateTimestamp(a.date);

    if (dateDiff !== 0) return dateDiff;

    return a.tournamentName.localeCompare(b.tournamentName);
  });
}

const tableHeadCell =
  "h-12 px-4 py-0 font-semibold text-neutral-700 dark:text-neutral-200";

const tableBodyCell = "h-12 px-4 py-0 text-neutral-600 dark:text-neutral-300";

const tableBodyCellStrong = "h-12 px-4 py-0 text-neutral-950 dark:text-white";

export function TournamentDataTab({
  data,
  locale,
}: {
  data: TournamentData;
  locale: Locale;
}) {
  const labels = copy(locale);
  const tournamentWins = sortTournamentWinsByMostRecent(data.tournamentWins);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-neutral-950 dark:text-white">
          {labels.title}
        </h2>

        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {labels.subtitle}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {numberCard(labels.uniqueTournaments, data.uniqueTournaments)}
        {numberCard(labels.uniquePlayers, data.uniquePlayers)}
        {numberCard(labels.uniqueArchetypes, data.uniqueArchetypes)}
        {numberCard(labels.matchesPlayed, data.matchesPlayed)}
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">
            {labels.tournamentWins}
          </h3>

          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {labels.tournamentWinsDescription}
          </p>
        </div>

        {tournamentWins.length === 0 ? (
          emptyMessage(labels.noTournamentWins)
        ) : (
          <div className="max-h-[33rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full table-fixed divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
              <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
                <tr>
                  <th className={`${tableHeadCell} text-left`}>
                    {labels.tournamentName}
                  </th>
                  <th className={`${tableHeadCell} text-left`}>
                    {labels.date}
                  </th>
                  <th className={`${tableHeadCell} text-left`}>
                    {labels.player}
                  </th>
                  <th className={`${tableHeadCell} text-left`}>
                    {labels.archetype}
                  </th>
                  <th className={`${tableHeadCell} text-right`}>
                    {labels.playersInTournament}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                {tournamentWins.map((row) => (
                  <tr key={`${row.tournamentName}-${row.date}-${row.player}`}>
                    <td className={tableBodyCellStrong}>
                      {row.tournamentName}
                    </td>
                    <td className={tableBodyCell}>{row.date || "—"}</td>
                    <td className={tableBodyCell}>{row.player}</td>
                    <td className={tableBodyCell}>
                      {row.archetype ? prettyDeck(row.archetype) : "—"}
                    </td>
                    <td className={`${tableBodyCell} text-right`}>
                      {row.playerCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">
              {labels.archetypeTournamentWins}
            </h3>

            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {labels.archetypeTournamentWinsDescription}
            </p>
          </div>

          {data.archetypeWins.length === 0 ? (
            emptyMessage(labels.noArchetypeWins)
          ) : (
            <div className="max-h-[18rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full table-fixed divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
                <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
                  <tr>
                    <th className={`${tableHeadCell} text-left`}>
                      {labels.archetype}
                    </th>
                    <th className={`${tableHeadCell} text-right`}>
                      {labels.tournamentWins}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                  {data.archetypeWins.map((row) => (
                    <tr key={row.archetype}>
                      <td className={tableBodyCellStrong}>
                        {prettyDeck(row.archetype)}
                      </td>
                      <td className={`${tableBodyCell} text-right`}>
                        {row.wins.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-neutral-950 dark:text-white">
              {labels.tournamentWinners}
            </h3>

            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {labels.tournamentWinnersDescription}
            </p>
          </div>

          {data.playerWins.length === 0 ? (
            emptyMessage(labels.noPlayerWins)
          ) : (
            <div className="max-h-[18rem] overflow-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full table-fixed divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
                <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
                  <tr>
                    <th className={`${tableHeadCell} text-left`}>
                      {labels.player}
                    </th>
                    <th className={`${tableHeadCell} text-right`}>
                      {labels.wins}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                  {data.playerWins.map((row) => (
                    <tr key={row.player}>
                      <td className={tableBodyCellStrong}>{row.player}</td>
                      <td className={`${tableBodyCell} text-right`}>
                        {row.wins.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}