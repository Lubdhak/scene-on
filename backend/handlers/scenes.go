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

		// Combined query: check if persona exists AND get active scene in one query
		var personaExists bool
		var scene models.Scene
		err = config.DB.QueryRow(
			`SELECT 
				EXISTS(SELECT 1 FROM personas WHERE id = $1),
				COALESCE(s.id, '00000000-0000-0000-0000-000000000000'::uuid),
				COALESCE(s.persona_id, '00000000-0000-0000-0000-000000000000'::uuid),
				COALESCE(s.latitude, 0),
				COALESCE(s.longitude, 0),
				COALESCE(s.is_active, false),
				COALESCE(s.started_at, '1970-01-01'::timestamptz),
				COALESCE(s.expires_at, '1970-01-01'::timestamptz),
				COALESCE(s.created_at, '1970-01-01'::timestamptz)
			 FROM (SELECT 1) dummy
			 LEFT JOIN scenes s ON s.persona_id = $1 AND s.is_active = true AND s.expires_at > NOW()
			 ORDER BY s.started_at DESC LIMIT 1`,
			personaID,
		).Scan(&personaExists, &scene.ID, &scene.PersonaID, &scene.Latitude, &scene.Longitude,
			&scene.IsActive, &scene.StartedAt, &scene.ExpiresAt, &scene.CreatedAt)

		if err != nil {
			log.Printf("Failed to check persona/scene: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}

		if !personaExists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Persona not found. Please recreate your identity.", "code": "PERSONA_NOT_FOUND"})
			return
		}

		// Check if we found an active scene (ID will not be zero UUID)
		zeroUUID := uuid.MustParse("00000000-0000-0000-0000-000000000000")
		hasActiveScene := scene.ID != zeroUUID

		if hasActiveScene {
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
		} else {
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
		}

		// Broadcast scene event to nearby users using PostGIS (much more efficient)
		wsHub.BroadcastToNearby(
			websocket.Message{
				Type: "scene.started",
				Data: map[string]interface{}{
					"scene_id":  scene.ID.String(),
					"latitude":  scene.Latitude,
					"longitude": scene.Longitude,
				},
			},
			scene.Latitude,
			scene.Longitude,
			5000, // 5km radius in meters
			scene.ID,
		)

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

		// Optimize: Single CTE query to delete yells, chat_requests and deactivate scene
		_, err = config.DB.Exec(
			`WITH 
				delete_yells AS (DELETE FROM yells WHERE scene_id = $1),
				delete_chat_requests AS (DELETE FROM chat_requests WHERE from_scene_id = $1 OR to_scene_id = $1)
			 UPDATE scenes SET is_active = false WHERE id = $1`,
			sceneID,
		)
		if err != nil {
			log.Printf("Failed to stop scene %s: %v", sceneID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to stop scene"})
			return
		}

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

		c.JSON(http.StatusOK, gin.H{"message": "Scene stopped"})
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

	log.Println("✓ Startup cleanup complete")
}

func GetNearbyScenes(c *gin.Context) {
	lat := c.Query("latitude")
	lon := c.Query("longitude")
	radiusStr := c.DefaultQuery("radius", "50") // Default 50km if not provided
	
	if lat == "" || lon == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "latitude and longitude required"})
		return
	}

	// Parse radius (in kilometers)
	var radiusKm float64
	if _, err := fmt.Sscanf(radiusStr, "%f", &radiusKm); err != nil || radiusKm <= 0 || radiusKm > 3000 {
		radiusKm = 50 // Default to 50km if invalid
	}

	// Convert km to meters for ST_DWithin
	radiusMeters := radiusKm * 1000

	// Get current user's ID to exclude their own scenes
	userID, _ := middleware.GetUserID(c)

	// Use PostGIS ST_DWithin for efficient distance filtering
	// Optimized query with pre-computed geography casting
	rows, err := config.DB.Query(
		`SELECT s.id, s.persona_id, s.latitude, s.longitude, s.is_active, s.started_at, s.expires_at, s.created_at,
		        p.name as persona_name, p.avatar_url as persona_avatar, p.description as persona_description
		 FROM scenes s
		 INNER JOIN personas p ON s.persona_id = p.id
		 WHERE s.is_active = true 
		   AND s.expires_at > NOW()
		   AND p.user_id != $1
		   AND ST_DWithin(
		       ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
		       ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
		       $4
		   )
		 ORDER BY ST_Distance(
		     ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
		     ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
		 )
		 LIMIT 100`,
		userID, lon, lat, radiusMeters,
	)
	if err != nil {
		log.Printf("❌ Failed to fetch scenes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch scenes"})
		return
	}
	defer rows.Close()

	// Pre-allocate slice with estimated capacity for better performance
	scenes := make([]SceneWithPersona, 0, 20)
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

	log.Printf("📍 Found %d scenes within %.0fkm for user %s", len(scenes), radiusKm, userID)

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

