# deltra
Deltra allows user to compete against their own personal bests or any other user's records across two distinct environments.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [POC Scope](#2-poc-scope)
3. [POC Architecture](#3-poc-architecture)
4. [POC Tech Stack](#4-poc-tech-stack)
5. [POC Directory Structure](#5-poc-directory-structure)
6. [Core Algorithm — Ghost Interpolation](#6-core-algorithm--ghost-interpolation)
7. [WebSocket Event Schema](#7-websocket-event-schema)
8. [POC Setup & Running](#8-poc-setup--running)
9. [POC Success Metrics](#9-poc-success-metrics)
10. [Iteration Roadmap](#10-iteration-roadmap)
11. [Full Production Architecture](#11-full-production-architecture)
12. [Open Questions & Decisions](#12-open-questions--decisions)

---

## 1. Project Overview

**Deltra** is a real-time "Universal Shadow" overlay. It allows user to compete against their own personal bests or any other user's records across two distinct environments:
1. **Outdoor Mode (GPS):** Live marker on a map with spatial delta-tracking.
2. **Indoor Mode (Gym/Treadmill):** Progress-bar-based competition driven by distance sensors or manual input.

The core value is the **Real-Time Delta (Δ)**—the exact seconds you are ahead or behind a specific record, regardless of the venue.
---

## 2. POC Scope

The POC proves the "Universal Delta" concept: **a single engine providing sub-500ms latency updates for both GPS and non-GPS activities.**

### In scope

- [x] **Dual-Mode Engine:** Support for `GPS_MAP` and `DISTANCE_ONLY` shadow modes.
- [x] **Universal Replayer:** Simulated live-input for both GPS coordinates and raw distance increments.
- [x] **Distance-First Interpolation:** Ghost position lookup driven by cumulative distance (works for both modes).
- [x] **WebSocket Broadcast:** Single schema delivering `{mode, user, ghost, delta}` every second.
- [x] **Hybrid Frontend:** 
    - Map Rendering for GPS mode.
    - Progress Bar Rendering for Treadmill/Stationary mode.
- [x] **Storage:** PostgreSQL + PostGIS setup to handle both spatial tracks and distance-time series.

### Out of scope (deferred to V1+)

- [ ] Native iOS / Android app
- [ ] Real phone GPS
- [ ] Auth / user accounts (two users hardcoded)
- [ ] Social record discovery
- [ ] Kafka / Flink streaming pipeline
- [ ] Redis, ClickHouse
- [ ] Wearable (Watch) integration
- [ ] Offline map tiles

---

## 3. POC Architecture

```
┌─────────────────────────────────────────────────────┐
│                    POC (single machine)              │
│                                                      │
│  ┌──────────────┐     GPS ticks      ┌────────────┐ │
│  │ GPX Replayer │ ──────────────────▶│            │ │
│  │  (goroutine) │                    │   Ghost    │ │
│  └──────────────┘                    │   Engine   │ │
│                                      │            │ │
│  ┌──────────────┐   ghost pos+delta  │  (interp.) │ │
│  │  PostgreSQL  │◀──────────────────▶│            │ │
│  │  + PostGIS   │                    └─────┬──────┘ │
│  └──────────────┘                          │        │
│                                            ▼        │
│                                   ┌────────────────┐│
│                                   │  WebSocket     ││
│                                   │  Server (Go)   ││
│                                   └───────┬────────┘│
└───────────────────────────────────────────┼─────────┘
                                            │ ws://
                                            ▼
                                   ┌────────────────┐
                                   │ React + Mapbox │
                                   │ (browser)      │
                                   │                │
                                   │  [user dot]    │
                                   │  [ghost dot]   │
                                   │  [Δ badge]     │
                                   └────────────────┘
```

---

## 4. POC Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | **Go 1.22** | Low-latency goroutines, great for concurrent WebSocket sessions |
| WebSocket | `gorilla/websocket` | Battle-tested, simple API |
| GPX parsing | `tkrajina/gpx-go` | Parses GPX 1.0 and 1.1 |
| Database | **PostgreSQL 16 + PostGIS 3.4** | Spatial queries for future segment detection |
| ORM/queries | `pgx/v5` (raw SQL) | Avoid ORM overhead on hot paths |
| Frontend | **React 18 + Vite** | Fast iteration |
| Map | **Mapbox GL JS** | Free tier covers POC; best ghost overlay primitives |
| Containerisation | **Docker Compose** | Single `docker compose up` spins everything |

### Free tier limits for POC

| Service | Free allowance | POC usage |
|---|---|---|
| Mapbox | 50,000 map loads/month | ~500 (dev only) |
| Railway / Render | 500 hrs/month | Sufficient for dev |
| Supabase Postgres | 500 MB storage | Sufficient |

---

## 5. POC Directory Structure

```
shadowrun-poc/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go          # Entry point
│   ├── internal/
│   │   ├── ghost/
│   │   │   ├── engine.go        # Interpolation logic
│   │   │   └── engine_test.go
│   │   ├── replayer/
│   │   │   └── gpx.go           # GPX file → GPS tick stream
│   │   ├── ws/
│   │   │   └── hub.go           # WebSocket hub + broadcast
│   │   └── db/
│   │       └── activity.go      # Postgres queries
│   ├── data/
│   │   ├── ghost.gpx            # Pre-loaded ghost route
│   │   └── user.gpx             # Simulated user route
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── MapView.tsx      # Mapbox GL canvas
│   │   │   └── DeltaBadge.tsx   # "+4s" / "-2s" overlay
│   │   └── hooks/
│   │       └── useGhostSocket.ts
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── db/
│   └── migrations/
│       └── 001_init.sql         # Activities + PostGIS extension
├── docker-compose.yml
├── .env.example
└── README.md                    # This file
```

---

## 6. Core Algorithm — Ghost Interpolation

This is the heart of Deltra. To support both GPS and Indoor modes, the ghost's position is computed from **Cumulative Distance**, not elapsed time or timestamps. 

By using distance as the primary key, we achieve a "Universal Shadow" that works whether the user is on a mountain trail or a Peloton bike.

### Pre-processing (on activity upload / at startup)

```go
// RouteIndex is built once from the ghost's GPX track
type RoutePoint struct {
    Lat         float64
    Lng         float64
    CumDistance float64 // metres from start
    ElapsedSecs float64 // seconds from start
}

type RouteIndex struct {
    Points []RoutePoint
    Total  float64 // total distance in metres
}

// Build cumulative distance index using Haversine
func BuildIndex(track []gpx.TrackPoint) RouteIndex {
    points := make([]RoutePoint, len(track))
    cumDist := 0.0
    for i, pt := range track {
        if i > 0 {
            cumDist += haversine(track[i-1], pt)
        }
        points[i] = RoutePoint{
            Lat:         pt.Latitude,
            Lng:         pt.Longitude,
            CumDistance: cumDist,
            ElapsedSecs: pt.Timestamp.Sub(track[0].Timestamp).Seconds(),
        }
    }
    return RouteIndex{Points: points, Total: cumDist}
}
```

### Per-tick interpolation

```go
// GhostState is what gets broadcast to the frontend every second
type GhostState struct {
    Lat          float64 `json:"lat"`
    Lng          float64 `json:"lng"`
    DeltaSecs    float64 `json:"delta_secs"` // positive = user ahead, negative = user behind
    GhostPaceSec float64 `json:"ghost_pace"` // ghost pace at this point (sec/km)
}

func (idx *RouteIndex) Interpolate(userDistMetres, userElapsedSecs float64) GhostState {
    // Binary search for the segment containing userDistMetres
    i := sort.Search(len(idx.Points), func(i int) bool {
        return idx.Points[i].CumDistance >= userDistMetres
    })
    i = clamp(i, 1, len(idx.Points)-1)

    a, b := idx.Points[i-1], idx.Points[i]
    segLen := b.CumDistance - a.CumDistance
    t := 0.0
    if segLen > 0 {
        t = (userDistMetres - a.CumDistance) / segLen
    }

    ghostLat := a.Lat + t*(b.Lat-a.Lat)
    ghostLng := a.Lng + t*(b.Lng-a.Lng)
    ghostTimeSecs := a.ElapsedSecs + t*(b.ElapsedSecs-a.ElapsedSecs)

    return GhostState{
        Lat:          ghostLat,
        Lng:          ghostLng,
        DeltaSecs:    ghostTimeSecs - userElapsedSecs, // negative = ghost ahead
        GhostPaceSec: (b.ElapsedSecs - a.ElapsedSecs) / (segLen / 1000),
    }
}
```

**Key insight:** `delta_secs` is negative when the ghost is ahead of the user (ghost took less time to reach this distance), and positive when the user is ahead. Display convention: show as `"+4s"` (user ahead) or `"-2s"` (ghost ahead, i.e. user needs to push).

---

## 6.5. Shadow Modes — Beyond GPS

Not all shadow races happen outdoors on a mapped route. Treadmill, stationary bike, and gym treadmill runs are common and need a **distance-only** shadow model (no map, no lat/lng).

### Shadow mode types

| Mode | Data source | Display | Example |
|---|---|---|---|
| **Outdoor GPS** | Phone GPS | Map with ghost avatar + delta | Road run with Strava |
| **Treadmill** | BLE / ANT+ device | Distance progress bar + delta | Zwift treadmill run |
| **Stationary bike** | Wahoo / Peloton device | Leaderboard position + delta | Indoor cycle session |
| **Manual time entry** | User input (post-activity) | Time progress bar (no live) | Gym run logged later |

### POC scope for shadow modes

For the POC, support **outdoor GPS** only. The architecture must allow treadmill/stationary to be added in Phase 2.

### Treadmill shadow data model

```go
type ShadowMode string

const (
    ModeGPSMap      ShadowMode = "gps_map"       // Outdoor run with GPS trace
    ModeTreadmill   ShadowMode = "treadmill"     // Distance only, no location
    ModeStationary  ShadowMode = "stationary"    // Power + distance, no location
    ModeManualTime  ShadowMode = "manual_time"   // User logged post-activity
)

type Activity struct {
    ID          uuid.UUID
    UserID      uuid.UUID
    Type        string          // "run", "cycle", "swim"
    ShadowMode  ShadowMode      // How this activity can be raced against
    Distance    float64         // metres
    ElapsedSecs float64         // total time
    StartedAt   time.Time
    
    // GPS mode only
    GPXTrack    []gpx.TrackPoint // nil for non-GPS modes
    RouteIndex  *RouteIndex      // precomputed spatial index
    
    // Treadmill mode: pre-computed distance → time mapping
    DistanceCheckpoints []DistanceCheckpoint // [0m, 100m, 200m, ..., total]
    
    // Visibility & Privacy
    IsPublic    bool            // If true, anyone can ghost this record
    CreatedAt   time.Time
}

type DistanceCheckpoint struct {
    Distance    float64 // metres
    ElapsedSecs float64 // seconds from start
}
```

### Treadmill ghost broadcast (replaces GPS version)

```json
{
  "type": "tick",
  "ts": 1714000000,
  "shadow_mode": "treadmill",
  "user": {
    "distance_m": 1240.5,
    "elapsed_secs": 312,
    "pace_sec_km": 251.6
  },
  "ghost": {
    "distance_m": 1240.5,
    "elapsed_secs": 298.0,
    "pace_sec_km": 245.0
  },
  "delta_secs": -14.0,
  "delta_label": "-14s"
}
```

### Frontend rendering by mode

**GPS mode** (existing):
- Mapbox canvas with two markers, ghost animated along route
- Map pan/zoom follows user location
- Delta badge floating on map

**Treadmill mode** (Phase 2):
- No map — full-screen progress bar
- User progress bar (solid) vs ghost progress bar (faded)
- Distance readout and delta badge below bars
- Pace / cadence readout from device (if available)

```
┌─────────────────────────────────────────┐
│  TreadmillShadow.tsx                    │
│                                         │
│  Ghost: ████████░░░░ 1.2 km / 298 sec  │
│  You:   ██████████░░ 1.2 km / 312 sec  │
│                                         │
│  You're 14 seconds behind               │
│  Ghost pace: 4:05/km · Your pace: 5:12 │
└─────────────────────────────────────────┘
```

### POC architecture note

The POC's ghost engine remains **distance-only** (no map). This works for both GPS and treadmill:
- GPS mode: derive distance from GPS trace cumulative distance
- Treadmill mode: distance comes from device sensor or manual input

The only difference is frontend rendering. The ghost interpolation algorithm (section 6) is identical.

---

## 7. Dynamic WebSocket Architecture

### Server → Client (1Hz)

The schema is polymorphic based on `shadow_mode`.

```json
{
  "type": "tick",
  "shadow_mode": "GPS_MAP | DISTANCE_ONLY",
  "data": {
    "user": {
      "dist_m": 1240.5,
      "elapsed_s": 312,
      "coords": { "lat": 28.61, "lng": 77.20 } // null in DISTANCE_ONLY
    },
    "ghost": {
      "dist_m": 1240.5,
      "elapsed_s": 298.0,
      "coords": { "lat": 28.61, "lng": 77.20 } // null in DISTANCE_ONLY
    },
    "delta": {
      "secs": -14.0,
      "label": "-14s",
      "trend": "falling" // pace comparison
    }
  }
}
```

### Connection Lifecycle
1. **Handshake:** Client sends `activity_id` + `mode_request`.
2. **Sync:** Server pushes `RouteIndex` (GPS) or `DistanceSeries` (Indoor) for client-side smoothing.
3. **Stream:** Server pushes 1Hz sync ticks.
4. **Resiliency:** On disconnect, client continues "Dead Reckoning" based on last known pace.

---

## 8. POC Setup & Running

### Prerequisites

- Go 1.22+
- Node 20+
- Docker + Docker Compose
- Mapbox public token (free at mapbox.com)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/shadowrun-poc
cd shadowrun-poc
cp .env.example .env
# Edit .env — add your MAPBOX_TOKEN
```

### 2. Start Postgres

```bash
docker compose up -d postgres
```

### 3. Run database migrations

```bash
cd backend
go run ./cmd/migrate
```

### 4. Drop your GPX files in

```bash
cp ~/Downloads/my_run.gpx backend/data/user.gpx
cp ~/Downloads/ghost_run.gpx backend/data/ghost.gpx
```

> Tip: export any Strava activity as GPX via the activity page → ⋯ → Export GPX.

### 5. Start the backend

```bash
cd backend
go run ./cmd/server
# Server starts on :8080
# WebSocket endpoint: ws://localhost:8080/ws
```

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

### 7. Trigger the replay

```bash
curl -X POST http://localhost:8080/replay/start
```

Watch the browser — two dots should appear on the map and start moving.

---

## 9. POC Success Metrics

| Metric | Target | How to measure |
|---|---|---|
| Ghost update latency | < 500ms from GPS tick to map render | Browser DevTools → WS frame timestamps |
| Delta accuracy | Within ±2 seconds of manual calculation | Compare delta at known checkpoints in GPX |
| Map render smoothness | No jank at 1Hz tick rate | Chrome Performance tab |
| Cold start time | Backend ready in < 5s | `time go run ./cmd/server` |
| Memory footprint | < 50MB for backend process | `top` / `pprof` |

---

## 10. Iteration Roadmap

### Phase 1 — POC (current)
- [x] GPX replayer
- [x] Ghost interpolation engine
- [x] WebSocket server
- [x] React + Mapbox frontend
- [x] Docker Compose setup

### Phase 2 — Alpha (V0.1)
- [ ] Real GPS input from browser Geolocation API (no native app needed yet)
- [ ] Simple auth (email + password, JWT)
- [ ] Upload your own GPX as ghost
- [ ] Basic post-activity comparison screen (pace overlay chart)
- [ ] Deploy to Railway / Render (single server)

### Phase 3 — Beta (V0.2)
- [ ] iOS app (Swift, CoreLocation)
- [ ] Android app (Kotlin, FusedLocation)
- [ ] User profiles and PB tracking
- [ ] Social: follow athletes, browse their public activities
- [ ] Segment detection (PostGIS polyline matching)
- [ ] Leaderboards per segment

### Phase 4 — V1 (production-ready)
- [ ] Kafka event pipeline replaces in-process queue
- [ ] Flink streaming job for ghost interpolation at scale
- [ ] Redis for ghost session state
- [ ] ClickHouse for analytics and leaderboards
- [ ] Kubernetes deployment (EKS or GKE)
- [ ] Mapbox → self-hosted tile server (cost control)
- [ ] WatchOS / WearOS companion app
- [ ] Offline map tile packs

### Phase 5 — Growth
- [ ] Challenge links ("beat my record on this route")
- [ ] Curated ghost library (famous segments, pro athlete records)
- [ ] Subscription monetisation ($5–8/month)
- [ ] Strava import integration

---

## 11. Full Production Architecture

```
Mobile clients (iOS Swift / Android Kotlin / WatchOS)
        │
        ▼
API Gateway (Kong / AWS API Gateway)
  Auth (JWT) · Rate limiting · Routing
        │
        ├──▶ Activity Service (Go)      — GPX ingest, storage
        ├──▶ Shadow Service (Go)        — Ghost interpolation
        ├──▶ User Service (Go)          — Profiles, PBs, social graph
        └──▶ Segment Service (Go)       — Route matching, leaderboards
                │
                ▼
        Kafka (GPS event stream)
                │
                ▼
        Flink Streaming (ghost interpolation jobs)
                │
                ▼
        WebSocket Server → Mobile clients (live ghost push)

Data stores:
  PostgreSQL + PostGIS  — activities, users, segments
  Redis                 — ghost session state, leaderboard cache
  ClickHouse            — analytics, pace charts, heatmaps
  S3 / GCS              — GPX / FIT file storage
  CDN (CloudFront)      — map tiles, static assets
```

### Key design decisions (to revisit at each phase)

| Decision | POC choice | Production recommendation |
|---|---|---|
| Ghost interpolation | In-process, distance-based | Flink streaming job, same algorithm |
| GPS event bus | Go channel | Kafka topic per active session |
| Ghost session state | In-memory map | Redis hash, TTL = session duration |
| Map tiles | Mapbox hosted | Self-hosted OpenMapTiles past 100k MAU |
| Concurrent sessions | Single goroutine | One Flink job instance per ~1k sessions |
| Segment detection | PostGIS ST_HausdorffDistance | Same, add spatial index tuning |

---

## 12. Open Questions & Decisions

### Privacy & Permissions
- **Visibility Rule:** Users can only browse and "ghost" records where `is_public == true`. 
- **Personal Records:** Users always have access to their own records (public or private) for self-competition.
- **Privacy Zones:** Should we allow redacting the start/end of a route (privacy zones) for public records? (Recommendation: Yes, vital for home/work safety).
- **Ownership:** Who owns a ghost record if a user deletes their account?

### Product
- [ ] Distance-based vs time-based ghost interpolation? (Recommendation: distance-based — handles pauses better)
- [ ] Should "delta" show time ahead/behind, or distance ahead/behind?
- [ ] Maximum ghost session duration? (battery / WebSocket connection limits)
- [ ] Can a user ghost a route they haven't run before (ghost-only navigation)?
- [ ] **Treadmill shadows:** Should treadmill sessions be ghostable at all, or only outdoor GPS? (Recommendation: allow both — treadmill is huge for gym runners)
- [ ] **Treadmill accuracy:** How do we validate treadmill distance claims (BLE device sync vs manual entry)?
- [ ] **Mixed mode:** Can you shadow an outdoor route while running on a treadmill? (Recommendation: yes — distance is distance)

### Technical
- [ ] Form registry / activity ownership model — who can set a record as "ghostable"?
- [ ] How do we handle GPS drift causing cumulative distance errors mid-run?
- [ ] WebSocket reconnection strategy for mobile (network switches, tunnels)?
- [ ] Segment detection threshold — how similar must two routes be to match a segment?
- [ ] **Treadmill device sync:** Support Strava API, Wahoo, Peloton, Apple Health, Google Fit?
- [ ] **Distance verification:** For treadmill users without device, require ANT+/BLE sensor or accept manual input with asterisk ("unverified")?