package db

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type PR struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	DistanceM    float64 `json:"distance_m"`
	TimeSecs     float64 `json:"time_secs"`
	Date         string  `json:"date"`
	GpxFile      *string `json:"gpx_file"`
	CreatedAt    string  `json:"created_at"`
	PaceSecPerKm float64 `json:"pace_sec_per_km"`
}

func ListPRs(ctx context.Context, db *sql.DB) ([]PR, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, name, distance_m, time_secs,
		       COALESCE(date, ''), gpx_file, created_at
		FROM prs ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prs []PR
	for rows.Next() {
		var p PR
		var gpxFile sql.NullString
		var createdAt time.Time
		if err := rows.Scan(&p.ID, &p.Name, &p.DistanceM, &p.TimeSecs,
			&p.Date, &gpxFile, &createdAt); err != nil {
			return nil, err
		}
		if gpxFile.Valid {
			p.GpxFile = &gpxFile.String
		}
		p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		p.PaceSecPerKm = (p.TimeSecs / p.DistanceM) * 1000
		prs = append(prs, p)
	}
	if prs == nil {
		prs = []PR{}
	}
	return prs, rows.Err()
}

type CreatePRInput struct {
	Name      string  `json:"name"`
	DistanceM float64 `json:"distance_m"`
	TimeSecs  float64 `json:"time_secs"`
	Date      string  `json:"date"`
	GpxFile   *string `json:"gpx_file"`
}

func CreatePR(ctx context.Context, db *sql.DB, in CreatePRInput) (PR, error) {
	id := uuid.New().String()
	_, err := db.ExecContext(ctx, `
		INSERT INTO prs (id, name, distance_m, time_secs, date, gpx_file)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6)
	`, id, in.Name, in.DistanceM, in.TimeSecs, in.Date, in.GpxFile)
	if err != nil {
		return PR{}, err
	}
	// Fetch back to return full record with server-set created_at.
	prs, err := ListPRs(ctx, db)
	if err != nil {
		return PR{}, err
	}
	for _, p := range prs {
		if p.ID == id {
			return p, nil
		}
	}
	return PR{}, nil
}

func DeletePR(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM prs WHERE id = $1`, id)
	return err
}
