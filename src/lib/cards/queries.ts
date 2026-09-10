/**
 * Decklist + card lookups for the deck pages.
 *
 * Reads the decklists we already store (Decklist.cards) and joins them to the
 * locally cached Card rows, so rendering a deck costs one query and no Scryfall
 * round-trip. Cards missing from the cache still render — just as plain text
 * with no preview — so a brand-new card never breaks the page.
 */
import { prisma } from "@/lib/prisma";
import { cardKey, cleanCardName } from "./resolve";
import { canonicalDeck } from "@/lib/archetype/normalize.mjs";

export type DeckCard = {
  qty: number;
  name: string;
  key: string;
  typeLine: string | null;
  manaCost: string | null;
  imageSmall: string | null;
  imageNormal: string | null;
  scryfallUri: string | null;
  resolved: boolean;
};

export type DeckListing = {
  deck: string;
  decklists: number;
  matches: number;
  wins: number;
  latestDecklistId: string | null;
  artUrl: string | null;
  topCards: string[];
};

/** Broad card-type buckets, in the order a decklist is conventionally read. */
const TYPE_ORDER = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Other",
] as const;

export function cardGroup(typeLine: string | null): string {
  const t = String(typeLine ?? "");
  // Order matters: an "Artifact Creature" is read as a creature, and a
  // "Land Creature" as a land.
  if (/\bLand\b/.test(t)) return "Land";
  if (/\bCreature\b/.test(t)) return "Creature";
  for (const g of ["Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker"])
    if (new RegExp(`\\b${g}\\b`).test(t)) return g;
  return "Other";
}

export function groupDeckCards(cards: DeckCard[]): [string, DeckCard[]][] {
  const by = new Map<string, DeckCard[]>();
  for (const c of cards) {
    const g = cardGroup(c.typeLine);
    if (!by.has(g)) by.set(g, []);
    by.get(g)!.push(c);
  }
  for (const list of by.values())
    list.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));

  return TYPE_ORDER.filter((g) => by.has(g)).map((g) => [g, by.get(g)!]);
}

/** One decklist, joined to the card cache. */
export async function getDecklist(id: string): Promise<{
  id: string;
  player: string;
  rawName: string;
  archetype: string;
  tournamentId: string | null;
  tournamentName: string | null;
  date: Date | null;
  cards: DeckCard[];
} | null> {
  const dl = await prisma.decklist.findUnique({ where: { id } });
  if (!dl) return null;

  const raw = dl.cards as { qty: number; name: string }[];
  const keys = [...new Set(raw.map((c) => cardKey(c.name)))];
  const cached = await prisma.card.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(cached.map((c) => [c.key, c]));

  // Melee lists a card once per section, so the same card can appear twice
  // (maindeck + sideboard). Merge them — we don't store which board it was in.
  const merged = new Map<string, DeckCard>();
  for (const c of raw) {
    const key = cardKey(c.name);
    const hit = byKey.get(key);
    const existing = merged.get(key);
    if (existing) {
      existing.qty += c.qty;
      continue;
    }
    merged.set(key, {
      qty: c.qty,
      key,
      name: hit?.resolved ? hit.name : cleanCardName(c.name),
      typeLine: hit?.typeLine ?? null,
      manaCost: hit?.manaCost ?? null,
      imageSmall: hit?.imageSmall ?? null,
      imageNormal: hit?.imageNormal ?? null,
      scryfallUri: hit?.scryfallUri ?? null,
      resolved: Boolean(hit?.resolved),
    });
  }

  // Event date/name live on the Match rows, not the decklist.
  const m = dl.tournamentId
    ? await prisma.match.findFirst({
        where: { tournamentId: dl.tournamentId },
        select: { date: true, tournamentName: true },
      })
    : null;

  return {
    id: dl.id,
    player: dl.player,
    rawName: dl.rawName,
    archetype: dl.archetype,
    tournamentId: dl.tournamentId,
    tournamentName: m?.tournamentName ?? null,
    date: m?.date ?? null,
    cards: [...merged.values()],
  };
}

/**
 * Archetypes with a decklist, ranked by how much they're played — the metagame
 * grid's data, but keyed to a concrete list we can show.
 */
export async function listDecks(store: string): Promise<DeckListing[]> {
  const rows = await prisma.$queryRaw<
    {
      archetype: string;
      decklists: bigint;
      matches: bigint;
      wins: bigint;
      latest: string | null;
      art: string | null;
    }[]
  >`
    WITH dl AS (
      SELECT d.id, d.archetype, d."tournamentId", d."createdAt",
             row_number() OVER (PARTITION BY d.archetype ORDER BY d."createdAt" DESC) rn
        FROM "Decklist" d
       WHERE d.archetype IS NOT NULL AND d.archetype <> ''
    ),
    m AS (
      SELECT archetype, count(*)::bigint matches,
             count(*) FILTER (WHERE result = 'win')::bigint wins
        FROM "Match"
       WHERE store = ${store} AND archetype IS NOT NULL AND archetype <> ''
       GROUP BY archetype
    )
    SELECT dl.archetype,
           (SELECT count(*)::bigint FROM dl d2 WHERE d2.archetype = dl.archetype) decklists,
           COALESCE(m.matches, 0) matches,
           COALESCE(m.wins, 0) wins,
           dl.id latest,
           NULL::text art
      FROM dl LEFT JOIN m ON m.archetype = dl.archetype
     WHERE dl.rn = 1
     ORDER BY COALESCE(m.matches, 0) DESC`;

  return rows.map((r) => ({
    deck: canonicalDeck(r.archetype, r.archetype),
    decklists: Number(r.decklists),
    matches: Number(r.matches),
    wins: Number(r.wins),
    latestDecklistId: r.latest,
    artUrl: r.art,
    topCards: [],
  }));
}
