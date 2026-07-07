/**
 * Scrapes a single melee.gg tournament into match + standing rows.
 *
 * Ports the old Google Apps Script (code.gs / Dowloader.gs), but uses the
 * decklist names embedded in the match/standings responses, so no per-player
 * GetPlayerDetails calls are needed.
 */

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
  playerScore: number;
  result: "win" | "loss" | "draw";
  opponent: string;
  opponentDeck: string;
  opponentScore: number;
};

export type ScrapedStanding = {
  nickname: string;
  fullName: string;
  points: number;
  position: number;
  deck: string;
};

export type ScrapeResult = {
  tournamentId: string;
  tournamentName: string;
  date: Date | null;
  matches: ScrapedMatch[];
  standings: ScrapedStanding[];
};

const BYE_DECK = "no deck (bye)";

function lc(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
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
        playerScore: 2,
        result: "win",
        opponent: "bye",
        opponentDeck: BYE_DECK,
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
      playerScore: s1,
      result: r1,
      opponent: p2,
      opponentDeck: d2,
      opponentScore: s2,
    });
    matches.push({
      round,
      player: p2,
      deck: d2,
      playerScore: s2,
      result: r2,
      opponent: p1,
      opponentDeck: d1,
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

  return { tournamentId, tournamentName, date, matches, standings };
}

// --- Minimal shapes of the melee JSON we read ---

type MeleePlayer = {
  DisplayName?: string;
  DisplayNameLastFirst?: string;
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
};
