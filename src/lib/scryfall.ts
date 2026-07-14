/**
 * Card-art lookups for metagame deck tiles. Scryfall is the source of truth
 * for card images — we only store card *names* (via Decklist.cards), never
 * image URLs, so art is resolved at render time and cached by Next's fetch
 * cache (see revalidate below) rather than in the database.
 */

const UA = "mtg-pauper-site (metagame tab; contact via repo issues)";

type ScryfallImageUris = {
  art_crop?: string;
};

type ScryfallCard = {
  image_uris?: ScryfallImageUris;
  card_faces?: { image_uris?: ScryfallImageUris }[];
};

async function fetchArtUrl(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
      {
        headers: { "user-agent": UA, accept: "application/json" },
        next: { revalidate: 60 * 60 * 24 * 7 }, // art doesn't change; cache a week
      },
    );

    if (!res.ok) return null;

    const card = (await res.json()) as ScryfallCard;

    return (
      card.image_uris?.art_crop ??
      card.card_faces?.[0]?.image_uris?.art_crop ??
      null
    );
  } catch {
    return null; // network hiccup or bad response — tile just falls back
  }
}

/**
 * Resolves art-crop URLs for a batch of card names, in small concurrent
 * pools so we don't hammer Scryfall with dozens of simultaneous requests.
 */
export async function getCardArtUrls(
  names: string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(names)];
  const out = new Map<string, string | null>();
  const POOL = 6;

  for (let i = 0; i < unique.length; i += POOL) {
    const batch = unique.slice(i, i + POOL);
    const urls = await Promise.all(batch.map(fetchArtUrl));
    batch.forEach((name, j) => out.set(name, urls[j]));
  }

  return out;
}
