import Link from "next/link";
import { LeagueTable } from "@/components/LeagueTable";
import { computePointsStandings } from "@/lib/stats";
import { getPlayerRows, listMonths, listStores, monthRange } from "@/lib/queries";
import { t, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const MONTH_KEYS: TranslationKey[] = [
  "month.01", "month.02", "month.03", "month.04", "month.05", "month.06",
  "month.07", "month.08", "month.09", "month.10", "month.11", "month.12",
];

const btnActive = "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white";
const btnInactive =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";
const btnDisabled =
  "rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-400 cursor-default dark:border-neutral-800 dark:text-neutral-600";

export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;
  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";

  const [tuesdayMonths, fridayMonths] = await Promise.all([
    listMonths(store, "Tuesday"),
    listMonths(store, "Friday"),
  ]);
  const monthsWithData = new Set([...tuesdayMonths, ...fridayMonths]);
  const allMonths = [...monthsWithData].sort().reverse();

  const now = new Date();
  const currentYYYYMM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [defaultYear, defaultMonthNum] = (allMonths[0] || currentYYYYMM).split("-");

  const years = new Set(allMonths.map((m) => m.slice(0, 4)));
  years.add(defaultYear);
  const yearOptions = [...years].sort().reverse();

  const year = first(sp.year) || defaultYear;
  const month = first(sp.month) || defaultMonthNum;
  const range = monthRange(`${year}-${month}`);

  const [tuesdayRows, fridayRows] = await Promise.all([
    getPlayerRows({ store, event: "Tuesday", from: range.from, to: range.to }),
    getPlayerRows({ store, event: "Friday", from: range.from, to: range.to }),
  ]);
  const tuesdayStats = computePointsStandings(tuesdayRows);
  const fridayStats = computePointsStandings(fridayRows);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
          {t(locale, "league.title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t(locale, "league.subtitle")}
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t(locale, "league.year")}
        </div>
        <div className="flex flex-wrap gap-2">
          {yearOptions.map((y) => (
            <Link
              key={y}
              href={`/league?year=${y}&month=${month}`}
              className={y === year ? btnActive : btnInactive}
            >
              {y}
            </Link>
          ))}
        </div>

        <div className="mt-3 mb-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t(locale, "league.month")}
        </div>
        <div className="flex flex-wrap gap-2">
          {MONTH_KEYS.map((key, idx) => {
            const mm = String(idx + 1).padStart(2, "0");
            const label = t(locale, key);
            if (!monthsWithData.has(`${year}-${mm}`)) {
              return (
                <span key={mm} className={btnDisabled}>
                  {label}
                </span>
              );
            }
            return (
              <Link
                key={mm}
                href={`/league?year=${year}&month=${mm}`}
                className={mm === month ? btnActive : btnInactive}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <LeagueTable
          title={t(locale, "standings.tab.tuesday")}
          stats={tuesdayStats}
          locale={locale}
        />
        <LeagueTable
          title={t(locale, "standings.tab.friday")}
          stats={fridayStats}
          locale={locale}
        />
      </div>
    </div>
  );
}
