import React from 'react'
import type { Asset, Generation } from '@shared/types'
import { fmtUsd } from '@shared/pricing'

interface Props { asset: Asset; generation?: Generation; onDelete?(id: string): void }

export default function ResultTile({ asset, generation, onDelete }: Props): React.JSX.Element {
  const url = window.api.library.mediaUrl(asset)
  return (
    <div className="tile">
      {asset.kind === 'image' && <img src={url} alt={generation?.prompt ?? ''} />}
      {asset.kind === 'video' && <video src={url} controls />}
      {asset.kind === 'audio' && <div style={{ padding: 10 }}><audio src={url} controls /></div>}
      {asset.kind === 'text' && <pre>{asset.text}</pre>}
      <div className="meta">
        <div className="prompt" title={generation?.prompt}>{asset.kind === 'audio' && asset.text ? asset.text : generation?.prompt ?? asset.fileName}</div>
        <div className="row between">
          <span>{generation?.model.split('/').pop()}</span>
          <span>{generation?.costUsd !== undefined ? fmtUsd(generation.costUsd) : ''}</span>
        </div>
        <div className="row between">
          <span>{new Date(asset.createdAt).toLocaleString()}</span>
          <span className="row" style={{ gap: 4 }}>
            <button className="ghost" title="Show in folder" onClick={() => window.api.library.reveal(asset.id)}>📂</button>
            {onDelete && <button className="ghost" title="Delete" onClick={() => onDelete(asset.id)}>🗑</button>}
          </span>
        </div>
      </div>
    </div>
  )
}
