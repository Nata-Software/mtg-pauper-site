/**
 * Refresh the MPL Opens snapshot from melee (standings only — no matches or
 * decklists, so the yearly league never touches the weekly matchup data).
 *
 *   node scripts/mpl-scrape.mjs
 *
 * Writes scripts/mpl-data/opens.json, which scripts/seed-mpl.mjs loads into the
 * MplStage/MplResult tables. Tournament ids were found via Mont's melee org
 * (2833, Hub/SearchOrganizationTournaments). Aggregation key is the account
 * `username` (melee's per-registration `ID` is not stable).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "mpl-data", "opens.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const JSON_HEADERS = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  origin: "https://melee.gg",
  "user-agent": UA,
  "x-requested-with": "XMLHttpRequest",
};

// 2026 MPL Opens. `date` is the stage date; ordinal 3 (Trios) is a team event,
// so it is shown but excluded from the individual points ranking.
const OPENS = [
  { ordinal: 1, id: "404527", date: "2026-02-28", format: "individual" },
  { ordinal: 2, id: "417357", date: "2026-03-28", format: "individual" },
  { ordinal: 3, id: "420201", date: "2026-04-25", format: "trios" },
  { ordinal: 4, id: "428773", date: "2026-05-23", format: "individual" },
  { ordinal: 5, id: "432277", date: "2026-06-20", format: "individual" },
  { ordinal: 6, id: "441343", date: "2026-07-25", format: "individual" },
];

function dataTablesColumns(names) {
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

async function fetchPage(id) {
  const res = await fetch(`https://melee.gg/Tournament/View/${id}`, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
  });
  if (res.status !== 200) throw new Error(`View ${id} HTTP ${res.status}`);
  const html = await res.text();
  if (/just a moment|cf-browser-verification|challenge-platform/i.test(html))
    throw new Error("melee served an anti-bot challenge");
  return html;
}
function roundIdsFromPage(html) {
  const i = html.indexOf("pairings-round-selector-container");
  if (i < 0) return [];
  return [...html.slice(i, i + 8000).matchAll(/data-id="([^"]+)"/g)].map(
    (m) => m[1],
  );
}
function nameFromPage(html) {
  const t = html.match(/<title>([^<]+)<\/title>/);
  return (t?.[1] ?? "").replace(/\s*\|\s*Melee\s*$/i, "").trim();
}

async function fetchStandings(roundId) {
  const body = dataTablesColumns([
    "Rank", "Player", "Decklists", "MatchRecord", "GameRecord", "Points",
    "OpponentMatchWinPercentage", "TeamGameWinPercentage",
    "OpponentGameWinPercentage", "FinalTiebreaker", "OpponentCount",
  ]);
  body.set("start", "0");
  body.set("length", "1000");
  body.set("roundId", roundId);
  const res = await fetch("https://melee.gg/Standing/GetRoundStandings", {
    method: "POST",
    headers: JSON_HEADERS,
    body,
  });
  if (res.status !== 200) throw new Error(`Standings HTTP ${res.status}`);
  const json = await res.json();
  return (json.data ?? [])
    .map((rec) => {
      const p = rec.Team?.Players?.[0] ?? {};
      return {
        rank: Number(rec.Rank) || 0,
        username: p.Username ?? "",
        display: p.DisplayName ?? "",
        lastFirst: p.DisplayNameLastFirst ?? "",
        teamSize: (rec.Team?.Players ?? []).length,
        record: rec.MatchRecord ?? "",
        points: Number(rec.Points) || 0,
        omw: rec.OpponentMatchWinPercentage ?? null,
        tgw: rec.TeamGameWinPercentage ?? null,
        ogw: rec.OpponentGameWinPercentage ?? null,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

const out = [];
for (const o of OPENS) {
  const html = await fetchPage(o.id);
  const rounds = roundIdsFromPage(html);
  const name = nameFromPage(html);
  const standings = rounds.length
    ? await fetchStandings(rounds[rounds.length - 1])
    : [];
  out.push({
    ordinal: o.ordinal,
    id: o.id,
    date: o.date,
    format: o.format,
    name,
    rounds: rounds.length,
    count: standings.length,
    standings,
  });
  console.error(
    `Open ${o.ordinal} (${o.id}): "${name}" — ${rounds.length} rounds, ${standings.length} players`,
  );
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.error(`wrote ${path.relative(path.join(DIR, ".."), OUT)}`);
