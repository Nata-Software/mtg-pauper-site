import { FilterBar } from "@/components/FilterBar";
import { MatrixTable } from "@/components/MatrixTable";
import { computeMatrix } from "@/lib/stats";
import {
  dateBounds,
  getMatchRows,
  listEvents,
  listStores,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";

  const event = first(sp.event) || undefined;
  // Default to the current year; an explicitly-cleared field ("") means all-time.
  const year = new Date().getUTCFullYear();
  const fromParam = first(sp.from);
  const toParam = first(sp.to);
  const from = fromParam === undefined ? `${year}-01-01` : fromParam || undefined;
  const to = toParam === undefined ? `${year}-12-31` : toParam || undefined;
  const minPct = Number(first(sp.minPct) ?? 2) || 0;
  const sort = (first(sp.sort) as "matches" | "winrate" | "alpha") || "matches";

  const [events, bounds, matchRows] = await Promise.all([
    listEvents(store),
    dateBounds(store),
    getMatchRows({ store, event, from, to }),
  ]);

  const matrix = computeMatrix(matchRows, { minPct });

  const rangeLabel =
    from || to
      ? `${from || bounds.min || "start"} to ${to || bounds.max || "now"}`
      : bounds.min
        ? `${bounds.min} to ${bounds.max}`
        : "all time";

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight text-white">
          Top MTG Pauper Archetypes Winrates
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Winrate against the most present archetypes (at least {matrix.minPct}%
          of the matches){event ? ` in "${event}"` : ""} between {rangeLabel}.
          Draws are excluded from winrate.
        </p>
      </div>

      <FilterBar
        action="/"
        stores={stores}
        events={events}
        store={store}
        event={event}
        from={from}
        to={to}
        bounds={bounds}
        showMinPct
        minPct={minPct}
        showSort
        sort={sort}
      />

      {matchRows.length === 0 ? (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
          No data yet. Go to{" "}
          <a href="/admin/upload" className="text-emerald-400 underline">
            Upload
          </a>{" "}
          to import the Ranking and Rounds CSVs.
        </p>
      ) : (
        <MatrixTable matrix={matrix} sort={sort} />
      )}
    </div>
  );
}
