package config

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDatabase() error {
	connStr := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s timezone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_SSLMODE"),
	)

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Optimize connection pool for performance
	DB.SetMaxOpenConns(50)           // Increased for better concurrency
	DB.SetMaxIdleConns(10)           // More idle connections ready
	DB.SetConnMaxLifetime(5 * time.Minute) // Recycle connections every 5min
	DB.SetConnMaxIdleTime(2 * time.Minute) // Close idle connections after 2min

	log.Println("✓ Database connected successfully")
	
	// Run migrations
	if err := runMigrations(); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

func runMigrations() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email VARCHAR(255) UNIQUE NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS personas (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(100) NOT NULL,
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
		`CREATE INDEX IF NOT EXISTS idx_scenes_location ON scenes(latitude, longitude)`,
		`CREATE INDEX IF NOT EXISTS idx_scenes_active ON scenes(is_active, expires_at)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_status ON chat_requests(status)`,
		`CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, expires_at)`,
		`CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id, created_at DESC)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_updated_at TIMESTAMP`,
		// Chat enhancements for message support and expiration
		`ALTER TABLE chat_requests ADD COLUMN IF NOT EXISTS message TEXT`,
		`ALTER TABLE chat_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
		`ALTER TABLE chat_requests ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_to_scene ON chat_requests(to_scene_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_expiration ON chat_requests(expires_at, status)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_request ON chat_messages(chat_request_id, created_at)`,
		// Persona customization support
		`ALTER TABLE personas ADD COLUMN IF NOT EXISTS description VARCHAR(255)`,

		// Performance indexes for spatial queries and active scene lookups
		`CREATE INDEX IF NOT EXISTS idx_scenes_active_expires ON scenes(is_active, expires_at) WHERE is_active = true`,
		`CREATE INDEX IF NOT EXISTS idx_personas_user_active ON personas(user_id, is_active) WHERE is_active = true`,
		`CREATE INDEX IF NOT EXISTS idx_chat_requests_scenes ON chat_requests(from_scene_id, to_scene_id, status, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_scenes_persona_active ON scenes(persona_id, is_active, expires_at)`,

		// Migration to TIMESTAMPTZ for existing columns
		`ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE users ALTER COLUMN last_location_updated_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE personas ALTER COLUMN created_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE personas ALTER COLUMN updated_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE scenes ALTER COLUMN started_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE scenes ALTER COLUMN expires_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE scenes ALTER COLUMN created_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE yells ALTER COLUMN created_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE chat_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE chat_requests ALTER COLUMN expires_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE chat_requests ALTER COLUMN accepted_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE chat_messages ALTER COLUMN created_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE otp_codes ALTER COLUMN expires_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE otp_codes ALTER COLUMN created_at TYPE TIMESTAMPTZ`,
		`ALTER TABLE user_locations ALTER COLUMN created_at TYPE TIMESTAMPTZ`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	log.Println("✓ Database migrations completed")
	return nil
}

func CloseDatabase() {
	if DB != nil {
		DB.Close()
		log.Println("Database connection closed")
	}
}
