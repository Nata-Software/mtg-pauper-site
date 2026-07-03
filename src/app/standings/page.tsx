import { FilterBar } from "@/components/FilterBar";
import { prettyDeck } from "@/lib/stats";
import { toISODate } from "@/lib/dates";
import {
  dateBounds,
  getStandings,
  listEvents,
  listStores,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";
  const event = first(sp.event) || undefined;
  const from = first(sp.from) || undefined;
  const to = first(sp.to) || undefined;

  const [events, bounds, rows] = await Promise.all([
    listEvents(store),
    dateBounds(store),
    getStandings({ store, event, from, to }),
  ]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight text-white">
          Standings
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Player results per event. Showing {rows.length.toLocaleString()} rows.
        </p>
      </div>

      <FilterBar
        action="/standings"
        stores={stores}
        events={events}
        store={store}
        event={event}
        from={from}
        to={to}
        bounds={bounds}
      />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
          No standings for these filters.
        </p>
      ) : (
        <div className="matrix-scroll overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Deck</th>
                <th className="px-3 py-2 text-right">Points</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className="border-t border-neutral-800/60 odd:bg-neutral-900/30"
                >
                  <td className="px-3 py-1.5 text-neutral-400">{r.position}</td>
                  <td className="px-3 py-1.5 font-medium">{r.nickname}</td>
                  <td className="px-3 py-1.5 text-neutral-300">
                    {prettyDeck(r.deck)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.points}
                  </td>
                  <td className="px-3 py-1.5 text-neutral-400">{r.eventName}</td>
                  <td className="px-3 py-1.5 text-neutral-400 tabular-nums">
                    {toISODate(r.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
