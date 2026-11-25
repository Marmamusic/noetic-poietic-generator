// Layer 3 (v2): The Overhead Meta-Noetic Mirror ("le miroir placé au-dessus des humains")
// - Projects an emergent collective Noème (conceptual figure / tension refraction), not repetitive cluster tags
// - Records live Before → After transductive diffs whenever the human alters a concept
// - Optional BYOK non-servile LLM observer (strict JSON only, zero 1-to-1 chat)

export class MirrorEngine {
  constructor(topologyEngine) {
    this.topology = topologyEngine;
    this.visible = true;

    this.basins = [];
    this.axes = [];
    this.voids = [];

    // Living overhead Noème (meta-noetic collective refraction)
    this.noeme = "";
    this.noemeSub = "";
    this.lastDiff = null; // { prevNoeme, nextNoeme, triggerTerm, leverage, bornAt }

    // Optional BYOK LLM mirror state
    this.llmEnabled = false;
    this.llmConfig = {
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      apiKey: "",
    };
    this.llmNoeme = null;
    this.llmLabels = new Map();
    this.llmAxisLabels = new Map();
    this.llmVoidNote = null;
    this.lastLlmCallAt = 0;
    this.llmPending = false;
    this.onLlmStatus = null;
  }

  /**
   * Deterministic geometric + conceptual-regime mirror projection (zero API key required).
   */
  update(lang = "fr") {
    const clusters = this.topology.clusters;
    const cells = this.topology.cells;
    const edges = this.topology.edges;
    const semantic = this.topology.semantic;
    const compass = this.topology.compass;

    // 1. Emergent Basins named by their conceptual regime (axis orientation), NOT echoing member words!
    const nextBasins = [];
    for (const cl of clusters) {
      const signature = cl.members
        .map((m) => m.term.toLowerCase())
        .sort()
        .slice(0, 5)
        .join("|");

      const regime = semantic.describeDirection(cl.centroidAxis, lang);
      const llmOverride = this.llmEnabled ? this.llmLabels.get(signature) : null;
      const label = llmOverride ? llmOverride.name : regime.pos;

      nextBasins.push({
        kind: "basin",
        id: `basin-${cl.id}`,
        clusterId: cl.id,
        signature,
        label,
        regimePrimary: regime.primaryPos,
        hue: cl.hue || 200,
        isLlmNamed: Boolean(llmOverride),
        cx: cl.cx,
        cy: cl.cy,
        radius: cl.radius,
        coherence: cl.coherence,
        members: cl.members,
        cellIds: cl.cellIds,
      });
    }
    this.basins = nextBasins;

    // 2. Dialectical Tension Axes (preserved as sharp unresolved polarities)
    const basinPairTension = new Map();
    const standaloneTensions = [];

    for (const e of edges) {
      if (e.type !== "tension" || e.tension < 0.46) continue;
      const a = cells.get(e.a);
      const b = cells.get(e.b);
      if (!a || !b) continue;

      if (a.clusterId !== -1 && b.clusterId !== -1 && a.clusterId !== b.clusterId) {
        const lo = Math.min(a.clusterId, b.clusterId);
        const hi = Math.max(a.clusterId, b.clusterId);
        const key = `${lo}<->${hi}`;
        if (!basinPairTension.has(key)) {
          basinPairTension.set(key, { lo, hi, sum: 0, count: 0, pairs: [] });
        }
        const entry = basinPairTension.get(key);
        entry.sum += e.tension;
        entry.count++;
        entry.pairs.push({ a: a.term, b: b.term, tension: e.tension, aId: a.id, bId: b.id });
      } else {
        standaloneTensions.push({ a, b, tension: e.tension });
      }
    }

    const nextAxes = [];
    for (const [key, entry] of basinPairTension.entries()) {
      const bA = nextBasins.find((x) => x.clusterId === entry.lo);
      const bB = nextBasins.find((x) => x.clusterId === entry.hi);
      if (!bA || !bB) continue;

      const strength = Math.min(1, entry.sum / entry.count);
      const defaultLabel = `${bA.regimePrimary} ↔ ${bB.regimePrimary}`;
      const llmLbl = this.llmEnabled ? this.llmAxisLabels.get(key) : null;

      nextAxes.push({
        kind: "axis",
        id: `axis-${key}`,
        key,
        label: llmLbl || defaultLabel,
        isLlmNamed: Boolean(llmLbl),
        x1: bA.cx,
        y1: bA.cy,
        x2: bB.cx,
        y2: bB.cy,
        mx: (bA.cx + bB.cx) / 2,
        my: (bA.cy + bB.cy) / 2,
        strength: Number(strength.toFixed(3)),
        pairs: entry.pairs,
      });
    }

    if (nextAxes.length === 0 && standaloneTensions.length > 0) {
      standaloneTensions.sort((p, q) => q.tension - p.tension);
      for (const st of standaloneTensions.slice(0, 2)) {
        const key = st.a.id < st.b.id ? `${st.a.id}<->${st.b.id}` : `${st.b.id}<->${st.a.id}`;
        nextAxes.push({
          kind: "axis",
          id: `axis-${key}`,
          key,
          label: `${st.a.term} ↔ ${st.b.term}`,
          isLlmNamed: false,
          x1: st.a.x,
          y1: st.a.y,
          x2: st.b.x,
          y2: st.b.y,
          mx: (st.a.x + st.b.x) / 2,
          my: (st.a.y + st.b.y) / 2,
          strength: st.tension,
          pairs: [{ a: st.a.term, b: st.b.term, tension: st.tension, aId: st.a.id, bId: st.b.id }],
        });
      }
    }
    this.axes = nextAxes.slice(0, 3);

    // 3. Negative Space / Vanishing Point (unthought bridge between basins)
    const nextVoids = [];
    if (nextBasins.length >= 2) {
      let bestGap = null;
      for (let i = 0; i < nextBasins.length; i++) {
        for (let j = i + 1; j < nextBasins.length; j++) {
          const bA = nextBasins[i];
          const bB = nextBasins[j];
          const mx = (bA.cx + bB.cx) / 2;
          const my = (bA.cy + bB.cy) / 2;
          const dist = Math.hypot(bB.cx - bA.cx, bB.cy - bA.cy);
          if (dist < 150) continue;

          let minCellDist = Infinity;
          for (const c of cells.values()) {
            const d = Math.hypot(c.x - mx, c.y - my);
            if (d < minCellDist) minCellDist = d;
          }

          if (minCellDist > 68 && (!bestGap || minCellDist > bestGap.clearance)) {
            bestGap = {
              kind: "void",
              id: `void-${bA.clusterId}-${bB.clusterId}`,
              x: mx,
              y: my,
              clearance: Math.round(minCellDist),
              between: [bA.label, bB.label],
              label: this.llmVoidNote || (lang === "fr" ? "∅ impensé" : "∅ unthought"),
            };
          }
        }
      }
      if (bestGap) nextVoids.push(bestGap);
    }
    this.voids = nextVoids;

    // 4. Synthesize the Living Overhead Collective Noème (Gestalt refraction above the whole field)
    this.synthesizeNoeme(lang, compass);

    // 5. Hysteresis-gated optional LLM observer
    if (
      this.llmEnabled &&
      !this.llmPending &&
      this.topology.telemetry.totalDisplacement >= 0.85 &&
      performance.now() - this.lastLlmCallAt > 7500
    ) {
      this.reflectWithLLM(lang);
    }
  }

  synthesizeNoeme(lang, compass) {
    if (this.llmEnabled && this.llmNoeme) {
      this.noeme = this.llmNoeme;
      this.noemeSub = `${compass.axis1Label}  |  ${compass.axis2Label}`;
      return;
    }

    const { phase } = this.topology.telemetry;
    const globalMeanDir = this.topology.semantic.describeDirection(this.topology.meanAxis, lang);
    const topBasin = this.basins[0]?.regimePrimary || globalMeanDir.primaryPos;
    const secondBasin = this.basins[1]?.regimePrimary || globalMeanDir.primaryNeg;
    const topAxis = this.axes[0]?.label || compass.axis1Label;

    if (lang === "fr") {
      if (phase === "polarized") {
        this.noeme = `Fracture dialectique : ${topAxis} en tension vive`;
      } else if (phase === "crystallizing") {
        this.noeme = `Cristallisation d’un horizon de ${topBasin} — contrepoint ${secondBasin}`;
      } else if (phase === "diffuse") {
        this.noeme = `Milieu pré-individuel ouvert : gestation entre ${compass.axis1Label}`;
      } else {
        this.noeme = `Champ métastable : ${topBasin} traversé par ${topAxis}`;
      }
      this.noemeSub = `Axes émergents : ${compass.axis1Label}  ·  ${compass.axis2Label}`;
    } else {
      if (phase === "polarized") {
        this.noeme = `Dialectical fault line: ${topAxis} in active tension`;
      } else if (phase === "crystallizing") {
        this.noeme = `Crystallizing horizon of ${topBasin} — counterpointed by ${secondBasin}`;
      } else if (phase === "diffuse") {
        this.noeme = `Open pre-individual field: gestation across ${compass.axis1Label}`;
      } else {
        this.noeme = `Metastable horizon: ${topBasin} traversed by ${topAxis}`;
      }
      this.noemeSub = `Emergent axes: ${compass.axis1Label}  ·  ${compass.axis2Label}`;
    }
  }

  /**
   * Captures a live Before → After transductive inflection right when the human mutates their cell.
   */
  recordHumanInflection(prevNoeme, triggerTerm, leverage) {
    const nextNoeme = this.noeme;
    this.lastDiff = {
      prevNoeme: prevNoeme || nextNoeme,
      nextNoeme,
      changed: prevNoeme && prevNoeme !== nextNoeme,
      triggerTerm,
      leverage,
      bornAt: performance.now(),
    };
  }

  async reflectWithLLM(lang = "fr") {
    if (this.llmPending) return;
    const endpoint = (this.llmConfig.endpoint || "").trim();
    if (!endpoint) return;

    const isLocalOllama = endpoint.includes("localhost") || endpoint.includes("127.0.0.1");
    if (!isLocalOllama && !this.llmConfig.apiKey) {
      if (this.onLlmStatus) this.onLlmStatus("API key required for remote endpoint");
      return;
    }

    this.llmPending = true;
    this.lastLlmCallAt = performance.now();
    this.topology.telemetry.totalDisplacement = 0;
    if (this.onLlmStatus) this.onLlmStatus(lang === "fr" ? "Réflexion méta-noétique…" : "Meta-noetic reflection…");

    const snapshot = {
      language: lang,
      phase: this.topology.telemetry.phase,
      compass: this.topology.compass,
      basins: this.basins.map((b) => ({
        signature: b.signature,
        terms: b.members.map((m) => `${m.term} (${m.stance})`),
        coherence: b.coherence,
      })),
      axes: this.axes.map((a) => ({
        key: a.key,
        current: a.label,
        strength: a.strength,
      })),
    };

    const systemPrompt = [
      "You are NOT an assistant, chatbot, or summarizer.",
      "You are an overhead anoptical mirror observing a collective noetic field inspired by Olivier Auber's Poietic Generator and Gilbert Simondon's transindividuation.",
      "Rules:",
      "- Never address individuals, never give advice, never resolve contradictions into consensus.",
      "- Preserve metastability and dialectical tension.",
      "- Synthesize a single concise emergent collective 'noeme' (8-14 words max) capturing the living Gestalt and tension of the whole field.",
      `- Output in ${lang === "fr" ? "French" : "English"}.`,
      "- Respond ONLY with valid JSON matching:",
      '  {"noeme":"concise emergent collective thought-form","basins":[{"signature":"...","name":"2-3 word conceptual regime"}],"axes":[{"key":"...","label":"Pole A ↔ Pole B"}],"blind_spot":"2-3 word unthought gap"}',
    ].join("\n");

    try {
      const headers = { "Content-Type": "application/json" };
      if (this.llmConfig.apiKey) {
        headers.Authorization = `Bearer ${this.llmConfig.apiKey}`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.llmConfig.model || "gpt-4o-mini",
          temperature: 0.5,
          max_tokens: 300,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(snapshot) },
          ],
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(raw);

      if (typeof parsed.noeme === "string" && parsed.noeme.trim()) {
        this.llmNoeme = parsed.noeme.trim().slice(0, 110);
      }
      if (Array.isArray(parsed.basins)) {
        for (const item of parsed.basins) {
          if (item.signature && item.name) {
            this.llmLabels.set(item.signature, {
              name: String(item.name).slice(0, 32),
              updatedAt: performance.now(),
            });
          }
        }
      }
      if (Array.isArray(parsed.axes)) {
        for (const ax of parsed.axes) {
          if (ax.key && ax.label) {
            this.llmAxisLabels.set(ax.key, String(ax.label).slice(0, 38));
          }
        }
      }
      if (typeof parsed.blind_spot === "string" && parsed.blind_spot.trim()) {
        this.llmVoidNote = `∅ ${parsed.blind_spot.trim().slice(0, 28)}`;
      }

      if (this.onLlmStatus) {
        const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        this.onLlmStatus(lang === "fr" ? `Reflet LLM synchronisé (${ts})` : `LLM reflection synced (${ts})`);
      }
    } catch (err) {
      console.warn("LLM mirror reflection failed:", err);
      if (this.onLlmStatus) this.onLlmStatus(`Mirror fallback (${err.message})`);
    } finally {
      this.llmPending = false;
    }
  }
}
