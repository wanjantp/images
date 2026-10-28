import { promises as fs } from 'fs'
import { join } from 'path'
import type { EditorProject } from '@shared/timeline'
import { getLibraryDir } from './settings'

const dir = async (): Promise<string> => {
  const d = join(await getLibraryDir(), 'projects')
  await fs.mkdir(d, { recursive: true })
  return d
}

export interface ProjectSummary { id: string; name: string; updatedAt: string }

export async function listProjects(): Promise<ProjectSummary[]> {
  const d = await dir()
  const files = (await fs.readdir(d)).filter((f) => f.endsWith('.json'))
  const out: ProjectSummary[] = []
  for (const f of files) {
    try {
      const p = JSON.parse(await fs.readFile(join(d, f), 'utf8')) as EditorProject
      out.push({ id: p.id, name: p.name, updatedAt: p.updatedAt })
    } catch { /* skip corrupt */ }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadProject(id: string): Promise<EditorProject | null> {
  try { return JSON.parse(await fs.readFile(join(await dir(), `${id}.json`), 'utf8')) as EditorProject } catch { return null }
}

export async function saveProject(p: EditorProject): Promise<void> {
  p.updatedAt = new Date().toISOString()
  await fs.writeFile(join(await dir(), `${p.id}.json`), JSON.stringify(p, null, 2))
}

export async function deleteProject(id: string): Promise<void> {
  await fs.rm(join(await dir(), `${id}.json`), { force: true })
}
