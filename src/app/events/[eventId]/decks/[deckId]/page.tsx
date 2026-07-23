import { getEventDecklist, type CardEntry } from "@/lib/decklist-dump";
import { getLocale } from "@/lib/i18n.server";
import type { Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function copy(locale: Locale) {
  if (locale === "pt-BR") {
    return {
      rank: "Colocação",
      points: "Pontos",
      matchRecord: "V-D-E (partidas)",
      gameRecord: "V-D-E (jogos)",
      mainboard: "Deck principal",
      sideboard: "Sideboard",
      round: "Baseado em",
      viewOnMelee: "Ver no melee.gg",
      notFoundTitle: "Decklist não encontrada",
      notFoundBody:
        "Nenhum deck com esse ID foi encontrado neste evento.",
    };
  }

  return {
    rank: "Rank",
    points: "Points",
    matchRecord: "Match record",
    gameRecord: "Game record",
    mainboard: "Mainboard",
    sideboard: "Sideboard",
    round: "Based on",
    viewOnMelee: "View on melee.gg",
    notFoundTitle: "Decklist not found",
    notFoundBody: "No deck with that ID was found for this event.",
  };
}

function cardCount(cards: CardEntry[]): number {
  return cards.reduce((sum, c) => sum + c.quantity, 0);
}

function CardColumn({
  title,
  categories,
  total,
}: {
  title: string;
  categories: [string, CardEntry[]][];
  total: number;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 flex items-baseline justify-between text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        <span>{title}</span>
        <span>{total}</span>
      </h2>

      <div className="space-y-4">
        {categories.map(([category, cards]) => (
          <div key={category}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
              {category} ({cardCount(cards)})
            </h3>
            <ul className="space-y-0.5">
              {cards.map((card) => (
                <li
                  key={card.name}
                  className="flex gap-2 text-sm text-neutral-700 dark:text-neutral-300"
                >
                  <span className="w-6 shrink-0 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
                    {card.quantity}
                  </span>
                  <span>{card.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function DecklistPage({
  params,
}: {
  params: Promise<{ eventId: string; deckId: string }>;
}) {
  const { eventId, deckId } = await params;
  const locale = await getLocale();
  const c = copy(locale);

  const data = await getEventDecklist(eventId, deckId);

  if (!data) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-lg font-bold text-neutral-950 dark:text-white">
          {c.notFoundTitle}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {c.notFoundBody}
        </p>
      </div>
    );
  }

  const { tournament, player } = data;
  const categories = Object.entries(player.decklist.categories);
  const mainCategories = categories.filter(([name]) => name !== "Sideboard");
  const sideCategories = categories.filter(([name]) => name === "Sideboard");
  const mainTotal = mainCategories.reduce(
    (sum, [, cards]) => sum + cardCount(cards),
    0,
  );
  const sideTotal = sideCategories.reduce(
    (sum, [, cards]) => sum + cardCount(cards),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
          {tournament.format} · {tournament.name}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
          {player.decklist_name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {player.player_name} · {c.round} {tournament.round_used_for_standings}
        </p>
        <a
          href={tournament.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-violet-600 hover:underline dark:text-violet-400"
        >
          {c.viewOnMelee}
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={c.rank} value={`#${player.rank}`} />
        <Stat label={c.points} value={player.points} />
        <Stat label={c.matchRecord} value={player.match_record} />
        <Stat label={c.gameRecord} value={player.game_record} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CardColumn
          title={c.mainboard}
          categories={mainCategories}
          total={mainTotal}
        />
        <CardColumn
          title={c.sideboard}
          categories={sideCategories}
          total={sideTotal}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-neutral-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}
