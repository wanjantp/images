import React, { useEffect, useMemo, useRef } from 'react'
import type { EditorProject } from '@shared/timeline'
import type { Asset } from '@shared/types'
import { renderTextPng } from '../../lib/textRender'

interface Props { project: EditorProject; time: number; playing: boolean; assets: Map<string, Asset> }

/**
 * Live preview: shows the active main-track clip, text overlays (same PNGs as export) and plays audio tracks.
 * Media elements are seeked to (time - clip.start + trimStart) and started/stopped with the transport.
 */
export default function Preview({ project, time, playing, assets }: Props): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const active = project.visual.find((c) => time >= c.start && time < c.start + c.duration)
  const activeAsset = active ? assets.get(active.assetId) : undefined
  const W = project.width, H = project.height
  const pw = Math.min(W, 1280), ph = Math.round(pw * H / W)

  const overlays = useMemo(
    () => project.text.filter((t) => time >= t.start && time < t.start + t.duration).map((t) => ({ id: t.id, src: renderTextPng(t, pw, ph) })),
    [project.text, time, pw, ph]
  )

  // Sync the main video element
  useEffect(() => {
    const v = videoRef.current
    if (!v || !active || active.kind !== 'video') return
    const target = active.trimStart + (time - active.start)
    if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target
    v.muted = active.mute
    v.volume = Math.min(1, active.volume)
    if (playing && v.paused) v.play().catch(() => undefined)
    if (!playing && !v.paused) v.pause()
  }, [active, time, playing])

  // Sync free audio tracks
  useEffect(() => {
    for (const c of [...project.voice, ...project.music]) {
      const el = audioRefs.current.get(c.id)
      if (!el) continue
      const inside = time >= c.start && time < c.start + c.duration
      if (!inside) { if (!el.paused) el.pause(); continue }
      const target = c.trimStart + (time - c.start)
      if (Math.abs(el.currentTime - target) > 0.3) el.currentTime = target
      let gain = c.volume
      if (c.fadeIn > 0 && time - c.start < c.fadeIn) gain *= (time - c.start) / c.fadeIn
      if (c.fadeOut > 0 && c.start + c.duration - time < c.fadeOut) gain *= (c.start + c.duration - time) / c.fadeOut
      el.volume = Math.max(0, Math.min(1, gain))
      if (playing && el.paused) el.play().catch(() => undefined)
      if (!playing && !el.paused) el.pause()
    }
  }, [project.voice, project.music, time, playing])

  let opacity = 1
  if (active) {
    const local = time - active.start
    if (active.fadeIn > 0 && local < active.fadeIn) opacity = local / active.fadeIn
    if (active.fadeOut > 0 && active.duration - local < active.fadeOut) opacity = Math.min(opacity, (active.duration - local) / active.fadeOut)
  }
  const kb = active?.kind === 'image' && active.kenBurns ? 1 + 0.2 * ((time - active.start) / active.duration) : 1

  return (
    <div className="preview" style={{ aspectRatio: `${W} / ${H}` }}>
      {active && activeAsset && active.kind === 'video' && (
        <video ref={videoRef} key={active.id} src={window.api.library.mediaUrl(activeAsset)} style={{ opacity }} />
      )}
      {active && activeAsset && active.kind === 'image' && (
        <img src={window.api.library.mediaUrl(activeAsset)} alt="" style={{ opacity, transform: `scale(${kb})` }} />
      )}
      {!active && <div className="preview-empty">{project.visual.length ? '' : 'Add video or image clips to the main track'}</div>}
      {overlays.map((o) => <img key={o.id} className="overlay" src={o.src} alt="" />)}
      {[...project.voice, ...project.music].map((c) => {
        const a = assets.get(c.assetId)
        return a ? <audio key={c.id} ref={(el) => { if (el) audioRefs.current.set(c.id, el); else audioRefs.current.delete(c.id) }} src={window.api.library.mediaUrl(a)} preload="auto" /> : null
      })}
    </div>
  )
}
