import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useState } from 'react'
import { ControlPanel } from './src/components/ControlPanel'
import { NonGpsView } from './src/components/NonGpsView'
import { useGhostSocket } from './src/hooks/useGhostSocket'
import { BACKEND_URL } from './src/config'

export default function App() {
  const { lastTick, connected } = useGhostSocket()
  const [isRunning, setIsRunning] = useState(false)
  const [targetDistM, setTargetDistM] = useState(5000)
  const [ghostPaceSec, setGhostPaceSec] = useState(315)

  async function handleStart(userPace: number, ghostPace: number, distM: number) {
    const params = new URLSearchParams({
      user_pace: String(userPace),
      ghost_pace: String(ghostPace),
      target_dist_m: String(distM),
    })
    const res = await fetch(`${BACKEND_URL}/nongps/simulate/start?${params}`, { method: 'POST' })
    if (res.ok) {
      setTargetDistM(distM)
      setGhostPaceSec(ghostPace)
      setIsRunning(true)
    }
  }

  async function handleStop() {
    await fetch(`${BACKEND_URL}/nongps/simulate/stop`, { method: 'POST' })
    setIsRunning(false)
  }

  if (isRunning && lastTick?.shadow_mode === 'NON_GPS') {
    if (lastTick.data.user.dist_m >= targetDistM) setIsRunning(false)
  }

  const showRace = lastTick?.shadow_mode === 'NON_GPS'

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Δ deltra</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: connected ? '#4ade80' : '#f87171' }]} />
            <Text style={[styles.statusText, { color: connected ? '#4ade80' : '#f87171' }]}>
              {connected ? 'live' : 'connecting…'}
            </Text>
          </View>
        </View>

        <ControlPanel isRunning={isRunning} onStart={handleStart} onStop={handleStop} />

        {showRace && lastTick ? (
          <View style={styles.card}>
            <NonGpsView tick={lastTick} targetDistM={targetDistM} ghostPaceSecPerKm={ghostPaceSec} />
          </View>
        ) : !isRunning ? (
          <Text style={styles.hint}>Set your pace and distance, then hit Start.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0f1e' },
  scroll: { padding: 20, gap: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#e2e8f0', letterSpacing: -0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
  },
  hint: { textAlign: 'center', color: '#475569', fontSize: 14, paddingVertical: 40 },
})
