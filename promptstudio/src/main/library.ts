import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import type { Asset, AssetKind, Generation, LibraryIndex } from '@shared/types'
import { getLibraryDir } from './settings'

let cache: LibraryIndex | null = null
let writing: Promise<void> = Promise.resolve()

const indexPath = async (): Promise<string> => join(await getLibraryDir(), 'library.json')

export async function loadIndex(): Promise<LibraryIndex> {
  if (cache) return cache
  try {
    cache = JSON.parse(await fs.readFile(await indexPath(), 'utf8')) as LibraryIndex
  } catch {
    cache = { assets: [], generations: [] }
  }
  return cache
}

async function saveIndex(): Promise<void> {
  const idx = await loadIndex()
  const p = await indexPath()
  writing = writing.then(() => fs.writeFile(p, JSON.stringify(idx, null, 2)))
  await writing
}

export function newId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16)
}

export async function addGeneration(g: Generation): Promise<void> {
  const idx = await loadIndex()
  idx.generations.unshift(g)
  await saveIndex()
}

export async function updateGeneration(id: string, patch: Partial<Generation>): Promise<void> {
  const idx = await loadIndex()
  const g = idx.generations.find((x) => x.id === id)
  if (g) Object.assign(g, patch)
  await saveIndex()
}

const extFor = (mime: string): string => {
  const m = mime.split(';')[0].trim()
  const table: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/opus': 'opus',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'text/plain': 'txt', 'text/markdown': 'md'
  }
  return table[m] ?? m.split('/')[1] ?? 'bin'
}

export async function saveAsset(opts: {
  kind: AssetKind
  bytes: Buffer
  mime: string
  generationId: string
  text?: string
}): Promise<Asset> {
  const dir = await getLibraryDir()
  const id = newId()
  const month = new Date().toISOString().slice(0, 7)
  const fileName = join(month, opts.kind, `${id}.${extFor(opts.mime)}`)
  const full = join(dir, fileName)
  await fs.mkdir(dirname(full), { recursive: true })
  await fs.writeFile(full, opts.bytes)
  const asset: Asset = {
    id,
    kind: opts.kind,
    fileName: fileName.split('\\').join('/'),
    mime: opts.mime.split(';')[0].trim(),
    bytes: opts.bytes.length,
    generationId: opts.generationId,
    createdAt: new Date().toISOString(),
    text: opts.text
  }
  const idx = await loadIndex()
  idx.assets.unshift(asset)
  await saveIndex()
  return asset
}

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl)
  if (!m) throw new Error('Unexpected image payload (not a data URL)')
  return { mime: m[1], bytes: Buffer.from(m[3], m[2] ? 'base64' : 'utf8') }
}

export async function deleteAsset(assetId: string): Promise<LibraryIndex> {
  const idx = await loadIndex()
  const a = idx.assets.find((x) => x.id === assetId)
  if (a) {
    await fs.rm(join(await getLibraryDir(), a.fileName), { force: true })
    idx.assets = idx.assets.filter((x) => x.id !== assetId)
    await saveIndex()
  }
  return idx
}

export async function assetPath(assetId: string): Promise<string | undefined> {
  const idx = await loadIndex()
  const a = idx.assets.find((x) => x.id === assetId)
  return a ? join(await getLibraryDir(), a.fileName) : undefined
}

export function resetCache(): void {
  cache = null
}

const mimeFromExt = (name: string): { mime: string; kind: AssetKind } | null => {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  const img: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }
  const vid: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska' }
  const aud: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/opus', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac' }
  if (img[ext]) return { mime: img[ext], kind: 'image' }
  if (vid[ext]) return { mime: vid[ext], kind: 'video' }
  if (aud[ext]) return { mime: aud[ext], kind: 'audio' }
  return null
}

/** Copy user files (video, audio, images) into the library so projects stay portable. */
export async function importFiles(paths: string[]): Promise<Asset[]> {
  const out: Asset[] = []
  for (const p of paths) {
    const info = mimeFromExt(p)
    if (!info) continue
    const genId = newId()
    await addGeneration({ id: genId, mode: 'text', model: 'import', prompt: p.split(/[\\/]/).pop() ?? p, params: { imported: true, source: p }, createdAt: new Date().toISOString(), costUsd: 0 })
    out.push(await saveAsset({ kind: info.kind, bytes: await fs.readFile(p), mime: info.mime, generationId: genId }))
  }
  return out
}
