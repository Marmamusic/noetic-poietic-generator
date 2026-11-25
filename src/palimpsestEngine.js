// Layer 3 (v3): Morphogenetic Living Text Palimpsest Engine
// - Maintains an organic set of living sentences (emerging -> alive -> morphing -> lingering -> dissolved)
// - Native multi-provider LLM mirror: Google Gemini, OpenAI, OpenRouter, Groq, Local Ollama
// - Instant poetic-philosophical local fallback emitting identical incremental morphogenetic ops
//   so the text comes into focus, rearranges, morphs, lingers, and fades even before a key is entered

export const LLM_PRESETS = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    protocol: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    model: "gemini-2.5-flash",
    requiresKey: true,
    keyPlaceholder: "AIza...",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    protocol: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    requiresKey: true,
    keyPlaceholder: "sk-...",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    protocol: "openai",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "google/gemini-2.5-flash",
    requiresKey: true,
    keyPlaceholder: "sk-or-...",
  },
  groq: {
    id: "groq",
    label: "Groq",
    protocol: "openai",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    requiresKey: true,
    keyPlaceholder: "gsk_...",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (Local)",
    protocol: "openai",
    endpoint: "http://localhost:11434/v1/chat/completions",
    model: "llama3.2",
    requiresKey: false,
    keyPlaceholder: "(aucune clé requise)",
  },
};

export class PalimpsestEngine {
  constructor(topologyEngine, mirrorEngine) {
    this.topology = topologyEngine;
    this.mirror = mirrorEngine;

    this.sentences = []; // Array<SentenceNode>
    this._nextId = 1;
    this._localTemplateCursor = 0;

    // Contemplative timing & gestation parameters
    this.gestationDelayMs = 2600; // Deliberate delay before text begins morphing after a change
    this.lingerDurationMs = 12500; // How long fading sentences linger as pale palimpsest memory
    this.ambientIntervalMs = 9500; // Organic drift rhythm when swarm shifts topology

    this.isGestating = false;
    this._gestationTimer = null;
    this._lastPulseAt = 0;
    this._pendingTrigger = null;
    this._inFlight = false;

    // LLM provider configuration (stored safely in browser storage only when user opts in)
    this.llmEnabled = false;
    this.providerId = "gemini";
    this.config = {
      protocol: LLM_PRESETS.gemini.protocol,
      endpoint: LLM_PRESETS.gemini.endpoint,
      model: LLM_PRESETS.gemini.model,
      apiKey: "",
    };

    this.onChange = null; // callback(sentences, meta)
    this.onStatus = null; // callback(statusText, isLlmActive)
  }

  applyPreset(presetId) {
    const p = LLM_PRESETS[presetId] || LLM_PRESETS.gemini;
    this.providerId = p.id;
    this.config.protocol = p.protocol;
    this.config.endpoint = p.endpoint;
    this.config.model = p.model;
    return p;
  }

  /**
   * Seeds the opening emerging palimpsest immediately on load.
   */
  seedInitial(lang = "fr") {
    this.sentences = [];
    this._nextId = 1;
    const ops = this.generateLocalOps(lang, { initial: true });
    this.applyOps(ops, "local");
    this._lastPulseAt = performance.now();
  }

  /**
   * Schedules a contemplative delayed reorganization when a human edits their concept
   * or when the underlying topology undergoes a meaningful shift.
   */
  scheduleGestation(lang = "fr", trigger = null, immediate = false) {
    if (trigger) this._pendingTrigger = trigger;
    if (this._gestationTimer) clearTimeout(this._gestationTimer);

    const delay = immediate ? 180 : this.gestationDelayMs;
    this.isGestating = true;
    this._notifyChange();

    this._gestationTimer = setTimeout(() => {
      this._gestationTimer = null;
      this.pulse(lang);
    }, delay);
  }

  /**
   * Periodic tick from main loop: cleans up dissolved ghosts and triggers organic ambient morphs.
   */
  tick(now, lang = "fr") {
    let changed = false;

    // 1. Transition newly emerging / morphing sentences to calm "alive" state after animation settles
    for (const s of this.sentences) {
      if (s.status === "emerging" && now - s.bornAt > 2400) {
        s.status = "alive";
        changed = true;
      } else if (s.status === "morphing" && now - s.morphedAt > 2800) {
        s.status = "alive";
        s.prevText = null;
        changed = true;
      }
    }

    // 2. Expire lingering ghost sentences once their memory duration elapses
    const beforeLen = this.sentences.length;
    this.sentences = this.sentences.filter((s) => {
      if (s.status !== "lingering") return true;
      return now - s.fadingSince < this.lingerDurationMs;
    });
    if (this.sentences.length !== beforeLen) changed = true;

    if (changed) this._notifyChange();

    // 3. Ambient reorganization when underlying topology has drifted enough
    if (
      !this.isGestating &&
      !this._inFlight &&
      now - this._lastPulseAt > this.ambientIntervalMs &&
      this.topology.telemetry.totalDisplacement > 0.55
    ) {
      this.scheduleGestation(lang, { source: "topology" }, false);
    }
  }

  /**
   * Executes one morphogenetic pulse (via connected LLM if enabled, else instant local synthesizer).
   */
  async pulse(lang = "fr") {
    if (this._inFlight) return;
    this._inFlight = true;
    this.isGestating = true;
    this._lastPulseAt = performance.now();
    this.topology.telemetry.totalDisplacement = 0;

    const trigger = this._pendingTrigger;
    this._pendingTrigger = null;

    try {
      if (this.llmEnabled) {
        this._emitStatus(lang === "fr" ? "Réfraction LLM en cours…" : "LLM refraction focusing…", true);
        const ops = await this.generateLLMOps(lang, trigger);
        if (ops && ops.length > 0) {
          this.applyOps(ops, "llm");
          const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          this._emitStatus(
            lang === "fr" ? `Miroir LLM (${this.config.model}) · ${ts}` : `LLM Mirror (${this.config.model}) · ${ts}`,
            true
          );
          return;
        }
      }
      // Local poetic morphogenetic fallback
      const ops = this.generateLocalOps(lang, { trigger });
      this.applyOps(ops, "local");
    } catch (err) {
      console.warn("Palimpsest LLM pulse fell back to local synthesizer:", err);
      this._emitStatus(`Fallback local (${err.message})`, false);
      const ops = this.generateLocalOps(lang, { trigger });
      this.applyOps(ops, "local");
    } finally {
      this._inFlight = false;
      this.isGestating = false;
      this._notifyChange();
    }
  }

  /**
   * Applies incremental morphogenetic operations (keep / morph / emerge / fade)
   * while preserving stable sentence IDs so DOM nodes smoothly rearrange via FLIP animation.
   */
  applyOps(ops, origin = "local") {
    const now = performance.now();
    const byId = new Map(this.sentences.map((s) => [s.id, s]));
    const activeOrder = [];

    for (const op of ops) {
      if (!op || !op.action) continue;
      const action = op.action.toLowerCase();

      if (action === "fade" && op.id && byId.has(op.id)) {
        const node = byId.get(op.id);
        if (node.status !== "lingering") {
          node.status = "lingering";
          node.fadingSince = now;
        }
        continue;
      }

      if (action === "keep" && op.id && byId.has(op.id)) {
        const node = byId.get(op.id);
        if (node.status === "lingering") {
          node.status = "emerging";
          node.bornAt = now;
          node.fadingSince = null;
        }
        if (Array.isArray(op.anchors) && op.anchors.length) {
          node.anchors = op.anchors.slice(0, 4);
        }
        node.order = typeof op.order === "number" ? op.order : activeOrder.length;
        activeOrder.push(node);
        continue;
      }

      if (action === "morph" && op.id && byId.has(op.id) && op.text) {
        const node = byId.get(op.id);
        const cleanText = String(op.text).trim();
        if (cleanText && cleanText !== node.text) {
          node.prevText = node.text;
          node.text = cleanText;
          node.status = "morphing";
          node.morphedAt = now;
          node.fadingSince = null;
          node.origin = origin;
        }
        if (Array.isArray(op.anchors) && op.anchors.length) {
          node.anchors = op.anchors.slice(0, 4);
        }
        if (op.role) node.role = op.role;
        node.order = typeof op.order === "number" ? op.order : activeOrder.length;
        activeOrder.push(node);
        continue;
      }

      if (action === "emerge" && op.text) {
        const cleanText = String(op.text).trim();
        if (!cleanText) continue;
        const node = {
          id: `s${this._nextId++}`,
          text: cleanText,
          prevText: null,
          anchors: Array.isArray(op.anchors) ? op.anchors.slice(0, 4) : [],
          role: op.role || "body",
          status: "emerging",
          origin,
          order: typeof op.order === "number" ? op.order : activeOrder.length,
          bornAt: now,
          morphedAt: now,
          fadingSince: null,
        };
        this.sentences.push(node);
        byId.set(node.id, node);
        activeOrder.push(node);
      }
    }

    // Keep live sentence count organic (4..6 active + up to 3 lingering memory traces)
    const active = this.sentences
      .filter((s) => s.status !== "lingering")
      .sort((a, b) => a.order - b.order);

    while (active.length > 6) {
      const oldest = active.pop();
      oldest.status = "lingering";
      oldest.fadingSince = now;
    }

    // Limit lingering traces to 3 most recent so the palimpsest stays breathable
    const lingering = this.sentences
      .filter((s) => s.status === "lingering")
      .sort((a, b) => (b.fadingSince || 0) - (a.fadingSince || 0))
      .slice(0, 3);

    // Reassemble: active sentences in their rearranged order, lingering ghosts gently interwoven or trailing
    this.sentences = [...active, ...lingering];
    this._notifyChange();
  }

  /**
   * Calls the configured LLM (Gemini native REST OR OpenAI-compatible Chat Completions)
   * with the current palimpsest and live underlying noetic topology.
   */
  async generateLLMOps(lang, trigger) {
    const endpoint = (this.config.endpoint || "").trim();
    const model = (this.config.model || "").trim();
    const apiKey = (this.config.apiKey || "").trim();
    const protocol = this.config.protocol || "openai";

    const isLocal = endpoint.includes("localhost") || endpoint.includes("127.0.0.1");
    if (!isLocal && !apiKey) {
      throw new Error(lang === "fr" ? "Clé API requise" : "API key required");
    }

    const cells = Array.from(this.topology.cells.values());
    const humanCells = cells
      .filter((c) => c.isHuman)
      .map((c) => ({ term: c.term, stance: c.stance, weight: c.intensity || 1.0 }));
    const fieldCells = cells
      .filter((c) => !c.isHuman)
      .slice(0, 16)
      .map((c) => `${c.term}${c.stance !== "assert" ? ` (${c.stance})` : ""}`);

    const snapshot = {
      language: lang === "fr" ? "French" : "English",
      phase: this.topology.telemetry.phase,
      metastability: this.topology.telemetry.metastability,
      emergent_compass: this.topology.compass,
      human_cells: humanCells,
      recent_trigger: trigger || null,
      collective_cells: fieldCells,
      emergent_basins: this.mirror.basins.map((b) => ({
        regime: b.label,
        terms: b.members.map((m) => m.term),
      })),
      dialectical_tensions: this.mirror.axes.map((a) => a.label),
      current_palimpsest: this.sentences
        .filter((s) => s.status !== "lingering")
        .map((s, idx) => ({ id: s.id, order: idx, text: s.text, anchors: s.anchors })),
    };

    const systemPrompt = [
      "You are NOT an assistant, chatbot, or summarizer.",
      "You are the emerging collective text of a Noetic Poietic Generator (inspired by Olivier Auber's Poietic Generator and Gilbert Simondon's transindividuation).",
      "Your task is to gradually evolve a living literary-philosophical palimpsest of 4 to 5 concise sentences (10–24 words each) that comes into focus, rearranges, morphs, and dissolves in response to the shifting underlying noetic topology.",
      "Strict Aesthetic & Epistemic Rules:",
      "- NEVER address a user, NEVER explain the tool, NEVER write meta-commentary like 'The group thinks...'.",
      "- Write directly from inside the emergent collective thought—luminous, tactile, philosophically incisive prose.",
      "- Preserve dialectical tensions; do NOT flatten oppositions into bland consensus.",
      "- Always integrate newly changed human_cells naturally into the evolving phrasing.",
      "- Prefer gradual metamorphosis over full rewrites: keep 1–3 sentences (optionally reordering them), morph 1–2 sentences whose meaning is bending, emerge 1–2 new sentences, and fade 1–2 sentences whose anchors have drifted.",
      `- Write strictly in ${lang === "fr" ? "French" : "English"}.`,
      "- Respond ONLY with valid JSON:",
      '  {"ops":[{"action":"keep|morph|emerge|fade","id":"s1 (required for keep/morph/fade)","text":"sentence (for morph/emerge)","anchors":["concept1","concept2"],"role":"opening|body|tension|question","order":0}]}',
    ].join("\n");

    let rawContent = "";

    if (protocol === "gemini") {
      const url = `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(snapshot) }] }],
          generationConfig: {
            temperature: 0.78,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Gemini HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 80)}` : ""}`);
      }
      const data = await res.json();
      rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      if (this.providerId === "openrouter") {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "Noetic Poietic Generator";
      }

      const body = {
        model,
        temperature: 0.78,
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(snapshot) },
        ],
      };
      // OpenAI, OpenRouter, Groq support json_object; Ollama local may prefer plain JSON instruction
      if (!isLocal) {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 80)}` : ""}`);
      }
      const data = await res.json();
      rawContent = data.choices?.[0]?.message?.content || "";
    }

    const parsed = this.extractJSON(rawContent);
    if (!parsed || !Array.isArray(parsed.ops)) {
      throw new Error("Invalid JSON ops from LLM");
    }
    return parsed.ops;
  }

  extractJSON(raw) {
    const trimmed = String(raw || "").trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      return null;
    }
  }

  /**
   * Instant poetic-philosophical local morphogenetic synthesizer.
   * Mirrors the exact keep / morph / emerge / fade / rearrange lifecycle until an LLM is connected.
   */
  generateLocalOps(lang = "fr", { initial = false, trigger = null } = {}) {
    const cells = Array.from(this.topology.cells.values());
    const human = cells.find((c) => c.isLocal) || cells.find((c) => c.isHuman) || cells[0];
    const hTerm = trigger?.term || human?.term || (lang === "fr" ? "transindividuation" : "transindividuation");
    const hStance = trigger?.stance || human?.stance || "assert";

    const compass = this.topology.compass;
    const basins = this.mirror.basins;
    const axes = this.mirror.axes;
    const phase = this.topology.telemetry.phase;

    const topBasin = basins[0]?.regimePrimary || compass.east;
    const secondBasin = basins[1]?.regimePrimary || compass.west;
    const b1Term = basins[0]?.members?.[0]?.term || cells[1]?.term || hTerm;
    const b2Term = basins[1]?.members?.[0]?.term || cells[2]?.term || secondBasin;
    const fault = axes[0]?.label || `${compass.west} ↔ ${compass.east}`;

    const poolFR = {
      assert: [
        `Dans la trame qui s’éveille autour de « ${hTerm} », le champ cherche une consistance sans se figer en système.`,
        `À mesure que « ${hTerm} » s’ancre dans le milieu, l’horizon de ${topBasin} infléchit silencieusement la gravité commune.`,
        `Ce qui affleure entre « ${hTerm} » et « ${b1Term} » n’appartient à personne : une forme transindividuelle prend corps.`,
      ],
      question: [
        `Quel seuil s’ouvre lorsque « ${hTerm} » demeure en suspens face à l’attraction de ${topBasin} ?`,
        `Interroger « ${hTerm} » empêche le milieu de se clore et ravive la respiration entre ${compass.west} et ${compass.east}.`,
      ],
      negate: [
        `En refusant « ${hTerm} », une faille nette tranche le consensus et force l’espace noétique à se reconfigurer.`,
        `La résistance portée contre « ${hTerm} » creuse un contre-champ où ${secondBasin} reprend droit de cité.`,
      ],
      bridge: [
        `Jeté comme un passeur, « ${hTerm} » tisse une couture fragile entre ${topBasin} et ${secondBasin}.`,
        `Par la médiation de « ${hTerm} », deux bassins étrangers commencent à résonner sans effacer leur écart.`,
      ],
      tension: [
        `La ligne de tension ${fault} empêche la pensée commune de s’affaisser dans la répétition.`,
        `Sous la surface, « ${b1Term} » et « ${b2Term} » maintiennent une métastabilité féconde qui appelle un déplacement.`,
        `Aucun centre ne commande : l’écart entre ${compass.north} et ${compass.south} redistribue les voisinages.`,
      ],
      phase: {
        diffuse: `Encore pré-individuel, le champ tâtonne entre fragments épars avant qu’un contour partagé n’émerge.`,
        metastable: `L’équilibre demeure métastable — assez structuré pour faire sens, assez tendu pour bifurquer d’un seul mot.`,
        crystallizing: `Un foyer de simplicité inattendue se cristallise autour de ${topBasin}, prêt à basculer au prochain geste.`,
        polarized: `Deux pôles se font face le long de ${fault}, dessinant un espace dramatique où chaque terme pèse double.`,
      },
    };

    const poolEN = {
      assert: [
        `Across the field gathering around “${hTerm}”, shared thought seeks coherence without hardening into dogma.`,
        `As “${hTerm}” deepens its pull, the horizon of ${topBasin} quietly tilts the collective frame.`,
        `What crystallizes between “${hTerm}” and “${b1Term}” belongs to no single mind—a transindividual figure comes into focus.`,
      ],
      question: [
        `What threshold opens when “${hTerm}” remains suspended against the gravity of ${topBasin}?`,
        `Holding “${hTerm}” as an open question keeps the milieu porous between ${compass.west} and ${compass.east}.`,
      ],
      negate: [
        `Pushing back against “${hTerm}” carves a clean fault line through premature consensus.`,
        `Resistance to “${hTerm}” opens a counter-valley where ${secondBasin} reclaims its tension.`,
      ],
      bridge: [
        `Thrown across the gap, “${hTerm}” weaves a fragile seam between ${topBasin} and ${secondBasin}.`,
        `Through the mediation of “${hTerm}”, distant basins begin to resonate without erasing their difference.`,
      ],
      tension: [
        `The dialectical ridge ${fault} keeps collective thought from flattening into repetition.`,
        `Beneath the surface, “${b1Term}” and “${b2Term}” sustain a fertile metastability awaiting the next gesture.`,
        `No center dictates the form: the span between ${compass.north} and ${compass.south} continually reorders proximity.`,
      ],
      phase: {
        diffuse: `Still pre-individual, the field feels across scattered fragments before a shared contour takes hold.`,
        metastable: `Equilibrium stays metastable—coherent enough to carry meaning, taut enough to bifurcate on a single word.`,
        crystallizing: `A basin of unexpected simplicity crystallizes around ${topBasin}, poised to tip at the next inflection.`,
        polarized: `Two poles confront one another along ${fault}, charging every new concept with structural leverage.`,
      },
    };

    const P = lang === "fr" ? poolFR : poolEN;
    const pick = (arr) => arr[this._localTemplateCursor++ % arr.length];
    const stanceLines = P[hStance] || P.assert;

    if (initial || this.sentences.filter((s) => s.status !== "lingering").length === 0) {
      return [
        { action: "emerge", text: pick(stanceLines), anchors: [hTerm, b1Term], role: "opening", order: 0 },
        { action: "emerge", text: pick(P.tension), anchors: [b1Term, b2Term], role: "tension", order: 1 },
        { action: "emerge", text: P.phase[phase] || P.phase.metastable, anchors: [b1Term], role: "body", order: 2 },
        {
          action: "emerge",
          text: pick(P.question),
          anchors: [hTerm],
          role: "question",
          order: 3,
        },
      ];
    }

    // Incremental morphogenetic reorganization of existing active sentences!
    const active = this.sentences.filter((s) => s.status !== "lingering");
    const ops = [];

    // 1. Fade the oldest trailing sentence so memory lingers and dissolves
    const toFade = active.length >= 4 ? active[active.length - 1] : null;
    const survivors = toFade ? active.slice(0, -1) : [...active];
    if (toFade) {
      ops.push({ action: "fade", id: toFade.id });
    }

    // 2. Rearrange survivors gently (bring a middle tension/body upward so sentences physically glide!)
    if (survivors.length >= 2) {
      const moved = survivors.splice(1, 1)[0];
      survivors.unshift(moved);
    }

    // 3. Morph the primary sentence to absorb the human's gesture or latest phase shift
    if (survivors.length > 0) {
      const target = survivors[0];
      const nextText = trigger?.source === "human" ? pick(stanceLines) : P.phase[phase] || pick(P.tension);
      ops.push({
        action: "morph",
        id: target.id,
        text: nextText,
        anchors: [hTerm, b1Term].filter(Boolean),
        role: trigger?.source === "human" ? (hStance === "negate" ? "tension" : "opening") : "body",
        order: 0,
      });
    }

    // 4. Keep remaining survivors in their rearranged order
    for (let i = 1; i < survivors.length; i++) {
      ops.push({
        action: "keep",
        id: survivors[i].id,
        order: i,
      });
    }

    // 5. Emerge one fresh sentence reflecting the newest tension or human inflection
    const freshText =
      trigger?.source === "human"
        ? pick(P.tension)
        : Math.random() < 0.5
        ? pick(stanceLines)
        : pick(P.question);
    ops.push({
      action: "emerge",
      text: freshText,
      anchors: trigger?.source === "human" ? [hTerm, b2Term] : [b1Term, b2Term],
      role: trigger?.source === "human" ? "tension" : "body",
      order: survivors.length,
    });

    return ops;
  }

  _notifyChange() {
    if (this.onChange) {
      this.onChange(this.sentences, {
        isGestating: this.isGestating,
        llmEnabled: this.llmEnabled,
      });
    }
  }

  _emitStatus(msg, isLlm) {
    if (this.onStatus) this.onStatus(msg, isLlm);
  }
}
