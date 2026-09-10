/**
 * Resolve every card name in our decklists against Scryfall and cache it in the
 * Card table.
 *
 *   DATABASE_URL="$PROD" node scripts/sync-cards.mjs [--apply] [--all]
 *
 * Only names not already cached are looked up, so re-running is cheap and this
 * doubles as the backfill for cards a player brings for the first time. Pass
 * --all to re-resolve everything (e.g. after Scryfall data changes).
 *
 * Resolution ladder, cheapest first (see src/lib/cards/resolve.ts for why the
 * raw name often fails):
 *   1. /cards/collection  — 75 exact names per request
 *   2. front face of a double-faced "A // B" name
 *   3. /cards/search with include_multilingual — Portuguese registrations
 *   4. /cards/named?fuzzy  — accent and typo variants
 *
 * Only image URLs are stored, never image bytes; the images stay on Scryfall's
 * CDN. Requests are paced ~8/sec, inside Scryfall's asked-for limit.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");

/** Manual last resort for names Scryfall can't find — see card-aliases.json. */
const ALIASES = JSON.parse(
  fs.readFileSync(path.join(DIR, "card-aliases.json"), "utf8"),
);

const UA =
  "mtg-pauper-site/1.0 (metagame decklists; contact via github Nata-Software/mtg-pauper-site)";
const H = { "user-agent": UA, accept: "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- mirrors src/lib/cards/resolve.ts (kept inline so the script is standalone)
const stripSetPrefix = (s) => s.replace(/^\s*\[[A-Za-z0-9]{1,6}\]\s*/, "");
const stripLeadingQty = (s) => s.replace(/^\s*\d+\s+(?=\D)/, "");
const cleanCardName = (raw) =>
  stripLeadingQty(stripSetPrefix(String(raw ?? ""))).replace(/\s+/g, " ").trim();
// Split/double-faced names arrive as "A // B" and, in Portuguese lists, "A - B".
const frontFace = (s) => {
  const t = String(s ?? "").trim();
  if (t.includes("//")) return t.slice(0, t.indexOf("//")).trim();
  const dash = t.split(/\s+-\s+/);
  return dash.length > 1 ? dash[0].trim() : t;
};
const cardKey = (raw) =>
  cleanCardName(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Flatten a Scryfall card into our row shape. */
function toRow(key, card) {
  const img = card.image_uris ?? card.card_faces?.[0]?.image_uris ?? {};
  const face = card.card_faces?.[0] ?? {};
  return {
    key,
    name: card.name,
    scryfallId: card.id ?? null,
    oracleId: card.oracle_id ?? null,
    typeLine: card.type_line ?? face.type_line ?? null,
    manaCost: card.mana_cost ?? face.mana_cost ?? null,
    cmc: card.cmc ?? null,
    colors: (card.colors ?? face.colors ?? []).join(""),
    rarity: card.rarity ?? null,
    setCode: card.set ?? null,
    oracleText: card.oracle_text ?? face.oracle_text ?? null,
    power: card.power ?? face.power ?? null,
    toughness: card.toughness ?? face.toughness ?? null,
    imageSmall: img.small ?? null,
    imageNormal: img.normal ?? null,
    imageArtCrop: img.art_crop ?? null,
    scryfallUri: card.scryfall_uri ?? null,
    resolved: true,
  };
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Every distinct name across all decklists -> its key.
const { rows: lists } = await client.query(`SELECT cards FROM "Decklist"`);
const keyToName = new Map();
for (const r of lists)
  for (const c of r.cards) {
    const k = cardKey(c.name);
    if (k && !keyToName.has(k)) keyToName.set(k, cleanCardName(c.name));
  }
console.log(`distinct card keys in decklists: ${keyToName.size}`);

const { rows: have } = await client.query(`SELECT key FROM "Card"`);
const cached = new Set(have.map((r) => r.key));
const todo = [...keyToName.entries()].filter(([k]) => ALL || !cached.has(k));
console.log(`already cached: ${cached.size} | to resolve: ${todo.length}`);

if (todo.length === 0) {
  console.log("nothing to do ✅");
  await client.end();
  process.exit(0);
}

const resolved = new Map();
const pending = new Map(todo); // key -> cleaned name

// 1 + 2. batch exact names, then batch front faces for what's left
for (const useFace of [false, true]) {
  const batchKeys = [...pending.keys()].filter((k) => !resolved.has(k));
  if (!batchKeys.length) continue;
  for (let i = 0; i < batchKeys.length; i += 75) {
    const chunk = batchKeys.slice(i, i + 75);
    const ids = chunk.map((k) => {
      const n = pending.get(k);
      return { name: useFace ? frontFace(n) : n };
    });
    const res = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { ...H, "content-type": "application/json" },
      body: JSON.stringify({ identifiers: ids }),
    });
    const json = await res.json();
    // Match results back by their own name/printed name.
    const byName = new Map();
    for (const c of json.data ?? []) {
      byName.set(cardKey(c.name), c);
      if (c.printed_name) byName.set(cardKey(c.printed_name), c);
      byName.set(cardKey(frontFace(c.name)), c);
    }
    for (const k of chunk) {
      const n = pending.get(k);
      const hit = byName.get(cardKey(useFace ? frontFace(n) : n)) ?? byName.get(k);
      if (hit) resolved.set(k, hit);
    }
    await sleep(125);
  }
  console.log(`after ${useFace ? "front-face" : "exact"} batch: ${resolved.size}/${todo.length}`);
}

// 3 + 4. one-by-one fallbacks for the stragglers (multilingual, then fuzzy)
const stragglers = [...pending.keys()].filter((k) => !resolved.has(k));
console.log(`falling back for ${stragglers.length} names…`);
for (const k of stragglers) {
  const n = ALIASES[k] ?? pending.get(k);
  const attempts = [
    ...(ALIASES[k]
      ? [`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(ALIASES[k])}`]
      : []),
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`name:/^${n.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")}$/`)}&include_multilingual=true`,
    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(frontFace(n))}`,
  ];
  for (const url of attempts) {
    const res = await fetch(url, { headers: H });
    if (res.status === 200) {
      const j = await res.json();
      const card = j.object === "card" ? j : (j.data ?? [])[0];
      if (card) {
        resolved.set(k, card);
        break;
      }
    }
    await sleep(125);
  }
}

const unresolved = [...pending.keys()].filter((k) => !resolved.has(k));
console.log(`\nresolved: ${resolved.size} | unresolved: ${unresolved.length}`);
if (unresolved.length)
  console.log("unresolved names:\n  " + unresolved.map((k) => pending.get(k)).join("\n  "));

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.");
  await client.end();
  process.exit(0);
}

const COLS = [
  "key", "name", "scryfallId", "oracleId", "typeLine", "manaCost", "cmc",
  "colors", "rarity", "setCode", "oracleText", "power", "toughness",
  "imageSmall", "imageNormal", "imageArtCrop", "scryfallUri", "resolved",
];
let written = 0;
for (const [k, card] of resolved) {
  const row = toRow(k, card);
  await client.query(
    `INSERT INTO "Card" (${COLS.map((c) => `"${c}"`).join(",")},"updatedAt")
     VALUES (${COLS.map((_, i) => `$${i + 1}`).join(",")}, now())
     ON CONFLICT ("key") DO UPDATE SET
       ${COLS.filter((c) => c !== "key").map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")},
       "updatedAt" = now()`,
    COLS.map((c) => row[c]),
  );
  written++;
}
// Record the misses too, so they aren't retried on every import and can be reported.
for (const k of unresolved) {
  await client.query(
    `INSERT INTO "Card" ("key","name","resolved","updatedAt") VALUES ($1,$2,false,now())
     ON CONFLICT ("key") DO UPDATE SET "resolved" = false, "updatedAt" = now()`,
    [k, pending.get(k)],
  );
}
console.log(`wrote ${written} cards (+${unresolved.length} recorded unresolved) ✅`);
await client.end();
