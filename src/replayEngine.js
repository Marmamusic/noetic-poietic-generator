// Append-only Morphogenesis Recorder & Temporal Scrubber (v3)
// Captures underlying topology + living emerging Palimpsest sentences for playback & research export.

export class ReplayEngine {
  constructor(maxFrames = 400) {
    this.maxFrames = maxFrames;
    this.frames = [];
    this.isScrubbing = false;
    this.scrubIndex = 0;
    this.startedAt = Date.now();
  }

  capture(topology, mirror, palimpsest = null, eventNote = null) {
    if (this.isScrubbing) return;

    const cells = Array.from(topology.cells.values()).map((c) => ({
      id: c.id,
      term: c.term,
      stance: c.stance,
      intensity: c.intensity || 1.0,
      hue: c.hue != null ? c.hue : 200,
      isHuman: c.isHuman,
      isLocal: c.isLocal,
      x: Math.round(c.x * 10) / 10,
      y: Math.round(c.y * 10) / 10,
      gx: c.gx,
      gy: c.gy,
      spiralIndex: c.spiralIndex,
      clusterId: c.clusterId,
      lastLeverage: c.lastLeverage || 0,
    }));

    const palSnap = palimpsest
      ? palimpsest.sentences.map((s) => ({
          id: s.id,
          text: s.text,
          prevText: null,
          anchors: [...(s.anchors || [])],
          role: s.role,
          status: s.status === "lingering" ? "lingering" : "alive",
        }))
      : [];

    const frame = {
      t: Date.now() - this.startedAt,
      event: eventNote,
      noeme: mirror.noeme,
      palimpsest: palSnap,
      compass: { ...topology.compass },
      telemetry: { ...topology.telemetry },
      cells,
      edges: topology.edges.map((e) => ({ ...e })),
      basins: mirror.basins.map((b) => ({
        id: b.id,
        label: b.label,
        hue: b.hue,
        cx: b.cx,
        cy: b.cy,
        radius: b.radius,
        coherence: b.coherence,
      })),
      axes: mirror.axes.map((a) => ({
        id: a.id,
        label: a.label,
        x1: a.x1,
        y1: a.y1,
        x2: a.x2,
        y2: a.y2,
        mx: a.mx,
        my: a.my,
        strength: a.strength,
      })),
      voids: mirror.voids.map((v) => ({ ...v })),
    };

    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
    }
  }

  getFrame(index) {
    if (this.frames.length === 0) return null;
    const clamped = Math.max(0, Math.min(this.frames.length - 1, index));
    return this.frames[clamped];
  }

  exportJSON() {
    const payload = {
      instrument: "Noetic Poietic Generator v3 (Living Palimpsest)",
      exportedAt: new Date().toISOString(),
      frameCount: this.frames.length,
      frames: this.frames,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `noetic-palimpsest-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
