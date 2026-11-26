// Dedicated ES-Module Web Worker for zero-key in-browser LLM inference (v7)
// - Default: onnx-community/Qwen2.5-1.5B-Instruct (q4f16 WebGPU / q4 WASM) for coherent FR/EN
// - Lightweight option: onnx-community/Qwen2.5-0.5B-Instruct
// - Live token streaming via TextStreamer + automatic retry on empty output

let generator = null;
let loadedModelId = null;
let activeDevice = null;
let TextStreamerCtor = null;

async function initModel(modelId = "onnx-community/Qwen2.5-1.5B-Instruct") {
  if (generator && loadedModelId === modelId) {
    self.postMessage({ type: "ready", device: activeDevice, modelId });
    return;
  }

  // Dispose old pipeline if switching models
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

  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  let deviceToTry = hasWebGPU ? "webgpu" : "wasm";

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
      file,
    });
  };

  try {
    // q4f16 is optimal for WebGPU Qwen2.5 models; fall back to q4 if needed
    const preferredDtype = deviceToTry === "webgpu" ? "q4f16" : "q4";
    try {
      generator = await pipeline("text-generation", modelId, {
        device: deviceToTry,
        dtype: preferredDtype,
        progress_callback: onProgress,
      });
    } catch {
      fileTotals.clear();
      fileLoaded.clear();
      generator = await pipeline("text-generation", modelId, {
        device: deviceToTry,
        dtype: "q4",
        progress_callback: onProgress,
      });
    }
    activeDevice = deviceToTry;
  } catch (gpuErr) {
    if (deviceToTry === "webgpu") {
      fileTotals.clear();
      fileLoaded.clear();
      self.postMessage({ type: "progress", status: "fallback-wasm", progress: 5, loadedMB: 0, totalMB: 0 });
      generator = await pipeline("text-generation", modelId, {
        device: "wasm",
        dtype: "q4",
        progress_callback: onProgress,
      });
      activeDevice = "wasm";
    } else {
      throw gpuErr;
    }
  }

  loadedModelId = modelId;
  self.postMessage({ type: "ready", device: activeDevice, modelId });
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

  // Primary attempt (gentle repetition_penalty avoids premature EOS on Pass 2!)
  let text = await runSingleGen(messages, {
    maxNewTokens,
    temperature,
    repetitionPenalty: 1.05,
    stream,
    requestId,
  });

  // Automatic clean retry if model emitted empty EOS on first try
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
      message: err?.message || String(err),
    });
  }
});
