// High-DPI 60fps HTML5 Canvas Renderer (v2)
// - Terrain Mode: continuous chromatic semantic potential field + Marching-Squares topographic isolines
//   + dialectical interference ridges + live 2D PCA horizon compass + typing ghost preview
// - Mosaic Mode: true edge-to-edge Olivier Auber square spiral mosaic with chromatic resonance fields
//   and glowing/fractured shared neighbor membranes

import { MOSAIC_TILE_W, MOSAIC_TILE_H } from "./topologyEngine.js?v=2";

const STANCE_META = {
  assert: { glyph: "●", color: "#7dd3fc" },
  question: { glyph: "?", color: "#a5b4fc" },
  negate: { glyph: "⊘", color: "#fb7185" },
  bridge: { glyph: "⇄", color: "#34d399" },
};

// Offscreen terrain grid parameters (world coordinates)
const GRID_W = 72;
const GRID_H = 48;
const WORLD_MIN_X = -540;
const WORLD_MAX_X = 540;
const WORLD_MIN_Y = -360;
const WORLD_MAX_Y = 360;
const CONTOUR_LEVELS = [0.22, 0.42, 0.66, 0.94, 1.28];

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export class NoeticRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.camX = 0;
    this.camY = -6;
    this.zoom = 1;
    this.selectedId = null;

    // Offscreen low-res scalar & chromatic potential buffer (upscaled smoothly by GPU/Canvas)
    this._fieldCanvas = document.createElement("canvas");
    this._fieldCanvas.width = GRID_W;
    this._fieldCanvas.height = GRID_H;
    this._fieldCtx = this._fieldCanvas.getContext("2d");
    this._fieldImg = this._fieldCtx.createImageData(GRID_W, GRID_H);
    this._scalarGrid = new Float32Array(GRID_W * GRID_H);
    this._tensionGrid = new Float32Array(GRID_W * GRID_H);

    // Hit test buffers
    this._hitCells = [];
    this._hitVoids = [];
    this._hitAxes = [];
    this._hitBasins = [];

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  resetCamera() {
    this.camX = 0;
    this.camY = -6;
    this.zoom = 1;
  }

  screenToWorld(sx, sy) {
    const wx = (sx - this.width / 2) / this.zoom - this.camX;
    const wy = (sy - this.height / 2) / this.zoom - this.camY;
    return { wx, wy };
  }

  hitTest(sx, sy) {
    const { wx, wy } = this.screenToWorld(sx, sy);

    for (let i = this._hitCells.length - 1; i >= 0; i--) {
      const c = this._hitCells[i];
      if (wx >= c.x - c.w / 2 && wx <= c.x + c.w / 2 && wy >= c.y - c.h / 2 && wy <= c.y + c.h / 2) {
        return { kind: "cell", id: c.id };
      }
    }

    for (const v of this._hitVoids) {
      if (Math.hypot(wx - v.x, wy - v.y) <= 28) {
        return { kind: "void", id: v.id };
      }
    }

    for (const a of this._hitAxes) {
      if (Math.abs(wx - a.mx) <= 84 && Math.abs(wy - a.my) <= 18) {
        return { kind: "axis", id: a.id };
      }
    }

    const sortedBasins = [...this._hitBasins].sort((a, b) => a.radius - b.radius);
    for (const b of sortedBasins) {
      if (Math.hypot(wx - b.cx, wy - b.cy) <= b.radius) {
        return { kind: "basin", id: b.id };
      }
    }

    return null;
  }

  render({
    cells,
    edges,
    basins,
    axes,
    voids,
    ripples,
    telemetry,
    compass,
    ghostPreview,
    topologyBlend,
    showMirror,
    time,
  }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Deep obsidian background
    ctx.fillStyle = "#05070e";
    ctx.fillRect(0, 0, this.width, this.height);

    // Transform to world camera space
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(this.camX, this.camY);

    const cellMap = new Map();
    for (const c of cells) cellMap.set(c.id, c);

    this._hitBasins = [];
    this._hitAxes = [];
    this._hitVoids = [];
    this._hitCells = [];

    // 1. Continuous Semantic Potential Terrain & Marching-Squares Isolines (Terrain mode)
    const terrainAlpha = 1 - topologyBlend;
    if (terrainAlpha > 0.03 && cells.length > 0) {
      this.drawPotentialTerrain(ctx, cells, edges, cellMap, terrainAlpha, time);
    }

    // 2. Subtle architectural crosshairs & metastability horizon ring
    this.drawAnopticalGrid(ctx, telemetry, topologyBlend, time);

    // 3. Selective semantic & dialectical filaments (NO Leiden hairball!)
    if (terrainAlpha > 0.08) {
      this.drawSelectiveFilaments(ctx, edges, cellMap, terrainAlpha);
    }

    // 4. Overhead Mirror: Basin Regime Labels, Dialectical Axes & Negative-Space Voids
    if (showMirror) {
      if (basins && basins.length > 0) this.drawBasinRegimes(ctx, basins, terrainAlpha);
      if (axes && axes.length > 0) this.drawAxes(ctx, axes, terrainAlpha);
      if (voids && voids.length > 0) this.drawVoids(ctx, voids, time, terrainAlpha);
    }

    // 5. Transductive Leverage Shockwaves
    if (ripples && ripples.length > 0) {
      this.drawRipples(ctx, ripples);
    }

    // 6. Live Typing Ghost Preview (before pressing Enter)
    if (ghostPreview && terrainAlpha > 0.25) {
      this.drawGhostPreview(ctx, ghostPreview, time);
    }

    // 7. Noetic Cells (minimal typography beacons in Terrain ↔ edge-to-edge Auber chromatic tiles in Mosaic)
    this.drawCells(ctx, cells, edges, cellMap, topologyBlend, time);

    ctx.restore();

    // 8. Screen-space 4 Cardinal PCA Horizon Compass Labels (Terrain mode)
    if (compass && terrainAlpha > 0.15) {
      this.drawCompassHorizons(ctx, compass, terrainAlpha);
    }

    ctx.restore();
  }

  /**
   * Computes & renders the continuous 2D chromatic potential field + Marching-Squares topographic isolines.
   */
  drawPotentialTerrain(ctx, cells, edges, cellMap, alpha, time) {
    const imgData = this._fieldImg.data;
    const scalar = this._scalarGrid;
    const tension = this._tensionGrid;

    // Precompute cell RGB + sigma for fast inner loop
    const sources = cells.map((c) => {
      const hue = c.hue != null ? c.hue : 200;
      const [r, g, b] = hslToRgb(hue, 0.78, 0.56);
      const weight = (c.intensity || 1.0) * (c.isLocal ? 1.35 : c.isHuman ? 1.15 : 0.88);
      return { x: c.x, y: c.y, r, g, b, weight };
    });

    // Precompute dialectical ridge midpoints for interference heat
    const ridges = [];
    for (const e of edges) {
      if (e.type !== "tension" || e.tension < 0.48) continue;
      const a = cellMap.get(e.a);
      const b = cellMap.get(e.b);
      if (!a || !b) continue;
      ridges.push({
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        strength: e.tension,
      });
    }

    const stepX = (WORLD_MAX_X - WORLD_MIN_X) / (GRID_W - 1);
    const stepY = (WORLD_MAX_Y - WORLD_MIN_Y) / (GRID_H - 1);
    const invTwoSigmaSq = 1 / (2 * 96 * 96);
    const invRidgeSq = 1 / (2 * 70 * 70);
    const breath = 1 + Math.sin(time * 0.0012) * 0.03;

    let ptr = 0;
    let idx = 0;
    for (let gy = 0; gy < GRID_H; gy++) {
      const wy = WORLD_MIN_Y + gy * stepY;
      for (let gx = 0; gx < GRID_W; gx++) {
        const wx = WORLD_MIN_X + gx * stepX;

        let pot = 0;
        let cr = 0;
        let cg = 0;
        let cb = 0;

        for (let i = 0; i < sources.length; i++) {
          const s = sources[i];
          const dx = wx - s.x;
          const dy = wy - s.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 68000) continue;
          const gVal = s.weight * Math.exp(-d2 * invTwoSigmaSq) * breath;
          pot += gVal;
          cr += s.r * gVal;
          cg += s.g * gVal;
          cb += s.b * gVal;
        }

        let ten = 0;
        for (let i = 0; i < ridges.length; i++) {
          const rd = ridges[i];
          const dx = wx - rd.mx;
          const dy = wy - rd.my;
          const d2 = dx * dx + dy * dy;
          if (d2 > 36000) continue;
          ten += rd.strength * Math.exp(-d2 * invRidgeSq);
        }

        scalar[idx] = pot;
        tension[idx] = ten;
        idx++;

        // Shade pixel softly in deep obsidian + semantic hue valley glow + crimson interference ridge
        const normPot = Math.min(1, pot * 0.42);
        const normTen = Math.min(1, ten * 0.55);

        let r = 7;
        let g = 10;
        let b = 20;
        if (pot > 0.01) {
          const invP = 1 / pot;
          r += (cr * invP) * normPot * 0.46;
          g += (cg * invP) * normPot * 0.46;
          b += (cb * invP) * normPot * 0.46;
        }
        if (normTen > 0.02) {
          r += 245 * normTen * 0.34;
          g += 62 * normTen * 0.16;
          b += 108 * normTen * 0.22;
        }

        imgData[ptr++] = Math.min(255, r);
        imgData[ptr++] = Math.min(255, g);
        imgData[ptr++] = Math.min(255, b);
        imgData[ptr++] = 255;
      }
    }

    this._fieldCtx.putImageData(this._fieldImg, 0, 0);

    // Draw smoothly interpolated terrain field onto main canvas
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      this._fieldCanvas,
      WORLD_MIN_X,
      WORLD_MIN_Y,
      WORLD_MAX_X - WORLD_MIN_X,
      WORLD_MAX_Y - WORLD_MIN_Y
    );

    // Extract & render crisp Marching-Squares topographic isolines
    for (let li = 0; li < CONTOUR_LEVELS.length; li++) {
      const level = CONTOUR_LEVELS[li];
      ctx.beginPath();
      this.traceContours(ctx, scalar, level, stepX, stepY);
      ctx.strokeStyle = `rgba(186, 230, 253, ${(0.08 + li * 0.045) * alpha})`;
      ctx.lineWidth = li === 2 ? 1.2 : 0.85;
      ctx.stroke();
    }

    // Dialectical interference contour line (crimson fault boundary)
    ctx.beginPath();
    this.traceContours(ctx, tension, 0.46, stepX, stepY);
    ctx.strokeStyle = `rgba(251, 113, 133, ${0.42 * alpha})`;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  /**
   * Marching-Squares contour segment tracer on the scalar grid.
   */
  traceContours(ctx, grid, threshold, stepX, stepY) {
    const interp = (v1, v2) => {
      const denom = v2 - v1;
      if (Math.abs(denom) < 1e-6) return 0.5;
      return Math.max(0, Math.min(1, (threshold - v1) / denom));
    };

    for (let gy = 0; gy < GRID_H - 1; gy++) {
      const y0 = WORLD_MIN_Y + gy * stepY;
      const y1 = y0 + stepY;
      const row0 = gy * GRID_W;
      const row1 = (gy + 1) * GRID_W;

      for (let gx = 0; gx < GRID_W - 1; gx++) {
        const tl = grid[row0 + gx];
        const tr = grid[row0 + gx + 1];
        const br = grid[row1 + gx + 1];
        const bl = grid[row1 + gx];

        const mask =
          (tl >= threshold ? 8 : 0) |
          (tr >= threshold ? 4 : 0) |
          (br >= threshold ? 2 : 0) |
          (bl >= threshold ? 1 : 0);

        if (mask === 0 || mask === 15) continue;

        const x0 = WORLD_MIN_X + gx * stepX;
        const x1 = x0 + stepX;

        const top = [x0 + interp(tl, tr) * stepX, y0];
        const right = [x1, y0 + interp(tr, br) * stepY];
        const bottom = [x0 + interp(bl, br) * stepX, y1];
        const left = [x0, y0 + interp(tl, bl) * stepY];

        const seg = (p, q) => {
          ctx.moveTo(p[0], p[1]);
          ctx.lineTo(q[0], q[1]);
        };

        switch (mask) {
          case 1:
          case 14:
            seg(left, bottom);
            break;
          case 2:
          case 13:
            seg(bottom, right);
            break;
          case 3:
          case 12:
            seg(left, right);
            break;
          case 4:
          case 11:
            seg(top, right);
            break;
          case 5:
            seg(left, top);
            seg(bottom, right);
            break;
          case 6:
          case 9:
            seg(top, bottom);
            break;
          case 7:
          case 8:
            seg(left, top);
            break;
          case 10:
            seg(top, right);
            seg(left, bottom);
            break;
        }
      }
    }
  }

  drawAnopticalGrid(ctx, telemetry, topologyBlend, time) {
    ctx.save();
    // Subtle compass crosshairs through origin in Terrain mode
    if (topologyBlend < 0.85) {
      const a = 0.08 * (1 - topologyBlend);
      ctx.strokeStyle = `rgba(148, 163, 184, ${a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-480, 0);
      ctx.lineTo(480, 0);
      ctx.moveTo(0, -300);
      ctx.lineTo(0, 300);
      ctx.stroke();
    }

    // Ambient metastability breathing horizon circle
    const meta = telemetry ? telemetry.metastability : 0.5;
    const pulse = Math.sin(time * 0.0014) * 5;
    const ringRadius = 225 + meta * 85 + pulse;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(125, 211, 252, ${(0.045 + meta * 0.06) * (1 - topologyBlend * 0.7)})`;
    ctx.setLineDash([3, 12]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Renders only whisper-thin selective arcs (human/selected links + acute dialectical fault lines)
   * so the visual Gestalt comes from the continuous topographic landscape rather than a graph hairball.
   */
  drawSelectiveFilaments(ctx, edges, cellMap, terrainAlpha) {
    for (const e of edges) {
      const a = cellMap.get(e.a);
      const b = cellMap.get(e.b);
      if (!a || !b) continue;

      const involvesFocus =
        a.isLocal ||
        b.isLocal ||
        this.selectedId === a.id ||
        this.selectedId === b.id;

      // Only draw tension ridges globally, or resonance arcs attached to focus/human cells
      if (e.type !== "tension" && !involvesFocus && e.type !== "bridge") continue;

      ctx.save();
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ctrlX = midX - (dy / dist) * Math.min(20, dist * 0.08);
      const ctrlY = midY + (dx / dist) * Math.min(20, dist * 0.08);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, b.x, b.y);

      if (e.type === "tension") {
        ctx.strokeStyle = `rgba(251, 113, 133, ${(0.18 + e.tension * 0.34) * terrainAlpha})`;
        ctx.lineWidth = involvesFocus ? 1.4 : 0.9;
        ctx.setLineDash([3, 5]);
      } else if (e.type === "bridge") {
        ctx.strokeStyle = `rgba(52, 211, 153, ${(0.18 + e.resonance * 0.32) * terrainAlpha})`;
        ctx.lineWidth = 1.1;
      } else {
        ctx.strokeStyle = `rgba(186, 230, 253, ${(0.22 + e.resonance * 0.36) * terrainAlpha})`;
        ctx.lineWidth = 1.1;
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBasinRegimes(ctx, basins, terrainAlpha) {
    if (terrainAlpha < 0.15) return;
    for (const b of basins) {
      const isSelected = this.selectedId === b.id;
      ctx.save();
      ctx.globalAlpha = terrainAlpha;

      // Subtle regime label floating above the topographic valley (NO noisy bubble rings!)
      ctx.font = '600 10.5px "Space Grotesk", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = isSelected
        ? "#ffffff"
        : `hsla(${b.hue || 200}, 85%, 82%, 0.78)`;
      const prefix = b.isLlmNamed ? "◈ " : "";
      ctx.fillText(`${prefix}${b.label.toUpperCase()}`, b.cx, b.cy - b.radius * 0.78);

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.radius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
      this._hitBasins.push({ id: b.id, cx: b.cx, cy: b.cy, radius: b.radius });
    }
  }

  drawAxes(ctx, axes, terrainAlpha) {
    if (terrainAlpha < 0.2) return;
    for (const ax of axes) {
      const isSelected = this.selectedId === ax.id;
      ctx.save();
      ctx.globalAlpha = terrainAlpha;

      ctx.font = '500 10px "JetBrains Mono", monospace';
      const labelText = ax.label;
      const tw = ctx.measureText(labelText).width;
      const pw = tw + 16;
      const ph = 20;

      this.roundRect(ctx, ax.mx - pw / 2, ax.my - ph / 2, pw, ph, 10);
      ctx.fillStyle = "rgba(22, 10, 18, 0.82)";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#fda4af" : "rgba(251, 113, 133, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#fecdd3";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, ax.mx, ax.my + 0.5);

      ctx.restore();
      this._hitAxes.push({ id: ax.id, mx: ax.mx, my: ax.my });
    }
  }

  drawVoids(ctx, voids, time, terrainAlpha) {
    if (terrainAlpha < 0.2) return;
    for (const v of voids) {
      const isSelected = this.selectedId === v.id;
      const breathe = Math.sin(time * 0.0022) * 2.5;
      ctx.save();
      ctx.globalAlpha = terrainAlpha;

      ctx.beginPath();
      ctx.arc(v.x, v.y, 19 + breathe, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? "#fde68a" : "rgba(251, 191, 36, 0.48)";
      ctx.lineWidth = isSelected ? 1.8 : 1.1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillStyle = "rgba(253, 230, 138, 0.86)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(v.label, v.x, v.y);

      ctx.restore();
      this._hitVoids.push({ id: v.id, x: v.x, y: v.y });
    }
  }

  drawRipples(ctx, ripples) {
    for (const r of ripples) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.alpha || 0);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Renders live gravitational ghost preview while typing in the cell input box.
   */
  drawGhostPreview(ctx, ghost, time) {
    const pulse = 0.65 + Math.sin(time * 0.008) * 0.35;
    ctx.save();

    // Preview rays to impacted neighbors
    for (const ray of ghost.rays) {
      ctx.beginPath();
      ctx.moveTo(ghost.x, ghost.y);
      ctx.lineTo(ray.x, ray.y);
      ctx.strokeStyle =
        ray.type === "tension"
          ? `rgba(251, 113, 133, ${0.45 * pulse})`
          : `rgba(125, 211, 252, ${0.45 * pulse})`;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
    }

    // Trajectory arc from current local cell to projected ghost site
    ctx.beginPath();
    ctx.moveTo(ghost.fromX, ghost.fromY);
    ctx.lineTo(ghost.x, ghost.y);
    ctx.strokeStyle = `hsla(${ghost.hue}, 90%, 75%, ${0.65 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ghost chromatic potential preview halo
    const grad = ctx.createRadialGradient(ghost.x, ghost.y, 4, ghost.x, ghost.y, 64);
    grad.addColorStop(0, `hsla(${ghost.hue}, 85%, 65%, ${0.28 * pulse})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, 64, 0, Math.PI * 2);
    ctx.fill();

    // Ghost label
    ctx.font = '500 12px "Space Grotesk", sans-serif';
    ctx.fillStyle = `hsla(${ghost.hue}, 95%, 88%, 0.9)`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`◌ ${ghost.term}`, ghost.x, ghost.y);

    ctx.restore();
  }

  /**
   * Renders cells as crisp minimal typographic nodes on the Terrain,
   * morphing seamlessly into an edge-to-edge chromatic Auberian Mosaic in Spiral mode.
   */
  drawCells(ctx, cells, edges, cellMap, topologyBlend, time) {
    const ordered = [...cells].sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? 1 : -1;
      if (a.isHuman !== b.isHuman) return a.isHuman ? 1 : -1;
      return 0;
    });

    for (const c of ordered) {
      const stanceInfo = STANCE_META[c.stance] || STANCE_META.assert;
      const isSelected = this.selectedId === c.id;
      const hue = c.hue != null ? c.hue : 200;
      const age = time - (c.updatedAt || 0);
      const recentGlow = age < 1400 ? 1 - age / 1400 : 0;

      ctx.save();
      ctx.font = c.isHuman
        ? '600 13px "Space Grotesk", sans-serif'
        : '400 12px "Inter", sans-serif';

      const textWidth = ctx.measureText(c.term).width;
      const terrainW = Math.max(66, textWidth + 28);
      const terrainH = c.isHuman ? 30 : 24;

      // Exact touching dimensions in Mosaic mode!
      const w = terrainW * (1 - topologyBlend) + MOSAIC_TILE_W * topologyBlend;
      const h = terrainH * (1 - topologyBlend) + MOSAIC_TILE_H * topologyBlend;
      const radius = 14 * (1 - topologyBlend) + 2 * topologyBlend;

      if (topologyBlend > 0.35) {
        // Chromatic Auberian Mosaic tile fill (aligned concepts visually merge into glowing patches!)
        const tileAlpha = (0.24 + (c.intensity || 1) * 0.14 + recentGlow * 0.2) * topologyBlend;
        this.roundRect(ctx, c.x - w / 2, c.y - h / 2, w, h, radius);
        ctx.fillStyle = `hsla(${hue}, 72%, 44%, ${tileAlpha})`;
        ctx.fill();

        ctx.lineWidth = isSelected ? 2.2 : c.isLocal ? 1.8 : 0.75;
        ctx.strokeStyle = isSelected
          ? "#ffffff"
          : c.isLocal
          ? "#e0f2fe"
          : `hsla(${hue}, 70%, 68%, ${0.28 * topologyBlend})`;
        ctx.stroke();
      } else {
        // Terrain mode: lightweight luminous beacon (no heavy Gephi/Leiden pill boxes!)
        const dotR = c.isLocal ? 5.2 : c.isHuman ? 4.4 : 3.2 * (c.intensity || 1);
        ctx.beginPath();
        ctx.arc(c.x, c.y - 11, dotR, 0, Math.PI * 2);
        ctx.fillStyle = c.stance === "negate" ? "#fb7185" : `hsl(${hue}, 88%, 72%)`;
        if (c.isLocal || recentGlow > 0.05) {
          ctx.shadowColor = `hsl(${hue}, 95%, 72%)`;
          ctx.shadowBlur = 14 + recentGlow * 14;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        if (c.isLocal || isSelected) {
          ctx.beginPath();
          ctx.arc(c.x, c.y - 11, dotR + 5, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? "#ffffff" : `hsla(${hue}, 90%, 78%, 0.75)`;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      }

      // Typography
      ctx.textBaseline = "middle";
      if (topologyBlend > 0.55) {
        ctx.fillStyle = stanceInfo.color;
        ctx.font = '600 10.5px "JetBrains Mono", monospace';
        ctx.textAlign = "left";
        ctx.fillText(stanceInfo.glyph, c.x - w / 2 + 8, c.y - h / 2 + 13);

        ctx.fillStyle = "rgba(226, 232, 240, 0.42)";
        ctx.font = '400 9px "JetBrains Mono", monospace';
        ctx.textAlign = "right";
        ctx.fillText(`#${c.spiralIndex}`, c.x + w / 2 - 8, c.y - h / 2 + 13);

        ctx.fillStyle = c.isHuman ? "#ffffff" : "#eef2ff";
        ctx.font = c.isHuman
          ? '600 12.5px "Space Grotesk", sans-serif'
          : '500 11.5px "Inter", sans-serif';
        ctx.textAlign = "center";
        const clipped = c.term.length > 14 ? `${c.term.slice(0, 13)}…` : c.term;
        ctx.fillText(clipped, c.x, c.y + 6);
      } else {
        // Floating typographic concept directly on the potential terrain
        ctx.font = c.isLocal
          ? '600 13.5px "Space Grotesk", sans-serif'
          : c.isHuman
          ? '600 12.5px "Space Grotesk", sans-serif'
          : '400 11.5px "Inter", sans-serif';
        ctx.textAlign = "center";
        ctx.fillStyle = c.isLocal
          ? "#ffffff"
          : c.isHuman
          ? "#f1f5f9"
          : "rgba(226, 232, 240, 0.86)";
        const prefix = c.stance !== "assert" ? `${stanceInfo.glyph} ` : "";
        ctx.fillText(`${prefix}${c.term}`, c.x, c.y + 5);
      }

      ctx.restore();
      this._hitCells.push({ id: c.id, x: c.x, y: c.y, w, h });
    }

    // In Mosaic mode, illuminate touching neighbor membranes (fusion vs dialectical fracture!)
    if (topologyBlend > 0.65) {
      ctx.save();
      ctx.globalAlpha = (topologyBlend - 0.65) / 0.35;
      for (const e of edges) {
        if (!e.isSpiralNeighbor) continue;
        const a = cellMap.get(e.a);
        const b = cellMap.get(e.b);
        if (!a || !b) continue;

        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const horiz = Math.abs(a.gx - b.gx) === 1;

        ctx.beginPath();
        if (horiz) {
          ctx.moveTo(mx, my - MOSAIC_TILE_H * 0.42);
          ctx.lineTo(mx, my + MOSAIC_TILE_H * 0.42);
        } else {
          ctx.moveTo(mx - MOSAIC_TILE_W * 0.42, my);
          ctx.lineTo(mx + MOSAIC_TILE_W * 0.42, my);
        }

        if (e.type === "tension") {
          ctx.strokeStyle = `rgba(251, 113, 133, ${0.45 + e.tension * 0.5})`;
          ctx.lineWidth = 2.6;
        } else {
          ctx.strokeStyle = `rgba(186, 230, 253, ${0.28 + e.resonance * 0.55})`;
          ctx.lineWidth = 2.0;
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * Draws the 4 live emergent 2D PCA compass horizons around the viewport edges.
   */
  drawCompassHorizons(ctx, compass, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.68;
    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = "#94a3b8";

    // West & East (Principal Axis 1)
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`← ${compass.west.toUpperCase()}`, 18, this.height * 0.52);

    ctx.textAlign = "right";
    ctx.fillText(`${compass.east.toUpperCase()} →`, this.width - 18, this.height * 0.52);

    // North & South (Principal Axis 2)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`↑ ${compass.north.toUpperCase()}`, this.width / 2, 136);

    ctx.textBaseline = "bottom";
    ctx.fillText(`↓ ${compass.south.toUpperCase()}`, this.width / 2, this.height - 156);

    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}
