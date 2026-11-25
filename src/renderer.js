// High-DPI 60fps HTML5 Canvas Renderer for the Noetic Poietic Generator
// Renders: Anoptical backdrop, overhead mirror (basins, tension axes, voids),
// resonance/tension edges, transductive leverage ripples, and morphing Manifold ↔ Auber Spiral cells.

const STANCE_META = {
  assert: { glyph: "●", color: "#7dd3fc" },
  question: { glyph: "?", color: "#818cf8" },
  negate: { glyph: "⊘", color: "#fb7185" },
  bridge: { glyph: "⇄", color: "#34d399" },
};

const BASIN_PALETTE = [
  { fill: "rgba(56, 189, 248, 0.085)", stroke: "rgba(125, 211, 252, 0.28)", text: "#bae6fd" },
  { fill: "rgba(129, 140, 248, 0.085)", stroke: "rgba(165, 180, 252, 0.28)", text: "#c7d2fe" },
  { fill: "rgba(52, 211, 153, 0.08)", stroke: "rgba(110, 231, 183, 0.26)", text: "#a7f3d0" },
  { fill: "rgba(251, 191, 36, 0.075)", stroke: "rgba(252, 211, 77, 0.26)", text: "#fde68a" },
  { fill: "rgba(244, 114, 182, 0.075)", stroke: "rgba(249, 168, 212, 0.26)", text: "#fbcfe8" },
];

export class NoeticRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Camera state (pan & zoom)
    this.camX = 0;
    this.camY = -14; // slight upward offset so bottom HUD leaves visual breathing room
    this.zoom = 1;
    this.selectedId = null;

    // Last rendered hit regions in world space for Anoptical click-to-inspect
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
    this.camY = -14;
    this.zoom = 1;
  }

  screenToWorld(sx, sy) {
    const wx = (sx - this.width / 2) / this.zoom - this.camX;
    const wy = (sy - this.height / 2) / this.zoom - this.camY;
    return { wx, wy };
  }

  hitTest(sx, sy) {
    const { wx, wy } = this.screenToWorld(sx, sy);

    // 1. Cells (highest priority)
    for (let i = this._hitCells.length - 1; i >= 0; i--) {
      const c = this._hitCells[i];
      if (wx >= c.x - c.w / 2 && wx <= c.x + c.w / 2 && wy >= c.y - c.h / 2 && wy <= c.y + c.h / 2) {
        return { kind: "cell", id: c.id };
      }
    }

    // 2. Negative-space voids
    for (const v of this._hitVoids) {
      if (Math.hypot(wx - v.x, wy - v.y) <= 28) {
        return { kind: "void", id: v.id };
      }
    }

    // 3. Dialectical axis midpoint pills
    for (const a of this._hitAxes) {
      if (Math.abs(wx - a.mx) <= 78 && Math.abs(wy - a.my) <= 18) {
        return { kind: "axis", id: a.id };
      }
    }

    // 4. Emergent basin halos (smallest radius first)
    const sortedBasins = [...this._hitBasins].sort((a, b) => a.radius - b.radius);
    for (const b of sortedBasins) {
      if (Math.hypot(wx - b.cx, wy - b.cy) <= b.radius) {
        return { kind: "basin", id: b.id };
      }
    }

    return null;
  }

  render({ cells, edges, basins, axes, voids, ripples, telemetry, topologyBlend, showMirror, time }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Deep atmospheric obsidian backdrop
    const bgGrad = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.48,
      40,
      this.width * 0.5,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.75
    );
    bgGrad.addColorStop(0, "#0b1121");
    bgGrad.addColorStop(0.55, "#070a14");
    bgGrad.addColorStop(1, "#04060b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Transform into world camera space
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(this.camX, this.camY);

    // Subtle anoptical coordinate grid & metastability horizon ring
    this.drawAnopticalBackdrop(ctx, telemetry, topologyBlend, time);

    this._hitBasins = [];
    this._hitAxes = [];
    this._hitVoids = [];
    this._hitCells = [];

    // Build cell lookup map for edge rendering
    const cellMap = new Map();
    for (const c of cells) cellMap.set(c.id, c);

    // 1. Overhead Mirror Layer: Basin Halos
    if (showMirror && basins && basins.length > 0) {
      this.drawBasins(ctx, basins, topologyBlend);
    }

    // 2. Semantic Resonance Filaments & Dialectical Tension Ridges
    this.drawEdges(ctx, edges, cellMap, topologyBlend);

    // 3. Transductive Leverage Ripples
    if (ripples && ripples.length > 0) {
      this.drawRipples(ctx, ripples);
    }

    // 4. Overhead Mirror Layer: Dialectical Axes & Negative Space Voids
    if (showMirror) {
      if (axes && axes.length > 0) this.drawAxes(ctx, axes);
      if (voids && voids.length > 0) this.drawVoids(ctx, voids, time);
    }

    // 5. Noetic Cells (foreground)
    this.drawCells(ctx, cells, topologyBlend, time);

    ctx.restore();
  }

  drawAnopticalBackdrop(ctx, telemetry, topologyBlend, time) {
    // Faint architectural grid
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.045)";
    ctx.lineWidth = 1;
    const step = 62;
    const spanX = 620;
    const spanY = 440;
    ctx.beginPath();
    for (let x = -spanX; x <= spanX; x += step) {
      ctx.moveTo(x, -spanY);
      ctx.lineTo(x, spanY);
    }
    for (let y = -spanY; y <= spanY; y += step) {
      ctx.moveTo(-spanX, y);
      ctx.lineTo(spanX, y);
    }
    ctx.stroke();

    // Ambient metastability breathing ring around origin
    const meta = telemetry ? telemetry.metastability : 0.5;
    const pulse = Math.sin(time * 0.0014) * 6;
    const ringRadius = 210 + meta * 90 + pulse;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.04 + meta * 0.07})`;
    ctx.setLineDash([4, 10]);
    ctx.stroke();
    ctx.setLineDash([]);

    // In Spiral mode, reveal subtle Auberian concentric mosaic guides
    if (topologyBlend > 0.08) {
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.08 * topologyBlend})`;
      ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) {
        const rx = (k * 2 + 1) * 62;
        const ry = (k * 2 + 1) * 38;
        ctx.strokeRect(-rx, -ry, rx * 2, ry * 2);
      }
    }
    ctx.restore();
  }

  drawBasins(ctx, basins, topologyBlend) {
    const fade = 1 - topologyBlend * 0.45;
    for (let i = 0; i < basins.length; i++) {
      const b = basins[i];
      const pal = BASIN_PALETTE[i % BASIN_PALETTE.length];
      const isSelected = this.selectedId === b.id;

      ctx.save();
      ctx.globalAlpha = fade;

      const grad = ctx.createRadialGradient(b.cx, b.cy, 8, b.cx, b.cy, b.radius);
      grad.addColorStop(0, pal.fill);
      grad.addColorStop(0.75, pal.fill);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Delicate orbital halo boundary
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.radius, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? "#e0f2fe" : pal.stroke;
      ctx.lineWidth = isSelected ? 1.8 : 1;
      ctx.setLineDash([5, 7]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Translucent overhead basin label
      ctx.font = '500 11px "Space Grotesk", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = pal.text;
      const prefix = b.isLlmNamed ? "◈ " : "";
      ctx.fillText(`${prefix}${b.label.toUpperCase()}`, b.cx, b.cy - b.radius + 16);

      ctx.restore();
      this._hitBasins.push({ id: b.id, cx: b.cx, cy: b.cy, radius: b.radius });
    }
  }

  drawEdges(ctx, edges, cellMap, topologyBlend) {
    for (const e of edges) {
      const a = cellMap.get(e.a);
      const b = cellMap.get(e.b);
      if (!a || !b) continue;

      ctx.save();
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      // Subtle perpendicular curve in Manifold mode; straighter membrane in Spiral mode
      const curveOffset = (1 - topologyBlend * 0.85) * Math.min(26, dist * 0.11);
      const ctrlX = midX - (dy / dist) * curveOffset;
      const ctrlY = midY + (dx / dist) * curveOffset;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, b.x, b.y);

      if (e.type === "tension") {
        ctx.strokeStyle = `rgba(251, 113, 133, ${0.22 + e.tension * 0.55})`;
        ctx.lineWidth = 1 + e.tension * 1.4;
        ctx.setLineDash([4, 4]);
      } else if (e.type === "bridge") {
        ctx.strokeStyle = `rgba(52, 211, 153, ${0.2 + e.resonance * 0.5})`;
        ctx.lineWidth = 1.1 + e.resonance * 1.2;
      } else {
        ctx.strokeStyle = `rgba(125, 211, 252, ${0.12 + e.resonance * 0.42})`;
        ctx.lineWidth = 0.8 + e.resonance * 1.4;
      }
      ctx.stroke();
      ctx.restore();
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

  drawAxes(ctx, axes) {
    for (const ax of axes) {
      const isSelected = this.selectedId === ax.id;
      ctx.save();

      // Overhead tension axis line
      ctx.beginPath();
      ctx.moveTo(ax.x1, ax.y1);
      ctx.lineTo(ax.x2, ax.y2);
      ctx.strokeStyle = isSelected ? "rgba(251, 113, 133, 0.85)" : "rgba(251, 113, 133, 0.34)";
      ctx.lineWidth = isSelected ? 2 : 1.2;
      ctx.setLineDash([7, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Translucent polarity pill at midpoint
      ctx.font = '500 10.5px "JetBrains Mono", monospace';
      const labelText = ax.label;
      const tw = ctx.measureText(labelText).width;
      const pw = tw + 18;
      const ph = 22;

      this.roundRect(ctx, ax.mx - pw / 2, ax.my - ph / 2, pw, ph, 11);
      ctx.fillStyle = "rgba(18, 12, 22, 0.86)";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#fda4af" : "rgba(251, 113, 133, 0.45)";
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

  drawVoids(ctx, voids, time) {
    for (const v of voids) {
      const isSelected = this.selectedId === v.id;
      const breathe = Math.sin(time * 0.0022) * 2.5;
      ctx.save();

      ctx.beginPath();
      ctx.arc(v.x, v.y, 20 + breathe, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? "#fde68a" : "rgba(251, 191, 36, 0.42)";
      ctx.lineWidth = isSelected ? 1.8 : 1.1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '500 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = "rgba(253, 230, 138, 0.82)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(v.label, v.x, v.y);

      ctx.restore();
      this._hitVoids.push({ id: v.id, x: v.x, y: v.y });
    }
  }

  drawCells(ctx, cells, topologyBlend, time) {
    // Draw synthetic agents first, human cells on top, local human very last
    const ordered = [...cells].sort((a, b) => {
      if (a.isLocal !== b.isLocal) return a.isLocal ? 1 : -1;
      if (a.isHuman !== b.isHuman) return a.isHuman ? 1 : -1;
      return 0;
    });

    for (const c of ordered) {
      const stanceInfo = STANCE_META[c.stance] || STANCE_META.assert;
      const isSelected = this.selectedId === c.id;
      const age = time - (c.updatedAt || 0);
      const recentGlow = age < 1400 ? 1 - age / 1400 : 0;

      ctx.save();
      ctx.font = c.isHuman
        ? '600 13px "Space Grotesk", sans-serif'
        : '400 12px "Inter", sans-serif';

      const textWidth = ctx.measureText(c.term).width;
      // Morph from sleek pill (Manifold) toward crisp modular Auberian tile (Spiral)
      const pillW = Math.max(76, textWidth + 36);
      const pillH = c.isHuman ? 34 : 30;
      const tileW = 112;
      const tileH = 62;
      const w = pillW * (1 - topologyBlend) + tileW * topologyBlend;
      const h = pillH * (1 - topologyBlend) + tileH * topologyBlend;
      const radius = (h / 2) * (1 - topologyBlend) + 8 * topologyBlend;

      // Subtle glow for human / local / recently perturbed cell
      if (c.isLocal || c.isHuman || recentGlow > 0.05) {
        ctx.shadowColor = c.isLocal ? "#7dd3fc" : stanceInfo.color;
        ctx.shadowBlur = c.isLocal ? 18 + recentGlow * 14 : 10 + recentGlow * 14;
      }

      this.roundRect(ctx, c.x - w / 2, c.y - h / 2, w, h, radius);
      ctx.fillStyle = c.isLocal
        ? "rgba(14, 28, 48, 0.94)"
        : c.isHuman
        ? "rgba(19, 27, 44, 0.92)"
        : "rgba(12, 16, 28, 0.84)";
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.lineWidth = isSelected ? 2 : c.isLocal ? 1.8 : c.isHuman ? 1.35 : 1;
      ctx.strokeStyle = isSelected
        ? "#ffffff"
        : c.isLocal
        ? stanceInfo.color
        : c.isHuman
        ? "rgba(226, 232, 240, 0.65)"
        : "rgba(148, 163, 184, 0.25)";
      ctx.stroke();

      // Draw stance glyph + concept label
      ctx.textBaseline = "middle";
      if (topologyBlend > 0.6) {
        // Mosaic tile layout (Spiral mode)
        ctx.fillStyle = stanceInfo.color;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = "left";
        ctx.fillText(stanceInfo.glyph, c.x - w / 2 + 8, c.y - h / 2 + 13);

        ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
        ctx.font = '400 9px "JetBrains Mono", monospace';
        ctx.textAlign = "right";
        ctx.fillText(`#${c.spiralIndex}`, c.x + w / 2 - 8, c.y - h / 2 + 13);

        ctx.fillStyle = c.isHuman ? "#f8fafc" : "#cbd5e1";
        ctx.font = c.isHuman
          ? '600 12px "Space Grotesk", sans-serif'
          : '400 11.5px "Inter", sans-serif';
        ctx.textAlign = "center";
        const clipped = c.term.length > 14 ? `${c.term.slice(0, 13)}…` : c.term;
        ctx.fillText(clipped, c.x, c.y + 6);
      } else {
        // Pill layout (Manifold mode)
        ctx.fillStyle = stanceInfo.color;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = "left";
        ctx.fillText(stanceInfo.glyph, c.x - w / 2 + 11, c.y + 0.5);

        ctx.fillStyle = c.isHuman ? "#f8fafc" : "#cbd5e1";
        ctx.font = c.isHuman
          ? '600 13px "Space Grotesk", sans-serif'
          : '400 12px "Inter", sans-serif';
        ctx.textAlign = "left";
        ctx.fillText(c.term, c.x - w / 2 + 25, c.y + 0.5);
      }

      ctx.restore();
      this._hitCells.push({ id: c.id, x: c.x, y: c.y, w, h });
    }
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
