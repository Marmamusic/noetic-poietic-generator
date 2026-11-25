// Append-only Morphogenesis Recorder & Temporal Scrubber
// Preserves full evolutionary trace of collective thought for playback & research export.

export class ReplayEngine {
  constructor(maxFrames = 400) {
    this.maxFrames = maxFrames;
    this.frames = [];
    this.isScrubbing = false;
    this.scrubIndex = 0;
    this.startedAt = Date.now();
  }

  capture(topology, mirror, eventNote = null) {
    if (this.isScrubbing) return;

    const cells = Array.from(topology.cells.values()).map((c) => ({
      id: c.id,
      term: c.term,
      stance: c.stance,
      isHuman: c.isHuman,
      isLocal: c.isLocal,
      x: Math.round(c.x * 10) / 10,
      y: Math.round(c.y * 10) / 10,
      spiralIndex: c.spiralIndex,
      clusterId: c.clusterId,
      lastLeverage: c.lastLeverage || 0,
    }));

    const frame = {
      t: Date.now() - this.startedAt,
      event: eventNote,
      telemetry: { ...topology.telemetry },
      cells,
      edges: topology.edges.map((e) => ({ ...e })),
      basins: mirror.basins.map((b) => ({
        id: b.id,
        label: b.label,
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
      instrument: "Noetic Poietic Generator",
      exportedAt: new Date().toISOString(),
      frameCount: this.frames.length,
      frames: this.frames,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `noetic-morphogenesis-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
