import type { PR } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const fetchPRs = () => request<PR[]>('/prs')

export const createPR = (data: {
  name: string
  distance_m: number
  time_secs: number
  date?: string
  gpx_file?: string | null
}) =>
  request<PR>('/prs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const deletePR = (id: string) =>
  request<void>(`/prs/${id}`, { method: 'DELETE' })

export const fetchGpxFiles = () => request<string[]>('/gpx-files')
