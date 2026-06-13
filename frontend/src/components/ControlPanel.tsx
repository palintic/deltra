import { useState } from 'react'

interface Props {
  isRunning: boolean
  onStart: (userPace: number, ghostPace: number, targetDistM: number) => void
  onStop: () => void
}

function parsePaceMmSs(value: string): number | null {
  const trimmed = value.trim()
  // Accept plain seconds like "300" or "5:00" / "5:15"
  if (/^\d+$/.test(trimmed)) {
    const v = parseFloat(trimmed)
    return v > 0 ? v : null
  }
  const parts = trimmed.split(':')
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10)
    const secs = parseInt(parts[1], 10)
    if (!isNaN(mins) && !isNaN(secs) && secs < 60) {
      const total = mins * 60 + secs
      return total > 0 ? total : null
    }
  }
  return null
}

export function ControlPanel({ isRunning, onStart, onStop }: Props) {
  const [userPaceStr, setUserPaceStr] = useState('5:00')
  const [ghostPaceStr, setGhostPaceStr] = useState('5:15')
  const [distKmStr, setDistKmStr] = useState('5')
  const [error, setError] = useState('')

  function handleStart() {
    const userPace = parsePaceMmSs(userPaceStr)
    const ghostPace = parsePaceMmSs(ghostPaceStr)
    const distKm = parseFloat(distKmStr)

    if (!userPace) { setError('Invalid user pace — use MM:SS (e.g. 5:00)'); return }
    if (!ghostPace) { setError('Invalid ghost pace — use MM:SS (e.g. 5:15)'); return }
    if (isNaN(distKm) || distKm <= 0) { setError('Distance must be a positive number'); return }

    setError('')
    onStart(userPace, ghostPace, distKm * 1000)
  }

  const inputStyle: React.CSSProperties = {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: '1rem',
    width: '90px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.75rem',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: '16px',
      padding: '20px 24px',
      background: '#1e293b',
      borderRadius: '12px',
      border: '1px solid #334155',
    }}>
      <label style={labelStyle}>
        Your pace (mm:ss/km)
        <input
          style={inputStyle}
          value={userPaceStr}
          onChange={e => setUserPaceStr(e.target.value)}
          disabled={isRunning}
          placeholder="5:00"
        />
      </label>

      <label style={labelStyle}>
        Ghost pace (mm:ss/km)
        <input
          style={inputStyle}
          value={ghostPaceStr}
          onChange={e => setGhostPaceStr(e.target.value)}
          disabled={isRunning}
          placeholder="5:15"
        />
      </label>

      <label style={labelStyle}>
        Distance (km)
        <input
          style={{ ...inputStyle, width: '70px' }}
          value={distKmStr}
          onChange={e => setDistKmStr(e.target.value)}
          disabled={isRunning}
          placeholder="5"
        />
      </label>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <button
          onClick={handleStart}
          disabled={isRunning}
          style={{
            padding: '9px 22px',
            borderRadius: '8px',
            border: 'none',
            background: isRunning ? '#1e3a5f' : '#2563eb',
            color: isRunning ? '#64748b' : '#fff',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: isRunning ? 'not-allowed' : 'pointer',
          }}
        >
          Start
        </button>
        <button
          onClick={onStop}
          disabled={!isRunning}
          style={{
            padding: '9px 22px',
            borderRadius: '8px',
            border: `1px solid ${isRunning ? '#991b1b' : '#334155'}`,
            background: isRunning ? '#7f1d1d' : '#1e293b',
            color: isRunning ? '#fca5a5' : '#475569',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: isRunning ? 'pointer' : 'not-allowed',
          }}
        >
          Stop
        </button>
      </div>

      {error && (
        <span style={{ color: '#f87171', fontSize: '0.85rem', width: '100%' }}>{error}</span>
      )}
    </div>
  )
}
