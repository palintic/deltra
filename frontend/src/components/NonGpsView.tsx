import type { TickMessage } from '../types'
import { DeltaBadge } from './DeltaBadge'

interface Props {
  tick: TickMessage
  targetDistM: number
  ghostPaceSecPerKm: number
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDist(m: number): string {
  return (m / 1000).toFixed(2) + ' km'
}

function fmtPace(distM: number, elapsedS: number): string {
  if (distM <= 0) return '--:--'
  const secPerKm = (elapsedS / distM) * 1000
  const m = Math.floor(secPerKm / 60)
  const s = Math.floor(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

interface BarProps {
  label: string
  color: string
  pct: number
  distM: number
  elapsedS: number
}

function ProgressBar({ label, color, pct, distM, elapsedS }: BarProps) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{label}</span>
        <span>{fmtDist(distM)} · {fmtTime(elapsedS)}</span>
      </div>
      <div style={{
        height: '18px',
        background: '#0f172a',
        borderRadius: '999px',
        border: '1px solid #334155',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${clamped}%`,
          background: color,
          borderRadius: '999px',
          transition: 'width 0.12s ease-out',
        }} />
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
        {fmtPace(distM, elapsedS)}
      </div>
    </div>
  )
}

export function NonGpsView({ tick, targetDistM, ghostPaceSecPerKm }: Props) {
  const { user, ghost, delta } = tick.data

  // Ghost's expected distance at elapsed wall time: distance = elapsedS / paceSec * 1000
  // ghost.elapsed_s already equals pacerExpectedTimeSecs, so ghostDist = ghost.elapsed_s / ghostPaceSec * 1000
  const ghostDistM = ghostPaceSecPerKm > 0
    ? (ghost.elapsed_s / ghostPaceSecPerKm) * 1000
    : 0

  const userPct = (user.dist_m / targetDistM) * 100
  const ghostPct = (ghostDistM / targetDistM) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <ProgressBar
        label="You"
        color="#3b82f6"
        pct={userPct}
        distM={user.dist_m}
        elapsedS={user.elapsed_s}
      />
      <ProgressBar
        label="Ghost"
        color="#f97316"
        pct={ghostPct}
        distM={ghostDistM}
        elapsedS={ghost.elapsed_s}
      />

      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
        <DeltaBadge delta={delta} />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: '#64748b',
        borderTop: '1px solid #1e293b',
        paddingTop: '10px',
      }}>
        <span>Target: {fmtDist(targetDistM)}</span>
        <span>Sim time: {fmtTime(user.elapsed_s)}</span>
      </div>
    </div>
  )
}
