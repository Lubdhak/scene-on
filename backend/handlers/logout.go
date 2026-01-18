package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"scene-on/backend/config"
	"scene-on/backend/middleware"
	"scene-on/backend/websocket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Logout handles user logout and cleanup
func Logout(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := middleware.GetUserID(c)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
			return
		}

		log.Printf("🔴 User %s logging out, cleaning up active scenes...", userID)

		// Find and stop any active scenes for this user
		var sceneID uuid.UUID
		err := config.DB.QueryRow(
			`SELECT s.id FROM scenes s
			 JOIN personas p ON s.persona_id = p.id
			 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
			 ORDER BY s.started_at DESC LIMIT 1`,
			userID,
		).Scan(&sceneID)

		if err == nil {
			// Scene found, clean it up
			log.Printf("🧹 Cleaning up active scene %s for user %s", sceneID, userID)
			
			// Hard delete associated data (yells, chat requests)
			_, err = config.DB.Exec(`DELETE FROM yells WHERE scene_id = $1`, sceneID)
			if err != nil {
				log.Printf("⚠️ Failed to delete yells for scene %s: %v", sceneID, err)
			}

			_, err = config.DB.Exec(`DELETE FROM chat_requests WHERE from_scene_id = $1 OR to_scene_id = $1`, sceneID)
			if err != nil {
				log.Printf("⚠️ Failed to delete chat requests for scene %s: %v", sceneID, err)
			}

			// Deactivate scene
			_, err = config.DB.Exec(`UPDATE scenes SET is_active = false WHERE id = $1`, sceneID)
			if err != nil {
				log.Printf("❌ Failed to deactivate scene %s: %v", sceneID, err)
			} else {
				log.Printf("✓ Scene %s deactivated on logout", sceneID)
				
				// Broadcast scene ended event to notify other users
				log.Printf("📢 Broadcasting scene.ended for scene %s (logout)", sceneID)
				wsHub.Broadcast <- websocket.BroadcastMessage{
					Message: websocket.Message{
						Type: "scene.ended",
						Data: map[string]interface{}{
							"scene_id": sceneID.String(),
						},
					},
				}
			}
		} else if err != sql.ErrNoRows {
			log.Printf("⚠️ Error checking for active scene: %v", err)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":       "Logged out successfully",
			"scene_stopped": err == nil,
		})
	}
}
