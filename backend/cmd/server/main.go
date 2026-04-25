package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"sync/atomic"

	"github.com/joho/godotenv"
	"github.com/palintic/deltra/backend/internal/ghost"
	"github.com/palintic/deltra/backend/internal/replayer"
	"github.com/palintic/deltra/backend/internal/ws"
)

func main() {
	godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
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

	log.Printf("Server starting on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
