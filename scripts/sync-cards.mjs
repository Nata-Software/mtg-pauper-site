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
 * ART: the OLDEST printing. Scryfall's name lookup returns its "default"
 * printing, which is effectively the newest — Lightning Bolt was resolving to a
 * 2026 Marvel Super Heroes Commander deck. For each card we re-query its
 * printings (`unique=art&order=released&dir=asc`, paper only) and take the
 * first artwork. Note this also moves `rarity` to that printing's rarity, which
 * is the honest value for the art being shown.
 *
 * Pass --refresh-art to re-pick art for cards already cached, without redoing
 * name resolution.
 *
 * Only image URLs are stored, never image bytes; the images stay on Scryfall's
 * CDN. Requests are paced ~8/sec, inside Scryfall's asked-for limit.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
const REFRESH_ART = process.argv.includes("--refresh-art");

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

/** Does this printing have art we can show? */
const hasImage = (c) => Boolean(c.image_uris ?? c.card_faces?.[0]?.image_uris);

/**
 * Set types that are not the card's real printing — promos, Un-sets, art series
 * and oversized memorabilia. Their art and frames are off-model, and promos
 * often ship *before* the set they promote (Bonesplitter's oldest printing was
 * an Arena League 2003 promo, years ahead of Darksteel), so excluding them
 * outright is what "the original art" actually means.
 */
const OFF_MODEL_SETS = new Set(["promo", "memorabilia", "funny", "token"]);

const isRealPrinting = (c) =>
  !c.promo && !OFF_MODEL_SETS.has(c.set_type ?? "");

/**
 * Is `a` an older printing than `b`?
 *
 * A real set printing always beats a promo, then paper beats digital-only, then
 * earliest release date wins. Promos are only used when a card has no real
 * printing at all.
 */
function isOlder(a, b) {
  if (!b) return true;

  const realA = isRealPrinting(a);
  const realB = isRealPrinting(b);
  if (realA !== realB) return realA;

  const paperA = (a.games ?? []).includes("paper");
  const paperB = (b.games ?? []).includes("paper");
  if (paperA !== paperB) return paperA;

  return (a.released_at ?? "9999") < (b.released_at ?? "9999");
}

/**
 * Oldest artwork for many cards at once, from Scryfall's bulk export.
 *
 * The obvious approach — one /cards/search per card — does not survive contact
 * with 1,087 cards: Scryfall rate-limited 38 of 60 sustained requests with a
 * "try again after 60 seconds" 429. Bulk data exists precisely so apps stop
 * doing that. The default_cards export is every printing as gzipped JSONL,
 * streamed a line at a time so only the cards we asked about are ever held in
 * memory.
 */
async function oldestArtFromBulk(oracleIds) {
  const cat = await (
    await fetch("https://api.scryfall.com/bulk-data", { headers: H })
  ).json();
  // default_cards, NOT unique_artwork: the latter is deduplicated by artwork and
  // its representative is whichever printing has the best scan, which can be a
  // later one — it moved Consider from Midnight Hunt to Double Feature. Picking
  // the genuinely earliest printing needs every printing.
  const entry = (cat.data ?? []).find((d) => d.type === "default_cards");
  if (!entry?.jsonl_download_uri) throw new Error("no default_cards bulk export");

  console.log(
    `streaming ${entry.name} (${(entry.compressed_size / 1e6).toFixed(0)} MB gz, ${entry.updated_at.slice(0, 10)})…`,
  );

  const res = await fetch(entry.jsonl_download_uri, {
    headers: { "user-agent": UA },
  });
  if (!res.ok) throw new Error(`bulk download HTTP ${res.status}`);

  const lines = readline.createInterface({
    input: Readable.fromWeb(res.body).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });

  const want = new Set(oracleIds);
  const best = new Map();
  let seen = 0;

  for await (const line of lines) {
    const t = line.trim().replace(/,$/, "");
    if (!t || t === "[" || t === "]") continue;
    let card;
    try {
      card = JSON.parse(t);
    } catch {
      continue;
    }
    seen++;
    const oid = card.oracle_id;
    if (!oid || !want.has(oid) || !hasImage(card)) continue;
    if (isOlder(card, best.get(oid))) best.set(oid, card);
  }

  console.log(`  scanned ${seen.toLocaleString()} printings, matched ${best.size}/${want.size} cards`);
  return best;
}

/**
 * Oldest artwork for a single card, via the API — used for the handful of new
 * cards an import adds, where downloading the bulk export would be absurd.
 * Backs off on 429 rather than silently giving up.
 */
async function oldestArtPrinting(oracleId) {
  if (!oracleId) return null;
  const url =
    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`oracleid:${oracleId}`)}` +
    `&unique=art&order=released&dir=asc`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: H });
      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after") ?? 5) * 1000;
        console.log(`  rate-limited, waiting ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      if (res.status !== 200) return null;
      const data = (await res.json()).data ?? [];
      const paper = data.filter((c) => (c.games ?? []).includes("paper"));
      return (paper.length ? paper : data).find(hasImage) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

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

if (REFRESH_ART) {
  const { rows } = await client.query(
    `SELECT key, name, "oracleId", "setCode" FROM "Card"
      WHERE resolved = true AND "oracleId" IS NOT NULL ORDER BY name`,
  );
  // Neon drops a connection left idle and the bulk scan takes a while, so no
  // connection is held across it.
  await client.end();

  const best = await oldestArtFromBulk(rows.map((r) => r.oracleId));

  const updates = [];
  let same = 0;
  let missing = 0;

  for (const r of rows) {
    const art = best.get(r.oracleId);
    if (!art) {
      missing++;
      continue;
    }
    if (art.set === r.setCode) {
      same++;
      continue;
    }
    const img = art.image_uris ?? art.card_faces?.[0]?.image_uris ?? {};
    updates.push({
      key: r.key, name: r.name, from: r.setCode, to: art.set,
      released: art.released_at, scryfallId: art.id ?? null,
      rarity: art.rarity ?? null, small: img.small ?? null,
      normal: img.normal ?? null, artCrop: img.art_crop ?? null,
      uri: art.scryfall_uri ?? null,
    });
  }

  for (const u of updates.slice(0, 12))
    console.log(`  ${u.name}: ${u.from} -> ${u.to} (${u.released})`);
  console.log(
    `\nmoving to older art: ${updates.length} | already oldest: ${same} | not in export: ${missing}`,
  );

  if (!APPLY) {
    console.log("DRY RUN — nothing written. Re-run with --apply.");
    process.exit(0);
  }

  const w = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await w.connect();
  await w.query("BEGIN");
  try {
    for (const u of updates) {
      await w.query(
        `UPDATE "Card" SET "scryfallId"=$2, "setCode"=$3, rarity=$4,
                "imageSmall"=$5, "imageNormal"=$6, "imageArtCrop"=$7,
                "scryfallUri"=$8, "updatedAt"=now()
          WHERE key=$1`,
        [u.key, u.scryfallId, u.to, u.rarity, u.small, u.normal, u.artCrop, u.uri],
      );
    }
    await w.query("COMMIT");
    console.log(`updated ${updates.length} cards ✅`);
  } catch (e) {
    await w.query("ROLLBACK");
    throw e;
  } finally {
    await w.end();
  }
  process.exit(0);
}

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

// Prefer the oldest artwork over Scryfall's default (newest) printing.
console.log(`picking oldest art for ${resolved.size} cards…`);
for (const [k, card] of resolved) {
  const art = await oldestArtPrinting(card.oracle_id);
  if (art) resolved.set(k, art);
  await sleep(125);
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
