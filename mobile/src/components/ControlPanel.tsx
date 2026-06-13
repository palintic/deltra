import { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

interface Props {
  isRunning: boolean
  onStart: (userPace: number, ghostPace: number, targetDistM: number) => void
  onStop: () => void
}

function parsePaceMmSs(value: string): number | null {
  const trimmed = value.trim()
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

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>YOUR PACE (MM:SS/KM)</Text>
          <TextInput
            style={[styles.input, isRunning && styles.inputDisabled]}
            value={userPaceStr}
            onChangeText={setUserPaceStr}
            editable={!isRunning}
            placeholder="5:00"
            placeholderTextColor="#475569"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>GHOST PACE (MM:SS/KM)</Text>
          <TextInput
            style={[styles.input, isRunning && styles.inputDisabled]}
            value={ghostPaceStr}
            onChangeText={setGhostPaceStr}
            editable={!isRunning}
            placeholder="5:15"
            placeholderTextColor="#475569"
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={[styles.field, { flex: 0.6 }]}>
          <Text style={styles.fieldLabel}>DIST (KM)</Text>
          <TextInput
            style={[styles.input, isRunning && styles.inputDisabled]}
            value={distKmStr}
            onChangeText={setDistKmStr}
            editable={!isRunning}
            placeholder="5"
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.btn, styles.startBtn, isRunning && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={isRunning}
        >
          <Text style={[styles.btnText, isRunning && styles.btnTextDisabled]}>Start</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.stopBtn, !isRunning && styles.stopBtnDisabled]}
          onPress={onStop}
          disabled={!isRunning}
        >
          <Text style={[styles.btnText, !isRunning && styles.stopBtnTextDisabled]}>Stop</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    gap: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 10, color: '#94a3b8', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    color: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  inputDisabled: { color: '#475569' },
  buttons: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  startBtn: { backgroundColor: '#2563eb' },
  startBtnDisabled: { backgroundColor: '#1e3a5f' },
  stopBtn: { backgroundColor: '#7f1d1d', borderWidth: 1, borderColor: '#991b1b' },
  stopBtnDisabled: { backgroundColor: '#1e293b', borderColor: '#334155' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnTextDisabled: { color: '#64748b' },
  stopBtnTextDisabled: { color: '#475569' },
  error: { color: '#f87171', fontSize: 13 },
})
