package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"scene-on/backend/config"
	"scene-on/backend/middleware"
	"scene-on/backend/models"
	"time"

	"github.com/gin-gonic/gin"
)

type CreatePersonaRequest struct {
	Name        string `json:"name" binding:"required"`
	AvatarURL   string `json:"avatar_url"`
	Description string `json:"description"`
}

// GetOrCreatePersona gets or creates a persona for the user
func GetOrCreatePersona(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req CreatePersonaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Optimized: Single CTE query to validate user, check name uniqueness, and get existing persona
	var (
		userExists  bool
		nameTaken   bool
		personaID   sql.NullString
		avatarURL   sql.NullString
		description sql.NullString
		stats       sql.NullString
		createdAt   sql.NullTime
	)

	query := `
		WITH checks AS (
			SELECT 
				EXISTS(SELECT 1 FROM users WHERE id = $1) AS user_exists,
				EXISTS(SELECT 1 FROM personas WHERE LOWER(name) = LOWER($2) AND user_id != $1) AS name_taken
		)
		SELECT 
			c.user_exists,
			c.name_taken,
			p.id,
			p.avatar_url,
			p.description,
			p.stats,
			p.created_at
		FROM checks c
		LEFT JOIN personas p ON p.id = $1
	`

	err := config.DB.QueryRow(query, userID, req.Name).Scan(
		&userExists, &nameTaken, &personaID, &avatarURL, &description, &stats, &createdAt,
	)

	if err != nil {
		log.Printf("Failed to query persona data: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	if !userExists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not found. Please log in again.",
			"code":  "USER_NOT_FOUND",
		})
		return
	}

	if nameTaken {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Name already taken",
			"code":  "NAME_TAKEN",
		})
		return
	}

	now := time.Now()
	var persona models.Persona

	if personaID.Valid {
		// Update existing persona
		persona = models.Persona{
			ID:          userID,
			UserID:      userID,
			Name:        req.Name,
			AvatarURL:   req.AvatarURL,
			Description: req.Description,
			Stats:       models.JSONB{},
			IsActive:    true,
			CreatedAt:   createdAt.Time,
			UpdatedAt:   now,
		}

		if stats.Valid && stats.String != "" {
			var statsMap models.JSONB
			if err := json.Unmarshal([]byte(stats.String), &statsMap); err == nil {
				persona.Stats = statsMap
			}
		}

		_, err = config.DB.Exec(
			`UPDATE personas SET name = $1, avatar_url = $2, description = $3, updated_at = $4 WHERE id = $5`,
			persona.Name, persona.AvatarURL, persona.Description, now, persona.ID,
		)
		if err != nil {
			log.Printf("Failed to update persona: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update persona"})
			return
		}
	} else {
		// Create new persona
		persona = models.Persona{
			ID:          userID,
			UserID:      userID,
			Name:        req.Name,
			AvatarURL:   req.AvatarURL,
			Description: req.Description,
			Stats:       models.JSONB{},
			IsActive:    true,
			CreatedAt:   now,
			UpdatedAt:   now,
		}

		_, err = config.DB.Exec(
			`INSERT INTO personas (id, user_id, name, avatar_url, description, stats, is_active, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			persona.ID, persona.UserID, persona.Name, persona.AvatarURL, persona.Description,
			persona.Stats, persona.IsActive, persona.CreatedAt, persona.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to create persona: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create persona"})
			return
		}
	}

	c.JSON(http.StatusOK, persona)
}

// GetUserPersonas returns all personas for the current user
func GetUserPersonas(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	rows, err := config.DB.Query(
		`SELECT id, user_id, name, avatar_url, description, stats, is_active, created_at, updated_at
		 FROM personas
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		log.Printf("Failed to get personas: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get personas"})
		return
	}
	defer rows.Close()

	personas := make([]models.Persona, 0, 5)
	for rows.Next() {
		var p models.Persona
		err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.AvatarURL, &p.Description, &p.Stats,
			&p.IsActive, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			log.Printf("Failed to scan persona: %v", err)
			continue
		}
		personas = append(personas, p)
	}

	c.JSON(http.StatusOK, personas)
}
