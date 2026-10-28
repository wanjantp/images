import { contextBridge, ipcRenderer } from 'electron'
import type { Api, Asset, Job } from '@shared/types'
import type { ExportProgress } from '@shared/timeline'

const api: Api = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    setApiKey: (key) => ipcRenderer.invoke('settings:setApiKey', key),
    clearApiKey: () => ipcRenderer.invoke('settings:clearApiKey'),
    chooseLibraryDir: () => ipcRenderer.invoke('settings:chooseLibraryDir')
  },
  openrouter: {
    models: (force) => ipcRenderer.invoke('or:models', force),
    credits: () => ipcRenderer.invoke('or:credits'),
    chat: (req) => ipcRenderer.invoke('or:chat', req),
    enhance: (prompt, mode) => ipcRenderer.invoke('or:enhance', prompt, mode),
    image: (req) => ipcRenderer.invoke('or:image', req),
    tts: (req) => ipcRenderer.invoke('or:tts', req),
    videoSubmit: (req) => ipcRenderer.invoke('or:videoSubmit', req)
  },
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    delete: (id) => ipcRenderer.invoke('library:delete', id),
    openFolder: () => ipcRenderer.invoke('library:openFolder'),
    reveal: (id) => ipcRenderer.invoke('library:reveal', id),
    importFiles: () => ipcRenderer.invoke('library:import'),
    mediaUrl: (asset: Asset) => `media://${asset.id}`
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    load: (id) => ipcRenderer.invoke('projects:load', id),
    save: (p) => ipcRenderer.invoke('projects:save', p),
    delete: (id) => ipcRenderer.invoke('projects:delete', id)
  },
  exporter: {
    chooseOutput: (name) => ipcRenderer.invoke('export:chooseOutput', name),
    run: (req) => ipcRenderer.invoke('export:run', req),
    cancel: () => ipcRenderer.invoke('export:cancel'),
    openFile: (p) => ipcRenderer.invoke('export:openFile', p),
    onProgress: (cb) => {
      const handler = (_e: unknown, p: ExportProgress): void => cb(p)
      ipcRenderer.on('export:progress', handler)
      return () => ipcRenderer.removeListener('export:progress', handler)
    }
  },
  jobs: {
    list: () => ipcRenderer.invoke('jobs:list'),
    cancel: (id) => ipcRenderer.invoke('jobs:cancel', id),
    onUpdate: (cb) => {
      const handler = (_e: unknown, jobs: Job[]): void => cb(jobs)
      ipcRenderer.on('jobs:update', handler)
      return () => ipcRenderer.removeListener('jobs:update', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
