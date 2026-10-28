import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import type { ChatRequest, ImageRequest, MusicRequest, TTSRequest, VideoRequest, Settings } from '@shared/types'
import * as settings from './settings'
import * as or from './openrouter'
import * as lib from './library'
import * as gen from './generate'
import * as jobs from './jobs'
import * as projects from './projects'
import * as exporter from './export'
import type { EditorProject, ExportRequest } from '@shared/timeline'

// media://<assetId> serves files from the library folder to the renderer.
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
])

let modelCache: { at: number; data: Awaited<ReturnType<typeof or.listModels>> } | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'PromptStudio',
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function registerIpc(): void {
  // settings
  ipcMain.handle('settings:get', () => settings.getSettings())
  ipcMain.handle('settings:set', (_e, patch) => settings.patchSettings(patch))
  ipcMain.handle('settings:setApiKey', (_e, key: string) => settings.setApiKey(key))
  ipcMain.handle('settings:clearApiKey', () => settings.clearApiKey())
  ipcMain.handle('settings:chooseLibraryDir', async (): Promise<Settings> => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (!r.canceled && r.filePaths[0]) {
      lib.resetCache()
      return settings.patchSettings({ libraryDir: r.filePaths[0] })
    }
    return settings.getSettings()
  })

  // openrouter
  ipcMain.handle('or:models', async (_e, force?: boolean) => {
    if (!force && modelCache && Date.now() - modelCache.at < 10 * 60_000) return modelCache.data
    const data = await or.listModels()
    modelCache = { at: Date.now(), data }
    return data
  })
  ipcMain.handle('or:credits', () => or.getCredits())
  ipcMain.handle('or:chat', (_e, req: ChatRequest) => gen.runChat(req))
  ipcMain.handle('or:enhance', (_e, prompt: string, mode) => gen.enhancePrompt(prompt, mode))
  ipcMain.handle('or:image', (_e, req: ImageRequest) => gen.runImage(req))
  ipcMain.handle('or:tts', (_e, req: TTSRequest) => gen.runTTS(req))
  ipcMain.handle('or:music', (_e, req: MusicRequest) => gen.runMusic(req))
  ipcMain.handle('or:videoSubmit', (_e, req: VideoRequest) => jobs.submitVideo(req))

  // library
  ipcMain.handle('library:list', () => lib.loadIndex())
  ipcMain.handle('library:delete', (_e, id: string) => lib.deleteAsset(id))
  ipcMain.handle('library:openFolder', async () => { await shell.openPath(await settings.getLibraryDir()) })
  ipcMain.handle('library:reveal', async (_e, id: string) => {
    const p = await lib.assetPath(id)
    if (p) shell.showItemInFolder(p)
  })

  ipcMain.handle('library:import', async () => {
    const r = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Media', extensions: ['mp4', 'webm', 'mov', 'mkv', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'png', 'jpg', 'jpeg', 'webp', 'gif'] }]
    })
    return r.canceled ? [] : lib.importFiles(r.filePaths)
  })

  // editor projects
  ipcMain.handle('projects:list', () => projects.listProjects())
  ipcMain.handle('projects:load', (_e, id: string) => projects.loadProject(id))
  ipcMain.handle('projects:save', (_e, p: EditorProject) => projects.saveProject(p))
  ipcMain.handle('projects:delete', (_e, id: string) => projects.deleteProject(id))

  // export
  ipcMain.handle('export:chooseOutput', async (_e, name: string) => {
    const r = await dialog.showSaveDialog({ defaultPath: join(app.getPath('videos'), name), filters: [{ name: 'MP4 video', extensions: ['mp4'] }] })
    return r.canceled || !r.filePath ? null : r.filePath
  })
  ipcMain.handle('export:run', (_e, req: ExportRequest) => exporter.runExport(req))
  ipcMain.handle('export:cancel', () => exporter.cancelExport())
  ipcMain.handle('export:openFile', (_e, p: string) => shell.openPath(p))

  // jobs
  ipcMain.handle('jobs:list', () => jobs.listJobs())
  ipcMain.handle('jobs:cancel', (_e, id: string) => jobs.cancelJob(id))
}

app.whenReady().then(async () => {
  protocol.handle('media', async (request) => {
    const id = new URL(request.url).hostname || new URL(request.url).pathname.replace(/^\/+/, '')
    const p = await lib.assetPath(id)
    if (!p) return new Response('not found', { status: 404 })
    return net.fetch(pathToFileURL(p).toString())
  })
  registerIpc()
  createWindow()
  await jobs.resumeJobs()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
