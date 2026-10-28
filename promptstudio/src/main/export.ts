/** Runs an EditorProject export with FFmpeg and streams progress to the renderer. */
import { app, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ExportProgress, ExportRequest } from '@shared/timeline'
import { assetPath } from './library'
import { buildArgs } from './ffgraph'

let current: ChildProcess | null = null

export function ffmpegPath(): string {
  if (process.env.PROMPTSTUDIO_FFMPEG) return process.env.PROMPTSTUDIO_FFMPEG
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('ffmpeg-static') as string | null
    if (p) return app.isPackaged ? p.replace('app.asar', 'app.asar.unpacked') : p
  } catch { /* not installed */ }
  return 'ffmpeg'
}

function send(p: ExportProgress): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('export:progress', p)
}

function parseTime(line: string): number | undefined {
  const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line)
  if (!m) return undefined
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

export async function runExport(req: ExportRequest): Promise<ExportProgress> {
  if (current) throw new Error('An export is already running')
  send({ phase: 'preparing', percent: 0 })
  const tmpDir = join(app.getPath('temp'), `promptstudio-export-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
  try {
    const { args, total } = await buildArgs(req, tmpDir, assetPath, ffmpegPath())
    const result = await new Promise<ExportProgress>((resolve) => {
      const proc = spawn(ffmpegPath(), args, { windowsHide: true })
      current = proc
      let tail = ''
      proc.stderr.on('data', (d) => {
        const s = d.toString()
        tail = (tail + s).slice(-4000)
        const t = parseTime(s)
        if (t !== undefined) send({ phase: 'encoding', percent: Math.min(99, Math.round((t / total) * 100)) })
      })
      proc.on('error', (e) => resolve({ phase: 'failed', percent: 0, message: `Could not start FFmpeg (${ffmpegPath()}): ${e.message}` }))
      proc.on('close', (code, signal) => {
        if (signal === 'SIGTERM' || signal === 'SIGKILL') resolve({ phase: 'cancelled', percent: 0 })
        else if (code === 0) resolve({ phase: 'done', percent: 100, outputPath: req.outputPath })
        else resolve({ phase: 'failed', percent: 0, message: `FFmpeg exited with code ${code}\n${tail.split('\n').slice(-12).join('\n')}` })
      })
    })
    send(result)
    return result
  } catch (e) {
    const r: ExportProgress = { phase: 'failed', percent: 0, message: (e as Error).message }
    send(r)
    return r
  } finally {
    current = null
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export function cancelExport(): void {
  current?.kill('SIGTERM')
}
