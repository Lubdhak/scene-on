package handlers

import (
	"context"
	"log"
	"net/http"
	"scene-on/backend/config"
	"scene-on/backend/middleware"
	"scene-on/backend/models"
	"scene-on/backend/websocket"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	YellMaxLength       = 32
	YellDuration        = 5 * time.Minute
	YellCooldownPeriod  = 5 * time.Minute
)

type BroadcastYellRequest struct {
	Content string `json:"content" binding:"required,max=32"`
}

type YellWithPersona struct {
	models.Yell
	PersonaName   string `json:"persona_name"`
	PersonaAvatar string `json:"persona_avatar"`
	SceneID       string `json:"scene_id"`
}

// BroadcastYell creates and broadcasts a yell to nearby scenes
func BroadcastYell(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)

		var req BroadcastYellRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Content is required and must be max 32 characters"})
			return
		}

		// Validate content length
		if len(req.Content) > YellMaxLength {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Content must be max 32 characters"})
			return
		}

		if len(req.Content) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Content cannot be empty"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		// Get user's active scene with location
		var scene models.Scene
		err := config.DB.QueryRowContext(ctx, `
			SELECT id, persona_id, latitude, longitude, is_active, started_at, expires_at, created_at
			FROM scenes
			WHERE persona_id = $1 AND is_active = true AND expires_at > NOW()
			ORDER BY started_at DESC
			LIMIT 1
		`, userID).Scan(
			&scene.ID, &scene.PersonaID, &scene.Latitude, &scene.Longitude,
			&scene.IsActive, &scene.StartedAt, &scene.ExpiresAt, &scene.CreatedAt,
		)

		if err != nil {
			log.Printf("Failed to get active scene for user %s: %v", userID, err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "No active scene found. Start a scene first."})
			return
		}

		// TODO: Re-enable cooldown check after testing
		// Check for recent yells (cooldown period)
		/*
		var lastYellTime *time.Time
		err = config.DB.QueryRowContext(ctx, `
			SELECT created_at
			FROM yells
			WHERE scene_id = $1
			ORDER BY created_at DESC
			LIMIT 1
		`, scene.ID).Scan(&lastYellTime)

		if err == nil && lastYellTime != nil {
			timeSinceLastYell := time.Since(*lastYellTime)
			if timeSinceLastYell < YellCooldownPeriod {
				remainingSeconds := int((YellCooldownPeriod - timeSinceLastYell).Seconds())
				c.JSON(http.StatusTooManyRequests, gin.H{
					"error":            "You must wait before yelling again",
					"retry_after":      remainingSeconds,
					"next_yell_at":     lastYellTime.Add(YellCooldownPeriod).Unix(),
				})
				return
			}
		}
		*/

		// Create yell
		yellID := uuid.New()
		expiresAt := time.Now().Add(YellDuration)
		
		_, err = config.DB.ExecContext(ctx, `
			INSERT INTO yells (id, scene_id, content, latitude, longitude, expires_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
		`, yellID, scene.ID, req.Content, scene.Latitude, scene.Longitude, expiresAt)

		if err != nil {
			log.Printf("Failed to create yell: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create yell"})
			return
		}

		// Get persona info for broadcast
		var personaName, personaAvatar string
		err = config.DB.QueryRowContext(ctx, `
			SELECT name, avatar_url
			FROM personas
			WHERE id = $1
		`, scene.PersonaID).Scan(&personaName, &personaAvatar)

		if err != nil {
			log.Printf("Failed to get persona info: %v", err)
			// Continue anyway, we'll use empty strings
		}

		// Broadcast to nearby scenes in a goroutine (non-blocking)
		go func() {
			log.Printf("🔊 Starting yell broadcast for scene %s", scene.ID)
			
			// Get user's distance radius setting
			var radiusKm float64
			err := config.DB.QueryRow(`
				SELECT COALESCE(
					(stats->>'distance_radius_km')::float,
					50.0
				)
				FROM personas
				WHERE id = $1
			`, scene.PersonaID).Scan(&radiusKm)

			if err != nil || radiusKm == 0 {
				log.Printf("⚠️ Failed to get radius or radius is 0, using default 50km: %v", err)
				radiusKm = 50.0 // Default 50km
			}

			radiusMeters := radiusKm * 1000
			log.Printf("📡 Broadcasting yell within %.1fkm (%.0fm) from location (%.6f, %.6f)", 
				radiusKm, radiusMeters, scene.Latitude, scene.Longitude)

			msg := websocket.Message{
				Type: "yell_broadcast",
				Data: map[string]interface{}{
					"id":             yellID.String(),
					"scene_id":       scene.ID.String(),
					"content":        req.Content,
					"persona_name":   personaName,
					"persona_avatar": personaAvatar,
					"latitude":       scene.Latitude,
					"longitude":      scene.Longitude,
					"expires_at":     expiresAt.Unix(),
					"created_at":     time.Now().Unix(),
				},
			}

			log.Printf("📨 Message prepared: %+v", msg.Data)
			wsHub.BroadcastToNearby(msg, scene.Latitude, scene.Longitude, radiusMeters, scene.ID)
			log.Printf("✓ Yell broadcast completed for scene %s (radius: %.1fkm)", scene.ID, radiusKm)
		}()

		c.JSON(http.StatusOK, gin.H{
			"id":             yellID.String(),
			"scene_id":       scene.ID.String(),
			"content":        req.Content,
			"latitude":       scene.Latitude,
			"longitude":      scene.Longitude,
			"expires_at":     expiresAt.Unix(),
			"next_yell_at":   time.Now().Add(YellCooldownPeriod).Unix(),
		})
	}
}

// GetNearbyYells retrieves active yells within the user's radius
func GetNearbyYells() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)

		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		// Get user's active scene
		var scene models.Scene
		err := config.DB.QueryRowContext(ctx, `
			SELECT id, persona_id, latitude, longitude
			FROM scenes
			WHERE persona_id = $1 AND is_active = true AND expires_at > NOW()
			ORDER BY started_at DESC
			LIMIT 1
		`, userID).Scan(&scene.ID, &scene.PersonaID, &scene.Latitude, &scene.Longitude)

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No active scene found"})
			return
		}

		// Get user's distance radius setting
		var radiusKm float64
		err = config.DB.QueryRowContext(ctx, `
			SELECT COALESCE(
				(stats->>'distance_radius_km')::float,
				50.0
			)
			FROM personas
			WHERE id = $1
		`, scene.PersonaID).Scan(&radiusKm)

		if err != nil || radiusKm == 0 {
			radiusKm = 50.0
		}

		radiusMeters := radiusKm * 1000

		// Query nearby yells using PostGIS
		rows, err := config.DB.QueryContext(ctx, `
			SELECT 
				y.id,
				y.scene_id,
				y.content,
				y.latitude,
				y.longitude,
				y.expires_at,
				y.created_at,
				p.name,
				p.avatar_url
			FROM yells y
			JOIN scenes s ON y.scene_id = s.id
			JOIN personas p ON s.persona_id = p.id
			WHERE y.expires_at > NOW()
			  AND y.scene_id != $1
			  AND ST_DWithin(
				  ST_SetSRID(ST_MakePoint(y.longitude, y.latitude), 4326)::geography,
				  ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
				  $4
			  )
			ORDER BY y.created_at DESC
		`, scene.ID, scene.Longitude, scene.Latitude, radiusMeters)

		if err != nil {
			log.Printf("Failed to query nearby yells: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve yells"})
			return
		}
		defer rows.Close()

		yells := []YellWithPersona{}
		for rows.Next() {
			var yell YellWithPersona
			err := rows.Scan(
				&yell.ID,
				&yell.SceneID,
				&yell.Content,
				&yell.Latitude,
				&yell.Longitude,
				&yell.ExpiresAt,
				&yell.CreatedAt,
				&yell.PersonaName,
				&yell.PersonaAvatar,
			)
			if err != nil {
				log.Printf("Failed to scan yell: %v", err)
				continue
			}
			yells = append(yells, yell)
		}

		c.JSON(http.StatusOK, gin.H{
			"yells": yells,
			"count": len(yells),
		})
	}
}

// CleanupExpiredYells removes expired yells from the database
// DeleteYellsByScene deletes all yells for a specific scene
func DeleteYellsByScene(sceneID uuid.UUID) error {
	_, err := config.DB.Exec(`
		DELETE FROM yells
		WHERE scene_id = $1
	`, sceneID)
	return err
}
