// Layer 3 (v5): Free-Associative LLM Palimpsest + LLM-Sculpted Map Cartographer
// - Zero-key In-Browser LLM (Qwen2.5-0.5B-Instruct via Web Worker, WebGPU/WASM) + cloud/Ollama presets
// - In one natural pass, the LLM BOTH links words in the cloud (`~` resonance, `<>` tension + brief whisper)
//   AND writes free-associative emerging sentences
// - Automatic co-occurrence extraction guarantees map sculpting even on compact 0.5B models
// - Client-side semantic diff choreography drives focus-in, morphing, FLIP rearrangement, and lingering fade

import { cosineSimilarity } from "./semanticEngine.js?v=6";
import { normalizeText } from "./i18n.js?v=6";

export const LLM_PRESETS = {
  browser: {
    id: "browser",
    label: "Browser LLM (Sans clé)",
    protocol: "browser",
    endpoint: "local://webgpu-wasm",
    model: "onnx-community/Qwen2.5-0.5B-Instruct",
    requiresKey: false,
    keyPlaceholder: "(aucune clé — modèle exécuté dans votre navigateur)",
  },
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
  constructor(topologyEngine, mirrorEngine, semanticEngine) {
    this.topology = topologyEngine;
    this.mirror = mirrorEngine;
    this.semantic = semanticEngine;

    this.sentences = []; // Array<SentenceNode>
    this.activeLlmLinks = []; // Array<{ termA, termB, type, reason, weight }>
    this._nextId = 1;

    // Contemplative delay & memory timing
    this.gestationDelayMs = 2600;
    this.lingerDurationMs = 14000;
    this.ambientIntervalMs = 12000;

    this.isGestating = false;
    this._gestationTimer = null;
    this._lastPulseAt = 0;
    this._pendingTrigger = null;
    this._inFlight = false;

    // Active LLM state
    this.llmEnabled = false;
    this.providerId = "browser";
    this.config = {
      protocol: LLM_PRESETS.browser.protocol,
      endpoint: LLM_PRESETS.browser.endpoint,
      model: LLM_PRESETS.browser.model,
      apiKey: "",
    };

    // Dedicated Web Worker for zero-key in-browser Qwen2.5 LLM
    this._worker = null;
    this.browserLlmState = "idle"; // "idle" | "loading" | "ready" | "error"
    this.browserLlmProgress = 0;
    this.browserLlmDevice = null;
    this._reqCounter = 1;
    this._pendingWorkerReqs = new Map();

    this.onChange = null; // (sentences, meta)
    this.onStatus = null; // (statusText, state: 'idle'|'loading'|'ready'|'error')
  }

  applyPreset(presetId) {
    const p = LLM_PRESETS[presetId] || LLM_PRESETS.browser;
    this.providerId = p.id;
    this.config.protocol = p.protocol;
    this.config.endpoint = p.endpoint;
    this.config.model = p.model;
    return p;
  }

  async initBrowserLLM(lang = "fr") {
    if (this.browserLlmState === "ready" && this._worker) {
      this.providerId = "browser";
      this.config.protocol = "browser";
      this.llmEnabled = true;
      this._emitStatus(
        lang === "fr"
          ? `LLM Navigateur prêt (${this.browserLlmDevice || "wasm"})`
          : `Browser LLM ready (${this.browserLlmDevice || "wasm"})`,
        "ready"
      );
      return true;
    }

    if (this.browserLlmState === "loading") return false;

    this.providerId = "browser";
    this.config.protocol = "browser";
    this.config.model = LLM_PRESETS.browser.model;
    this.browserLlmState = "loading";
    this.browserLlmProgress = 2;
    this._emitStatus(
      lang === "fr"
        ? "Éveil du LLM navigateur (Qwen2.5 · 2%)…"
        : "Awakening Browser LLM (Qwen2.5 · 2%)…",
      "loading"
    );
    this._notifyChange();

    return new Promise((resolve) => {
      try {
        if (!this._worker) {
          this._worker = new Worker(new URL("./browserLlmWorker.js?v=6", import.meta.url), {
            type: "module",
          });
        }

        const handleInitMsg = (ev) => {
          const msg = ev.data || {};
          if (msg.type === "progress") {
            this.browserLlmProgress = msg.progress || 1;
            const mbInfo = msg.totalMB > 10 ? ` · ${msg.loadedMB}/${msg.totalMB} MB` : "";
            const label =
              msg.status === "fallback-wasm"
                ? lang === "fr"
                  ? "WebGPU indisponible — bascule WASM…"
                  : "WebGPU unavailable — switching to WASM…"
                : msg.status === "compiling"
                ? lang === "fr"
                  ? "Compilation du modèle en mémoire…"
                  : "Compiling model into memory…"
                : lang === "fr"
                ? `Téléchargement Qwen2.5 (${this.browserLlmProgress}%${mbInfo})…`
                : `Downloading Qwen2.5 (${this.browserLlmProgress}%${mbInfo})…`;
            this._emitStatus(label, "loading");
            this._notifyChange();
          } else if (msg.type === "ready") {
            this._worker.removeEventListener("message", handleInitMsg);
            this._attachWorkerListener();
            this.browserLlmState = "ready";
            this.browserLlmProgress = 100;
            this.browserLlmDevice = msg.device || "webgpu";
            this.llmEnabled = true;
            this._emitStatus(
              lang === "fr"
                ? `LLM Navigateur actif · Qwen2.5 (${this.browserLlmDevice})`
                : `Browser LLM active · Qwen2.5 (${this.browserLlmDevice})`,
              "ready"
            );
            this._notifyChange();
            resolve(true);
          } else if (msg.type === "error" && !msg.requestId) {
            this._worker.removeEventListener("message", handleInitMsg);
            this.browserLlmState = "error";
            this._emitStatus(`Erreur LLM navigateur : ${msg.message}`, "error");
            this._notifyChange();
            resolve(false);
          }
        };

        this._worker.addEventListener("message", handleInitMsg);
        this._worker.postMessage({ type: "init", modelId: this.config.model });
      } catch (err) {
        this.browserLlmState = "error";
        this._emitStatus(`Erreur Worker : ${err.message}`, "error");
        this._notifyChange();
        resolve(false);
      }
    });
  }

  _attachWorkerListener() {
    if (!this._worker || this._worker._attached) return;
    this._worker._attached = true;
    this._worker.addEventListener("message", (ev) => {
      const msg = ev.data || {};
      if (!msg.requestId || !this._pendingWorkerReqs.has(msg.requestId)) return;
      const { resolve, reject } = this._pendingWorkerReqs.get(msg.requestId);
      this._pendingWorkerReqs.delete(msg.requestId);
      if (msg.type === "result") resolve(msg.text);
      else reject(new Error(msg.message || "Worker generation error"));
    });
  }

  scheduleGestation(lang = "fr", trigger = null, immediate = false) {
    if (!this.llmEnabled) return;
    if (this.topology.cells.size === 0) {
      this.isGestating = false;
      this._emitStatus(
        lang === "fr"
          ? "LLM prêt — entrez un premier mot ci-dessous"
          : "LLM ready — enter a first word below",
        "ready"
      );
      this._notifyChange();
      return;
    }
    if (trigger) this._pendingTrigger = trigger;
    if (this._gestationTimer) clearTimeout(this._gestationTimer);

    const delay = immediate ? 200 : this.gestationDelayMs;
    this.isGestating = true;
    this._notifyChange();

    this._gestationTimer = setTimeout(() => {
      this._gestationTimer = null;
      this.pulse(lang);
    }, delay);
  }

  tick(now, lang = "fr") {
    let changed = false;

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

    const beforeLen = this.sentences.length;
    this.sentences = this.sentences.filter((s) => {
      if (s.status !== "lingering") return true;
      return now - s.fadingSince < this.lingerDurationMs;
    });
    if (this.sentences.length !== beforeLen) changed = true;

    if (changed) this._notifyChange();

    if (
      this.llmEnabled &&
      !this.isGestating &&
      !this._inFlight &&
      now - this._lastPulseAt > this.ambientIntervalMs &&
      this.topology.telemetry.totalDisplacement > 0.65
    ) {
      this.scheduleGestation(lang, { source: "topology" }, false);
    }
  }

  async pulse(lang = "fr") {
    if (!this.llmEnabled || this._inFlight) return;
    if (this.topology.cells.size === 0) return;
    this._inFlight = true;
    this.isGestating = true;
    this._lastPulseAt = performance.now();
    this.topology.telemetry.totalDisplacement = 0;

    const trigger = this._pendingTrigger;
    this._pendingTrigger = null;

    try {
      this._emitStatus(
        lang === "fr" ? "Le LLM tisse la carte et le texte…" : "LLM weaving the map and text…",
        "loading"
      );
      const messages = this.buildCartographerMessages(lang, trigger);
      const rawText = await this.invokeLLM(messages, lang);
      const { links, sentences } = this.parseCartographerOutput(rawText);

      // 1. Feed LLM-forged links & word gravities straight back into the live TopologyEngine!
      if (links.length > 0) {
        this.activeLlmLinks = links;
        this.topology.applyLlmLinks(links, lang);
        this.mirror.update(lang);
      }

      // 2. Reconcile the emerging free-associative sentences into the Palimpsest
      if (sentences.length > 0) {
        this.reconcileFreeSentences(sentences);
        const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const modelShort =
          this.config.protocol === "browser"
            ? `Qwen2.5 (${this.browserLlmDevice || "browser"})`
            : this.config.model;
        this._emitStatus(
          lang === "fr"
            ? `LLM actif · ${modelShort} · ${links.length} liens · ${ts}`
            : `LLM active · ${modelShort} · ${links.length} links · ${ts}`,
          "ready"
        );
      } else {
        throw new Error(lang === "fr" ? "Réponse vide du modèle" : "Empty model output");
      }
    } catch (err) {
      console.warn("Palimpsest LLM pulse error:", err);
      this._emitStatus(`Erreur LLM (${err.message})`, "error");
    } finally {
      this._inFlight = false;
      this.isGestating = false;
      this._notifyChange();
    }
  }

  /**
   * Prompts the LLM to act BOTH as the cartographer linking the offered words
   * AND as the free-associative voice emerging from that newly woven map.
   */
  buildCartographerMessages(lang = "fr", trigger = null) {
    const cells = Array.from(this.topology.cells.values());
    const humans = cells.filter((c) => c.isHuman);
    const others = cells.filter((c) => !c.isHuman);

    const stanceFR = { assert: "", question: " (?)", negate: " (contredit)", bridge: " (pont)" };
    const stanceEN = { assert: "", question: " (?)", negate: " (negated)", bridge: " (bridge)" };
    const sMap = lang === "fr" ? stanceFR : stanceEN;

    const humanList = humans.map((c) => `${c.term}${sMap[c.stance] || ""}`);
    const uniqueOthers = [];
    const seen = new Set(humans.map((h) => h.term.toLowerCase()));
    for (const c of others) {
      const low = c.term.toLowerCase();
      if (!seen.has(low)) {
        seen.add(low);
        uniqueOthers.push(`${c.term}${sMap[c.stance] || ""}`);
      }
      if (uniqueOthers.length >= 12) break;
    }

    const prevAlive = this.sentences
      .filter((s) => s.status !== "lingering")
      .slice(0, 2)
      .map((s) => s.text)
      .join("\n");

    const totalWords = humanList.length + uniqueOthers.length;

    if (lang === "fr") {
      const system =
        totalWords <= 1
          ? [
              "Tu contemples un premier mot ou concept posé dans un espace vierge.",
              "Laisse venir librement 2 à 3 phrases courtes, vivantes et évocatrices (une par ligne) exprimant ce que ce mot éveille en toi.",
              "Pas de puces, pas de numéros, pas de titre, pas de méta-commentaire.",
            ].join("\n")
          : [
              "Tu contemples un ensemble vivant de mots offerts par plusieurs personnes.",
              "Ton rôle est double : d'abord tisser des liens libres entre ces mots pour dessiner leur carte vivante, puis laisser émerger la pensée qui te vient à l'esprit.",
              "Réponds exactement en deux blocs simples :",
              "LIENS:",
              "2 à 4 lignes au format « motA ~ motB : lien en 2-4 mots » (affinité ou pont) ou « motA <> motB : tension en 2-4 mots » (contraste ou friction), en choisissant des mots présents dans la liste.",
              "TEXTE:",
              "3 phrases courtes, fluides et évocatrices (une par ligne) exprimant librement tout ce que cette carte éveille en toi — images, associations, questions ou aphorismes. Pas de puces, pas de numéros, pas de méta-commentaire.",
            ].join("\n");

      const userParts = [
        humanList.length ? `Mots offerts : ${humanList.join(", ")}` : "",
        uniqueOthers.length ? `Autres mots dans le champ : ${uniqueOthers.join(", ")}` : "",
        trigger?.term ? `Mot qui vient d’arriver ou de bouger : ${trigger.term}` : "",
        prevAlive ? `Pensées précédentes en cours de métamorphose :\n${prevAlive}` : "",
      ].filter(Boolean);

      return [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n") },
      ];
    }

    const system =
      totalWords <= 1
        ? [
            "You are contemplating a single opening word placed in a blank space.",
            "Freely write 2 to 3 short, vivid sentences (one per line) expressing whatever genuinely comes to mind from this seed.",
            "No bullets, no numbering, no titles, no meta-commentary.",
          ].join("\n")
        : [
            "You are contemplating a living collection of words offered by several minds.",
            "Your role is twofold: first weave fresh conceptual links between these words to sculpt their living map, then write whatever thoughts freely come to mind.",
            "Reply in exactly two simple blocks:",
            "LINKS:",
            "2 to 4 lines using 'wordA ~ wordB : 2-4 word resonance' (affinity/bridge) or 'wordA <> wordB : 2-4 word tension' (contrast/friction), picking words from the offered list.",
            "TEXT:",
            "3 short, vivid, natural sentences (one per line) freely expressing whatever this woven map brings to mind—images, associations, questions, or aphorisms. No bullets, no numbering, no meta-commentary.",
          ].join("\n");

    const userParts = [
      humanList.length ? `Offered words: ${humanList.join(", ")}` : "",
      uniqueOthers.length ? `Surrounding words in the field: ${uniqueOthers.join(", ")}` : "",
      trigger?.term ? `Word that just arrived or shifted: ${trigger.term}` : "",
      prevAlive ? `Previous drifting thoughts:\n${prevAlive}` : "",
    ].filter(Boolean);

    return [
      { role: "system", content: system },
      { role: "user", content: userParts.join("\n") },
    ];
  }

  async invokeLLM(messages, lang = "fr") {
    const protocol = this.config.protocol || "browser";

    if (protocol === "browser") {
      if (this.browserLlmState !== "ready" || !this._worker) {
        const ok = await this.initBrowserLLM(lang);
        if (!ok) throw new Error("Browser LLM unavailable");
      }
      const requestId = this._reqCounter++;
      return new Promise((resolve, reject) => {
        this._pendingWorkerReqs.set(requestId, { resolve, reject });
        this._worker.postMessage({
          type: "generate",
          requestId,
          messages,
          maxNewTokens: 155,
          temperature: 0.85,
        });
      });
    }

    const endpoint = (this.config.endpoint || "").trim();
    const model = (this.config.model || "").trim();
    const apiKey = (this.config.apiKey || "").trim();
    const isLocal = endpoint.includes("localhost") || endpoint.includes("127.0.0.1");

    if (!isLocal && !apiKey) {
      throw new Error(lang === "fr" ? "Clé API requise" : "API key required");
    }

    if (protocol === "gemini") {
      const url = `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: messages[0].content }] },
          contents: [{ role: "user", parts: [{ text: messages[1].content }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 420,
          },
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Gemini HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 80)}` : ""}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (this.providerId === "openrouter") {
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "Noetic Poietic Generator";
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.9,
        max_tokens: 420,
        messages,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 80)}` : ""}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  /**
   * Parses BOTH explicit LLM links (`A ~ B : reason`, `A <> B : reason`) AND the emerging sentences,
   * plus falls back to extracting co-occurrence links directly from sentences so the map ALWAYS evolves.
   */
  parseCartographerOutput(rawText) {
    const raw = String(rawText || "").replace(/\r/g, "\n").trim();
    if (!raw) return { links: [], sentences: [] };

    // Build lookup of active terms (normalized -> canonical original term)
    const activeTermMap = new Map();
    for (const c of this.topology.cells.values()) {
      const norm = normalizeText(c.term);
      if (norm && !activeTermMap.has(norm)) activeTermMap.set(norm, c.term);
    }

    const resolveActiveTerm = (candidate) => {
      const norm = normalizeText(candidate);
      if (!norm) return null;
      if (activeTermMap.has(norm)) return activeTermMap.get(norm);
      // Partial / root match against active terms
      for (const [k, orig] of activeTermMap.entries()) {
        if (k.length >= 4 && (norm.includes(k) || k.includes(norm))) {
          return orig;
        }
      }
      return null;
    };

    const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const links = [];
    const seenPairs = new Set();
    const proseLines = [];

    let section = "auto"; // "auto" | "links" | "text"
    const linkPattern = /^[\s•\-–—*\d.)«"']*(.+?)\s*(<>|↔|<->|vs\.?|~|—|->|→)\s*(.+?)(?:\s*[:—-]\s*(.+))?$/i;

    for (const line of lines) {
      const upper = line.toUpperCase().replace(/[*#:]/g, "").trim();
      if (upper === "LIENS" || upper === "LINKS") {
        section = "links";
        continue;
      }
      if (upper === "TEXTE" || upper === "TEXT") {
        section = "text";
        continue;
      }

      // Check if line looks like a link line (in links section or matching link symbols ~ / <> / ↔)
      const hasExplicitSymbol = /(<>|↔|<->|~|→|->)/.test(line);
      if (section === "links" || (section === "auto" && hasExplicitSymbol && line.length < 95)) {
        const m = line.match(linkPattern);
        if (m) {
          const rawA = m[1].replace(/[«»"'`]/g, "").trim();
          const op = m[2].trim();
          const rawB = m[3].replace(/[«»"'`]/g, "").trim();
          const reason = (m[4] || "").replace(/[«»"'`]/g, "").trim().slice(0, 36);

          const termA = resolveActiveTerm(rawA);
          const termB = resolveActiveTerm(rawB);
          if (termA && termB && termA.toLowerCase() !== termB.toLowerCase()) {
            const pairKey = [termA.toLowerCase(), termB.toLowerCase()].sort().join("|");
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              const isTension = op === "<>" || op === "↔" || op === "<->" || op.toLowerCase().startsWith("vs");
              links.push({
                termA,
                termB,
                type: isTension ? "tension" : "resonance",
                reason,
                weight: 0.88,
                source: "llm-explicit",
              });
            }
          }
          continue;
        }
      }

      // Otherwise treat as emerging prose sentence
      const cleanLine = line
        .replace(/^[\s•\-–—*\d.)]+/, "")
        .replace(/^["«»]|["«»]$/g, "")
        .trim();
      if (cleanLine.length >= 14) {
        proseLines.push(cleanLine);
      }
    }

    // If LLM merged sentences into a single paragraph, split cleanly by punctuation
    let sentences = proseLines;
    if (sentences.length <= 1 && proseLines[0] && proseLines[0].length > 70) {
      sentences = proseLines[0]
        .split(/(?<=[.!?…])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 14);
    }
    sentences = sentences.slice(0, 5);

    // Supplemental co-occurrence cartography: whenever the LLM weaves two active words into the same sentence,
    // forge a gentle associative resonance link between them so even small models dynamically reshape the map!
    const normEntries = Array.from(activeTermMap.entries()).filter(([k]) => k.length >= 3);
    for (const s of sentences) {
      const sNorm = normalizeText(s);
      const found = [];
      for (const [k, orig] of normEntries) {
        if (sNorm.includes(k)) found.push(orig);
      }
      for (let i = 0; i < found.length; i++) {
        for (let j = i + 1; j < found.length; j++) {
          const pairKey = [found[i].toLowerCase(), found[j].toLowerCase()].sort().join("|");
          if (!seenPairs.has(pairKey) && links.length < 7) {
            seenPairs.add(pairKey);
            links.push({
              termA: found[i],
              termB: found[j],
              type: "resonance",
              reason: "",
              weight: 0.72,
              source: "llm-cooccur",
            });
          }
        }
      }
    }

    return { links: links.slice(0, 7), sentences };
  }

  reconcileFreeSentences(newTexts) {
    const now = performance.now();
    const activeOld = this.sentences.filter((s) => s.status !== "lingering");
    const cells = Array.from(this.topology.cells.values());

    const computeAnchors = (sentenceText) => {
      const low = normalizeText(sentenceText);
      const sVec = this.semantic.embedSync(sentenceText);
      const scored = [];
      const seenTerm = new Set();
      for (const c of cells) {
        const tLow = c.term.toLowerCase();
        if (seenTerm.has(tLow)) continue;
        seenTerm.add(tLow);
        let score = cosineSimilarity(sVec, c.embedding || this.semantic.embedSync(c.term));
        if (low.includes(normalizeText(c.term))) score += 0.65;
        scored.push({ term: c.term, score, stance: c.stance });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 2);
    };

    const oldVecs = activeOld.map((s) => this.semantic.embedSync(s.text));
    const newVecs = newTexts.map((txt) => this.semantic.embedSync(txt));

    const pairs = [];
    for (let oi = 0; oi < activeOld.length; oi++) {
      for (let ni = 0; ni < newTexts.length; ni++) {
        const sim = cosineSimilarity(oldVecs[oi], newVecs[ni]);
        if (sim >= 0.34) pairs.push({ oi, ni, sim });
      }
    }
    pairs.sort((a, b) => b.sim - a.sim);

    const matchedOld = new Set();
    const matchedNew = new Map();
    for (const p of pairs) {
      if (matchedOld.has(p.oi) || matchedNew.has(p.ni)) continue;
      matchedOld.add(p.oi);
      matchedNew.set(p.ni, activeOld[p.oi]);
    }

    const nextActive = [];
    for (let ni = 0; ni < newTexts.length; ni++) {
      const txt = newTexts[ni];
      const anchorObjs = computeAnchors(txt);
      const anchors = anchorObjs.map((a) => a.term);
      const hasNegate = anchorObjs.some((a) => a.stance === "negate");
      const role = txt.endsWith("?")
        ? "question"
        : hasNegate
        ? "tension"
        : ni === 0
        ? "opening"
        : "body";

      if (matchedNew.has(ni)) {
        const node = matchedNew.get(ni);
        if (node.text !== txt) {
          node.prevText = node.text;
          node.text = txt;
          node.status = "morphing";
          node.morphedAt = now;
        } else {
          node.status = "alive";
        }
        node.anchors = anchors;
        node.role = role;
        node.order = ni;
        node.fadingSince = null;
        nextActive.push(node);
      } else {
        nextActive.push({
          id: `s${this._nextId++}`,
          text: txt,
          prevText: null,
          anchors,
          role,
          status: "emerging",
          origin: "llm",
          order: ni,
          bornAt: now,
          morphedAt: now,
          fadingSince: null,
        });
      }
    }

    const newlyLingering = [];
    for (let oi = 0; oi < activeOld.length; oi++) {
      if (!matchedOld.has(oi)) {
        const oldNode = activeOld[oi];
        oldNode.status = "lingering";
        oldNode.fadingSince = now;
        oldNode.prevText = null;
        newlyLingering.push(oldNode);
      }
    }

    const existingLingering = this.sentences.filter((s) => s.status === "lingering");
    const lingering = [...newlyLingering, ...existingLingering]
      .sort((a, b) => (b.fadingSince || 0) - (a.fadingSince || 0))
      .slice(0, 3);

    this.sentences = [...nextActive, ...lingering];
    this._notifyChange();
  }

  _notifyChange() {
    if (this.onChange) {
      this.onChange(this.sentences, {
        isGestating: this.isGestating,
        llmEnabled: this.llmEnabled,
        llmLinks: this.activeLlmLinks,
        browserLlmState: this.browserLlmState,
        browserLlmProgress: this.browserLlmProgress,
      });
    }
  }

  _emitStatus(msg, state = "idle") {
    if (this.onStatus) this.onStatus(msg, state);
  }
}
