// Dedicated ES-Module Web Worker for zero-key in-browser LLM inference (v7c)
// - Checks WebGPU maxBufferSize & enforces single-threaded WASM (prevents multi-arena OOM)
// - Automatically steps down from Qwen2.5-1.5B to Qwen2.5-0.5B (q4) if browser memory ceiling is hit
// - Uses clean q4 dtype across WebGPU & WASM (avoids WebGPU FP16 garbled token overflow)
// - Live token streaming via TextStreamer + automatic retry on empty output

const MODEL_15B = "onnx-community/Qwen2.5-1.5B-Instruct";
const MODEL_05B = "onnx-community/Qwen2.5-0.5B-Instruct";

let generator = null;
let loadedModelId = null;
let activeDevice = null;
let TextStreamerCtor = null;

function formatRuntimeError(err) {
  if (typeof err === "number" || /^\d{6,}$/.test(String(err?.message ?? err ?? ""))) {
    return "Mémoire navigateur (WebGPU/WASM) insuffisante pour ce modèle — utilisez 0.5B ou Gemini/Groq gratuit";
  }
  return err?.message || String(err);
}

async function detectWebGPULimits() {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return { available: false, maxBufferSize: 0 };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { available: false, maxBufferSize: 0 };
    return {
      available: true,
      maxBufferSize: adapter.limits?.maxBufferSize || 268435456,
    };
  } catch {
    return { available: false, maxBufferSize: 0 };
  }
}

async function initModel(requestedModelId = MODEL_15B) {
  if (generator && loadedModelId === requestedModelId) {
    self.postMessage({ type: "ready", device: activeDevice, modelId: loadedModelId });
    return;
  }

  if (generator && typeof generator.dispose === "function") {
    try { await generator.dispose(); } catch { /* noop */ }
  }
  generator = null;
  loadedModelId = null;

  self.postMessage({ type: "progress", status: "loading", progress: 1, loadedMB: 0, totalMB: 0 });

  const transformers = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1");
  const { pipeline, env, TextStreamer } = transformers;
  TextStreamerCtor = TextStreamer;
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  // Prevent multi-threaded WASM BFCArena memory spikes that trigger OOM pointers (e.g. 3587054648)
  if (env.backends?.onnx?.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
  }

  const gpu = await detectWebGPULimits();
  let modelId = requestedModelId;

  // Qwen2.5-1.5B q4 ONNX weighs ~1.1GB; if WebGPU maxBufferSize is too small, step down proactively to 0.5B
  if (modelId === MODEL_15B && gpu.available && gpu.maxBufferSize < 1_050_000_000) {
    modelId = MODEL_05B;
    self.postMessage({
      type: "progress",
      status: "stepdown-05b",
      progress: 3,
      loadedMB: 0,
      totalMB: 0,
    });
  }

  const loadAttempt = async (targetModel, device) => {
    const fileTotals = new Map();
    const fileLoaded = new Map();
    let lastEmit = 0;

    const onProgress = (info) => {
      if (!info) return;
      const file = info.file || "model";
      if (typeof info.total === "number" && info.total > 0) {
        fileTotals.set(file, info.total);
      }
      if (typeof info.loaded === "number" && info.loaded >= 0) {
        fileLoaded.set(file, info.loaded);
      } else if (info.status === "done" && fileTotals.has(file)) {
        fileLoaded.set(file, fileTotals.get(file));
      }

      let totalBytes = 0;
      let loadedBytes = 0;
      for (const [f, tot] of fileTotals.entries()) {
        totalBytes += tot;
        loadedBytes += Math.min(tot, fileLoaded.get(f) || 0);
      }

      const now = performance.now();
      if (now - lastEmit < 140 && info.status === "progress") return;
      lastEmit = now;

      const rawPct = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 99) : 3;
      const isCompiling = totalBytes > 50_000_000 && loadedBytes >= totalBytes * 0.995;

      self.postMessage({
        type: "progress",
        status: isCompiling ? "compiling" : "downloading",
        progress: Math.max(1, Math.min(99, rawPct)),
        loadedMB: Math.round(loadedBytes / (1024 * 1024)),
        totalMB: Math.round(totalBytes / (1024 * 1024)),
        modelId: targetModel,
        file,
      });
    };

    const pipe = await pipeline("text-generation", targetModel, {
      device,
      dtype: "q4",
      progress_callback: onProgress,
    });
    return { pipe, device, targetModel };
  };

  // Single-model attempt per clean Worker (if 1.5B OOMs, parent terminates this Worker and spawns a fresh 0.5B Worker!)
  const attempts = [];
  if (gpu.available) attempts.push([modelId, "webgpu"]);
  attempts.push([modelId, "wasm"]);

  let lastErr = null;
  for (let i = 0; i < attempts.length; i++) {
    const [mId, dev] = attempts[i];
    if (i > 0) {
      self.postMessage({
        type: "progress",
        status: mId === MODEL_05B && requestedModelId === MODEL_15B ? "stepdown-05b" : "fallback-wasm",
        progress: 4,
        loadedMB: 0,
        totalMB: 0,
        modelId: mId,
      });
    }
    try {
      const res = await loadAttempt(mId, dev);
      generator = res.pipe;
      activeDevice = res.device;
      loadedModelId = res.targetModel;
      self.postMessage({ type: "ready", device: activeDevice, modelId: loadedModelId });
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`Browser LLM attempt [${mId} / ${dev}] failed:`, err);
    }
  }

  throw new Error(formatRuntimeError(lastErr));
}

async function runSingleGen(messages, { maxNewTokens, temperature, repetitionPenalty, stream, requestId }) {
  let streamedBuffer = "";
  let streamer = undefined;

  if (stream && TextStreamerCtor && generator.tokenizer) {
    streamer = new TextStreamerCtor(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (tokenText) => {
        if (!tokenText) return;
        streamedBuffer += tokenText;
        self.postMessage({
          type: "token",
          requestId,
          delta: tokenText,
          fullText: streamedBuffer,
        });
      },
    });
  }

  const output = await generator(messages, {
    max_new_tokens: maxNewTokens,
    do_sample: temperature > 0.05,
    temperature: Math.max(0.1, temperature),
    top_p: 0.9,
    repetition_penalty: repetitionPenalty,
    streamer,
  });

  const generated = output?.[0]?.generated_text;
  let text = "";
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1];
    text = last?.content || "";
  } else if (typeof generated === "string") {
    text = generated;
  }

  return String(text || streamedBuffer || "").trim();
}

async function generateText({ requestId, messages, maxNewTokens = 110, temperature = 0.78, stream = false }) {
  if (!generator) {
    throw new Error("Browser LLM not initialized");
  }

  let text = await runSingleGen(messages, {
    maxNewTokens,
    temperature,
    repetitionPenalty: 1.05,
    stream,
    requestId,
  });

  if (!text || text.length < 6) {
    text = await runSingleGen(messages, {
      maxNewTokens,
      temperature: 0.62,
      repetitionPenalty: 1.0,
      stream,
      requestId,
    });
  }

  self.postMessage({ type: "result", requestId, text });
}

self.addEventListener("message", async (ev) => {
  const msg = ev.data || {};
  try {
    if (msg.type === "init") {
      await initModel(msg.modelId);
    } else if (msg.type === "generate") {
      await generateText(msg);
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      requestId: msg.requestId || null,
      message: formatRuntimeError(err),
    });
  }
});
