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
  mountain: "R",
  snowcoveredmountain: "R",
  island: "U",
  snowcoveredisland: "U",
  swamp: "B",
  snowcoveredswamp: "B",
  forest: "G",
  snowcoveredforest: "G",
  plains: "W",
  snowcoveredplains: "W",
  greatfurnace: "R",
  seatofthesynod: "U",
  vaultofwhispers: "B",
  treeoftales: "G",
  ancientden: "W",
  azoriusguildgate: "WU",
  dimirguildgate: "UB",
  rakdosguildgate: "BR",
  golgariguildgate: "BG",
  gruulguildgate: "RG",
  borosguildgate: "RW",
  selesnyaguildgate: "GW",
  orzhovguildgate: "WB",
  izzetguildgate: "UR",
  simicguildgate: "GU",
  tranquilcove: "WU",
  dismalbackwater: "UB",
  bloodfellcaves: "BR",
  junglehollow: "BG",
  ruggedhighlands: "RG",
  windscarredcrag: "RW",
  blossomingsands: "GW",
  scouredbarrens: "WB",
  swiftwatercliffs: "UR",
  thornwoodfalls: "GU",
  glacialfloodplain: "WU",
  icetunnel: "UB",
  sulfurousmire: "BR",
  alpinemeadow: "RW",
  arctictreeline: "GW",
  snowfieldsinkhole: "WB",
  volatilefjord: "UR",
  woodlandchasm: "BG",
  rimewoodfalls: "GU",
  contaminatedaquifer: "UB",
  geothermalbog: "BR",

  // --- nonbasic sources that were missing, found by auditing every card in the
  // corpus against Scryfall's produced_mana. Their absence made real two- and
  // three-colour decks read as mono, because only basics counted: a Gruul Storm
  // deck on Gruul Turf / Hickory Woodlot / Geothermal Crevice looked Mono-Red
  // and got labelled RDW.
  //
  // Two deliberate exclusions:
  //  * lands producing 3+ colours (Gates, Thriving, Crystal Grotto, the
  //    Invasion sac-lands) — generic fixing that says nothing about a deck's
  //    colours; counting them turns every deck 5c.
  //  * lands played for an ETB/utility rather than their mana — Bojuka Bog,
  //    Khalni Garden, Mortuary Mire, Witch's Cottage, Gingerbread Cabin, Sejiri
  //    Steppe, Kabira Crossroads. Bojuka Bog alone is in 237 decklists; counting
  //    it invented a black splash that turned a Simic fog deck into "3c".

  // Karoo / bounce lands
  azoriuschancery: "UW",
  dimiraqueduct: "BU",
  rakdoscarnarium: "BR",
  golgarirotfarm: "BG",
  gruulturf: "GR",
  borosgarrison: "RW",
  orzhovbasilica: "BW",
  izzetboilerworks: "RU",
  simicgrowthchamber: "GU",

  // Artifact "Bridge" duals
  drossforgebridge: "BR",
  silverbluffbridge: "RU",
  mistvaultbridge: "BU",
  slagwoodsbridge: "GR",
  rustvalebridge: "RW",
  razortidebridge: "UW",
  goldmirebridge: "BW",
  darkmossbridge: "BG",
  tanglepoolbridge: "GU",

  // Other two-colour lands
  hauntedmire: "BG",
  jaggedbarrens: "BR",
  woodedridgeline: "GR",
  razortrapgorge: "BR",
  tangledislet: "GU",
  idyllicbeachfront: "UW",
  moltentributary: "RU",
  highlandforest: "GR",
  kyoshivillage: "GW",
  northpolegates: "UW",
  silverquillcampus: "BW",
  radiantgrove: "GW",
  erodedcanyon: "RU",
  lonelyarroyo: "UW",
  forlornflats: "BW",
  universitycampus: "UW",
  dimensionx: "RW",

  // Single-colour nonbasics (cycling lands, depletion lands, …)
  idyllicgrange: "W",
  hickorywoodlot: "G",
  saprazzanskerry: "U",
  sandstoneneedle: "R",
  remoteisle: "U",
  barrenmoor: "B",
  peatbog: "B",
  forgottencave: "R",
  remotefarm: "W",
  pollutedmire: "B",
  sandstonebridge: "W",
  loomingspires: "R",
  skylinecascade: "U",
  desertoftheglorified: "B",
};

const NAME = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
const GUILD = {
  "B,U": "Dimir",
  "B,R": "Rakdos",
  "B,G": "Golgari",
  "R,U": "Izzet",
  "G,R": "Gruul",
  "U,W": "Azorius",
  "B,W": "Orzhov",
  "R,W": "Boros",
  "G,W": "Selesnya",
  "G,U": "Simic",
};

export const isBasic = (s) =>
  /^(snowcovered)?(plains|island|swamp|mountain|forest)$/.test(s) ||
  s === "wastes";

/** Coloured land sources per color, e.g. { R: 16, B: 11 }. */
export function colorSources(cards) {
  const src = {};
  for (const c of cards) {
    const cols = LAND_COLOR[c.slug];
    if (cols) for (const col of cols) src[col] = (src[col] || 0) + c.qty;
  }
  return src;
}

/** Colors present via >=3 land sources (so light off-color splashes don't count). */
export function colorSet(cards) {
  const src = colorSources(cards);
  return new Set(Object.keys(src).filter((k) => src[k] >= 3));
}

// Three-colour names: the five shards (allied) and five wedges (enemy). Keys
// are alphabetically sorted colour letters, matching GUILD above.
const TRIAD = {
  "G,U,W": "Bant",
  "B,U,W": "Esper",
  "B,R,U": "Grixis",
  "B,G,R": "Jund",
  "G,R,W": "Naya",
  "B,G,W": "Abzan",
  "R,U,W": "Jeskai",
  "B,G,U": "Sultai",
  "B,R,W": "Mardu",
  "G,R,U": "Temur",
};

/** Color prefix name for a set, e.g. "Mono-Blue", "Dimir", "Sultai", "4c". */
export function colorPrefix(set) {
  const a = [...set].sort();
  if (!a.length) return "Colorless";
  if (a.length === 1) return "Mono-" + NAME[a[0]];
  if (a.length === 2) return GUILD[a.join(",")] || a.join("");
  if (a.length === 3) return TRIAD[a.join(",")] || a.join("");
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
  let d = 0,
    na = 0,
    nb = 0;
  for (const k in a) {
    na += a[k] * a[k];
    if (b[k]) d += a[k] * b[k];
  }
  for (const k in b) nb += b[k] * b[k];
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

// --- signature rules (domain knowledge; the "our classification" part) ---
const RED_MADNESS = [
  "voldarenepicure",
  "kessigflamebreather",
  "fierytemper",
  "sneakysnacker",
];

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
  return RED_MADNESS.filter((s) => slugs.has(s)).length >= 2
    ? "Madness"
    : "RDW";
}

// Kiln Fiend / "Hot Dogs": spells-combo aggro built on Kiln Fiend / Festival
// Crasher + free pump (Assault Strobe, Temur Battle Rage). Its own archetype,
// NOT RDW. Kiln Fiend / Festival Crasher see essentially no other play, so
// their presence is a reliable signal. Checked before color routing so the
// izzet build reads "Izzet Kiln Fiend" too.
function isKilnFiend(cards) {
  return hasName(cards, "kiln fiend") || hasName(cards, "festival crasher");
}

// Ruby / Gruul Storm: a combo deck that chains rituals and card-draw into a
// lethal Storm turn — not an aggro deck, despite living in red. Its payoffs see
// essentially no other play, so two of them is a reliable signal. Requiring two
// matters: one "naya" deck runs Seething Song alone and is correctly excluded.
const STORM_PAYOFFS = [
  "seethingsong",
  "glimpsetheimpossible",
  "seizethestorm",
  "firstdayofclass",
];

function isStorm(cards) {
  const slugs = new Set(cards.map((c) => c.slug));
  return STORM_PAYOFFS.filter((s) => slugs.has(s)).length >= 2;
}

// Gruul: Storm (combo) vs Ponza (land destruction) vs Ramp (Utopia Sprawl) vs
// Aggro. Storm is checked first — it also runs mana dorks, so the aggro
// fallthrough would otherwise swallow it.
function gruulCore(cards) {
  if (isStorm(cards)) return "Storm";
  const ld = [
    "thermokarst",
    "mwonvuli acid-moss",
    "stone rain",
    "molten rain",
    "icequake",
  ];
  if (ld.some((n) => hasName(cards, n))) return "Ponza";
  if (hasName(cards, "utopia sprawl")) return "Ramp";
  return "Aggro";
}

// Tron: every build runs the same twelve Urza lands plus Expedition Map and
// Candy Trail, so the centroid can't tell the variants apart — it was calling a
// Ghostly Flicker deck "altar tron" despite it holding no Ashnod's Altar. The
// engine card decides:
//   Ashnod's Altar          -> Altar    (sacrifice/drain engine)
//   Ghostly Flicker/Ephemerate -> Ephemerate (blink value engine)
//   neither                 -> Monster  (just big creatures)
function isTron(cards) {
  const slugs = new Set(cards.map((c) => c.slug));
  return (
    slugs.has("urzastower") && slugs.has("urzasmine") && slugs.has("urzaspowerplant")
  );
}

function tronCore(cards) {
  const slugs = new Set(cards.filter((c) => c.board !== "side").map((c) => c.slug));
  if (slugs.has("ashnodsaltar")) return "altar";
  if (slugs.has("ghostlyflicker") || slugs.has("ephemerate")) return "ephemerate";
  return "monster";
}

/**
 * Swap the variant word in a Tron label, keeping whatever colour word the
 * centroid produced. Tron mana bases are mostly colourless, so our colour read
 * is unreliable for them (see COLOR_CONFIDENCE) and the crowd's colour naming
 * is the better of the two.
 */
function relabelTron(label, cards) {
  const variant = tronCore(cards);
  const l = String(label).trim();

  const withVariant = l.match(/^(.*?)\s+(monster|altar|ephemerate)\s+tron$/i);
  if (withVariant) return `${withVariant[1]} ${variant} tron`;

  const bare = l.match(/^(.*?)\s*tron$/i);
  if (bare) return `${bare[1] ? `${bare[1]} ` : ""}${variant} tron`;

  return l;
}

// Boros (R/W): Tribe (Tireless Tribe combo) vs Synthesizer (Experimental
// Synthesizer) vs Bully (Kor Skyfisher / Battle Screech aggro). Different decks.
function borosCore(cards) {
  if (hasName(cards, "tireless tribe")) return "Tribe";
  if (hasName(cards, "experimental synthesizer")) return "Synthesizer";
  return "Bully";
}

// Colour word a label can start with -> the colours it claims. Used to spot a
// centroid label asserting a colour the deck produces no sources of.
const LABEL_COLORS = (() => {
  const m = {};
  for (const [letter, name] of Object.entries(NAME))
    m[`mono-${name.toLowerCase()}`] = letter;
  for (const [key, name] of Object.entries(GUILD))
    m[name.toLowerCase()] = key.replace(/,/g, "");
  for (const [key, name] of Object.entries(TRIAD))
    m[name.toLowerCase()] = key.replace(/,/g, "");
  return m;
})();

const COLOR_WORDS = new Set([
  ...Object.keys(LABEL_COLORS),
  "colorless",
  "2c",
  "3c",
  "4c",
  "5c",
]);

/**
 * Minimum coloured land sources before the computed colour set is trusted over
 * the label a centroid carries.
 *
 * Colours are read from lands, so decks whose mana is mostly colourless or
 * "any colour" — Tron (Urza lands), Caw-Gates (Gates), Bogles (Utopia Sprawl) —
 * come out far lighter than they play. For those the plurality name players
 * typed is the better signal, so leave it alone. A deck with a genuinely
 * coloured mana base clears this easily (the Sultai affinity below has 29).
 */
const COLOR_CONFIDENCE = 8;

/**
 * Correct the colour word a learned centroid label starts with.
 *
 * Cluster labels come from the plurality name players typed, so they carry
 * whatever colour that crowd wrote — which can contradict the cards. A Sultai
 * (B/G/U) affinity deck was landing on the "grixis affinity" centroid and being
 * labelled Grixis, a colour it plays none of, because no learned archetype has
 * a Sultai centroid.
 *
 * Only applied when the mana base is coloured enough to trust (see above), and
 * only to demote a colour the deck genuinely does not produce — never to
 * *widen* a label, since a light splash shouldn't rename an archetype.
 */
function relabelColor(label, cards, cs) {
  const parts = String(label).split(" ");
  if (parts.length < 2 || !COLOR_WORDS.has(parts[0].toLowerCase())) return label;

  const src = colorSources(cards);
  const total = Object.values(src).reduce((a, b) => a + b, 0);
  if (total < COLOR_CONFIDENCE) return label;

  // Does the label claim a colour the deck produces no sources of at all?
  const claimed = LABEL_COLORS[parts[0].toLowerCase()];
  if (!claimed) return label;
  const contradicted = [...claimed].some((c) => !src[c]);
  if (!contradicted) return label;

  const prefix = colorPrefix(cs);
  return prefix.toLowerCase() === parts[0].toLowerCase()
    ? label
    : `${prefix} ${parts.slice(1).join(" ")}`;
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
  // Storm is a combo deck; decide it from its payoffs rather than letting the
  // colour routing send it to an aggro label (it runs mana dorks and burn).
  if (label === null && isStorm(cards)) label = `${colorPrefix(cs)} Storm`;
  if (label === null && cs.has("U")) {
    const core = blueCore(cards);
    if (core) label = `${colorPrefix(cs)} ${core}`;
  }
  if (label === null && dcol === "R") label = `Mono-Red ${redCore(cards)}`;
  if (label === null && dcol === "R,W") label = `Boros ${borosCore(cards)}`;

  // 2. nearest frozen centroid (small same-color bonus)
  if (label === null) {
    let best = null,
      bs = 0;
    for (const a of model.archetypes) {
      const s = cosine(v, a.centroid) + (a.col === dcol ? 0.05 : 0);
      if (s > bs) {
        bs = s;
        best = a;
      }
    }
    label = best && bs >= 0.36 ? best.name : `rogue: ${typedName || "unknown"}`;
    // gruul re-split by signature (color detection under-reads dork/ramp decks)
    if (/gruul/i.test(label)) label = `Gruul ${gruulCore(cards)}`;
    // Tron variants are decided by their engine card, not by similarity.
    else if (isTron(cards)) label = relabelTron(label, cards);
    // Demote a centroid label asserting a colour the deck cannot produce.
    else label = relabelColor(label, cards, cs);
  }

  return label in DISPLAY ? DISPLAY[label] : label;
}
