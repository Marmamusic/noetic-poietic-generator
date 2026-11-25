// Zero-Server Collective Synchronization
// 1. BroadcastChannel: instant multi-tab multiplayer on the same browser/device
// 2. Optional WebRTC P2P Room Sync (via PeerJS CDN) for remote multiplayer on GitHub Pages without a backend

const CHANNEL_NAME = "noetic-poietic-generator-v1";

export class SyncEngine {
  constructor(localId, handlers) {
    this.localId = localId;
    this.handlers = handlers; // { onRemoteCell, onRemoteLeave, onStatus, getLocalCell }
    this.roomCode = null;
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.isHost = false;
    this.remoteHumanIds = new Set();

    // 1. Always initialize BroadcastChannel for instant local multi-tab testing
    this.bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
    if (this.bc) {
      this.bc.onmessage = (ev) => this.handleMessage(ev.data, "tab");
      // Announce arrival so existing tabs reply with their cells
      this.bc.postMessage({ type: "hello", sender: this.localId });
    }

    window.addEventListener("beforeunload", () => {
      this.broadcast({ type: "leave", id: this.localId });
    });
  }

  broadcast(payload) {
    if (this.bc) {
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
      const local = this.handlers.getLocalCell();
      if (local) {
        const reply = {
          type: "cell",
          sender: this.localId,
          cell: { id: local.id, term: local.term, stance: local.stance },
        };
        if (source === "tab" && this.bc) this.bc.postMessage(reply);
        if (fromConn && fromConn.open) fromConn.send(reply);
      }
      return;
    }

    if (msg.type === "cell" && msg.cell && msg.cell.id) {
      this.remoteHumanIds.add(msg.cell.id);
      this.handlers.onRemoteCell(msg.cell);

      // If we are the P2P room hub, relay to other connected peers
      if (this.isHost && source === "p2p") {
        for (const [pid, conn] of this.connections.entries()) {
          if (conn !== fromConn && conn.open) {
            conn.send(msg);
          }
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

  /**
   * Lazy-loads PeerJS only when joining/creating a P2P WebRTC room.
   */
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
    } catch (err) {
      this.emitStatus("P2P offline (BroadcastChannel active)", null);
      this.roomCode = null;
      return false;
    }

    // Strategy: try claiming the room host ID first; if taken, join as guest connecting to host.
    return new Promise((resolve) => {
      const hostAttempt = new PeerCtor(hostPeerId);

      hostAttempt.on("open", () => {
        this.peer = hostAttempt;
        this.isHost = true;
        this.emitStatus(`P2P Host: ${code} (0 peers)`, code);

        hostAttempt.on("connection", (conn) => {
          this.wireConnection(conn);
        });
        resolve(true);
      });

      hostAttempt.on("error", (err) => {
        if (err && err.type === "unavailable-id") {
          // Room already exists -> connect as peer guest
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
      const local = this.handlers.getLocalCell();
      if (local) {
        conn.send({
          type: "cell",
          sender: this.localId,
          cell: { id: local.id, term: local.term, stance: local.stance },
        });
      }
    });

    conn.on("data", (data) => {
      this.handleMessage(data, "p2p", conn);
    });

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
    this.emitStatus("BroadcastChannel actif (multi-onglets)", null);
  }

  emitStatus(text, activeRoom) {
    if (this.handlers.onStatus) {
      this.handlers.onStatus(text, activeRoom);
    }
  }
}
