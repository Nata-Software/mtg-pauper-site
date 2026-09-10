"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

/**
 * A card name in a decklist: hovering shows the card image, clicking opens its
 * page.
 *
 * The preview is `position: fixed` and measured from the row on hover, rather
 * than absolutely positioned inside it. An absolutely positioned child still
 * participates in its containing block enough to make a CSS multi-column
 * layout re-balance, which visibly shifted the blocks below (the Land block
 * jumped as you hovered). Fixed positioning takes it out of the flow entirely,
 * so nothing under it can move.
 *
 * The image URL is already on the row, cached from Scryfall at import time, so
 * the preview needs no fetch. The <img> only mounts while hovering, so a
 * 75-card page doesn't request 75 images up front.
 *
 * A card we couldn't resolve still renders as plain text: an unknown card must
 * never blank out a decklist.
 */
const PREVIEW_W = 244;
const PREVIEW_H = 340;

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
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  // Shared by mouse and keyboard focus, so it takes the common base event.
  const show = useCallback((e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // Prefer the right of the row; flip left when it would overflow, and clamp
    // vertically so the whole card stays on screen.
    const x =
      r.right + 12 + PREVIEW_W < window.innerWidth
        ? r.right + 12
        : Math.max(8, r.left - PREVIEW_W - 12);
    const y = Math.min(
      Math.max(8, r.top - 8),
      Math.max(8, window.innerHeight - PREVIEW_H - 8),
    );
    setAt({ x, y });
  }, []);

  const hide = useCallback(() => setAt(null), []);

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
    <>
      <Link
        href={`/cards/${encodeURIComponent(cardKey)}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="flex gap-2 rounded px-1 py-0.5 text-sm text-neutral-700 hover:bg-violet-50 hover:text-violet-700 dark:text-neutral-300 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
      >
        {label}
      </Link>

      {at && (
        <span
          aria-hidden
          className="pointer-events-none fixed z-50 hidden sm:block"
          style={{ left: at.x, top: at.y }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageNormal}
            alt=""
            width={PREVIEW_W}
            height={PREVIEW_H}
            loading="lazy"
            className="max-w-none rounded-xl shadow-2xl ring-1 ring-black/20"
            style={{ width: PREVIEW_W }}
          />
        </span>
      )}
    </>
  );
}
