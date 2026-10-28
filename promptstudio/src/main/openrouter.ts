/**
 * OpenRouter adapter. One API key, four modalities.
 * Endpoint shapes follow OpenRouter's public docs (Oct 2026). The video
 * endpoint is newer and its response fields are read defensively; verify
 * against https://openrouter.ai/docs when upgrading.
 */
import type { ORModel, Credits } from '@shared/types'
import { getApiKey } from './settings'

const BASE = 'https://openrouter.ai/api/v1'
const APP_HEADERS = { 'HTTP-Referer': 'https://github.com/wanjantp/images', 'X-Title': 'PromptStudio' }

async function headers(json = true): Promise<Record<string, string>> {
  const key = await getApiKey()
  return { Authorization: `Bearer ${key}`, ...(json ? { 'Content-Type': 'application/json' } : {}), ...APP_HEADERS }
}

async function fail(r: Response): Promise<never> {
  let detail = ''
  try {
    const j = (await r.json()) as { error?: { message?: string } }
    detail = j.error?.message ?? JSON.stringify(j)
  } catch {
    detail = await r.text().catch(() => '')
  }
  throw new Error(`OpenRouter ${r.status}: ${detail || r.statusText}`)
}

// ---------- catalog & account ----------

export async function listModels(): Promise<ORModel[]> {
  const r = await fetch(`${BASE}/models`, { headers: await headers(false) })
  if (!r.ok) return fail(r)
  const j = (await r.json()) as { data: ORModel[] }
  return j.data
}

export async function getCredits(): Promise<Credits> {
  const r = await fetch(`${BASE}/credits`, { headers: await headers(false) })
  if (!r.ok) return fail(r)
  const j = (await r.json()) as { data: Credits }
  return j.data
}

/** Actual cost of a finished generation (may take a second to become available). */
export async function getGenerationCost(id: string): Promise<number | undefined> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${BASE}/generation?id=${encodeURIComponent(id)}`, { headers: await headers(false) })
    if (r.ok) {
      const j = (await r.json()) as { data?: { total_cost?: number } }
      if (typeof j.data?.total_cost === 'number') return j.data.total_cost
    }
    await new Promise((res) => setTimeout(res, 800 * (attempt + 1)))
  }
  return undefined
}

// ---------- text ----------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
}

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number } = {}
): Promise<{ text: string; id?: string }> {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ model, messages, ...opts })
  })
  if (!r.ok) return fail(r)
  const j = (await r.json()) as { id?: string; choices: Array<{ message: { content: string } }> }
  return { text: j.choices?.[0]?.message?.content ?? '', id: j.id }
}

// ---------- image ----------

export interface ImageOut {
  dataUrl: string
}

export async function generateImage(
  model: string,
  prompt: string,
  opts: { aspectRatio?: string; referenceImages?: string[] } = {}
): Promise<{ images: ImageOut[]; text: string; id?: string }> {
  const content: ChatMessage['content'] = [{ type: 'text', text: prompt }]
  for (const url of opts.referenceImages ?? []) content.push({ type: 'image_url', image_url: { url } })
  const body: Record<string, unknown> = {
    model,
    modalities: ['image', 'text'],
    messages: [{ role: 'user', content }]
  }
  if (opts.aspectRatio) body.image_config = { aspect_ratio: opts.aspectRatio }
  const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: await headers(), body: JSON.stringify(body) })
  if (!r.ok) return fail(r)
  const j = (await r.json()) as {
    id?: string
    choices: Array<{ message: { content?: string; images?: Array<{ image_url: { url: string } }> } }>
  }
  const msg = j.choices?.[0]?.message
  const images = (msg?.images ?? []).map((i) => ({ dataUrl: i.image_url.url }))
  return { images, text: msg?.content ?? '', id: j.id }
}

// ---------- speech ----------

export async function tts(req: {
  model: string
  input: string
  voice: string
  format: string
  speed?: number
  instructions?: string
}): Promise<{ bytes: Buffer; mime: string; id?: string }> {
  const r = await fetch(`${BASE}/audio/speech`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({
      model: req.model,
      input: req.input,
      voice: req.voice,
      response_format: req.format,
      ...(req.speed ? { speed: req.speed } : {}),
      ...(req.instructions ? { instructions: req.instructions } : {})
    })
  })
  if (!r.ok) return fail(r)
  const mime = r.headers.get('content-type') ?? (req.format === 'wav' ? 'audio/wav' : 'audio/mpeg')
  const id = r.headers.get('x-openrouter-generation-id') ?? undefined
  return { bytes: Buffer.from(await r.arrayBuffer()), mime, id }
}

// ---------- video (async) ----------

export interface VideoJobState {
  remoteId: string
  status: 'queued' | 'running' | 'done' | 'failed'
  url?: string
  error?: string
  progress?: number
}

function readVideoState(j: Record<string, unknown>): Omit<VideoJobState, 'remoteId'> {
  const raw = String((j.status ?? j.state ?? 'running') as string).toLowerCase()
  const pick = (...paths: string[][]): string | undefined => {
    for (const p of paths) {
      let cur: unknown = j
      for (const k of p) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[k] : undefined
      if (typeof cur === 'string' && cur) return cur
    }
    return undefined
  }
  const url = pick(['url'], ['video_url'], ['output', 'url'], ['video', 'url'], ['result', 'url'], ['data', '0', 'url'], ['outputs', '0', 'url'])
  if (['completed', 'succeeded', 'success', 'done', 'finished'].includes(raw) || (url && raw !== 'failed')) {
    return { status: 'done', url }
  }
  if (['failed', 'error', 'cancelled', 'canceled'].includes(raw)) {
    const err = j.error
    return { status: 'failed', error: typeof err === 'string' ? err : (err as { message?: string })?.message ?? raw }
  }
  if (['queued', 'pending', 'submitted'].includes(raw)) return { status: 'queued' }
  const progress = typeof j.progress === 'number' ? j.progress : undefined
  return { status: 'running', progress }
}

export async function videoSubmit(req: {
  model: string
  prompt: string
  aspectRatio?: string
  durationSec?: number
  resolution?: string
  image?: string
}): Promise<VideoJobState> {
  const body: Record<string, unknown> = { model: req.model, prompt: req.prompt }
  if (req.aspectRatio) body.aspect_ratio = req.aspectRatio
  if (req.durationSec) body.duration = req.durationSec
  if (req.resolution) body.resolution = req.resolution
  if (req.image) body.image = req.image
  const r = await fetch(`${BASE}/videos`, { method: 'POST', headers: await headers(), body: JSON.stringify(body) })
  if (!r.ok) return fail(r)
  const j = (await r.json()) as Record<string, unknown>
  const remoteId = String(j.id ?? j.job_id ?? j.task_id ?? '')
  if (!remoteId) throw new Error(`Video job accepted but no id in response: ${JSON.stringify(j).slice(0, 300)}`)
  return { remoteId, ...readVideoState(j) }
}

export async function videoStatus(remoteId: string): Promise<VideoJobState> {
  const r = await fetch(`${BASE}/videos/${encodeURIComponent(remoteId)}`, { headers: await headers(false) })
  if (!r.ok) return fail(r)
  const j = (await r.json()) as Record<string, unknown>
  return { remoteId, ...readVideoState(j) }
}

export async function download(url: string): Promise<{ bytes: Buffer; mime: string }> {
  const r = await fetch(url, { headers: url.startsWith(BASE) ? await headers(false) : {} })
  if (!r.ok) return fail(r)
  return { bytes: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') ?? 'video/mp4' }
}
