// Layer 3 (v4): Free-Associative LLM Palimpsest Engine
// - Zero-key In-Browser LLM (Qwen2.5-0.5B-Instruct via Web Worker, WebGPU/WASM)
// - Plus multi-provider cloud/local presets (Gemini, OpenAI, OpenRouter, Groq, Ollama)
// - Free-associative prompting: confronts the LLM with the live word cloud / dynamic map
//   and lets it write whatever genuinely comes to mind (no rigid JSON / no canned template nonsense)
// - Client-side semantic diff choreography handles focus-in, in-place morphing, FLIP rearrangement, and lingering fade

import { cosineSimilarity } from "./semanticEngine.js?v=4";

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

  /**
   * Awakens the zero-key in-browser Qwen2.5 LLM inside a dedicated Web Worker.
   */
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
          this._worker = new Worker(new URL("./browserLlmWorker.js?v=4", import.meta.url), {
            type: "module",
          });
        }

        const handleInitMsg = (ev) => {
          const msg = ev.data || {};
          if (msg.type === "progress") {
            this.browserLlmProgress = Math.max(this.browserLlmProgress, msg.progress || 0);
            const label =
              msg.status === "fallback-wasm"
                ? lang === "fr"
                  ? "WebGPU indisponible — bascule WASM…"
                  : "WebGPU unavailable — switching to WASM…"
                : lang === "fr"
                ? `Téléchargement Qwen2.5 (${this.browserLlmProgress}%)…`
                : `Downloading Qwen2.5 (${this.browserLlmProgress}%)…`;
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

  /**
   * Schedules a contemplative delayed LLM pulse after a concept change or topology shift.
   */
  scheduleGestation(lang = "fr", trigger = null, immediate = false) {
    if (!this.llmEnabled) return;
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

    // Organic ambient drift when LLM is active and underlying map has shifted
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
    this._inFlight = true;
    this.isGestating = true;
    this._lastPulseAt = performance.now();
    this.topology.telemetry.totalDisplacement = 0;

    const trigger = this._pendingTrigger;
    this._pendingTrigger = null;

    try {
      this._emitStatus(
        lang === "fr" ? "Le LLM contemple le nuage…" : "LLM contemplating the word cloud…",
        "loading"
      );
      const messages = this.buildAssociativeMessages(lang, trigger);
      const rawText = await this.invokeLLM(messages, lang);
      const cleanLines = this.parseFreeSentences(rawText);

      if (cleanLines.length > 0) {
        this.reconcileFreeSentences(cleanLines);
        const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const modelShort = this.config.protocol === "browser"
          ? `Qwen2.5 (${this.browserLlmDevice || "browser"})`
          : this.config.model;
        this._emitStatus(
          lang === "fr" ? `LLM actif · ${modelShort} · ${ts}` : `LLM active · ${modelShort} · ${ts}`,
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
   * Builds an open, free-associative prompt confronting the LLM directly with the living word cloud / dynamic map.
   */
  buildAssociativeMessages(lang = "fr", trigger = null) {
    const cells = Array.from(this.topology.cells.values());
    const humans = cells.filter((c) => c.isHuman);
    const others = cells.filter((c) => !c.isHuman);

    const stanceFR = { assert: "", question: " (?)", negate: " (nié / en tension)", bridge: " (pont)" };
    const stanceEN = { assert: "", question: " (?)", negate: " (negated / in tension)", bridge: " (bridge)" };
    const sMap = lang === "fr" ? stanceFR : stanceEN;

    const humanStr = humans
      .map((c) => `« ${c.term} »${sMap[c.stance] || ""}`)
      .join(", ");

    // Group active words into the live constellations from the dynamic map
    const uniqueCloud = [];
    const seen = new Set(humans.map((h) => h.term.toLowerCase()));
    for (const c of others) {
      const low = c.term.toLowerCase();
      if (!seen.has(low)) {
        seen.add(low);
        uniqueCloud.push(`${c.term}${sMap[c.stance] || ""}`);
      }
      if (uniqueCloud.length >= 12) break;
    }

    const tensions = this.mirror.axes.slice(0, 2).map((a) => a.label).join(" ; ");
    const prevAlive = this.sentences
      .filter((s) => s.status !== "lingering")
      .slice(0, 3)
      .map((s) => s.text)
      .join("\n");

    if (lang === "fr") {
      const system = [
        "Tu contemples un nuage vivant de mots qui évolue en temps réel.",
        "Laisse venir librement tout ce que cette constellation éveille en toi : images, pensées, associations inattendues, aphorismes, questions ou tensions.",
        "Écris exactement 3 ou 4 phrases courtes et fluides (une phrase par ligne) en français naturel, clair et évocateur.",
        "Aucune liste à puces, aucune numérotation, aucun titre, aucun commentaire sur le « nuage » ou l’« utilisateur ».",
        "Écris uniquement la pensée vivante qui te vient à l’esprit.",
      ].join(" ");

      const userParts = [
        `Mots au premier plan : ${humanStr || "transindividuation"}`,
        uniqueCloud.length ? `Mots alentour sur la carte : ${uniqueCloud.join(", ")}` : "",
        tensions ? `Tensions présentes : ${tensions}` : "",
        trigger?.term ? `Mot qui vient d’apparaître ou de bouger : « ${trigger.term} »` : "",
        prevAlive
          ? `Phrases qui flottaient juste avant (laisse certaines se prolonger ou se métamorphoser, et laisse naître du neuf) :\n${prevAlive}`
          : "",
      ].filter(Boolean);

      return [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n") },
      ];
    }

    const system = [
      "You are contemplating a living cloud of words evolving in real time.",
      "Freely write whatever genuinely comes to mind when confronted with this constellation: images, thoughts, unexpected associations, aphorisms, questions, or tensions.",
      "Write exactly 3 or 4 short, fluid sentences (one sentence per line) in natural, vivid English.",
      "No bullet points, no numbering, no titles, never mention 'word cloud' or 'user', and never explain.",
      "Write only the emerging thoughts themselves.",
    ].join(" ");

    const userParts = [
      `Foreground words: ${humanStr || "transindividuation"}`,
      uniqueCloud.length ? `Surrounding words on the map: ${uniqueCloud.join(", ")}` : "",
      tensions ? `Active tensions: ${tensions}` : "",
      trigger?.term ? `Word that just appeared or shifted: "${trigger.term}"` : "",
      prevAlive
        ? `Thoughts lingering just before (let some evolve or shift, and let new ones arise):\n${prevAlive}`
        : "",
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
          temperature: 0.86,
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
            maxOutputTokens: 320,
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
        max_tokens: 320,
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
   * Splits natural LLM output into 3–5 clean, standalone sentences.
   */
  parseFreeSentences(rawText) {
    const cleaned = String(rawText || "")
      .replace(/\r/g, "\n")
      .replace(/^[\s•\-–—*\d.)]+/gm, "")
      .trim();

    if (!cleaned) return [];

    // First split by newlines; if model wrote a single paragraph, split by sentence punctuation
    let lines = cleaned
      .split(/\n+/)
      .map((l) => l.trim().replace(/^["«»]|["«»]$/g, "").trim())
      .filter((l) => l.length >= 14);

    if (lines.length <= 1 && cleaned.length > 60) {
      lines = cleaned
        .split(/(?<=[.!?…])\s+/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 14);
    }

    return lines.slice(0, 5);
  }

  /**
   * Matches the LLM's fresh free-associative sentences against currently displayed sentences
   * using semantic embeddings so they rearrange smoothly (FLIP), morph in place with ghost echoes,
   * slowly focus in, and linger before dissolving.
   */
  reconcileFreeSentences(newTexts) {
    const now = performance.now();
    const activeOld = this.sentences.filter((s) => s.status !== "lingering");
    const cells = Array.from(this.topology.cells.values());

    // Helper: find top 2 live concept cells anchoring a given sentence (for hover illumination)
    const computeAnchors = (sentenceText) => {
      const low = sentenceText.toLowerCase();
      const sVec = this.semantic.embedSync(sentenceText);
      const scored = [];
      const seenTerm = new Set();
      for (const c of cells) {
        const tLow = c.term.toLowerCase();
        if (seenTerm.has(tLow)) continue;
        seenTerm.add(tLow);
        let score = cosineSimilarity(sVec, c.embedding || this.semantic.embedSync(c.term));
        if (low.includes(tLow)) score += 0.65; // direct lexical appearance in LLM thought
        scored.push({ term: c.term, score, stance: c.stance });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 2);
    };

    // Build similarity pairs between old active sentences and new LLM sentences
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
    const matchedNew = new Map(); // ni -> oldSentence
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
        // Morph existing sentence in place (preserves ID for smooth FLIP glide!)
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
        // Brand-new associative sentence slowly coming into focus
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

    // Unmatched old sentences transition into lingering pale ghost memory
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
        browserLlmState: this.browserLlmState,
        browserLlmProgress: this.browserLlmProgress,
      });
    }
  }

  _emitStatus(msg, state = "idle") {
    if (this.onStatus) this.onStatus(msg, state);
  }
}
