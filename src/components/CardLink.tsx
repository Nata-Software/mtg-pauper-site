"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * A card name in a decklist: hovering shows the card image, clicking opens its
 * page.
 *
 * The image URL is already on the row (cached from Scryfall at import time), so
 * the preview needs no fetch and appears instantly. The <img> is only mounted
 * while hovering, so a 75-card page doesn't request 75 images up front — the
 * browser fetches one the first time you hover it, then serves it from cache.
 *
 * A card we couldn't resolve still renders as plain text: an unknown card must
 * never blank out a decklist.
 */
export function CardLink({
  name,
  cardKey,
  qty,
  imageNormal,
  resolved,
}: {
  name: string;
  cardKey: string;
  qty: number;
  imageNormal: string | null;
  resolved: boolean;
}) {
  const [hover, setHover] = useState(false);

  const label = (
    <>
      <span className="w-6 shrink-0 text-right tabular-nums text-neutral-400 dark:text-neutral-500">
        {qty}
      </span>
      <span className="truncate">{name}</span>
    </>
  );

  if (!resolved || !imageNormal) {
    return (
      <span
        className="flex gap-2 px-1 py-0.5 text-sm text-neutral-500 dark:text-neutral-400"
        title="Card not found on Scryfall"
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className="relative block"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link
        href={`/cards/${encodeURIComponent(cardKey)}`}
        className="flex gap-2 rounded px-1 py-0.5 text-sm text-neutral-700 hover:bg-violet-50 hover:text-violet-700 dark:text-neutral-300 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
      >
        {label}
      </Link>

      {hover && (
        <span
          role="presentation"
          className="pointer-events-none absolute left-full top-0 z-50 hidden -translate-y-2 pl-3 sm:block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageNormal}
            alt=""
            width={244}
            height={340}
            loading="lazy"
            className="w-[244px] max-w-none rounded-xl shadow-2xl ring-1 ring-black/20"
          />
        </span>
      )}
    </span>
  );
}
