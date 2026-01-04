package handlers

import (
	"log"
	"scene-on/backend/config"
	"scene-on/backend/websocket"
	"time"

	"github.com/google/uuid"
)

// StartChatCleanupWorker runs a background job to clean up expired chats
func StartChatCleanupWorker(wsHub *websocket.Hub) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	log.Println("🧹 Chat cleanup worker started")

	for range ticker.C {
		cleanupExpiredChats(wsHub)
	}
}

func cleanupExpiredChats(wsHub *websocket.Hub) {
	// Find all accepted chats that have expired
	rows, err := config.DB.Query(
		`SELECT id, from_scene_id, to_scene_id 
		 FROM chat_requests 
		 WHERE status = 'accepted' 
		 AND expires_at < NOW()`,
	)

	if err != nil {
		log.Printf("Failed to query expired chats: %v", err)
		return
	}
	defer rows.Close()

	expiredCount := 0
	for rows.Next() {
		var id, fromSceneID, toSceneID uuid.UUID
		if err := rows.Scan(&id, &fromSceneID, &toSceneID); err != nil {
			log.Printf("Failed to scan expired chat: %v", err)
			continue
		}

		// Delete all messages (CASCADE will handle this, but we'll do it explicitly for logging)
		result, err := config.DB.Exec(
			`DELETE FROM chat_messages WHERE chat_request_id = $1`,
			id,
		)
		if err != nil {
			log.Printf("Failed to delete chat messages for request %s: %v", id, err)
		} else {
			if count, _ := result.RowsAffected(); count > 0 {
				log.Printf("🗑️  Deleted %d messages from expired chat %s", count, id)
			}
		}

		// Update request status to expired
		_, err = config.DB.Exec(
			`UPDATE chat_requests SET status = 'expired' WHERE id = $1`,
			id,
		)
		if err != nil {
			log.Printf("Failed to mark chat as expired %s: %v", id, err)
			continue
		}

		// Send WebSocket notification to both parties
		wsHub.Broadcast <- websocket.BroadcastMessage{
			Message: websocket.Message{
				Type: "chat.expired",
				Data: map[string]interface{}{
					"request_id":   id.String(),
					"from_scene_id": fromSceneID.String(),
					"to_scene_id":   toSceneID.String(),
				},
			},
		}

		expiredCount++
	}

	if expiredCount > 0 {
		log.Printf("✅ Cleaned up %d expired chat(s)", expiredCount)
	}
}
