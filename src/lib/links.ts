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
