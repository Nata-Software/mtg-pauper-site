/**
 * Scrapes a single melee.gg tournament into match + standing rows.
 *
 * Ports the old Google Apps Script (code.gs / Dowloader.gs), but uses the
 * decklist names embedded in the match/standings responses, so no per-player
 * GetPlayerDetails calls are needed. Also fetches each decklist's cards and
 * classifies it into an archetype.
 */
import { classifyDeck, type Card } from "./archetype";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const JSON_HEADERS = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  origin: "https://melee.gg",
  "user-agent": UA,
  "x-requested-with": "XMLHttpRequest",
};

export type ScrapedMatch = {
  round: number;
  player: string;
  deck: string;
  decklistId: string | null;
  archetype: string | null;
  playerScore: number;
  result: "win" | "loss" | "draw";
  opponent: string;
  opponentDeck: string;
  opponentDecklistId: string | null;
  opponentArchetype: string | null;
  opponentScore: number;
};

export type ScrapedStanding = {
  nickname: string;
  fullName: string;
  points: number;
  position: number;
  deck: string;
  decklistId: string | null;
  archetype: string | null;
  /** W+L+D from melee's MatchRecord — how many matches this player actually
   * played, used to detect an incomplete match scrape (see scrapeTournament). */
  matchesExpected: number;
};

export type ScrapedDecklist = {
  id: string;
  player: string;
  rawName: string;
  archetype: string;
  cards: Card[];
};

export type ScrapeResult = {
  tournamentId: string;
  tournamentName: string;
  date: Date | null;
  matches: ScrapedMatch[];
  standings: ScrapedStanding[];
  decklists: ScrapedDecklist[];
  /** Non-fatal integrity warnings (e.g. fewer matches scraped than the
   * standings say a player played — usually a not-yet-finalized round). */
  warnings: string[];
};

/** Sum a melee "W-L-D" MatchRecord string into a total match count. */
function matchRecordTotal(record: unknown): number {
  return String(record ?? "")
    .split("-")
    .reduce((sum, part) => sum + (Number(part) || 0), 0);
}

const BYE_DECK = "no deck (bye)";

function lc(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/** Pull the numeric tournament id out of a melee URL or a bare id. */
export function parseTournamentId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/melee\.gg\/Tournament\/View\/(\d+)/i);
  if (m) return m[1];
  if (/^\d+$/.test(s)) return s;
  return null;
}

function deckName(decklists: unknown): string {
  const arr = decklists as { DecklistName?: string }[] | undefined;
  return lc(arr?.[0]?.DecklistName ?? "");
}

function deckId(decklists: unknown): string | null {
  const arr = decklists as { DecklistId?: string }[] | undefined;
  return arr?.[0]?.DecklistId ?? null;
}

/**
 * Decode the HTML entities in text scraped out of melee's markup. Card names
 * are read straight from the page, so without this they are stored escaped
 * ("Pirate&#39;s Pillage", "L&#243;rien Revealed") — which breaks Scryfall art
 * lookups (they need the exact name) and any classifier rule matching a name
 * containing an apostrophe.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // last, so "&amp;#39;" doesn't double-decode
}

const DECKLIST_CARD_RE =
  /<span class="decklist-record-quantity">(\d+)<\/span>\s*<a class="decklist-record-name" href="\/Card\/View\/([^?"]+)[^"]*">([^<]+)<\/a>/g;
const DECKLIST_CATEGORY_RE =
  /<div class="decklist-category-title"[^>]*>([\s\S]*?)<\/div>/g;

/**
 * Parse a decklist page into cards tagged with the board they were registered
 * in.
 *
 * melee groups the list under category headings — "Creature (11)", "Land (19)",
 * "Sideboard (15)" — so the board is recovered by finding which heading each
 * card falls under, by document position. "Sideboard" is the only heading that
 * means sideboard; everything else (including an occasional generic "Deck") is
 * maindeck. A list with no Sideboard heading is simply all maindeck.
 *
 * Exported for the backfill in scripts/backfill-decklist-boards.mjs.
 */
export function parseDecklistHtml(html: string): Card[] {
  const marks = [...html.matchAll(DECKLIST_CATEGORY_RE)].map((m) => ({
    title: m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s*\(\d+\)\s*$/, "") // drop the trailing count
      .replace(/\s+/g, " ")
      .trim(),
    idx: m.index ?? 0,
  }));

  return [...html.matchAll(DECKLIST_CARD_RE)].map((m) => {
    const at = m.index ?? 0;
    let category = "";
    for (const mk of marks) {
      if (mk.idx < at) category = mk.title;
      else break;
    }
    return {
      qty: Number(m[1]),
      slug: m[2],
      name: decodeEntities(m[3]),
      board: /sideboard/i.test(category) ? ("side" as const) : ("main" as const),
      category,
    };
  });
}

/** Fetch and parse a decklist's cards from its melee page (no auth). */
async function fetchDecklistCards(guid: string): Promise<Card[]> {
  const res = await fetch(`https://melee.gg/Decklist/View/${guid}`, {
    headers: { "user-agent": UA },
  });
  if (res.status !== 200) return [];

  return parseDecklistHtml(await res.text());
}

function dataTablesColumns(names: string[]): URLSearchParams {
  const p = new URLSearchParams();
  names.forEach((d, i) => {
    p.set(`columns[${i}][data]`, d);
    p.set(`columns[${i}][name]`, d);
    p.set(`columns[${i}][searchable]`, "true");
    p.set(`columns[${i}][orderable]`, "true");
    p.set(`columns[${i}][search][value]`, "");
    p.set(`columns[${i}][search][regex]`, "false");
  });
  p.set("order[0][column]", "0");
  p.set("order[0][dir]", "asc");
  p.set("search[value]", "");
  p.set("search[regex]", "false");
  p.set("draw", "1");
  return p;
}

async function fetchPage(tournamentId: string): Promise<string> {
  const res = await fetch(`https://melee.gg/Tournament/View/${tournamentId}`, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
  });
  if (res.status !== 200) {
    throw new Error(`Tournament page returned HTTP ${res.status}`);
  }
  const html = await res.text();
  if (/just a moment|cf-browser-verification|challenge-platform/i.test(html)) {
    throw new Error("melee.gg served an anti-bot challenge (blocked).");
  }
  return html;
}

function roundIdsFromPage(html: string): string[] {
  const i = html.indexOf("pairings-round-selector-container");
  if (i < 0) return [];
  const region = html.slice(i, i + 8000);
  return [...region.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]);
}

function tournamentNameFromPage(html: string): string {
  const t = html.match(/<title>([^<]+)<\/title>/);
  return (t?.[1] ?? "").replace(/\s*\|\s*Melee\s*$/i, "").trim();
}

async function fetchRoundMatches(roundId: string): Promise<{
  matches: ScrapedMatch[];
  dates: number[];
}> {
  const body = dataTablesColumns([
    "TableNumber",
    "PodNumber",
    "Teams",
    "Decklists",
    "ResultString",
  ]);
  body.set("start", "0");
  body.set("length", "1000");

  const res = await fetch(`https://melee.gg/Match/GetRoundMatches/${roundId}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body,
  });
  if (res.status !== 200) {
    throw new Error(`GetRoundMatches ${roundId} returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: MeleeMatch[] };
  const matches: ScrapedMatch[] = [];
  const dates: number[] = [];

  for (const rec of json.data ?? []) {
    const round = Number(rec.RoundNumber) || 0;
    const created = rec.DateCreated ? Date.parse(rec.DateCreated) : NaN;
    if (!Number.isNaN(created)) dates.push(created);

    const comps = rec.Competitors ?? [];

    // Bye — a single competitor (counts as a win for them).
    if (comps.length < 2) {
      const c = comps[0];
      const player = lc(c?.Team?.Players?.[0]?.DisplayName);
      if (!player) continue;
      matches.push({
        round,
        player,
        deck: deckName(c?.Decklists),
        decklistId: deckId(c?.Decklists),
        archetype: null,
        playerScore: 2,
        result: "win",
        opponent: "bye",
        opponentDeck: BYE_DECK,
        opponentDecklistId: null,
        opponentArchetype: null,
        opponentScore: 0,
      });
      continue;
    }

    if (!rec.HasResult) continue; // unplayed match

    const c1 = comps[0];
    const c2 = comps[1];
    const p1 = lc(c1.Team?.Players?.[0]?.DisplayName);
    const p2 = lc(c2.Team?.Players?.[0]?.DisplayName);
    if (!p1 || !p2) continue;
    const d1 = deckName(c1.Decklists);
    const d2 = deckName(c2.Decklists);
    const d1Id = deckId(c1.Decklists);
    const d2Id = deckId(c2.Decklists);
    const s1 = Number(c1.GameWins) || 0;
    const s2 = Number(c2.GameWins) || 0;

    let r1: ScrapedMatch["result"];
    let r2: ScrapedMatch["result"];
    if (s1 > s2) [r1, r2] = ["win", "loss"];
    else if (s2 > s1) [r1, r2] = ["loss", "win"];
    else [r1, r2] = ["draw", "draw"];

    // Two mirrored rows, one per player's perspective.
    matches.push({
      round,
      player: p1,
      deck: d1,
      decklistId: d1Id,
      archetype: null,
      playerScore: s1,
      result: r1,
      opponent: p2,
      opponentDeck: d2,
      opponentDecklistId: d2Id,
      opponentArchetype: null,
      opponentScore: s2,
    });
    matches.push({
      round,
      player: p2,
      deck: d2,
      decklistId: d2Id,
      archetype: null,
      playerScore: s2,
      result: r2,
      opponent: p1,
      opponentDeck: d1,
      opponentDecklistId: d1Id,
      opponentArchetype: null,
      opponentScore: s1,
    });
  }
  return { matches, dates };
}

async function fetchStandings(lastRoundId: string): Promise<ScrapedStanding[]> {
  const body = dataTablesColumns([
    "Rank",
    "Player",
    "Decklists",
    "MatchRecord",
    "GameRecord",
    "Points",
    "OpponentMatchWinPercentage",
    "TeamGameWinPercentage",
    "OpponentGameWinPercentage",
    "FinalTiebreaker",
    "OpponentCount",
  ]);
  body.set("start", "0");
  body.set("length", "500");
  body.set("roundId", lastRoundId);

  const res = await fetch("https://melee.gg/Standing/GetRoundStandings", {
    method: "POST",
    headers: JSON_HEADERS,
    body,
  });
  if (res.status !== 200) {
    throw new Error(`GetRoundStandings returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: MeleeStanding[] };

  const standings: ScrapedStanding[] = [];
  for (const rec of json.data ?? []) {
    const nickname = lc(rec.Team?.Players?.[0]?.DisplayName);
    if (!nickname) continue;
    standings.push({
      nickname,
      fullName: lc(rec.Team?.Players?.[0]?.DisplayNameLastFirst) || nickname,
      points: Number(rec.Points) || 0,
      position: Number(rec.Rank) || 0,
      deck: deckName(rec.Decklists),
      decklistId: deckId(rec.Decklists),
      archetype: null,
      matchesExpected: matchRecordTotal(rec.MatchRecord),
    });
  }
  return standings;
}

export async function scrapeTournament(input: string): Promise<ScrapeResult> {
  const tournamentId = parseTournamentId(input);
  if (!tournamentId) {
    throw new Error(
      "Could not read a tournament id. Paste a melee.gg/Tournament/View/<id> URL.",
    );
  }

  const html = await fetchPage(tournamentId);
  const roundIds = roundIdsFromPage(html);
  if (roundIds.length === 0) {
    throw new Error("No rounds found on the tournament page.");
  }
  const tournamentName = tournamentNameFromPage(html);

  // Matches from every round (in parallel).
  const perRound = await Promise.all(roundIds.map(fetchRoundMatches));
  const matches = perRound.flatMap((r) => r.matches);
  const allDates = perRound.flatMap((r) => r.dates);
  const date = allDates.length ? new Date(Math.min(...allDates)) : null;

  // Standings from the last round.
  const standings = await fetchStandings(roundIds[roundIds.length - 1]);

  // A player plays one deck per tournament, but melee doesn't always attach it
  // to every match record — for one event it carried a decklist on 107 of 123
  // competitor entries. Left alone, the same player shows their deck in some
  // rounds and "Unknown Deck" in others, and any per-tournament view can pick
  // the empty one. Standings often carry a decklist the match rows lack, so
  // both sources feed the lookup.
  const deckByPlayer = new Map<string, { deck: string; decklistId: string }>();

  const remember = (player: string, deck: string, decklistId: string | null) => {
    if (!player || !decklistId || deckByPlayer.has(player)) return;
    deckByPlayer.set(player, { deck, decklistId });
  };

  for (const m of matches) remember(m.player, m.deck, m.decklistId);
  for (const s of standings) remember(s.nickname, s.deck, s.decklistId);

  for (const m of matches) {
    if (!m.decklistId) {
      const known = deckByPlayer.get(m.player);
      if (known) {
        m.deck = known.deck;
        m.decklistId = known.decklistId;
      }
    }
    if (!m.opponentDecklistId) {
      const known = deckByPlayer.get(m.opponent);
      if (known) {
        m.opponentDeck = known.deck;
        m.opponentDecklistId = known.decklistId;
      }
    }
  }
  for (const s of standings) {
    if (s.decklistId) continue;
    const known = deckByPlayer.get(s.nickname);
    if (known) {
      s.deck = known.deck;
      s.decklistId = known.decklistId;
    }
  }

  // Fetch + classify every unique decklist referenced by the matches or the
  // standings — a decklist can appear in one and not the other.
  const idToPlayer = new Map<string, { player: string; rawName: string }>();
  for (const m of matches) {
    if (m.decklistId && !idToPlayer.has(m.decklistId))
      idToPlayer.set(m.decklistId, { player: m.player, rawName: m.deck });
  }
  for (const s of standings) {
    if (s.decklistId && !idToPlayer.has(s.decklistId))
      idToPlayer.set(s.decklistId, { player: s.nickname, rawName: s.deck });
  }
  const ids = [...idToPlayer.keys()];

  const decklists: ScrapedDecklist[] = [];
  const archetypeOf = new Map<string, string>();
  const POOL = 6;
  for (let i = 0; i < ids.length; i += POOL) {
    const batch = ids.slice(i, i + POOL);
    const cardsList = await Promise.all(batch.map(fetchDecklistCards));
    batch.forEach((id, j) => {
      const cards = cardsList[j];
      const info = idToPlayer.get(id)!;
      const archetype = cards.length
        ? classifyDeck(cards, info.rawName)
        : `rogue: ${info.rawName || "unknown"}`;
      archetypeOf.set(id, archetype);
      decklists.push({
        id,
        player: info.player,
        rawName: info.rawName,
        archetype,
        cards,
      });
    });
  }

  // Stamp the archetype onto matches (both sides) and standings.
  for (const m of matches) {
    if (m.decklistId) m.archetype = archetypeOf.get(m.decklistId) ?? null;
    if (m.opponentDecklistId)
      m.opponentArchetype = archetypeOf.get(m.opponentDecklistId) ?? null;
  }
  for (const s of standings) {
    if (s.decklistId) s.archetype = archetypeOf.get(s.decklistId) ?? null;
  }

  // Integrity check: the match scrape and the standings scrape come from
  // different melee endpoints, so a not-yet-finalized round (e.g. a match held
  // up because a player never registered a decklist) can leave the standings
  // complete while the Match rows are short — a SILENT partial import. Compare
  // each player's scraped match count to their standings MatchRecord (W+L+D)
  // and warn loudly so the import isn't trusted as complete.
  const scrapedPerPlayer = new Map<string, number>();
  for (const m of matches) {
    scrapedPerPlayer.set(m.player, (scrapedPerPlayer.get(m.player) ?? 0) + 1);
  }
  const warnings: string[] = [];
  let missingTotal = 0;
  for (const s of standings) {
    const got = scrapedPerPlayer.get(s.nickname) ?? 0;
    if (s.matchesExpected > got) {
      missingTotal += s.matchesExpected - got;
      warnings.push(
        `${s.nickname}: standings show ${s.matchesExpected} matches but only ${got} were scraped`,
      );
    }
  }
  if (warnings.length) {
    warnings.unshift(
      `Incomplete import: ${missingTotal} match row(s) missing across ${warnings.length} player(s). ` +
        `A round may not be finalized on melee yet (often caused by a missing decklist). Re-import once it's resolved.`,
    );
  }

  return {
    tournamentId,
    tournamentName,
    date,
    matches,
    standings,
    decklists,
    warnings,
  };
}

// --- MPL (yearly league) ---------------------------------------------------
//
// The MPL Opens are scraped STANDINGS-ONLY, on purpose. The yearly league is a
// points race, so it needs finishes and nothing else — and pulling matches or
// decklists would put Opens games into the weekly matchup tables, which must
// never happen (see scripts/split-mpl-events.mjs for the cleanup after the CSV
// import did exactly that). Keeping this a separate function from
// scrapeTournament is what makes that guarantee structural rather than a
// convention someone has to remember.

export type ScrapedMplResult = {
  /** Stable melee account handle, lowercased — the cross-Open aggregation key. */
  username: string;
  /** Display name at scrape time (melee exposes no real name). */
  player: string;
  rank: number;
  record: string | null;
  points: number;
  omw: number | null;
  tgw: number | null;
  ogw: number | null;
};

export type MplScrapeResult = {
  tournamentId: string;
  tournamentName: string;
  date: Date | null;
  /** Stage number parsed from the name ("7º Open MPL" -> 7), else null. */
  ordinal: number | null;
  /** Team event guessed from the name — see looksLikeTeamEvent. */
  isTeamEvent: boolean;
  results: ScrapedMplResult[];
};

/**
 * Whether a tournament looks like a team event (Trios), which is recorded as a
 * stage but excluded from the individual points ranking.
 *
 * This has to go by name: melee's GetRoundStandings returns one representative
 * per team (`Team.Players` is length 1 and `Team.Name` is null even for the
 * Trios Open), so the payload carries no usable team size. The caller can force
 * it on for a team event whose name doesn't say so.
 */
export function looksLikeTeamEvent(name: string): boolean {
  return /\b(trios?|duplas?|equipes?|teams?)\b/i.test(String(name ?? ""));
}

/**
 * Stage number from a melee tournament name: "7º Open MPL - Mont" -> 7.
 * Accepts "7º", "7o", "7ª" or a bare leading "7". Returns null when the name
 * carries no number (e.g. "Super Pauper 30K"), so the caller can ask.
 */
export function parseStageOrdinal(name: string): number | null {
  const m = String(name ?? "")
    .trim()
    .match(/^(\d{1,2})\s*[ºoª°]?\s/);
  const n = m ? Number(m[1]) : NaN;

  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The tournament's scheduled start, from the ISO timestamp on its page. */
function tournamentDateFromPage(html: string): Date | null {
  const m = html.match(/\d{4}-\d{2}-\d{2}T[\d:.]+/);
  if (!m) return null;
  const d = new Date(m[0].slice(0, 19) + "Z");

  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Scrape one MPL Open's final standings. Never returns matches or decklists —
 * see the note above.
 */
export async function scrapeMplStandings(
  input: string,
): Promise<MplScrapeResult> {
  const tournamentId = parseTournamentId(input);
  if (!tournamentId) {
    throw new Error(
      "Could not read a tournament id. Paste a melee.gg/Tournament/View/<id> URL.",
    );
  }

  const html = await fetchPage(tournamentId);
  const roundIds = roundIdsFromPage(html);
  if (roundIds.length === 0) {
    throw new Error("No rounds found on the tournament page.");
  }
  const tournamentName = tournamentNameFromPage(html);

  const body = dataTablesColumns([
    "Rank",
    "Player",
    "Decklists",
    "MatchRecord",
    "GameRecord",
    "Points",
    "OpponentMatchWinPercentage",
    "TeamGameWinPercentage",
    "OpponentGameWinPercentage",
    "FinalTiebreaker",
    "OpponentCount",
  ]);
  body.set("start", "0");
  body.set("length", "1000");
  body.set("roundId", roundIds[roundIds.length - 1]);

  const res = await fetch("https://melee.gg/Standing/GetRoundStandings", {
    method: "POST",
    headers: JSON_HEADERS,
    body,
  });
  if (res.status !== 200) {
    throw new Error(`GetRoundStandings returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: MeleeMplStanding[] };

  const results: ScrapedMplResult[] = [];
  for (const rec of json.data ?? []) {
    const p = rec.Team?.Players?.[0];
    // Username is the stable identity; DisplayName is mutable and only shown.
    const username = lc(p?.Username) || lc(p?.DisplayName);
    if (!username) continue;
    results.push({
      username,
      player: p?.DisplayName || p?.Username || "",
      rank: Number(rec.Rank) || 0,
      record: rec.MatchRecord ?? null,
      points: Number(rec.Points) || 0,
      omw: rec.OpponentMatchWinPercentage ?? null,
      tgw: rec.TeamGameWinPercentage ?? null,
      ogw: rec.OpponentGameWinPercentage ?? null,
    });
  }
  results.sort((a, b) => a.rank - b.rank);

  if (results.length === 0) {
    throw new Error("No standings found for that tournament.");
  }

  return {
    tournamentId,
    tournamentName,
    date: tournamentDateFromPage(html),
    ordinal: parseStageOrdinal(tournamentName),
    isTeamEvent: looksLikeTeamEvent(tournamentName),
    results,
  };
}

// --- Minimal shapes of the melee JSON we read ---

type MeleePlayer = {
  DisplayName?: string;
  DisplayNameLastFirst?: string;
  /** Stable account handle. The sibling `ID` is per-registration, not per-person. */
  Username?: string;
};
type MeleeCompetitor = {
  Team?: { Players?: MeleePlayer[] };
  Decklists?: { DecklistName?: string }[];
  GameWins?: number;
};
type MeleeMatch = {
  RoundNumber?: number;
  DateCreated?: string;
  HasResult?: boolean;
  Competitors?: MeleeCompetitor[];
};
type MeleeStanding = {
  Team?: { Players?: MeleePlayer[] };
  Decklists?: { DecklistName?: string }[];
  Points?: number;
  Rank?: number;
  MatchRecord?: string;
};
type MeleeMplStanding = MeleeStanding & {
  OpponentMatchWinPercentage?: number | null;
  TeamGameWinPercentage?: number | null;
  OpponentGameWinPercentage?: number | null;
};
