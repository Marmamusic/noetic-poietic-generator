# Générateur Poïétique Noétique / Noetic Poietic Generator

> *« À la place de pixels, chaque individu contrôlerait des mots, des concepts. L’IA serait le "miroir" placé au-dessus des humains… »*

A browser-native, zero-server prototype applying **Olivier Auber’s *Poietic Generator*** (*Générateur Poïétique*, 1986) and **Gilbert Simondon’s *transindividuation*** to live collective **noesis**.

Instead of a servile, 1-to-1 prompt/response AI that flatters or summarizes away difference, this instrument places a transparent **anoptical mirror** *above* a shared conceptual field—making emergent basins, unresolved dialectical tensions, and unthought bridges perceptible in real time as each participant mutates their own bounded **noetic cell**.

---

## Key Principles & Features

- **Strict Locality & Psychic Ergonomics:** Each participant controls *only* their own bounded cell (1–3 words + an epistemic stance: `● Assert`, `? Question`, `⊘ Negate`, `⇄ Bridge`). No autocomplete, no upvotes, no chat feed, and no overwriting another participant’s cell.
- **Dual Topology Morphing (`Manifold ↔ Auber Spiral`):** Smoothly morph between a damped force-directed semantic manifold and Olivier Auber’s expanding square **spiral lattice** with live semantic resonance and tension membranes.
- **Three-Layer Meta-Noetic Engine:**
  1. **Layer 1 — Instant Geometric + Browser Neural Embeddings:** Runs instantaneously (<5 ms) using a bilingual FR/EN 24-axis conceptual basis + morphological n-grams, with a one-click upgrade to browser-native multilingual neural embeddings (`Xenova/paraphrase-multilingual-MiniLM-L12-v2` via WebAssembly/Transformers.js).
  2. **Layer 2 — Dialectical Physics & Telemetry:** Separates semantic resonance from **contradiction/polarity ridges**, computes real-time **Transductive Leverage ($\Delta \mathcal{M} / \Delta c_i$)** shockwaves on every edit, and tracks **Semantic Entropy**, **Tension**, **Simondonian Metastability**, and **Dessalles Unexpected Simplicity**.
  3. **Layer 3 — Non-Servile Overhead Mirror:** Projects translucent **emergent basins**, unresolved **dialectical axes (`A ↔ B`)**, and **negative-space vanishing points (`∅`)** locally without any API key—with an optional BYOK overhead LLM observer (OpenAI / OpenRouter / local Ollama, strict JSON only, zero individual dialogue).
- **Anoptical Transparency Inspector:** Click any cell, basin halo, dialectical axis, or void to inspect its exact mathematical provenance.
- **Solo & Multiplayer Testing:**
  - **Synthetic Swarm (Auber–Dessalles Method):** 0–36 heterogeneous autonomous agents (*Resonators*, *Dialecticians*, *Bridgers*, *Simplicity-Seekers*, *Bifurcators*) that perceive and react to your edits live.
  - **Instant Multi-Tab Sync:** Open multiple browser tabs on the same device to test multi-human interaction immediately via `BroadcastChannel`.
  - **Serverless P2P Rooms (WebRTC):** Share a `?room=noesis-xxx` URL to co-individuate live with remote participants directly on GitHub Pages.
- **Morphogenesis Temporal Replay:** Scrub backward through the collective evolution of thought and export the session trace as JSON.

---

## Running Locally

Zero build tools or Node.js required—any static HTTP server works:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in one or more browser tabs.

---

## Deploying to GitHub Pages

This repository includes `.github/workflows/pages.yml` and `.nojekyll` for automatic deployment:

1. Create an empty repository on GitHub (e.g., `noetic-poietic-generator`).
2. Push this repo to `main`:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
   git push -u origin main
   ```
3. In your GitHub repository, go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
4. Your live prototype will be available at `https://<YOUR_USERNAME>.github.io/<YOUR_REPO>/`.
