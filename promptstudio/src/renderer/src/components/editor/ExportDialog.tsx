import React, { useEffect, useState } from 'react'
import type { EditorProject, ExportProgress } from '@shared/timeline'
import { EXPORT_PRESETS, projectDuration } from '@shared/timeline'
import { renderTextPng } from '../../lib/textRender'

interface Props { project: EditorProject; onClose(): void }

export default function ExportDialog({ project, onClose }: Props): React.JSX.Element {
  const portrait = project.height > project.width
  const [preset, setPreset] = useState(portrait ? 'shorts' : project.width === project.height ? 'square' : 'yt1080')
  const [quality, setQuality] = useState<'high' | 'medium' | 'small'>('medium')
  const [progress, setProgress] = useState<ExportProgress | null>(null)

  useEffect(() => window.api.exporter.onProgress(setProgress), [])

  const run = async (): Promise<void> => {
    const p = EXPORT_PRESETS.find((x) => x.id === preset)!
    const name = `${project.name.replace(/[^\w\- ]+/g, '').trim() || 'video'}-${p.width}x${p.height}.mp4`
    const outputPath = await window.api.exporter.chooseOutput(name)
    if (!outputPath) return
    setProgress({ phase: 'preparing', percent: 0 })
    const textOverlays: Record<string, string> = {}
    for (const t of project.text) textOverlays[t.id] = renderTextPng(t, p.width, p.height)
    const crf = quality === 'high' ? 17 : quality === 'medium' ? 20 : 26
    setProgress(await window.api.exporter.run({ project, width: p.width, height: p.height, fps: p.fps, outputPath, textOverlays, crf }))
  }

  const busy = progress?.phase === 'preparing' || progress?.phase === 'encoding'
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Export video</h3>
        <label className="field"><span>Preset</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)} disabled={busy}>{EXPORT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="field"><span>Quality</span>
          <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} disabled={busy}><option value="high">High (CRF 17)</option><option value="medium">Medium (CRF 20)</option><option value="small">Small file (CRF 26)</option></select></label>
        <div className="hint">Length {projectDuration(project).toFixed(1)} s · H.264 + AAC MP4 · captions burned in.</div>
        {progress && (
          <div style={{ marginTop: 12 }}>
            <div className="progress"><div style={{ width: `${progress.percent}%` }} /></div>
            <div className="hint" style={{ marginTop: 6 }}>
              {progress.phase === 'preparing' && 'Preparing…'}
              {progress.phase === 'encoding' && `Encoding… ${progress.percent}%`}
              {progress.phase === 'done' && <>Done. <a href="#" onClick={(e) => { e.preventDefault(); window.api.exporter.openFile(progress.outputPath!) }}>Open video</a></>}
              {progress.phase === 'cancelled' && 'Cancelled.'}
            </div>
            {progress.phase === 'failed' && <pre className="error" style={{ maxHeight: 160, overflow: 'auto' }}>{progress.message}</pre>}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          {busy ? <button className="danger" onClick={() => window.api.exporter.cancel()}>Cancel</button> : <button onClick={onClose}>Close</button>}
          <button className="primary" onClick={run} disabled={busy || project.visual.length === 0}>Export MP4</button>
        </div>
      </div>
    </div>
  )
}
