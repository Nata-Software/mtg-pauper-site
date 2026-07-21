/**
 * Deterministic per-deck archetype classifier.
 *
 * Given ONE decklist's cards, returns its archetype — the same result every
 * time, independent of any other decks (no corpus re-clustering). This is what
 * runs on each newly-scraped decklist.
 *
 * It combines:
 *   1. hard signature rules (creatures / key cards) for the splits that matter
 *      to us — red (Madness/RDW), blue (Delver/Terror/Faeries), gruul
 *      (Ponza/Ramp/Aggro);
 *   2. nearest frozen archetype centroid (TF-IDF cosine) for everything else;
 *   3. "rogue" when nothing matches confidently (rare / new decks).
 *
 * The learned parts (IDF weights + archetype centroids) live in the committed
 * model file, produced by train.mjs. Rebuild the model when you want to
 * re-derive it from accumulated data — classification of stored decks then just
 * re-runs this function; no re-scraping needed.
 *
 * A "card" is { qty:number, slug:string, name:string }.
 */

// --- lands -> colors (basics + colored artifact lands + common dual/fixing) ---
export const LAND_COLOR = {
  mountain: "R", snowcoveredmountain: "R", island: "U", snowcoveredisland: "U",
  swamp: "B", snowcoveredswamp: "B", forest: "G", snowcoveredforest: "G",
  plains: "W", snowcoveredplains: "W",
  greatfurnace: "R", seatofthesynod: "U", vaultofwhispers: "B", treeoftales: "G", ancientden: "W",
  azoriusguildgate: "WU", dimirguildgate: "UB", rakdosguildgate: "BR", golgariguildgate: "BG",
  gruulguildgate: "RG", borosguildgate: "RW", selesnyaguildgate: "GW", orzhovguildgate: "WB",
  izzetguildgate: "UR", simicguildgate: "GU",
  tranquilcove: "WU", dismalbackwater: "UB", bloodfellcaves: "BR", junglehollow: "BG",
  ruggedhighlands: "RG", windscarredcrag: "RW", blossomingsands: "GW", scouredbarrens: "WB",
  swiftwatercliffs: "UR", thornwoodfalls: "GU",
  glacialfloodplain: "WU", icetunnel: "UB", sulfurousmire: "BR", alpinemeadow: "RW",
  arctictreeline: "GW", snowfieldsinkhole: "WB", volatilefjord: "UR", woodlandchasm: "BG",
  rimewoodfalls: "GU", contaminatedaquifer: "UB", geothermalbog: "BR",
};

const NAME = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
const GUILD = {
  "B,U": "Dimir", "B,R": "Rakdos", "B,G": "Golgari", "R,U": "Izzet", "G,R": "Gruul",
  "U,W": "Azorius", "B,W": "Orzhov", "R,W": "Boros", "G,W": "Selesnya", "G,U": "Simic",
};

export const isBasic = (s) =>
  /^(snowcovered)?(plains|island|swamp|mountain|forest)$/.test(s) || s === "wastes";

/** Colors present via >=3 land sources (so light off-color splashes don't count). */
export function colorSet(cards) {
  const src = {};
  for (const c of cards) {
    const cols = LAND_COLOR[c.slug];
    if (cols) for (const col of cols) src[col] = (src[col] || 0) + c.qty;
  }
  return new Set(Object.keys(src).filter((k) => src[k] >= 3));
}

/** Color prefix name for a set, e.g. "Mono-Blue", "Dimir", "Colorless". */
export function colorPrefix(set) {
  const a = [...set].sort();
  if (!a.length) return "Colorless";
  if (a.length === 1) return "Mono-" + NAME[a[0]];
  if (a.length === 2) return GUILD[a.join(",")] || a.join("");
  return a.length + "c";
}

/** TF-IDF vector (nonbasic cards) using an idf lookup. */
export function vec(cards, idf) {
  const v = {};
  for (const c of cards) {
    if (isBasic(c.slug)) continue;
    v[c.slug] = (v[c.slug] || 0) + c.qty;
  }
  for (const k in v) v[k] *= idf(k);
  return v;
}

export function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (const k in a) { na += a[k] * a[k]; if (b[k]) d += a[k] * b[k]; }
  for (const k in b) nb += b[k] * b[k];
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

// --- signature rules (domain knowledge; the "our classification" part) ---
const RED_MADNESS = ["voldarenepicure", "kessigflamebreather", "fierytemper", "sneakysnacker"];

// Final display renames (cluster labels come from the plurality typed name;
// override these where we prefer a different name).
const DISPLAY = {
  "mono-black aristocrats": "Mono-Black Sacrifice",
};

function hasName(cards, needle) {
  return cards.some((c) => c.name.toLowerCase().includes(needle));
}

// Blue: Delver > Terror > Faeries. Delver present => Delver deck even if it also
// runs Tolarian Terror (in our meta almost all Delver decks do). "Terror" is
// always Tolarian Terror; Faerie Macabre is graveyard hate, NOT a Faeries signal.
function blueCore(cards) {
  const delver = hasName(cards, "delver of secrets");
  const terror = hasName(cards, "tolarian terror");
  const faeriePkg =
    ["spellstutter sprite", "faerie seer", "faerie miscreant"].filter((n) =>
      hasName(cards, n),
    ).length >= 2;
  if (delver) return "Delver";
  if (terror) return "Terror";
  if (faeriePkg) return "Faeries";
  return null;
}

// Mono-red: Madness (Voldaren Epicure / Kessig Flamebreather package) vs RDW.
function redCore(cards) {
  const slugs = new Set(cards.map((c) => c.slug));
  return RED_MADNESS.filter((s) => slugs.has(s)).length >= 2 ? "Madness" : "RDW";
}

// Kiln Fiend / "Hot Dogs": spells-combo aggro built on Kiln Fiend / Festival
// Crasher + free pump (Assault Strobe, Temur Battle Rage). Its own archetype,
// NOT RDW. Kiln Fiend / Festival Crasher see essentially no other play, so
// their presence is a reliable signal. Checked before color routing so the
// izzet build reads "Izzet Kiln Fiend" too.
function isKilnFiend(cards) {
  return hasName(cards, "kiln fiend") || hasName(cards, "festival crasher");
}

// Gruul: Ponza (land destruction) vs Ramp (Utopia Sprawl ramp) vs Aggro.
function gruulCore(cards) {
  const ld = ["thermokarst", "mwonvuli acid-moss", "stone rain", "molten rain", "icequake"];
  if (ld.some((n) => hasName(cards, n))) return "Ponza";
  if (hasName(cards, "utopia sprawl")) return "Ramp";
  return "Aggro";
}

// Boros (R/W): Tribe (Tireless Tribe combo) vs Synthesizer (Experimental
// Synthesizer) vs Bully (Kor Skyfisher / Battle Screech aggro). Different decks.
function borosCore(cards) {
  if (hasName(cards, "tireless tribe")) return "Tribe";
  if (hasName(cards, "experimental synthesizer")) return "Synthesizer";
  return "Bully";
}

/**
 * Classify one deck. `model` = { N, idf:{slug:weight}, archetypes:[{name,col,centroid}] }.
 * Returns an archetype name, or "rogue: <typedName>" when nothing matches.
 */
export function classifyDeck(cards, typedName, model) {
  const idf = (s) => (s in model.idf ? model.idf[s] : Math.log(model.N || 1));
  const cs = colorSet(cards);
  const dcol = [...cs].sort().join(",");
  const v = vec(cards, idf);

  // 1. signature overrides
  let label = null;
  if (isKilnFiend(cards)) label = `${colorPrefix(cs)} Kiln Fiend`;
  if (label === null && cs.has("U")) {
    const core = blueCore(cards);
    if (core) label = `${colorPrefix(cs)} ${core}`;
  }
  if (label === null && dcol === "R") label = `Mono-Red ${redCore(cards)}`;
  if (label === null && dcol === "R,W") label = `Boros ${borosCore(cards)}`;

  // 2. nearest frozen centroid (small same-color bonus)
  if (label === null) {
    let best = null, bs = 0;
    for (const a of model.archetypes) {
      const s = cosine(v, a.centroid) + (a.col === dcol ? 0.05 : 0);
      if (s > bs) { bs = s; best = a; }
    }
    label = best && bs >= 0.36 ? best.name : `rogue: ${typedName || "unknown"}`;
    // gruul re-split by signature (color detection under-reads dork/ramp decks)
    if (/gruul/i.test(label)) label = `Gruul ${gruulCore(cards)}`;
  }

  return label in DISPLAY ? DISPLAY[label] : label;
}
