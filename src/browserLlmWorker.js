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

  self.postMessage({ type: "progress", status: "loading", progress: 2, file: "transformers.js" });

  const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1");
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  let deviceToTry = hasWebGPU ? "webgpu" : "wasm";

  const onProgress = (info) => {
    if (!info) return;
    if (info.status === "progress" && typeof info.progress === "number") {
      self.postMessage({
        type: "progress",
        status: "downloading",
        progress: Math.round(info.progress),
        file: info.file || "",
      });
    } else if (info.status === "initiate" || info.status === "done") {
      self.postMessage({
        type: "progress",
        status: info.status,
        progress: info.status === "done" ? 100 : 5,
        file: info.file || "",
      });
    }
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
      // Seamless fallback to universal WASM if WebGPU adapter/shader fails
      self.postMessage({ type: "progress", status: "fallback-wasm", progress: 15, file: "wasm" });
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
