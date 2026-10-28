import React, { useMemo, useState } from 'react'
import type { Mode } from '@shared/types'
import { modalities, price, supportsMode } from '@shared/pricing'
import { useStore } from '../lib/store'

const FILTERS: Array<{ id: Mode | 'all'; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'text', label: 'Text' }, { id: 'image', label: 'Image' }, { id: 'voice', label: 'Speech' }, { id: 'video', label: 'Video' }
]

export default function ModelsView(): React.JSX.Element {
  const { models, modelsError, refreshModels, settings } = useStore()
  const [filter, setFilter] = useState<Mode | 'all'>('all')
  const [q, setQ] = useState('')
  const list = useMemo(() => models
    .filter((m) => filter === 'all' || supportsMode(m, filter))
    .filter((m) => !q || m.id.toLowerCase().includes(q.toLowerCase()) || m.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.id.localeCompare(b.id)), [models, filter, q])

  const fmt = (v: string | undefined, per: number, unit: string): string => {
    const p = price(v); return p ? `$${(p * per).toFixed(per === 1 ? 4 : 2)}/${unit}` : '–'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row between">
        <div className="row">
          <div className="modes">{FILTERS.map((f) => <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
          <input placeholder="Search models…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
        </div>
        <div className="row"><span className="hint">{list.length} models</span><button onClick={() => refreshModels(true)} disabled={!settings?.hasApiKey}>Refresh catalog</button></div>
      </div>
      {modelsError && <div className="error">{modelsError}</div>}
      <table>
        <thead><tr><th>Model</th><th>Output</th><th>Input $/M tok</th><th>Output $/M tok</th><th>Image</th><th>Other pricing</th><th>Context</th></tr></thead>
        <tbody>
          {list.map((m) => {
            const other = Object.entries(m.pricing).filter(([k, v]) => !['prompt', 'completion', 'image', 'request'].includes(k) && price(v) > 0).map(([k, v]) => `${k}: ${v}`).join(', ')
            return (
              <tr key={m.id}>
                <td><div>{m.name}</div><div className="mono hint">{m.id}</div></td>
                <td>{modalities(m).map((o) => <span className="badge" key={o} style={{ marginRight: 4 }}>{o}</span>)}</td>
                <td>{fmt(m.pricing.prompt, 1e6, 'M')}</td>
                <td>{fmt(m.pricing.completion, 1e6, 'M')}</td>
                <td>{fmt(m.pricing.image, 1, 'img')}</td>
                <td className="hint">{other || '–'}</td>
                <td>{m.context_length ? m.context_length.toLocaleString() : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
