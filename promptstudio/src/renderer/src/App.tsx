import React, { useState } from 'react'
import { StoreProvider, useStore } from './lib/store'
import Composer from './components/Composer'
import LibraryView from './components/LibraryView'
import ModelsView from './components/ModelsView'
import SettingsView from './components/SettingsView'
import JobsBar from './components/JobsBar'
import EditorView from './components/editor/EditorView'
import { fmtUsd } from '@shared/pricing'

type View = 'create' | 'editor' | 'library' | 'models' | 'settings'

const titles: Record<View, string> = { create: 'Create', editor: 'Video Editor', library: 'Library', models: 'Models', settings: 'Settings' }

function Shell(): React.JSX.Element {
  const { settings, credits, jobs } = useStore()
  const [view, setView] = useState<View>('create')
  const needsKey = settings && !settings.hasApiKey
  const active = jobs.filter((j) => j.status === 'polling' || j.status === 'queued').length

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Prompt<span>Studio</span></div>
        {(Object.keys(titles) as View[]).map((v) => (
          <button key={v} className={`nav-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {titles[v]}{v === 'create' && active ? ` · ${active} running` : ''}
          </button>
        ))}
        <div className="spacer" />
        <div className="credits">
          {credits ? (<>Credits left <b>{fmtUsd(credits.total_credits - credits.total_usage)}</b><br />used {fmtUsd(credits.total_usage)}</>) : needsKey ? 'No API key' : 'Credits: –'}
        </div>
      </aside>
      <main className="main">
        <div className="topbar"><h1>{titles[view]}</h1>{needsKey && view !== 'settings' && <button className="primary" onClick={() => setView('settings')}>Add OpenRouter API key</button>}</div>
        <div className={`content ${view === 'editor' ? 'content-editor' : ''}`}>
          {view === 'create' && (<><JobsBar /><Composer /></>)}
          {view === 'editor' && <EditorView />}
          {view === 'library' && <LibraryView />}
          {view === 'models' && <ModelsView />}
          {view === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  )
}

export default function App(): React.JSX.Element {
  return <StoreProvider><Shell /></StoreProvider>
}
