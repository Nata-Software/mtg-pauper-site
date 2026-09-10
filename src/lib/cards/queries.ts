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
import {
  canonicalDeck,
  clean,
  colorKey,
  isBare,
} from "@/lib/archetype/normalize.mjs";
import { isBasic, LAND_COLOR } from "@/lib/archetype/classify.mjs";
import MODEL from "@/lib/archetype/model.json";
import type { Card } from "@/lib/archetype";

export type DeckCard = {
  qty: number;
  name: string;
  key: string;
  typeLine: string | null;
  manaCost: string | null;
  cmc: number | null;
  imageSmall: string | null;
  imageNormal: string | null;
  scryfallUri: string | null;
  resolved: boolean;
};

export type DeckListing = {
  /** Canonical display label. */
  deck: string;
  /** Raw stored archetype, for querying. */
  archetype: string;
  decklists: number;
  matches: number;
  wins: number;
  pilots: number;
  signatureCard: string | null;
  artUrl: string | null;
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

/**
 * Decklist reading order: cheapest first, ties broken alphabetically — the
 * convention every deck site uses, because it shows the curve at a glance.
 * A card with no cached cmc sorts last rather than pretending to be free.
 */
function byManaValue(a: DeckCard, b: DeckCard): number {
  const av = a.cmc ?? Number.POSITIVE_INFINITY;
  const bv = b.cmc ?? Number.POSITIVE_INFINITY;
  return av - bv || a.name.localeCompare(b.name);
}

export function groupDeckCards(cards: DeckCard[]): [string, DeckCard[]][] {
  const by = new Map<string, DeckCard[]>();
  for (const c of cards) {
    const g = cardGroup(c.typeLine);
    if (!by.has(g)) by.set(g, []);
    by.get(g)!.push(c);
  }
  for (const list of by.values()) list.sort(byManaValue);

  return TYPE_ORDER.filter((g) => by.has(g)).map((g) => [g, by.get(g)!]);
}

/** Flat sideboard, same cheapest-first ordering as the maindeck. */
export function sortSideboard(cards: DeckCard[]): DeckCard[] {
  return [...cards].sort(byManaValue);
}

/** One decklist, joined to the card cache and split by board. */
export async function getDecklist(id: string): Promise<{
  id: string;
  player: string;
  rawName: string;
  archetype: string;
  tournamentId: string | null;
  tournamentName: string | null;
  date: Date | null;
  main: DeckCard[];
  side: DeckCard[];
} | null> {
  const dl = await prisma.decklist.findUnique({ where: { id } });
  if (!dl) return null;

  const raw = dl.cards as {
    qty: number;
    name: string;
    board?: "main" | "side";
  }[];
  const keys = [...new Set(raw.map((c) => cardKey(c.name)))];
  const cached = await prisma.card.findMany({ where: { key: { in: keys } } });
  const byKey = new Map(cached.map((c) => [c.key, c]));

  // Merge duplicates *within* a board — melee lists a card once per category,
  // so a card can legitimately appear in both maindeck and sideboard and those
  // must stay separate. Rows scraped before boards were captured have no
  // `board`; treat those as maindeck.
  const boards = { main: new Map<string, DeckCard>(), side: new Map<string, DeckCard>() };
  for (const c of raw) {
    const key = cardKey(c.name);
    const hit = byKey.get(key);
    const into = boards[c.board === "side" ? "side" : "main"];
    const existing = into.get(key);
    if (existing) {
      existing.qty += c.qty;
      continue;
    }
    into.set(key, {
      qty: c.qty,
      key,
      name: hit?.resolved ? hit.name : cleanCardName(c.name),
      typeLine: hit?.typeLine ?? null,
      manaCost: hit?.manaCost ?? null,
      cmc: hit?.cmc ?? null,
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
    main: [...boards.main.values()],
    side: sortSideboard([...boards.side.values()]),
  };
}

/**
 * Better display names for archetypes whose label is only a colour.
 *
 * Cluster labels come from the plurality name players typed, and sometimes the
 * plurality is the bare colour: "jeskai" was typed 77 times against "jeskai
 * ephemerate" 48, so a 145-match archetype ended up called just "Jeskai". The
 * clustering is right — only the name is uninformative.
 *
 * So rename it from its own members' typed names, without merging clusters:
 * take the most common NON-bare name inside that archetype, requiring it to
 *   - share the archetype's colours, which stops "naya" being renamed to
 *     "bant ephemerate" (a colour it doesn't play), and
 *   - cover at least MIN_SHARE of the archetype, so a one-off typed name can't
 *     rename a large cluster.
 */
const MIN_LABEL_SHARE = 0.25;

export async function resolveDeckLabels(
  store: string,
): Promise<Map<string, string>> {
  const rows = await prisma.match.groupBy({
    by: ["archetype", "deck"],
    where: { store, archetype: { not: null }, deck: { not: "" } },
    _count: { _all: true },
  });

  const byArchetype = new Map<string, { deck: string; n: number }[]>();
  for (const r of rows) {
    const a = r.archetype;
    if (!a) continue;
    if (!byArchetype.has(a)) byArchetype.set(a, []);
    byArchetype.get(a)!.push({ deck: r.deck, n: r._count._all });
  }

  const labels = new Map<string, string>();
  for (const [archetype, typed] of byArchetype) {
    const cleaned = clean(archetype);
    if (!isBare(cleaned)) continue;

    const total = typed.reduce((n, t) => n + t.n, 0);
    const wanted = colorKey(cleaned);

    const best = typed
      .filter((t) => {
        const c = clean(t.deck);
        return !isBare(c) && colorKey(c) === wanted;
      })
      .sort((a, b) => b.n - a.n)[0];

    if (best && best.n / total >= MIN_LABEL_SHARE)
      labels.set(archetype, canonicalDeck(null, best.deck));
  }

  return labels;
}

/** A past finish for a deck, for the "recent results" table. */
export type DeckResult = {
  decklistId: string | null;
  player: string;
  position: number | null;
  eventName: string;
  tournamentName: string | null;
  date: Date | null;
  wins: number;
  losses: number;
  draws: number;
};

/**
 * How a deck has recently finished, newest first — the equivalent of
 * MTGGoldfish's results table under a deck.
 *
 * Record comes from the Match rows (grouped per decklist), and the finishing
 * position from the Standing row for that player in that event.
 */
export async function getDeckResults(
  store: string,
  archetype: string,
  from: string,
  to: string,
  limit = 25,
): Promise<DeckResult[]> {
  const rows = await prisma.$queryRaw<
    {
      decklistId: string | null;
      player: string;
      position: number | null;
      eventName: string;
      tournamentName: string | null;
      date: Date | null;
      wins: bigint;
      losses: bigint;
      draws: bigint;
    }[]
  >`
    SELECT m."decklistId",
           m.player,
           s.position,
           m."eventName",
           m."tournamentName",
           max(m.date) date,
           count(*) FILTER (WHERE m.result = 'win')::bigint  wins,
           count(*) FILTER (WHERE m.result = 'loss')::bigint losses,
           count(*) FILTER (WHERE m.result = 'draw')::bigint draws
      FROM "Match" m
      LEFT JOIN "Standing" s
             ON s.store = m.store
            AND s."tournamentId" = m."tournamentId"
            AND lower(s.nickname) = lower(m.player)
     WHERE m.store = ${store}
       AND m.archetype = ${archetype}
       AND m.date BETWEEN ${new Date(from)} AND ${new Date(to)}
     GROUP BY m."decklistId", m.player, s.position, m."eventName", m."tournamentName"
     ORDER BY max(m.date) DESC, wins DESC
     LIMIT ${limit}`;

  return rows.map((r) => ({
    ...r,
    wins: Number(r.wins),
    losses: Number(r.losses),
    draws: Number(r.draws),
  }));
}

/**
 * Which decklist to feature for an archetype.
 *
 * Prefer a recent list that actually performed — at least `minWins` match wins
 * in its event — because a list that went 0-4 is not what someone wants to
 * copy. Falls back to the most recent list when nothing clears the bar, so a
 * new or niche deck still shows something.
 */
export async function getFeaturedDecklistId(
  store: string,
  archetype: string,
  from: string,
  to: string,
  minWins = 3,
): Promise<{ id: string; wins: number; featured: boolean } | null> {
  const rows = await prisma.$queryRaw<
    { decklistId: string; wins: bigint; date: Date | null }[]
  >`
    SELECT m."decklistId", max(m.date) date,
           count(*) FILTER (WHERE m.result = 'win')::bigint wins
      FROM "Match" m
     WHERE m.store = ${store}
       AND m.archetype = ${archetype}
       AND m."decklistId" IS NOT NULL
       AND m.date BETWEEN ${new Date(from)} AND ${new Date(to)}
     GROUP BY m."decklistId"
     ORDER BY max(m.date) DESC`;

  if (rows.length === 0) return null;

  const good = rows.find((r) => Number(r.wins) >= minWins);
  const chosen = good ?? rows[0];

  return {
    id: chosen.decklistId,
    wins: Number(chosen.wins),
    featured: Boolean(good),
  };
}

/**
 * Archetypes with a decklist, ranked by how much they're played — the metagame
 * grid's data, but keyed to a concrete list we can show.
 */
export async function listDecks(
  store: string,
  from: string,
  to: string,
): Promise<DeckListing[]> {
  const [tally, lists, labels] = await Promise.all([
    prisma.$queryRaw<
      {
        archetype: string;
        matches: bigint;
        wins: bigint;
        pilots: bigint;
        lists: bigint;
      }[]
    >`
      SELECT archetype,
             count(*)::bigint matches,
             count(*) FILTER (WHERE result = 'win')::bigint wins,
             count(DISTINCT player)::bigint pilots,
             count(DISTINCT "decklistId")::bigint lists
        FROM "Match"
       WHERE store = ${store}
         AND archetype IS NOT NULL AND archetype <> ''
         AND date BETWEEN ${new Date(from)} AND ${new Date(to)}
       GROUP BY archetype
       ORDER BY matches DESC`,
    prisma.decklist.findMany({
      where: { archetype: { not: "" } },
      select: { id: true, archetype: true, cards: true },
    }),
    resolveDeckLabels(store),
  ]);

  // Group decklists by archetype so a signature card can be chosen.
  const byArchetype = new Map<string, { slug: string; name: string }[][]>();
  for (const l of lists) {
    // Maindeck spells only. Lands are excluded even when distinctive — a deck
    // is recognised by its threats, and land art makes a dull tile.
    const cards = (l.cards as Card[])
      .filter(
        (c) =>
          c.board !== "side" && !isBasic(c.slug) && !(c.slug in LAND_COLOR),
      )
      .map((c) => ({ slug: c.slug, name: c.name }));
    if (!byArchetype.has(l.archetype)) byArchetype.set(l.archetype, []);
    byArchetype.get(l.archetype)!.push(cards);
  }

  const signatures = new Map<string, string>();
  for (const [archetype, decks] of byArchetype) {
    const name = signatureCard(decks);
    if (name) signatures.set(archetype, name);
  }

  // Art comes from the local card cache — no Scryfall round-trip per tile.
  const keys = [...new Set([...signatures.values()].map(cardKey))];
  const cached = keys.length
    ? await prisma.card.findMany({
        where: { key: { in: keys } },
        select: { key: true, imageArtCrop: true },
      })
    : [];
  const artByKey = new Map(cached.map((c) => [c.key, c.imageArtCrop]));

  return tally.map((r) => {
    const sig = signatures.get(r.archetype) ?? null;
    return {
      deck: labels.get(r.archetype) ?? canonicalDeck(r.archetype, r.archetype),
      archetype: r.archetype,
      // Distinct lists *within the range*, so it reads consistently with the
      // match count beside it.
      decklists: Number(r.lists),
      matches: Number(r.matches),
      wins: Number(r.wins),
      pilots: Number(r.pilots),
      signatureCard: sig,
      artUrl: (sig && artByKey.get(cardKey(sig))) || null,
    };
  });
}

/**
 * The card that best identifies an archetype, for the tile art.
 *
 * Pure frequency picks whatever staple the deck happens to share with the rest
 * of the format — it chose "Cryptic Serpent" for Mono-Blue Delver. Weighting by
 * IDF (how rare the card is across the whole corpus) picks the card that makes
 * the deck *that deck* — Delver of Secrets. The presence floor keeps it honest:
 * a distinctive card in one of forty lists doesn't represent the archetype.
 */
function signatureCard(decks: { slug: string; name: string }[][]): string | null {
  const present = new Map<string, number>();
  const nameOf = new Map<string, string>();

  for (const cards of decks) {
    const seen = new Set<string>();
    for (const c of cards) {
      if (seen.has(c.slug)) continue;
      seen.add(c.slug);
      present.set(c.slug, (present.get(c.slug) ?? 0) + 1);
      nameOf.set(c.slug, c.name);
    }
  }
  if (present.size === 0) return null;

  // Unknown cards fall back to the max plausible IDF (a card seen in no training
  // deck is maximally distinctive), but the presence floor above still applies.
  const idfTable = MODEL.idf as Record<string, number>;
  const idf = (s: string) =>
    s in idfTable ? idfTable[s] : Math.log(MODEL.trainedDecks || 1);

  const floor = decks.length * 0.5;
  let best: string | null = null;
  let bestScore = -1;
  let fallback: string | null = null;
  let fallbackCount = -1;

  for (const [slug, count] of present) {
    if (count > fallbackCount) {
      fallbackCount = count;
      fallback = slug;
    }
    if (count < floor) continue;
    const score = (count / decks.length) * idf(slug);
    if (score > bestScore) {
      bestScore = score;
      best = slug;
    }
  }

  const chosen = best ?? fallback;
  return chosen ? (nameOf.get(chosen) ?? null) : null;
}
