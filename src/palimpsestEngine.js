// Layer 3 (v7): 2-Pass Free-Associative LLM Palimpsest + Cartographer with Live Token Streaming
// - Zero-key In-Browser LLM: Qwen2.5-1.5B-Instruct (primary) & Qwen2.5-0.5B-Instruct (lightweight)
// - Cloud / Local presets: Google Gemini, OpenAI, OpenRouter, Groq, Local Ollama
// - Split into 2 crisp micro-passes so small models excel at BOTH tasks:
//     Pass A (Cartographer): links offered words (`~` affinity / `<>` tension + brief whisper)
//     Pass B (Living Voice): streams pure free-associative prose directly into the Palimpsest
// - Strict meta-preamble filtering + automatic retry on empty output

import { cosineSimilarity } from "./semanticEngine.js?v=7";
import { normalizeText } from "./i18n.js?v=7";

export const LLM_PRESETS = {
  browser15: {
    id: "browser15",
    label: "Browser 1.5B (Sans clé)",
    protocol: "browser",
    endpoint: "local://webgpu-wasm",
    model: "onnx-community/Qwen2.5-1.5B-Instruct",
    requiresKey: false,
    keyPlaceholder: "(aucune clé — Qwen2.5 1.5B dans votre navigateur)",
  },
  browser05: {
    id: "browser05",
    label: "Browser 0.5B (Léger)",
    protocol: "browser",
    endpoint: "local://webgpu-wasm",
    model: "onnx-community/Qwen2.5-0.5B-Instruct",
    requiresKey: false,
    keyPlaceholder: "(aucune clé — Qwen2.5 0.5B léger dans votre navigateur)",
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

// Reject meta-chatter / formatting preambles that small models occasionally emit
const PREAMBLE_RE = /^(voil[àa]|voici|liens?\s*:|texte\s*:|links?\s*:|text\s*:|here\s+(are|is)|les\s+liens|réponse\s*:)/i;

export class PalimpsestEngine {
  constructor(topologyEngine, mirrorEngine, semanticEngine) {
    this.topology = topologyEngine;
    this.mirror = mirrorEngine;
    this.semantic = semanticEngine;

    this.sentences = [];
    this.activeLlmLinks = [];
    this.streamingDraft = ""; // live streaming tokens as Pass B crystallizes!
    this._nextId = 1;

    this.gestationDelayMs = 2400;
    this.lingerDurationMs = 14000;
    this.ambientIntervalMs = 14000;

    this.isGestating = false;
    this._gestationTimer = null;
    this._lastPulseAt = 0;
    this._pendingTrigger = null;
    this._inFlight = false;

    this.llmEnabled = false;
    this.providerId = "browser15";
    this.config = {
      protocol: LLM_PRESETS.browser15.protocol,
      endpoint: LLM_PRESETS.browser15.endpoint,
      model: LLM_PRESETS.browser15.model,
      apiKey: "",
    };

    // Dedicated Web Worker for zero-key in-browser Qwen2.5 LLM
    this._worker = null;
    this.browserLlmState = "idle"; // "idle" | "loading" | "ready" | "error"
    this.browserLlmModelLoaded = null;
    this.browserLlmProgress = 0;
    this.browserLlmDevice = null;
    this._reqCounter = 1;
    this._pendingWorkerReqs = new Map();

    this.onChange = null;
    this.onStatus = null;
    this.onStream = null; // (partialText)
  }

  applyPreset(presetId) {
    const p = LLM_PRESETS[presetId] || LLM_PRESETS.browser15;
    this.providerId = p.id;
    this.config.protocol = p.protocol;
    this.config.endpoint = p.endpoint;
    this.config.model = p.model;
    return p;
  }

  async initBrowserLLM(lang = "fr", presetId = null) {
    if (presetId && LLM_PRESETS[presetId]) {
      this.applyPreset(presetId);
    } else if (this.config.protocol !== "browser") {
      this.applyPreset("browser15");
    }

    const targetModel = this.config.model || LLM_PRESETS.browser15.model;
    const shortName = targetModel.includes("0.5B") ? "Qwen2.5-0.5B" : "Qwen2.5-1.5B";

    if (this.browserLlmState === "ready" && this._worker && this.browserLlmModelLoaded === targetModel) {
      this.llmEnabled = true;
      this._emitStatus(
        lang === "fr"
          ? `LLM Navigateur prêt · ${shortName} (${this.browserLlmDevice || "webgpu"})`
          : `Browser LLM ready · ${shortName} (${this.browserLlmDevice || "webgpu"})`,
        "ready"
      );
      return true;
    }

    if (this.browserLlmState === "loading") return false;

    this.browserLlmState = "loading";
    this.browserLlmProgress = 1;
    this._emitStatus(
      lang === "fr"
        ? `Éveil de ${shortName} dans le navigateur…`
        : `Awakening ${shortName} in browser…`,
      "loading"
    );
    this._notifyChange();

    return new Promise((resolve) => {
      try {
        if (!this._worker) {
          this._worker = new Worker(new URL("./browserLlmWorker.js?v=7c", import.meta.url), {
            type: "module",
          });
        }

        const handleInitMsg = (ev) => {
          const msg = ev.data || {};
          if (msg.type === "progress") {
            this.browserLlmProgress = msg.progress || 1;
            const activeName = (msg.modelId || targetModel).includes("0.5B") ? "Qwen2.5-0.5B" : "Qwen2.5-1.5B";
            const mbInfo = msg.totalMB > 10 ? ` · ${msg.loadedMB}/${msg.totalMB} MB` : "";
            const label =
              msg.status === "stepdown-05b"
                ? lang === "fr"
                  ? "Mémoire GPU limitée pour 1.5B — bascule vers Qwen2.5-0.5B…"
                  : "GPU buffer too small for 1.5B — switching to Qwen2.5-0.5B…"
                : msg.status === "fallback-wasm"
                ? lang === "fr"
                  ? "WebGPU indisponible — bascule WASM…"
                  : "WebGPU unavailable — switching to WASM…"
                : msg.status === "compiling"
                ? lang === "fr"
                  ? `Compilation de ${activeName} en mémoire…`
                  : `Compiling ${activeName} into memory…`
                : lang === "fr"
                ? `Téléchargement ${activeName} (${this.browserLlmProgress}%${mbInfo})…`
                : `Downloading ${activeName} (${this.browserLlmProgress}%${mbInfo})…`;
            this._emitStatus(label, "loading");
            this._notifyChange();
          } else if (msg.type === "ready") {
            this._worker.removeEventListener("message", handleInitMsg);
            this._attachWorkerListener();
            this.browserLlmState = "ready";
            this.browserLlmModelLoaded = msg.modelId || targetModel;
            this.config.model = this.browserLlmModelLoaded;
            const loadedShort = this.browserLlmModelLoaded.includes("0.5B") ? "Qwen2.5-0.5B" : "Qwen2.5-1.5B";
            this.browserLlmProgress = 100;
            this.browserLlmDevice = msg.device || "webgpu";
            this.llmEnabled = true;
            this._emitStatus(
              lang === "fr"
                ? `LLM actif · ${loadedShort} (${this.browserLlmDevice})`
                : `LLM active · ${loadedShort} (${this.browserLlmDevice})`,
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
        this._worker.postMessage({ type: "init", modelId: targetModel });
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
      const entry = this._pendingWorkerReqs.get(msg.requestId);
      if (msg.type === "token") {
        if (entry.onToken) entry.onToken(msg.fullText || "");
        return;
      }
      this._pendingWorkerReqs.delete(msg.requestId);
      if (msg.type === "result") entry.resolve(msg.text);
      else entry.reject(new Error(msg.message || "Worker generation error"));
    });
  }

  getActiveCells() {
    return Array.from(this.topology.cells.values()).filter((c) => !c.dissolvingSince);
  }

  scheduleGestation(lang = "fr", trigger = null, immediate = false) {
    if (!this.llmEnabled) return;
    if (this.getActiveCells().length === 0) {
      this.isGestating = false;
      this._emitStatus(
        lang === "fr" ? "LLM prêt — entrez un premier mot ci-dessous" : "LLM ready — enter a first word below",
        "ready"
      );
      this._notifyChange();
      return;
    }

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
      this.getActiveCells().length > 0 &&
      now - this._lastPulseAt > this.ambientIntervalMs &&
      this.topology.telemetry.totalDisplacement > 0.75
    ) {
      this.scheduleGestation(lang, { source: "topology" }, false);
    }
  }

  /**
   * Executes the clean 2-pass LLM cycle:
   *   Pass A (Cartographer): weaves explicit links between words (when 2+ words exist)
   *   Pass B (Living Voice): streams free-associative sentences directly into the Palimpsest
   */
  async pulse(lang = "fr") {
    if (!this.llmEnabled || this._inFlight) return;
    const activeCells = this.getActiveCells();
    if (activeCells.length === 0) return;

    this._inFlight = true;
    this.isGestating = true;
    this.streamingDraft = "";
    this._lastPulseAt = performance.now();
    this.topology.telemetry.totalDisplacement = 0;

    const trigger = this._pendingTrigger;
    this._pendingTrigger = null;

    try {
      let wovenLinks = [];

      // Pass A: Focused Cartography (only when 2+ distinct words exist)
      const uniqueTerms = [...new Set(activeCells.map((c) => c.term.toLowerCase()))];
      if (uniqueTerms.length >= 2) {
        this._emitStatus(
          lang === "fr" ? "Tissage des liens entre les mots…" : "Weaving links between words…",
          "loading"
        );
        const linkMsgs = this.buildLinkMessages(activeCells, lang);
        const rawLinks = await this.invokeLLM(linkMsgs, {
          lang,
          maxNewTokens: 70,
          temperature: 0.45,
          stream: false,
        });
        wovenLinks = this.parseLinks(rawLinks, activeCells);
        if (wovenLinks.length > 0) {
          this.activeLlmLinks = wovenLinks;
          this.topology.applyLlmLinks(wovenLinks, lang);
          this.mirror.update(lang);
          this._notifyChange();
        }
      }

      // Pass B: Focused Free-Associative Living Voice (with live streaming!)
      this._emitStatus(
        lang === "fr" ? "Cristallisation du texte émergent…" : "Crystallizing emerging text…",
        "loading"
      );
      const voiceMsgs = this.buildVoiceMessages(activeCells, wovenLinks, lang, trigger);
      let rawProse = await this.invokeLLM(voiceMsgs, {
        lang,
        maxNewTokens: 120,
        temperature: 0.8,
        stream: true,
        onToken: (partial) => {
          this.streamingDraft = partial;
          if (this.onStream) this.onStream(partial);
        },
      });

      let sentences = this.parseCleanSentences(rawProse);

      // Automatic clean retry if prose came back empty or only preamble
      if (sentences.length === 0) {
        const retryMsgs = this.buildSimpleFallbackVoiceMessages(activeCells, lang);
        rawProse = await this.invokeLLM(retryMsgs, {
          lang,
          maxNewTokens: 100,
          temperature: 0.65,
          stream: true,
          onToken: (partial) => {
            this.streamingDraft = partial;
            if (this.onStream) this.onStream(partial);
          },
        });
        sentences = this.parseCleanSentences(rawProse);
      }

      this.streamingDraft = "";
      if (this.onStream) this.onStream("");

      if (sentences.length > 0) {
        // Supplement explicit links with sentence co-occurrence links if Pass A found fewer than 2
        if (wovenLinks.length < 2 && uniqueTerms.length >= 2) {
          const coLinks = this.extractCooccurrenceLinks(sentences, activeCells, wovenLinks);
          if (coLinks.length > 0) {
            wovenLinks = [...wovenLinks, ...coLinks].slice(0, 5);
            this.activeLlmLinks = wovenLinks;
            this.topology.applyLlmLinks(wovenLinks, lang);
            this.mirror.update(lang);
          }
        }

        this.reconcileFreeSentences(sentences);

        const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const modelShort =
          this.config.protocol === "browser"
            ? `${this.config.model.includes("0.5B") ? "Qwen2.5-0.5B" : "Qwen2.5-1.5B"} (${this.browserLlmDevice || "webgpu"})`
            : this.config.model;
        this._emitStatus(
          lang === "fr"
            ? `LLM actif · ${modelShort} · ${wovenLinks.length} liens · ${ts}`
            : `LLM active · ${modelShort} · ${wovenLinks.length} links · ${ts}`,
          "ready"
        );
      } else {
        throw new Error(lang === "fr" ? "Aucune phrase exploitable générée" : "No usable sentences generated");
      }
    } catch (err) {
      console.warn("Palimpsest LLM pulse error:", err);
      this.streamingDraft = "";
      if (this.onStream) this.onStream("");
      this._emitStatus(`Erreur LLM (${err.message})`, "error");
    } finally {
      this._inFlight = false;
      this.isGestating = false;
      this._notifyChange();
    }
  }

  /**
   * Pass A prompt: ultra-focused link weaver (no prose, no chatter).
   */
  buildLinkMessages(cells, lang) {
    const words = [...new Set(cells.map((c) => c.term))].slice(0, 14);
    const negated = cells.filter((c) => c.stance === "negate").map((c) => c.term);

    if (lang === "fr") {
      return [
        {
          role: "system",
          content:
            "Relie les mots donnés par 2 ou 3 lignes courtes uniquement.\n" +
            "Format strict par ligne : motA ~ motB : idée en 2-3 mots (affinité) OU motA <> motB : contraste en 2-3 mots (tension).\n" +
            "Utilise uniquement les mots exacts de la liste. Aucune phrase d’introduction.",
        },
        {
          role: "user",
          content:
            `Mots : ${words.join(", ")}` +
            (negated.length ? `\nMots en contradiction : ${negated.join(", ")}` : ""),
        },
      ];
    }

    return [
      {
        role: "system",
        content:
          "Connect the given words in 2 or 3 short lines only.\n" +
          "Strict format per line: wordA ~ wordB : 2-3 word affinity OR wordA <> wordB : 2-3 word tension.\n" +
          "Use only exact words from the list. No introductory text.",
      },
      {
        role: "user",
        content:
          `Words: ${words.join(", ")}` +
          (negated.length ? `\nNegated words: ${negated.join(", ")}` : ""),
      },
    ];
  }

  /**
   * Pass B prompt: pure free-associative prose confronted with the living word cloud & links.
   */
  buildVoiceMessages(cells, links, lang, trigger) {
    const stanceFR = { assert: "", question: " (?)", negate: " (contredit)", bridge: " (pont)" };
    const stanceEN = { assert: "", question: " (?)", negate: " (negated)", bridge: " (bridge)" };
    const sMap = lang === "fr" ? stanceFR : stanceEN;

    const wordList = cells.slice(0, 14).map((c) => `${c.term}${sMap[c.stance] || ""}`).join(", ");
    const linkSummary = links
      .slice(0, 3)
      .map((l) => `${l.termA} ${l.type === "tension" ? "↔" : "~"} ${l.termB}${l.reason ? ` (${l.reason})` : ""}`)
      .join(" ; ");
    const prevLine = this.sentences.find((s) => s.status !== "lingering")?.text || "";

    if (lang === "fr") {
      return [
        {
          role: "system",
          content:
            "Écris 3 phrases courtes, claires et évocatrices en français naturel (une phrase par ligne) exprimant librement ce que ces mots éveillent en toi : image, pensée, question ou paradoxe. " +
            "Écris directement les 3 phrases sans titre, sans puces, sans guillemets superflus et sans formule comme « Voici » ou « Voilà ».",
        },
        {
          role: "user",
          content: [
            `Mots présents : ${wordList}`,
            linkSummary ? `Liens perçus : ${linkSummary}` : "",
            trigger?.term ? `Nouveau mot : ${trigger.term}` : "",
            prevLine ? `Écho précédent : ${prevLine}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ];
    }

    return [
      {
        role: "system",
        content:
          "Write 3 short, clear, evocative sentences in natural English (one sentence per line) freely expressing whatever these words bring to mind: an image, a thought, a question, or a paradox. " +
          "Write only the 3 sentences directly—no title, no bullets, no stray quotes, and no preamble like 'Here are'.",
      },
      {
        role: "user",
        content: [
          `Words present: ${wordList}`,
          linkSummary ? `Woven links: ${linkSummary}` : "",
          trigger?.term ? `Newest word: ${trigger.term}` : "",
          prevLine ? `Previous echo: ${prevLine}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];
  }

  buildSimpleFallbackVoiceMessages(cells, lang) {
    const words = [...new Set(cells.map((c) => c.term))].slice(0, 8).join(", ");
    if (lang === "fr") {
      return [
        { role: "system", content: "Écris 2 phrases poétiques et claires en français inspirées par ces mots." },
        { role: "user", content: words },
      ];
    }
    return [
      { role: "system", content: "Write 2 clear, evocative sentences in English inspired by these words." },
      { role: "user", content: words },
    ];
  }

  async invokeLLM(messages, { lang = "fr", maxNewTokens = 120, temperature = 0.78, stream = false, onToken = null } = {}) {
    const protocol = this.config.protocol || "browser";

    if (protocol === "browser") {
      if (this.browserLlmState !== "ready" || !this._worker) {
        const ok = await this.initBrowserLLM(lang);
        if (!ok) throw new Error("Browser LLM unavailable");
      }
      const requestId = this._reqCounter++;
      return new Promise((resolve, reject) => {
        this._pendingWorkerReqs.set(requestId, { resolve, reject, onToken });
        this._worker.postMessage({
          type: "generate",
          requestId,
          messages,
          maxNewTokens,
          temperature,
          stream,
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
            temperature,
            maxOutputTokens: maxNewTokens + 120,
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
        temperature,
        max_tokens: maxNewTokens + 100,
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
   * Parses Pass A links cleanly and resolves them to exact active words.
   */
  parseLinks(rawText, activeCells) {
    const raw = String(rawText || "").replace(/\r/g, "\n").trim();
    if (!raw) return [];

    const activeTermMap = new Map();
    for (const c of activeCells) {
      const norm = normalizeText(c.term);
      if (norm && !activeTermMap.has(norm)) activeTermMap.set(norm, c.term);
    }

    const resolveTerm = (candidate) => {
      const norm = normalizeText(candidate);
      if (!norm) return null;
      if (activeTermMap.has(norm)) return activeTermMap.get(norm);
      for (const [k, orig] of activeTermMap.entries()) {
        if (k.length >= 3 && (norm.includes(k) || k.includes(norm))) return orig;
      }
      return null;
    };

    const links = [];
    const seenPairs = new Set();
    const linkPattern = /^[\s•\-–—*\d.)«"']*(.+?)\s*(<>|↔|<->|vs\.?|~|→|->|\/|=)\s*(.+?)(?:\s*[:—-]\s*(.+))?$/i;

    for (const line of raw.split(/\n+/)) {
      const trimmed = line.trim();
      if (!trimmed || PREAMBLE_RE.test(trimmed)) continue;
      const m = trimmed.match(linkPattern);
      if (!m) continue;

      const termA = resolveTerm(m[1].replace(/[«»"'`*]/g, "").trim());
      const op = m[2].trim();
      const termB = resolveTerm(m[3].replace(/[«»"'`*]/g, "").trim());
      const reason = (m[4] || "")
        .replace(/[«»"'`*]/g, "")
        .replace(/[.!?]+$/, "")
        .trim()
        .slice(0, 34);

      if (termA && termB && termA.toLowerCase() !== termB.toLowerCase()) {
        const key = [termA.toLowerCase(), termB.toLowerCase()].sort().join("|");
        if (!seenPairs.has(key)) {
          seenPairs.add(key);
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
    }
    return links.slice(0, 5);
  }

  extractCooccurrenceLinks(sentences, activeCells, existingLinks) {
    const seenPairs = new Set(
      existingLinks.map((l) => [l.termA.toLowerCase(), l.termB.toLowerCase()].sort().join("|"))
    );
    const termEntries = [];
    const seenTerm = new Set();
    for (const c of activeCells) {
      const k = normalizeText(c.term);
      if (k.length >= 3 && !seenTerm.has(k)) {
        seenTerm.add(k);
        termEntries.push([k, c.term]);
      }
    }

    const extra = [];
    for (const s of sentences) {
      const sNorm = normalizeText(s);
      const found = [];
      for (const [k, orig] of termEntries) {
        if (sNorm.includes(k)) found.push(orig);
      }
      for (let i = 0; i < found.length; i++) {
        for (let j = i + 1; j < found.length; j++) {
          const key = [found[i].toLowerCase(), found[j].toLowerCase()].sort().join("|");
          if (!seenPairs.has(key)) {
            seenPairs.add(key);
            extra.push({
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
    return extra.slice(0, 3);
  }

  /**
   * Sanitizes Pass B prose: strips preambles, formatting leakage, and unclosed quotes.
   */
  parseCleanSentences(rawText) {
    const raw = String(rawText || "").replace(/\r/g, "\n").trim();
    if (!raw) return [];

    const sanitizeLine = (l) => {
      let s = l
        .replace(/^[\s•\-–—*\d.)]+/, "")
        .replace(/^\*\*|\*\*$/g, "")
        .trim();
      // Remove unmatched stray quotes
      const quoteCount = (s.match(/"/g) || []).length;
      if (quoteCount % 2 === 1) s = s.replace(/"/g, "");
      s = s.replace(/^["«]|["»]$/g, "").trim();
      return s;
    };

    let lines = raw
      .split(/\n+/)
      .map(sanitizeLine)
      .filter((s) => s.length >= 16 && !PREAMBLE_RE.test(s) && !/(<>|~|\s=\s)/.test(s));

    if (lines.length <= 1 && lines[0] && lines[0].length > 75) {
      lines = lines[0]
        .split(/(?<=[.!?…])\s+/)
        .map(sanitizeLine)
        .filter((s) => s.length >= 16 && !PREAMBLE_RE.test(s));
    }

    return lines.slice(0, 4);
  }

  reconcileFreeSentences(newTexts) {
    const now = performance.now();
    const activeOld = this.sentences.filter((s) => s.status !== "lingering");
    const cells = this.getActiveCells();

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
