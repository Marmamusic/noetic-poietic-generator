// Dedicated ES-Module Web Worker for zero-key in-browser LLM inference
// Runs onnx-community/Qwen2.5-0.5B-Instruct (4-bit quantized, multilingual FR/EN)
// via @huggingface/transformers v3 using WebGPU when available, falling back cleanly to WASM.

let generator = null;
let activeDevice = null;

async function initModel(modelId = "onnx-community/Qwen2.5-0.5B-Instruct") {
  if (generator) {
    self.postMessage({ type: "ready", device: activeDevice, modelId });
    return;
  }

  self.postMessage({ type: "progress", status: "loading", progress: 1, loadedMB: 0, totalMB: 0 });

  const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1");
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  let deviceToTry = hasWebGPU ? "webgpu" : "wasm";

  // Track cumulative bytes across all downloaded files (config, tokenizer, and the large .onnx weights)
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
    if (now - lastEmit < 120 && info.status === "progress") return;
    lastEmit = now;

    // Only report 99% max during download so 100% means compiled & ready
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
    generator = await pipeline("text-generation", modelId, {
      device: deviceToTry,
      dtype: "q4",
      progress_callback: onProgress,
    });
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

  self.postMessage({ type: "ready", device: activeDevice, modelId });
}

async function generateText({ requestId, messages, maxNewTokens = 160, temperature = 0.85 }) {
  if (!generator) {
    throw new Error("Browser LLM not initialized");
  }

  const output = await generator(messages, {
    max_new_tokens: maxNewTokens,
    do_sample: true,
    temperature,
    top_p: 0.92,
    repetition_penalty: 1.12,
  });

  const generated = output?.[0]?.generated_text;
  let text = "";
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1];
    text = last?.content || "";
  } else if (typeof generated === "string") {
    text = generated;
  }

  self.postMessage({ type: "result", requestId, text: String(text || "").trim() });
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
