import React from 'react'
import { useStore } from '../lib/store'

export default function JobsBar(): React.JSX.Element | null {
  const { jobs } = useStore()
  const visible = jobs.filter((j) => j.status !== 'done' && j.status !== 'cancelled').slice(0, 5)
  if (!visible.length) return null
  return (
    <div className="jobs" style={{ marginBottom: 14 }}>
      {visible.map((j) => (
        <div className="job" key={j.id}>
          <span className={`badge ${j.status === 'failed' ? 'err' : 'warn'}`}>
            {j.status === 'polling' && <span className="spinner" />}{j.status}{j.progress ? ` ${j.progress}%` : ''}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.error ?? j.prompt}>
            {j.model.split('/').pop()} · {j.error ?? j.prompt}
          </span>
          {j.status === 'polling' || j.status === 'queued'
            ? <button className="ghost" onClick={() => window.api.jobs.cancel(j.id)}>Cancel</button>
            : <span className="hint">{new Date(j.updatedAt).toLocaleTimeString()}</span>}
        </div>
      ))}
    </div>
  )
}
