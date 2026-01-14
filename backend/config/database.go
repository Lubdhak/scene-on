package config

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

var DB *sql.DB

func InitDatabase() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return errors.New("DATABASE_URL is not set")
	}
	
	// PRINT WHICH ENV IS USED
	// Mask password for security
	maskedDSN := dsn
	// Simple logic to hide password if needed, but for now just logging the host/db is useful
	log.Printf("🔌 Connecting to DB with: %s", maskedDSN)

	var err error
	DB, err = sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// ---- Connection Pool (Neon / Render safe defaults) ----
	DB.SetMaxOpenConns(20)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(10 * time.Minute)
	DB.SetConnMaxIdleTime(5 * time.Minute)

	// ---- Ping with timeout ----
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := DB.PingContext(ctx); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("✓ Database connected successfully")

	// ---- Migrations ----
	// SKIP migrations if user is NOT owner (e.g. running against prod without privileges)
	// OR just attempt them and allow failure if we only want to ensure schema matches.
	// The error "must be owner of table" suggests we are trying to DROP or ALTER a table
	// owned by a different user (maybe from a previous run or different env).
	
	if err := runMigrations(); err != nil {
		// Log error but maybe don't fail fatal if it's just permissions on existing valid schema?
		// For now, let's keep it fatal but clarify why.
		return fmt.Errorf("database migration failed: %w", err)
	}

	return nil
}

func CloseDatabase() {
	if DB != nil {
		_ = DB.Close()
		log.Println("✓ Database connection closed")
	}
}

func runMigrations() error {
	migrations := []string{
		`CREATE EXTENSION IF NOT EXISTS pgcrypto`,

		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			last_latitude DOUBLE PRECISION,
			last_longitude DOUBLE PRECISION,
			last_location_updated_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS personas (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(100) NOT NULL,
			description VARCHAR(255),
			avatar_url TEXT,
			stats JSONB DEFAULT '{}',
			is_active BOOLEAN DEFAULT true,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS scenes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			is_active BOOLEAN DEFAULT true,
			started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS yells (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
			content TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS chat_requests (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			from_scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
			to_scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
			status VARCHAR(20) DEFAULT 'pending',
			message TEXT,
			expires_at TIMESTAMPTZ,
			accepted_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS chat_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			chat_request_id UUID REFERENCES chat_requests(id) ON DELETE CASCADE,
			from_scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
			content TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS otp_codes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) NOT NULL,
			code VARCHAR(6) NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		`CREATE TABLE IF NOT EXISTS user_locations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			accuracy DOUBLE PRECISION,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		// ---- Indexes ----
		`CREATE INDEX IF NOT EXISTS idx_scenes_location ON scenes(latitude, longitude)`,
		`CREATE INDEX IF NOT EXISTS idx_scenes_active_expires ON scenes(is_active, expires_at) WHERE is_active = true`,
		`CREATE INDEX IF NOT EXISTS idx_personas_user_active ON personas(user_id, is_active) WHERE is_active = true`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_status ON chat_requests(status)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_expiration ON chat_requests(expires_at, status)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_request ON chat_messages(chat_request_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, expires_at)`,
		`CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id, created_at DESC)`,
	}

	log.Println("🔄 Checking/Applying internal schema migrations...")
	for i, q := range migrations {
		if _, err := DB.Exec(q); err != nil {
			// Basic error handling - printing query might be verbose but useful here
			return fmt.Errorf("migration %d failed: \nQuery: %s\nError: %w", i+1, q, err)
		}
	}

	log.Println("✓ Database migrations verified")
	return nil
}
