import Link from "next/link";
import { PlayerTable } from "@/components/PlayerTable";
import { StandingsTable } from "@/components/StandingsTable";
import { DeckBreakdownTable } from "@/components/DeckBreakdownTable";
import {
  computeDeckBreakdown,
  computePlayerAnalysis,
  computePointsStandings,
} from "@/lib/stats";
import {
  getPlayerDeckRows,
  getPlayerRows,
  listMonths,
  listStores,
  monthRange,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

type View = "year" | "tuesday" | "friday";
const TABS: { key: View; label: string }[] = [
  { key: "year", label: "Whole year" },
  { key: "tuesday", label: "Tuesday" },
  { key: "friday", label: "Friday" },
];

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";
  const view = (first(sp.view) as View) || "year";

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
          Standings
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Player performance. The yearly view ranks by matches played; the
          monthly views rank by points (win 3 · draw 1 · loss 0).
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === view;
          return (
            <Link
              key={t.key}
              href={`/standings?view=${t.key}`}
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
        <YearView store={store} player={first(sp.player)} />
      ) : (
        <MonthlyView
          store={store}
          view={view}
          selectedMonth={first(sp.month)}
        />
      )}
    </div>
  );
}

async function YearView({
  store,
  player,
}: {
  store: string;
  player?: string;
}) {
  const year = new Date().getUTCFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const rows = await getPlayerRows({ store, from, to });
  const stats = computePlayerAnalysis(rows);

  // Drill-down: a specific player's win rate by deck.
  const selected = player && stats.some((s) => s.player === player)
    ? player
    : undefined;

  return (
    <div>
      {selected && (
        <DeckBreakdownTable
          player={selected}
          rows={computeDeckBreakdown(
            await getPlayerDeckRows({ store, player: selected, from, to }),
          )}
          backHref="/standings?view=year"
        />
      )}

      <PlayerTable
        title={`Whole year — ${year}`}
        subtitle="All events. Win / loss / draw rate per player (byes included), ranked by matches played. Click a name for their per-deck breakdown."
        stats={stats}
        hrefFor={(p) => `/standings?view=year&player=${encodeURIComponent(p)}`}
        selected={selected}
      />
    </div>
  );
}

async function MonthlyView({
  store,
  view,
  selectedMonth,
}: {
  store: string;
  view: "tuesday" | "friday";
  selectedMonth?: string;
}) {
  // Event label as stored in the DB (capitalized), and the display label.
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
  const older = months[idx + 1]; // months sorted newest-first
  const newer = months[idx - 1];
  const range = monthRange(selected);

  const rows = await getPlayerRows({
    store,
    event,
    from: range.from,
    to: range.to,
  });
  const stats = computePointsStandings(rows);

  const linkFor = (m: string) => `/standings?view=${view}&month=${m}`;
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
            Ranked by points (win 3 · draw 1 · loss 0).
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

      <StandingsTable stats={stats} />
    </div>
  );
}
