/**
 * Pure FFmpeg argument builder for an EditorProject (no Electron imports, unit-testable).
 *
 * Graph outline:
 *   each visual clip  -> trim/scale/pad/fade (zoompan for Ken Burns) -> [vN]
 *   concat [v0..vN]   -> overlays (one PNG per text clip, enable=between) -> [vout]
 *   each visual clip audio (or silence) -> concat -> [acat]
 *   voice/music clips -> atrim/volume/afade/adelay -> amix with [acat] -> [aout]
 */
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ExportRequest, VisualClip, AudioClip } from '@shared/timeline'
import { projectDuration } from '@shared/timeline'

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl)
  if (!m) throw new Error('Unexpected payload (not a data URL)')
  return { mime: m[1], bytes: Buffer.from(m[3], m[2] ? 'base64' : 'utf8') }
}

const f = (n: number): string => (Math.round(n * 1000) / 1000).toString()

function visualFilter(idx: number, c: VisualClip, W: number, H: number, fps: number): string {
  const d = c.duration
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1`
  const fades = [c.fadeIn > 0 ? `fade=t=in:st=0:d=${f(c.fadeIn)}` : '', c.fadeOut > 0 ? `fade=t=out:st=${f(Math.max(0, d - c.fadeOut))}:d=${f(c.fadeOut)}` : ''].filter(Boolean)
  let chain: string[]
  if (c.kind === 'video') {
    chain = [`trim=start=${f(c.trimStart)}:duration=${f(d)}`, 'setpts=PTS-STARTPTS', fit, `fps=${fps}`]
  } else if (c.kenBurns) {
    const frames = Math.max(1, Math.round(d * fps))
    // Upscale first so zoompan has pixels to work with, then slow zoom to 1.2x around the centre.
    chain = [
      `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}`,
      `zoompan=z='1+0.2*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps}`,
      `trim=duration=${f(d)}`, 'setpts=PTS-STARTPTS', 'setsar=1'
    ]
  } else {
    chain = [fit, `fps=${fps}`, `trim=duration=${f(d)}`, 'setpts=PTS-STARTPTS']
  }
  return `[${idx}:v]${[...chain, ...fades, 'format=yuv420p'].join(',')}[v${idx}]`
}

const AFMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'

function audioFromVisual(idx: number, c: VisualClip, hasAudio: boolean): string {
  const d = c.duration
  if (c.kind !== 'video' || c.mute || !hasAudio) {
    return `anullsrc=r=48000:cl=stereo,atrim=duration=${f(d)},asetpts=PTS-STARTPTS[a${idx}]`
  }
  const parts = [`atrim=start=${f(c.trimStart)}:duration=${f(d)}`, 'asetpts=PTS-STARTPTS', AFMT, `volume=${f(c.volume)}`]
  if (c.fadeIn > 0) parts.push(`afade=t=in:st=0:d=${f(c.fadeIn)}`)
  if (c.fadeOut > 0) parts.push(`afade=t=out:st=${f(Math.max(0, d - c.fadeOut))}:d=${f(c.fadeOut)}`)
  // apad guarantees the clip's audio is exactly as long as its video even if the source audio is shorter.
  parts.push(`apad=whole_dur=${f(d)}`, `atrim=duration=${f(d)}`)
  return `[${idx}:a]${parts.join(',')}[a${idx}]`
}

function freeAudio(idx: number, c: AudioClip, label: string): string {
  const d = c.duration
  const parts = [`atrim=start=${f(c.trimStart)}:duration=${f(d)}`, 'asetpts=PTS-STARTPTS', AFMT, `volume=${f(c.volume)}`]
  if (c.fadeIn > 0) parts.push(`afade=t=in:st=0:d=${f(c.fadeIn)}`)
  if (c.fadeOut > 0) parts.push(`afade=t=out:st=${f(Math.max(0, d - c.fadeOut))}:d=${f(c.fadeOut)}`)
  const ms = Math.round(c.start * 1000)
  parts.push(`adelay=${ms}|${ms}`)
  return `[${idx}:a]${parts.join(',')}[${label}]`
}

/** Probe whether a file has an audio stream (via ffmpeg -i, no ffprobe dependency). */
async function hasAudioStream(file: string, ffmpeg: string): Promise<boolean> {
  return new Promise((done) => {
    const p = spawn(ffmpeg, ['-hide_banner', '-i', file], { windowsHide: true })
    let err = ''
    p.stderr.on('data', (d) => { err += d.toString() })
    p.on('close', () => done(/Stream #\d+:\d+.*Audio:/.test(err)))
    p.on('error', () => done(false))
  })
}

export async function buildArgs(req: ExportRequest, tmpDir: string, resolve: (assetId: string) => Promise<string | undefined>, ffmpeg: string): Promise<{ args: string[]; total: number }> {
  const { project: p, width: W, height: H, fps } = req
  const total = projectDuration(p)
  if (total <= 0) throw new Error('The timeline is empty')
  if (p.visual.length === 0) throw new Error('Add at least one video or image clip to the main track')

  const inputs: string[] = []
  const filters: string[] = []
  let n = 0

  // Visual inputs
  const visIdx: number[] = []
  const visHasAudio: boolean[] = []
  for (const c of p.visual) {
    const file = await resolve(c.assetId)
    if (!file) throw new Error(`Missing media for clip ${c.id}`)
    if (c.kind === 'image') inputs.push('-loop', '1', '-framerate', String(fps), '-t', f(c.duration + 1), '-i', file)
    else inputs.push('-i', file)
    visIdx.push(n)
    visHasAudio.push(c.kind === 'video' && !c.mute ? await hasAudioStream(file, ffmpeg) : false)
    n++
  }
  p.visual.forEach((c, i) => { filters.push(visualFilter(visIdx[i], c, W, H, fps)); filters.push(audioFromVisual(visIdx[i], c, visHasAudio[i])) })
  filters.push(`${visIdx.map((i) => `[v${i}]`).join('')}concat=n=${p.visual.length}:v=1:a=0[vcat]`)
  filters.push(`${visIdx.map((i) => `[a${i}]`).join('')}concat=n=${p.visual.length}:v=0:a=1[acat]`)

  // Text overlays (pre-rendered PNGs from the UI)
  let vlabel = 'vcat'
  let k = 0
  for (const t of p.text) {
    const png = req.textOverlays[t.id]
    if (!png) continue
    const file = join(tmpDir, `text-${k}.png`)
    await fs.writeFile(file, parseDataUrl(png).bytes)
    inputs.push('-i', file)
    const out = `vo${k}`
    filters.push(`[${vlabel}][${n}:v]overlay=0:0:format=auto:enable='between(t,${f(t.start)},${f(t.start + t.duration)})'[${out}]`)
    vlabel = out
    n++
    k++
  }
  // Pad the picture with black if audio runs longer than the main track.
  filters.push(`[${vlabel}]tpad=stop_mode=clone:stop_duration=${f(Math.max(0, total - p.visual.reduce((s, c) => s + c.duration, 0)))},trim=duration=${f(total)}[vout]`)

  // Free audio tracks
  const mixLabels = ['acat']
  for (const c of [...p.voice, ...p.music]) {
    const file = await resolve(c.assetId)
    if (!file) throw new Error(`Missing media for audio clip ${c.id}`)
    inputs.push('-i', file)
    const label = `fa${n}`
    filters.push(freeAudio(n, c, label))
    mixLabels.push(label)
    n++
  }
  if (mixLabels.length > 1) {
    filters.push(`${mixLabels.map((l) => `[${l}]`).join('')}amix=inputs=${mixLabels.length}:duration=longest:normalize=0,atrim=duration=${f(total)}[aout]`)
  } else {
    filters.push(`[acat]apad=whole_dur=${f(total)},atrim=duration=${f(total)}[aout]`)
  }

  const args = [
    '-hide_banner', '-y', ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(req.crf ?? 20), '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', f(total),
    req.outputPath
  ]
  return { args, total }
}

