import React, { useState } from 'react'
import type { Asset } from '@shared/types'
import { useStore } from '../../lib/store'

interface Props { onAdd(a: Asset, track: 'visual' | 'voice' | 'music'): void; onAddCaption(): void }

export default function AssetPanel({ onAdd, onAddCaption }: Props): React.JSX.Element {
  const { library, refreshLibrary } = useStore()
  const [kind, setKind] = useState<'all' | 'image' | 'video' | 'audio'>('all')
  const [q, setQ] = useState('')
  const gens = new Map(library.generations.map((g) => [g.id, g]))
  const list = library.assets.filter((a) => a.kind !== 'text' && (kind === 'all' || a.kind === kind) &&
    (!q || (gens.get(a.generationId)?.prompt ?? '').toLowerCase().includes(q.toLowerCase()) || (a.text ?? '').toLowerCase().includes(q.toLowerCase())))

  const importFiles = async (): Promise<void> => { await window.api.library.importFiles(); await refreshLibrary() }

  return (
    <div className="card asset-panel">
      <div className="row between">
        <h3 style={{ margin: 0 }}>Media</h3>
        <div className="row" style={{ gap: 6 }}>
          <button onClick={importFiles} title="Import video, audio or images from disk">＋ Import</button>
          <button onClick={onAddCaption} title="Add a caption or title at the playhead">T Caption</button>
        </div>
      </div>
      <div className="row">
        <div className="modes">{(['all', 'image', 'video', 'audio'] as const).map((k) => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k}</button>)}</div>
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 80 }} />
      </div>
      <div className="asset-list">
        {list.length === 0 && <span className="hint">No media yet. Generate images, voice or video in Create, or import files.</span>}
        {list.map((a) => {
          const g = gens.get(a.generationId)
          return (
            <div className="asset-row" key={a.id}>
              <div className="thumb">
                {a.kind === 'image' && <img src={window.api.library.mediaUrl(a)} alt="" />}
                {a.kind === 'video' && <video src={window.api.library.mediaUrl(a)} muted />}
                {a.kind === 'audio' && <span>🎙</span>}
              </div>
              <div className="asset-info" title={a.text ?? g?.prompt}>
                <div className="name">{a.text ?? g?.prompt ?? a.fileName}</div>
                <div className="hint">{a.kind} · {g?.model.split('/').pop()}</div>
              </div>
              <div className="asset-actions">
                {a.kind !== 'audio' && <button onClick={() => onAdd(a, 'visual')} title="Add to main track">＋ Track</button>}
                {a.kind === 'audio' && <><button onClick={() => onAdd(a, 'voice')} title="Add to voice track">＋ Voice</button><button onClick={() => onAdd(a, 'music')} title="Add to music track">＋ Music</button></>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
