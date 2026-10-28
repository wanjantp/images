import React, { useMemo } from 'react'
import type { Mode, ORModel } from '@shared/types'
import { supportsMode, price } from '@shared/pricing'
import { useStore } from '../lib/store'

interface Props { mode: Mode; value: string; onChange(id: string): void }

export function modelsFor(models: ORModel[], mode: Mode): ORModel[] {
  return models.filter((m) => supportsMode(m, mode)).sort((a, b) => a.name.localeCompare(b.name))
}

export default function ModelSelect({ mode, value, onChange }: Props): React.JSX.Element {
  const { models, modelsError, refreshModels } = useStore()
  const list = useMemo(() => modelsFor(models, mode), [models, mode])
  const unit = mode === 'image' ? 'image' : mode === 'voice' ? 'char' : mode === 'video' ? 'sec' : 'tok'
  const unitPrice = (m: ORModel): string => {
    const p = mode === 'image' ? price(m.pricing.image) : mode === 'video' ? price(m.pricing.video ?? m.pricing.completion) : price(m.pricing.prompt)
    if (!p) return ''
    return mode === 'text' ? ` · $${(p * 1e6).toFixed(2)}/M tok` : ` · $${p.toFixed(mode === 'voice' ? 6 : 3)}/${unit}`
  }
  return (
    <div className="field">
      <span>Model {list.length ? `(${list.length})` : ''}</span>
      <div className="row">
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
          <option value="">{modelsError ? 'Could not load models' : list.length ? 'Select a model…' : 'No models for this mode'}</option>
          {list.map((m) => <option key={m.id} value={m.id}>{m.name}{unitPrice(m)}</option>)}
        </select>
        <button className="ghost" title="Refresh catalog" onClick={() => refreshModels(true)}>↻</button>
      </div>
      {modelsError && <span className="error">{modelsError}</span>}
    </div>
  )
}
