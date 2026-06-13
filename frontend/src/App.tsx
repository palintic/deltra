import { useState } from 'react'
import { useGhostSocket } from './hooks/useGhostSocket'
import { ControlPanel } from './components/ControlPanel'
import { NonGpsView } from './components/NonGpsView'
import { PRList } from './components/PRList'
import { RaceView } from './components/RaceView'
import type { PR } from './types'

type Tab = 'prs' | 'simulate'

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  padding: '8px 20px',
  borderRadius: '8px',
  border: 'none',
  background: active ? '#2563eb' : 'transparent',
  color: active ? '#fff' : '#64748b',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
})

export function App() {
  const { lastTick, connected } = useGhostSocket()
  const [tab, setTab] = useState<Tab>('prs')
  const [racingPR, setRacingPR] = useState<PR | null>(null)

  // Simulate tab state
  const [isRunning, setIsRunning] = useState(false)
  const [targetDistM, setTargetDistM] = useState(5000)
  const [ghostPaceSec, setGhostPaceSec] = useState(315)

  async function handleStart(userPace: number, ghostPace: number, distM: number) {
    const params = new URLSearchParams({
      user_pace: String(userPace),
      ghost_pace: String(ghostPace),
      target_dist_m: String(distM),
    })
    const res = await fetch(`/nongps/simulate/start?${params}`, { method: 'POST' })
    if (res.ok) {
      setTargetDistM(distM)
      setGhostPaceSec(ghostPace)
      setIsRunning(true)
    }
  }

  async function handleStop() {
    await fetch('/nongps/simulate/stop', { method: 'POST' })
    setIsRunning(false)
  }

  if (isRunning && lastTick?.shadow_mode === 'NON_GPS') {
    if (lastTick.data.user.dist_m >= targetDistM) setIsRunning(false)
  }

  const showRace = lastTick?.shadow_mode === 'NON_GPS'

  if (racingPR) {
    return (
      <Shell connected={connected}>
        <RaceView pr={racingPR} onBack={() => setRacingPR(null)} />
      </Shell>
    )
  }

  return (
    <Shell connected={connected}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', background: '#0f172a', padding: '4px', borderRadius: '10px', alignSelf: 'flex-start' }}>
        <button style={TAB_STYLE(tab === 'prs')} onClick={() => setTab('prs')}>My PRs</button>
        <button style={TAB_STYLE(tab === 'simulate')} onClick={() => setTab('simulate')}>Simulate</button>
      </div>

      {tab === 'prs' && (
        <PRList onRace={pr => setRacingPR(pr)} />
      )}

      {tab === 'simulate' && (
        <>
          <ControlPanel isRunning={isRunning} onStart={handleStart} onStop={handleStop} />
          {showRace && (
            <div style={{ padding: '24px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
              <NonGpsView tick={lastTick} targetDistM={targetDistM} ghostPaceSecPerKm={ghostPaceSec} />
            </div>
          )}
          {!showRace && !isRunning && (
            <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.9rem', padding: '40px 0' }}>
              Set your pace and distance, then hit Start.
            </div>
          )}
        </>
      )}
    </Shell>
  )
}

function Shell({ connected, children }: { connected: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1e',
      color: '#e2e8f0',
      fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Δ deltra</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: connected ? '#4ade80' : '#f87171' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: connected ? '#4ade80' : '#f87171' }} />
            {connected ? 'live' : 'connecting…'}
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
