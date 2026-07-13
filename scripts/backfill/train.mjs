/**
 * Trains the archetype model from scraped decklists and writes archetype-model.json.
 *
 * The model is the *learned* half of the classifier:
 *   - idf:        card distinctiveness weights (staples count for little)
 *   - archetypes: one TF-IDF centroid per clustered archetype (+ its color)
 *
 * The signature rules (red/blue/gruul splits) live in classify.mjs and are NOT
 * learned — they're our domain knowledge. classifyDeck() combines both.
 *
 * Run:  node scripts/backfill/train.mjs
 * Re-run whenever you want to re-derive archetypes from accumulated data. It
 * reads the stored decklists/cards — no re-scraping needed.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isBasic, colorSet, cosine, vec } from "../../src/lib/archetype/classify.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const decks = JSON.parse(fs.readFileSync(path.join(DIR, "data/decklists.json")));

const ids = Object.keys(decks).filter((id) => decks[id].cards?.length);

// document frequency -> idf
const df = {};
for (const id of ids) {
  const seen = new Set();
  for (const c of decks[id].cards) if (!isBasic(c.slug)) seen.add(c.slug);
  for (const s of seen) df[s] = (df[s] || 0) + 1;
}
const N = ids.length;
const idfMap = {};
for (const s in df) idfMap[s] = Math.log(N / df[s]);
const idf = (s) => (s in idfMap ? idfMap[s] : Math.log(N));

// per-deck vectors + dominant color
const dvec = {}, dcol = {};
for (const id of ids) {
  dvec[id] = vec(decks[id].cards, idf);
  dcol[id] = [...colorSet(decks[id].cards)].sort().join(",");
}

// centroid per typed name with >=3 decks, tagged with its dominant color
const byName = {};
for (const id of ids) {
  const n = decks[id].name || "(none)";
  (byName[n] = byName[n] || []).push(id);
}
const cent = {}, cCol = {}, cCount = {};
const addInto = (acc, v) => { for (const k in v) acc[k] = (acc[k] || 0) + v[k]; };
for (const [n, list] of Object.entries(byName)) {
  if (list.length < 3 || n === "(none)") continue;
  const c = {};
  list.forEach((id) => addInto(c, dvec[id]));
  cent[n] = c;
  cCount[n] = list.length;
  const cc = {};
  list.forEach((id) => (cc[dcol[id]] = (cc[dcol[id]] || 0) + 1));
  cCol[n] = Object.entries(cc).sort((a, b) => b[1] - a[1])[0][0];
}

// merge same-color name-centroids whose cosine >= 0.50
const names = Object.keys(cent);
const par = {};
names.forEach((n) => (par[n] = n));
const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
for (let i = 0; i < names.length; i++)
  for (let j = i + 1; j < names.length; j++)
    if (cCol[names[i]] === cCol[names[j]] && cosine(cent[names[i]], cent[names[j]]) >= 0.5)
      par[find(names[i])] = find(names[j]);

const clusters = {};
for (const n of names) (clusters[find(n)] = clusters[find(n)] || []).push(n);

const archetypes = [];
for (const members of Object.values(clusters)) {
  const name = members.sort((a, b) => cCount[b] - cCount[a])[0];
  const centroid = {};
  members.forEach((m) => addInto(centroid, cent[m]));
  archetypes.push({ name, col: cCol[name], members, centroid });
}

const model = { version: 1, trainedDecks: N, idf: idfMap, archetypes };
fs.writeFileSync(path.join(DIR, "../../src/lib/archetype/model.json"), JSON.stringify(model));
console.log(
  `model written: ${archetypes.length} archetype centroids, ${Object.keys(idfMap).length} cards, trained on ${N} decklists`,
);
