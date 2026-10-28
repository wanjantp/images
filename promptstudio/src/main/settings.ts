import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { Settings } from '@shared/types'

interface StoredSettings {
  libraryDir: string
  defaultModels: Settings['defaultModels']
  enhancerModel: string
  apiKeyEnc?: string // base64 of safeStorage ciphertext (DPAPI on Windows)
  apiKeyPlain?: string // only used when OS encryption is unavailable
}

const file = (): string => join(app.getPath('userData'), 'settings.json')

let cache: StoredSettings | null = null

async function load(): Promise<StoredSettings> {
  if (cache) return cache
  try {
    cache = JSON.parse(await fs.readFile(file(), 'utf8')) as StoredSettings
  } catch {
    cache = {
      libraryDir: join(app.getPath('documents'), 'PromptStudio'),
      defaultModels: {},
      enhancerModel: 'openai/gpt-4o-mini'
    }
  }
  return cache
}

async function save(): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(file(), JSON.stringify(cache, null, 2))
}

export async function getSettings(): Promise<Settings> {
  const s = await load()
  return {
    libraryDir: s.libraryDir,
    defaultModels: s.defaultModels,
    enhancerModel: s.enhancerModel,
    hasApiKey: Boolean(s.apiKeyEnc || s.apiKeyPlain),
    encryptionAvailable: safeStorage.isEncryptionAvailable()
  }
}

export async function patchSettings(
  patch: Partial<Pick<Settings, 'libraryDir' | 'defaultModels' | 'enhancerModel'>>
): Promise<Settings> {
  const s = await load()
  if (patch.libraryDir) s.libraryDir = patch.libraryDir
  if (patch.enhancerModel) s.enhancerModel = patch.enhancerModel
  if (patch.defaultModels) s.defaultModels = { ...s.defaultModels, ...patch.defaultModels }
  await save()
  return getSettings()
}

export async function setApiKey(key: string): Promise<Settings> {
  const s = await load()
  const trimmed = key.trim()
  if (safeStorage.isEncryptionAvailable()) {
    s.apiKeyEnc = safeStorage.encryptString(trimmed).toString('base64')
    delete s.apiKeyPlain
  } else {
    s.apiKeyPlain = trimmed
    delete s.apiKeyEnc
  }
  await save()
  return getSettings()
}

export async function clearApiKey(): Promise<Settings> {
  const s = await load()
  delete s.apiKeyEnc
  delete s.apiKeyPlain
  await save()
  return getSettings()
}

export async function getApiKey(): Promise<string> {
  const s = await load()
  if (s.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(s.apiKeyEnc, 'base64'))
  }
  if (s.apiKeyPlain) return s.apiKeyPlain
  throw new Error('No OpenRouter API key set. Add one in Settings.')
}

export async function getLibraryDir(): Promise<string> {
  const s = await load()
  await fs.mkdir(s.libraryDir, { recursive: true })
  return s.libraryDir
}
