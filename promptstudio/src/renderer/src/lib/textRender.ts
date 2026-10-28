import type { TextClip } from '@shared/timeline'

const cache = new Map<string, string>()

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let cur = ''
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w
      if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w } else cur = test
    }
    lines.push(cur)
  }
  return lines
}

/** Rasterise a caption/title to a transparent PNG at the output size. Used for preview and export (WYSIWYG). */
export function renderTextPng(clip: TextClip, W: number, H: number): string {
  const key = JSON.stringify([clip.text, clip.style, W, H])
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  const s = clip.style
  const scale = H / 1080 // style sizes are authored for 1080p height
  const fontSize = Math.round(s.fontSize * scale)
  ctx.font = `${s.bold ? 'bold ' : ''}${fontSize}px ${s.fontFamily}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const padX = fontSize * 0.5, padY = fontSize * 0.3, lineH = fontSize * 1.25
  const lines = wrap(ctx, clip.text, W * 0.86)
  const boxW = Math.min(W * 0.9, Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2)
  const boxH = lines.length * lineH + padY * 2
  const margin = H * 0.06
  const top = s.position === 'top' ? margin : s.position === 'center' ? (H - boxH) / 2 : H - margin - boxH
  if (s.background && s.background !== 'transparent') {
    ctx.fillStyle = s.background
    const x = (W - boxW) / 2, r = fontSize * 0.25
    ctx.beginPath(); ctx.roundRect(x, top, boxW, boxH, r); ctx.fill()
  }
  ctx.fillStyle = s.color
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = fontSize * 0.08
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + padY + lineH * (i + 0.5)))
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  if (cache.size > 200) cache.delete(cache.keys().next().value!)
  return url
}
