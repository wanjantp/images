import React, { useState } from 'react'
import { useStore } from '../lib/store'
import { fmtUsd } from '@shared/pricing'

export default function SettingsView(): React.JSX.Element {
  const { settings, setSettings, credits, refreshCredits, refreshModels, models } = useStore()
  const [key, setKey] = useState('')
  const [status, setStatus] = useState('')
  const [enhancer, setEnhancer] = useState<string | null>(null)
  if (!settings) return <div className="hint">Loading…</div>

  const saveKey = async (): Promise<void> => {
    if (!key.trim()) return
    setStatus('Saving…')
    const s = await window.api.settings.setApiKey(key)
    setSettings(s); setKey('')
    try {
      const c = await window.api.openrouter.credits()
      setStatus(`Connected. Credits left: ${fmtUsd(c.total_credits - c.total_usage)}`)
      await refreshCredits(); await refreshModels(true)
    } catch (e) { setStatus(`Key saved but test failed: ${(e as Error).message}`) }
  }

  const clearKey = async (): Promise<void> => { setSettings(await window.api.settings.clearApiKey()); setStatus('Key removed') }
  const chooseDir = async (): Promise<void> => setSettings(await window.api.settings.chooseLibraryDir())
  const saveEnhancer = async (): Promise<void> => { if (enhancer) setSettings(await window.api.settings.set({ enhancerModel: enhancer })) }

  const textModels = models.filter((m) => (m.architecture?.output_modalities ?? ['text']).includes('text') && !(m.architecture?.output_modalities ?? []).includes('image'))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0 }}>OpenRouter API key</h3>
        <div className="hint">
          Create a key at <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">openrouter.ai/settings/keys</a>.
          {settings.encryptionAvailable ? ' It is encrypted with Windows DPAPI (safeStorage) and never written in plain text.' : ' Warning: OS encryption is unavailable on this machine, so the key is stored in plain text in your user data folder.'}
        </div>
        <div className="row">
          <input type="password" placeholder={settings.hasApiKey ? '•••••••••••• (key saved)' : 'sk-or-v1-…'} value={key} onChange={(e) => setKey(e.target.value)} style={{ flex: 1 }} />
          <button className="primary" onClick={saveKey} disabled={!key.trim()}>Save & test</button>
          {settings.hasApiKey && <button className="danger" onClick={clearKey}>Remove</button>}
        </div>
        {status && <div className="hint">{status}</div>}
        {credits && <div className="hint">Account: {fmtUsd(credits.total_credits)} purchased · {fmtUsd(credits.total_usage)} used</div>}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0 }}>Library folder</h3>
        <div className="row"><span className="mono" style={{ flex: 1 }}>{settings.libraryDir}</span><button onClick={chooseDir}>Change…</button></div>
        <div className="hint">Generated files are saved here with a library.json index (prompt, model, seed, cost per file).</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: 0 }}>Prompt enhancer model</h3>
        <div className="row">
          <input list="enh" value={enhancer ?? settings.enhancerModel} onChange={(e) => setEnhancer(e.target.value)} style={{ flex: 1 }} />
          <datalist id="enh">{textModels.map((m) => <option key={m.id} value={m.id} />)}</datalist>
          <button onClick={saveEnhancer} disabled={!enhancer || enhancer === settings.enhancerModel}>Save</button>
        </div>
        <div className="hint">A cheap, fast chat model is enough. It rewrites your prompt for the selected mode.</div>
      </div>
    </div>
  )
}
