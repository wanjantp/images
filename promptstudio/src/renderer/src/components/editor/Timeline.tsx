import React, { useRef } from 'react'
import type { EditorProject, AudioClip, TextClip } from '@shared/timeline'
import { projectDuration, r2 } from '@shared/timeline'
import type { Asset } from '@shared/types'
import { fmtTime } from '../../lib/media'

export type Selection = { track: 'visual' | 'voice' | 'music' | 'text'; id: string } | null

interface Props {
  project: EditorProject
  time: number
  pps: number // pixels per second
  selection: Selection
  assets: Map<string, Asset>
  onSelect(s: Selection): void
  onSeek(t: number): void
  onMove(track: 'voice' | 'music' | 'text', id: string, start: number): void
}

const TRACKS: Array<{ key: 'visual' | 'voice' | 'music' | 'text'; label: string; color: string }> = [
  { key: 'text', label: 'Captions', color: '#9b6dff' },
  { key: 'visual', label: 'Video / Image', color: '#6d8cff' },
  { key: 'voice', label: 'Voice', color: '#3ccf91' },
  { key: 'music', label: 'Music', color: '#f5b84a' }
]

export default function Timeline({ project, time, pps, selection, assets, onSelect, onSeek, onMove }: Props): React.JSX.Element {
  const total = Math.max(10, projectDuration(project) + 5)
  const width = total * pps
  const scroller = useRef<HTMLDivElement>(null)
  const drag = useRef<{ track: 'voice' | 'music' | 'text'; id: string; offsetX: number } | null>(null)

  const xToTime = (clientX: number): number => {
    const el = scroller.current!
    const rect = el.getBoundingClientRect()
    return Math.max(0, (clientX - rect.left + el.scrollLeft - 120) / pps)
  }

  const onRulerClick = (e: React.MouseEvent): void => onSeek(r2(xToTime(e.clientX)))

  const onPointerMove = (e: React.PointerEvent): void => {
    if (!drag.current) return
    const t = r2(Math.max(0, xToTime(e.clientX) - drag.current.offsetX))
    onMove(drag.current.track, drag.current.id, Math.round(t * 10) / 10)
  }
  const endDrag = (): void => { drag.current = null }

  const ticks: number[] = []
  const step = pps >= 80 ? 1 : pps >= 30 ? 5 : 10
  for (let t = 0; t <= total; t += step) ticks.push(t)

  const label = (assetId: string): string => {
    const a = assets.get(assetId)
    return a ? a.fileName.split('/').pop() ?? a.id : assetId
  }

  const renderFree = (track: 'voice' | 'music' | 'text', clips: Array<AudioClip | TextClip>, color: string): React.JSX.Element[] =>
    clips.map((c) => (
      <div
        key={c.id}
        className={`clip ${selection?.id === c.id ? 'selected' : ''}`}
        style={{ left: c.start * pps, width: Math.max(4, c.duration * pps), background: color }}
        onPointerDown={(e) => {
          onSelect({ track, id: c.id })
          drag.current = { track, id: c.id, offsetX: xToTime(e.clientX) - c.start }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        title={'text' in c ? c.text : label(c.assetId)}
      >
        <span>{'text' in c ? c.text : (c as AudioClip).label ?? label(c.assetId)}</span>
      </div>
    ))

  return (
    <div className="timeline" ref={scroller} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
      <div className="tl-inner" style={{ width: width + 120 }}>
        <div className="tl-ruler" onClick={onRulerClick}>
          <div className="tl-label" />
          <div className="tl-lane" style={{ width }}>
            {ticks.map((t) => <span key={t} className="tick" style={{ left: t * pps }}>{fmtTime(t)}</span>)}
          </div>
        </div>
        {TRACKS.map((tr) => (
          <div className="tl-track" key={tr.key} onClick={(e) => { if (e.target === e.currentTarget) onSelect(null) }}>
            <div className="tl-label">{tr.label}</div>
            <div className="tl-lane" style={{ width }} onDoubleClick={(e) => onSeek(r2(xToTime(e.clientX)))}>
              {tr.key === 'visual' && project.visual.map((c) => {
                const a = assets.get(c.assetId)
                return (
                  <div key={c.id} className={`clip visual ${selection?.id === c.id ? 'selected' : ''}`}
                    style={{ left: c.start * pps, width: Math.max(4, c.duration * pps), background: tr.color }}
                    onClick={() => onSelect({ track: 'visual', id: c.id })} title={label(c.assetId)}>
                    {a && a.kind === 'image' && <img src={window.api.library.mediaUrl(a)} alt="" />}
                    <span>{c.kind === 'image' ? '🖼' : '🎬'} {label(c.assetId)} · {c.duration.toFixed(1)}s</span>
                  </div>
                )
              })}
              {tr.key === 'voice' && renderFree('voice', project.voice, tr.color)}
              {tr.key === 'music' && renderFree('music', project.music, tr.color)}
              {tr.key === 'text' && renderFree('text', project.text, tr.color)}
            </div>
          </div>
        ))}
        <div className="playhead" style={{ left: 120 + time * pps }} />
      </div>
    </div>
  )
}
