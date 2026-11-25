// Layer 1: Hybrid Semantic Engine (v2)
// - 24 interpretable bilingual semantic axes with explicit pole names (for emergent PCA compass & Noème mirror)
// - Deterministic perceptual chromatic signature (hue) per conceptual orientation
// - Instant mode (<2ms) + optional browser-native neural embeddings via @xenova/transformers

import { POLARITY_PAIRS, normalizeText } from "./i18n.js?v=2";

// 24 conceptual semantic dimensions (each maps stems/roots -> signed weights)
export const SEMANTIC_AXES = [
  // 0
  {
    name: { fr: ["autonomie", "automatisme"], en: ["autonomy", "automatism"] },
    hue: 192,
    pos: ["autonom", "liber", "emancip", "choi", "volont", "jugement", "critiq", "resist", "souverain", "agency", "free", "judg"],
    neg: ["automat", "contr", "algorith", "servit", "serv", "obed", "soumis", "domina", "calcul", "optimis", "productiv", "norm", "regl"],
  },
  // 1
  {
    name: { fr: ["collectif", "singulier"], en: ["collective", "singular"] },
    hue: 215,
    pos: ["collectif", "collectiv", "transindivid", "commun", "reseau", "network", "partag", "lien", "relier", "relat", "ensemble", "social", "milieu", "nous", "swarm", "essaim", "symbios"],
    neg: ["singul", "individu", "seul", "solit", "moi", "ego", "isol", "monad", "prive", "self", "alone"],
  },
  // 2
  {
    name: { fr: ["technique", "corps vivant"], en: ["technics", "living body"] },
    hue: 162,
    pos: ["techniq", "technic", "technolog", "machin", "numer", "digit", "code", "calcul", "cyber", "interface", "outil", "tool", "robot", "ia", "ai", "system", "matrice", "matrix"],
    neg: ["corps", "body", "vivant", "living", "chair", "flesh", "organ", "biolog", "souffl", "breath", "peau", "main", "hand", "geste", "gestur", "sensibl", "animal", "terre", "earth"],
  },
  // 3
  {
    name: { fr: ["noèse", "matière"], en: ["noesis", "matter"] },
    hue: 235,
    pos: ["noes", "noet", "pense", "thought", "esprit", "mind", "concept", "idee", "idea", "sens", "mean", "savoir", "knowledg", "conscien", "raison", "reason", "dianoia", "logos", "intellig"],
    neg: ["matier", "matter", "pierre", "stone", "objet", "object", "physiq", "masse", "poids", "sol", "ground", "beton", "fer", "metal"],
  },
  // 4
  {
    name: { fr: ["poïèse", "utilitarisme"], en: ["poiesis", "utility"] },
    hue: 278,
    pos: ["poies", "poiet", "art", "esthet", "aesthet", "beaute", "beauty", "jeu", "play", "oeuvr", "crea", "invent", "imagin", "fict", "musiq", "danse", "chant", "poeme", "style"],
    neg: ["produit", "product", "util", "rendement", "profit", "marche", "market", "industr", "usine", "factory", "efficac", "travail", "labor", "marchand", "capital"],
  },
  // 5
  {
    name: { fr: ["flux", "cristal"], en: ["flux", "crystal"] },
    hue: 178,
    pos: ["flux", "flow", "devenir", "becom", "metamorph", "mouvement", "mov", "vague", "wave", "courant", "derive", "drift", "change", "mutat", "transit", "passag", "liquide", "fluide"],
    neg: ["cristal", "crystal", "fix", "stabl", "statu", "fige", "solid", "structur", "form", "cadre", "frame", "grille", "grid", "architec", "monument", "inert"],
  },
  // 6
  {
    name: { fr: ["entropie", "néguentropie"], en: ["entropy", "negentropy"] },
    hue: 342,
    pos: ["entrop", "chaos", "bruit", "nois", "desordr", "disord", "hasard", "random", "vertig", "abim", "abyss", "dissol", "fragment", "crise", "crash", "turbul"],
    neg: ["neguentrop", "negentrop", "ordre", "order", "simplic", "coheren", "harmon", "clarte", "clarity", "equilibr", "balanc", "symetr", "gestalt", "unite", "unity", "cosmos"],
  },
  // 7
  {
    name: { fr: ["ouverture", "clôture"], en: ["openness", "closure"] },
    hue: 148,
    pos: ["ouvert", "open", "horizon", "infini", "infin", "liberte", "espace", "space", "dehors", "outsid", "possible", "potentiel", "potential", "futur", "avenir", "lointain"],
    neg: ["clotur", "closur", "ferm", "clos", "fronti", "boundar", "mur", "wall", "limite", "limit", "membran", "enclos", "prison", "dedans", "insid", "seuil", "threshold"],
  },
  // 8
  {
    name: { fr: ["miroir anoptique", "opacité"], en: ["anoptical mirror", "opacity"] },
    hue: 204,
    pos: ["miroir", "mirror", "regard", "gaze", "vision", "optiq", "optic", "anoptiq", "anoptic", "lumier", "light", "transpar", "reflet", "reflect", "visible", "voir", "see", "observ", "spectr"],
    neg: ["opac", "ombre", "shadow", "nuit", "night", "cache", "hidden", "secret", "aveugl", "blind", "invisible", "obscur", "voile", "veil", "brume", "fog"],
  },
  // 9
  {
    name: { fr: ["parole", "silence"], en: ["speech", "silence"] },
    hue: 42,
    pos: ["parol", "speech", "mot", "word", "lang", "voix", "voic", "discours", "text", "ecrit", "writ", "signe", "sign", "symbol", "dialog", "nommer", "name", "recit", "narrat"],
    neg: ["silenc", "ecout", "listen", "muet", "mute", "vide", "void", "pause", "soupir", "indicibl", "tacit", "calme", "quiet"],
  },
  // 10
  {
    name: { fr: ["mémoire", "oubli"], en: ["memory", "forgetting"] },
    hue: 260,
    pos: ["memoir", "memor", "trace", "archiv", "pass", "histoir", "histor", "heritag", "retent", "souvenir", "empreint", "imprint", "sediment", "fossile"],
    neg: ["oubli", "forget", "ephemer", "instant", "fugac", "effac", "eras", "amnes", "dispar", "vanish", "neuf", "nouveau", "new"],
  },
  // 11
  {
    name: { fr: ["rythme", "topologie"], en: ["rhythm", "topology"] },
    hue: 32,
    pos: ["temps", "time", "rythm", "rhythm", "duree", "durat", "tempo", "puls", "battement", "beat", "cycle", "saison", "chron", "kairos", "synchron", "vitesse", "speed", "lenteur", "slow"],
    neg: ["espac", "space", "lieu", "place", "topolog", "geometr", "carte", "map", "territoir", "spirale", "spiral", "centre", "center", "champ", "field", "plan"],
  },
  // 12
  {
    name: { fr: ["émergence", "répétition"], en: ["emergence", "repetition"] },
    hue: 132,
    pos: ["emergen", "metastab", "bifurc", "autopoie", "auto-org", "surpris", "evenement", "event", "ruptur", "saut", "leap", "phase", "seuil", "transduct", "genese", "morphogen"],
    neg: ["repetit", "habitud", "habit", "routin", "determin", "predict", "banal", "cliche", "conform", "mimeti", "copie", "copy", "clone"],
  },
  // 13
  {
    name: { fr: ["soin & ergonomie", "aliénation"], en: ["care & ergonomics", "alienation"] },
    hue: 158,
    pos: ["soin", "care", "ethiq", "ethic", "ergonom", "hospital", "ecolog", "attention", "presenc", "tendress", "justic", "dignit", "remed", "cure", "therap", "pharmak"],
    neg: ["alienat", "proletar", "poison", "captur", "addict", "extract", "exploit", "violenc", "epuis", "burnout", "usure", "destruc", "toxiqu"],
  },
  // 14
  {
    name: { fr: ["résonance affective", "détachement"], en: ["affective resonance", "detachment"] },
    hue: 320,
    pos: ["desir", "affect", "emot", "resonanc", "vibrat", "chaleur", "warm", "passion", "joie", "joy", "elan", "intensit", "sympath", "empath", "amour", "love", "peur", "fear"],
    neg: ["froid", "cold", "indiffer", "neutr", "distant", "detach", "abstrait", "abstract", "cliniqu", "sec", "dry"],
  },
  // 15
  {
    name: { fr: ["critique & doute", "dogme"], en: ["critique & doubt", "dogma"] },
    hue: 248,
    pos: ["question", "doute", "doubt", "critiq", "enigme", "myster", "hypothes", "explor", "cherch", "search", "interrog", "paradox", "tension", "dialectiq", "dialect", "debat"],
    neg: ["dogm", "certitud", "certain", "verite", "truth", "axiom", "absolu", "absolut", "loi", "law", "doxa", "consensus", "evidenc"],
  },
  // 16
  {
    name: { fr: ["local", "global"], en: ["local", "global"] },
    hue: 188,
    pos: ["local", "micro", "cellul", "cell", "pixel", "detail", "grain", "atome", "point", "proxim", "voisin", "neighbor", "intime", "intimat"],
    neg: ["global", "macro", "monde", "world", "total", "univers", "planeta", "cosmos", "ensemble", "tout", "whole", "meta"],
  },
  // 17
  {
    name: { fr: ["médiation", "fracture"], en: ["mediation", "fracture"] },
    hue: 168,
    pos: ["pont", "bridg", "passeur", "mediat", "traduc", "translat", "transduct", "interfac", "articul", "coutur", "tiss", "weav", "hybride", "hybrid", "synth"],
    neg: ["fractur", "faill", "fault", "coupure", "split", "schism", "guerre", "war", "oppos", "conflit", "conflict", "ruptur", "mur", "clash"],
  },
  // 18
  {
    name: { fr: ["racine", "surface"], en: ["root", "surface"] },
    hue: 28,
    pos: ["profond", "depth", "racin", "root", "source", "origine", "origin", "fond", "subterr", "socle", "essenc", "noyau", "core", "germe", "seed"],
    neg: ["surfac", "ecran", "screen", "peau", "facade", "apparen", "spectacl", "image", "reflet", "pixel", "vernis"],
  },
  // 19
  {
    name: { fr: ["souffle", "gravité"], en: ["breath", "gravity"] },
    hue: 198,
    pos: ["leger", "light", "air", "souffl", "vol", "flight", "nuage", "cloud", "oiseau", "bird", "ether", "flott", "float", "suspend"],
    neg: ["gravit", "poids", "weight", "lourd", "heavy", "chute", "fall", "ancre", "anchor", "terre", "dense", "inerte"],
  },
  // 20
  {
    name: { fr: ["altérité", "uniformité"], en: ["alterity", "uniformity"] },
    hue: 294,
    pos: ["plural", "differen", "divers", "heterogen", "multipl", "polyphon", "varie", "nuanc", "alterit", "other", "autre", "etrang"],
    neg: ["homogen", "uniform", "identiq", "meme", "same", "moyen", "averag", "lisse", "smooth", "standard", "unique", "mono"],
  },
  // 21
  {
    name: { fr: ["mythe", "instrumental"], en: ["myth", "instrumental"] },
    hue: 268,
    pos: ["mythe", "myth", "rituel", "ritual", "sacre", "sacred", "symbol", "oracle", "cosmos", "spirit", "ame", "soul", "transcend"],
    neg: ["banal", "quotidien", "daily", "outil", "tool", "pratiq", "practic", "fonction", "funct", "bureau", "offic"],
  },
  // 22
  {
    name: { fr: ["geste créateur", "passivité"], en: ["creative gesture", "passivity"] },
    hue: 48,
    pos: ["artisan", "craft", "faire", "mak", "fabriq", "atelier", "workshop", "main", "hand", "sculp", "dessin", "draw", "tramer", "construi", "geste", "gestur"],
    neg: ["consomm", "consum", "passif", "passiv", "scroll", "spectateur", "viewer", "client", "usager"],
  },
  // 23
  {
    name: { fr: ["récursivité", "linéarité"], en: ["recursivity", "linearity"] },
    hue: 184,
    pos: ["recurs", "boucl", "loop", "feedback", "retroact", "spiral", "helice", "echo", "circul", "recipr", "mutuel", "mutual", "co-"],
    neg: ["lineair", "linear", "fleche", "arrow", "direct", "sens-unique", "hierarch", "pyramide", "vertical"],
  },
];

export const AXIS_COUNT = SEMANTIC_AXES.length;
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
   * Instant deterministic embedding (<1ms) combining 24 interpretable conceptual axes + 32 char n-gram dims.
   */
  embedFast(rawText) {
    const clean = normalizeText(rawText);
    if (!clean) return new Float32Array(AXIS_COUNT + NGRAM_DIMS);
    if (this.fastCache.has(clean)) return this.fastCache.get(clean);

    const vec = new Float32Array(AXIS_COUNT + NGRAM_DIMS);
    const tokens = clean.split(" ").filter(Boolean);

    let axisHits = 0;
    for (let a = 0; a < AXIS_COUNT; a++) {
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
      vec[a] = score * 1.5;
    }

    // Morphological character 3-gram & 4-gram projection
    const ngramWeight = axisHits > 0 ? 0.3 : 0.85;
    for (const tok of tokens) {
      const padded = `^${tok}$`;
      for (let n = 3; n <= 4; n++) {
        for (let i = 0; i <= padded.length - n; i++) {
          const gram = padded.slice(i, i + n);
          const h = hashString(gram);
          const idx = AXIS_COUNT + (h % NGRAM_DIMS);
          const sign = (h & 1) === 0 ? 1 : -1;
          vec[idx] += sign * ngramWeight;
        }
      }
    }

    if (axisHits === 0 && clean.length < 3) {
      const h = hashString(clean);
      vec[h % AXIS_COUNT] += 0.5;
    }

    const normed = normalizeVec(vec);
    if (this.fastCache.size > 1500) this.fastCache.clear();
    this.fastCache.set(clean, normed);
    return normed;
  }

  /**
   * Projects any concept onto the 24 interpretable axes (always available even in neural mode!).
   */
  getAxisVector(rawText) {
    const fast = this.embedFast(rawText);
    return fast.subarray(0, AXIS_COUNT);
  }

  /**
   * Computes a smooth, deterministic perceptual Hue (0..360) for any concept
   * so semantically aligned concepts radiate harmonious chromatic fields in terrain & mosaic modes.
   */
  conceptToHue(rawText, stance = "assert") {
    if (stance === "negate") return 348; // dialectical coral-crimson
    const axisVec = this.getAxisVector(rawText);
    let sx = 0;
    let sy = 0;
    let total = 0;
    for (let i = 0; i < AXIS_COUNT; i++) {
      const v = axisVec[i];
      if (Math.abs(v) < 0.04) continue;
      // Positive pole uses axis hue; negative pole shifts toward complementary hue
      const angleDeg = v >= 0 ? SEMANTIC_AXES[i].hue : (SEMANTIC_AXES[i].hue + 145) % 360;
      const rad = (angleDeg * Math.PI) / 180;
      const w = Math.abs(v);
      sx += Math.cos(rad) * w;
      sy += Math.sin(rad) * w;
      total += w;
    }
    if (total < 0.05) {
      const h = hashString(normalizeText(rawText) || "noesis");
      return 175 + (h % 140);
    }
    let deg = (Math.atan2(sy, sx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (stance === "bridge") {
      // Gently pull bridges toward emerald-teal
      deg = deg * 0.55 + 158 * 0.45;
    }
    return Math.round(deg) % 360;
  }

  /**
   * Describes an axis-space direction vector (length 24) as concise bilingual pole labels.
   */
  describeDirection(dir24, lang = "fr") {
    const scored = [];
    for (let i = 0; i < AXIS_COUNT; i++) {
      const val = dir24[i] || 0;
      if (Math.abs(val) > 0.08) {
        scored.push({ idx: i, val });
      }
    }
    scored.sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

    const posLabels = [];
    const negLabels = [];
    for (const item of scored.slice(0, 3)) {
      const pair = SEMANTIC_AXES[item.idx].name[lang] || SEMANTIC_AXES[item.idx].name.fr;
      if (item.val >= 0) {
        posLabels.push(pair[0]);
        negLabels.push(pair[1]);
      } else {
        posLabels.push(pair[1]);
        negLabels.push(pair[0]);
      }
    }

    return {
      pos: posLabels.slice(0, 2).join(" · ") || (lang === "fr" ? "ouverture" : "openness"),
      neg: negLabels.slice(0, 2).join(" · ") || (lang === "fr" ? "clôture" : "closure"),
      primaryPos: posLabels[0] || (lang === "fr" ? "émergence" : "emergence"),
      primaryNeg: negLabels[0] || (lang === "fr" ? "structure" : "structure"),
    };
  }

  embedSync(rawText) {
    const clean = normalizeText(rawText);
    if (this.mode === "neural" && this.neuralCache.has(clean)) {
      return this.neuralCache.get(clean);
    }
    return this.embedFast(clean);
  }

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

  computeRelation(cellA, cellB) {
    const cleanA = normalizeText(cellA.term);
    const cleanB = normalizeText(cellB.term);
    if (!cleanA || !cleanB) {
      return { resonance: 0, tension: 0, type: "neutral" };
    }

    const vecA = cellA.embedding || this.embedSync(cleanA);
    const vecB = cellB.embedding || this.embedSync(cleanB);
    const sim = cosineSimilarity(vecA, vecB);

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

    const fastA = this.embedFast(cleanA);
    const fastB = this.embedFast(cleanB);
    let axisOpposition = 0;
    for (let i = 0; i < AXIS_COUNT; i++) {
      const prod = fastA[i] * fastB[i];
      if (prod < -0.05) {
        axisOpposition += Math.abs(prod);
      }
    }
    axisOpposition = Math.min(1, axisOpposition * 1.9);

    let stanceTension = 0;
    let bridgeBoost = 0;
    const sA = cellA.stance || "assert";
    const sB = cellB.stance || "assert";
    const posSim = Math.max(0, sim);

    if ((sA === "negate" && sB !== "negate") || (sB === "negate" && sA !== "negate")) {
      if (posSim > 0.25 || cleanA === cleanB) {
        stanceTension = Math.min(1, 0.48 + posSim * 0.52);
      }
    }
    if ((sA === "question" && sB === "assert") || (sB === "question" && sA === "assert")) {
      if (posSim > 0.45) {
        stanceTension = Math.max(stanceTension, 0.30 + posSim * 0.22);
      }
    }
    if (sA === "bridge" || sB === "bridge") {
      bridgeBoost = 0.14;
    }

    const tension = Math.min(1, Math.max(lexicalPolarity, axisOpposition * 0.85, stanceTension));

    let resonance = Math.max(0, sim + bridgeBoost);
    if (cleanA === cleanB && sA === sB) resonance = 0.96;
    if (tension > 0.55) {
      resonance *= Math.max(0.15, 1 - tension * 0.8);
    }

    let type = "neutral";
    if (tension >= 0.46 && tension >= resonance * 0.80) {
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
