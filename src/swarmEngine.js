// Synthetic Noetic Swarm (Auber–Dessalles calibration method)
// Heterogeneous agents perceive the live collective field (including human cells)
// and respond via distinct epistemic drives: Resonator, Dialectician, Bridger, Simplicity-Seeker, Bifurcator.

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
  }

  getPool() {
    return CONCEPT_POOLS[this.lang] || CONCEPT_POOLS.fr;
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

    // Add agents if needed
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

    // Remove excess agents
    while (this.agentIds.length > this.targetCount) {
      const id = this.agentIds.pop();
      this.topology.removeCell(id);
    }
  }

  /**
   * Advances synthetic agents gently so the human can feel recursive collective morphogenesis.
   */
  tick(dt, onAgentMove) {
    if (this.paused || this.agentIds.length === 0) return;
    // Tempo 5 -> ~1 agent moves every 1.4s; Tempo 10 -> every 0.45s; Tempo 1 -> every 3.6s
    const interval = Math.max(0.4, 4.0 - this.tempo * 0.36);
    this._accum += dt;
    if (this._accum < interval) return;
    this._accum = 0;

    // Pick next agent (with slight preference for agents near human cells so human edits echo!)
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
   * Deliberately injects a dialectical perturbation across 3 agents to break stagnation.
   */
  perturb(onAgentMove) {
    const pool = this.getPool();
    const sample = this.agentIds.slice(0, Math.min(4, this.agentIds.length));
    for (const id of sample) {
      const cell = this.topology.cells.get(id);
      if (!cell) continue;
      const term = pool[Math.floor(Math.random() * pool.length)];
      const stance = Math.random() < 0.5 ? "negate" : "question";
      const leverage = this.topology.upsertCell({
        id,
        term,
        stance,
        isHuman: false,
        isLocal: false,
        archetype: cell.archetype,
      });
      if (onAgentMove) onAgentMove({ id, term, stance, leverage });
    }
  }

  chooseNextGesture(agent) {
    const pool = this.getPool();
    const allCells = Array.from(this.topology.cells.values()).filter((c) => c.id !== agent.id);
    if (allCells.length === 0) return null;

    // Weight human cells higher so the human immediately experiences transductive reciprocity
    const humanCells = allCells.filter((c) => c.isHuman);
    const focusCell =
      humanCells.length > 0 && Math.random() < 0.42
        ? humanCells[Math.floor(Math.random() * humanCells.length)]
        : allCells[Math.floor(Math.random() * allCells.length)];

    const { entropy, tensionRatio } = this.topology.telemetry;

    switch (agent.archetype) {
      case "resonator": {
        // Find a concept in the pool that resonates strongly with focusCell without verbatim copying
        const candidates = pool
          .filter((w) => normalizeText(w) !== normalizeText(focusCell.term))
          .map((w) => ({
            w,
            rel: this.semantic.computeRelation({ term: w, stance: "assert" }, focusCell),
          }))
          .sort((a, b) => b.rel.resonance - a.rel.resonance);
        const top = candidates.slice(0, 4);
        const pick = top[Math.floor(Math.random() * top.length)]?.w || pool[0];
        return { term: pick, stance: "assert" };
      }

      case "dialectician": {
        // When field converges too much or tension is low, counter an active basin or human term!
        const target =
          entropy < 0.55 || tensionRatio < 0.25
            ? focusCell
            : allCells[Math.floor(Math.random() * allCells.length)];
        const counter = this.findCounterConcept(target.term, pool);
        if (counter) {
          return { term: counter, stance: Math.random() < 0.4 ? "negate" : "question" };
        }
        return { term: target.term, stance: "negate" };
      }

      case "bridger": {
        // Look for two distinct basins and propose a concept resonant with both
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
        // Dessalles Simplicity-Seeker: pick a term maximizing aggregate resonance across 3 random neighbors
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
        // Injects poetic/orthogonal novelty to prevent premature lock-in
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const stance = Math.random() < 0.35 ? "question" : "assert";
        return { term: pick, stance };
      }
    }
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
    // Otherwise pick the pool concept with highest computed dialectical tension
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
