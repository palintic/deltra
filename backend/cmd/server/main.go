package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/joho/godotenv"
	appdb "github.com/palintic/deltra/backend/internal/db"
	"github.com/palintic/deltra/backend/internal/ghost"
	"github.com/palintic/deltra/backend/internal/replayer"
	"github.com/palintic/deltra/backend/internal/ws"
)

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func main() {
	godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// --- Database ---
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = appdb.DefaultDSN
	}
	database, err := appdb.Open(dsn)
	if err != nil {
		log.Printf("Warning: database unavailable (%v) — PR endpoints will return errors", err)
		database = nil
	} else {
		log.Println("Database connected")
	}

	// For the POC, we'll try to load dummy GPX files.
	// We check both "data/" and "backend/data/" to support running from root or backend folder.
	ghostPath := "data/ghost.gpx"
	if _, err := os.Stat(ghostPath); os.IsNotExist(err) {
		ghostPath = "backend/data/ghost.gpx"
	}
	ghostPts, err := replayer.ParseGPX(ghostPath)
	if err != nil {
		log.Printf("Warning: failed to load ghost.gpx from %s: %v", ghostPath, err)
	}
	ghostIndex := ghost.BuildIndex(ghostPts)

	userPath := "data/user.gpx"
	if _, err := os.Stat(userPath); os.IsNotExist(err) {
		userPath = "backend/data/user.gpx"
	}
	userPts, err := replayer.ParseGPX(userPath)
	if err != nil {
		log.Printf("Warning: failed to load user.gpx from %s: %v", userPath, err)
	}

	hub := ws.NewHub()

	http.HandleFunc("/ws", hub.HandleWS)

	var replayActive atomic.Bool

	http.HandleFunc("/replay/start", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if !replayActive.CompareAndSwap(false, true) {
			http.Error(w, "Replay already active", http.StatusConflict)
			return
		}

		if len(userPts) == 0 {
			replayActive.Store(false)
			http.Error(w, "No user GPX data loaded", http.StatusBadRequest)
			return
		}

		tickCh := make(chan replayer.Tick)
		replayer.StartReplay(userPts, tickCh, 10.0)

		go func() {
			defer replayActive.Store(false)
			for tick := range tickCh {
				// Interpolate ghost position
				ghostState := ghostIndex.Interpolate(tick.CumDistance, tick.ElapsedSecs)

				// Format delta label
				deltaLabel := fmt.Sprintf("%.1fs", ghostState.DeltaSecs)
				if ghostState.DeltaSecs > 0 {
					deltaLabel = fmt.Sprintf("+%.1fs", ghostState.DeltaSecs)
				} else if deltaLabel == "-0.0s" {
					deltaLabel = "0.0s"
				}

				// Trend is mock for now
				trend := "stable"
				if ghostState.DeltaSecs > 0 {
					trend = "rising"
				} else if ghostState.DeltaSecs < 0 {
					trend = "falling"
				}

				msg := ws.Message{
					Type:       "tick",
					ShadowMode: "GPS_MAP",
					Data: ws.TickData{
						User: ws.EntityState{
							DistM:    tick.CumDistance,
							ElapsedS: tick.ElapsedSecs,
							Coords: &ws.Coords{
								Lat: tick.Lat,
								Lng: tick.Lng,
							},
						},
						Ghost: ws.EntityState{
							DistM:    tick.CumDistance,                        // Ghost dist matches user dist in this model
							ElapsedS: tick.ElapsedSecs + ghostState.DeltaSecs, // wait, ghostElapsedSecs = userElapsedSecs + deltaSecs
							Coords: &ws.Coords{
								Lat: ghostState.Lat,
								Lng: ghostState.Lng,
							},
						},
						Delta: ws.DeltaState{
							Secs:  ghostState.DeltaSecs,
							Label: deltaLabel,
							Trend: trend,
						},
					},
				}
				hub.Broadcast(msg)
			}
		}()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Replay started"))
	})

	var (
		nonGpsActive atomic.Bool
		nonGpsMu     sync.Mutex
		nonGpsCancel context.CancelFunc
	)

	http.HandleFunc("/nongps/simulate/start", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if !nonGpsActive.CompareAndSwap(false, true) {
			http.Error(w, "Simulation already active", http.StatusConflict)
			return
		}

		q := r.URL.Query()

		userPaceSecPerKm := 300.0 // default 5:00/km
		if p, err := strconv.ParseFloat(q.Get("user_pace"), 64); err == nil && p > 0 {
			userPaceSecPerKm = p
		}

		ghostPaceSecPerKm := 315.0 // default 5:15/km
		if p, err := strconv.ParseFloat(q.Get("ghost_pace"), 64); err == nil && p > 0 {
			ghostPaceSecPerKm = p
		}

		targetDistM := 5000.0 // default 5 km
		if d, err := strconv.ParseFloat(q.Get("target_dist_m"), 64); err == nil && d > 0 {
			targetDistM = d
		}

		ctx, cancel := context.WithCancel(context.Background())
		nonGpsMu.Lock()
		nonGpsCancel = cancel
		nonGpsMu.Unlock()

		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("nongps simulation panic: %v", r)
				}
				nonGpsMu.Lock()
				nonGpsCancel = nil
				nonGpsMu.Unlock()
				nonGpsActive.Store(false)
			}()

			var elapsedSecs float64 = 0
			var userDistMetres float64 = 0

			ticker := time.NewTicker(100 * time.Millisecond) // tick 10 times a second for fast simulation
			defer ticker.Stop()

			// In simulation time, 100ms wall-clock = 1s simulation time (10x speedup)
			simTimePerTick := 1.0

			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
				}

				elapsedSecs += simTimePerTick
				// speed in m/s = 1000 / pace_sec_per_km
				userDistMetres += (1000.0 / userPaceSecPerKm) * simTimePerTick

				done := userDistMetres >= targetDistM
				if done {
					userDistMetres = targetDistM
				}

				ghostState := ghost.CalculatePacerState(userDistMetres, elapsedSecs, ghostPaceSecPerKm)

				deltaLabel := fmt.Sprintf("%.1fs", ghostState.DeltaSecs)
				if ghostState.DeltaSecs > 0 {
					deltaLabel = fmt.Sprintf("+%.1fs", ghostState.DeltaSecs)
				} else if deltaLabel == "-0.0s" {
					deltaLabel = "0.0s"
				}

				trend := "stable"
				if ghostState.DeltaSecs > 0 {
					trend = "rising"
				} else if ghostState.DeltaSecs < 0 {
					trend = "falling"
				}

				hub.Broadcast(ws.Message{
					Type:       "tick",
					ShadowMode: "NON_GPS",
					Data: ws.TickData{
						User: ws.EntityState{
							DistM:    userDistMetres,
							ElapsedS: elapsedSecs,
							Coords:   nil,
						},
						Ghost: ws.EntityState{
							DistM:    userDistMetres,
							ElapsedS: elapsedSecs + ghostState.DeltaSecs,
							Coords:   nil,
						},
						Delta: ws.DeltaState{
							Secs:  ghostState.DeltaSecs,
							Label: deltaLabel,
							Trend: trend,
						},
					},
				})

				if done {
					return
				}
			}
		}()

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Non-GPS Simulation started"))
	})

	http.HandleFunc("/nongps/simulate/stop", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		nonGpsMu.Lock()
		cancel := nonGpsCancel
		nonGpsMu.Unlock()

		if cancel == nil {
			http.Error(w, "No simulation active", http.StatusConflict)
			return
		}

		cancel()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Simulation stopped"))
	})

	// --- PR endpoints ---
	dataDir := "data"
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		dataDir = "backend/data"
	}

	http.HandleFunc("/gpx-files", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		entries, err := filepath.Glob(filepath.Join(dataDir, "*.gpx"))
		if err != nil || entries == nil {
			entries = []string{}
		}
		names := make([]string, len(entries))
		for i, e := range entries {
			names[i] = filepath.Base(e)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(names)
	}))

	http.HandleFunc("/prs", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if database == nil {
			http.Error(w, "Database not available", http.StatusServiceUnavailable)
			return
		}
		switch r.Method {
		case http.MethodGet:
			prs, err := appdb.ListPRs(r.Context(), database)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(prs)

		case http.MethodPost:
			var in appdb.CreatePRInput
			if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
				http.Error(w, "Bad request: "+err.Error(), http.StatusBadRequest)
				return
			}
			if strings.TrimSpace(in.Name) == "" || in.DistanceM <= 0 || in.TimeSecs <= 0 {
				http.Error(w, "name, distance_m and time_secs are required and must be positive", http.StatusBadRequest)
				return
			}
			pr, err := appdb.CreatePR(r.Context(), database, in)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(pr)

		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// /prs/{id} — DELETE only
	http.HandleFunc("/prs/", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if database == nil {
			http.Error(w, "Database not available", http.StatusServiceUnavailable)
			return
		}
		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/prs/")
		if id == "" {
			http.Error(w, "Missing PR id", http.StatusBadRequest)
			return
		}
		if err := appdb.DeletePR(r.Context(), database, id); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	log.Printf("Server starting on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
