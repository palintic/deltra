import { StyleSheet, Text, View } from 'react-native'
import type { DeltaState } from '../types'

const TREND_ARROW: Record<DeltaState['trend'], string> = {
  rising: '↑',
  falling: '↓',
  stable: '→',
}

export function DeltaBadge({ delta }: { delta: DeltaState }) {
  const positive = delta.secs > 0
  const negative = delta.secs < 0

  return (
    <View style={[
      styles.badge,
      positive ? styles.positive : negative ? styles.negative : styles.neutral,
    ]}>
      <Text style={[
        styles.label,
        positive ? styles.positiveText : negative ? styles.negativeText : styles.neutralText,
      ]}>
        {delta.label}
      </Text>
      <Text style={[
        styles.arrow,
        positive ? styles.positiveText : negative ? styles.negativeText : styles.neutralText,
      ]}>
        {TREND_ARROW[delta.trend]}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
  },
  positive: { backgroundColor: '#14532d', borderColor: '#16a34a' },
  negative: { backgroundColor: '#450a0a', borderColor: '#dc2626' },
  neutral:  { backgroundColor: '#1e293b', borderColor: '#334155' },
  label: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  arrow: { fontSize: 16 },
  positiveText: { color: '#4ade80' },
  negativeText:  { color: '#f87171' },
  neutralText:   { color: '#94a3b8' },
})
