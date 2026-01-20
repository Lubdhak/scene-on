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

	// ---- Optimized Connection Pool Settings ----
	// Max open connections: Balance between performance and resource usage
	DB.SetMaxOpenConns(25) // Increased for better concurrent request handling
	
	// Max idle connections: Keep connections warm for faster response
	DB.SetMaxIdleConns(10) // Increased to reduce connection overhead
	
	// Connection lifetime: Rotate connections to avoid stale connections
	DB.SetConnMaxLifetime(5 * time.Minute) // Shorter to handle database restarts better
	
	// Idle timeout: Close idle connections to free resources
	DB.SetConnMaxIdleTime(2 * time.Minute) // Shorter for better resource management

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
		// NOTE: Extensions are created by database/Makefile during db-create
		// These are kept here as no-ops for documentation purposes
		`CREATE EXTENSION IF NOT EXISTS pgcrypto`,
		
		`CREATE EXTENSION IF NOT EXISTS postgis`,

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
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		// Add new columns to existing yells table (for upgrading from old schema)
		`ALTER TABLE yells ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`,
		`ALTER TABLE yells ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`,
		`ALTER TABLE yells ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
		
		// Update existing rows with default values (copy from scenes table and set expiration)
		`UPDATE yells SET 
			latitude = COALESCE(yells.latitude, s.latitude),
			longitude = COALESCE(yells.longitude, s.longitude),
			expires_at = COALESCE(yells.expires_at, yells.created_at + INTERVAL '5 minutes')
		FROM scenes s 
		WHERE yells.scene_id = s.id AND (yells.latitude IS NULL OR yells.longitude IS NULL OR yells.expires_at IS NULL)`,

		// Make columns NOT NULL after setting defaults (will only succeed if no NULL values remain)
		`DO $$ 
		BEGIN
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='yells' AND column_name='latitude' AND is_nullable='YES') THEN
				ALTER TABLE yells ALTER COLUMN latitude SET NOT NULL;
			END IF;
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='yells' AND column_name='longitude' AND is_nullable='YES') THEN
				ALTER TABLE yells ALTER COLUMN longitude SET NOT NULL;
			END IF;
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='yells' AND column_name='expires_at' AND is_nullable='YES') THEN
				ALTER TABLE yells ALTER COLUMN expires_at SET NOT NULL;
			END IF;
		END $$`,

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

		`CREATE TABLE IF NOT EXISTS user_locations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			latitude DOUBLE PRECISION NOT NULL,
			longitude DOUBLE PRECISION NOT NULL,
			accuracy DOUBLE PRECISION,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,

		// ---- Performance Indexes ----
		// Composite index for chat messages - optimizes GetChatMessages query
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_request_id_created ON chat_messages(chat_request_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_from_scene ON chat_messages(from_scene_id)`,
		
		// Composite index for active chat lookups - optimizes GetActiveChatSessions
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_status_expires ON chat_requests(status, expires_at) WHERE status = 'accepted'`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_scenes_status ON chat_requests(from_scene_id, to_scene_id, status, expires_at)`,
		
		// Index for active scene lookups by persona - most frequent query
		`CREATE INDEX IF NOT EXISTS idx_scenes_persona_active ON scenes(persona_id, is_active, expires_at) WHERE is_active = true`,
		`CREATE INDEX IF NOT EXISTS idx_scenes_active_started ON scenes(is_active, started_at DESC) WHERE is_active = true`,
		
		// Spatial index for geographic queries (PostGIS)
		`CREATE INDEX IF NOT EXISTS idx_scenes_location_gist ON scenes USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))`,
		`CREATE INDEX IF NOT EXISTS idx_yells_location_gist ON yells USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))`,
		
		// Legacy indexes (kept for backward compatibility)
		`CREATE INDEX IF NOT EXISTS idx_scenes_location ON scenes(latitude, longitude)`,
		`CREATE INDEX IF NOT EXISTS idx_scenes_active_expires ON scenes(is_active, expires_at) WHERE is_active = true`,
		`CREATE INDEX IF NOT EXISTS idx_scenes_persona_id ON scenes(persona_id)`,
		`CREATE INDEX IF NOT EXISTS idx_personas_user_active ON personas(user_id, is_active) WHERE is_active = true`,
		`CREATE INDEX IF NOT EXISTS idx_personas_name_lower ON personas(LOWER(name))`,
		`CREATE INDEX IF NOT EXISTS idx_yells_scene_id ON yells(scene_id)`,
		`CREATE INDEX IF NOT EXISTS idx_yells_location ON yells(latitude, longitude)`,
		`CREATE INDEX IF NOT EXISTS idx_yells_expires_at ON yells(expires_at)`,
		// GIST spatial index for efficient ST_DWithin queries on yells
		`CREATE INDEX IF NOT EXISTS idx_yells_geography ON yells USING GIST (ST_MakePoint(longitude, latitude))`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_status ON chat_requests(status)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_from_scene ON chat_requests(from_scene_id)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_to_scene ON chat_requests(to_scene_id)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_from_to_status ON chat_requests(from_scene_id, to_scene_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_to_from_status ON chat_requests(to_scene_id, from_scene_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_expiration ON chat_requests(expires_at, status)`,
		// Removed: idx_chat_messages_request - replaced by idx_chat_messages_request_id_created above
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
