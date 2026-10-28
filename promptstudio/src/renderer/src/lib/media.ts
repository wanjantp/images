import type { Asset } from '@shared/types'

const durations = new Map<string, number>()

/** Duration in seconds of a video/audio asset (via browser metadata). Images return 0. */
export async function assetDuration(a: Asset): Promise<number> {
  if (a.kind === 'image' || a.kind === 'text') return 0
  const hit = durations.get(a.id)
  if (hit !== undefined) return hit
  const d = await new Promise<number>((res) => {
    const el = document.createElement(a.kind === 'video' ? 'video' : 'audio')
    el.preload = 'metadata'
    el.onloadedmetadata = () => res(Number.isFinite(el.duration) ? el.duration : 0)
    el.onerror = () => res(0)
    el.src = window.api.library.mediaUrl(a)
  })
  durations.set(a.id, d)
  return d
}

export const fmtTime = (s: number): string => {
  const m = Math.floor(s / 60), sec = s - m * 60
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`
}
