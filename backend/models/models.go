package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Persona struct {
	ID        uuid.UUID              `json:"id"`
	UserID    uuid.UUID              `json:"user_id"`
	Name      string                 `json:"name"`
	AvatarURL string                 `json:"avatar_url"`
	Stats     map[string]interface{} `json:"stats"`
	IsActive  bool                   `json:"is_active"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
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
	ID          uuid.UUID `json:"id"`
	FromSceneID uuid.UUID `json:"from_scene_id"`
	ToSceneID   uuid.UUID `json:"to_scene_id"`
	Status      string    `json:"status"` // pending, accepted, rejected
	CreatedAt   time.Time `json:"created_at"`
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
