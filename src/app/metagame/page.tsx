import Link from "next/link";

import { DeckDrilldown } from "@/components/DeckDrilldown";
import { MetagameGrid } from "@/components/MetagameGrid";
import { getCardArtUrls } from "@/lib/scryfall";
import { monthsAgoISO, toISODate } from "@/lib/dates";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import {
  getDeckDrilldownData,
  getMetagameData,
  listStores,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type RangeKey = "1m" | "6m" | "1y";

const RANGES: { key: RangeKey; labelKey: TranslationKey; months: number }[] = [
  { key: "1m", labelKey: "metagame.range.1m", months: 1 },
  { key: "6m", labelKey: "metagame.range.6m", months: 6 },
  { key: "1y", labelKey: "metagame.range.1y", months: 12 },
];

function parseRange(value: string | undefined): RangeKey {
  return value === "6m" || value === "1y" ? value : "1m";
}

const inputCls =
  "rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";

const labelCls =
  "flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400";

export default async function MetagamePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const locale = await getLocale();
  const sp = await searchParams;

  const stores = await listStores();
  const store = first(sp.store) || stores[0] || "default";
  const range = parseRange(first(sp.range));
  const selectedDeck = first(sp.deck);

  const preset = RANGES.find((r) => r.key === range)!;

  const to = toISODate(new Date());
  const from = monthsAgoISO(preset.months);

  const baseParams = new URLSearchParams({ store, range });
  const baseHref = `/metagame?${baseParams.toString()}`;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 dark:text-white">
          {t(locale, "metagame.title")}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {t(locale, "metagame.subtitle")}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => {
            const active = r.key === range;
            const params = new URLSearchParams({ store, range: r.key });

            return (
              <Link
                key={r.key}
                href={`/metagame?${params.toString()}`}
                className={
                  active
                    ? "rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white"
                    : "rounded-md border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }
              >
                {t(locale, r.labelKey)}
              </Link>
            );
          })}
        </div>

        {stores.length > 1 && (
          <form method="get" action="/metagame" className="flex items-end gap-2">
            <input type="hidden" name="range" value={range} />

            <label className={labelCls}>
              {t(locale, "filter.store")}
              <select name="store" defaultValue={store} className={inputCls}>
                {stores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              {t(locale, "filter.apply")}
            </button>
          </form>
        )}
      </div>

      {selectedDeck ? (
        <DeckDrilldown
          deck={selectedDeck}
          data={await getDeckDrilldownData({ store, from, to }, selectedDeck)}
          backHref={baseHref}
          locale={locale}
        />
      ) : (
        <MetagameGridSection
          store={store}
          from={from}
          to={to}
          baseHref={baseHref}
          locale={locale}
        />
      )}
    </div>
  );
}

async function MetagameGridSection({
  store,
  from,
  to,
  baseHref,
  locale,
}: {
  store: string;
  from: string;
  to: string;
  baseHref: string;
  locale: Locale;
}) {
  const decks = await getMetagameData({ store, from, to });

  const cardNames = [
    ...new Set(
      decks
        .map((d) => d.representativeCardName)
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  const cardArt = await getCardArtUrls(cardNames);

  return (
    <MetagameGrid
      decks={decks}
      cardArt={cardArt}
      baseHref={baseHref}
      locale={locale}
    />
  );
}