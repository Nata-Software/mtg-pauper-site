/**
 * Renders a mana cost string ("{1}{R}", "{W/U}{X}") as Scryfall's official
 * symbol SVGs.
 *
 * Source is Scryfall's /symbology set at svgs.scryfall.io, the same origin we
 * already use for card images — stable, official, and no scraping. The URL is
 * derived from the symbol itself (`{W/U}` -> `WU.svg`), so all 84 symbols work
 * without shipping a lookup table or fetching anything at render time.
 */

/** "{1}{W/U}" -> ["1", "W/U"] */
function parseCost(cost: string): string[] {
  return [...String(cost ?? "").matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

/** "W/U" -> "WU", "1" -> "1", "T" -> "T" (Scryfall's file naming). */
function symbolFile(symbol: string): string {
  return symbol.replace(/\//g, "").replace(/½/g, "HALF");
}

export function ManaCost({
  cost,
  className = "",
  size = 12,
}: {
  cost: string | null;
  className?: string;
  size?: number;
}) {
  const symbols = parseCost(cost ?? "");
  if (symbols.length === 0) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-px align-middle ${className}`}
      aria-label={cost ?? undefined}
    >
      {symbols.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${s}-${i}`}
          src={`https://svgs.scryfall.io/card-symbols/${symbolFile(s)}.svg`}
          alt={s}
          width={size}
          height={size}
          loading="lazy"
          className="inline-block"
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}
