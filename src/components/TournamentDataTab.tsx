import { prettyDeck } from "@/lib/stats";
import type { TournamentData } from "@/lib/queries";

function numberCard(label: string, value: number) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>

      <div className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
        {value.toLocaleString()}
      </div>
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

export function TournamentDataTab({ data }: { data: TournamentData }) {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            Tournament Data
          </h2>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Summary of imported tournaments, winners, archetypes, players, and
            match volume.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {numberCard("Unique Tournaments", data.uniqueTournaments)}
          {numberCard("Unique Players", data.uniquePlayers)}
          {numberCard("Unique Archetypes", data.uniqueArchetypes)}
          {numberCard("Matches Played", data.matchesPlayed)}
        </div>
      </section>

      <section>
        <div className="mb-2">
          <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
            Tournament Wins
          </h3>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Winner of each tournament.
          </p>
        </div>

        {data.tournamentWins.length === 0 ? (
          emptyMessage("No tournament winners found yet.")
        ) : (
          <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                  <th className="px-3 py-2">Tournament Name</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Archetype</th>
                  <th className="px-3 py-2 text-right">
                    # of Players in Tournament
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.tournamentWins.map((row) => (
                  <tr
                    key={row.tournamentKey}
                    className="border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
                  >
                    <td className="px-3 py-1.5 font-medium">
                      {row.tournamentName}
                    </td>

                    <td className="px-3 py-1.5 tabular-nums text-neutral-600 dark:text-neutral-300">
                      {row.date || "—"}
                    </td>

                    <td className="px-3 py-1.5">{row.player}</td>

                    <td className="px-3 py-1.5">
                      {row.archetype ? prettyDeck(row.archetype) : "—"}
                    </td>

                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                      {row.playerCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-2">
            <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
              Archetype Tournament Wins
            </h3>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              How many times each archetype won a tournament.
            </p>
          </div>

          {data.archetypeWins.length === 0 ? (
            emptyMessage("No archetype wins found yet.")
          ) : (
            <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                    <th className="px-3 py-2">Archetype</th>
                    <th className="px-3 py-2 text-right">Tournament Wins</th>
                  </tr>
                </thead>

                <tbody>
                  {data.archetypeWins.map((row) => (
                    <tr
                      key={row.archetype}
                      className="border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
                    >
                      <td className="px-3 py-1.5 font-medium">
                        {prettyDeck(row.archetype)}
                      </td>

                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {row.wins.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="mb-2">
            <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
              Tournament Winners
            </h3>

            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Players that have won at least one tournament.
            </p>
          </div>

          {data.playerWins.length === 0 ? (
            emptyMessage("No player wins found yet.")
          ) : (
            <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                    <th className="px-3 py-2">Player</th>
                    <th className="px-3 py-2 text-right">Wins</th>
                  </tr>
                </thead>

                <tbody>
                  {data.playerWins.map((row) => (
                    <tr
                      key={row.player}
                      className="border-t border-neutral-200 odd:bg-neutral-50 dark:border-neutral-800/60 dark:odd:bg-neutral-900/30"
                    >
                      <td className="px-3 py-1.5 font-medium">{row.player}</td>

                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {row.wins.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
