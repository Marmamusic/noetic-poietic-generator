// Main Orchestrator for the Noetic Poietic Generator (v7 — Noetic Entropy, 2-Pass Streaming LLM & Clean Solo Start)

import { TRANSLATIONS } from "./i18n.js?v=7";
import { SemanticEngine } from "./semanticEngine.js?v=7";
import { TopologyEngine } from "./topologyEngine.js?v=7";
import { MirrorEngine } from "./mirrorEngine.js?v=7";
import { PalimpsestEngine, LLM_PRESETS } from "./palimpsestEngine.js?v=7c";
import { SwarmEngine } from "./swarmEngine.js?v=7";
import { SyncEngine } from "./syncEngine.js?v=7";
import { ReplayEngine } from "./replayEngine.js?v=7";
import { NoeticRenderer } from "./renderer.js?v=7";

const sessionId = `human-${Math.random().toString(36).slice(2, 7)}`;
let voiceSeq = 0;
let localVoiceIds = []; // Multiple voices contributed from this browser (as if multiple people!)
let editingVoiceId = null; // When null, submitting adds a new voice; when set, mutates that voice

// Core engines
const semantic = new SemanticEngine();
const topology = new TopologyEngine(semantic);
const mirror = new MirrorEngine(topology);
const palimpsest = new PalimpsestEngine(topology, mirror, semantic);
const swarm = new SwarmEngine(topology, semantic);
const replay = new ReplayEngine(450);

const canvas = document.getElementById("noetic-canvas");
const renderer = new NoeticRenderer(canvas);

// App state
let currentLang = "fr";
let currentStance = "assert";
let currentIntensity = 1.0;
let viewMode = "palimpsest"; // "palimpsest" | "terrain" | "mosaic"
let selectedArtifact = null; // { kind, id }
let ghostPreview = null;
let hoveredAnchors = new Set();
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
  palStage: document.getElementById("palimpsest-stage"),
  palLinksStrip: document.getElementById("pal-links-strip"),
  palOnboarding: document.getElementById("pal-onboarding"),
  palCloudPreview: document.getElementById("pal-cloud-preview"),
  btnAwakenBrowserLlm: document.getElementById("btn-awaken-browser-llm"),
  btnAwakenBrowser05: document.getElementById("btn-awaken-browser-05"),
  btnOpenExternalLlm: document.getElementById("btn-open-external-llm"),
  palProgressWrap: document.getElementById("pal-progress-wrap"),
  palProgressFill: document.getElementById("pal-progress-fill"),
  palProgressText: document.getElementById("pal-progress-text"),
  palStream: document.getElementById("pal-stream"),
  palStreaming: document.getElementById("pal-streaming"),
  palGestation: document.getElementById("pal-gestation"),
  palLlmLed: document.getElementById("pal-llm-led"),
  palEngineStatus: document.getElementById("pal-engine-status"),
  btnPalConnect: document.getElementById("btn-pal-connect"),
  noemeMirror: document.getElementById("noeme-mirror"),
  noemeText: document.getElementById("noeme-text"),
  noemeDiff: document.getElementById("noeme-diff"),
  voicesBar: document.getElementById("voices-bar"),
  hudModeBadge: document.getElementById("hud-mode-badge"),
  btnEmit: document.getElementById("btn-emit"),
  inputConcept: document.getElementById("input-concept"),
  tokenCounter: document.getElementById("token-counter"),
  leverageReadout: document.getElementById("leverage-readout"),
  cellForm: document.getElementById("cell-form"),
  stanceBtns: Array.from(document.querySelectorAll(".stance-btn")),
  intensityBtns: Array.from(document.querySelectorAll(".int-btn")),
  btnModePalimpsest: document.getElementById("btn-mode-palimpsest"),
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
  sliderCapacity: document.getElementById("slider-capacity"),
  labelCapacityVal: document.getElementById("label-capacity-val"),
  btnSwarmPause: document.getElementById("btn-swarm-pause"),
  btnSwarmPulse: document.getElementById("btn-swarm-pulse"),
  btnRoomPanel: document.getElementById("btn-room-panel"),
  roomBadge: document.getElementById("room-badge"),
  checkTabSync: document.getElementById("check-tab-sync"),
  inputRoomCode: document.getElementById("input-room-code"),
  btnRoomJoin: document.getElementById("btn-room-join"),
  btnRoomCreate: document.getElementById("btn-room-create"),
  btnRoomCopy: document.getElementById("btn-room-copy"),
  btnRoomLeave: document.getElementById("btn-room-leave"),
  roomStatus: document.getElementById("room-status"),
  btnLlmPanel: document.getElementById("btn-llm-panel"),
  llmLed: document.getElementById("llm-led"),
  presetBtns: Array.from(document.querySelectorAll(".preset-btn")),
  fieldLlmEndpoint: document.getElementById("field-llm-endpoint"),
  fieldLlmKey: document.getElementById("field-llm-key"),
  inputLlmEndpoint: document.getElementById("input-llm-endpoint"),
  inputLlmModel: document.getElementById("input-llm-model"),
  inputLlmKey: document.getElementById("input-llm-key"),
  sliderDelay: document.getElementById("slider-delay"),
  labelDelayVal: document.getElementById("label-delay-val"),
  checkRememberKey: document.getElementById("check-remember-key"),
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

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =========================================================================
// FLIP-ANIMATED MORPHOGENETIC PALIMPSEST RENDERER
// Preserves DOM nodes by stable sentence ID so rearrangements glide smoothly,
// emerging sentences focus in, morphing sentences cross-dissolve old wording,
// and faded sentences linger softly before vanishing.
// =========================================================================
const sentenceDomMap = new Map();

function renderCloudPreview() {
  if (!el.palCloudPreview) return;
  const cells = Array.from(topology.cells.values());
  if (cells.length === 0) {
    el.palCloudPreview.innerHTML = `<span class="cloud-empty">${escapeHtml(t().palEmptyCloud)}</span>`;
    return;
  }
  const seen = new Set();
  const chips = [];
  const ordered = [...cells].sort((a, b) => (a.isHuman === b.isHuman ? 0 : a.isHuman ? -1 : 1));
  for (const c of ordered) {
    const low = c.term.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    const cls = [
      "cloud-word",
      c.isHuman ? "human" : "",
      c.stance === "negate" ? "negate" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const sym = c.stance === "negate" ? "⊘ " : c.stance === "question" ? "? " : c.stance === "bridge" ? "⇄ " : "";
    chips.push(`<span class="${cls}">${sym}${escapeHtml(c.term)}</span>`);
    if (chips.length >= 18) break;
  }
  el.palCloudPreview.innerHTML = chips.join("");
}

function renderVoicesBar() {
  if (!el.voicesBar) return;
  // Prune any removed IDs
  localVoiceIds = localVoiceIds.filter((id) => topology.cells.has(id));
  if (editingVoiceId && !topology.cells.has(editingVoiceId)) {
    editingVoiceId = null;
  }

  // Update HUD mode label & submit button text
  const dict = t();
  if (editingVoiceId) {
    const c = topology.cells.get(editingVoiceId);
    el.hudModeBadge.textContent = `${dict.editingVoice} · ${c ? c.term : ""}`;
    el.btnEmit.textContent = dict.updateBtn;
  } else {
    el.hudModeBadge.textContent = dict.yourCell;
    el.btnEmit.textContent = dict.emitBtn;
  }

  if (localVoiceIds.length === 0) {
    el.voicesBar.classList.add("hidden");
    el.voicesBar.innerHTML = "";
    return;
  }

  el.voicesBar.classList.remove("hidden");
  el.voicesBar.innerHTML = "";

  const stanceSym = { assert: "●", question: "?", negate: "⊘", bridge: "⇄" };

  for (const id of localVoiceIds) {
    const cell = topology.cells.get(id);
    if (!cell) continue;
    const chip = document.createElement("span");
    const cls = ["voice-chip"];
    if (editingVoiceId === id) cls.push("editing");
    if (cell.dissolvingSince) cls.push("dissolving");
    chip.className = cls.join(" ");
    chip.title = "Click to edit this voice";

    const labelSpan = document.createElement("span");
    labelSpan.textContent = `${stanceSym[cell.stance] || "●"} ${cell.term}`;
    chip.appendChild(labelSpan);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "voice-chip-del";
    delBtn.textContent = "×";
    delBtn.title = "Remove voice";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeLocalVoice(id);
    });
    chip.appendChild(delBtn);

    chip.addEventListener("click", () => {
      if (editingVoiceId === id) {
        // Cancel edit -> back to adding new voices
        editingVoiceId = null;
        el.inputConcept.value = "";
        updateTokenCounterAndGhost();
        renderVoicesBar();
      } else {
        editingVoiceId = id;
        el.inputConcept.value = cell.term;
        currentStance = cell.stance || "assert";
        currentIntensity = cell.intensity || 1.0;
        el.stanceBtns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-stance") === currentStance));
        el.intensityBtns.forEach((b) => b.classList.toggle("active", Number(b.getAttribute("data-intensity")) === currentIntensity));
        updateTokenCounterAndGhost();
        renderVoicesBar();
        el.inputConcept.focus();
      }
    });

    el.voicesBar.appendChild(chip);
  }

  const activeCount = Array.from(topology.cells.values()).filter((c) => !c.dissolvingSince).length;
  const capBadge = document.createElement("span");
  capBadge.className = "voice-capacity";
  capBadge.textContent = `${activeCount}/${topology.maxActiveWords}`;
  el.voicesBar.appendChild(capBadge);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "voice-clear-btn";
  clearBtn.textContent = dict.clearVoices;
  clearBtn.addEventListener("click", clearAllLocalVoices);
  el.voicesBar.appendChild(clearBtn);
}

topology.onCellDissolved = (id) => {
  localVoiceIds = localVoiceIds.filter((vid) => vid !== id);
  if (editingVoiceId === id) {
    editingVoiceId = null;
    el.inputConcept.value = "";
  }
  renderVoicesBar();
  renderCloudPreview();
  updateTelemetryUI(topology.telemetry);
};

function removeLocalVoice(id) {
  localVoiceIds = localVoiceIds.filter((vid) => vid !== id);
  if (editingVoiceId === id) {
    editingVoiceId = null;
    el.inputConcept.value = "";
  }
  topology.removeCell(id);
  sync.broadcast({ type: "leave", id });
  mirror.update(currentLang);
  updateNoemeUI();
  updateTelemetryUI(topology.telemetry);
  renderVoicesBar();
  renderCloudPreview();
  if (palimpsest.llmEnabled) {
    if (topology.cells.size > 0) {
      palimpsest.scheduleGestation(currentLang, { source: "remove" });
    } else {
      palimpsest.sentences = [];
      palimpsest.activeLlmLinks = [];
      renderPalimpsestDOM([], { isGestating: false });
    }
  }
}

function clearAllLocalVoices() {
  for (const id of localVoiceIds) {
    topology.removeCell(id);
    sync.broadcast({ type: "leave", id });
  }
  localVoiceIds = [];
  editingVoiceId = null;
  topology.llmLinks.clear();
  palimpsest.sentences = [];
  palimpsest.activeLlmLinks = [];
  el.inputConcept.value = "";
  el.tokenCounter.textContent = "0/3";
  mirror.update(currentLang);
  updateNoemeUI();
  updateTelemetryUI(topology.telemetry);
  renderVoicesBar();
  renderPalimpsestDOM([], { isGestating: false });
  renderCloudPreview();
}

function renderLlmLinksStrip(links = []) {
  if (!el.palLinksStrip) return;
  if (!links || links.length === 0) {
    el.palLinksStrip.classList.add("hidden");
    el.palLinksStrip.innerHTML = "";
    return;
  }
  el.palLinksStrip.classList.remove("hidden");
  el.palLinksStrip.innerHTML = "";
  for (const lk of links.slice(0, 5)) {
    const pill = document.createElement("span");
    pill.className = `llm-link-pill${lk.type === "tension" ? " tension" : ""}`;
    const sym = lk.type === "tension" ? "↔" : "~";
    const reasonHtml = lk.reason ? ` <span class="llm-link-reason">· ${escapeHtml(lk.reason)}</span>` : "";
    pill.innerHTML = `◈ ${escapeHtml(lk.termA)} ${sym} ${escapeHtml(lk.termB)}${reasonHtml}`;
    pill.addEventListener("mouseenter", () => {
      hoveredAnchors = new Set([lk.termA.toLowerCase(), lk.termB.toLowerCase()]);
    });
    pill.addEventListener("mouseleave", () => {
      hoveredAnchors.clear();
    });
    el.palLinksStrip.appendChild(pill);
  }
}

function renderPalimpsestDOM(sentences, meta = {}) {
  const {
    isGestating = false,
    llmEnabled = palimpsest.llmEnabled,
    llmLinks = palimpsest.activeLlmLinks,
    browserLlmState = palimpsest.browserLlmState,
    browserLlmProgress = palimpsest.browserLlmProgress,
  } = meta;
  el.palGestation.classList.toggle("hidden", !isGestating);

  const hasSentences = sentences && sentences.length > 0;
  const hasStream = Boolean(palimpsest.streamingDraft && palimpsest.streamingDraft.trim());
  const hideOnboarding = hasSentences || hasStream || (llmEnabled && isGestating);
  el.palOnboarding.classList.toggle("hidden", hideOnboarding);
  el.palStream.classList.toggle("hidden", !hasSentences);
  renderLlmLinksStrip(hasSentences || (llmLinks && llmLinks.length > 0) ? llmLinks : []);

  if (!hasSentences) {
    renderCloudPreview();
    const isLoading = browserLlmState === "loading";
    el.palProgressWrap.classList.toggle("hidden", !isLoading);
    el.btnAwakenBrowserLlm.disabled = isLoading;
    if (el.btnAwakenBrowser05) el.btnAwakenBrowser05.disabled = isLoading;
    if (isLoading) {
      el.palProgressFill.style.width = `${browserLlmProgress}%`;
      el.palProgressText.textContent = `${browserLlmProgress}%`;
    }
    return;
  }

  // 1. FIRST: measure current bounding rects of existing sentence nodes
  const firstRects = new Map();
  for (const [id, node] of sentenceDomMap.entries()) {
    firstRects.set(id, node.getBoundingClientRect());
  }

  const keepIds = new Set(sentences.map((s) => s.id));

  // Remove expired sentences no longer in array
  for (const [id, node] of sentenceDomMap.entries()) {
    if (!keepIds.has(id)) {
      node.remove();
      sentenceDomMap.delete(id);
    }
  }

  // 2. Reconcile & append in new order
  for (const s of sentences) {
    let node = sentenceDomMap.get(s.id);
    if (!node) {
      node = document.createElement("article");
      node.className = "pal-sentence";
      node.dataset.id = s.id;

      // Hovering a sentence illuminates its anchoring concepts on the terrain underneath!
      node.addEventListener("mouseenter", () => {
        hoveredAnchors = new Set((node._anchors || []).map((a) => a.toLowerCase()));
      });
      node.addEventListener("mouseleave", () => {
        hoveredAnchors.clear();
      });

      sentenceDomMap.set(s.id, node);
    }

    node._anchors = s.anchors || [];
    node.dataset.role = s.role || "body";

    const nextClasses = ["pal-sentence"];
    if (s.status === "emerging") nextClasses.push("emerging");
    else if (s.status === "morphing") nextClasses.push("morphing");
    else if (s.status === "lingering") nextClasses.push("lingering");
    node.className = nextClasses.join(" ");

    // Only rewrite innerHTML when text / ghost / anchors actually changed so animations aren't reset!
    const sig = `${s.text}|${s.prevText || ""}|${(s.anchors || []).join(",")}|${s.status}`;
    if (node.dataset.sig !== sig) {
      node.dataset.sig = sig;
      const ghostHtml =
        s.status === "morphing" && s.prevText
          ? `<span class="pal-ghost">${escapeHtml(s.prevText)}</span>`
          : "";
      const anchorsHtml =
        s.anchors && s.anchors.length > 0
          ? `<div class="pal-anchors">↳ ${escapeHtml(s.anchors.join(" · "))}</div>`
          : "";
      node.innerHTML = `${ghostHtml}<p class="pal-text">${escapeHtml(s.text)}</p>${anchorsHtml}`;
    }

    el.palStream.appendChild(node);
  }

  // 3. LAST + INVERT + PLAY: smooth vertical glide for rearranged sentences
  for (const [id, node] of sentenceDomMap.entries()) {
    const prev = firstRects.get(id);
    if (!prev) continue;
    const next = node.getBoundingClientRect();
    const dy = prev.top - next.top;
    if (Math.abs(dy) > 2) {
      node.style.transition = "none";
      node.style.transform = `translateY(${dy}px)`;
      // Force reflow then glide smoothly to new order
      void node.offsetHeight;
      node.style.transition = "";
      node.style.transform = "";
    }
  }
}

palimpsest.onChange = (sentences, meta) => {
  if (!replay.isScrubbing) {
    renderPalimpsestDOM(sentences, meta);
  }
};

palimpsest.onStream = (partialText) => {
  if (!el.palStreaming) return;
  const clean = String(partialText || "").trim();
  if (!clean) {
    el.palStreaming.classList.add("hidden");
    el.palStreaming.textContent = "";
  } else {
    el.palOnboarding.classList.add("hidden");
    el.palStreaming.classList.remove("hidden");
    el.palStreaming.textContent = clean;
  }
};

palimpsest.onStatus = (msg, state = "idle") => {
  el.llmStatus.textContent = msg;
  el.palEngineStatus.textContent = msg;
  const isReady = state === "ready";
  const isLoading = state === "loading";
  el.llmLed.classList.toggle("ready", isReady);
  el.llmLed.classList.toggle("loading", isLoading);
  el.palLlmLed.classList.toggle("ready", isReady);
  el.palLlmLed.classList.toggle("loading", isLoading);
};

// =========================================================================
// VIEW MODE SWITCHING (Palimpseste | Terrain | Mosaïque)
// =========================================================================
function setViewMode(mode) {
  viewMode = mode;
  document.body.classList.toggle("mode-palimpsest", mode === "palimpsest");
  el.palStage.classList.toggle("stage-hidden", mode !== "palimpsest");
  el.noemeMirror.classList.toggle("hidden", mode === "palimpsest");

  el.btnModePalimpsest.classList.toggle("active", mode === "palimpsest");
  el.btnTopoManifold.classList.toggle("active", mode === "terrain");
  el.btnTopoSpiral.classList.toggle("active", mode === "mosaic");

  topology.topologyMode = mode === "mosaic" ? "spiral" : "manifold";
  if (mode !== "palimpsest") hoveredAnchors.clear();
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
  el.btnLlmToggle.textContent = palimpsest.llmEnabled ? dict.llmDisable : dict.llmEnable;
  if (!palimpsest.llmEnabled && palimpsest.browserLlmState !== "loading") {
    el.palEngineStatus.textContent = dict.palIdleHint;
  }
  topology.refreshCompassLabels(currentLang);
  mirror.update(currentLang);
  updateNeuralButtonUI();
  updateNoemeUI();
  updateTelemetryUI(topology.telemetry);
  renderVoicesBar();
  renderCloudPreview();
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
const sync = new SyncEngine(sessionId, {
  getLocalCells: () => localVoiceIds.map((id) => topology.cells.get(id)).filter(Boolean),
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
    palimpsest.scheduleGestation(currentLang, { source: "human", term: cell.term, stance: cell.stance });
    replay.capture(topology, mirror, palimpsest, `remote:${cell.term}`);
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

  const draft = sanitizeConcept(raw);
  ghostPreview = draft ? topology.computeGhostPreview(editingVoiceId, draft, currentStance) : null;
}

async function commitLocalGesture(rawTerm, stance = currentStance, intensity = currentIntensity) {
  const term = sanitizeConcept(rawTerm);
  if (!term) return;
  ghostPreview = null;

  if (replay.isScrubbing) exitReplayScrub();

  const isEditing = Boolean(editingVoiceId && topology.cells.has(editingVoiceId));
  const targetId = isEditing ? editingVoiceId : `${sessionId}-v${++voiceSeq}`;
  if (!isEditing) {
    localVoiceIds.push(targetId);
  }

  const prevNoeme = mirror.noeme;
  const leverage = topology.upsertCell({
    id: targetId,
    term,
    stance,
    intensity,
    isHuman: true,
    isLocal: true,
  });

  // Clear input & exit edit mode so you can immediately type the next person's word!
  editingVoiceId = null;
  el.inputConcept.value = "";
  el.tokenCounter.textContent = "0/3";
  el.tokenCounter.classList.remove("over");

  swarm.notifyHumanGesture(term);

  el.leverageReadout.textContent = `ΔM ${leverage.toFixed(2)}`;
  sync.publishLocalCell({ id: targetId, term, stance, intensity });

  if (semantic.mode === "neural") {
    const emb = await semantic.embed(term);
    const cell = topology.cells.get(targetId);
    if (cell) {
      cell.embedding = emb;
      topology.recomputeGraph(targetId, currentLang);
    }
  }

  topology.refreshCompassLabels(currentLang);
  mirror.update(currentLang);
  mirror.recordHumanInflection(prevNoeme, term, leverage);
  updateNoemeUI();
  updateTelemetryUI(topology.telemetry);
  renderVoicesBar();
  renderCloudPreview();

  // Trigger contemplative delayed morphogenetic reorganization of the living emerging text!
  palimpsest.scheduleGestation(currentLang, { source: "human", term, stance, leverage });

  replay.capture(topology, mirror, palimpsest, `voice:${term} (${stance})`);
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
    if (editingVoiceId && topology.cells.has(editingVoiceId)) {
      const c = topology.cells.get(editingVoiceId);
      commitLocalGesture(el.inputConcept.value || c.term, currentStance, currentIntensity);
    } else {
      updateTokenCounterAndGhost();
    }
  });
});

el.intensityBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentIntensity = Number(btn.getAttribute("data-intensity")) || 1.0;
    el.intensityBtns.forEach((b) => b.classList.toggle("active", b === btn));
    if (editingVoiceId && topology.cells.has(editingVoiceId)) {
      const c = topology.cells.get(editingVoiceId);
      commitLocalGesture(el.inputConcept.value || c.term, currentStance, currentIntensity);
    }
  });
});

el.btnModePalimpsest.addEventListener("click", () => setViewMode("palimpsest"));
el.btnTopoManifold.addEventListener("click", () => setViewMode("terrain"));
el.btnTopoSpiral.addEventListener("click", () => setViewMode("mosaic"));

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

el.sliderCapacity.addEventListener("input", () => {
  const val = Number(el.sliderCapacity.value);
  el.labelCapacityVal.textContent = String(val);
  topology.maxActiveWords = val;
  topology.enforceNoeticEntropy();
  renderVoicesBar();
});

el.checkTabSync.addEventListener("change", () => {
  sync.setTabSync(el.checkTabSync.checked);
});

el.btnSwarmPause.addEventListener("click", () => {
  swarm.paused = !swarm.paused;
  el.btnSwarmPause.textContent = swarm.paused ? t().resume : t().pause;
});

el.btnSwarmPulse.addEventListener("click", () => {
  swarm.perturb(() => {});
  mirror.update(currentLang);
  updateNoemeUI();
  palimpsest.scheduleGestation(currentLang, { source: "bifurcation" });
  replay.capture(topology, mirror, palimpsest, "bifurcation");
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

// =========================================================================
// MULTI-PROVIDER + ZERO-KEY BROWSER LLM PALIMPSEST CONTROLS
// =========================================================================
el.btnLlmPanel.addEventListener("click", () => togglePopover("popover-llm"));
el.btnPalConnect.addEventListener("click", () => togglePopover("popover-llm"));
el.btnOpenExternalLlm.addEventListener("click", () => {
  selectPresetUI("gemini");
  togglePopover("popover-llm");
});

async function awakenBrowserLLM(presetId = "browser15") {
  selectPresetUI(presetId);
  const ok = await palimpsest.initBrowserLLM(currentLang, presetId);
  if (ok) {
    el.btnLlmPanel.classList.add("active");
    el.btnLlmToggle.textContent = t().llmDisable;
    showToast(t().toasts.llmEnabled);
    palimpsest.scheduleGestation(currentLang, { source: "awaken" }, true);
  }
}

el.btnAwakenBrowserLlm.addEventListener("click", () => awakenBrowserLLM("browser15"));
el.btnAwakenBrowser05.addEventListener("click", () => awakenBrowserLLM("browser05"));

function selectPresetUI(presetId) {
  const p = palimpsest.applyPreset(presetId);
  el.presetBtns.forEach((b) => b.classList.toggle("active", b.dataset.preset === p.id));
  el.inputLlmEndpoint.value = p.endpoint;
  el.inputLlmModel.value = p.model;
  el.inputLlmKey.placeholder = p.keyPlaceholder;

  const isBrowser = p.protocol === "browser";
  el.fieldLlmEndpoint.classList.toggle("hidden", isBrowser);
  el.fieldLlmKey.classList.toggle("hidden", isBrowser);
}

el.presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => selectPresetUI(btn.dataset.preset));
});

el.sliderDelay.addEventListener("input", () => {
  const sec = Number(el.sliderDelay.value);
  el.labelDelayVal.textContent = `${sec.toFixed(1)}s`;
  palimpsest.gestationDelayMs = Math.round(sec * 1000);
});

function syncLlmFormToEngine() {
  const preset = LLM_PRESETS[palimpsest.providerId] || LLM_PRESETS.browser15;
  palimpsest.config.protocol = preset.protocol;
  palimpsest.config.endpoint = el.inputLlmEndpoint.value.trim();
  palimpsest.config.model = el.inputLlmModel.value.trim();
  palimpsest.config.apiKey = el.inputLlmKey.value.trim();

  const payload = JSON.stringify({
    providerId: palimpsest.providerId,
    endpoint: palimpsest.config.endpoint,
    model: palimpsest.config.model,
    apiKey: palimpsest.config.apiKey,
    delaySec: Number(el.sliderDelay.value),
  });
  sessionStorage.setItem("npg_llm_cfg", payload);
  if (el.checkRememberKey.checked) {
    localStorage.setItem("npg_llm_cfg", payload);
  } else {
    localStorage.removeItem("npg_llm_cfg");
  }
}

function restoreSavedLlmConfig() {
  selectPresetUI("browser15");
  const raw = localStorage.getItem("npg_llm_cfg") || sessionStorage.getItem("npg_llm_cfg");
  if (!raw) return;
  try {
    const cfg = JSON.parse(raw);
    const mappedId = cfg.providerId === "browser" ? "browser15" : cfg.providerId;
    if (mappedId && LLM_PRESETS[mappedId]) {
      selectPresetUI(mappedId);
    }
    if (cfg.endpoint) el.inputLlmEndpoint.value = cfg.endpoint;
    if (cfg.model && cfg.providerId !== "browser") el.inputLlmModel.value = cfg.model;
    if (cfg.apiKey) el.inputLlmKey.value = cfg.apiKey;
    if (typeof cfg.delaySec === "number") {
      el.sliderDelay.value = String(cfg.delaySec);
      el.labelDelayVal.textContent = `${cfg.delaySec.toFixed(1)}s`;
      palimpsest.gestationDelayMs = Math.round(cfg.delaySec * 1000);
    }
    el.checkRememberKey.checked = Boolean(localStorage.getItem("npg_llm_cfg"));
  } catch {
    /* ignore corrupt storage */
  }
}

el.btnLlmToggle.addEventListener("click", async () => {
  syncLlmFormToEngine();
  if (!palimpsest.llmEnabled && palimpsest.config.protocol === "browser") {
    await awakenBrowserLLM(palimpsest.providerId);
    return;
  }

  palimpsest.llmEnabled = !palimpsest.llmEnabled;
  el.btnLlmPanel.classList.toggle("active", palimpsest.llmEnabled);
  el.btnLlmToggle.textContent = palimpsest.llmEnabled ? t().llmDisable : t().llmEnable;
  el.llmLed.classList.toggle("ready", palimpsest.llmEnabled);
  el.palLlmLed.classList.toggle("ready", palimpsest.llmEnabled);
  showToast(palimpsest.llmEnabled ? t().toasts.llmEnabled : t().toasts.llmDisabled);

  if (palimpsest.llmEnabled) {
    palimpsest.scheduleGestation(currentLang, { source: "llm-connect" }, true);
  } else {
    el.palEngineStatus.textContent = t().palIdleHint;
    el.llmStatus.textContent = t().palIdleHint;
  }
});

el.btnLlmTrigger.addEventListener("click", async () => {
  syncLlmFormToEngine();
  if (palimpsest.config.protocol === "browser" && palimpsest.browserLlmState !== "ready") {
    await awakenBrowserLLM(palimpsest.providerId);
    return;
  }
  palimpsest.llmEnabled = true;
  el.btnLlmPanel.classList.add("active");
  el.btnLlmToggle.textContent = t().llmDisable;
  palimpsest.scheduleGestation(currentLang, { source: "manual-pulse" }, true);
});

// Language toggle
el.btnLang.addEventListener("click", () => {
  currentLang = currentLang === "fr" ? "en" : "fr";
  swarm.setLanguage(currentLang, true);
  applyTranslations();
  renderCloudPreview();
  if (palimpsest.llmEnabled) {
    palimpsest.scheduleGestation(currentLang, { source: "language-switch" }, true);
  }
});

// Help modal
el.btnHelp.addEventListener("click", () => el.modalHelp.classList.remove("hidden"));
el.modalHelp.addEventListener("click", (e) => {
  if (e.target === el.modalHelp) el.modalHelp.classList.add("hidden");
});

// Anoptical Transparency Inspector
function closeInspector() {
  selectedArtifact = null;
  renderer.selectedId = null;
  el.inspectorPanel.classList.add("hidden");
  document.body.classList.remove("inspector-open");
}

el.btnCloseInspector.addEventListener("click", closeInspector);

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
      const tag = e.isLlmLink ? `◈ ${other.term}${e.llmReason ? ` (${e.llmReason})` : ""}` : other.term;
      if (e.type === "tension") tenLinks.push({ term: tag, weight: e.tension });
      else resLinks.push({ term: tag, weight: e.resonance });
    }
    resLinks.sort((a, b) => b.weight - a.weight);
    tenLinks.sort((a, b) => b.weight - a.weight);

    const renderList = (items, isTension) =>
      items.length === 0
        ? `<div style="color:var(--text-muted);margin-top:4px;">${ins.noLinks}</div>`
        : `<div class="prov-list" style="margin-top:4px;">${items
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

    const stanceDisplay = (ins.stanceNames && ins.stanceNames[cell.stance]) || cell.stance;
    el.inspectorBody.innerHTML = `
      <div class="prov-row"><span>${escapeHtml(ins.roleLabel || "Role")}</span><span class="mono">${escapeHtml(roleLabel)}</span></div>
      <div class="prov-row"><span>${ins.stance}</span><span class="mono">${escapeHtml(stanceDisplay)}</span></div>
      <div class="prov-row"><span>${ins.spiralIdx}</span><span class="mono">#${cell.spiralIndex} (${cell.gx}, ${cell.gy})</span></div>
      <div class="prov-row"><span>${ins.leverage}</span><span class="mono">ΔM ${(cell.lastLeverage || 0).toFixed(2)}</span></div>
      <div><strong>${ins.resonanceLinks}</strong>${renderList(resLinks, false)}</div>
      <div><strong>${ins.tensionLinks}</strong>${renderList(tenLinks, true)}</div>
    `;
    el.inspectorPanel.classList.remove("hidden");
    document.body.classList.add("inspector-open");
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
      closeInspector();
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
  renderPalimpsestDOM(palimpsest.sentences, { isGestating: palimpsest.isGestating });
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

// Initialization: Start completely blank (0 words, 0 swarm agents) so you enter every voice yourself!
function init() {
  restoreSavedLlmConfig();

  el.inputConcept.value = "";
  el.tokenCounter.textContent = "0/3";

  swarm.setLanguage(currentLang, false);
  swarm.setTargetCount(0);

  applyTranslations();
  setViewMode("palimpsest");
  renderVoicesBar();
  renderPalimpsestDOM(palimpsest.sentences, { isGestating: false });
  replay.capture(topology, mirror, palimpsest, "init-blank");
  syncReplaySlider();

  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get("room");
  if (roomParam) {
    el.inputRoomCode.value = roomParam;
    sync.joinRoom(roomParam);
  }

  el.inputConcept.focus();
  requestAnimationFrame(loop);
}

let lastScrubRendered = -1;

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (replay.isScrubbing) {
    const frame = replay.getFrame(replay.scrubIndex);
    if (frame) {
      updateTelemetryUI(frame.telemetry);
      updateNoemeUI(frame.noeme);
      if (lastScrubRendered !== replay.scrubIndex && Array.isArray(frame.palimpsest)) {
        renderPalimpsestDOM(frame.palimpsest, { isGestating: false });
        lastScrubRendered = replay.scrubIndex;
      }
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
        highlightedTerms: hoveredAnchors,
        topologyBlend: topology.topologyBlend,
        showMirror: mirror.visible,
        time: now,
      });
    }
  } else {
    lastScrubRendered = -1;
    swarm.tick(dt, () => {
      if (semantic.mode === "neural") {
        topology.refreshEmbeddingsAsync();
      }
    });

    topology.stepPhysics(dt);
    palimpsest.tick(now, currentLang);

    if (now - lastMirrorUpdate > 360) {
      topology.refreshCompassLabels(currentLang);
      mirror.update(currentLang);
      updateNoemeUI();
      updateTelemetryUI(topology.telemetry);
      if (palimpsest.sentences.length === 0) renderCloudPreview();
      lastMirrorUpdate = now;
    }

    if (now - lastReplayCapture > 2500) {
      replay.capture(topology, mirror, palimpsest);
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
      highlightedTerms: hoveredAnchors,
      topologyBlend: topology.topologyBlend,
      showMirror: mirror.visible,
      time: now,
    });
  }

  requestAnimationFrame(loop);
}

init();
