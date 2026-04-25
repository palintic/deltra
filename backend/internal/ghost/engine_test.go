package ghost

import (
	"math"
	"testing"
	"time"

	"github.com/tkrajina/gpxgo/gpx"
)

func TestBuildIndex(t *testing.T) {
	track := []gpx.GPXPoint{
		{
			Point: gpx.Point{
				Latitude:  0,
				Longitude: 0,
			},
			Timestamp: time.Unix(0, 0),
		},
		{
			Point: gpx.Point{
				Latitude:  0,
				Longitude: 0.01,
			},
			Timestamp: time.Unix(10, 0),
		},
	}

	index := BuildIndex(track)
	if len(index.Points) != 2 {
		t.Fatalf("Expected 2 points, got %d", len(index.Points))
	}

	if index.Points[0].CumDistance != 0 {
		t.Errorf("Expected 0 distance for first point, got %v", index.Points[0].CumDistance)
	}

	if index.Points[1].CumDistance <= 0 {
		t.Errorf("Expected >0 distance for second point, got %v", index.Points[1].CumDistance)
	}

	if index.Points[1].ElapsedSecs != 10 {
		t.Errorf("Expected 10 seconds elapsed, got %v", index.Points[1].ElapsedSecs)
	}
}

func TestInterpolate(t *testing.T) {
	index := RouteIndex{
		Points: []RoutePoint{
			{Lat: 0, Lng: 0, CumDistance: 0, ElapsedSecs: 0},
			{Lat: 0, Lng: 10, CumDistance: 1000, ElapsedSecs: 100},
			{Lat: 0, Lng: 20, CumDistance: 2000, ElapsedSecs: 200},
		},
		Total: 2000,
	}

	// Test exact match
	state := index.Interpolate(1000, 100)
	if state.Lat != 0 || state.Lng != 10 {
		t.Errorf("Expected exactly point 2, got Lat:%v Lng:%v", state.Lat, state.Lng)
	}
	if state.DeltaSecs != 0 {
		t.Errorf("Expected 0 delta, got %v", state.DeltaSecs)
	}
	if state.GhostPaceSec != 100 { // 100 sec for 1km = 100
		t.Errorf("Expected 100 ghost pace, got %v", state.GhostPaceSec)
	}

	// Test interpolation halfway between point 2 and 3
	state = index.Interpolate(1500, 160)
	if state.Lat != 0 || state.Lng != 15 {
		t.Errorf("Expected halfway interpolated Lng 15, got Lat:%v Lng:%v", state.Lat, state.Lng)
	}
	// ghost time at 1500m is 150s. User elapsed is 160s. ghostTime - userTime = 150 - 160 = -10
	if state.DeltaSecs != -10 {
		t.Errorf("Expected delta -10, got %v", state.DeltaSecs)
	}

	// Test clamp below
	state = index.Interpolate(-100, 0)
	if math.IsNaN(state.Lat) || math.IsNaN(state.Lng) {
		t.Errorf("Expected no NaN, got Lat:%v Lng:%v", state.Lat, state.Lng)
	}

	// Test clamp above
	state = index.Interpolate(3000, 300)
	if state.Lat != 0 || state.Lng != 20 {
		t.Errorf("Expected clamp to end point Lng 20, got Lat:%v Lng:%v", state.Lat, state.Lng)
	}
}
