package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// JSONB is a custom type for handling Postgres JSONB columns
type JSONB map[string]interface{}

// Value implements the driver.Valuer interface
func (j JSONB) Value() (driver.Value, error) {
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, j)
}

type User struct {
	ID                    uuid.UUID  `json:"id"`
	Email                 string     `json:"email"`
	LastLatitude          *float64   `json:"last_latitude,omitempty"`
	LastLongitude         *float64   `json:"last_longitude,omitempty"`
	LastLocationUpdatedAt *time.Time `json:"last_location_updated_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type Persona struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Name        string    `json:"name"`
	AvatarURL   string    `json:"avatar_url"`
	Description string    `json:"description"`
	Stats       JSONB     `json:"stats"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Scene struct {
	ID        uuid.UUID `json:"id"`
	PersonaID uuid.UUID `json:"persona_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	IsActive  bool      `json:"is_active"`
	StartedAt time.Time `json:"started_at"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type Yell struct {
	ID        uuid.UUID `json:"id"`
	SceneID   uuid.UUID `json:"scene_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type ChatRequest struct {
	ID          uuid.UUID  `json:"id"`
	FromSceneID uuid.UUID  `json:"from_scene_id"`
	ToSceneID   uuid.UUID  `json:"to_scene_id"`
	Message     *string    `json:"message,omitempty"`
	Status      string     `json:"status"` // pending, accepted, rejected, expired
	AcceptedAt  *time.Time `json:"accepted_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type ChatMessage struct {
	ID            uuid.UUID `json:"id"`
	ChatRequestID uuid.UUID `json:"chat_request_id"`
	FromSceneID   uuid.UUID `json:"from_scene_id"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"created_at"`
}

type OTPCode struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type UserLocation struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Accuracy  *float64  `json:"accuracy,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
