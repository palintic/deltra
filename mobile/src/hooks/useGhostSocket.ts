import { useEffect, useRef, useState } from 'react'
import type { TickMessage } from '../types'
import { WS_URL } from '../config'

const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 10_000

export function useGhostSocket() {
  const [lastTick, setLastTick] = useState<TickMessage | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) { ws.close(); return }
        attemptRef.current = 0
        setConnected(true)
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg.type === 'tick') setLastTick(msg as TickMessage)
        } catch { /* ignore malformed frames */ }
      }

      ws.onclose = () => {
        setConnected(false)
        if (cancelled) return
        const delay = Math.min(
          RECONNECT_BASE_MS * 2 ** attemptRef.current,
          RECONNECT_MAX_MS,
        )
        attemptRef.current++
        timerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [])

  return { lastTick, connected }
}
