import fs from "fs";
const OUT = process.argv[2];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/123.0.0.0 Safari/537.36";
const H = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  origin: "https://melee.gg",
  "user-agent": UA,
  "x-requested-with": "XMLHttpRequest",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const wd = (d) =>
  new Date(d).toLocaleDateString("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  });

// 1) enumerate league tournaments
function orgBody(start) {
  const p = new URLSearchParams();
  p.set("draw", "1");
  p.set("start", String(start));
  p.set("length", "500");
  p.set("search[value]", "");
  p.set("search[regex]", "false");
  ["0", "1"].forEach((i) => {
    p.set(`columns[${i}][data]`, "");
    p.set(`columns[${i}][search][value]`, "");
    p.set(`columns[${i}][search][regex]`, "false");
  });
  p.set("order[0][column]", "0");
  p.set("order[0][dir]", "desc");
  p.set("id", "2833");
  return p;
}
let all = [];
for (const s of [0, 500]) {
  const j = await (
    await fetch("https://melee.gg/Hub/SearchOrganizationTournaments", {
      method: "POST",
      headers: H,
      body: orgBody(s),
    })
  ).json();
  all = all.concat(j.data || []);
}
const league = all.filter(
  (t) =>
    /pauper/i.test(t.Name || "") &&
    ymd(t.StartDate).startsWith("2026") &&
    ["Tuesday", "Friday"].includes(wd(t.StartDate)) &&
    (t.ParticipatingCount || 0) >= 2,
);
console.log("league tournaments to scrape:", league.length);

function mBody() {
  const p = new URLSearchParams();
  ["TableNumber", "PodNumber", "Teams", "Decklists", "ResultString"].forEach(
    (d, i) => {
      p.set(`columns[${i}][data]`, d);
      p.set(`columns[${i}][search][value]`, "");
      p.set(`columns[${i}][search][regex]`, "false");
    },
  );
  p.set("order[0][column]", "0");
  p.set("order[0][dir]", "asc");
  p.set("start", "0");
  p.set("length", "1000");
  p.set("draw", "1");
  p.set("search[value]", "");
  p.set("search[regex]", "false");
  return p;
}

const matches = [];
const deckIds = new Set();
const deckName = {};
for (const t of league) {
  const html = await (
    await fetch(`https://melee.gg/Tournament/View/${t.ID}`, {
      headers: { "user-agent": UA },
    })
  ).text();
  const i = html.indexOf("pairings-round-selector-container");
  const rids =
    i < 0
      ? []
      : [...html.slice(i, i + 8000).matchAll(/data-id="([^"]+)"/g)].map(
          (m) => m[1],
        );
  const league_day = wd(t.StartDate);
  const date = ymd(t.StartDate);
  for (const rid of rids) {
    const j = await (
      await fetch(`https://melee.gg/Match/GetRoundMatches/${rid}`, {
        method: "POST",
        headers: H,
        body: mBody(),
      })
    ).json();
    for (const rec of j.data || []) {
      const comps = rec.Competitors || [];
      const pick = (c) => ({
        name: (c?.Team?.Players?.[0]?.DisplayName || "").toLowerCase().trim(),
        deckId: c?.Decklists?.[0]?.DecklistId || null,
        deckName: (c?.Decklists?.[0]?.DecklistName || "").toLowerCase().trim(),
        gw: c?.GameWins ?? 0,
      });
      if (comps.length >= 2) {
        const a = pick(comps[0]),
          b = pick(comps[1]);
        if (rec.HasResult) {
          [a, b].forEach((x) => {
            if (x.deckId) {
              deckIds.add(x.deckId);
              deckName[x.deckId] = x.deckName;
            }
          });
          const res = (x, y) =>
            x.gw > y.gw ? "win" : x.gw < y.gw ? "loss" : "draw";
          matches.push({
            t: t.ID,
            day: league_day,
            date,
            round: rec.RoundNumber,
            player: a.name,
            deckId: a.deckId,
            deckName: a.deckName,
            result: res(a, b),
            opp: b.name,
            oppDeckId: b.deckId,
          });
          matches.push({
            t: t.ID,
            day: league_day,
            date,
            round: rec.RoundNumber,
            player: b.name,
            deckId: b.deckId,
            deckName: b.deckName,
            result: res(b, a),
            opp: a.name,
            oppDeckId: a.deckId,
          });
        }
      } else if (comps.length === 1) {
        const a = pick(comps[0]);
        if (a.deckId) {
          deckIds.add(a.deckId);
          deckName[a.deckId] = a.deckName;
        }
        matches.push({
          t: t.ID,
          day: league_day,
          date,
          round: rec.RoundNumber,
          player: a.name,
          deckId: a.deckId,
          deckName: a.deckName,
          result: "win",
          opp: "bye",
          oppDeckId: null,
        });
      }
    }
    await sleep(80);
  }
  process.stdout.write(".");
}
console.log(`\nmatches: ${matches.length} | unique decklists: ${deckIds.size}`);
fs.writeFileSync(`${OUT}/matches.json`, JSON.stringify(matches));

// 2) fetch decklist cards (concurrency 6)
const ids = [...deckIds];
const decks = {};
let done = 0;
async function fetchDeck(id) {
  try {
    const html = await (
      await fetch(`https://melee.gg/Decklist/View/${id}`, {
        headers: { "user-agent": UA },
      })
    ).text();
    const cards = [
      ...html.matchAll(
        /<span class="decklist-record-quantity">(\d+)<\/span>\s*<a class="decklist-record-name" href="\/Card\/View\/([^?"]+)[^"]*">([^<]+)<\/a>/g,
      ),
    ].map((m) => ({ qty: +m[1], slug: m[2], name: m[3] }));
    decks[id] = { name: deckName[id], cards };
  } catch (e) {
    decks[id] = { name: deckName[id], cards: [], err: e.message };
  }
  done++;
  if (done % 50 === 0) process.stdout.write(`(${done}/${ids.length})`);
}
const pool = 6;
for (let k = 0; k < ids.length; k += pool) {
  await Promise.all(ids.slice(k, k + pool).map(fetchDeck));
  await sleep(60);
}
fs.writeFileSync(`${OUT}/decklists.json`, JSON.stringify(decks));
const withCards = Object.values(decks).filter((d) => d.cards.length).length;
console.log(
  `\ndecklists fetched: ${ids.length} | with cards: ${withCards} (${Math.round((100 * withCards) / ids.length)}%)`,
);
console.log("saved to", OUT);
