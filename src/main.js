// Main Orchestrator for the Noetic Poietic Generator (v2)

import { TRANSLATIONS } from "./i18n.js?v=2";
import { SemanticEngine } from "./semanticEngine.js?v=2";
import { TopologyEngine } from "./topologyEngine.js?v=2";
import { MirrorEngine } from "./mirrorEngine.js?v=2";
import { SwarmEngine } from "./swarmEngine.js?v=2";
import { SyncEngine } from "./syncEngine.js?v=2";
import { ReplayEngine } from "./replayEngine.js?v=2";
import { NoeticRenderer } from "./renderer.js?v=2";

const localId = `human-${Math.random().toString(36).slice(2, 8)}`;

// Core engines
const semantic = new SemanticEngine();
const topology = new TopologyEngine(semantic);
const mirror = new MirrorEngine(topology);
const swarm = new SwarmEngine(topology, semantic);
const replay = new ReplayEngine(450);

const canvas = document.getElementById("noetic-canvas");
const renderer = new NoeticRenderer(canvas);

// App state
let currentLang = "fr";
let currentStance = "assert";
let currentIntensity = 1.0;
let selectedArtifact = null; // { kind, id }
let ghostPreview = null;
let lastFrameTime = performance.now();
let lastMirrorUpdate = 0;
let lastReplayCapture = 0;

// DOM references
const el = {
  phaseDot: document.getElementById("phase-dot"),
  valPhase: document.getElementById("val-phase"),
  valMeta: document.getElementById("val-metastability"),
  valEntropy: document.getElementById("val-entropy"),
  valTension: document.getElementById("val-tension"),
  valSimplicity: document.getElementById("val-simplicity"),
  valCells: document.getElementById("val-cells"),
  noemeMirror: document.getElementById("noeme-mirror"),
  noemeText: document.getElementById("noeme-text"),
  noemeDiff: document.getElementById("noeme-diff"),
  inputConcept: document.getElementById("input-concept"),
  tokenCounter: document.getElementById("token-counter"),
  leverageReadout: document.getElementById("leverage-readout"),
  cellForm: document.getElementById("cell-form"),
  stanceBtns: Array.from(document.querySelectorAll(".stance-btn")),
  intensityBtns: Array.from(document.querySelectorAll(".int-btn")),
  btnTopoManifold: document.getElementById("btn-topo-manifold"),
  btnTopoSpiral: document.getElementById("btn-topo-spiral"),
  btnToggleMirror: document.getElementById("btn-toggle-mirror"),
  btnNeural: document.getElementById("btn-neural"),
  neuralLed: document.getElementById("neural-led"),
  neuralLabel: document.getElementById("neural-label"),
  btnSwarmPanel: document.getElementById("btn-swarm-panel"),
  swarmCountBadge: document.getElementById("swarm-count-badge"),
  sliderSwarm: document.getElementById("slider-swarm"),
  labelSwarmVal: document.getElementById("label-swarm-val"),
  sliderTempo: document.getElementById("slider-tempo"),
  labelTempoVal: document.getElementById("label-tempo-val"),
  btnSwarmPause: document.getElementById("btn-swarm-pause"),
  btnSwarmPulse: document.getElementById("btn-swarm-pulse"),
  btnRoomPanel: document.getElementById("btn-room-panel"),
  roomBadge: document.getElementById("room-badge"),
  inputRoomCode: document.getElementById("input-room-code"),
  btnRoomJoin: document.getElementById("btn-room-join"),
  btnRoomCreate: document.getElementById("btn-room-create"),
  btnRoomCopy: document.getElementById("btn-room-copy"),
  btnRoomLeave: document.getElementById("btn-room-leave"),
  roomStatus: document.getElementById("room-status"),
  btnLlmPanel: document.getElementById("btn-llm-panel"),
  inputLlmEndpoint: document.getElementById("input-llm-endpoint"),
  inputLlmModel: document.getElementById("input-llm-model"),
  inputLlmKey: document.getElementById("input-llm-key"),
  btnLlmToggle: document.getElementById("btn-llm-toggle"),
  btnLlmTrigger: document.getElementById("btn-llm-trigger"),
  llmStatus: document.getElementById("llm-status"),
  btnLang: document.getElementById("btn-lang"),
  btnHelp: document.getElementById("btn-help"),
  helpContent: document.getElementById("help-content"),
  modalHelp: document.getElementById("modal-help"),
  inspectorPanel: document.getElementById("inspector-panel"),
  inspectorKicker: document.getElementById("inspector-kicker"),
  inspectorTitle: document.getElementById("inspector-title"),
  inspectorBody: document.getElementById("inspector-body"),
  btnCloseInspector: document.getElementById("btn-close-inspector"),
  btnReplayMode: document.getElementById("btn-replay-mode"),
  sliderReplay: document.getElementById("slider-replay"),
  replayLabel: document.getElementById("replay-label"),
  btnExportLog: document.getElementById("btn-export-log"),
  toast: document.getElementById("toast"),
};

// Toast helper
let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 3200);
}

function t() {
  return TRANSLATIONS[currentLang] || TRANSLATIONS.fr;
}

function applyTranslations() {
  const dict = t();
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (dict[key]) node.textContent = dict[key];
  });
  el.inputConcept.placeholder = dict.inputPlaceholder;
  el.helpContent.innerHTML = dict.helpHtml;
  el.btnLang.textContent = currentLang.toUpperCase();
  el.btnSwarmPause.textContent = swarm.paused ? dict.resume : dict.pause;
  el.btnLlmToggle.textContent = mirror.llmEnabled ? dict.llmDisable : dict.llmEnable;
  topology.refreshCompassLabels(currentLang);
  mirror.update(currentLang);
  updateNeuralButtonUI();
  updateNoemeUI();
  updateTelemetryUI(topology.telemetry);
  if (selectedArtifact) renderInspector();
}

function updateNeuralButtonUI(progress = 0) {
  const dict = t();
  el.neuralLed.classList.remove("ready", "loading");
  if (semantic.mode === "neural") {
    el.neuralLed.classList.add("ready");
    el.neuralLabel.textContent = dict.engineNeural;
    el.btnNeural.classList.add("active");
  } else if (semantic.mode === "loading") {
    el.neuralLed.classList.add("loading");
    el.neuralLabel.textContent = `${dict.engineLoading} ${progress}%`;
  } else {
    el.neuralLabel.textContent = dict.engineFast;
    el.btnNeural.classList.remove("active");
  }
}

function updateNoemeUI(overrideText = null) {
  el.noemeMirror.classList.toggle("muted", !mirror.visible);
  el.noemeText.textContent = overrideText || mirror.noeme || "—";

  const diff = mirror.lastDiff;
  if (!overrideText && diff && performance.now() - diff.bornAt < 7500) {
    const prefix = t().diffPrefix;
    if (diff.changed) {
      el.noemeDiff.innerHTML = `${prefix} (« ${escapeHtml(diff.triggerTerm)} » · ΔM ${diff.leverage.toFixed(2)}) : <span class="diff-old">${escapeHtml(diff.prevNoeme)}</span> → ${escapeHtml(diff.nextNoeme)}`;
    } else {
      el.noemeDiff.textContent = `${prefix} (« ${diff.triggerTerm} » · ΔM ${diff.leverage.toFixed(2)}) — ${mirror.noemeSub}`;
    }
    el.noemeDiff.classList.remove("hidden");
  } else {
    el.noemeDiff.classList.add("hidden");
  }
}

// Multiplayer SyncEngine
const sync = new SyncEngine(localId, {
  getLocalCell: () => topology.cells.get(localId),
  onRemoteCell: (cell) => {
    topology.upsertCell({
      id: cell.id,
      term: cell.term,
      stance: cell.stance || "assert",
      intensity: cell.intensity || 1.0,
      isHuman: true,
      isLocal: false,
    });
    if (semantic.mode === "neural") {
      topology.refreshEmbeddingsAsync();
    }
    mirror.update(currentLang);
    updateNoemeUI();
    replay.capture(topology, mirror, `remote:${cell.term}`);
  },
  onRemoteLeave: (id) => {
    topology.removeCell(id);
    mirror.update(currentLang);
    updateNoemeUI();
  },
  onStatus: (statusText, activeRoom) => {
    el.roomStatus.textContent = statusText;
    if (activeRoom) {
      el.roomBadge.textContent = `#${activeRoom}`;
      el.btnRoomPanel.classList.add("active");
      el.btnRoomCopy.classList.remove("hidden");
      el.btnRoomLeave.classList.remove("hidden");
    } else {
      el.roomBadge.textContent = t().roomLocal;
      el.btnRoomPanel.classList.remove("active");
      el.btnRoomCopy.classList.add("hidden");
      el.btnRoomLeave.classList.add("hidden");
    }
  },
});

function sanitizeConcept(raw) {
  const words = (raw || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return words.slice(0, 3).join(" ").slice(0, 34);
}

function updateTokenCounterAndGhost() {
  const raw = el.inputConcept.value;
  const words = raw.trim().split(/\s+/).filter(Boolean);
  el.tokenCounter.textContent = `${words.length}/3`;
  el.tokenCounter.classList.toggle("over", words.length > 3);

  // Live Ghost Preview before pressing Enter!
  const draft = sanitizeConcept(raw);
  ghostPreview = draft ? topology.computeGhostPreview(localId, draft, currentStance) : null;
}

async function commitLocalGesture(rawTerm, stance = currentStance, intensity = currentIntensity) {
  const term = sanitizeConcept(rawTerm);
  if (!term) return;
  el.inputConcept.value = term;
  ghostPreview = null;
  const words = term.split(" ").filter(Boolean);
  el.tokenCounter.textContent = `${words.length}/3`;
  el.tokenCounter.classList.remove("over");

  if (replay.isScrubbing) exitReplayScrub();

  const prevNoeme = mirror.noeme;
  const leverage = topology.upsertCell({
    id: localId,
    term,
    stance,
    intensity,
    isHuman: true,
    isLocal: true,
  });

  // Notify swarm so agents perceptibly respond to the human's conceptual gesture
  swarm.notifyHumanGesture(term);

  el.leverageReadout.textContent = `ΔM ${leverage.toFixed(2)}`;
  sync.publishLocalCell({ id: localId, term, stance, intensity });

  if (semantic.mode === "neural") {
    const emb = await semantic.embed(term);
    const cell = topology.cells.get(localId);
    if (cell) {
      cell.embedding = emb;
      topology.recomputeGraph(localId, currentLang);
    }
  }

  topology.refreshCompassLabels(currentLang);
  mirror.update(currentLang);
  mirror.recordHumanInflection(prevNoeme, term, leverage);
  updateNoemeUI();
  replay.capture(topology, mirror, `you:${term} (${stance})`);
  syncReplaySlider();
  if (selectedArtifact) renderInspector();
}

// Popover management
const popovers = ["popover-swarm", "popover-room", "popover-llm"];
function togglePopover(id) {
  for (const pid of popovers) {
    const node = document.getElementById(pid);
    if (pid === id) node.classList.toggle("hidden");
    else node.classList.add("hidden");
  }
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.getAttribute("data-close"));
    if (target) target.classList.add("hidden");
  });
});

// UI Event Listeners
el.cellForm.addEventListener("submit", (e) => {
  e.preventDefault();
  commitLocalGesture(el.inputConcept.value, currentStance, currentIntensity);
});

el.inputConcept.addEventListener("input", updateTokenCounterAndGhost);
el.inputConcept.addEventListener("blur", () => {
  ghostPreview = null;
});

el.stanceBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentStance = btn.getAttribute("data-stance");
    el.stanceBtns.forEach((b) => b.classList.toggle("active", b === btn));
    const localCell = topology.cells.get(localId);
    if (localCell) {
      commitLocalGesture(el.inputConcept.value || localCell.term, currentStance, currentIntensity);
    }
  });
});

el.intensityBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentIntensity = Number(btn.getAttribute("data-intensity")) || 1.0;
    el.intensityBtns.forEach((b) => b.classList.toggle("active", b === btn));
    const localCell = topology.cells.get(localId);
    if (localCell) {
      commitLocalGesture(el.inputConcept.value || localCell.term, currentStance, currentIntensity);
    }
  });
});

el.btnTopoManifold.addEventListener("click", () => {
  topology.topologyMode = "manifold";
  el.btnTopoManifold.classList.add("active");
  el.btnTopoSpiral.classList.remove("active");
});

el.btnTopoSpiral.addEventListener("click", () => {
  topology.topologyMode = "spiral";
  el.btnTopoSpiral.classList.add("active");
  el.btnTopoManifold.classList.remove("active");
});

el.btnToggleMirror.addEventListener("click", () => {
  mirror.visible = !mirror.visible;
  el.btnToggleMirror.classList.toggle("active", mirror.visible);
  updateNoemeUI();
});

el.btnNeural.addEventListener("click", async () => {
  if (semantic.mode === "neural" || semantic.mode === "loading") return;
  const ok = await semantic.enableNeural((pct) => updateNeuralButtonUI(pct));
  updateNeuralButtonUI(ok ? 100 : 0);
  if (ok) {
    await topology.refreshEmbeddingsAsync();
    mirror.update(currentLang);
    updateNoemeUI();
    showToast(t().toasts.neuralReady);
  } else {
    showToast(t().toasts.neuralFailed);
  }
});

// Swarm controls
el.btnSwarmPanel.addEventListener("click", () => togglePopover("popover-swarm"));

el.sliderSwarm.addEventListener("input", () => {
  const val = Number(el.sliderSwarm.value);
  el.labelSwarmVal.textContent = String(val);
  el.swarmCountBadge.textContent = String(val);
  swarm.setTargetCount(val);
  mirror.update(currentLang);
  updateNoemeUI();
});

el.sliderTempo.addEventListener("input", () => {
  const val = Number(el.sliderTempo.value);
  el.labelTempoVal.textContent = String(val);
  swarm.tempo = val;
});

el.btnSwarmPause.addEventListener("click", () => {
  swarm.paused = !swarm.paused;
  el.btnSwarmPause.textContent = swarm.paused ? t().resume : t().pause;
});

el.btnSwarmPulse.addEventListener("click", () => {
  swarm.perturb(() => {});
  mirror.update(currentLang);
  updateNoemeUI();
  replay.capture(topology, mirror, "bifurcation");
  syncReplaySlider();
  showToast(t().toasts.perturbed);
});

// Room / P2P controls
el.btnRoomPanel.addEventListener("click", () => togglePopover("popover-room"));

el.btnRoomCreate.addEventListener("click", async () => {
  const code = `noesis-${Math.floor(100 + Math.random() * 900)}`;
  el.inputRoomCode.value = code;
  const ok = await sync.joinRoom(code);
  if (ok) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    window.history.replaceState({}, "", url.toString());
  }
});

el.btnRoomJoin.addEventListener("click", async () => {
  const code = el.inputRoomCode.value.trim();
  if (!code) return;
  const ok = await sync.joinRoom(code);
  if (ok) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", sync.roomCode);
    window.history.replaceState({}, "", url.toString());
  }
});

el.btnRoomCopy.addEventListener("click", async () => {
  if (!sync.roomCode) return;
  const url = new URL(window.location.href);
  url.searchParams.set("room", sync.roomCode);
  try {
    await navigator.clipboard.writeText(url.toString());
    showToast(t().toasts.linkCopied);
  } catch {
    showToast(url.toString());
  }
});

el.btnRoomLeave.addEventListener("click", () => {
  sync.leaveRoom();
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url.toString());
});

// Optional BYOK Overhead LLM Mirror controls
el.btnLlmPanel.addEventListener("click", () => togglePopover("popover-llm"));

const savedSessionKey = sessionStorage.getItem("npg_llm_key");
if (savedSessionKey) el.inputLlmKey.value = savedSessionKey;

mirror.onLlmStatus = (msg) => {
  el.llmStatus.textContent = msg;
  updateNoemeUI();
};

el.btnLlmToggle.addEventListener("click", () => {
  mirror.llmConfig.endpoint = el.inputLlmEndpoint.value.trim();
  mirror.llmConfig.model = el.inputLlmModel.value.trim();
  mirror.llmConfig.apiKey = el.inputLlmKey.value.trim();
  if (mirror.llmConfig.apiKey) {
    sessionStorage.setItem("npg_llm_key", mirror.llmConfig.apiKey);
  } else {
    sessionStorage.removeItem("npg_llm_key");
  }

  mirror.llmEnabled = !mirror.llmEnabled;
  el.btnLlmPanel.classList.toggle("active", mirror.llmEnabled);
  el.btnLlmToggle.textContent = mirror.llmEnabled ? t().llmDisable : t().llmEnable;
  showToast(mirror.llmEnabled ? t().toasts.llmEnabled : t().toasts.llmDisabled);
  if (mirror.llmEnabled) {
    mirror.reflectWithLLM(currentLang);
  } else {
    mirror.update(currentLang);
    updateNoemeUI();
  }
});

el.btnLlmTrigger.addEventListener("click", () => {
  mirror.llmConfig.endpoint = el.inputLlmEndpoint.value.trim();
  mirror.llmConfig.model = el.inputLlmModel.value.trim();
  mirror.llmConfig.apiKey = el.inputLlmKey.value.trim();
  mirror.llmEnabled = true;
  el.btnLlmPanel.classList.add("active");
  el.btnLlmToggle.textContent = t().llmDisable;
  mirror.reflectWithLLM(currentLang);
});

// Language toggle
el.btnLang.addEventListener("click", () => {
  currentLang = currentLang === "fr" ? "en" : "fr";
  swarm.setLanguage(currentLang, true);
  applyTranslations();
});

// Help modal
el.btnHelp.addEventListener("click", () => el.modalHelp.classList.remove("hidden"));
el.modalHelp.addEventListener("click", (e) => {
  if (e.target === el.modalHelp) el.modalHelp.classList.add("hidden");
});

// Anoptical Transparency Inspector
el.btnCloseInspector.addEventListener("click", () => {
  selectedArtifact = null;
  renderer.selectedId = null;
  el.inspectorPanel.classList.add("hidden");
});

function renderInspector() {
  if (!selectedArtifact) return;
  const ins = t().inspector;
  const { kind, id } = selectedArtifact;

  if (kind === "cell") {
    const cell = topology.cells.get(id);
    if (!cell) {
      el.inspectorPanel.classList.add("hidden");
      return;
    }
    el.inspectorKicker.textContent = ins.cellKicker;
    el.inspectorTitle.textContent = cell.term;

    const roleLabel = cell.isLocal
      ? ins.you
      : cell.isHuman
      ? ins.human
      : `${ins.agent} (${cell.archetype || "swarm"})`;

    const resLinks = [];
    const tenLinks = [];
    for (const e of topology.edges) {
      if (e.a !== cell.id && e.b !== cell.id) continue;
      const other = topology.cells.get(e.a === cell.id ? e.b : e.a);
      if (!other) continue;
      if (e.type === "tension") {
        tenLinks.push({ term: other.term, weight: e.tension });
      } else {
        resLinks.push({ term: other.term, weight: e.resonance });
      }
    }
    resLinks.sort((a, b) => b.weight - a.weight);
    tenLinks.sort((a, b) => b.weight - a.weight);

    const renderList = (items, isTension) =>
      items.length === 0
        ? `<span style="color:var(--text-muted)">${ins.noLinks}</span>`
        : `<div class="prov-list">${items
            .slice(0, 5)
            .map(
              (it) => `
            <div class="prov-row">
              <span>${escapeHtml(it.term)}</span>
              <span class="mono">${Math.round(it.weight * 100)}%</span>
            </div>
            <div class="prov-bar"><div class="prov-bar-fill ${isTension ? "tension" : ""}" style="width:${Math.round(it.weight * 100)}%"></div></div>`
            )
            .join("")}</div>`;

    el.inspectorBody.innerHTML = `
      <div class="prov-row"><span>Role</span><span class="mono">${escapeHtml(roleLabel)}</span></div>
      <div class="prov-row"><span>${ins.stance}</span><span class="mono">${escapeHtml(cell.stance)}</span></div>
      <div class="prov-row"><span>${ins.spiralIdx}</span><span class="mono">#${cell.spiralIndex} (${cell.gx}, ${cell.gy})</span></div>
      <div class="prov-row"><span>${ins.leverage}</span><span class="mono">ΔM ${(cell.lastLeverage || 0).toFixed(2)}</span></div>
      <div><strong>${ins.resonanceLinks}</strong>${renderList(resLinks, false)}</div>
      <div><strong>${ins.tensionLinks}</strong>${renderList(tenLinks, true)}</div>
    `;
    el.inspectorPanel.classList.remove("hidden");
    return;
  }

  if (kind === "basin") {
    const basin = mirror.basins.find((b) => b.id === id);
    if (!basin) {
      el.inspectorPanel.classList.add("hidden");
      return;
    }
    el.inspectorKicker.textContent = ins.basinKicker;
    el.inspectorTitle.textContent = basin.label;
    el.inspectorBody.innerHTML = `
      <div class="prov-row"><span>${ins.coherence}</span><span class="mono">${Math.round(basin.coherence * 100)}%</span></div>
      <div><strong>${ins.contributingCells} (${basin.members.length})</strong>
        <div class="prov-list" style="margin-top:6px;">
          ${basin.members
            .map(
              (m) => `
            <div class="prov-row">
              <span>${escapeHtml(m.term)}</span>
              <span class="mono">${m.isHuman ? ins.human : "swarm"} · ${escapeHtml(m.stance)}</span>
            </div>`
            )
            .join("")}
        </div>
      </div>
    `;
    el.inspectorPanel.classList.remove("hidden");
    return;
  }

  if (kind === "axis") {
    const ax = mirror.axes.find((a) => a.id === id);
    if (!ax) {
      el.inspectorPanel.classList.add("hidden");
      return;
    }
    el.inspectorKicker.textContent = ins.axisKicker;
    el.inspectorTitle.textContent = ax.label;
    el.inspectorBody.innerHTML = `
      <div class="prov-row"><span>${ins.tensionStrength}</span><span class="mono">${Math.round(ax.strength * 100)}%</span></div>
      <div><strong>${ins.contributingCells}</strong>
        <div class="prov-list" style="margin-top:6px;">
          ${ax.pairs
            .slice(0, 6)
            .map(
              (p) => `
            <div class="prov-row">
              <span>${escapeHtml(p.a)} ↔ ${escapeHtml(p.b)}</span>
              <span class="mono">${Math.round(p.tension * 100)}%</span>
            </div>`
            )
            .join("")}
        </div>
      </div>
    `;
    el.inspectorPanel.classList.remove("hidden");
    return;
  }

  if (kind === "void") {
    const v = mirror.voids.find((x) => x.id === id);
    if (!v) {
      el.inspectorPanel.classList.add("hidden");
      return;
    }
    el.inspectorKicker.textContent = ins.voidKicker;
    el.inspectorTitle.textContent = v.label;
    el.inspectorBody.innerHTML = `
      <p>${ins.voidNote}</p>
      <div class="prov-row"><span>Basin A</span><span class="mono">${escapeHtml(v.between[0])}</span></div>
      <div class="prov-row"><span>Basin B</span><span class="mono">${escapeHtml(v.between[1])}</span></div>
    `;
    el.inspectorPanel.classList.remove("hidden");
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Canvas Pan / Zoom / Click-to-Inspect
let dragging = false;
let dragMoved = false;
let dragStartX = 0;
let dragStartY = 0;
let camStartX = 0;
let camStartY = 0;

canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  dragMoved = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  camStartX = renderer.camX;
  camStartY = renderer.camY;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  if (Math.hypot(dx, dy) > 4) dragMoved = true;
  renderer.camX = camStartX + dx / renderer.zoom;
  renderer.camY = camStartY + dy / renderer.zoom;
});

canvas.addEventListener("pointerup", (e) => {
  if (!dragging) return;
  dragging = false;
  canvas.releasePointerCapture(e.pointerId);

  if (!dragMoved) {
    for (const pid of popovers) document.getElementById(pid).classList.add("hidden");

    const hit = renderer.hitTest(e.clientX, e.clientY);
    if (hit) {
      selectedArtifact = hit;
      renderer.selectedId = hit.id;
      renderInspector();
    } else {
      selectedArtifact = null;
      renderer.selectedId = null;
      el.inspectorPanel.classList.add("hidden");
    }
  }
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.09 : 0.92;
    renderer.zoom = Math.max(0.45, Math.min(2.2, renderer.zoom * factor));
  },
  { passive: false }
);

canvas.addEventListener("dblclick", () => renderer.resetCamera());

// Morphogenesis Replay Controls
function syncReplaySlider() {
  const maxIdx = Math.max(0, replay.frames.length - 1);
  el.sliderReplay.max = String(maxIdx);
  el.sliderReplay.disabled = maxIdx < 1;
  if (!replay.isScrubbing) {
    el.sliderReplay.value = String(maxIdx);
  }
}

function exitReplayScrub() {
  replay.isScrubbing = false;
  el.replayLabel.textContent = "LIVE";
  el.replayLabel.classList.remove("scrubbing");
  updateNoemeUI();
  syncReplaySlider();
}

el.btnReplayMode.addEventListener("click", () => {
  if (replay.isScrubbing) {
    exitReplayScrub();
  } else if (replay.frames.length > 1) {
    replay.isScrubbing = true;
    replay.scrubIndex = Math.max(0, replay.frames.length - 2);
    el.sliderReplay.value = String(replay.scrubIndex);
    el.replayLabel.textContent = `#${replay.scrubIndex}`;
    el.replayLabel.classList.add("scrubbing");
  }
});

el.sliderReplay.addEventListener("input", () => {
  const idx = Number(el.sliderReplay.value);
  const maxIdx = Math.max(0, replay.frames.length - 1);
  if (idx >= maxIdx) {
    exitReplayScrub();
  } else {
    replay.isScrubbing = true;
    replay.scrubIndex = idx;
    el.replayLabel.textContent = `#${idx}`;
    el.replayLabel.classList.add("scrubbing");
  }
});

el.btnExportLog.addEventListener("click", () => {
  replay.exportJSON();
  showToast(t().toasts.exported);
});

// Telemetry HUD update
function updateTelemetryUI(tele) {
  const phases = t().phases;
  el.valPhase.textContent = phases[tele.phase] || tele.phase;
  el.valMeta.textContent = tele.metastability.toFixed(2);
  el.valEntropy.textContent = tele.entropy.toFixed(2);
  el.valTension.textContent = tele.tensionRatio.toFixed(2);
  el.valSimplicity.textContent = tele.simplicity.toFixed(2);
  el.valCells.textContent = String(tele.cellCount);

  const phaseColor =
    tele.phase === "polarized"
      ? "#fb7185"
      : tele.phase === "crystallizing"
      ? "#34d399"
      : tele.phase === "diffuse"
      ? "#fbbf24"
      : "#7dd3fc";
  el.phaseDot.style.background = phaseColor;
  el.phaseDot.style.boxShadow = `0 0 14px ${phaseColor}`;
}

// Initialization
function init() {
  const initialConcept = "transindividuation";
  el.inputConcept.value = initialConcept;

  topology.upsertCell({
    id: localId,
    term: initialConcept,
    stance: "assert",
    intensity: currentIntensity,
    isHuman: true,
    isLocal: true,
  });

  swarm.setLanguage(currentLang, false);
  swarm.setTargetCount(16);

  // Settle initial terrain smoothly
  for (let i = 0; i < 45; i++) topology.stepPhysics(0.025);
  applyTranslations();
  el.tokenCounter.textContent = "1/3";
  replay.capture(topology, mirror, "init");
  syncReplaySlider();

  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get("room");
  if (roomParam) {
    el.inputRoomCode.value = roomParam;
    sync.joinRoom(roomParam);
  }

  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (replay.isScrubbing) {
    const frame = replay.getFrame(replay.scrubIndex);
    if (frame) {
      updateTelemetryUI(frame.telemetry);
      updateNoemeUI(frame.noeme);
      renderer.render({
        cells: frame.cells,
        edges: frame.edges,
        basins: frame.basins,
        axes: frame.axes,
        voids: frame.voids,
        ripples: [],
        telemetry: frame.telemetry,
        compass: frame.compass,
        ghostPreview: null,
        topologyBlend: topology.topologyBlend,
        showMirror: mirror.visible,
        time: now,
      });
    }
  } else {
    swarm.tick(dt, () => {
      if (semantic.mode === "neural") {
        topology.refreshEmbeddingsAsync();
      }
    });

    topology.stepPhysics(dt);

    if (now - lastMirrorUpdate > 360) {
      topology.refreshCompassLabels(currentLang);
      mirror.update(currentLang);
      updateNoemeUI();
      updateTelemetryUI(topology.telemetry);
      lastMirrorUpdate = now;
    }

    if (now - lastReplayCapture > 2200) {
      replay.capture(topology, mirror);
      syncReplaySlider();
      lastReplayCapture = now;
    }

    renderer.render({
      cells: Array.from(topology.cells.values()),
      edges: topology.edges,
      basins: mirror.basins,
      axes: mirror.axes,
      voids: mirror.voids,
      ripples: topology.ripples,
      telemetry: topology.telemetry,
      compass: topology.compass,
      ghostPreview,
      topologyBlend: topology.topologyBlend,
      showMirror: mirror.visible,
      time: now,
    });
  }

  requestAnimationFrame(loop);
}

init();
