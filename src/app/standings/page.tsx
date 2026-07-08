import Link from "next/link";
import { getLocale } from "@/lib/i18n.server";
import type { Locale } from "@/lib/i18n";

import {
  PlayerTable,
  type PlayerSortKey,
  type SortDir,
} from "@/components/PlayerTable";
import {
  StandingsTable,
  type StandingSortDir,
  type StandingSortKey,
} from "@/components/StandingsTable";
import { DeckBreakdownTable } from "@/components/DeckBreakdownTable";
import { TournamentDataTab } from "@/components/TournamentDataTab";
import {
  computeDeckBreakdown,
  computePlayerAnalysis,
  computePointsStandings,
} from "@/lib/stats";
import {
  getPlayerDeckRows,
  getPlayerRows,
  getTournamentData,
  listMonths,
  listStores,
  monthRange,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

type View = "year" | "tuesday" | "friday" | "tournament-data";

const TABS: { key: View; label: string }[] = [
  { key: "year", label: "Whole year" },
  { key: "tuesday", label: "Tuesday" },
  { key: "friday", label: "Friday" },
  { key: "tournament-data", label: "Tournament Data" },
];

const PLAYER_SORT_KEYS: PlayerSortKey[] = [
  "player",
  "matches",
  "winPct",
  "lossPct",
  "drawPct",
];

const STANDING_SORT_KEYS: StandingSortKey[] = [
  "player",
  "points",
  "matches",
  "winPct",
];

function parseView(value: string | undefined): View {
  if (
    value === "tuesday" ||
    value === "friday" ||
    value === "year" ||
    value === "tournament-data"
  ) {
    return value;
  }

  return "year";
}

function parsePlayerSort(value: string | undefined): PlayerSortKey {
  if (PLAYER_SORT_KEYS.includes(value as PlayerSortKey)) {
    return value as PlayerSortKey;
  }

  return "matches";
}

function parseStandingSort(value: string | undefined): StandingSortKey {
  if (STANDING_SORT_KEYS.includes(value as StandingSortKey)) {
    return value as StandingSortKey;
  }

  return "points";
}

function parseSortDir(value: string | undefined): SortDir {
  return value === "asc" ? "asc" : "desc";
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isByeRow(row: { opponent: string; opponentDeck: string }): boolean {
  const opponent = normalize(row.opponent);
  const opponentDeck = normalize(row.opponentDeck);

  return (
    opponent === "bye" ||
    opponentDeck === "bye" ||
    opponentDeck === "no deck (bye)"
  );
}

function withoutByes<T extends { opponent: string; opponentDeck: string }>(
  rows: T[],
): T[] {
  return rows.filter((row) => !isByeRow(row));
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;
  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";
  const view = parseView(first(sp.view));
  const playerSort = parsePlayerSort(first(sp.sort));
  const standingSort = parseStandingSort(first(sp.sort));
  const dir = parseSortDir(first(sp.dir));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
          Standings
        </h1>

        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Player performance. The yearly view ranks by matches played; the
          monthly views rank by points (win 3 · draw 1 · loss 0). Byes are
          excluded from standings.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === view;
          const params = new URLSearchParams({
            view: t.key,
            store,
          });

          return (
            <Link
              key={t.key}
              href={`/standings?${params.toString()}`}
              className={
                active
                  ? "rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white"
                  : "rounded-md border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {view === "year" ? (
        <YearView
          store={store}
          player={first(sp.player)}
          sort={playerSort}
          dir={dir}
          locale={locale}
        />
      ) : view === "tournament-data" ? (
        <TournamentDataView store={store} />
      ) : (
        <MonthlyView
          store={store}
          view={view}
          selectedMonth={first(sp.month)}
          sort={standingSort}
          dir={dir}
        />
      )}
    </div>
  );
}

async function YearView({
  store,
  player,
  sort,
  dir,
  locale,
}: {
  store: string;
  player?: string;
  sort: PlayerSortKey;
  dir: SortDir;
  locale: Locale;
}) {
  const year = new Date().getUTCFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const rows = withoutByes(await getPlayerRows({ store, from, to }));
  const stats = computePlayerAnalysis(rows);

  const selected =
    player && stats.some((s) => s.player === player) ? player : undefined;

  const listParams = new URLSearchParams({
    view: "year",
    store,
  });

  const baseParams = new URLSearchParams(listParams);

  if (selected) {
    baseParams.set("player", selected);
  }

  const listHref = `/standings?${listParams.toString()}`;
  const baseHref = `/standings?${baseParams.toString()}`;

  return (
    <div>
      {selected && (
        <DeckBreakdownTable
          player={selected}
          rows={computeDeckBreakdown(
            await getPlayerDeckRows({ store, player: selected, from, to }),
          )}
          backHref={listHref}
          locale={locale}
        />
      )}

      <PlayerTable
        title={`Whole year — ${year}`}
        subtitle="All events. Win / loss / draw rate per player, ranked by matches played by default. Byes are excluded. Click a column header to change sorting."
        stats={stats}
        sortKey={sort}
        sortDir={dir}
        baseHref={baseHref}
        hrefFor={(p) => {
          const params = new URLSearchParams({
            view: "year",
            store,
            player: p,
            sort,
            dir,
          });

          return `/standings?${params.toString()}`;
        }}
        selected={selected}
      />
    </div>
  );
}

async function MonthlyView({
  store,
  view,
  selectedMonth,
  sort,
  dir,
}: {
  store: string;
  view: "tuesday" | "friday";
  selectedMonth?: string;
  sort: StandingSortKey;
  dir: StandingSortDir;
}) {
  const event = view === "tuesday" ? "Tuesday" : "Friday";
  const months = await listMonths(store, event);
  const eventLabel = event;

  if (months.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No {eventLabel} matches recorded yet.
      </p>
    );
  }

  const selected =
    selectedMonth && months.includes(selectedMonth) ? selectedMonth : months[0];

  const idx = months.indexOf(selected);
  const older = months[idx + 1];
  const newer = months[idx - 1];

  const range = monthRange(selected);

  const rows = withoutByes(
    await getPlayerRows({
      store,
      event,
      from: range.from,
      to: range.to,
    }),
  );

  const stats = computePointsStandings(rows);

  const baseParams = new URLSearchParams({
    view,
    store,
    month: selected,
  });

  const baseHref = `/standings?${baseParams.toString()}`;

  const linkFor = (m: string) => {
    const params = new URLSearchParams({
      view,
      store,
      month: m,
      sort,
      dir,
    });

    return `/standings?${params.toString()}`;
  };

  const navBtn =
    "rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

  const navBtnOff =
    "rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-400 cursor-default dark:border-neutral-800 dark:text-neutral-600";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            {eventLabel} — {range.label}
          </h2>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Ranked by points by default. Byes are excluded. Click a column
            header to change sorting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {older ? (
            <Link href={linkFor(older)} className={navBtn}>
              ← Older
            </Link>
          ) : (
            <span className={navBtnOff}>← Older</span>
          )}

          {newer ? (
            <Link href={linkFor(newer)} className={navBtn}>
              Newer →
            </Link>
          ) : (
            <span className={navBtnOff}>Newer →</span>
          )}
        </div>
      </div>

      <StandingsTable
        stats={stats}
        sortKey={sort}
        sortDir={dir}
        baseHref={baseHref}
      />
    </div>
  );
}

async function TournamentDataView({ store }: { store: string }) {
  const data = await getTournamentData(store);

  return <TournamentDataTab data={data} />;
}
