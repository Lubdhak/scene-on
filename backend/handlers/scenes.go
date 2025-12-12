package handlers

import (
	"fmt"
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

		// Verify persona belongs to user
		var count int
		err = config.DB.QueryRow(
			`SELECT COUNT(*) FROM personas WHERE id = $1 AND user_id = $2`,
			personaID, userID,
		).Scan(&count)
		if err != nil || count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Persona not found or not owned by user"})
			return
		}

		// Check if persona already has an active scene
		var activeSceneID uuid.UUID
		err = config.DB.QueryRow(
			`SELECT id FROM scenes 
			 WHERE persona_id = $1 AND is_active = true AND expires_at > NOW()`,
			personaID,
		).Scan(&activeSceneID)

		if err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Scene already active for this persona"})
			return
		}

		// Create new scene with 4 hour TTL by default
		scene := models.Scene{
			ID:        uuid.New(),
			PersonaID: personaID,
			Latitude:  req.Latitude,
			Longitude: req.Longitude,
			IsActive:  true,
			StartedAt: time.Now(),
			ExpiresAt: time.Now().Add(4 * time.Hour),
			CreatedAt: time.Now(),
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

		// Store in Redis for quick access
		config.RedisClient.HSet(c, fmt.Sprintf("scene:%s", scene.ID), map[string]interface{}{
			"persona_id": scene.PersonaID.String(),
			"latitude":   scene.Latitude,
			"longitude":  scene.Longitude,
		})
		config.RedisClient.Expire(c, fmt.Sprintf("scene:%s", scene.ID), 4*time.Hour)

		// Broadcast scene started event to nearby users
		wsHub.Broadcast <- websocket.BroadcastMessage{
			Message: websocket.Message{
				Type: "scene.started",
				Data: map[string]interface{}{
					"scene_id": scene.ID.String(),
					"latitude": scene.Latitude,
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
		wsHub.Broadcast <- websocket.BroadcastMessage{
			Message: websocket.Message{
				Type: "scene.ended",
				Data: map[string]interface{}{
					"scene_id": sceneID.String(),
				},
			},
		}

		c.JSON(http.StatusOK, gin.H{"message": "Scene stopped successfully"})
	}
}

func GetNearbyScenes(c *gin.Context) {
	lat := c.Query("latitude")
	lon := c.Query("longitude")
	
	if lat == "" || lon == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "latitude and longitude required"})
		return
	}

	// TODO: Implement proper geographical query
	// For now, return all active scenes
	rows, err := config.DB.Query(
		`SELECT id, persona_id, latitude, longitude, started_at, expires_at
		 FROM scenes WHERE is_active = true AND expires_at > NOW()
		 LIMIT 50`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch scenes"})
		return
	}
	defer rows.Close()

	var scenes []models.Scene
	for rows.Next() {
		var scene models.Scene
		rows.Scan(&scene.ID, &scene.PersonaID, &scene.Latitude,
			&scene.Longitude, &scene.StartedAt, &scene.ExpiresAt)
		scenes = append(scenes, scene)
	}

	c.JSON(http.StatusOK, scenes)
}
