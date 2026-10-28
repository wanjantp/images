# PromptStudio (MVP)

Windows desktop app that generates **text, images, voice (TTS) and video** through a single
[OpenRouter](https://openrouter.ai) API key. This is the Phase 0–1 MVP from
[`../docs/ai-studio-design.md`](../docs/ai-studio-design.md).

## What works in this MVP

| Area | Status |
|---|---|
| OpenRouter API key stored encrypted (Windows DPAPI via Electron `safeStorage`) | ✅ |
| Model catalog from `GET /models`, filtered per mode (text / image / speech / video), with pricing | ✅ |
| Credit balance in the sidebar (`GET /credits`) | ✅ |
| Prompt composer with mode switch, style presets, aspect ratio, reference images, Ctrl+Enter | ✅ |
| **Enhance prompt** (LLM rewrites your idea for the selected mode) | ✅ |
| Text generation → saved as Markdown | ✅ |
| Image generation (`/chat/completions` with `modalities: ["image","text"]`), batch 1–8 | ✅ |
| Text-to-speech (`/audio/speech`), voice, speed, style instructions, auto-chunking of long scripts | ✅ |
| Video generation (`/videos`, async job queue that survives restarts, background polling) | ✅ (verify field names against OpenRouter docs) |
| Pre-flight cost estimate + actual cost read back from `GET /generation?id=` | ✅ |
| Local library: every file saved to a folder with a `library.json` index, search, delete, reveal | ✅ |
| Timeline editor, design canvas, scene builder, pipelines | ⏳ later phases |

## Run on Windows

Requirements: Node.js 20+ and npm.

```powershell
cd promptstudio
npm install
npm run dev          # launches the app with hot reload
```

Build an installer (`dist/PromptStudio-<version>-x64.exe`) and a portable exe:

```powershell
npm run dist:win
```

Other scripts: `npm run typecheck`, `npm run build`.

## First use

1. Open **Settings** and paste your OpenRouter key (`sk-or-v1-…`), then **Save & test**.
2. Go to **Models** and check which image / speech / video models your account can use.
3. In **Create**, choose a mode, pick a model, write a prompt (or press **Enhance prompt**) and **Generate**.
4. Everything lands in **Library** (default folder: `Documents\PromptStudio`).

## Project layout

```
src/main/        Electron main process
  openrouter.ts  OpenRouter adapter (models, credits, chat, image, tts, video, cost)
  generate.ts    text / image / tts flows, prompt enhancer, script chunking
  jobs.ts        persistent async job queue for video
  library.ts     asset + generation index on disk
  settings.ts    settings + encrypted API key
  index.ts       window, IPC handlers, media:// protocol for local files
src/preload/     typed `window.api` bridge (contextIsolation on)
src/renderer/    React UI: Composer, Library, Models, Settings, JobsBar
src/shared/      types and pricing helpers shared by all three
```

## Notes

- The video endpoint is the newest part of OpenRouter's API. `openrouter.ts` reads the job id, status
  and download URL defensively from several possible field names; if a provider returns a different
  shape, adjust `readVideoState()`.
- Model IDs are never hardcoded for generation: the catalog is fetched at runtime and your last
  choice per mode is remembered.
- Key, settings and job queue live in `%APPDATA%\promptstudio\`.
