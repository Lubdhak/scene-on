package handlers

import (
	"database/sql"
	"fmt"
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

type StartSceneRequest struct {
	PersonaID string  `json:"persona_id" binding:"required"`
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
}

type SceneWithPersona struct {
	models.Scene
	PersonaName        string `json:"persona_name"`
	PersonaAvatar      string `json:"persona_avatar"`
	PersonaDescription string `json:"persona_description"`
}

func StartScene(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)

		var req StartSceneRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		personaID, err := uuid.Parse(req.PersonaID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid persona_id"})
			return
		}

		// Verify persona belongs to user (and personaID should be userID in our simplified model)
		if personaID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Persona ID must match User ID"})
			return
		}

		// Check if user already has an active scene
		var scene models.Scene
		err = config.DB.QueryRow(
			`SELECT id, persona_id, latitude, longitude, is_active, started_at, expires_at, created_at
			 FROM scenes 
			 WHERE persona_id = $1 AND is_active = true AND expires_at > NOW()
			 ORDER BY started_at DESC LIMIT 1`,
			personaID,
		).Scan(&scene.ID, &scene.PersonaID, &scene.Latitude, &scene.Longitude,
			&scene.IsActive, &scene.StartedAt, &scene.ExpiresAt, &scene.CreatedAt)

		if err == nil {
			// Update existing scene (Upsert behavior)
			scene.Latitude = req.Latitude
			scene.Longitude = req.Longitude
			scene.ExpiresAt = time.Now().UTC().Add(4 * time.Hour) // Extend TTL

			_, err = config.DB.Exec(
				`UPDATE scenes SET latitude = $1, longitude = $2, expires_at = $3 WHERE id = $4`,
				scene.Latitude, scene.Longitude, scene.ExpiresAt, scene.ID,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update existing scene"})
				return
			}
			log.Printf("✓ Updated existing scene %s for persona %s", scene.ID, personaID)
		} else if err == sql.ErrNoRows {
			// Create new scene
			now := time.Now().UTC()
			scene = models.Scene{
				ID:        uuid.New(),
				PersonaID: personaID,
				Latitude:  req.Latitude,
				Longitude: req.Longitude,
				IsActive:  true,
				StartedAt: now,
				ExpiresAt: now.Add(4 * time.Hour),
				CreatedAt: now,
			}

			_, err = config.DB.Exec(
				`INSERT INTO scenes (id, persona_id, latitude, longitude, is_active, started_at, expires_at, created_at)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				scene.ID, scene.PersonaID, scene.Latitude, scene.Longitude,
				scene.IsActive, scene.StartedAt, scene.ExpiresAt, scene.CreatedAt,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create scene"})
				return
			}
			log.Printf("✓ Created new scene %s for persona %s", scene.ID, personaID)
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking active scene"})
			return
		}

		// Store in Redis for quick access
		config.RedisClient.HSet(c, fmt.Sprintf("scene:%s", scene.ID), map[string]interface{}{
			"persona_id": scene.PersonaID.String(),
			"latitude":   scene.Latitude,
			"longitude":  scene.Longitude,
		})
		config.RedisClient.Expire(c, fmt.Sprintf("scene:%s", scene.ID), 4*time.Hour)

		// Broadcast scene event to nearby users
		wsHub.Broadcast <- websocket.BroadcastMessage{
			Message: websocket.Message{
				Type: "scene.started", // We can keep "started" for both start and update for simplicity
				Data: map[string]interface{}{
					"scene_id":  scene.ID.String(),
					"latitude":  scene.Latitude,
					"longitude": scene.Longitude,
				},
			},
			Location: &websocket.Location{
				Latitude:  scene.Latitude,
				Longitude: scene.Longitude,
			},
			Radius: 5000, // 5km radius
		}

		c.JSON(http.StatusCreated, scene)
	}
}

func StopScene(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)

		// Find active scene for any of user's personas
		var sceneID uuid.UUID
		err := config.DB.QueryRow(
			`SELECT s.id FROM scenes s
			 JOIN personas p ON s.persona_id = p.id
			 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
			 ORDER BY s.started_at DESC LIMIT 1`,
			userID,
		).Scan(&sceneID)

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "No active scene found"})
			return
		}

		// Hard delete associated data (yells, chat requests)
		// Chat messages will be deleted via cascade (if defined in migration) or we can manually delete
		_, err = config.DB.Exec(`DELETE FROM yells WHERE scene_id = $1`, sceneID)
		if err != nil {
			log.Printf("Warning: Failed to delete yells for scene %s: %v", sceneID, err)
		}

		_, err = config.DB.Exec(`DELETE FROM chat_requests WHERE from_scene_id = $1 OR to_scene_id = $1`, sceneID)
		if err != nil {
			log.Printf("Warning: Failed to delete chat requests for scene %s: %v", sceneID, err)
		}

		// Deactivate scene
		_, err = config.DB.Exec(
			`UPDATE scenes SET is_active = false WHERE id = $1`,
			sceneID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to stop scene"})
			return
		}

		// Remove from Redis
		config.RedisClient.Del(c, fmt.Sprintf("scene:%s", sceneID))

		// Broadcast scene ended event
		log.Printf("📢 Broadcasting scene.ended for scene %s", sceneID)
		wsHub.Broadcast <- websocket.BroadcastMessage{
			Message: websocket.Message{
				Type: "scene.ended",
				Data: map[string]interface{}{
					"scene_id":  sceneID.String(),
				},
			},
		}

		c.JSON(http.StatusOK, gin.H{"message": "Scene stopped successfully"})
	}
}

// CleanupActiveScenes marks all scenes as inactive on startup
func CleanupActiveScenes() {
	log.Println("🧹 Cleaning up active scenes on startup...")
	
	// Mark all scenes inactive
	res, err := config.DB.Exec(`UPDATE scenes SET is_active = false WHERE is_active = true`)
	if err != nil {
		log.Printf("❌ Failed to cleanup database scenes: %v", err)
	} else {
		count, _ := res.RowsAffected()
		log.Printf("✓ Marked %d scenes as inactive", count)
	}

	// Redis cleanup could be more complex depending on key structure, 
	// but since our scenes have a prefix scene:* we can use Scan/Del if needed.
	// For now, the database is the source of truth for GetNearbyScenes/GetActiveScene.
	log.Println("✓ Startup cleanup complete")
}

func GetNearbyScenes(c *gin.Context) {
	lat := c.Query("latitude")
	lon := c.Query("longitude")
	
	if lat == "" || lon == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "latitude and longitude required"})
		return
	}

	// Get current user's ID to exclude their own scenes
	userID, _ := middleware.GetUserID(c)

	// Fetch active scenes with persona information, excluding user's own scenes
	rows, err := config.DB.Query(
		`SELECT s.id, s.persona_id, s.latitude, s.longitude, s.is_active, s.started_at, s.expires_at, s.created_at,
		        p.name as persona_name, p.avatar_url as persona_avatar, p.description as persona_description
		 FROM scenes s
		 JOIN personas p ON s.persona_id = p.id
		 WHERE s.is_active = true AND s.expires_at > NOW()
		 AND p.user_id != $1
		 LIMIT 50`,
		userID,
	)
	if err != nil {
		log.Printf("❌ Failed to fetch scenes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch scenes"})
		return
	}
	defer rows.Close()

	var scenes []SceneWithPersona
	for rows.Next() {
		var scene SceneWithPersona
		err := rows.Scan(
			&scene.ID, &scene.PersonaID, &scene.Latitude, &scene.Longitude,
			&scene.IsActive, &scene.StartedAt, &scene.ExpiresAt, &scene.CreatedAt,
			&scene.PersonaName, &scene.PersonaAvatar, &scene.PersonaDescription,
		)
		if err != nil {
			log.Printf("❌ Failed to scan scene: %v", err)
			continue
		}
		scenes = append(scenes, scene)
	}

	log.Printf("📍 Found %d nearby active scenes for user %s", len(scenes), userID)

	if scenes == nil {
		scenes = []SceneWithPersona{}
	}

	c.JSON(http.StatusOK, scenes)
}

func GetActiveScene(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var scene models.Scene
	err := config.DB.QueryRow(
		`SELECT s.id, s.persona_id, s.latitude, s.longitude, s.is_active, s.started_at, s.expires_at, s.created_at
		 FROM scenes s
		 JOIN personas p ON s.persona_id = p.id
		 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
		 ORDER BY s.started_at DESC LIMIT 1`,
		userID,
	).Scan(&scene.ID, &scene.PersonaID, &scene.Latitude, &scene.Longitude,
		&scene.IsActive, &scene.StartedAt, &scene.ExpiresAt, &scene.CreatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"active": false})
		return
	} else if err != nil {
		log.Printf("Failed to check active scene: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check active scene"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"active": true,
		"scene":  scene,
	})
}

