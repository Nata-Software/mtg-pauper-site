import Link from "next/link";

import { FilterBar } from "@/components/FilterBar";
import { MatrixTable, type MatrixSortKey } from "@/components/MatrixTable";
import { getLocale } from "@/lib/i18n.server";
import { t } from "@/lib/i18n";
import {
  dateBounds,
  getMatchRows,
  listEvents,
  listPlayers,
  listStores,
} from "@/lib/queries";
import { computeMatrix } from "@/lib/stats";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];

  return v;
}

function parseMatrixSort(value: string | undefined): MatrixSortKey {
  if (value === "winrate" || value === "alpha" || value === "matches") {
    return value;
  }

  return "matches";
}

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;

  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";
  const event = first(sp.event) || undefined;
  const player = first(sp.player) || undefined;

  // Default to the current year; an explicitly-cleared field ("") means all-time.
  const year = new Date().getUTCFullYear();
  const fromParam = first(sp.from);
  const toParam = first(sp.to);

  const from =
    fromParam === undefined ? `${year}-01-01` : fromParam || undefined;
  const to = toParam === undefined ? `${year}-12-31` : toParam || undefined;

  const minPct = Number(first(sp.minPct) ?? 1) || 0;
  const sort = parseMatrixSort(first(sp.sort));
  const focus = first(sp.focus);

  const [events, bounds, players, matchRows] = await Promise.all([
    listEvents(store),
    dateBounds(store),
    listPlayers({ store, event, from, to }),
    getMatchRows({ store, event, from, to, player }),
  ]);

  const matrix = computeMatrix(matchRows, {
    minPct,
    columnMode: player ? "opponents" : "rows",
  });

  const rangeConnector = t(locale, "matchups.rangeTo");

  const rangeLabel =
    from || to
      ? `${from || bounds.min || t(locale, "matchups.rangeStart")} ${rangeConnector} ${
          to || bounds.max || t(locale, "matchups.rangeNow")
        }`
      : bounds.min
        ? `${bounds.min} ${rangeConnector} ${bounds.max}`
        : t(locale, "matchups.allTime");

  const subtitleCount = player ? matrix.rows.length : matrix.archetypes.length;

  const baseParams = new URLSearchParams({
    store,
    sort,
    minPct: String(minPct),
  });

  if (event) {
    baseParams.set("event", event);
  }

  if (player) {
    baseParams.set("player", player);
  }

  // Preserve explicit date choices. If the user cleared date fields for
  // all-time, preserve the empty params too.
  if (fromParam !== undefined) {
    baseParams.set("from", fromParam);
  }

  if (toParam !== undefined) {
    baseParams.set("to", toParam);
  }

  const matrixBaseHref = `/?${baseParams.toString()}`;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
          {t(locale, "matchups.title")}
        </h1>

        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t(locale, "matchups.subtitle", {
            minPct: matrix.minPct,
            eventClause: event
              ? t(locale, "matchups.inEvent", { event })
              : "",
            range: rangeLabel,
            count: subtitleCount,
          })}
        </p>

        {player && (
          <p className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
            {t(locale, "matchups.playerHint", { player })}
          </p>
        )}
      </div>

      <FilterBar
        action="/"
        stores={stores}
        events={events}
        players={players}
        store={store}
        event={event}
        player={player}
        from={fromParam === undefined ? from : fromParam}
        to={toParam === undefined ? to : toParam}
        bounds={bounds}
        showMinPct
        minPct={minPct}
        showSort
        sort={sort}
        locale={locale}
      />

      {focus && (
        <p className="mb-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
          {t(locale, "matrix.focusHint")}
        </p>
      )}

      {matchRows.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {t(locale, "matchups.noDataBefore")}{" "}
          <Link href="/admin/upload" className="underline">
            {t(locale, "nav.upload")}
          </Link>{" "}
          {t(locale, "matchups.noDataAfter")}
        </p>
      ) : (
        <MatrixTable
          matrix={matrix}
          sort={sort}
          focus={focus}
          baseHref={matrixBaseHref}
          locale={locale}
        />
      )}
    </div>
  );
}