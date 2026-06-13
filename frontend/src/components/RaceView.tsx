import { useEffect, useRef, useState } from 'react'
import type { PR } from '../types'
import { DeltaBadge } from './DeltaBadge'

interface Props {
  pr: PR
  onBack: () => void
}

function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDist(m: number): string {
  return (m / 1000).toFixed(2) + ' km'
}

interface BarProps {
  label: string
  color: string
  pct: number
  distM: number
  elapsedS: number
}

function Bar({ label, color, pct, distM, elapsedS }: BarProps) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{label}</span>
        <span>{fmtDist(distM)} · {fmtTime(elapsedS)}</span>
      </div>
      <div style={{ height: '20px', background: '#0f172a', borderRadius: '999px', border: '1px solid #334155', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${clamped}%`, background: color, borderRadius: '999px', transition: 'width 0.2s ease-out' }} />
      </div>
    </div>
  )
}

const INCREMENT_OPTIONS = [100, 500, 1000, 5000]

export function RaceView({ pr, onBack }: Props) {
  const [started, setStarted] = useState(false)
  const [elapsedS, setElapsedS] = useState(0)
  const [userDistM, setUserDistM] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const [finished, setFinished] = useState(false)
  const startRef = useRef<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ghost is where your PR record was at this elapsed time
  const ghostDistM = pr.time_secs > 0 ? (elapsedS / pr.time_secs) * pr.distance_m : 0

  // Delta: positive = you are ahead (your dist > ghost dist in time terms)
  // delta_s = (userDist / prDist) * prTime - elapsedS
  const deltaS = userDistM > 0
    ? (userDistM / pr.distance_m) * pr.time_secs - elapsedS
    : 0

  const absDelta = Math.abs(deltaS)
  const deltaLabel = deltaS === 0 ? '0.0s'
    : deltaS > 0 ? `+${absDelta.toFixed(1)}s`
    : `-${absDelta.toFixed(1)}s`
  const trend = deltaS > 0 ? 'rising' as const : deltaS < 0 ? 'falling' as const : 'stable' as const

  const userPct = (userDistM / pr.distance_m) * 100
  const ghostPct = (ghostDistM / pr.distance_m) * 100

  function start() {
    startRef.current = new Date()
    setStarted(true)
    intervalRef.current = setInterval(() => {
      if (startRef.current) {
        setElapsedS(Math.floor((Date.now() - startRef.current.getTime()) / 1000))
      }
    }, 1000)
  }

  function addDistance(metres: number) {
    if (!started || finished) return
    setUserDistM(prev => {
      const next = prev + metres
      if (next >= pr.distance_m) {
        finish(next)
        return pr.distance_m
      }
      return next
    })
  }

  function applyCustom() {
    const km = parseFloat(customInput)
    if (!isNaN(km) && km > 0) {
      addDistance(km * 1000)
      setCustomInput('')
    }
  }

  function finish(distM?: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (distM !== undefined) setUserDistM(distM)
    setFinished(true)
  }

  function handleBack() {
    if (started && !finished) {
      if (!confirm('Race in progress — go back?')) return
    }
    if (intervalRef.current) clearInterval(intervalRef.current)
    onBack()
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={handleBack} style={{
          padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155',
          background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem',
        }}>← Back</button>
        <span style={{ fontWeight: 700, color: '#e2e8f0' }}>vs {pr.name}</span>
        {started && !finished && (
          <button onClick={() => finish()} style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: '#7f1d1d', color: '#fca5a5', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
          }}>Finish</button>
        )}
        {(!started || finished) && <div style={{ width: '80px' }} />}
      </div>

      {/* Race card */}
      <div style={{
        padding: '24px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155',
        display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        {/* Timer */}
        <div style={{ textAlign: 'center', fontSize: '3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: started ? '#e2e8f0' : '#475569' }}>
          {fmtTime(elapsedS)}
        </div>

        {!started && (
          <button onClick={start} style={{
            padding: '14px', borderRadius: '10px', border: 'none',
            background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer',
          }}>Start Race</button>
        )}

        {started && (
          <>
            <Bar label="You" color="#3b82f6" pct={userPct} distM={userDistM} elapsedS={elapsedS} />
            <Bar label="PR Ghost" color="#f97316" pct={ghostPct} distM={ghostDistM} elapsedS={elapsedS} />

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DeltaBadge delta={{ secs: deltaS, label: deltaLabel, trend }} />
            </div>
          </>
        )}
      </div>

      {/* Distance input — only shown when race is running */}
      {started && !finished && (
        <div style={{
          padding: '20px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Update your distance
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {INCREMENT_OPTIONS.map(m => (
              <button key={m} onClick={() => addDistance(m)} style={{
                padding: '10px 16px', borderRadius: '8px', border: '1px solid #334155',
                background: '#0f172a', color: '#e2e8f0', fontWeight: 600, cursor: 'pointer',
                fontSize: '0.9rem',
              }}>
                +{m >= 1000 ? `${m / 1000} km` : `${m} m`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyCustom()}
              placeholder="custom km (e.g. 2.4)"
              style={{
                flex: 1, background: '#0f172a', border: '1px solid #334155',
                borderRadius: '6px', color: '#e2e8f0', padding: '8px 12px', fontSize: '0.95rem', outline: 'none',
              }}
            />
            <button onClick={applyCustom} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}>Add</button>
          </div>
        </div>
      )}

      {/* Finish summary */}
      {finished && (
        <div style={{
          padding: '20px', background: '#14532d', borderRadius: '12px', border: '1px solid #16a34a',
          textAlign: 'center', color: '#4ade80',
        }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Race complete!</div>
          <div style={{ marginTop: '8px', color: '#86efac' }}>
            Final time: {fmtTime(elapsedS)} · Distance: {fmtDist(userDistM)}
          </div>
          <div style={{ marginTop: '4px', color: '#86efac' }}>
            Delta vs PR: {deltaLabel} {trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : '→'}
          </div>
        </div>
      )}
    </div>
  )
}
