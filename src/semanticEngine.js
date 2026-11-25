// Layer 1: Hybrid Semantic Engine
// - Instant mode (<5ms): 24-axis conceptual basis + 32-dim morphological n-gram projection (bilingual FR/EN)
// - Optional Neural mode: browser-native multilingual embeddings via @xenova/transformers (WASM/WebGPU)
// - Dialectical relation scoring: separates cosine resonance from stance/polarity contradiction

import { POLARITY_PAIRS, normalizeText } from "./i18n.js";

// 24 conceptual semantic dimensions (each maps stems/roots -> signed weights)
// Positive and negative poles allow true semantic opposition even without hard-coded pairs.
const SEMANTIC_AXES = [
  // 0: Autonomy (+) vs Automatism/Control (-)
  { pos: ["autonom", "liber", "emancip", "choi", "volont", "jugement", "critiq", "resist", "souverain", "agency", "free", "judg"],
    neg: ["automat", "contr", "algorith", "servit", "serv", "obed", "soumis", "domina", "calcul", "optimis", "productiv", "norm", "regl"] },
  // 1: Collective / Relation (+) vs Singular / Isolated (-)
  { pos: ["collectif", "collectiv", "transindivid", "commun", "reseau", "network", "partag", "lien", "relier", "relat", "ensemble", "social", "milieu", "nous", "swarm", "essaim", "symbios"],
    neg: ["singul", "individu", "seul", "solit", "moi", "ego", "isol", "monad", "prive", "self", "alone"] },
  // 2: Technics / Machine (+) vs Living / Organic Body (-)
  { pos: ["techniq", "technic", "technolog", "machin", "numer", "digit", "code", "calcul", "cyber", "interface", "outil", "tool", "robot", "ia", "ai", "system", "matrice", "matrix"],
    neg: ["corps", "body", "vivant", "living", "chair", "flesh", "organ", "biolog", "souffl", "breath", "peau", "main", "hand", "geste", "gestur", "sensibl", "animal", "terre", "earth"] },
  // 3: Noesis / Thought (+) vs Matter / Concrete (-)
  { pos: ["noes", "noet", "pense", "thought", "esprit", "mind", "concept", "idee", "idea", "sens", "mean", "savoir", "knowledg", "conscien", "raison", "reason", "dianoia", "logos", "intellig"],
    neg: ["matier", "matter", "pierre", "stone", "objet", "object", "physiq", "masse", "poids", "sol", "ground", "beton", "fer", "metal"] },
  // 4: Poiesis / Art / Play (+) vs Utility / Production (-)
  { pos: ["poies", "poiet", "art", "esthet", "aesthet", "beaute", "beauty", "jeu", "play", "oeuvr", "crea", "invent", "imagin", "fict", "musiq", "danse", "chant", "poeme", "style"],
    neg: ["produit", "product", "util", "rendement", "profit", "marche", "market", "industr", "usine", "factory", "efficac", "travail", "labor", "marchand", "capital"] },
  // 5: Flux / Becoming / Metamorphosis (+) vs Crystal / Stasis / Form (-)
  { pos: ["flux", "flow", "devenir", "becom", "metamorph", "mouvement", "mov", "vague", "wave", "courant", "derive", "drift", "change", "mutat", "transit", "passag", "liquide", "fluide"],
    neg: ["cristal", "crystal", "fix", "stabl", "statu", "fige", "solid", "structur", "form", "cadre", "frame", "grille", "grid", "architec", "monument", "inert"] },
  // 6: Entropy / Chaos / Noise (+) vs Negentropy / Order / Simplicity (-)
  { pos: ["entrop", "chaos", "bruit", "nois", "desordr", "disord", "hasard", "random", "vertig", "abim", "abyss", "dissol", "fragment", "crise", "crash", "turbul"],
    neg: ["neguentrop", "negentrop", "ordre", "order", "simplic", "coheren", "harmon", "clarte", "clarity", "equilibr", "balanc", "symetr", "gestalt", "unite", "unity", "cosmos"] },
  // 7: Openness / Horizon (+) vs Closure / Boundary (-)
  { pos: ["ouvert", "open", "horizon", "infini", "infin", "liberte", "espace", "space", "dehors", "outsid", "possible", "potentiel", "potential", "futur", "avenir", "lointain"],
    neg: ["clotur", "closur", "ferm", "clos", "fronti", "boundar", "mur", "wall", "limite", "limit", "membran", "enclos", "prison", "dedans", "insid", "seuil", "threshold"] },
  // 8: Mirror / Perception / Visibility (+) vs Opacity / Shadow / Hidden (-)
  { pos: ["miroir", "mirror", "regard", "gaze", "vision", "optiq", "optic", "anoptiq", "anoptic", "lumier", "light", "transpar", "reflet", "reflect", "visible", "voir", "see", "observ", "spectr"],
    neg: ["opac", "ombre", "shadow", "nuit", "night", "cache", "hidden", "secret", "aveugl", "blind", "invisible", "obscur", "voile", "veil", "brume", "fog"] },
  // 9: Speech / Language / Sign (+) vs Silence / Listening (-)
  { pos: ["parol", "speech", "mot", "word", "lang", "voix", "voic", "discours", "text", "ecrit", "writ", "signe", "sign", "symbol", "dialog", "nommer", "name", "recit", "narrat"],
    neg: ["silenc", "ecout", "listen", "muet", "mute", "vide", "void", "pause", "soupir", "indicibl", "tacit", "calme", "quiet"] },
  // 10: Memory / Trace / Archive (+) vs Forgetting / Ephemeral (-)
  { pos: ["memoir", "memor", "trace", "archiv", "pass", "histoir", "histor", "heritag", "retent", "souvenir", "empreint", "imprint", "sediment", "fossile"],
    neg: ["oubli", "forget", "ephemer", "instant", "fugac", "effac", "eras", "amnes", "dispar", "vanish", "neuf", "nouveau", "new"] },
  // 11: Time / Rhythm / Kairos (+) vs Space / Topology (-)
  { pos: ["temps", "time", "rythm", "rhythm", "duree", "durat", "tempo", "puls", "battement", "beat", "cycle", "saison", "chron", "kairos", "synchron", "vitesse", "speed", "lenteur", "slow"],
    neg: ["espac", "space", "lieu", "place", "topolog", "geometr", "carte", "map", "territoir", "spirale", "spiral", "centre", "center", "champ", "field", "plan"] },
  // 12: Emergence / Metastability / Bifurcation (+) vs Determinism / Repetition (-)
  { pos: ["emergen", "metastab", "bifurc", "autopoie", "auto-org", "surpris", "evenement", "event", "ruptur", "saut", "leap", "phase", "seuil", "phase", "transduct", "genese", "morphogen"],
    neg: ["repetit", "habitud", "habit", "routin", "determin", "predict", "banal", "cliche", "conform", "mimeti", "copie", "copy", "clone"] },
  // 13: Care / Ethics / Pharmakon-Cure (+) vs Alienation / Poison (-)
  { pos: ["soin", "care", "ethiq", "ethic", "ergonom", "hospital", "ecolog", "attention", "presenc", "tendress", "justic", "dignit", "remed", "cure", "therap", "pharmak"],
    neg: ["alienat", "proletar", "poison", "captur", "addict", "extract", "exploit", "violenc", "epuis", "burnout", "usure", "destruc", "toxiqu"] },
  // 14: Affect / Desire / Resonance (+) vs Cold / Detachment (-)
  { pos: ["desir", "affect", "emot", "resonanc", "vibrat", "chaleur", "warm", "passion", "joie", "joy", "elan", "intensit", "sympath", "empath", "amour", "love", "peur", "fear"],
    neg: ["froid", "cold", "indiffer", "neutr", "distant", "detach", "abstrait", "abstract", "cliniqu", "sec", "dry"] },
  // 15: Questioning / Critique / Doubt (+) vs Dogma / Certainty (-)
  { pos: ["question", "doute", "doubt", "critiq", "enigme", "myster", "hypothes", "explor", "cherch", "search", "interrog", "paradox", "tension", "dialectiq", "dialect", "debat"],
    neg: ["dogm", "certitud", "certain", "verite", "truth", "axiom", "absolu", "absolut", "loi", "law", "doxa", "consensus", "evidenc"] },
  // 16: Local / Micro (+) vs Global / Macro (-)
  { pos: ["local", "micro", "cellul", "cell", "pixel", "detail", "grain", "atome", "point", "proxim", "voisin", "neighbor", "intime", "intimat"],
    neg: ["global", "macro", "monde", "world", "total", "univers", "planeta", "cosmos", "ensemble", "tout", "whole", "meta"] },
  // 17: Bridge / Mediation / Transduction (+) vs Fracture / Wall (-)
  { pos: ["pont", "bridg", "passeur", "mediat", "traduc", "translat", "transduct", "interfac", "articul", "coutur", "tiss", "weav", "hybride", "hybrid", "synth"],
    neg: ["fractur", "faill", "fault", "coupure", "split", "schism", "guerre", "war", "oppos", "conflit", "conflict", "ruptur", "mur", "clash"] },
  // 18: Depth / Underground / Root (+) vs Surface / Display (-)
  { pos: ["profond", "depth", "racin", "root", "source", "origine", "origin", "fond", "subterr", "socle", "essenc", "noyau", "core", "germe", "seed"],
    neg: ["surfac", "ecran", "screen", "peau", "façade", "apparen", "spectacl", "image", "reflet", "pixel", "vernis"] },
  // 19: Lightness / Air / Flight (+) vs Gravity / Weight (-)
  { pos: ["leger", "light", "air", "souffl", "vol", "flight", "nuage", "cloud", "oiseau", "bird", "ether", "flott", "float", "suspend"],
    neg: ["gravit", "poids", "weight", "lourd", "heavy", "chute", "fall", "ancre", "anchor", "terre", "dense", "inerte"] },
  // 20: Plurality / Difference (+) vs Sameness / Uniformity (-)
  { pos: ["plural", "differen", "divers", "heterogen", "multipl", "polyphon", "varie", "nuanc", "alterit", "other", "autre", "etrang"],
    neg: ["homogen", "uniform", "identiq", "meme", "same", "moyen", "averag", "lisse", "smooth", "standard", "unique", "mono"] },
  // 21: Sacred / Myth / Ritual (+) vs Profane / Instrumental (-)
  { pos: ["mythe", "myth", "rituel", "ritual", "sacre", "sacred", "symbol", "oracle", "cosmos", "spirit", "ame", "soul", "transcend"],
    neg: ["banal", "quotidien", "daily", "outil", "tool", "pratiq", "practic", "fonction", "funct", "bureau", "offic"] },
  // 22: Gesture / Craft / Making (+) vs Consumption / Passive (-)
  { pos: ["artisan", "craft", "faire", "mak", "fabriq", "atelier", "workshop", "main", "hand", "sculp", "dessin", "draw", "tramer", "construi"],
    neg: ["consomm", "consum", "passif", "passiv", "scroll", "flux", "spectateur", "viewer", "client", "usager"] },
  // 23: Recursion / Loop / Feedback (+) vs Linear / One-way (-)
  { pos: ["recurs", "boucl", "loop", "feedback", "retroact", "spiral", "helice", "echo", "circul", "recipr", "mutuel", "mutual", "co-"],
    neg: ["lineair", "linear", "fleche", "arrow", "direct", "simple", "sens-unique", "hierarch", "pyramide", "vertical"] },
];

const NGRAM_DIMS = 32;

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeVec(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm < 1e-8) return vec;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}

export class SemanticEngine {
  constructor() {
    this.mode = "fast"; // "fast" | "loading" | "neural"
    this.fastCache = new Map();
    this.neuralCache = new Map();
    this.extractor = null;
    this.onStatusChange = null;
  }

  /**
   * Instant deterministic embedding (<1ms) combining 24 conceptual axes + 32 char n-gram dims.
   */
  embedFast(rawText) {
    const clean = normalizeText(rawText);
    if (!clean) return new Float32Array(SEMANTIC_AXES.length + NGRAM_DIMS);
    if (this.fastCache.has(clean)) return this.fastCache.get(clean);

    const vec = new Float32Array(SEMANTIC_AXES.length + NGRAM_DIMS);
    const tokens = clean.split(" ").filter(Boolean);

    let axisHits = 0;
    for (let a = 0; a < SEMANTIC_AXES.length; a++) {
      const axis = SEMANTIC_AXES[a];
      let score = 0;
      for (const tok of tokens) {
        for (const stem of axis.pos) {
          if (tok.startsWith(stem) || (stem.length >= 4 && tok.includes(stem))) {
            score += 1.0;
            axisHits++;
            break;
          }
        }
        for (const stem of axis.neg) {
          if (tok.startsWith(stem) || (stem.length >= 4 && tok.includes(stem))) {
            score -= 1.0;
            axisHits++;
            break;
          }
        }
      }
      vec[a] = score * 1.45;
    }

    // Morphological character 3-gram & 4-gram projection so unseen words with shared roots cluster naturally
    const ngramWeight = axisHits > 0 ? 0.32 : 0.85;
    for (const tok of tokens) {
      const padded = `^${tok}$`;
      for (let n = 3; n <= 4; n++) {
        for (let i = 0; i <= padded.length - n; i++) {
          const gram = padded.slice(i, i + n);
          const h = hashString(gram);
          const idx = SEMANTIC_AXES.length + (h % NGRAM_DIMS);
          const sign = (h & 1) === 0 ? 1 : -1;
          vec[idx] += sign * ngramWeight;
        }
      }
    }

    // Slight deterministic perturbation if completely degenerate
    if (axisHits === 0 && clean.length < 3) {
      const h = hashString(clean);
      vec[h % SEMANTIC_AXES.length] += 0.5;
    }

    const normed = normalizeVec(vec);
    if (this.fastCache.size > 1500) this.fastCache.clear();
    this.fastCache.set(clean, normed);
    return normed;
  }

  /**
   * Synchronous retrieval: returns neural vector if cached & neural mode active, else fast vector.
   */
  embedSync(rawText) {
    const clean = normalizeText(rawText);
    if (this.mode === "neural" && this.neuralCache.has(clean)) {
      return this.neuralCache.get(clean);
    }
    return this.embedFast(clean);
  }

  /**
   * Async embedding: uses browser-native neural model if active, otherwise fast engine.
   */
  async embed(rawText) {
    const clean = normalizeText(rawText);
    if (!clean) return this.embedFast("");

    if (this.mode === "neural" && this.extractor) {
      if (this.neuralCache.has(clean)) return this.neuralCache.get(clean);
      try {
        const output = await this.extractor(clean, { pooling: "mean", normalize: true });
        const arr = new Float32Array(output.data);
        if (this.neuralCache.size > 1000) this.neuralCache.clear();
        this.neuralCache.set(clean, arr);
        return arr;
      } catch (err) {
        console.warn("Neural embed fallback:", err);
        return this.embedFast(clean);
      }
    }
    return this.embedFast(clean);
  }

  /**
   * Dynamically loads @xenova/transformers in the browser for true multilingual neural embeddings.
   */
  async enableNeural(onProgress) {
    if (this.mode === "neural" && this.extractor) return true;
    if (this.mode === "loading") return false;

    this.mode = "loading";
    if (this.onStatusChange) this.onStatusChange("loading", 0);

    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;

      this.extractor = await mod.pipeline(
        "feature-extraction",
        "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
        {
          quantized: true,
          progress_callback: (info) => {
            if (info && typeof info.progress === "number") {
              if (onProgress) onProgress(Math.round(info.progress));
              if (this.onStatusChange) this.onStatusChange("loading", Math.round(info.progress));
            }
          },
        }
      );

      this.mode = "neural";
      if (this.onStatusChange) this.onStatusChange("neural", 100);
      return true;
    } catch (err) {
      console.warn("Unable to load browser-native neural embeddings:", err);
      this.mode = "fast";
      if (this.onStatusChange) this.onStatusChange("fast", 0);
      return false;
    }
  }

  /**
   * Computes resonance & dialectical tension between two noetic cells.
   * Crucially distinguishes semantic proximity from contradiction/opposition!
   */
  computeRelation(cellA, cellB) {
    const cleanA = normalizeText(cellA.term);
    const cleanB = normalizeText(cellB.term);
    if (!cleanA || !cleanB) {
      return { resonance: 0, tension: 0, type: "neutral" };
    }

    const vecA = cellA.embedding || this.embedSync(cleanA);
    const vecB = cellB.embedding || this.embedSync(cleanB);
    const sim = cosineSimilarity(vecA, vecB);

    // 1. Check explicit dialectical polarity pairs
    let lexicalPolarity = 0;
    const toksA = cleanA.split(" ");
    const toksB = cleanB.split(" ");
    for (const [p1, p2] of POLARITY_PAIRS) {
      const a1 = toksA.some((t) => t.startsWith(p1));
      const b2 = toksB.some((t) => t.startsWith(p2));
      const a2 = toksA.some((t) => t.startsWith(p2));
      const b1 = toksB.some((t) => t.startsWith(p1));
      if ((a1 && b2) || (a2 && b1)) {
        lexicalPolarity = 0.88;
        break;
      }
    }

    // 2. Check conceptual axis opposition on fast basis (always available as an NLI-lite polarity check)
    const fastA = this.embedFast(cleanA);
    const fastB = this.embedFast(cleanB);
    let axisOpposition = 0;
    for (let i = 0; i < SEMANTIC_AXES.length; i++) {
      const prod = fastA[i] * fastB[i];
      if (prod < -0.05) {
        axisOpposition += Math.abs(prod);
      }
    }
    axisOpposition = Math.min(1, axisOpposition * 1.9);

    // 3. Epistemic stance interaction (Simondonian/dialectical operator)
    // If one cell NEGATES a semantically close concept that another ASSERTS -> acute tension!
    let stanceTension = 0;
    let bridgeBoost = 0;
    const sA = cellA.stance || "assert";
    const sB = cellB.stance || "assert";
    const posSim = Math.max(0, sim);

    if ((sA === "negate" && sB !== "negate") || (sB === "negate" && sA !== "negate")) {
      if (posSim > 0.25 || cleanA === cleanB) {
        stanceTension = Math.min(1, 0.45 + posSim * 0.55);
      }
    }
    if ((sA === "question" && sB === "assert") || (sB === "question" && sA === "assert")) {
      if (posSim > 0.45) {
        stanceTension = Math.max(stanceTension, 0.28 + posSim * 0.22);
      }
    }
    if (sA === "bridge" || sB === "bridge") {
      bridgeBoost = 0.14;
    }

    const tension = Math.min(1, Math.max(lexicalPolarity, axisOpposition * 0.85, stanceTension));

    // Resonance is high when vectors align AND they aren't directly negating each other
    let resonance = Math.max(0, sim + bridgeBoost);
    if (cleanA === cleanB && sA === sB) resonance = 0.96;
    if (tension > 0.55) {
      resonance *= Math.max(0.15, 1 - tension * 0.8);
    }

    let type = "neutral";
    if (tension >= 0.48 && tension >= resonance * 0.82) {
      type = "tension";
    } else if (resonance >= 0.34) {
      type = sA === "bridge" || sB === "bridge" ? "bridge" : "resonance";
    }

    return {
      resonance: Number(resonance.toFixed(3)),
      tension: Number(tension.toFixed(3)),
      type,
    };
  }
}
