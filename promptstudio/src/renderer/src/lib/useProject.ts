import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorProject } from '@shared/timeline'
import { layoutVisual, newProject } from '@shared/timeline'

const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export { uid }

/** Project state with undo/redo and debounced autosave. */
export function useProject(): {
  project: EditorProject
  update(fn: (p: EditorProject) => EditorProject, record?: boolean): void
  replace(p: EditorProject): void
  undo(): void
  redo(): void
  canUndo: boolean
  canRedo: boolean
  saving: boolean
} {
  const [project, setProject] = useState<EditorProject>(() => newProject(uid()))
  const past = useRef<EditorProject[]>([])
  const future = useRef<EditorProject[]>([])
  const [, bump] = useState(0)
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const normalise = (p: EditorProject): EditorProject => ({ ...p, visual: layoutVisual(p.visual) })

  const update = useCallback((fn: (p: EditorProject) => EditorProject, record = true) => {
    setProject((prev) => {
      const next = normalise(fn(prev))
      if (record) { past.current = [...past.current.slice(-60), prev]; future.current = [] }
      return next
    })
    bump((n) => n + 1)
  }, [])

  const replace = useCallback((p: EditorProject) => { past.current = []; future.current = []; setProject(normalise(p)); bump((n) => n + 1) }, [])

  const undo = useCallback(() => {
    setProject((cur) => { const prev = past.current.pop(); if (!prev) return cur; future.current.push(cur); return prev })
    bump((n) => n + 1)
  }, [])
  const redo = useCallback(() => {
    setProject((cur) => { const nxt = future.current.pop(); if (!nxt) return cur; past.current.push(cur); return nxt })
    bump((n) => n + 1)
  }, [])

  // autosave
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => { setSaving(true); await window.api.projects.save(project); setSaving(false) }, 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [project])

  return { project, update, replace, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, saving }
}
