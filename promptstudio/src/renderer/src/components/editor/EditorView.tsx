import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorProject, AudioClip, TextClip, VisualClip } from '@shared/timeline'
import { DEFAULT_TEXT_STYLE, newProject, projectDuration, r2 } from '@shared/timeline'
import type { Asset, ProjectSummary } from '@shared/types'
import { useStore } from '../../lib/store'
import { useProject, uid } from '../../lib/useProject'
import { assetDuration, fmtTime } from '../../lib/media'
import Preview from './Preview'
import Timeline, { type Selection } from './Timeline'
import Inspector from './Inspector'
import AssetPanel from './AssetPanel'
import ExportDialog from './ExportDialog'

export default function EditorView(): React.JSX.Element {
  const { library } = useStore()
  const { project, update, replace, undo, redo, canUndo, canRedo, saving } = useProject()
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pps, setPps] = useState(40)
  const [selection, setSelection] = useState<Selection>(null)
  const [showExport, setShowExport] = useState(false)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const raf = useRef<number>(0)
  const last = useRef<number>(0)
  const assets = useMemo(() => new Map(library.assets.map((a) => [a.id, a])), [library.assets])
  const total = projectDuration(project)

  // Transport clock
  useEffect(() => {
    if (!playing) { cancelAnimationFrame(raf.current); return }
    last.current = performance.now()
    const tick = (now: number): void => {
      const dt = (now - last.current) / 1000
      last.current = now
      setTime((t) => {
        const n = t + dt
        if (n >= total) { setPlaying(false); return total }
        return n
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, total])

  const refreshProjects = useCallback(async () => setProjects(await window.api.projects.list()), [])
  useEffect(() => {
    void (async () => {
      const list = await window.api.projects.list()
      setProjects(list)
      if (list[0]) { const p = await window.api.projects.load(list[0].id); if (p) replace(p) }
    })()
  }, [replace])

  const openProject = async (id: string): Promise<void> => {
    if (id === '__new') { replace(newProject(uid())); setTime(0); setSelection(null); await refreshProjects(); return }
    const p = await window.api.projects.load(id)
    if (p) { replace(p); setTime(0); setSelection(null) }
  }

  const addAsset = async (a: Asset, track: 'visual' | 'voice' | 'music'): Promise<void> => {
    const dur = await assetDuration(a)
    if (track === 'visual') {
      const clip: VisualClip = { id: uid(), kind: a.kind === 'video' ? 'video' : 'image', assetId: a.id, start: 0, duration: a.kind === 'video' ? (dur || 5) : 4, trimStart: 0, sourceDuration: dur || undefined, fadeIn: 0, fadeOut: 0, kenBurns: a.kind === 'image', mute: false, volume: 1 }
      update((p) => ({ ...p, visual: [...p.visual, clip] }))
      setSelection({ track: 'visual', id: clip.id })
    } else {
      const start = r2(time)
      const clip: AudioClip = { id: uid(), assetId: a.id, start, duration: dur || 5, trimStart: 0, sourceDuration: dur || undefined, volume: track === 'music' ? 0.3 : 1, fadeIn: 0, fadeOut: track === 'music' ? 1 : 0, label: a.text ? a.text.slice(0, 40) : undefined }
      // TTS clips carry their script: add a matching caption automatically.
      const caption: TextClip | null = track === 'voice' && a.text ? { id: uid(), text: a.text, start, duration: clip.duration, style: { ...DEFAULT_TEXT_STYLE } } : null
      update((p) => ({ ...p, [track]: [...p[track], clip], text: caption ? [...p.text, caption] : p.text }))
      setSelection({ track, id: clip.id })
    }
  }

  const addCaption = (): void => {
    const clip: TextClip = { id: uid(), text: 'Your caption', start: r2(time), duration: 3, style: { ...DEFAULT_TEXT_STYLE } }
    update((p) => ({ ...p, text: [...p.text, clip] }))
    setSelection({ track: 'text', id: clip.id })
  }

  const deleteSelection = useCallback((): void => {
    if (!selection) return
    update((p) => ({ ...p, [selection.track]: (p[selection.track] as Array<{ id: string }>).filter((c) => c.id !== selection.id) }) as EditorProject)
    setSelection(null)
  }, [selection, update])

  const splitAtPlayhead = useCallback((): void => {
    const t = r2(time)
    update((p) => {
      const splitVisual = (c: VisualClip): VisualClip[] => {
        if (t <= c.start + 0.1 || t >= c.start + c.duration - 0.1) return [c]
        const d1 = r2(t - c.start)
        return [{ ...c, duration: d1, fadeOut: 0 }, { ...c, id: uid(), trimStart: r2(c.trimStart + d1), duration: r2(c.duration - d1), fadeIn: 0 }]
      }
      const splitAudio = (c: AudioClip): AudioClip[] => {
        if (t <= c.start + 0.1 || t >= c.start + c.duration - 0.1) return [c]
        const d1 = r2(t - c.start)
        return [{ ...c, duration: d1, fadeOut: 0 }, { ...c, id: uid(), start: t, trimStart: r2(c.trimStart + d1), duration: r2(c.duration - d1), fadeIn: 0 }]
      }
      const splitText = (c: TextClip): TextClip[] => {
        if (t <= c.start + 0.1 || t >= c.start + c.duration - 0.1) return [c]
        const d1 = r2(t - c.start)
        return [{ ...c, duration: d1 }, { ...c, id: uid(), start: t, duration: r2(c.duration - d1) }]
      }
      const only = <T extends { id: string }>(list: T[], fn: (c: T) => T[]): T[] => list.flatMap((c) => (!selection || selection.id === c.id ? fn(c) : [c]))
      return { ...p, visual: only(p.visual, splitVisual), voice: only(p.voice, splitAudio), music: only(p.music, splitAudio), text: only(p.text, splitText) }
    })
  }, [time, selection, update])

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p) }
      else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelection()
      else if (e.key.toLowerCase() === 's' && !e.ctrlKey) splitAtPlayhead()
      else if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      else if (e.key === 'Home') setTime(0)
      else if (e.key === 'ArrowLeft') setTime((t) => Math.max(0, t - (e.shiftKey ? 1 : 0.1)))
      else if (e.key === 'ArrowRight') setTime((t) => Math.min(total, t + (e.shiftKey ? 1 : 0.1)))
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [deleteSelection, splitAtPlayhead, undo, redo, total])

  const onMove = (track: 'voice' | 'music' | 'text', id: string, start: number): void =>
    update((p) => ({ ...p, [track]: (p[track] as Array<{ id: string; start: number }>).map((c) => (c.id === id ? { ...c, start } : c)) }) as EditorProject, false)

  return (
    <div className="editor">
      <div className="editor-top">
        <AssetPanel onAdd={addAsset} onAddCaption={addCaption} />
        <div className="editor-center">
          <div className="row between" style={{ marginBottom: 8 }}>
            <div className="row">
              <select value={project.id} onChange={(e) => openProject(e.target.value)}>
                {!projects.some((p) => p.id === project.id) && <option value={project.id}>{project.name}</option>}
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="__new">＋ New project</option>
              </select>
              <span className="hint">{saving ? 'Saving…' : 'Saved'}</span>
            </div>
            <div className="row">
              <button className="ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶</button>
              <button className="ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">↷</button>
              <button className="primary" onClick={() => setShowExport(true)} disabled={project.visual.length === 0}>Export MP4</button>
            </div>
          </div>
          <Preview project={project} time={time} playing={playing} assets={assets} />
          <div className="transport">
            <button onClick={() => setTime(0)} title="Go to start (Home)">⏮</button>
            <button className="primary" onClick={() => setPlaying((p) => !p)} title="Play / pause (Space)">{playing ? '⏸' : '▶'}</button>
            <span className="mono">{fmtTime(time)} / {fmtTime(total)}</span>
            <input type="range" min={0} max={Math.max(total, 0.1)} step={0.05} value={Math.min(time, total)} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)) }} style={{ flex: 1 }} />
            <button onClick={splitAtPlayhead} title="Split selected clip at playhead (S)">✂ Split</button>
            <button onClick={deleteSelection} disabled={!selection} title="Delete selected (Del)">🗑</button>
            <label className="row hint" style={{ gap: 4 }}>Zoom <input type="range" min={10} max={200} value={pps} onChange={(e) => setPps(Number(e.target.value))} style={{ width: 90 }} /></label>
          </div>
        </div>
        <Inspector project={project} selection={selection} update={update} onDelete={deleteSelection} />
      </div>
      <Timeline project={project} time={time} pps={pps} selection={selection} assets={assets} onSelect={setSelection} onSeek={(t) => { setPlaying(false); setTime(t) }} onMove={onMove} />
      {showExport && <ExportDialog project={project} onClose={() => setShowExport(false)} />}
    </div>
  )
}
