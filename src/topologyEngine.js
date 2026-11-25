// Layer 2 (v2): Live 2D PCA Semantic Compass, Continuous Potential-Guided Physics,
// Edge-to-Edge Auber Spiral Mosaic, Conviction Weighting, Ghost Preview & Telemetry

import { AXIS_COUNT } from "./semanticEngine.js?v=5";

/**
 * Exact Ulam / Olivier Auber square spiral coordinates (index 0 at center).
 */
export function spiralCoords(index) {
  if (index <= 0) return { gx: 0, gy: 0 };
  const k = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
  let t = 2 * k + 1;
  let m = t * t;
  t -= 1;
  if (index >= m - t) return { gx: k - (m - index), gy: -k };
  m -= t;
  if (index >= m - t) return { gx: -k, gy: -k + (m - index) };
  m -= t;
  if (index >= m - t) return { gx: -k + (m - index), gy: k };
  return { gx: k, gy: k - (m - index - t) };
}

function normalize24(v) {
  let s = 0;
  for (let i = 0; i < AXIS_COUNT; i++) s += v[i] * v[i];
  const n = Math.sqrt(s);
  const out = new Float32Array(AXIS_COUNT);
  if (n < 1e-8) {
    out[0] = 1;
    return out;
  }
  for (let i = 0; i < AXIS_COUNT; i++) out[i] = v[i] / n;
  return out;
}

function dot24(a, b) {
  let s = 0;
  for (let i = 0; i < AXIS_COUNT; i++) s += a[i] * b[i];
  return s;
}

export const MOSAIC_TILE_W = 122;
export const MOSAIC_TILE_H = 74;

export class TopologyEngine {
  constructor(semanticEngine) {
    this.semantic = semanticEngine;
    this.cells = new Map();
    this.edges = [];
    this.clusters = [];
    this.ripples = [];
    this.llmLinks = new Map(); // normalized "termA|termB" -> { termA, termB, type, reason, weight, bornAt }
    this.topologyMode = "manifold"; // "manifold" | "spiral"
    this.topologyBlend = 0; // 0 = continuous terrain manifold, 1 = touching Auber spiral mosaic

    // Live stabilized 2D Principal Component Axes (in 24-dim conceptual space)
    this.pc1 = new Float32Array(AXIS_COUNT);
    this.pc2 = new Float32Array(AXIS_COUNT);
    this.pc1[0] = 1; // initial seed: autonomy vs automatism
    this.pc2[2] = 1; // initial seed: technics vs living body
    this.meanAxis = new Float32Array(AXIS_COUNT);
    this.compass = {
      east: "autonomie",
      west: "automatisme",
      north: "corps vivant",
      south: "technique",
      axis1Label: "automatisme ↔ autonomie",
      axis2Label: "technique ↔ corps vivant",
    };

    this.telemetry = {
      entropy: 0.5,
      tensionRatio: 0,
      metastability: 0.5,
      simplicity: 0,
      phase: "metastable",
      cellCount: 0,
      totalDisplacement: 0,
    };

    this._prevClusterMap = new Map();
    this._prevEdgeSignature = new Map();
    this._prevEntropy = 0.5;
  }

  upsertCell({ id, term, stance = "assert", intensity = 1.0, isHuman = false, isLocal = false, archetype = null }) {
    const existing = this.cells.get(id);
    const embedding = this.semantic.embedSync(term);
    const axisVec = this.semantic.getAxisVector(term);
    const hue = this.semantic.conceptToHue(term, stance);
    const now = performance.now();

    if (existing) {
      const changed =
        existing.term !== term ||
        existing.stance !== stance ||
        Math.abs((existing.intensity || 1) - intensity) > 0.05;
      existing.prevTerm = existing.term;
      existing.term = term;
      existing.stance = stance;
      existing.intensity = intensity;
      existing.embedding = embedding;
      existing.axisVec = axisVec;
      existing.hue = hue;
      existing.updatedAt = now;
      existing.isHuman = isHuman;
      existing.isLocal = isLocal;
      if (archetype) existing.archetype = archetype;

      if (changed) {
        const leverage = this.recomputeGraph(id);
        existing.lastLeverage = leverage;
        this.emitRipple(existing, leverage);
        this.telemetry.totalDisplacement += Math.max(0.18, leverage);
        return leverage;
      }
      return existing.lastLeverage || 0;
    }

    const idx = this.cells.size;
    const { gx, gy } = spiralCoords(idx);
    const angle = idx * 2.3999632;
    const r = Math.min(0.68, 0.14 + Math.sqrt(idx) * 0.13);

    const cell = {
      id,
      term,
      prevTerm: term,
      stance,
      intensity,
      isHuman,
      isLocal,
      archetype,
      embedding,
      axisVec,
      hue,
      spiralIndex: idx,
      gx,
      gy,
      mx: Math.cos(angle) * r * 260,
      my: Math.sin(angle) * r * 190,
      targetX: Math.cos(angle) * r * 260,
      targetY: Math.sin(angle) * r * 190,
      vx: 0,
      vy: 0,
      sx: gx * MOSAIC_TILE_W,
      sy: gy * MOSAIC_TILE_H,
      x: Math.cos(angle) * r * 260,
      y: Math.sin(angle) * r * 190,
      clusterId: -1,
      llmGravity: 0,
      lastLeverage: 0,
      updatedAt: now,
    };

    this.cells.set(id, cell);
    this.reindexSpiral();
    const leverage = this.recomputeGraph(id);
    cell.lastLeverage = leverage;
    if (isHuman) this.emitRipple(cell, Math.max(0.25, leverage));
    return leverage;
  }

  removeCell(id) {
    if (!this.cells.has(id)) return false;
    this.cells.delete(id);
    this.reindexSpiral();
    this.recomputeGraph(null);
    return true;
  }

  async refreshEmbeddingsAsync() {
    const list = Array.from(this.cells.values());
    for (const cell of list) {
      cell.embedding = await this.semantic.embed(cell.term);
    }
    this.recomputeGraph(null);
    this.telemetry.totalDisplacement += 1.0;
  }

  reindexSpiral() {
    const ordered = Array.from(this.cells.values()).sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
      if (a.isHuman !== b.isHuman) return a.isHuman ? -1 : 1;
      return a.spiralIndex - b.spiralIndex;
    });

    ordered.forEach((cell, idx) => {
      cell.spiralIndex = idx;
      const { gx, gy } = spiralCoords(idx);
      cell.gx = gx;
      cell.gy = gy;
      cell.sx = gx * MOSAIC_TILE_W;
      cell.sy = gy * MOSAIC_TILE_H;
    });
  }

  /**
   * Computes stabilized 2D Principal Components of all active cells' conceptual axis vectors.
   * Uses warm-started power iteration + Procrustes sign alignment so the compass rotates smoothly without flipping.
   */
  updatePCACompass(list, lang = "fr") {
    const n = list.length;
    if (n < 2) return;

    // 1. Weighted mean vector (higher conviction dents the collective frame more)
    const mean = new Float32Array(AXIS_COUNT);
    let wSum = 0;
    for (const c of list) {
      const w = (c.intensity || 1) * (c.isHuman ? 1.45 : 1.0);
      const av = c.axisVec || this.semantic.getAxisVector(c.term);
      for (let i = 0; i < AXIS_COUNT; i++) mean[i] += av[i] * w;
      wSum += w;
    }
    for (let i = 0; i < AXIS_COUNT; i++) mean[i] /= Math.max(1e-6, wSum);
    this.meanAxis = mean;

    // Centered rows
    const centered = list.map((c) => {
      const av = c.axisVec || this.semantic.getAxisVector(c.term);
      const row = new Float32Array(AXIS_COUNT);
      const w = Math.sqrt((c.intensity || 1) * (c.isHuman ? 1.45 : 1.0));
      for (let i = 0; i < AXIS_COUNT; i++) row[i] = (av[i] - mean[i]) * w;
      return row;
    });

    const powerStep = (vec, orthoTo = null) => {
      const out = new Float32Array(AXIS_COUNT);
      for (const row of centered) {
        const proj = dot24(row, vec);
        for (let i = 0; i < AXIS_COUNT; i++) out[i] += row[i] * proj;
      }
      if (orthoTo) {
        const overlap = dot24(out, orthoTo);
        for (let i = 0; i < AXIS_COUNT; i++) out[i] -= orthoTo[i] * overlap;
      }
      return normalize24(out);
    };

    // Warm-start from previous PC1 / PC2 for temporal smoothness
    let v1 = new Float32Array(this.pc1);
    for (let k = 0; k < 7; k++) v1 = powerStep(v1);
    if (dot24(v1, this.pc1) < 0) {
      for (let i = 0; i < AXIS_COUNT; i++) v1[i] = -v1[i];
    }

    // Smooth blend to avoid snappy compass jumps
    const blended1 = new Float32Array(AXIS_COUNT);
    for (let i = 0; i < AXIS_COUNT; i++) blended1[i] = this.pc1[i] * 0.65 + v1[i] * 0.35;
    this.pc1 = normalize24(blended1);

    let v2 = new Float32Array(this.pc2);
    for (let k = 0; k < 7; k++) v2 = powerStep(v2, this.pc1);
    if (dot24(v2, this.pc2) < 0) {
      for (let i = 0; i < AXIS_COUNT; i++) v2[i] = -v2[i];
    }
    const blended2 = new Float32Array(AXIS_COUNT);
    for (let i = 0; i < AXIS_COUNT; i++) blended2[i] = this.pc2[i] * 0.65 + v2[i] * 0.35;
    // Re-orthogonalize pc2 against pc1
    const ov = dot24(blended2, this.pc1);
    for (let i = 0; i < AXIS_COUNT; i++) blended2[i] -= this.pc1[i] * ov;
    this.pc2 = normalize24(blended2);

    // Project every cell onto PC1 (East-West) and PC2 (North-South)
    let maxAbsX = 0.25;
    let maxAbsY = 0.25;
    const rawCoords = list.map((c) => {
      const av = c.axisVec || this.semantic.getAxisVector(c.term);
      const diff = new Float32Array(AXIS_COUNT);
      for (let i = 0; i < AXIS_COUNT; i++) diff[i] = av[i] - mean[i];
      const px = dot24(diff, this.pc1);
      const py = -dot24(diff, this.pc2); // positive PC2 points North (up on canvas)
      if (Math.abs(px) > maxAbsX) maxAbsX = Math.abs(px);
      if (Math.abs(py) > maxAbsY) maxAbsY = Math.abs(py);
      return { c, px, py };
    });

    for (const { c, px, py } of rawCoords) {
      c.targetX = (px / maxAbsX) * 330;
      c.targetY = (py / maxAbsY) * 215;
    }

    this.refreshCompassLabels(lang);
  }

  refreshCompassLabels(lang = "fr") {
    const d1 = this.semantic.describeDirection(this.pc1, lang);
    const d2 = this.semantic.describeDirection(this.pc2, lang);
    this.compass = {
      east: d1.pos,
      west: d1.neg,
      north: d2.pos,
      south: d2.neg,
      axis1Label: `${d1.primaryNeg} ↔ ${d1.primaryPos}`,
      axis2Label: `${d2.primaryNeg} ↔ ${d2.primaryPos}`,
    };
  }

  /**
   * Projects a draft concept live (before Enter!) so the user physically feels
   * where their word will land and which tensions/resonances will ignite.
   */
  computeGhostPreview(localCellId, draftTerm, draftStance = "assert") {
    const clean = (draftTerm || "").trim();
    const localCell = this.cells.get(localCellId);
    if (!clean || !localCell) return null;
    if (clean.toLowerCase() === localCell.term.toLowerCase() && draftStance === localCell.stance) {
      return null;
    }

    const draftEmb = this.semantic.embedSync(clean);
    const draftAxis = this.semantic.getAxisVector(clean);
    const draftHue = this.semantic.conceptToHue(clean, draftStance);

    const diff = new Float32Array(AXIS_COUNT);
    for (let i = 0; i < AXIS_COUNT; i++) diff[i] = draftAxis[i] - this.meanAxis[i];
    const px = dot24(diff, this.pc1);
    const py = -dot24(diff, this.pc2);

    // Estimate target world coordinates on the live PCA terrain
    const gx = Math.max(-360, Math.min(360, px * 380));
    const gy = Math.max(-230, Math.min(230, py * 250));

    const draftObj = { term: clean, stance: draftStance, embedding: draftEmb };
    const rays = [];
    for (const other of this.cells.values()) {
      if (other.id === localCellId) continue;
      const rel = this.semantic.computeRelation(draftObj, other);
      if (rel.type === "tension" && rel.tension >= 0.45) {
        rays.push({ targetId: other.id, x: other.x, y: other.y, type: "tension", strength: rel.tension });
      } else if ((rel.type === "resonance" || rel.type === "bridge") && rel.resonance >= 0.42) {
        rays.push({ targetId: other.id, x: other.x, y: other.y, type: rel.type, strength: rel.resonance });
      }
    }
    rays.sort((a, b) => b.strength - a.strength);

    return {
      fromX: localCell.x,
      fromY: localCell.y,
      x: gx,
      y: gy,
      term: clean,
      stance: draftStance,
      hue: draftHue,
      rays: rays.slice(0, 6),
    };
  }

  /**
   * Integrates LLM-discovered conceptual links directly into the living topology & word-cloud gravity.
   * Older LLM links gently fade after ~50 seconds so the map stays fluid and responsive.
   */
  applyLlmLinks(links, lang = "fr") {
    const now = performance.now();

    // Gently age out stale LLM links (> 50s)
    for (const [k, entry] of this.llmLinks.entries()) {
      if (now - entry.bornAt > 50000) {
        this.llmLinks.delete(k);
      } else {
        entry.weight = Math.max(0.45, entry.weight * 0.85);
      }
    }

    // Decay existing cell LLM gravity before boosting newly woven words
    for (const c of this.cells.values()) {
      c.llmGravity = (c.llmGravity || 0) * 0.55;
    }

    for (const link of links || []) {
      if (!link.termA || !link.termB) continue;
      const aLow = link.termA.toLowerCase();
      const bLow = link.termB.toLowerCase();
      if (aLow === bLow) continue;
      const pairKey = aLow < bLow ? `${aLow}|${bLow}` : `${bLow}|${aLow}`;
      this.llmLinks.set(pairKey, {
        termA: link.termA,
        termB: link.termB,
        type: link.type === "tension" ? "tension" : "resonance",
        reason: link.reason || "",
        weight: link.weight || 0.88,
        source: link.source || "llm",
        bornAt: now,
      });

      // Boost luminous presence & topographic gravity of every word woven by the LLM
      for (const c of this.cells.values()) {
        const cLow = c.term.toLowerCase();
        if (cLow === aLow || cLow === bLow) {
          c.llmGravity = Math.min(1, (c.llmGravity || 0) + 0.45);
        }
      }
    }

    this.recomputeGraph(null, lang);
  }

  recomputeGraph(perturbedCellId = null, lang = "fr") {
    const list = Array.from(this.cells.values());
    const n = list.length;
    this.telemetry.cellCount = n;

    if (n === 0) {
      this.edges = [];
      this.clusters = [];
      return 0;
    }

    // Update live 2D PCA compass so manifold coordinates remain semantically meaningful
    this.updatePCACompass(list, lang);

    const newEdges = [];
    const newEdgeSig = new Map();
    let totalPairs = 0;
    let resonanceSum = 0;
    let resonanceSqSum = 0;
    let tensionEdges = 0;
    let activeEdges = 0;

    const adj = new Map();
    for (const c of list) adj.set(c.id, []);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = list[i];
        const b = list[j];
        const rel = this.semantic.computeRelation(a, b);

        // Check whether the LLM explicitly forged a living conceptual link between these two words!
        const aLow = a.term.toLowerCase();
        const bLow = b.term.toLowerCase();
        const pairKey = aLow < bLow ? `${aLow}|${bLow}` : `${bLow}|${aLow}`;
        const llmLink = this.llmLinks.get(pairKey);

        let resonance = rel.resonance;
        let tension = rel.tension;
        let edgeType = rel.type;
        let isLlmLink = false;
        let llmReason = "";

        if (llmLink) {
          isLlmLink = true;
          llmReason = llmLink.reason || "";
          if (llmLink.type === "tension") {
            tension = Math.max(tension, llmLink.weight);
            resonance *= 0.3;
            edgeType = "tension";
          } else {
            resonance = Math.max(resonance, llmLink.weight);
            edgeType = "resonance";
          }
        }

        totalPairs++;
        resonanceSum += resonance;
        resonanceSqSum += resonance * resonance;

        const manhattan = Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy);
        const isSpiralNeighbor = manhattan === 1;

        if (isLlmLink || edgeType !== "neutral" || (isSpiralNeighbor && (resonance > 0.2 || tension > 0.25))) {
          const edge = {
            a: a.id,
            b: b.id,
            resonance: Number(resonance.toFixed(3)),
            tension: Number(tension.toFixed(3)),
            type: edgeType === "neutral" ? (tension > resonance ? "tension" : "resonance") : edgeType,
            isSpiralNeighbor,
            isLlmLink,
            llmReason,
          };
          newEdges.push(edge);
          const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
          newEdgeSig.set(key, `${edge.type}:${Math.round((edge.resonance + edge.tension) * 10)}`);

          if (edgeType !== "neutral" || isLlmLink) {
            activeEdges++;
            if (edge.type === "tension") tensionEdges++;
          }
          if ((edge.type === "resonance" || edge.type === "bridge") && edge.resonance >= 0.40) {
            adj.get(a.id).push({ id: b.id, weight: edge.resonance });
            adj.get(b.id).push({ id: a.id, weight: edge.resonance });
          }
        }
      }
    }

    const edgeCounts = new Map();
    newEdges.sort((e1, e2) => {
      if (e1.isLlmLink !== e2.isLlmLink) return e1.isLlmLink ? -1 : 1;
      return (e2.resonance + e2.tension) - (e1.resonance + e1.tension);
    });
    const prunedEdges = [];
    for (const e of newEdges) {
      const ca = edgeCounts.get(e.a) || 0;
      const cb = edgeCounts.get(e.b) || 0;
      if (e.isLlmLink || e.isSpiralNeighbor || (ca < 4 && cb < 4) || e.type === "tension") {
        prunedEdges.push(e);
        edgeCounts.set(e.a, ca + 1);
        edgeCounts.set(e.b, cb + 1);
      }
    }
    this.edges = prunedEdges;

    const clusters = this.detectBasins(list, adj);
    this.clusters = clusters;

    const meanRes = totalPairs > 0 ? resonanceSum / totalPairs : 0;
    const varRes = totalPairs > 0 ? Math.max(0, resonanceSqSum / totalPairs - meanRes * meanRes) : 0;

    let clusterH = 0;
    if (n > 1 && clusters.length > 0) {
      for (const cl of clusters) {
        const p = cl.cellIds.length / n;
        if (p > 0) clusterH -= p * Math.log2(p);
      }
      const clusteredCount = clusters.reduce((acc, c) => acc + c.cellIds.length, 0);
      const singletons = Math.max(0, n - clusteredCount);
      for (let s = 0; s < singletons; s++) {
        const p = 1 / n;
        clusterH -= p * Math.log2(p);
      }
      clusterH /= Math.log2(n);
    } else {
      clusterH = 1;
    }

    const entropy = Math.max(0, Math.min(1, 0.62 * clusterH + 0.38 * (1 - Math.min(1, meanRes * 1.8))));
    const tensionRatio = activeEdges > 0 ? Math.min(1, tensionEdges / activeEdges) : 0;

    const metastability = Math.max(
      0,
      Math.min(1, 4 * entropy * (1 - entropy) * (0.48 + 0.52 * Math.min(1, tensionRatio * 2.4)))
    );

    const uniqueTerms = new Set(list.map((c) => c.term.toLowerCase().trim())).size;
    const lexicalDiversity = n > 1 ? uniqueTerms / n : 0;
    const avgCoherence = clusters.length > 0
      ? clusters.reduce((s, c) => s + c.coherence * c.cellIds.length, 0) / n
      : 0;
    const simplicity = Math.max(0, Math.min(1, avgCoherence * (0.55 + 0.75 * lexicalDiversity) + Math.sqrt(varRes) * 0.4));

    let phase = "metastable";
    if (entropy > 0.74) {
      phase = "diffuse";
    } else if (tensionRatio >= 0.30 && clusters.length >= 2) {
      phase = "polarized";
    } else if (simplicity >= 0.48 && entropy < 0.52) {
      phase = "crystallizing";
    } else {
      phase = "metastable";
    }

    let leverage = 0;
    if (perturbedCellId) {
      let edgeDiffs = 0;
      const allKeys = new Set([...this._prevEdgeSignature.keys(), ...newEdgeSig.keys()]);
      for (const k of allKeys) {
        if (this._prevEdgeSignature.get(k) !== newEdgeSig.get(k)) edgeDiffs++;
      }
      let clusterReassignments = 0;
      for (const c of list) {
        if (this._prevClusterMap.get(c.id) !== c.clusterId) clusterReassignments++;
      }
      const entropyDelta = Math.abs(entropy - this._prevEntropy);
      leverage = Math.min(
        1,
        (edgeDiffs / Math.max(4, n * 1.15)) * 0.52 +
        (clusterReassignments / Math.max(2, n)) * 0.35 +
        entropyDelta * 1.8
      );
    }

    this._prevClusterMap = new Map(list.map((c) => [c.id, c.clusterId]));
    this._prevEdgeSignature = newEdgeSig;
    this._prevEntropy = entropy;

    this.telemetry.entropy = Number(entropy.toFixed(3));
    this.telemetry.tensionRatio = Number(tensionRatio.toFixed(3));
    this.telemetry.metastability = Number(metastability.toFixed(3));
    this.telemetry.simplicity = Number(simplicity.toFixed(3));
    this.telemetry.phase = phase;

    return Number(leverage.toFixed(3));
  }

  detectBasins(list, adj) {
    const labels = new Map();
    list.forEach((c, i) => labels.set(c.id, i));

    for (let iter = 0; iter < 6; iter++) {
      let changed = false;
      for (const c of list) {
        const neighbors = adj.get(c.id) || [];
        if (neighbors.length === 0) continue;
        const scores = new Map();
        scores.set(labels.get(c.id), 0.35);
        for (const nb of neighbors) {
          const lbl = labels.get(nb.id);
          scores.set(lbl, (scores.get(lbl) || 0) + nb.weight);
        }
        let bestLbl = labels.get(c.id);
        let bestScore = -1;
        for (const [lbl, sc] of scores.entries()) {
          if (sc > bestScore || (sc === bestScore && lbl < bestLbl)) {
            bestScore = sc;
            bestLbl = lbl;
          }
        }
        if (bestLbl !== labels.get(c.id)) {
          labels.set(c.id, bestLbl);
          changed = true;
        }
      }
      if (!changed) break;
    }

    const groups = new Map();
    for (const c of list) {
      const lbl = labels.get(c.id);
      if (!groups.has(lbl)) groups.set(lbl, []);
      groups.get(lbl).push(c);
    }

    const clusters = [];
    let cid = 0;
    for (const members of groups.values()) {
      if (members.length < 2) {
        members[0].clusterId = -1;
        continue;
      }

      let bestMedoid = members[0];
      let bestSum = -1;
      let pairSum = 0;
      let pairCount = 0;
      const centroidAxis = new Float32Array(AXIS_COUNT);

      for (const m of members) {
        const av = m.axisVec || this.semantic.getAxisVector(m.term);
        for (let k = 0; k < AXIS_COUNT; k++) centroidAxis[k] += av[k] / members.length;

        let s = 0;
        for (const o of members) {
          if (m.id === o.id) continue;
          const rel = this.semantic.computeRelation(m, o);
          s += rel.resonance;
          pairSum += rel.resonance;
          pairCount++;
        }
        if (s > bestSum) {
          bestSum = s;
          bestMedoid = m;
        }
      }

      const coherence = pairCount > 0 ? pairSum / pairCount : 0.5;
      const currentCid = cid++;
      members.forEach((m) => (m.clusterId = currentCid));

      const sortedTerms = [...members]
        .sort((a, b) => (a.id === bestMedoid.id ? -1 : b.id === bestMedoid.id ? 1 : 0))
        .map((m) => ({ id: m.id, term: m.term, stance: m.stance, isHuman: m.isHuman }));

      // Average basin hue (circular mean)
      let hx = 0;
      let hy = 0;
      for (const m of members) {
        const rad = ((m.hue || 200) * Math.PI) / 180;
        hx += Math.cos(rad);
        hy += Math.sin(rad);
      }
      let avgHue = (Math.atan2(hy, hx) * 180) / Math.PI;
      if (avgHue < 0) avgHue += 360;

      clusters.push({
        id: currentCid,
        medoidId: bestMedoid.id,
        medoidTerm: bestMedoid.term,
        centroidAxis,
        hue: Math.round(avgHue) % 360,
        cellIds: members.map((m) => m.id),
        members: sortedTerms,
        coherence: Number(coherence.toFixed(3)),
        cx: 0,
        cy: 0,
        radius: 68,
      });
    }

    return clusters;
  }

  emitRipple(cell, leverage) {
    const color =
      cell.stance === "negate"
        ? "#fb7185"
        : cell.stance === "bridge"
        ? "#34d399"
        : cell.stance === "question"
        ? "#818cf8"
        : `hsl(${cell.hue || 195}, 88%, 72%)`;

    this.ripples.push({
      cellId: cell.id,
      x: cell.x,
      y: cell.y,
      radius: 16,
      maxRadius: 130 + leverage * 320,
      leverage,
      color,
      bornAt: performance.now(),
      duration: 1400 + leverage * 950,
    });
    if (this.ripples.length > 26) this.ripples.shift();
  }

  /**
   * Advances PCA-guided terrain physics & smooth Manifold ↔ Touching Auber Mosaic morphing.
   */
  stepPhysics(dt = 0.016) {
    const targetBlend = this.topologyMode === "spiral" ? 1 : 0;
    this.topologyBlend += (targetBlend - this.topologyBlend) * Math.min(1, dt * 6.0);

    const list = Array.from(this.cells.values());
    const n = list.length;
    if (n === 0) return;

    // 1. Pull cells gently toward live 2D PCA compass coordinates
    //    (relaxed slightly when the LLM is actively sculpting the cell's position!)
    for (const c of list) {
      const pull = c.llmGravity > 0.2 ? 0.95 : 1.85;
      c.vx += (c.targetX - c.mx) * pull * dt;
      c.vy += (c.targetY - c.my) * pull * dt;
    }

    // 2. Soft readability repulsion so concepts never collide
    for (let i = 0; i < n; i++) {
      const a = list[i];
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        let dx = b.mx - a.mx;
        let dy = b.my - a.my;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) {
          dx = (Math.random() - 0.5) * 2;
          dy = (Math.random() - 0.5) * 2;
          distSq = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(distSq);
        const minDist = 104;
        if (dist < 220) {
          const rep = (minDist * minDist) / (distSq + 480);
          const fx = (dx / dist) * rep * 17;
          const fy = (dy / dist) * rep * 17;
          a.vx -= fx * dt;
          a.vy -= fy * dt;
          b.vx += fx * dt;
          b.vy += fy * dt;
        }
      }
    }

    // 3. Semantic springs (resonance deepens valleys, tension widens fault ridges)
    for (const e of this.edges) {
      const a = this.cells.get(e.a);
      const b = this.cells.get(e.b);
      if (!a || !b) continue;

      const dx = b.mx - a.mx;
      const dy = b.my - a.my;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (e.type === "resonance" || e.type === "bridge") {
        const targetDist = e.isLlmLink ? 96 : e.type === "bridge" ? 135 : Math.max(76, 150 - e.resonance * 82);
        const k = (e.isLlmLink ? 3.2 : e.type === "bridge" ? 1.1 : 1.75) * e.resonance;
        const force = (dist - targetDist) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx * dt;
        a.vy += fy * dt;
        b.vx -= fx * dt;
        b.vy -= fy * dt;
      } else if (e.type === "tension") {
        const targetDist = (e.isLlmLink ? 250 : 230) + e.tension * 70;
        const force = (dist - targetDist) * (e.isLlmLink ? 1.75 : 1.1);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx * dt;
        a.vy += fy * dt;
        b.vx -= fx * dt;
        b.vy -= fy * dt;
      }
    }

    // 4. Damped integration + Manifold ↔ Touching Spiral Mosaic interpolation
    for (const c of list) {
      c.vx *= 0.84;
      c.vy *= 0.84;
      c.mx += c.vx * dt * 15;
      c.my += c.vy * dt * 15;
      c.mx = Math.max(-420, Math.min(420, c.mx));
      c.my = Math.max(-255, Math.min(255, c.my));

      const b = this.topologyBlend;
      c.x = c.mx * (1 - b) + c.sx * b;
      c.y = c.my * (1 - b) + c.sy * b;
    }

    // 5. Update cluster centroids & radii
    for (const cl of this.clusters) {
      let cx = 0;
      let cy = 0;
      let count = 0;
      for (const cid of cl.cellIds) {
        const cell = this.cells.get(cid);
        if (!cell) continue;
        cx += cell.x;
        cy += cell.y;
        count++;
      }
      if (count > 0) {
        cl.cx = cx / count;
        cl.cy = cy / count;
        let maxR = 60;
        for (const cid of cl.cellIds) {
          const cell = this.cells.get(cid);
          if (!cell) continue;
          const d = Math.hypot(cell.x - cl.cx, cell.y - cl.cy) + 46;
          if (d > maxR) maxR = d;
        }
        cl.radius = maxR;
      }
    }

    // 6. Update transductive ripples
    const now = performance.now();
    this.ripples = this.ripples.filter((r) => {
      const progress = (now - r.bornAt) / r.duration;
      if (progress >= 1) return false;
      const cell = this.cells.get(r.cellId);
      if (cell) {
        r.x = cell.x;
        r.y = cell.y;
      }
      const ease = 1 - Math.pow(1 - progress, 3);
      r.radius = 16 + (r.maxRadius - 16) * ease;
      r.alpha = (1 - progress) * (0.62 + r.leverage * 0.35);
      return true;
    });
  }
}
