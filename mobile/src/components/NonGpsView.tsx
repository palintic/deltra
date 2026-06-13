import { StyleSheet, Text, View } from 'react-native'
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
    <View style={styles.barWrapper}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barMeta}>{fmtDist(distM)} · {fmtTime(elapsedS)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${clamped}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.barPace}>{fmtPace(distM, elapsedS)}</Text>
    </View>
  )
}

export function NonGpsView({ tick, targetDistM, ghostPaceSecPerKm }: Props) {
  const { user, ghost, delta } = tick.data

  const ghostDistM = ghostPaceSecPerKm > 0
    ? (ghost.elapsed_s / ghostPaceSecPerKm) * 1000
    : 0

  const userPct = (user.dist_m / targetDistM) * 100
  const ghostPct = (ghostDistM / targetDistM) * 100

  return (
    <View style={styles.container}>
      <ProgressBar label="You" color="#3b82f6" pct={userPct} distM={user.dist_m} elapsedS={user.elapsed_s} />
      <ProgressBar label="Ghost" color="#f97316" pct={ghostPct} distM={ghostDistM} elapsedS={ghost.elapsed_s} />

      <View style={styles.deltaRow}>
        <DeltaBadge delta={delta} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Target: {fmtDist(targetDistM)}</Text>
        <Text style={styles.footerText}>Sim time: {fmtTime(user.elapsed_s)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  barWrapper: { gap: 6 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 13, fontWeight: '600', color: '#e2e8f0' },
  barMeta: { fontSize: 13, color: '#94a3b8' },
  barTrack: {
    height: 18,
    backgroundColor: '#0f172a',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  barPace: { fontSize: 12, color: '#64748b', textAlign: 'right' },
  deltaRow: { alignItems: 'center', paddingTop: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 10,
  },
  footerText: { fontSize: 13, color: '#64748b' },
})
