// Layer 2: Noetic Topology, Auberian Spiral, Damped Manifold Physics, Telemetry & Transductive Leverage

/**
 * Exact Ulam / Olivier Auber square spiral coordinates (index 0 at center).
 * As participants join or leave, indices compact so newcomers sit as central as possible.
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

export class TopologyEngine {
  constructor(semanticEngine) {
    this.semantic = semanticEngine;
    this.cells = new Map(); // id -> cell object
    this.edges = []; // active resonance / tension / bridge edges
    this.clusters = []; // detected emergent basins
    this.ripples = []; // visual transductive leverage waves
    this.topologyMode = "manifold"; // "manifold" | "spiral"
    this.topologyBlend = 0; // 0 = manifold, 1 = spiral (smoothly animated)

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

  upsertCell({ id, term, stance = "assert", isHuman = false, isLocal = false, archetype = null }) {
    const existing = this.cells.get(id);
    const embedding = this.semantic.embedSync(term);
    const now = performance.now();

    if (existing) {
      const changed = existing.term !== term || existing.stance !== stance;
      existing.prevTerm = existing.term;
      existing.term = term;
      existing.stance = stance;
      existing.embedding = embedding;
      existing.updatedAt = now;
      existing.isHuman = isHuman;
      existing.isLocal = isLocal;
      if (archetype) existing.archetype = archetype;

      if (changed) {
        const leverage = this.recomputeGraph(id);
        existing.lastLeverage = leverage;
        this.emitRipple(existing, leverage);
        this.telemetry.totalDisplacement += Math.max(0.15, leverage);
        return leverage;
      }
      return existing.lastLeverage || 0;
    }

    // Place new cell cleanly near its spiral position in normalized world space (-1..1)
    const idx = this.cells.size;
    const { gx, gy } = spiralCoords(idx);
    const angle = idx * 2.3999632; // golden angle jitter for manifold start
    const r = Math.min(0.68, 0.14 + Math.sqrt(idx) * 0.13);

    const cell = {
      id,
      term,
      prevTerm: term,
      stance,
      isHuman,
      isLocal,
      archetype,
      embedding,
      spiralIndex: idx,
      gx,
      gy,
      // World coordinates (centered at 0,0; typical span -320..+320 px)
      mx: Math.cos(angle) * r * 260,
      my: Math.sin(angle) * r * 200,
      vx: 0,
      vy: 0,
      sx: gx * 116,
      sy: gy * 74,
      x: Math.cos(angle) * r * 260,
      y: Math.sin(angle) * r * 200,
      clusterId: -1,
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
    // Keep local human at center (index 0), then other humans, then synthetic agents
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
      cell.sx = gx * 124;
      cell.sy = gy * 76;
    });
  }

  /**
   * Recomputes resonance/tension edges, clusters, telemetry, and transductive leverage ΔM/Δc_i.
   */
  recomputeGraph(perturbedCellId = null) {
    const list = Array.from(this.cells.values());
    const n = list.length;
    this.telemetry.cellCount = n;

    if (n === 0) {
      this.edges = [];
      this.clusters = [];
      return 0;
    }

    const newEdges = [];
    const newEdgeSig = new Map();
    let totalPairs = 0;
    let resonanceSum = 0;
    let resonanceSqSum = 0;
    let tensionEdges = 0;
    let activeEdges = 0;

    // Adjacency map for resonance clustering
    const adj = new Map();
    for (const c of list) adj.set(c.id, []);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = list[i];
        const b = list[j];
        const rel = this.semantic.computeRelation(a, b);
        totalPairs++;
        resonanceSum += rel.resonance;
        resonanceSqSum += rel.resonance * rel.resonance;

        // Also check spiral adjacency for Auberian membrane rendering
        const manhattan = Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy);
        const isSpiralNeighbor = manhattan === 1;

        if (rel.type !== "neutral" || (isSpiralNeighbor && (rel.resonance > 0.2 || rel.tension > 0.25))) {
          const edge = {
            a: a.id,
            b: b.id,
            resonance: rel.resonance,
            tension: rel.tension,
            type: rel.type === "neutral" ? (rel.tension > rel.resonance ? "tension" : "resonance") : rel.type,
            isSpiralNeighbor,
          };
          newEdges.push(edge);
          const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
          newEdgeSig.set(key, `${edge.type}:${Math.round((edge.resonance + edge.tension) * 10)}`);

          if (rel.type !== "neutral") {
            activeEdges++;
            if (rel.type === "tension") tensionEdges++;
          }
          if ((edge.type === "resonance" || edge.type === "bridge") && edge.resonance >= 0.40) {
            adj.get(a.id).push({ id: b.id, weight: edge.resonance });
            adj.get(b.id).push({ id: a.id, weight: edge.resonance });
          }
        }
      }
    }

    // Keep graph visually crisp: cap edges per node to strongest K=5 unless spiral neighbor
    const edgeCounts = new Map();
    newEdges.sort((e1, e2) => (e2.resonance + e2.tension) - (e1.resonance + e1.tension));
    const prunedEdges = [];
    for (const e of newEdges) {
      const ca = edgeCounts.get(e.a) || 0;
      const cb = edgeCounts.get(e.b) || 0;
      if (e.isSpiralNeighbor || (ca < 5 && cb < 5) || e.type === "tension") {
        prunedEdges.push(e);
        edgeCounts.set(e.a, ca + 1);
        edgeCounts.set(e.b, cb + 1);
      }
    }
    this.edges = prunedEdges;

    // Detect emergent basins (resonance connected components with label-propagation refinement)
    const clusters = this.detectBasins(list, adj);
    this.clusters = clusters;

    // Compute telemetry metrics (Simondon + Dessalles)
    const meanRes = totalPairs > 0 ? resonanceSum / totalPairs : 0;
    const varRes = totalPairs > 0 ? Math.max(0, resonanceSqSum / totalPairs - meanRes * meanRes) : 0;

    // Cluster Shannon entropy (normalized 0..1)
    let clusterH = 0;
    if (n > 1 && clusters.length > 0) {
      for (const cl of clusters) {
        const p = cl.cellIds.length / n;
        if (p > 0) clusterH -= p * Math.log2(p);
      }
      // Include singletons
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

    const entropy = Math.max(0, Math.min(1, 0.65 * clusterH + 0.35 * (1 - Math.min(1, meanRes * 1.8))));
    const tensionRatio = activeEdges > 0 ? Math.min(1, tensionEdges / activeEdges) : 0;

    // Simondonian Metastability: peaks when structured basins coexist with dialectical tension (neither noise nor unanimity)
    const metastability = Math.max(
      0,
      Math.min(1, 4 * entropy * (1 - entropy) * (0.48 + 0.52 * Math.min(1, tensionRatio * 2.4)))
    );

    // Dessalles Unexpected Simplicity: high when many heterogeneous lexical forms compress into coherent basins
    const uniqueTerms = new Set(list.map((c) => c.term.toLowerCase().trim())).size;
    const lexicalDiversity = n > 1 ? uniqueTerms / n : 0;
    const avgCoherence = clusters.length > 0
      ? clusters.reduce((s, c) => s + c.coherence * c.cellIds.length, 0) / n
      : 0;
    const simplicity = Math.max(0, Math.min(1, avgCoherence * (0.55 + 0.75 * lexicalDiversity) + Math.sqrt(varRes) * 0.4));

    let phase = "metastable";
    if (entropy > 0.74) {
      phase = "diffuse";
    } else if (tensionRatio >= 0.32 && clusters.length >= 2) {
      phase = "polarized";
    } else if (simplicity >= 0.48 && entropy < 0.52) {
      phase = "crystallizing";
    } else {
      phase = "metastable";
    }

    // Compute Transductive Leverage ΔM / Δc_i
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
        (edgeDiffs / Math.max(4, n * 1.2)) * 0.55 +
        (clusterReassignments / Math.max(2, n)) * 0.35 +
        entropyDelta * 1.8
      );
    }

    // Snapshot for next leverage diff
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
    // Weighted label propagation (deterministic iterations) to separate loosely bridged clusters
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

      // Compute internal coherence and medoid concept
      let bestMedoid = members[0];
      let bestSum = -1;
      let pairSum = 0;
      let pairCount = 0;

      for (const m of members) {
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

      // Sort members by centrality for transparent provenance
      const sortedTerms = [...members]
        .sort((a, b) => (a.id === bestMedoid.id ? -1 : b.id === bestMedoid.id ? 1 : 0))
        .map((m) => ({ id: m.id, term: m.term, stance: m.stance, isHuman: m.isHuman }));

      clusters.push({
        id: currentCid,
        medoidId: bestMedoid.id,
        medoidTerm: bestMedoid.term,
        cellIds: members.map((m) => m.id),
        members: sortedTerms,
        coherence: Number(coherence.toFixed(3)),
        cx: 0,
        cy: 0,
        radius: 65,
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
        : "#7dd3fc";

    this.ripples.push({
      cellId: cell.id,
      x: cell.x,
      y: cell.y,
      radius: 14,
      maxRadius: 110 + leverage * 280,
      leverage,
      color,
      bornAt: performance.now(),
      duration: 1300 + leverage * 900,
    });
    if (this.ripples.length > 24) this.ripples.shift();
  }

  /**
   * Advances damped spring-electrical manifold physics & smooth Manifold ↔ Spiral morphing.
   */
  stepPhysics(dt = 0.016) {
    const targetBlend = this.topologyMode === "spiral" ? 1 : 0;
    this.topologyBlend += (targetBlend - this.topologyBlend) * Math.min(1, dt * 6.5);

    const list = Array.from(this.cells.values());
    const n = list.length;
    if (n === 0) return;

    // 1. Repulsion between all pairs (keeps words comfortably readable)
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
        const minDist = 96;
        if (dist < 240) {
          const rep = (minDist * minDist) / (distSq + 420);
          const fx = (dx / dist) * rep * 18;
          const fy = (dy / dist) * rep * 18;
          a.vx -= fx * dt;
          a.vy -= fy * dt;
          b.vx += fx * dt;
          b.vy += fy * dt;
        }
      }
    }

    // 2. Semantic springs along active edges
    for (const e of this.edges) {
      const a = this.cells.get(e.a);
      const b = this.cells.get(e.b);
      if (!a || !b) continue;

      const dx = b.mx - a.mx;
      const dy = b.my - a.my;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (e.type === "resonance" || e.type === "bridge") {
        // Pull resonating concepts into coherent basins
        const targetDist = e.type === "bridge" ? 145 : Math.max(82, 165 - e.resonance * 95);
        const k = e.type === "bridge" ? 1.6 : 2.8 * e.resonance;
        const force = (dist - targetDist) * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx * dt;
        a.vy += fy * dt;
        b.vx -= fx * dt;
        b.vy -= fy * dt;
      } else if (e.type === "tension") {
        // Dialectical tension maintains a crisp visible ridge (neither collapsing nor flying offscreen)
        const targetDist = 215 + e.tension * 65;
        const force = (dist - targetDist) * 1.4;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx * dt;
        a.vy += fy * dt;
        b.vx -= fx * dt;
        b.vy -= fy * dt;
      }
    }

    // 3. Gentle centering gravity + high damping (zero jitter, serene psychic ergonomics)
    let meanX = 0;
    let meanY = 0;
    for (const c of list) {
      c.vx += -c.mx * 0.42 * dt;
      c.vy += -c.my * 0.48 * dt;
      c.vx *= 0.86;
      c.vy *= 0.86;
      c.mx += c.vx * dt * 16;
      c.my += c.vy * dt * 16;
      // Soft arena clamp
      c.mx = Math.max(-440, Math.min(440, c.mx));
      c.my = Math.max(-280, Math.min(280, c.my));
      meanX += c.mx;
      meanY += c.my;
    }

    // Re-center gently so the global field never drifts away
    meanX /= n;
    meanY /= n;
    for (const c of list) {
      c.mx -= meanX * 0.03;
      c.my -= meanY * 0.03;

      // Interpolate displayed position between Manifold and Auberian Spiral
      const b = this.topologyBlend;
      c.x = c.mx * (1 - b) + c.sx * b;
      c.y = c.my * (1 - b) + c.sy * b;
    }

    // 4. Update cluster geometric hulls & centroids
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
        let maxR = 54;
        for (const cid of cl.cellIds) {
          const cell = this.cells.get(cid);
          if (!cell) continue;
          const d = Math.hypot(cell.x - cl.cx, cell.y - cl.cy) + 46;
          if (d > maxR) maxR = d;
        }
        cl.radius = maxR;
      }
    }

    // 5. Update expanding transductive ripples
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
      r.alpha = (1 - progress) * (0.55 + r.leverage * 0.4);
      return true;
    });
  }
}
