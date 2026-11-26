// Zero-Server Collective Synchronization (v7)
// - Isolated solo session by default (zero ghost word bleed from older tabs!)
// - Opt-in BroadcastChannel multi-tab sync toggle
// - Optional WebRTC P2P Room Sync (via PeerJS CDN) for remote multiplayer without a backend

const CHANNEL_NAME = "noetic-poietic-generator-v7";

export class SyncEngine {
  constructor(localId, handlers) {
    this.localId = localId;
    this.handlers = handlers; // { onRemoteCell, onRemoteLeave, onStatus, getLocalCells }
    this.roomCode = null;
    this.peer = null;
    this.connections = new Map();
    this.isHost = false;
    this.remoteHumanIds = new Set();

    // Opt-in local multi-tab BroadcastChannel (OFF by default so blank sessions stay 100% blank!)
    this.tabSyncEnabled = false;
    this.bc = null;

    window.addEventListener("beforeunload", () => {
      const locals = this.handlers.getLocalCells ? this.handlers.getLocalCells() : [];
      for (const c of locals) {
        this.broadcast({ type: "leave", id: c.id });
      }
    });
  }

  setTabSync(enabled) {
    this.tabSyncEnabled = Boolean(enabled);
    if (this.tabSyncEnabled && !this.bc && typeof BroadcastChannel !== "undefined") {
      this.bc = new BroadcastChannel(CHANNEL_NAME);
      this.bc.onmessage = (ev) => this.handleMessage(ev.data, "tab");
      this.bc.postMessage({ type: "hello", sender: this.localId });
      this.emitStatus(this.roomCode ? `P2P: ${this.roomCode} + Multi-onglets` : "Multi-onglets actif", this.roomCode);
    } else if (!this.tabSyncEnabled && this.bc) {
      this.bc.close();
      this.bc = null;
      this.emitStatus(this.roomCode ? `P2P: ${this.roomCode}` : "Session isolée (solo)", this.roomCode);
    }
  }

  broadcast(payload) {
    if (this.bc && this.tabSyncEnabled) {
      this.bc.postMessage({ ...payload, sender: this.localId });
    }
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send({ ...payload, sender: this.localId });
      }
    }
  }

  publishLocalCell(cell) {
    this.broadcast({
      type: "cell",
      cell: {
        id: cell.id,
        term: cell.term,
        stance: cell.stance,
        intensity: cell.intensity || 1.0,
      },
    });
  }

  handleMessage(msg, source, fromConn = null) {
    if (!msg || msg.sender === this.localId) return;

    if (msg.type === "hello") {
      const locals = this.handlers.getLocalCells ? this.handlers.getLocalCells() : [];
      for (const local of locals) {
        const reply = {
          type: "cell",
          sender: this.localId,
          cell: { id: local.id, term: local.term, stance: local.stance, intensity: local.intensity || 1.0 },
        };
        if (source === "tab" && this.bc && this.tabSyncEnabled) this.bc.postMessage(reply);
        if (fromConn && fromConn.open) fromConn.send(reply);
      }
      return;
    }

    if (msg.type === "cell" && msg.cell && msg.cell.id) {
      this.remoteHumanIds.add(msg.cell.id);
      this.handlers.onRemoteCell(msg.cell);

      if (this.isHost && source === "p2p") {
        for (const conn of this.connections.values()) {
          if (conn !== fromConn && conn.open) conn.send(msg);
        }
      }
      return;
    }

    if (msg.type === "leave" && msg.id) {
      this.remoteHumanIds.delete(msg.id);
      this.handlers.onRemoteLeave(msg.id);
      if (this.isHost && source === "p2p") {
        for (const conn of this.connections.values()) {
          if (conn !== fromConn && conn.open) conn.send(msg);
        }
      }
    }
  }

  async loadPeerJS() {
    if (window.Peer) return window.Peer;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js";
      script.onload = () => resolve(window.Peer);
      script.onerror = () => reject(new Error("PeerJS CDN unavailable"));
      document.head.appendChild(script);
    });
  }

  sanitizeRoom(code) {
    return (code || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24);
  }

  async joinRoom(rawCode) {
    const code = this.sanitizeRoom(rawCode);
    if (!code) return false;
    this.leaveRoom();
    this.roomCode = code;
    const hostPeerId = `npg-anoptikon-room-${code}`;
    this.emitStatus(`Connecting P2P "${code}"…`, code);

    let PeerCtor;
    try {
      PeerCtor = await this.loadPeerJS();
    } catch {
      this.emitStatus("P2P indisponible (hors-ligne)", null);
      this.roomCode = null;
      return false;
    }

    return new Promise((resolve) => {
      const hostAttempt = new PeerCtor(hostPeerId);

      hostAttempt.on("open", () => {
        this.peer = hostAttempt;
        this.isHost = true;
        this.emitStatus(`P2P Host: ${code} (0 peers)`, code);
        hostAttempt.on("connection", (conn) => this.wireConnection(conn));
        resolve(true);
      });

      hostAttempt.on("error", (err) => {
        if (err && err.type === "unavailable-id") {
          hostAttempt.destroy();
          const guest = new PeerCtor();
          this.peer = guest;
          this.isHost = false;

          guest.on("open", () => {
            const conn = guest.connect(hostPeerId, { reliable: true });
            this.wireConnection(conn);
            this.emitStatus(`P2P Joined: ${code}`, code);
            resolve(true);
          });

          guest.on("error", (gErr) => {
            this.emitStatus(`P2P error: ${gErr.type || "network"}`, null);
            resolve(false);
          });
        } else {
          this.emitStatus(`P2P unavailable (${err?.type || "offline"})`, null);
          this.roomCode = null;
          resolve(false);
        }
      });
    });
  }

  wireConnection(conn) {
    conn.on("open", () => {
      this.connections.set(conn.peer, conn);
      this.emitStatus(
        `${this.isHost ? "P2P Host" : "P2P Room"}: ${this.roomCode} (${this.connections.size} peer${this.connections.size === 1 ? "" : "s"})`,
        this.roomCode
      );
      conn.send({ type: "hello", sender: this.localId });
      const locals = this.handlers.getLocalCells ? this.handlers.getLocalCells() : [];
      for (const local of locals) {
        conn.send({
          type: "cell",
          sender: this.localId,
          cell: { id: local.id, term: local.term, stance: local.stance, intensity: local.intensity || 1.0 },
        });
      }
    });

    conn.on("data", (data) => this.handleMessage(data, "p2p", conn));

    conn.on("close", () => {
      this.connections.delete(conn.peer);
      this.emitStatus(
        `${this.isHost ? "P2P Host" : "P2P Room"}: ${this.roomCode} (${this.connections.size} peer${this.connections.size === 1 ? "" : "s"})`,
        this.roomCode
      );
    });
  }

  leaveRoom() {
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch { /* noop */ }
    }
    this.connections.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* noop */ }
      this.peer = null;
    }
    this.roomCode = null;
    this.isHost = false;
    this.emitStatus(this.tabSyncEnabled ? "Multi-onglets actif" : "Session isolée (solo)", null);
  }

  emitStatus(text, activeRoom) {
    if (this.handlers.onStatus) this.handlers.onStatus(text, activeRoom);
  }
}
