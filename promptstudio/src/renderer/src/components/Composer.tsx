import React, { useEffect, useMemo, useState } from 'react'
import type { Asset, Generation, Mode } from '@shared/types'
import { estimateCost, fmtUsd } from '@shared/pricing'
import { useStore } from '../lib/store'
import ModelSelect from './ModelSelect'
import ResultTile from './ResultTile'

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'text', label: '✍️ Text' }, { id: 'image', label: '🖼 Image' }, { id: 'voice', label: '🎙 Voice' }, { id: 'video', label: '🎬 Video' }
]
const ASPECTS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9']
const STYLES: Record<string, string> = {
  '': '', Cinematic: 'cinematic, dramatic lighting, shallow depth of field, film grain',
  Photoreal: 'photorealistic, 85mm lens, natural light, high detail', Anime: 'anime style, clean line art, vibrant colours',
  'Flat illustration': 'flat vector illustration, minimal, bold shapes', 'Product shot': 'studio product photography, softbox lighting, white background',
  '3D render': 'octane render, 3D, soft global illumination', Watercolor: 'watercolor painting, soft edges, paper texture'
}
const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse']

const placeholders: Record<Mode, string> = {
  text: 'Write a 60-second product video script about…',
  image: 'A ceramic coffee mug on a wooden table, soft morning light…',
  voice: 'Paste the narration script to read aloud…',
  video: 'Slow dolly-in on a misty mountain lake at sunrise, cinematic…'
}

async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f) })
}

export default function Composer(): React.JSX.Element {
  const { settings, models, refreshLibrary, refreshCredits, library } = useStore()
  const [mode, setMode] = useState<Mode>('image')
  const [model, setModel] = useState<Record<Mode, string>>({ text: '', image: '', voice: '', video: '' })
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('')
  const [count, setCount] = useState(1)
  const [aspect, setAspect] = useState('1:1')
  const [refs, setRefs] = useState<string[]>([])
  const [voice, setVoice] = useState('alloy')
  const [format, setFormat] = useState<'mp3' | 'wav' | 'opus'>('mp3')
  const [speed, setSpeed] = useState(1)
  const [instructions, setInstructions] = useState('')
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState('720p')
  const [busy, setBusy] = useState<'' | 'generate' | 'enhance'>('')
  const [error, setError] = useState('')
  const [results, setResults] = useState<Array<{ asset: Asset; generation: Generation }>>([])

  // apply saved defaults once models arrive
  useEffect(() => {
    if (!settings) return
    setModel((m) => {
      const next = { ...m }
      for (const k of Object.keys(next) as Mode[]) if (!next[k] && settings.defaultModels[k]) next[k] = settings.defaultModels[k]!
      return next
    })
  }, [settings])

  const current = useMemo(() => models.find((m) => m.id === model[mode]), [models, model, mode])
  const fullPrompt = style && (mode === 'image' || mode === 'video') ? `${prompt.trim()}, ${STYLES[style]}` : prompt.trim()
  const est = estimateCost(current, mode, { prompt: fullPrompt, count, durationSec: duration })

  const pickModel = (id: string): void => {
    setModel((m) => ({ ...m, [mode]: id }))
    if (id) void window.api.settings.set({ defaultModels: { [mode]: id } })
  }

  const enhance = async (): Promise<void> => {
    if (!prompt.trim()) return
    setBusy('enhance'); setError('')
    try { setPrompt(await window.api.openrouter.enhance(prompt, mode)) } catch (e) { setError((e as Error).message) } finally { setBusy('') }
  }

  const generate = async (): Promise<void> => {
    if (!fullPrompt || !model[mode]) return
    setBusy('generate'); setError('')
    try {
      const m = model[mode]
      if (mode === 'video') {
        await window.api.openrouter.videoSubmit({ model: m, prompt: fullPrompt, aspectRatio: aspect, durationSec: duration, resolution, image: refs[0] })
      } else {
        const r = mode === 'text'
          ? await window.api.openrouter.chat({ model: m, prompt: fullPrompt })
          : mode === 'image'
            ? await window.api.openrouter.image({ model: m, prompt: fullPrompt, count, aspectRatio: aspect, referenceImages: refs })
            : await window.api.openrouter.tts({ model: m, input: prompt.trim(), voice, format, speed, instructions: instructions || undefined })
        setResults((prev) => [...r.assets.map((asset) => ({ asset, generation: r.generation })), ...prev])
      }
      await refreshLibrary(); void refreshCredits()
    } catch (e) { setError((e as Error).message) } finally { setBusy('') }
  }

  const addRefs = async (files: FileList | null): Promise<void> => {
    if (!files) return
    const urls = await Promise.all(Array.from(files).slice(0, 4).map(fileToDataUrl))
    setRefs((r) => [...r, ...urls].slice(0, 4))
  }

  const onKey = (e: React.KeyboardEvent): void => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void generate() }

  // Recent video results from the library (jobs complete asynchronously).
  const recentVideos = library.assets.filter((a) => a.kind === 'video').slice(0, 4)

  return (
    <div className="composer">
      <div className="composer-left">
        <div className="row between">
          <div className="modes">
            {MODES.map((m) => <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => { setMode(m.id); setError('') }}>{m.label}</button>)}
          </div>
          <span className="hint">Ctrl+Enter to generate</span>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={onKey} placeholder={placeholders[mode]} />
          {(mode === 'image' || mode === 'video') && (
            <div className="row">
              <label className="row" style={{ gap: 6 }}>
                <input type="file" accept="image/*" multiple={mode === 'image'} style={{ display: 'none' }} id="refs" onChange={(e) => addRefs(e.target.files)} />
                <button onClick={() => document.getElementById('refs')?.click()}>{mode === 'video' ? '🖼 First frame' : '🖼 Reference images'}</button>
              </label>
              <div className="refs">
                {refs.map((r, i) => <img key={i} src={r} alt="" title="Click to remove" onClick={() => setRefs((x) => x.filter((_, j) => j !== i))} />)}
              </div>
            </div>
          )}
          <div className="row between">
            <div className="row">
              <button onClick={enhance} disabled={busy !== '' || !prompt.trim() || !settings?.hasApiKey} title={`Rewrite with ${settings?.enhancerModel ?? 'enhancer model'}`}>
                {busy === 'enhance' ? <><span className="spinner" />Enhancing…</> : '✨ Enhance prompt'}
              </button>
              <button className="ghost" onClick={() => { setPrompt(''); setRefs([]) }}>Clear</button>
            </div>
            <button className="primary" onClick={generate} disabled={busy !== '' || !fullPrompt || !model[mode] || !settings?.hasApiKey}>
              {busy === 'generate' ? <><span className="spinner" />Generating…</> : mode === 'video' ? 'Submit video job' : 'Generate'}
            </button>
          </div>
          {error && <div className="error">{error}</div>}
        </div>

        <div className="results">
          {mode === 'video' && recentVideos.length > 0 && (
            <>
              <div className="hint">Recent videos (jobs finish in the background and appear here and in Library)</div>
              <div className="grid">{recentVideos.map((a) => <ResultTile key={a.id} asset={a} generation={library.generations.find((g) => g.id === a.generationId)} />)}</div>
            </>
          )}
          {results.length > 0 && <div className="grid">{results.map((r) => <ResultTile key={r.asset.id} asset={r.asset} generation={r.generation} />)}</div>}
          {results.length === 0 && mode !== 'video' && <div className="hint">Results from this session appear here. Everything is also saved to your Library.</div>}
        </div>
      </div>

      <aside className="inspector">
        <div className="card">
          <h3>Model</h3>
          <ModelSelect mode={mode} value={model[mode]} onChange={pickModel} />
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3>Settings</h3>
          {(mode === 'image' || mode === 'video') && (
            <>
              <label className="field"><span>Aspect ratio</span>
                <select value={aspect} onChange={(e) => setAspect(e.target.value)}>{ASPECTS.map((a) => <option key={a}>{a}</option>)}</select></label>
              <label className="field"><span>Style preset</span>
                <select value={style} onChange={(e) => setStyle(e.target.value)}>{Object.keys(STYLES).map((s) => <option key={s} value={s}>{s || 'None'}</option>)}</select></label>
            </>
          )}
          {mode === 'image' && (
            <label className="field"><span>Images per run</span>
              <input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} /></label>
          )}
          {mode === 'voice' && (
            <>
              <label className="field"><span>Voice</span>
                <input list="voices" value={voice} onChange={(e) => setVoice(e.target.value)} />
                <datalist id="voices">{VOICES.map((v) => <option key={v} value={v} />)}</datalist></label>
              <label className="field"><span>Style instructions (if the model supports it)</span>
                <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="calm documentary narrator" /></label>
              <label className="field"><span>Speed {speed.toFixed(2)}×</span>
                <input type="range" min={0.5} max={2} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} /></label>
              <label className="field"><span>Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}><option>mp3</option><option>wav</option><option>opus</option></select></label>
            </>
          )}
          {mode === 'video' && (
            <>
              <label className="field"><span>Duration (seconds)</span>
                <input type="number" min={2} max={15} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 5)} /></label>
              <label className="field"><span>Resolution</span>
                <select value={resolution} onChange={(e) => setResolution(e.target.value)}><option>480p</option><option>720p</option><option>1080p</option></select></label>
              <span className="hint">Video runs as a background job (usually 1–5 minutes). You can keep working.</span>
            </>
          )}
          {mode === 'text' && <span className="hint">Use this for scripts, storyboards, captions and translations. Output is saved as Markdown.</span>}
        </div>

        <div className="card">
          <h3>Cost estimate</h3>
          <div className="estimate"><span>Before run</span><b>{fmtUsd(est.usd)}</b></div>
          <div className="hint">{est.note}</div>
          <div className="hint" style={{ marginTop: 6 }}>Actual cost is read back from OpenRouter after each generation.</div>
        </div>
      </aside>
    </div>
  )
}
