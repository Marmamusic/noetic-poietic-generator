// Synthetic Noetic Swarm (v2 — Collective Phase Waves: Convergence → Crystallization → Bifurcation)
// Agents perceive human gestures directly and ride macro-waves so the terrain breathes organically
// instead of exhibiting flat Brownian jitter.

import { CONCEPT_POOLS, POLARITY_PAIRS, normalizeText } from "./i18n.js";

const ARCHETYPES = ["resonator", "dialectician", "bridger", "simplicity", "bifurcator"];

export class SwarmEngine {
  constructor(topologyEngine, semanticEngine) {
    this.topology = topologyEngine;
    this.semantic = semanticEngine;
    this.agentIds = [];
    this.targetCount = 16;
    this.tempo = 5; // 1..10
    this.paused = false;
    this.lang = "fr";
    this._accum = 0;
    this._cursor = 0;

    // Collective wave dynamics
    this.waveMode = "converging"; // "converging" | "crystallized" | "bifurcating"
    this._waveTicks = 0;
    this._humanEchoRemaining = 0;
    this._lastHumanTerm = null;
  }

  getPool() {
    return CONCEPT_POOLS[this.lang] || CONCEPT_POOLS.fr;
  }

  /**
   * Called whenever a human edits their cell: triggers a localized transductive response wave!
   */
  notifyHumanGesture(term) {
    this._lastHumanTerm = term;
    this._humanEchoRemaining = 5; // next 5 agent steps noticeably respond to the human's move
    this.waveMode = "converging";
    this._waveTicks = 0;
  }

  setLanguage(lang, reseed = false) {
    this.lang = lang;
    if (reseed) {
      const pool = this.getPool();
      this.agentIds.forEach((id, idx) => {
        const cell = this.topology.cells.get(id);
        if (!cell) return;
        const term = pool[(idx * 3 + Math.floor(Math.random() * 5)) % pool.length];
        this.topology.upsertCell({
          id,
          term,
          stance: cell.stance,
          isHuman: false,
          isLocal: false,
          archetype: cell.archetype,
        });
      });
    }
  }

  setTargetCount(count) {
    this.targetCount = Math.max(0, Math.min(36, count));
    const pool = this.getPool();

    while (this.agentIds.length < this.targetCount) {
      const n = this.agentIds.length + 1;
      const id = `agent-${n}-${Math.random().toString(36).slice(2, 5)}`;
      const archetype = ARCHETYPES[this.agentIds.length % ARCHETYPES.length];
      const term = pool[Math.floor(Math.random() * pool.length)];
      const stance =
        archetype === "dialectician"
          ? Math.random() < 0.45 ? "negate" : "question"
          : archetype === "bridger"
          ? "bridge"
          : "assert";

      this.agentIds.push(id);
      this.topology.upsertCell({
        id,
        term,
        stance,
        isHuman: false,
        isLocal: false,
        archetype,
      });
    }

    while (this.agentIds.length > this.targetCount) {
      const id = this.agentIds.pop();
      this.topology.removeCell(id);
    }
  }

  tick(dt, onAgentMove) {
    if (this.paused || this.agentIds.length === 0) return;
    const interval = Math.max(0.38, 3.8 - this.tempo * 0.34);
    this._accum += dt;
    if (this._accum < interval) return;
    this._accum = 0;

    // Update macro collective wave state machine
    this._waveTicks++;
    const { entropy, tensionRatio } = this.topology.telemetry;
    if (this.waveMode === "converging" && (entropy < 0.46 || this._waveTicks > 12)) {
      this.waveMode = "crystallized";
      this._waveTicks = 0;
    } else if (this.waveMode === "crystallized" && this._waveTicks > 5) {
      this.waveMode = "bifurcating";
      this._waveTicks = 0;
    } else if (this.waveMode === "bifurcating" && (tensionRatio > 0.28 || this._waveTicks > 6)) {
      this.waveMode = "converging";
      this._waveTicks = 0;
    }

    const id = this.agentIds[this._cursor % this.agentIds.length];
    this._cursor++;
    const cell = this.topology.cells.get(id);
    if (!cell) return;

    const decision = this.chooseNextGesture(cell);
    if (!decision) return;
    if (decision.term === cell.term && decision.stance === cell.stance) return;

    const leverage = this.topology.upsertCell({
      id: cell.id,
      term: decision.term,
      stance: decision.stance,
      isHuman: false,
      isLocal: false,
      archetype: cell.archetype,
    });

    if (onAgentMove) {
      onAgentMove({ id: cell.id, term: decision.term, stance: decision.stance, leverage });
    }
  }

  /**
   * Triggers a deliberate collective bifurcation wave across opposing poles.
   */
  perturb(onAgentMove) {
    this.waveMode = "bifurcating";
    this._waveTicks = 0;
    const pool = this.getPool();
    const anchorTerm = this._lastHumanTerm || this.topology.clusters[0]?.medoidTerm || pool[0];
    const counter = this.findCounterConcept(anchorTerm, pool) || pool[Math.floor(Math.random() * pool.length)];

    const sample = this.agentIds.slice(0, Math.min(5, this.agentIds.length));
    sample.forEach((id, idx) => {
      const cell = this.topology.cells.get(id);
      if (!cell) return;
      const term = idx < 2 ? counter : pool[Math.floor(Math.random() * pool.length)];
      const stance = idx < 3 ? "negate" : "question";
      const leverage = this.topology.upsertCell({
        id,
        term,
        stance,
        isHuman: false,
        isLocal: false,
        archetype: cell.archetype,
      });
      if (onAgentMove) onAgentMove({ id, term, stance, leverage });
    });
  }

  chooseNextGesture(agent) {
    const pool = this.getPool();
    const allCells = Array.from(this.topology.cells.values()).filter((c) => c.id !== agent.id);
    if (allCells.length === 0) return null;

    const humanCells = allCells.filter((c) => c.isHuman);
    const echoHuman = this._humanEchoRemaining > 0 && humanCells.length > 0;
    if (echoHuman) this._humanEchoRemaining--;

    const focusCell =
      echoHuman || (humanCells.length > 0 && Math.random() < 0.45)
        ? humanCells[Math.floor(Math.random() * humanCells.length)]
        : allCells[Math.floor(Math.random() * allCells.length)];

    // During bifurcation waves, even non-dialecticians participate in carving a counter-valley
    if (this.waveMode === "bifurcating" && (agent.archetype === "dialectician" || agent.archetype === "bifurcator")) {
      const counter = this.findCounterConcept(focusCell.term, pool);
      if (counter) {
        return { term: counter, stance: Math.random() < 0.55 ? "negate" : "question" };
      }
    }

    // During human echo waves, resonators & simplicity-seekers amplify the human's conceptual basin
    if (echoHuman && (agent.archetype === "resonator" || agent.archetype === "simplicity")) {
      const allied = this.findResonantConcept(focusCell, pool);
      return { term: allied, stance: "assert" };
    }

    switch (agent.archetype) {
      case "resonator":
        return { term: this.findResonantConcept(focusCell, pool), stance: "assert" };

      case "dialectician": {
        const counter = this.findCounterConcept(focusCell.term, pool);
        if (counter) {
          return { term: counter, stance: Math.random() < 0.45 ? "negate" : "question" };
        }
        return { term: focusCell.term, stance: "negate" };
      }

      case "bridger": {
        const clusters = this.topology.clusters;
        if (clusters.length >= 2) {
          const cA = { term: clusters[0].medoidTerm, stance: "assert" };
          const cB = { term: clusters[1].medoidTerm, stance: "assert" };
          let best = pool[0];
          let bestScore = -1;
          for (const w of pool) {
            const rA = this.semantic.computeRelation({ term: w, stance: "bridge" }, cA).resonance;
            const rB = this.semantic.computeRelation({ term: w, stance: "bridge" }, cB).resonance;
            const harmonic = (2 * rA * rB) / (rA + rB + 1e-4);
            if (harmonic > bestScore) {
              bestScore = harmonic;
              best = w;
            }
          }
          return { term: best, stance: "bridge" };
        }
        return { term: pool[Math.floor(Math.random() * pool.length)], stance: "bridge" };
      }

      case "simplicity": {
        const sample = allCells.slice(0, Math.min(4, allCells.length));
        let best = pool[0];
        let bestScore = -1;
        for (const w of pool) {
          let score = 0;
          for (const nb of sample) {
            score += this.semantic.computeRelation({ term: w, stance: "assert" }, nb).resonance;
          }
          if (score > bestScore && normalizeText(w) !== normalizeText(agent.term)) {
            bestScore = score;
            best = w;
          }
        }
        return { term: best, stance: "assert" };
      }

      case "bifurcator":
      default: {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const stance = Math.random() < 0.35 ? "question" : "assert";
        return { term: pick, stance };
      }
    }
  }

  findResonantConcept(targetCell, pool) {
    const candidates = pool
      .filter((w) => normalizeText(w) !== normalizeText(targetCell.term))
      .map((w) => ({
        w,
        rel: this.semantic.computeRelation({ term: w, stance: "assert" }, targetCell),
      }))
      .sort((a, b) => b.rel.resonance - a.rel.resonance);
    const top = candidates.slice(0, 4);
    return top[Math.floor(Math.random() * top.length)]?.w || pool[0];
  }

  findCounterConcept(term, pool) {
    const clean = normalizeText(term);
    for (const [p1, p2] of POLARITY_PAIRS) {
      if (clean.includes(p1)) {
        const match = pool.find((w) => normalizeText(w).includes(p2));
        if (match) return match;
      }
      if (clean.includes(p2)) {
        const match = pool.find((w) => normalizeText(w).includes(p1));
        if (match) return match;
      }
    }
    let best = null;
    let bestTension = 0.25;
    for (const w of pool) {
      const rel = this.semantic.computeRelation({ term: w, stance: "assert" }, { term, stance: "assert" });
      if (rel.tension > bestTension) {
        bestTension = rel.tension;
        best = w;
      }
    }
    return best;
  }
}
