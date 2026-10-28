// Types shared by main, preload and renderer.

export type Mode = 'text' | 'image' | 'voice' | 'video'

export interface Settings {
  libraryDir: string
  defaultModels: Partial<Record<Mode, string>>
  enhancerModel: string
  hasApiKey: boolean
  encryptionAvailable: boolean
}

export interface ORPricing {
  prompt?: string
  completion?: string
  image?: string
  request?: string
  audio?: string
  [key: string]: string | undefined
}

export interface ORModel {
  id: string
  name: string
  description?: string
  context_length?: number
  pricing: ORPricing
  architecture?: {
    modality?: string
    input_modalities?: string[]
    output_modalities?: string[]
  }
}

export interface Credits {
  total_credits: number
  total_usage: number
}

export interface ChatRequest {
  model: string
  prompt: string
  system?: string
  temperature?: number
}

export interface ChatResult {
  text: string
  generationId?: string
}

export interface ImageRequest {
  model: string
  prompt: string
  count: number
  aspectRatio?: string
  referenceImages?: string[] // data URLs
}

export interface TTSRequest {
  model: string
  input: string
  voice: string
  format: 'mp3' | 'wav' | 'opus'
  speed?: number
  instructions?: string
}

export interface VideoRequest {
  model: string
  prompt: string
  aspectRatio?: string
  durationSec?: number
  resolution?: string
  image?: string // data URL for image-to-video
}

export type AssetKind = 'image' | 'audio' | 'video' | 'text'

export interface Generation {
  id: string
  mode: Mode
  model: string
  prompt: string
  params: Record<string, unknown>
  createdAt: string
  openrouterId?: string
  costUsd?: number
  durationMs?: number
}

export interface Asset {
  id: string
  kind: AssetKind
  fileName: string // relative to libraryDir
  mime: string
  bytes: number
  generationId: string
  createdAt: string
  text?: string // for text results
}

export interface LibraryIndex {
  assets: Asset[]
  generations: Generation[]
}

export type JobStatus = 'queued' | 'running' | 'polling' | 'done' | 'failed' | 'cancelled'

export interface Job {
  id: string
  mode: Mode
  model: string
  prompt: string
  status: JobStatus
  remoteId?: string
  progress?: number
  error?: string
  assetIds: string[]
  generationId?: string
  createdAt: string
  updatedAt: string
}

export interface GenerateResult {
  generation: Generation
  assets: Asset[]
}

export interface Api {
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Pick<Settings, 'libraryDir' | 'defaultModels' | 'enhancerModel'>>): Promise<Settings>
    setApiKey(key: string): Promise<Settings>
    clearApiKey(): Promise<Settings>
    chooseLibraryDir(): Promise<Settings>
  }
  openrouter: {
    models(force?: boolean): Promise<ORModel[]>
    credits(): Promise<Credits>
    chat(req: ChatRequest): Promise<GenerateResult>
    enhance(prompt: string, mode: Mode): Promise<string>
    image(req: ImageRequest): Promise<GenerateResult>
    tts(req: TTSRequest): Promise<GenerateResult>
    videoSubmit(req: VideoRequest): Promise<Job>
  }
  library: {
    list(): Promise<LibraryIndex>
    delete(assetId: string): Promise<LibraryIndex>
    openFolder(): Promise<void>
    reveal(assetId: string): Promise<void>
    mediaUrl(asset: Asset): string
  }
  jobs: {
    list(): Promise<Job[]>
    cancel(id: string): Promise<Job[]>
    onUpdate(cb: (jobs: Job[]) => void): () => void
  }
}
