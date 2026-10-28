// Timeline / editor data model shared by renderer and main.

export interface VisualClip {
  id: string
  kind: 'video' | 'image'
  assetId: string
  /** Seconds on the timeline (derived from order on the main track). */
  start: number
  duration: number
  /** Offset into the source file, seconds (video only). */
  trimStart: number
  sourceDuration?: number
  fadeIn: number
  fadeOut: number
  kenBurns: boolean
  mute: boolean
  volume: number
}

export interface AudioClip {
  id: string
  assetId: string
  start: number
  duration: number
  trimStart: number
  sourceDuration?: number
  volume: number
  fadeIn: number
  fadeOut: number
  label?: string
}

export interface TextStyle {
  fontSize: number
  color: string
  background: string
  fontFamily: string
  bold: boolean
  position: 'top' | 'center' | 'bottom'
}

export interface TextClip {
  id: string
  text: string
  start: number
  duration: number
  style: TextStyle
}

export interface EditorProject {
  id: string
  name: string
  width: number
  height: number
  fps: number
  visual: VisualClip[]
  voice: AudioClip[]
  music: AudioClip[]
  text: TextClip[]
  updatedAt: string
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 56, color: '#ffffff', background: 'rgba(0,0,0,0.55)', fontFamily: 'Segoe UI, Arial, sans-serif', bold: true, position: 'bottom'
}

export const EXPORT_PRESETS: Array<{ id: string; label: string; width: number; height: number; fps: number }> = [
  { id: 'yt1080', label: 'YouTube 1080p (16:9)', width: 1920, height: 1080, fps: 30 },
  { id: 'yt720', label: 'YouTube 720p (16:9)', width: 1280, height: 720, fps: 30 },
  { id: 'shorts', label: 'TikTok / Reels / Shorts (9:16)', width: 1080, height: 1920, fps: 30 },
  { id: 'square', label: 'Instagram square (1:1)', width: 1080, height: 1080, fps: 30 },
  { id: 'yt4k', label: 'YouTube 4K (16:9)', width: 3840, height: 2160, fps: 30 }
]

export function newProject(id: string, name = 'Untitled'): EditorProject {
  return { id, name, width: 1920, height: 1080, fps: 30, visual: [], voice: [], music: [], text: [], updatedAt: new Date().toISOString() }
}

/** Recompute sequential start times on the main visual track. */
export function layoutVisual(clips: VisualClip[]): VisualClip[] {
  let t = 0
  return clips.map((c) => { const out = { ...c, start: t }; t += c.duration; return out })
}

export function projectDuration(p: EditorProject): number {
  const ends = [
    ...p.visual.map((c) => c.start + c.duration),
    ...p.voice.map((c) => c.start + c.duration),
    ...p.music.map((c) => c.start + c.duration),
    ...p.text.map((c) => c.start + c.duration)
  ]
  return ends.length ? Math.max(...ends) : 0
}

export const r2 = (n: number): number => Math.round(n * 100) / 100

export interface ExportRequest {
  project: EditorProject
  width: number
  height: number
  fps: number
  outputPath: string
  /** PNG data URLs rendered by the UI for each text clip, keyed by clip id. */
  textOverlays: Record<string, string>
  crf?: number
}

export interface ExportProgress {
  phase: 'preparing' | 'encoding' | 'done' | 'failed' | 'cancelled'
  percent: number
  message?: string
  outputPath?: string
}
