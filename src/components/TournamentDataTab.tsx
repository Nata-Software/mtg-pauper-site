import { prettyDeck } from "@/lib/stats";
import type { TournamentData } from "@/lib/queries";
import type { Locale } from "@/lib/i18n";

type Props = {
  data: TournamentData;
  locale?: Locale;
};

function copy(locale: Locale) {
  if (locale === "pt-BR") {
    return {
      title: "Dados dos Torneios",
      subtitle:
        "Resumo dos torneios importados, vencedores, arquétipos, jogadores e volume de partidas.",
      uniqueTournaments: "Torneios Únicos",
      uniquePlayers: "Jogadores Únicos",
      uniqueArchetypes: "Arquétipos Únicos",
      matchesPlayed: "Partidas Jogadas",
      tournamentWins: "Vitórias em Torneios",
      tournamentWinsSubtitle: "Vencedor de cada torneio.",
      archetypeWins: "Vitórias por Arquétipo",
      archetypeWinsSubtitle: "Quantas vezes cada arquétipo venceu um torneio.",
      tournamentWinners: "Vencedores de Torneios",
      tournamentWinnersSubtitle:
        "Jogadores que venceram pelo menos um torneio.",
      noTournamentWins: "Nenhum vencedor de torneio encontrado ainda.",
      noArchetypeWins: "Nenhuma vitória por arquétipo encontrada ainda.",
      noPlayerWins: "Nenhum vencedor encontrado ainda.",
      tournamentName: "Nome do Torneio",
      date: "Data",
      player: "Jogador",
      archetype: "Arquétipo",
      playerCount: "Nº de Jogadores",
      wins: "Vitórias",
    };
  }

  return {
    title: "Tournament Data",
    subtitle:
      "Summary of imported tournaments, winners, archetypes, players, and match volume.",
    uniqueTournaments: "Unique Tournaments",
    uniquePlayers: "Unique Players",
    uniqueArchetypes: "Unique Archetypes",
    matchesPlayed: "Matches Played",
    tournamentWins: "Tournament Wins",
    tournamentWinsSubtitle: "Winner of each tournament.",
    archetypeWins: "Archetype Tournament Wins",
    archetypeWinsSubtitle: "How many times each archetype won a tournament.",
    tournamentWinners: "Tournament Winners",
    tournamentWinnersSubtitle: "Players that have won at least one tournament.",
    noTournamentWins: "No tournament winners found yet.",
    noArchetypeWins: "No archetype wins found yet.",
    noPlayerWins: "No tournament winners found yet.",
    tournamentName: "Tournament Name",
    date: "Date",
    player: "Player",
    archetype: "Archetype",
    playerCount: "# of Players",
    wins: "Wins",
  };
}

function numberCard(label: string, value: number) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-neutral-950 dark:text-white">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function emptyMessage(message: string) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
      {message}
    </div>
  );
}

const tableHeadCell =
  "h-12 px-4 py-0 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400";

const tableBodyCell =
  "h-12 px-4 py-0 text-sm text-neutral-600 dark:text-neutral-300";

const tableBodyCellStrong =
  "h-12 px-4 py-0 text-sm font-semibold text-neutral-950 dark:text-white";

export function TournamentDataTab({ data, locale = "en" }: Props) {
  const c = copy(locale);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-neutral-950 dark:text-white">
          {c.title}
        </h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {c.subtitle}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {numberCard(c.uniqueTournaments, data.uniqueTournaments)}
        {numberCard(c.uniquePlayers, data.uniquePlayers)}
        {numberCard(c.uniqueArchetypes, data.uniqueArchetypes)}
        {numberCard(c.matchesPlayed, data.matchesPlayed)}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-neutral-950 dark:text-white">
            {c.tournamentWins}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {c.tournamentWinsSubtitle}
          </p>
        </div>

        {data.tournamentWins.length === 0 ? (
          emptyMessage(c.noTournamentWins)
        ) : (
          <div className="max-h-[33rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
                <tr>
                  <th className={tableHeadCell}>{c.tournamentName}</th>
                  <th className={tableHeadCell}>{c.date}</th>
                  <th className={tableHeadCell}>{c.player}</th>
                  <th className={tableHeadCell}>{c.archetype}</th>
                  <th className={`${tableHeadCell} text-right`}>
                    {c.playerCount}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {data.tournamentWins.map((row) => (
                  <tr key={row.tournamentKey}>
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-bold text-neutral-950 dark:text-white">
              {c.archetypeWins}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {c.archetypeWinsSubtitle}
            </p>
          </div>

          {data.archetypeWins.length === 0 ? (
            emptyMessage(c.noArchetypeWins)
          ) : (
            <div className="max-h-[18rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
                  <tr>
                    <th className={tableHeadCell}>{c.archetype}</th>
                    <th className={`${tableHeadCell} text-right`}>{c.wins}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
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
            <h3 className="text-lg font-bold text-neutral-950 dark:text-white">
              {c.tournamentWinners}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {c.tournamentWinnersSubtitle}
            </p>
          </div>

          {data.playerWins.length === 0 ? (
            emptyMessage(c.noPlayerWins)
          ) : (
            <div className="max-h-[18rem] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-900">
                  <tr>
                    <th className={tableHeadCell}>{c.player}</th>
                    <th className={`${tableHeadCell} text-right`}>{c.wins}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
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
      </div>
    </section>
  );
}
