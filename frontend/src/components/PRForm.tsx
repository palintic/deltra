import { useEffect, useState } from 'react'
import { createPR, fetchGpxFiles } from '../api'
import type { PR } from '../types'

interface Props {
  onCreated: (pr: PR) => void
}

function parseTime(value: string): number | null {
  const trimmed = value.trim()
  // H:MM:SS
  const hms = trimmed.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (hms) return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3])
  // MM:SS
  const ms = trimmed.match(/^(\d+):(\d{2})$/)
  if (ms) return parseInt(ms[1]) * 60 + parseInt(ms[2])
  const n = parseFloat(trimmed)
  return isNaN(n) || n <= 0 ? null : n
}

const input: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#e2e8f0',
  padding: '8px 12px',
  fontSize: '0.95rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const label: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  fontSize: '0.75rem',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

export function PRForm({ onCreated }: Props) {
  const [name, setName] = useState('')
  const [distKm, setDistKm] = useState('')
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')
  const [gpxFile, setGpxFile] = useState('')
  const [gpxFiles, setGpxFiles] = useState<string[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGpxFiles().then(setGpxFiles).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const dist = parseFloat(distKm)
    const timeSecs = parseTime(time)
    if (!name.trim()) { setError('Name is required'); return }
    if (isNaN(dist) || dist <= 0) { setError('Distance must be a positive number'); return }
    if (!timeSecs) { setError('Time must be MM:SS or H:MM:SS'); return }

    setError('')
    setSaving(true)
    try {
      const pr = await createPR({
        name: name.trim(),
        distance_m: dist * 1000,
        time_secs: timeSecs,
        date: date || undefined,
        gpx_file: gpxFile || null,
      })
      onCreated(pr)
      setName(''); setDistKm(''); setTime(''); setDate(''); setGpxFile('')
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex', flexDirection: 'column', gap: '14px',
      padding: '20px', background: '#1e293b',
      borderRadius: '12px', border: '1px solid #334155',
    }}>
      <h3 style={{ margin: 0, fontSize: '1rem', color: '#e2e8f0' }}>Add a PR</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <label style={label}>
          Name
          <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="5k Summer 2024" />
        </label>
        <label style={label}>
          Distance (km)
          <input style={input} value={distKm} onChange={e => setDistKm(e.target.value)} placeholder="5" />
        </label>
        <label style={label}>
          Finish time (MM:SS)
          <input style={input} value={time} onChange={e => setTime(e.target.value)} placeholder="25:00" />
        </label>
        <label style={label}>
          Date (optional)
          <input style={{ ...input, colorScheme: 'dark' }} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
      </div>

      {gpxFiles.length > 0 && (
        <label style={label}>
          GPX file (optional)
          <select style={input} value={gpxFile} onChange={e => setGpxFile(e.target.value)}>
            <option value="">— none —</option>
            {gpxFiles.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      )}

      {error && <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</span>}

      <button type="submit" disabled={saving} style={{
        padding: '10px', borderRadius: '8px', border: 'none',
        background: saving ? '#1e3a5f' : '#2563eb',
        color: saving ? '#64748b' : '#fff',
        fontWeight: 600, fontSize: '0.95rem',
        cursor: saving ? 'not-allowed' : 'pointer',
      }}>
        {saving ? 'Saving…' : 'Save PR'}
      </button>
    </form>
  )
}
