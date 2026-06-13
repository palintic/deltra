import type { DeltaState } from '../types'

interface Props {
  delta: DeltaState
}

const TREND_ARROW: Record<DeltaState['trend'], string> = {
  rising: '↑',
  falling: '↓',
  stable: '→',
}

export function DeltaBadge({ delta }: Props) {
  const positive = delta.secs > 0
  const negative = delta.secs < 0

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 18px',
      borderRadius: '999px',
      fontSize: '1.4rem',
      fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
      background: positive ? '#14532d' : negative ? '#450a0a' : '#1e293b',
      color: positive ? '#4ade80' : negative ? '#f87171' : '#94a3b8',
      border: `1px solid ${positive ? '#16a34a' : negative ? '#dc2626' : '#334155'}`,
    }}>
      <span>{delta.label}</span>
      <span style={{ fontSize: '1rem' }}>{TREND_ARROW[delta.trend]}</span>
    </div>
  )
}
