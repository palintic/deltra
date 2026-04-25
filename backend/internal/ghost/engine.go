package ghost

import (
	"sort"

	"github.com/tkrajina/gpxgo/gpx"
)

// RoutePoint represents a processed point on the ghost's track
type RoutePoint struct {
	Lat         float64
	Lng         float64
	CumDistance float64 // metres from start
	ElapsedSecs float64 // seconds from start
}

// RouteIndex holds the sequence of route points
type RouteIndex struct {
	Points []RoutePoint
	Total  float64 // total distance in metres
}

// BuildIndex builds the cumulative distance index using the Haversine formula
func BuildIndex(track []gpx.GPXPoint) RouteIndex {
	if len(track) == 0 {
		return RouteIndex{}
	}

	points := make([]RoutePoint, len(track))
	cumDist := 0.0
	for i, pt := range track {
		if i > 0 {
			cumDist += track[i-1].Distance2D(&track[i])
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

// GhostState is what gets broadcast to the frontend every second
type GhostState struct {
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	DeltaSecs    float64 `json:"delta_secs"` // positive = user ahead, negative = user behind
	GhostPaceSec float64 `json:"ghost_pace"` // ghost pace at this point (sec/km)
}

func clamp(val, min, max int) int {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}

func (idx *RouteIndex) Interpolate(userDistMetres, userElapsedSecs float64) GhostState {
	if len(idx.Points) == 0 {
		return GhostState{}
	}

	// Clamp userDistMetres
	if userDistMetres < 0 {
		userDistMetres = 0
	}
	if userDistMetres > idx.Total {
		userDistMetres = idx.Total
	}

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

	pace := 0.0
	if segLen > 0 {
		pace = (b.ElapsedSecs - a.ElapsedSecs) / (segLen / 1000.0)
	}

	return GhostState{
		Lat:          ghostLat,
		Lng:          ghostLng,
		DeltaSecs:    ghostTimeSecs - userElapsedSecs, // negative = ghost ahead
		GhostPaceSec: pace,
	}
}
