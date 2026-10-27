# AI Creative Studio for Windows — Software Design

Working name: **PromptStudio** (placeholder, rename freely)
Backend: **OpenRouter only** (LLM + image + TTS + video + transcription through one API key)
Positioning: Google Flow (AI filmmaking, scene builder) + Canva (templates, design canvas, brand kit) + CapCut (timeline editing), in one desktop app.

> Note: endpoint names below come from OpenRouter's public docs/blog as indexed in Oct 2026. Verify exact request fields at https://openrouter.ai/docs before implementation.

---

## 1. Product overview

One prompt bar drives four generators. Everything generated lands in a project library and can be dragged into a timeline or a design canvas.

| Capability | OpenRouter surface | Example models (Oct 2026) |
|---|---|---|
| Text (script, storyboard, prompt enhancement, captions, translation) | `POST /api/v1/chat/completions` | Any chat model; cheap fast models for helpers, strong models for scripts |
| Image generation and editing | `POST /api/v1/chat/completions` with `modalities: ["image","text"]`; newer dedicated `/api/v1/images` | `google/gemini-*-image`, `openai/gpt-5.4-image-2` |
| Text-to-speech | `POST /api/v1/audio/speech` (OpenAI-compatible, returns mp3/wav/pcm) | `openai/gpt-4o-mini-tts-*`, `mistralai/voxtral-mini-tts-*`, Google, xAI voices |
| Video generation | `POST /api/v1/videos` (async: submit → job id → poll → download) | Grok Imagine Video, ByteDance Seedance 2.0, Alibaba Wan 2.7 |
| Speech-to-text (captions, word timings) | `POST /api/v1/audio/transcriptions` | Whisper-class models |
| Model catalog | `GET /api/v1/models?output_modalities=image|speech|video` | Drives dynamic model pickers |
| Cost / balance | `GET /api/v1/generation?id=…`, `GET /api/v1/credits` | Per-generation cost, remaining credits |

Local (non-AI) processing: FFmpeg for mux/transitions/mixing/subtitle burn-in, Remotion or Canvas for compositing, ONNX Runtime for optional offline tools (background removal, upscaling).

---

## 2. Feature list

### 2.1 Home / Dashboard
- Recent projects, pinned projects, project thumbnails.
- "Start from" tiles: Blank project, Template, One-click video from topic, Import media.
- Live OpenRouter credit balance and this-month spend.
- Job center badge (running / queued / failed generations).

### 2.2 Universal Prompt Composer (the Flow-style prompt bar)
- Single prompt box with mode switch: **Text · Image · Video · Voice**.
- Model picker per mode, populated from the OpenRouter catalog, filterable by price, speed, provider, output modality. Favorites and "last used".
- **Pre-flight cost estimate** before Generate (chars for TTS, images × price, seconds × video price).
- **Prompt Enhancer**: LLM rewrites a short idea into a detailed prompt (style, lighting, camera, mood). Shows diff, one-click accept.
- Negative prompt, seed, batch count (1–8), aspect ratio (16:9, 9:16, 1:1, 4:5, 21:9), resolution, duration (video).
- Reference image slots (drag-drop): style ref, subject ref, first frame, last frame.
- Style presets (Cinematic, Anime, Product shot, Flat illustration, Photoreal, Thai traditional, etc.) stored as prompt fragments.
- Prompt variables and templates: `{product}`, `{color}` → generate variations in batch.
- Prompt history with search, favorites, and "re-run with different model".
- Multilingual input (Thai/English); optional auto-translate to English for image/video models that perform better in English, keep original for TTS.

### 2.3 Image Studio
- Text-to-image, image-to-image, and **edit with instructions** (upload + "make the sky sunset").
- **Inpaint / outpaint**: brush mask, prompt the masked region (sent as image + mask + instruction to edit-capable models).
- Variations: generate 4 alternatives of a selected image.
- Upscale 2×/4× (model-based via OpenRouter where available, or local ONNX Real-ESRGAN).
- Background removal (local model, free, offline).
- Compare grid, side-by-side A/B, zoom, pixel-peek.
- Character/Product consistency: "Ingredients" library (named reference images reused across prompts, Flow-style).
- Save to library with full generation metadata (model, prompt, seed, params, cost).

### 2.4 Voice Studio (TTS)
- Script editor with paragraph blocks; each block can have its own voice.
- Voice library: lists voices per TTS model; preview sample per voice; tag favorites.
- Controls: speed, pitch (where supported), **style instructions** ("calm narrator", "excited ad read") for instruction-following TTS models.
- **Multi-speaker dialogue**: assign speaker names to voices, render as a single mixed track or separate tracks.
- Pronunciation dictionary (brand names, Thai/English mixed text), phonetic overrides.
- Auto-chunking of long scripts to stay within model limits, then seamless concatenation with FFmpeg.
- Word-level timings via transcription endpoint → **auto captions** and karaoke-style highlight.
- Export: MP3, WAV, OGG; per-block or merged; SRT/VTT alongside.
- Voice preview cache so re-listening costs nothing.

### 2.5 Video Studio — Scene Builder (Google Flow equivalent)
- **Script → Storyboard**: LLM converts a script or topic into scenes with shot descriptions, camera directions, duration, and narration lines (structured JSON output).
- Shot cards on a horizontal scenebuilder: thumbnail, prompt, model, status, cost.
- Per shot: text-to-video, **image-to-video** (first frame from Image Studio), first+last frame interpolation, extend shot (+N seconds), regenerate, pick between 2–4 takes.
- Camera presets (dolly in, orbit, pan left, static, handheld) appended to prompt.
- Ingredients for consistency (character/product/style references) shared across shots.
- **Async job queue**: submit many shots, poll in background, notifications on completion, auto-retry with backoff, cancel.
- Shot stitching: automatic cut assembly to timeline with narration already aligned.
- Aspect ratio lock per project (vertical shorts vs. landscape).

### 2.6 Timeline Editor (Canva Video / CapCut equivalent)
- Multi-track: Video, Image, Text/Captions, Voice, Music, SFX.
- Trim, split, ripple delete, snap, speed change, fade in/out.
- Transitions (cut, crossfade, slide, zoom, glitch) and Ken Burns motion for stills.
- **Auto-captions** from TTS timings or transcription; caption styles (TikTok bold, subtitle bar, karaoke).
- Text overlays with animations; lower thirds; title cards.
- Music library import, auto-ducking under voice, beat markers.
- AI helpers inside timeline: "Fill gap with B-roll" (generate image/video for empty section), "Rewrite this caption shorter", "Translate captions to English/Thai".
- Preview playback with scrubbing; low-res proxy for smooth playback.
- Export presets: YouTube 1080p/4K 16:9, TikTok/Reels/Shorts 9:16, Instagram 1:1, GIF, custom. H.264/H.265, bitrate control, burn-in or sidecar subtitles.

### 2.7 Design Canvas (Canva equivalent)
- Page-based designer: thumbnails, posters, social posts, slides, banners with preset sizes.
- Layers panel, alignment guides, grouping, lock, opacity, blend modes.
- Text with Google Fonts + local fonts (Thai fonts supported), shapes, frames, icons.
- **AI Fill**: click an empty frame → generate image to fit.
- **Magic Resize**: one design → all social sizes, with LLM re-layout suggestions.
- Brand Kit: logo, colors, fonts; "apply brand" to any template.
- Templates: built-in starter templates plus "Generate template from prompt" (LLM returns layout JSON, images generated per frame).
- Background remove / replace on any image layer.
- Export PNG/JPG/SVG/PDF, single page or all pages.

### 2.8 AI Copilot panel
- Chat sidebar that can act on the project through tool calling: "make a 60-second product video about X in Thai with a female narrator", "turn this blog post into 5 Instagram slides", "shorten all captions".
- Explains what it will generate and the estimated cost before running.
- Uses project context (script, shots, brand kit) as grounding.

### 2.9 One-click Pipelines (workflow automation)
- Topic → Script → Storyboard → Images/Video → TTS → Captions → Music → Assemble → Export.
- Pipeline templates: Explainer video, Product ad, Lecture / e-learning module, News recap, Social carousel, Podcast intro.
- Each pipeline is an editable node graph (users can swap models or skip steps).
- Batch mode: CSV of topics → N videos.

### 2.10 Asset Library & Project Management
- Local-first project folder: `project.json` + `/assets` + `/renders`. Portable, zip-able.
- Media manager with tags, AI auto-tagging and description, full-text search of prompts.
- **Lineage view**: which prompt/model/seed produced each asset; re-generate from any node.
- Versions and favorites; trash with restore.
- Import: images, video, audio, fonts, PPTX/PDF pages as images.

### 2.11 Models, Cost & Routing
- Model browser synced from OpenRouter catalog (name, provider, price per unit, context, modalities, latency stats).
- Per-mode default model + fallback list; provider routing preferences (allow/deny providers, data-policy filter).
- Budget guardrails: per-project budget, daily cap, confirm dialog above a threshold.
- Usage dashboard: spend by day / modality / model; export CSV.
- Cache: identical prompt+params+model returns cached result (opt-in).

### 2.12 Settings & Security
- API key stored in **Windows Credential Manager** (never plaintext). Option to sign in via OpenRouter OAuth PKCE flow instead of pasting a key.
- Proxy support, request timeout, concurrency limit.
- Output folders, FFmpeg/GPU settings, hardware encoder (NVENC/QSV/AMF).
- UI language (Thai / English), theme, keyboard shortcuts.
- Privacy: opt-in telemetry only; prompts and media never leave the machine except to OpenRouter.

### 2.13 Phase 2+ ideas
- Direct publish to YouTube / TikTok / Facebook.
- Cloud sync and team comments.
- Plugin SDK (custom nodes in pipelines).
- Live avatar / lip-sync when such models appear on OpenRouter.

---

## 3. Feature mapping vs. Google Flow and Canva

| Area | Google Flow | Canva | PromptStudio |
|---|---|---|---|
| Prompt-to-video shots, scenebuilder, extend shot | ✓ | – | ✓ (any OpenRouter video model) |
| Ingredients / consistent characters | ✓ | – | ✓ |
| Frames-to-video (first/last frame) | ✓ | – | ✓ |
| Templates, brand kit, magic resize | – | ✓ | ✓ |
| Design canvas, layers, fonts | – | ✓ | ✓ |
| Timeline video editing, captions | limited | ✓ | ✓ |
| Text-to-speech, multi-speaker | – | basic | ✓ (many providers) |
| Choose any model / provider, see price | – | – | ✓ |
| Local-first files, offline tools | – | – | ✓ |
| Thai language UI + Thai TTS/fonts | – | partial | ✓ |

---

## 4. Architecture

### 4.1 Stack (recommended)
- **Shell**: Electron (or Tauri 2 if a smaller installer matters more than ecosystem). Windows installer via electron-builder (NSIS/MSIX), auto-update.
- **UI**: React + TypeScript, Zustand/Redux for state, TanStack Query for API, Tailwind + Radix for components.
- **Canvas / design**: Fabric.js or Konva for the design canvas.
- **Timeline + render**: Remotion (React compositions → MP4) or custom FFmpeg filter graphs; WaveSurfer for audio waveforms.
- **Media**: bundled FFmpeg/FFprobe; sharp for image ops; ONNX Runtime (DirectML) for local background removal/upscale.
- **Storage**: SQLite (better-sqlite3) for library index, project JSON on disk, Windows Credential Manager (keytar / Windows.Security.Credentials) for secrets.
- **Jobs**: in-process job queue with persistence (so video polls survive restarts).

### 4.2 Layers
```
┌──────────────────────────────────────────────────────────────┐
│ UI (React): Prompt Composer │ Image │ Voice │ Scenebuilder │ │
│            Timeline │ Design Canvas │ Copilot │ Library      │
├──────────────────────────────────────────────────────────────┤
│ Application services: ProjectService, JobQueue, CostService, │
│ PipelineEngine (node graph), CaptionService, ExportService    │
├──────────────────────────────────────────────────────────────┤
│ OpenRouter adapter:  chat() │ image() │ tts() │ video()      │
│                      transcribe() │ models() │ cost()        │
├──────────────────────────────────────────────────────────────┤
│ Local engines: FFmpeg │ Remotion │ ONNX (rembg/upscale)      │
├──────────────────────────────────────────────────────────────┤
│ Storage: SQLite index │ project folders │ Credential Manager │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Data model (simplified)
```ts
Project { id, name, aspect, brandKitId, scenes: Scene[], tracks: Track[], pages: DesignPage[] }
Scene   { id, title, narration, shots: Shot[] }
Shot    { id, prompt, model, durationSec, refs: AssetId[], takes: AssetId[], selectedTake }
Asset   { id, kind: 'image'|'video'|'audio', path, width, height, durationSec, generationId? }
Generation { id, modality, model, prompt, params, seed, costUsd, openrouterGenId, createdAt, outputs: AssetId[] }
Job     { id, type, status: 'queued'|'running'|'polling'|'done'|'failed', remoteJobId?, attempts, error? }
```

### 4.4 OpenRouter adapter sketch (TypeScript)
```ts
const BASE = 'https://openrouter.ai/api/v1';
const headers = (key: string) => ({
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://your-app-site',   // optional attribution
  'X-Title': 'PromptStudio',
});

// Text / script / storyboard (structured output)
export async function chat(key, model, messages, schema?) {
  const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: headers(key),
    body: JSON.stringify({ model, messages,
      ...(schema && { response_format: { type: 'json_schema', json_schema: schema } }) }) });
  return (await r.json()).choices[0].message.content;
}

// Image generation (returned as base64 data URLs in the assistant message)
export async function image(key, model, prompt, refs: string[] = [], opts = {}) {
  const content = [{ type: 'text', text: prompt },
    ...refs.map(url => ({ type: 'image_url', image_url: { url } }))];
  const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: headers(key),
    body: JSON.stringify({ model, modalities: ['image', 'text'],
      messages: [{ role: 'user', content }], ...opts }) });
  const msg = (await r.json()).choices[0].message;
  return msg.images?.map((i: any) => i.image_url.url) ?? [];   // data:image/png;base64,...
}

// Text-to-speech (OpenAI-compatible; returns raw audio bytes)
export async function tts(key, model, input, voice, format = 'mp3', instructions?) {
  const r = await fetch(`${BASE}/audio/speech`, { method: 'POST', headers: headers(key),
    body: JSON.stringify({ model, input, voice, response_format: format, instructions }) });
  return Buffer.from(await r.arrayBuffer());
}

// Video (async): submit → poll → download
export async function videoSubmit(key, model, prompt, opts: { aspect_ratio?, duration?, resolution?, image?: string }) {
  const r = await fetch(`${BASE}/videos`, { method: 'POST', headers: headers(key),
    body: JSON.stringify({ model, prompt, ...opts }) });
  return (await r.json()).id;             // job id
}
export async function videoStatus(key, id) {
  return (await fetch(`${BASE}/videos/${id}`, { headers: headers(key) })).json(); // { status, url? }
}

// Model catalog by output modality
export async function models(key, modality: 'image'|'speech'|'video') {
  return (await fetch(`${BASE}/models?output_modalities=${modality}`, { headers: headers(key) })).json();
}

// Actual cost of a finished generation
export async function cost(key, genId) {
  return (await fetch(`${BASE}/generation?id=${genId}`, { headers: headers(key) })).json();
}
```
Field names for `/videos` and `/images` must be checked against the live docs; the chat, TTS, and models calls follow the OpenAI-compatible shapes OpenRouter documents.

### 4.5 Key flows
1. **Generate image**: composer → cost estimate → `image()` → decode base64 → save PNG to `/assets` → index in SQLite with Generation record → fetch real cost → update spend.
2. **Generate video shot**: `videoSubmit()` → persist Job with remoteJobId → poller every 5–10 s → download MP4 → thumbnail via FFmpeg → attach as take → notify.
3. **Narration**: script blocks → chunk → `tts()` per block → concat with FFmpeg → `transcribe()` for word timings → SRT → place on timeline.
4. **One-click video**: PipelineEngine runs nodes in dependency order with concurrency limit, pauses on budget threshold, resumable after crash.

---

## 5. UI layout

```
┌ Title bar: PromptStudio ─ Project: "Promo Q4" ─ Credits: $12.40 ─ Jobs ● 3 ─┐
│ Side nav │ Workspace tabs: Image | Voice | Scenes | Timeline | Design | Copilot │
│ Home     │ ┌───────────────────────────────────────────────┐ ┌ Inspector ───┐ │
│ Library  │ │  Canvas / preview / scenebuilder               │ │ model        │ │
│ Models   │ │                                               │ │ aspect 16:9  │ │
│ Settings │ │                                               │ │ seed  ...    │ │
│          │ └───────────────────────────────────────────────┘ │ cost est.    │ │
│          │ [ Text | Image | Video | Voice ]  model ▾  ✨Enhance  🖼 refs  [Generate] │
│          │ Prompt: "A ceramic coffee mug on a wooden table, soft morning light..." │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Non-functional requirements
- Local-first; app works offline for editing, only generation needs network.
- Every generation is auditable: prompt, model, params, cost, time.
- Autosave every 30 s, crash recovery, unlimited undo/redo per workspace.
- Secrets never in logs or project files.
- Concurrency and rate-limit handling with exponential backoff; resume polling after restart.
- Installer < 300 MB (FFmpeg included), Windows 10/11 x64, optional ARM64 build.
- Accessibility: keyboard-navigable, screen-reader labels, Thai/English localisation.

---

## 7. MVP roadmap

| Phase | Scope | Est. |
|---|---|---|
| 0 | Electron shell, API key storage, model catalog, cost display | 2 weeks |
| 1 | Prompt Composer + Image Studio + Library + prompt enhancer | 4 weeks |
| 2 | Voice Studio (TTS, voices, chunking, captions) | 3 weeks |
| 3 | Scene Builder with async video jobs, image-to-video | 4 weeks |
| 4 | Timeline editor + export presets + auto captions | 5 weeks |
| 5 | Design Canvas + templates + brand kit + magic resize | 5 weeks |
| 6 | Copilot + one-click pipelines + batch | 4 weeks |
| 7 | Polish, installer, auto-update, Thai localisation, docs | 3 weeks |

---

## 8. Risks and mitigations
- **Model churn** on OpenRouter: never hardcode model IDs; read catalog, keep per-mode fallback lists.
- **Video generation cost/latency**: always show estimate, default to low-res previews, upscale final only.
- **Base64 image payloads** are large: stream to disk, never keep in React state.
- **Long TTS scripts**: chunk by sentence, keep voice/model constant per chunk, crossfade joins.
- **Content policy differences** between providers: surface provider errors clearly, offer "retry with another model".
