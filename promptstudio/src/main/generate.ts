import type { ChatRequest, GenerateResult, Generation, ImageRequest, Mode, TTSRequest } from '@shared/types'
import * as or from './openrouter'
import { addGeneration, newId, parseDataUrl, saveAsset, updateGeneration } from './library'
import { getSettings } from './settings'

function startGeneration(mode: Mode, model: string, prompt: string, params: Record<string, unknown>): Generation {
  return { id: newId(), mode, model, prompt, params, createdAt: new Date().toISOString() }
}

async function finish(g: Generation, started: number, openrouterId?: string): Promise<void> {
  g.durationMs = Date.now() - started
  g.openrouterId = openrouterId
  if (openrouterId) g.costUsd = await or.getGenerationCost(openrouterId).catch(() => undefined)
  await updateGeneration(g.id, g)
}

export async function runChat(req: ChatRequest): Promise<GenerateResult> {
  const g = startGeneration('text', req.model, req.prompt, { system: req.system, temperature: req.temperature })
  await addGeneration(g)
  const t = Date.now()
  const msgs: or.ChatMessage[] = []
  if (req.system) msgs.push({ role: 'system', content: req.system })
  msgs.push({ role: 'user', content: req.prompt })
  const out = await or.chat(req.model, msgs, { temperature: req.temperature })
  const asset = await saveAsset({ kind: 'text', bytes: Buffer.from(out.text, 'utf8'), mime: 'text/markdown', generationId: g.id, text: out.text })
  await finish(g, t, out.id)
  return { generation: g, assets: [asset] }
}

const ENHANCE_SYSTEM: Record<Mode, string> = {
  text: 'You improve prompts for a large language model. Rewrite the user prompt to be clear, specific and well structured. Keep the original language. Return only the improved prompt.',
  image: 'You are an expert prompt writer for AI image generators. Expand the idea into one detailed prompt: subject, setting, composition, lighting, camera/lens, style, mood, colour palette. Keep it under 120 words. Return only the prompt in English.',
  voice: 'You are a script editor for text-to-speech narration. Rewrite the text so it reads naturally aloud: short sentences, clear punctuation, expand abbreviations and numbers. Keep the original language and meaning. Return only the script.',
  video: 'You are an expert prompt writer for AI video generators. Expand the idea into one detailed shot description: subject and action, setting, camera movement, lighting, style, mood, duration pacing. Keep it under 100 words. Return only the prompt in English.'
}

export async function enhancePrompt(prompt: string, mode: Mode): Promise<string> {
  const s = await getSettings()
  const out = await or.chat(s.enhancerModel, [
    { role: 'system', content: ENHANCE_SYSTEM[mode] },
    { role: 'user', content: prompt }
  ], { temperature: 0.7 })
  return out.text.trim()
}

export async function runImage(req: ImageRequest): Promise<GenerateResult> {
  const g = startGeneration('image', req.model, req.prompt, {
    count: req.count, aspectRatio: req.aspectRatio, references: req.referenceImages?.length ?? 0
  })
  await addGeneration(g)
  const t = Date.now()
  const assets: GenerateResult['assets'] = []
  let lastId: string | undefined
  const count = Math.max(1, Math.min(8, req.count || 1))
  // One request per image: most image models return a single image per call.
  const runs = await Promise.allSettled(
    Array.from({ length: count }, () => or.generateImage(req.model, req.prompt, { aspectRatio: req.aspectRatio, referenceImages: req.referenceImages }))
  )
  const errors: string[] = []
  for (const r of runs) {
    if (r.status === 'rejected') { errors.push(String(r.reason?.message ?? r.reason)); continue }
    lastId = r.value.id ?? lastId
    for (const img of r.value.images) {
      const { mime, bytes } = parseDataUrl(img.dataUrl)
      assets.push(await saveAsset({ kind: 'image', bytes, mime, generationId: g.id }))
    }
    if (r.value.images.length === 0 && r.value.text) errors.push(`Model returned text instead of an image: ${r.value.text.slice(0, 200)}`)
  }
  await finish(g, t, lastId)
  if (assets.length === 0) throw new Error(errors[0] ?? 'No image returned')
  return { generation: g, assets }
}

/** Split long text into chunks under maxChars at sentence boundaries. */
export function chunkText(text: string, maxChars = 3500): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?。])\s+/)
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + ' ' + s).trim().length > maxChars && cur) { chunks.push(cur.trim()); cur = s }
    else cur = (cur + ' ' + s).trim()
  }
  if (cur) chunks.push(cur)
  return chunks.length ? chunks : [text]
}

export async function runTTS(req: TTSRequest): Promise<GenerateResult> {
  const g = startGeneration('voice', req.model, req.input, {
    voice: req.voice, format: req.format, speed: req.speed, instructions: req.instructions
  })
  await addGeneration(g)
  const t = Date.now()
  const chunks = chunkText(req.input)
  const assets: GenerateResult['assets'] = []
  let lastId: string | undefined
  for (const chunk of chunks) {
    const out = await or.tts({ ...req, input: chunk })
    lastId = out.id ?? lastId
    assets.push(await saveAsset({ kind: 'audio', bytes: out.bytes, mime: out.mime, generationId: g.id, text: chunk }))
  }
  await finish(g, t, lastId)
  return { generation: g, assets }
}
