import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/i18n.server";
import { canonicalDeck } from "@/lib/archetype/normalize.mjs";

export const dynamic = "force-dynamic";

/** A single card: image, oracle text, and which of our decks play it. */
export default async function CardPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const locale = await getLocale();
  const pt = locale === "pt-BR";

  const card = await prisma.card.findUnique({
    where: { key: decodeURIComponent(key) },
  });
  if (!card || !card.resolved) notFound();

  // Which archetypes run it — read straight from the stored decklists.
  const lists = await prisma.decklist.findMany({
    where: { archetype: { not: "" } },
    select: { archetype: true, cards: true },
  });
  const counts = new Map<string, number>();
  for (const l of lists) {
    const has = (l.cards as { name: string }[]).some(
      (c) =>
        c.name.toLowerCase().includes(card.name.toLowerCase()) ||
        card.name.toLowerCase().includes(c.name.toLowerCase()),
    );
    if (has)
      counts.set(l.archetype, (counts.get(l.archetype) ?? 0) + 1);
  }
  const decks = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
        {card.name}
      </h1>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        {card.imageNormal && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageNormal}
            alt={card.name}
            width={330}
            height={460}
            className="w-[280px] shrink-0 self-start rounded-xl shadow-lg"
          />
        )}

        <div className="min-w-0 flex-1">
          <dl className="space-y-1 text-sm">
            <Row label={pt ? "Custo" : "Mana cost"} value={card.manaCost} />
            <Row label={pt ? "Tipo" : "Type"} value={card.typeLine} />
            <Row label={pt ? "Raridade" : "Rarity"} value={card.rarity} />
            {card.power && (
              <Row label={pt ? "P/R" : "P/T"} value={`${card.power}/${card.toughness}`} />
            )}
          </dl>

          {card.oracleText && (
            <p className="mt-4 whitespace-pre-line rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              {card.oracleText}
            </p>
          )}

          {card.scryfallUri && (
            <a
              href={card.scryfallUri}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              {pt ? "Ver no Scryfall" : "View on Scryfall"} ↗
            </a>
          )}
        </div>
      </div>

      {decks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {pt ? "Decks que jogam esta carta" : "Decks playing this card"}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {decks.map(([archetype, n]) => {
              const label = canonicalDeck(archetype, archetype);
              return (
                <li key={archetype}>
                  <Link
                    href={`/decks/${encodeURIComponent(label)}`}
                    className="inline-block rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700 hover:border-violet-400 hover:text-violet-700 dark:border-neutral-800 dark:text-neutral-300 dark:hover:text-violet-400"
                  >
                    {label} <span className="text-neutral-400">({n})</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="text-neutral-800 dark:text-neutral-200">{value}</dd>
    </div>
  );
}
