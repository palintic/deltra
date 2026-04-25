package replayer

import (
	"os"
	"path/filepath"
	"testing"
)

const validGPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mock">
  <trk>
    <trkseg>
      <trkpt lat="47.644548" lon="-122.326897">
        <ele>4.46</ele>
        <time>2009-10-17T18:37:26Z</time>
      </trkpt>
      <trkpt lat="47.644558" lon="-122.326887">
        <ele>4.94</ele>
        <time>2009-10-17T18:37:31Z</time>
      </trkpt>
      <trkpt lat="47.644568" lon="-122.326877">
        <ele>6.87</ele>
        <time>2009-10-17T18:37:34Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

func TestParseGPX(t *testing.T) {
	// Setup a temporary directory for test files
	tempDir, err := os.MkdirTemp("", "gpx_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create a valid GPX file
	validFilePath := filepath.Join(tempDir, "valid.gpx")
	if err := os.WriteFile(validFilePath, []byte(validGPX), 0644); err != nil {
		t.Fatalf("Failed to write valid test gpx: %v", err)
	}

	// Create an invalid GPX file
	invalidFilePath := filepath.Join(tempDir, "invalid.gpx")
	if err := os.WriteFile(invalidFilePath, []byte(`not an xml file`), 0644); err != nil {
		t.Fatalf("Failed to write invalid test gpx: %v", err)
	}

	tests := []struct {
		name          string
		filePath      string
		expectError   bool
		expectedCount int
	}{
		{
			name:          "Valid GPX File",
			filePath:      validFilePath,
			expectError:   false,
			expectedCount: 3,
		},
		{
			name:          "Invalid GPX File",
			filePath:      invalidFilePath,
			expectError:   true,
			expectedCount: 0,
		},
		{
			name:          "Non-existent File",
			filePath:      filepath.Join(tempDir, "does-not-exist.gpx"),
			expectError:   true,
			expectedCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			points, err := ParseGPX(tt.filePath)

			if tt.expectError && err == nil {
				t.Errorf("Expected an error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Did not expect an error but got: %v", err)
			}

			if len(points) != tt.expectedCount {
				t.Errorf("Expected %d points, got %d", tt.expectedCount, len(points))
			}

			if !tt.expectError && len(points) > 0 {
				// Spot check the first point
				if points[0].Latitude != 47.644548 || points[0].Longitude != -122.326897 {
					t.Errorf("Parsed point coordinates do not match expected values")
				}
			}
		})
	}
}
