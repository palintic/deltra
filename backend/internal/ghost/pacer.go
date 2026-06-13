package ghost

// CalculatePacerState calculates the GhostState for a non-GPS activity
// where both the user and pacer are assumed to be moving at constant paces.
// pacerPaceSecPerKm is the target pace of the pacer in seconds per kilometer.
func CalculatePacerState(userDistMetres, userElapsedSecs, pacerPaceSecPerKm float64) GhostState {
	// How long *should* the pacer take to cover userDistMetres?
	// pace is sec/km. distance is metres.
	// time = distance_km * pace
	pacerExpectedTimeSecs := (userDistMetres / 1000.0) * pacerPaceSecPerKm

	// delta is positive if user is ahead (took less time than pacer)
	// delta is negative if user is behind (took more time than pacer)
	deltaSecs := pacerExpectedTimeSecs - userElapsedSecs

	return GhostState{
		Lat:          0, // No GPS coordinates
		Lng:          0,
		DeltaSecs:    deltaSecs,
		GhostPaceSec: pacerPaceSecPerKm,
	}
}
