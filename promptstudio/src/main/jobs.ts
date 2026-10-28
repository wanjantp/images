/**
 * Persistent job queue for async video generation. Jobs survive restarts:
 * the queue is written to userData/jobs.json and polling resumes on launch.
 */
import { app, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { Job, VideoRequest } from '@shared/types'
import * as or from './openrouter'
import { addGeneration, newId, saveAsset, updateGeneration } from './library'

const POLL_MS = 8000
let jobs: Job[] = []
let loaded = false
let timer: NodeJS.Timeout | null = null

const file = (): string => join(app.getPath('userData'), 'jobs.json')

async function load(): Promise<void> {
  if (loaded) return
  try { jobs = JSON.parse(await fs.readFile(file(), 'utf8')) as Job[] } catch { jobs = [] }
  loaded = true
}

async function save(): Promise<void> {
  await fs.writeFile(file(), JSON.stringify(jobs, null, 2))
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('jobs:update', jobs)
}

export async function listJobs(): Promise<Job[]> {
  await load()
  return jobs
}

function touch(j: Job, patch: Partial<Job>): void {
  Object.assign(j, patch, { updatedAt: new Date().toISOString() })
}

export async function submitVideo(req: VideoRequest): Promise<Job> {
  await load()
  const now = new Date().toISOString()
  const generationId = newId()
  await addGeneration({
    id: generationId, mode: 'video', model: req.model, prompt: req.prompt, createdAt: now,
    params: { aspectRatio: req.aspectRatio, durationSec: req.durationSec, resolution: req.resolution, imageToVideo: Boolean(req.image) }
  })
  const job: Job = {
    id: newId(), mode: 'video', model: req.model, prompt: req.prompt, status: 'queued',
    assetIds: [], generationId, createdAt: now, updatedAt: now
  }
  jobs.unshift(job)
  await save()
  try {
    const st = await or.videoSubmit(req)
    touch(job, { remoteId: st.remoteId, status: st.status === 'done' ? 'polling' : 'polling' })
  } catch (e) {
    touch(job, { status: 'failed', error: (e as Error).message })
  }
  await save()
  ensurePolling()
  return job
}

export async function cancelJob(id: string): Promise<Job[]> {
  await load()
  const j = jobs.find((x) => x.id === id)
  if (j && (j.status === 'queued' || j.status === 'polling' || j.status === 'running')) {
    touch(j, { status: 'cancelled' })
    await save()
  }
  return jobs
}

async function pollOnce(): Promise<void> {
  const active = jobs.filter((j) => j.status === 'polling' && j.remoteId)
  for (const j of active) {
    try {
      const st = await or.videoStatus(j.remoteId!)
      if (st.status === 'done' && st.url) {
        const { bytes, mime } = await or.download(st.url)
        const asset = await saveAsset({ kind: 'video', bytes, mime: mime.startsWith('video/') ? mime : 'video/mp4', generationId: j.generationId! })
        await updateGeneration(j.generationId!, {
          openrouterId: j.remoteId,
          costUsd: await or.getGenerationCost(j.remoteId!).catch(() => undefined),
          durationMs: Date.now() - new Date(j.createdAt).getTime()
        })
        touch(j, { status: 'done', assetIds: [asset.id], progress: 100 })
      } else if (st.status === 'done' && !st.url) {
        touch(j, { status: 'failed', error: 'Job finished but no download URL was returned' })
      } else if (st.status === 'failed') {
        touch(j, { status: 'failed', error: st.error ?? 'Video generation failed' })
      } else {
        touch(j, { progress: st.progress })
      }
    } catch (e) {
      // Transient network errors keep polling; auth errors stop the job.
      const msg = (e as Error).message
      if (/OpenRouter 4\d\d/.test(msg)) touch(j, { status: 'failed', error: msg })
    }
  }
  if (active.length) await save()
}

export function ensurePolling(): void {
  if (timer) return
  timer = setInterval(async () => {
    await load()
    if (!jobs.some((j) => j.status === 'polling')) { clearInterval(timer!); timer = null; return }
    await pollOnce()
  }, POLL_MS)
}

export async function resumeJobs(): Promise<void> {
  await load()
  if (jobs.some((j) => j.status === 'polling')) ensurePolling()
}
