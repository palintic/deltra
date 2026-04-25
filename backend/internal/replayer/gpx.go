package replayer

import (
	"time"

	"github.com/tkrajina/gpxgo/gpx"
)

type Tick struct {
	Lat         float64
	Lng         float64
	CumDistance float64
	ElapsedSecs float64
}

// ParseGPX loads a GPX file and returns the flat track points
func ParseGPX(filePath string) ([]gpx.GPXPoint, error) {
	gpxFile, err := gpx.ParseFile(filePath)
	if err != nil {
		return nil, err
	}
	var points []gpx.GPXPoint
	for _, track := range gpxFile.Tracks {
		for _, segment := range track.Segments {
			points = append(points, segment.Points...)
		}
	}
	return points, nil
}

// StartReplay starts a goroutine that emits ticks to the channel.
// speedMultiplier allows faster playback for testing.
func StartReplay(points []gpx.GPXPoint, tickCh chan<- Tick, speedMultiplier float64) {
	go func() {
		defer close(tickCh)
		if len(points) == 0 {
			return
		}

		startTime := points[0].Timestamp
		cumDist := 0.0

		for i, pt := range points {
			if i > 0 {
				cumDist += points[i-1].Distance2D(&pt)
			}

			elapsedSecs := pt.Timestamp.Sub(startTime).Seconds()

			tickCh <- Tick{
				Lat:         pt.Latitude,
				Lng:         pt.Longitude,
				CumDistance: cumDist,
				ElapsedSecs: elapsedSecs,
			}

			if i < len(points)-1 {
				nextPt := points[i+1]
				delta := nextPt.Timestamp.Sub(pt.Timestamp)
				if speedMultiplier > 0 && delta > 0 {
					sleepDur := time.Duration(float64(delta) / speedMultiplier)
					time.Sleep(sleepDur)
				}
			}
		}
	}()
}
