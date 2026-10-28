import React from 'react'
import type { EditorProject, VisualClip, AudioClip, TextClip } from '@shared/timeline'
import type { Selection } from './Timeline'

interface Props {
  project: EditorProject
  selection: Selection
  update(fn: (p: EditorProject) => EditorProject): void
  onDelete(): void
}

function Num({ label, value, min, max, step = 0.1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange(v: number): void }): React.JSX.Element {
  return (
    <label className="field"><span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
    </label>
  )
}

export default function Inspector({ project, selection, update, onDelete }: Props): React.JSX.Element {
  if (!selection) {
    return (
      <div className="card inspector">
        <h3>Project</h3>
        <label className="field"><span>Name</span><input value={project.name} onChange={(e) => update((p) => ({ ...p, name: e.target.value }))} /></label>
        <label className="field"><span>Canvas</span>
          <select value={`${project.width}x${project.height}`} onChange={(e) => { const [w, h] = e.target.value.split('x').map(Number); update((p) => ({ ...p, width: w, height: h })) }}>
            <option value="1920x1080">16:9 · 1920×1080</option>
            <option value="1080x1920">9:16 · 1080×1920</option>
            <option value="1080x1080">1:1 · 1080×1080</option>
            <option value="1280x720">16:9 · 1280×720</option>
          </select></label>
        <span className="hint">Select a clip to edit it. Drag voice, music and caption clips to move them. Ctrl+Z / Ctrl+Y undo and redo.</span>
      </div>
    )
  }

  if (selection.track === 'visual') {
    const c = project.visual.find((x) => x.id === selection.id)
    if (!c) return <div />
    const set = (patch: Partial<VisualClip>): void => update((p) => ({ ...p, visual: p.visual.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }))
    const maxDur = c.kind === 'video' && c.sourceDuration ? Math.max(0.1, c.sourceDuration - c.trimStart) : 120
    return (
      <div className="card inspector">
        <h3>{c.kind === 'image' ? 'Image clip' : 'Video clip'}</h3>
        <Num label="Duration (s)" value={c.duration} min={0.1} max={maxDur} onChange={(v) => set({ duration: v })} />
        {c.kind === 'video' && <Num label="Trim start (s into source)" value={c.trimStart} min={0} max={Math.max(0, (c.sourceDuration ?? 9999) - 0.1)} onChange={(v) => set({ trimStart: v, duration: Math.min(c.duration, Math.max(0.1, (c.sourceDuration ?? 9999) - v)) })} />}
        <div className="row">
          <Num label="Fade in (s)" value={c.fadeIn} min={0} max={5} onChange={(v) => set({ fadeIn: v })} />
          <Num label="Fade out (s)" value={c.fadeOut} min={0} max={5} onChange={(v) => set({ fadeOut: v })} />
        </div>
        {c.kind === 'image' && <label className="row"><input type="checkbox" checked={c.kenBurns} onChange={(e) => set({ kenBurns: e.target.checked })} /> Ken Burns slow zoom</label>}
        {c.kind === 'video' && (
          <>
            <label className="row"><input type="checkbox" checked={c.mute} onChange={(e) => set({ mute: e.target.checked })} /> Mute clip audio</label>
            <label className="field"><span>Clip volume {Math.round(c.volume * 100)}%</span><input type="range" min={0} max={2} step={0.05} value={c.volume} onChange={(e) => set({ volume: Number(e.target.value) })} /></label>
          </>
        )}
        <div className="row">
          <button onClick={() => update((p) => { const i = p.visual.findIndex((x) => x.id === c.id); if (i <= 0) return p; const v = [...p.visual]; [v[i - 1], v[i]] = [v[i], v[i - 1]]; return { ...p, visual: v } })}>◀ Move earlier</button>
          <button onClick={() => update((p) => { const i = p.visual.findIndex((x) => x.id === c.id); if (i < 0 || i >= p.visual.length - 1) return p; const v = [...p.visual]; [v[i + 1], v[i]] = [v[i], v[i + 1]]; return { ...p, visual: v } })}>Move later ▶</button>
        </div>
        <button className="danger" onClick={onDelete}>Delete clip</button>
      </div>
    )
  }

  if (selection.track === 'text') {
    const c = project.text.find((x) => x.id === selection.id)
    if (!c) return <div />
    const set = (patch: Partial<TextClip>): void => update((p) => ({ ...p, text: p.text.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }))
    const style = (patch: Partial<TextClip['style']>): void => set({ style: { ...c.style, ...patch } })
    return (
      <div className="card inspector">
        <h3>Caption / title</h3>
        <label className="field"><span>Text</span><textarea style={{ minHeight: 70 }} value={c.text} onChange={(e) => set({ text: e.target.value })} /></label>
        <div className="row">
          <Num label="Start (s)" value={c.start} min={0} max={3600} onChange={(v) => set({ start: v })} />
          <Num label="Duration (s)" value={c.duration} min={0.1} max={600} onChange={(v) => set({ duration: v })} />
        </div>
        <div className="row">
          <Num label="Font size" value={c.style.fontSize} min={12} max={200} step={2} onChange={(v) => style({ fontSize: v })} />
          <label className="field"><span>Position</span>
            <select value={c.style.position} onChange={(e) => style({ position: e.target.value as TextClip['style']['position'] })}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label>
        </div>
        <div className="row">
          <label className="field"><span>Text colour</span><input type="color" value={c.style.color} onChange={(e) => style({ color: e.target.value })} /></label>
          <label className="field"><span>Background</span>
            <select value={c.style.background} onChange={(e) => style({ background: e.target.value })}>
              <option value="rgba(0,0,0,0.55)">Dark box</option><option value="rgba(255,255,255,0.85)">Light box</option><option value="#6d8cff">Accent box</option><option value="transparent">None</option>
            </select></label>
          <label className="row"><input type="checkbox" checked={c.style.bold} onChange={(e) => style({ bold: e.target.checked })} /> Bold</label>
        </div>
        <label className="field"><span>Font</span>
          <select value={c.style.fontFamily} onChange={(e) => style({ fontFamily: e.target.value })}>
            <option value="Segoe UI, Arial, sans-serif">Segoe UI</option><option value="Arial, sans-serif">Arial</option><option value="Impact, sans-serif">Impact</option><option value="Georgia, serif">Georgia</option><option value="Consolas, monospace">Consolas</option><option value="Tahoma, sans-serif">Tahoma (Thai)</option>
          </select></label>
        <button className="danger" onClick={onDelete}>Delete caption</button>
      </div>
    )
  }

  const list = selection.track === 'voice' ? project.voice : project.music
  const c = list.find((x) => x.id === selection.id)
  if (!c) return <div />
  const set = (patch: Partial<AudioClip>): void => update((p) => ({ ...p, [selection.track]: (p[selection.track] as AudioClip[]).map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }))
  return (
    <div className="card inspector">
      <h3>{selection.track === 'voice' ? 'Voice clip' : 'Music clip'}</h3>
      <div className="row">
        <Num label="Start (s)" value={c.start} min={0} max={3600} onChange={(v) => set({ start: v })} />
        <Num label="Duration (s)" value={c.duration} min={0.1} max={Math.max(0.1, (c.sourceDuration ?? 9999) - c.trimStart)} onChange={(v) => set({ duration: v })} />
      </div>
      <Num label="Trim start (s into source)" value={c.trimStart} min={0} max={Math.max(0, (c.sourceDuration ?? 9999) - 0.1)} onChange={(v) => set({ trimStart: v, duration: Math.min(c.duration, Math.max(0.1, (c.sourceDuration ?? 9999) - v)) })} />
      <label className="field"><span>Volume {Math.round(c.volume * 100)}%</span><input type="range" min={0} max={2} step={0.05} value={c.volume} onChange={(e) => set({ volume: Number(e.target.value) })} /></label>
      <div className="row">
        <Num label="Fade in (s)" value={c.fadeIn} min={0} max={10} onChange={(v) => set({ fadeIn: v })} />
        <Num label="Fade out (s)" value={c.fadeOut} min={0} max={10} onChange={(v) => set({ fadeOut: v })} />
      </div>
      <button className="danger" onClick={onDelete}>Delete clip</button>
    </div>
  )
}
