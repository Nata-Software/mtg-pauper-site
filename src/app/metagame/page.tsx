import Link from "next/link";

import { DeckDrilldown } from "@/components/DeckDrilldown";
import { MetagameGrid } from "@/components/MetagameGrid";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";
import { getArchetypeImage } from "@/lib/archetype-images";
import { monthsAgoISO, toISODate } from "@/lib/dates";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n.server";
import {
  getDeckDrilldownData,
  getMetagameData,
  type MetagameDeckRow,
  listStores,
} from "@/lib/queries";
import { getCardArtUrls } from "@/lib/scryfall";

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

function deckFilterCopy(locale: Locale) {
  if (locale === "pt-BR") {
    return {
      deck: "Filtrar deck",
      searchDeck: "Buscar deck...",
      typeAtLeast3: "Digite pelo menos 3 letras",
      noDeckFound: "Nenhum deck encontrado",
      apply: "Aplicar",
      reset: "Limpar",
    };
  }

  return {
    deck: "Filter deck",
    searchDeck: "Search deck...",
    typeAtLeast3: "Type at least 3 letters",
    noDeckFound: "No deck found",
    apply: "Apply",
    reset: "Reset",
  };
}

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
  const selectedDeck = first(sp.deck) || "";
  const selectedPlayer = first(sp.player) || "";

  const preset = RANGES.find((r) => r.key === range)!;

  const to = toISODate(new Date());
  const from = monthsAgoISO(preset.months);

  const decks = await getMetagameData({ store, from, to });
  const deckNames = decks.map((row) => row.deck);

  const gridBaseParams = new URLSearchParams({ store, range });
  const gridBaseHref = `/metagame?${gridBaseParams.toString()}`;

  function rangeHref(nextRange: RangeKey): string {
    const params = new URLSearchParams({ store, range: nextRange });

    if (selectedDeck) params.set("deck", selectedDeck);
    if (selectedPlayer) params.set("player", selectedPlayer);

    return `/metagame?${params.toString()}`;
  }

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

            return (
              <Link
                key={r.key}
                href={rangeHref(r.key)}
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
          <form
            method="get"
            action="/metagame"
            className="flex items-end gap-2"
          >
            <input type="hidden" name="range" value={range} />

            {selectedDeck && (
              <input type="hidden" name="deck" value={selectedDeck} />
            )}

            {selectedPlayer && (
              <input type="hidden" name="player" value={selectedPlayer} />
            )}

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

      <DeckFilter
        store={store}
        range={range}
        selectedDeck={selectedDeck}
        selectedPlayer={selectedPlayer}
        deckNames={deckNames}
        locale={locale}
      />

      {selectedDeck ? (
        <DeckDrilldownSection
          store={store}
          from={from}
          to={to}
          range={range}
          deck={selectedDeck}
          player={selectedPlayer}
          locale={locale}
        />
      ) : (
        <MetagameGridSection
          decks={decks}
          baseHref={gridBaseHref}
          locale={locale}
        />
      )}
    </div>
  );
}

function DeckFilter({
  store,
  range,
  selectedDeck,
  selectedPlayer,
  deckNames,
  locale,
}: {
  store: string;
  range: RangeKey;
  selectedDeck: string;
  selectedPlayer: string;
  deckNames: string[];
  locale: Locale;
}) {
  const c = deckFilterCopy(locale);
  const resetParams = new URLSearchParams({ store, range });
  const resetHref = `/metagame?${resetParams.toString()}`;

  return (
    <form
      method="get"
      action="/metagame"
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <input type="hidden" name="store" value={store} />
      <input type="hidden" name="range" value={range} />

      {selectedPlayer && (
        <input type="hidden" name="player" value={selectedPlayer} />
      )}

      <div className="min-w-64">
        <PlayerSearchInput
          key={selectedDeck || "all-decks"}
          name="deck"
          players={deckNames}
          selectedPlayer={selectedDeck}
          label={c.deck}
          placeholder={c.searchDeck}
          minimumLabel={c.typeAtLeast3}
          noResultsLabel={c.noDeckFound}
        />
      </div>

      <button
        type="submit"
        className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
      >
        {c.apply}
      </button>

      {selectedDeck && (
        <Link
          href={resetHref}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {c.reset}
        </Link>
      )}
    </form>
  );
}

async function DeckDrilldownSection({
  store,
  from,
  to,
  range,
  deck,
  player,
  locale,
}: {
  store: string;
  from: string;
  to: string;
  range: RangeKey;
  deck: string;
  player: string;
  locale: Locale;
}) {
  const [allData, filteredData] = player
    ? await Promise.all([
        getDeckDrilldownData({ store, from, to }, deck),
        getDeckDrilldownData({ store, from, to, player }, deck),
      ])
    : await Promise.all([
        getDeckDrilldownData({ store, from, to }, deck),
        getDeckDrilldownData({ store, from, to }, deck),
      ]);

  const deckParams = new URLSearchParams({ store, range, deck });
  const filterBaseHref = `/metagame?${deckParams.toString()}`;

  const backParams = new URLSearchParams({ store, range });
  const backHref = `/metagame?${backParams.toString()}`;

  const players = allData?.recentPlayers.map((row) => row.player) ?? [];

  return (
    <DeckDrilldown
      deck={deck}
      data={filteredData}
      backHref={backHref}
      filterBaseHref={filterBaseHref}
      store={store}
      range={range}
      selectedPlayer={player}
      players={players}
      locale={locale}
    />
  );
}

async function MetagameGridSection({
  decks,
  baseHref,
  locale,
}: {
  decks: MetagameDeckRow[];
  baseHref: string;
  locale: Locale;
}) {
  const decksNeedingScryfall = decks.filter(
    (deck) => !getArchetypeImage(deck.deck),
  );

  const cardNames = [
    ...new Set(
      decksNeedingScryfall
        .map((d) => d.representativeCardName)
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  const scryfallCardArt = await getCardArtUrls(cardNames);

  const deckArt = new Map<string, string | null>();

  for (const row of decks) {
    const localImage = getArchetypeImage(row.deck);

    deckArt.set(
      row.deck,
      localImage ??
        (row.representativeCardName
          ? (scryfallCardArt.get(row.representativeCardName) ?? null)
          : null),
    );
  }

  return (
    <MetagameGrid
      decks={decks}
      deckArt={deckArt}
      baseHref={baseHref}
      locale={locale}
    />
  );
}
