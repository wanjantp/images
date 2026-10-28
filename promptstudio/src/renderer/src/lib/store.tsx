import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Credits, Job, LibraryIndex, ORModel, Settings } from '@shared/types'

interface Store {
  settings: Settings | null
  models: ORModel[]
  modelsError: string | null
  credits: Credits | null
  library: LibraryIndex
  jobs: Job[]
  refreshSettings(): Promise<void>
  refreshModels(force?: boolean): Promise<void>
  refreshCredits(): Promise<void>
  refreshLibrary(): Promise<void>
  setSettings(s: Settings): void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [models, setModels] = useState<ORModel[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [credits, setCredits] = useState<Credits | null>(null)
  const [library, setLibrary] = useState<LibraryIndex>({ assets: [], generations: [] })
  const [jobs, setJobs] = useState<Job[]>([])

  const refreshSettings = useCallback(async () => setSettings(await window.api.settings.get()), [])
  const refreshModels = useCallback(async (force?: boolean) => {
    try {
      setModels(await window.api.openrouter.models(force))
      setModelsError(null)
    } catch (e) {
      setModelsError((e as Error).message)
    }
  }, [])
  const refreshCredits = useCallback(async () => {
    try { setCredits(await window.api.openrouter.credits()) } catch { setCredits(null) }
  }, [])
  const refreshLibrary = useCallback(async () => setLibrary(await window.api.library.list()), [])

  useEffect(() => {
    void refreshSettings()
    void refreshLibrary()
    window.api.jobs.list().then(setJobs)
    return window.api.jobs.onUpdate((j) => { setJobs(j); void refreshLibrary() })
  }, [refreshSettings, refreshLibrary])

  useEffect(() => {
    if (settings?.hasApiKey) { void refreshModels(); void refreshCredits() }
  }, [settings?.hasApiKey, refreshModels, refreshCredits])

  const value = useMemo<Store>(() => ({
    settings, models, modelsError, credits, library, jobs,
    refreshSettings, refreshModels, refreshCredits, refreshLibrary, setSettings
  }), [settings, models, modelsError, credits, library, jobs, refreshSettings, refreshModels, refreshCredits, refreshLibrary])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}
