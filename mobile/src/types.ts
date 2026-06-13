export interface Coords {
  lat: number
  lng: number
}

export interface EntityState {
  dist_m: number
  elapsed_s: number
  coords: Coords | null
}

export interface DeltaState {
  secs: number
  label: string
  trend: 'rising' | 'falling' | 'stable'
}

export interface TickData {
  user: EntityState
  ghost: EntityState
  delta: DeltaState
}

export interface TickMessage {
  type: 'tick'
  shadow_mode: 'GPS_MAP' | 'NON_GPS'
  data: TickData
}
