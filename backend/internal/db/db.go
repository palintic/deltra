package db

import (
	"context"
	"database/sql"

	_ "github.com/jackc/pgx/v5/stdlib"
)

const schema = `
CREATE TABLE IF NOT EXISTS prs (
    id          TEXT        PRIMARY KEY,
    name        TEXT        NOT NULL,
    distance_m  REAL        NOT NULL,
    time_secs   REAL        NOT NULL,
    date        TEXT,
    gpx_file    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`

// DefaultDSN is used when DATABASE_URL env var is not set.
// Connects to a local Postgres instance using the OS user (peer auth).
const DefaultDSN = "postgres://localhost/deltra?sslmode=disable"

func Open(dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.PingContext(context.Background()); err != nil {
		return nil, err
	}
	if _, err := db.ExecContext(context.Background(), schema); err != nil {
		return nil, err
	}
	return db, nil
}
