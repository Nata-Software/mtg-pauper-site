import Link from "next/link";
import type { CSSProperties } from "react";
import { t, type Locale } from "@/lib/i18n";
import { winrateColor, pct } from "@/lib/colors";
import type { MetagameDeckRow } from "@/lib/queries";

function shareLabel(sharePct: number): string {
  return sharePct.toFixed(1);
}

function deckHref(baseHref: string, deck: string): string {
  const sep = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${sep}deck=${encodeURIComponent(deck)}`;
}

function DeckTile({
  row,
  artUrl,
  baseHref,
  locale,
}: {
  row: MetagameDeckRow;
  artUrl: string | null;
  baseHref: string;
  locale: Locale;
}) {
  const { bgLight, fgLight, bgDark, fgDark } = winrateColor(
    row.winrate,
    row.wins + row.losses,
  );
  const badgeStyle = {
    "--cb-l": bgLight,
    "--cf-l": fgLight,
    "--cb-d": bgDark,
    "--cf-d": fgDark,
  } as CSSProperties;
  const playerWord = t(
    locale,
    row.entrants === 1 ? "metagame.entrants.singular" : "metagame.entrants.plural",
  );

  return (
    <Link href={deckHref(baseHref, row.deck)}>
      <article className="group h-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">
        <div className="relative h-40 overflow-hidden bg-neutral-900">
          {artUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition duration-300 ease-out group-hover:scale-105"
              style={{ backgroundImage: `url("${artUrl}")` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/0" />
          <h2 className="absolute inset-x-0 bottom-0 line-clamp-2 px-3 pb-2 text-center text-base font-bold leading-snug text-white [text-shadow:0_1px_4px_rgb(0_0_0_/_0.85)]">
            {row.deck}
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 p-3">
          <p className="text-center text-xs text-neutral-600 dark:text-neutral-300">
            {t(locale, "metagame.entrants", {
              count: row.entrants.toLocaleString(),
              playerWord,
            })}{" "}
            · {t(locale, "metagame.share", { pct: shareLabel(row.sharePct) })}
          </p>

          <span
            className="meta-badge shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums"
            style={badgeStyle}
          >
            {pct(row.winrate)}
          </span>
        </div>
      </article>
    </Link>
  );
}

export function MetagameGrid({
  decks,
  cardArt,
  baseHref,
  locale,
}: {
  decks: MetagameDeckRow[];
  cardArt: Map<string, string | null>;
  baseHref: string;
  locale: Locale;
}) {
  if (decks.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {t(locale, "metagame.noData")}
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {decks.map((row) => (
        <DeckTile
          key={row.deck}
          row={row}
          artUrl={
            row.representativeCardName
              ? cardArt.get(row.representativeCardName) ?? null
              : null
          }
          baseHref={baseHref}
          locale={locale}
        />
      ))}
    </div>
  );
}
