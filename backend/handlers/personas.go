package handlers

import (
	"database/sql"
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
	log.Println("📥 GetOrCreatePersona hit")
	userID, _ := middleware.GetUserID(c)

	var req CreatePersonaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("❌ Failed to bind persona request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	log.Printf("👤 Persona request for name: %s (UserID: %v)", req.Name, userID)

	// CRITICAL: Check if user actually exists in the users table
	// This prevents the foreign key constraint violation (500 error)
	var userExists bool
	err := config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, userID).Scan(&userExists)
	if err != nil {
		log.Printf("❌ Failed to check user existence: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking user"})
		return
	}

	if !userExists {
		log.Printf("⚠️ UserID %v from token does not exist in database! (Stale token?)", userID)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User record not found. Please log out and log in again to refresh your account.",
			"code":  "USER_NOT_FOUND",
		})
		return
	}

	// Check if user already has a persona (using userID as personaID)
	var persona models.Persona
	err = config.DB.QueryRow(
		`SELECT id, user_id, name, avatar_url, description, stats, is_active, created_at, updated_at
		 FROM personas
		 WHERE id = $1
		 LIMIT 1`,
		userID,
	).Scan(&persona.ID, &persona.UserID, &persona.Name, &persona.AvatarURL, &persona.Description,
		&persona.Stats, &persona.IsActive, &persona.CreatedAt, &persona.UpdatedAt)

	if err == sql.ErrNoRows {
		// Create new persona with ID = userID
		persona = models.Persona{
			ID:          userID,
			UserID:      userID,
			Name:        req.Name,
			AvatarURL:   req.AvatarURL,
			Description: req.Description,
			Stats:       models.JSONB{},
			IsActive:    true,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
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

		log.Printf("✓ Created persona %s for user %s", persona.Name, userID)
	} else if err == nil {
		// Update existing persona
		persona.Name = req.Name
		persona.AvatarURL = req.AvatarURL
		persona.Description = req.Description
		persona.UpdatedAt = time.Now()

		_, err = config.DB.Exec(
			`UPDATE personas SET name = $1, avatar_url = $2, description = $3, updated_at = $4 WHERE id = $5`,
			persona.Name, persona.AvatarURL, persona.Description, persona.UpdatedAt, persona.ID,
		)

		if err != nil {
			log.Printf("Failed to update persona: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update persona"})
			return
		}

		log.Printf("✓ Updated persona %s for user %s", persona.Name, userID)
	} else {
		log.Printf("Failed to query persona: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get persona"})
		return
	}

	log.Printf("📤 Returning persona: %+v", persona)
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

	var personas []models.Persona
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

	if personas == nil {
		personas = []models.Persona{}
	}

	c.JSON(http.StatusOK, personas)
}
