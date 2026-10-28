import type { ORModel, Mode } from './types'

/** Parse an OpenRouter price string (USD per unit) into a number. */
export function price(v: string | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function modalities(m: ORModel): string[] {
  return (m.architecture?.output_modalities ?? ['text']).map((s) => s.toLowerCase())
}

/** Music generators are audio-output models whose id/name says so (Lyria, Suno-style, ACE-Step, Stable Audio…). */
export const MUSIC_RE = /lyria|music|song|suno|udio|ace-?step|stable-?audio|riffusion|jukebox|melody/i
export const isMusicModel = (m: ORModel): boolean => MUSIC_RE.test(m.id) || MUSIC_RE.test(m.name)

export function supportsMode(m: ORModel, mode: Mode): boolean {
  const out = modalities(m)
  switch (mode) {
    case 'text':
      return out.includes('text') && !out.includes('image') && !out.includes('video')
    case 'image':
      return out.includes('image')
    case 'voice':
      return (out.includes('audio') || out.includes('speech')) && !isMusicModel(m)
    case 'music':
      return out.includes('audio') && isMusicModel(m)
    case 'video':
      return out.includes('video')
  }
}

/** Rough token estimate for cost preview (about 4 chars per token). */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

/**
 * Pre-flight cost estimate. OpenRouter pricing keys differ by modality, so
 * this is a best-effort number; the real cost is fetched from
 * GET /api/v1/generation after each run.
 */
export function estimateCost(
  m: ORModel | undefined,
  mode: Mode,
  opts: { prompt: string; count?: number; durationSec?: number }
): { usd: number; note: string } {
  if (!m) return { usd: 0, note: 'select a model' }
  const p = m.pricing
  const inTok = estimateTokens(opts.prompt)
  switch (mode) {
    case 'text': {
      const usd = inTok * price(p.prompt) + 800 * price(p.completion)
      return { usd, note: `≈${inTok} in + ~800 out tokens` }
    }
    case 'image': {
      const perImage = price(p.image)
      const usd = inTok * price(p.prompt) + (opts.count ?? 1) * perImage
      return { usd, note: perImage ? `${opts.count ?? 1} × $${perImage.toFixed(4)}/image` : 'per-image price not listed; actual cost shown after run' }
    }
    case 'voice': {
      // TTS models are priced per input character; OpenRouter exposes it under pricing.prompt for most.
      const perChar = price(p.prompt)
      return { usd: opts.prompt.length * perChar, note: `${opts.prompt.length} chars` }
    }
    case 'music': {
      const perReq = price(p.request)
      return { usd: perReq, note: perReq ? 'per song / clip' : 'billed per song or clip (Lyria: $0.04 per 30 s clip, $0.08 per song); actual cost shown after run' }
    }
    case 'video': {
      const perSec = price(p.video ?? p.completion)
      const usd = (opts.durationSec ?? 5) * perSec
      return { usd, note: perSec ? `${opts.durationSec ?? 5}s × $${perSec.toFixed(4)}/s` : 'per-second price not listed; actual cost shown after run' }
    }
  }
}

export const fmtUsd = (n: number | undefined): string =>
  n === undefined ? '–' : n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(3)}`
