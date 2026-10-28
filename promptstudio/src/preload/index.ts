import { contextBridge, ipcRenderer } from 'electron'
import type { Api, Asset, Job } from '@shared/types'

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
    mediaUrl: (asset: Asset) => `media://${asset.id}`
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
