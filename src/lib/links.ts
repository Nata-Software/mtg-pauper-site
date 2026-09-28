export function meleeTournamentUrl(
  tournamentId: string | null | undefined,
): string | null {
  const id = String(tournamentId ?? "").trim();

  return /^\d+$/.test(id)
    ? `https://melee.gg/Tournament/View/${id}`
    : null;
}

export function meleeDecklistUrl(
  decklistId: string | null | undefined,
): string | null {
  const id = String(decklistId ?? "").trim();

  return /^[a-z0-9-]+$/i.test(id)
    ? `https://melee.gg/Decklist/View/${encodeURIComponent(id)}`
    : null;
}

export function deckPageHref(deck: string, range: string): string {
  return `/decks/${encodeURIComponent(deck)}?range=${range}`;
}

/**
 * Turn a general internal deck URL into a URL for one exact stored list.
 * Exact lists use the all-time range so an older list is not rejected by the
 * deck page's range guard and silently replaced by a newer featured list.
 */
export function specificDeckPageHref(
  deckHref: string | null | undefined,
  decklistId: string | null | undefined,
): string | null {
  const id = String(decklistId ?? "").trim();
  if (!deckHref || !/^[a-z0-9-]+$/i.test(id)) return null;

  const url = new URL(deckHref, "https://internal.invalid");
  if (!url.pathname.startsWith("/decks/")) return null;

  url.searchParams.set("range", "all");
  url.searchParams.set("list", id);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
