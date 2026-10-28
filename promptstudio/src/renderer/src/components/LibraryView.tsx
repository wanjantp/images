import React, { useMemo, useState } from 'react'
import type { AssetKind } from '@shared/types'
import { fmtUsd } from '@shared/pricing'
import { useStore } from '../lib/store'
import ResultTile from './ResultTile'

const KINDS: Array<AssetKind | 'all'> = ['all', 'image', 'video', 'audio', 'text']

export default function LibraryView(): React.JSX.Element {
  const { library, refreshLibrary } = useStore()
  const [kind, setKind] = useState<AssetKind | 'all'>('all')
  const [q, setQ] = useState('')
  const gens = useMemo(() => new Map(library.generations.map((g) => [g.id, g])), [library])
  const list = library.assets.filter((a) => (kind === 'all' || a.kind === kind) &&
    (!q || (gens.get(a.generationId)?.prompt ?? '').toLowerCase().includes(q.toLowerCase()) || (a.text ?? '').toLowerCase().includes(q.toLowerCase())))
  const spent = library.generations.reduce((s, g) => s + (g.costUsd ?? 0), 0)

  const del = async (id: string): Promise<void> => {
    if (confirm('Delete this file from disk?')) { await window.api.library.delete(id); await refreshLibrary() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <div className="row">
          <div className="modes">{KINDS.map((k) => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{k}</button>)}</div>
          <input placeholder="Search prompts…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
        </div>
        <div className="row">
          <span className="hint">{library.assets.length} files · {library.generations.length} generations · spent {fmtUsd(spent)}</span>
          <button onClick={() => window.api.library.openFolder()}>Open folder</button>
        </div>
      </div>
      {list.length === 0 ? <div className="hint">Nothing here yet. Generate something in Create.</div>
        : <div className="grid">{list.map((a) => <ResultTile key={a.id} asset={a} generation={gens.get(a.generationId)} onDelete={del} />)}</div>}
    </div>
  )
}
