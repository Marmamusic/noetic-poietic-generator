// Layer 3: The Overhead Meta-Noetic Mirror ("le miroir placé au-dessus des humains")
// - Always-on deterministic geometric mirror: emergent basins, dialectical tension axes, negative-space voids
// - Optional BYOK LLM observer: non-servile, zero 1-to-1 chat, strict JSON, hysteresis-gated

export class MirrorEngine {
  constructor(topologyEngine) {
    this.topology = topologyEngine;
    this.visible = true;

    // Projected overhead artifacts (all carry mathematical provenance for anoptical inspection)
    this.basins = [];
    this.axes = [];
    this.voids = [];

    // Optional BYOK LLM mirror state
    this.llmEnabled = false;
    this.llmConfig = {
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      apiKey: "",
    };
    this.llmLabels = new Map(); // clusterSignature -> { name, updatedAt }
    this.llmAxisLabels = new Map(); // axisKey -> label
    this.llmVoidNote = null;
    this.lastLlmCallAt = 0;
    this.llmPending = false;
    this.onLlmStatus = null;
  }

  /**
   * Deterministic geometric mirror projection (runs locally, zero latency, zero API key).
   */
  update(lang = "fr") {
    const clusters = this.topology.clusters;
    const cells = this.topology.cells;
    const edges = this.topology.edges;

    // 1. Emergent Basins (translucent overhead halos with medoid + secondary term)
    const nextBasins = [];
    for (const cl of clusters) {
      const signature = cl.members
        .map((m) => m.term.toLowerCase())
        .sort()
        .slice(0, 5)
        .join("|");

      // Pick a distinct secondary term to capture basin nuance rather than flat single-word collapse
      const distinctTerms = [];
      for (const m of cl.members) {
        const low = m.term.toLowerCase();
        if (!distinctTerms.some((t) => t.toLowerCase() === low)) {
          distinctTerms.push(m.term);
        }
        if (distinctTerms.length >= 2) break;
      }

      const llmOverride = this.llmEnabled ? this.llmLabels.get(signature) : null;
      const label = llmOverride
        ? llmOverride.name
        : distinctTerms.length > 1
        ? `${distinctTerms[0]} · ${distinctTerms[1]}`
        : distinctTerms[0] || "—";

      nextBasins.push({
        kind: "basin",
        id: `basin-${cl.id}`,
        clusterId: cl.id,
        signature,
        label,
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

    // 2. Dialectical Tension Axes (never synthesized—preserved as sharp unresolved polarities)
    const basinPairTension = new Map();
    const standaloneTensions = [];

    for (const e of edges) {
      if (e.type !== "tension" || e.tension < 0.48) continue;
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
      const defaultLabel = `${bA.members[0]?.term || bA.label} ↔ ${bB.members[0]?.term || bB.label}`;
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

    // If no inter-basin tension axis exists, elevate up to 2 strongest cell-to-cell dialectical fault lines
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
    this.axes = nextAxes.slice(0, 4);

    // 3. Negative Space / Anoptical Vanishing Point (unoccupied structural gap between two basins)
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

          // Measure clearance: nearest cell to the midpoint
          let minCellDist = Infinity;
          for (const c of cells.values()) {
            const d = Math.hypot(c.x - mx, c.y - my);
            if (d < minCellDist) minCellDist = d;
          }

          if (minCellDist > 72 && (!bestGap || minCellDist > bestGap.clearance)) {
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

    // 4. Trigger hysteresis-gated LLM mirror if enabled and field shifted meaningfully
    if (
      this.llmEnabled &&
      !this.llmPending &&
      this.topology.telemetry.totalDisplacement >= 0.85 &&
      performance.now() - this.lastLlmCallAt > 7500
    ) {
      this.reflectWithLLM(lang);
    }
  }

  /**
   * Optional non-servile overhead LLM reflection.
   * Never addresses an individual; returns strictly structured spatial refractions.
   */
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
      "- Never address individuals, never give advice, never smooth over contradictions into bland consensus.",
      "- Preserve metastability and dialectical tension.",
      `- Output in ${lang === "fr" ? "French" : "English"}.`,
      "- Respond ONLY with valid JSON matching:",
      '  {"basins":[{"signature":"...","name":"2-3 word emergent concept"}],"axes":[{"key":"...","label":"Pole A ↔ Pole B"}],"blind_spot":"2-3 word unthought gap or question"}',
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
          temperature: 0.45,
          max_tokens: 260,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(snapshot) },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(raw);

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
      if (this.onLlmStatus) {
        this.onLlmStatus(`Mirror fallback (${err.message})`);
      }
    } finally {
      this.llmPending = false;
    }
  }
}
