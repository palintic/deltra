import { useEffect, useState } from 'react'
import { fetchPRs, deletePR } from '../api'
import type { PR } from '../types'
import { PRForm } from './PRForm'

interface Props {
  onRace: (pr: PR) => void
}

function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.floor(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function PRList({ onRace }: Props) {
  const [prs, setPrs] = useState<PR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    fetchPRs()
      .then(data => { setPrs(data); setError('') })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deletePR(id)
      setPrs(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      alert(String(err))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {loading && <p style={{ color: '#64748b', textAlign: 'center' }}>Loading…</p>}
      {error && <p style={{ color: '#f87171' }}>{error}</p>}

      {!loading && prs.length === 0 && (
        <p style={{ color: '#475569', textAlign: 'center', padding: '32px 0' }}>
          No PRs yet — add your first one below.
        </p>
      )}

      {prs.map(pr => (
        <div key={pr.id} style={{
          padding: '16px 20px',
          background: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#e2e8f0' }}>{pr.name}</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              {(pr.distance_m / 1000).toFixed(2)} km · {fmtTime(pr.time_secs)} · {fmtPace(pr.pace_sec_per_km)}
              {pr.date && <span> · {pr.date}</span>}
              {pr.gpx_file && <span style={{ color: '#60a5fa' }}> · 📍 {pr.gpx_file}</span>}
            </div>
          </div>

          <button onClick={() => onRace(pr)} style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none',
            background: '#16a34a', color: '#fff',
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
          }}>
            Race
          </button>
          <button onClick={() => handleDelete(pr.id, pr.name)} style={{
            padding: '8px 14px', borderRadius: '8px', border: '1px solid #991b1b',
            background: 'transparent', color: '#f87171',
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
          }}>
            Delete
          </button>
        </div>
      ))}

      <PRForm onCreated={pr => setPrs(prev => [pr, ...prev])} />
    </div>
  )
}
