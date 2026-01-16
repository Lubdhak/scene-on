package handlers

import (
	"log"
	"scene-on/backend/config"
	"scene-on/backend/websocket"

	"github.com/google/uuid"
)

// RunBootCleanup performs one-time cleanup of expired data during server boot
func RunBootCleanup(wsHub *websocket.Hub) {
	log.Println("🧹 Running boot cleanup...")
	
	// Mark all active scenes as inactive on startup
	res, err := config.DB.Exec(`UPDATE scenes SET is_active = false WHERE is_active = true`)
	if err != nil {
		log.Printf("❌ Failed to deactivate scenes: %v", err)
	} else {
		count, _ := res.RowsAffected()
		if count > 0 {
			log.Printf("✓ Marked %d scenes as inactive", count)
		}
	}
	
	// Clean up expired data
	cleanupExpiredChats(wsHub)
	
	log.Println("✅ Boot cleanup completed")
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

	// Clean up expired scenes
	cleanupExpiredScenes(wsHub)

	// Clean up old chat requests
	cleanupOldChatRequests()

	// Clean up old user location history (keep last 100 per user)
	cleanupOldUserLocations()
}

func cleanupExpiredScenes(wsHub *websocket.Hub) {
	// Delete expired scenes
	result, err := config.DB.Exec(
		`DELETE FROM scenes 
		 WHERE is_active = true 
		 AND expires_at < NOW()`,
	)

	if err != nil {
		log.Printf("Failed to delete expired scenes: %v", err)
		return
	}

	if count, _ := result.RowsAffected(); count > 0 {
		log.Printf("🗑️  Deleted %d expired scene(s)", count)
	}
}

func cleanupOldChatRequests() {
	// Delete chat requests that are expired, rejected, or old pending ones
	// Keep accepted ones as they may still be referenced
	result, err := config.DB.Exec(
		`DELETE FROM chat_requests 
		 WHERE (status = 'expired' AND expires_at < NOW() - INTERVAL '1 hour')
		 OR (status = 'rejected' AND created_at < NOW() - INTERVAL '1 hour')
		 OR (status = 'pending' AND expires_at < NOW())`,
	)

	if err != nil {
		log.Printf("Failed to cleanup old chat requests: %v", err)
		return
	}

	if count, _ := result.RowsAffected(); count > 0 {
		log.Printf("🗑️  Deleted %d old chat request(s)", count)
	}
}

func cleanupOldUserLocations() {
	// Keep only the most recent 100 locations per user
	result, err := config.DB.Exec(
		`DELETE FROM user_locations 
		 WHERE id IN (
			SELECT id FROM (
				SELECT id, 
					ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
				FROM user_locations
			) t
			WHERE rn > 100
		 )`,
	)

	if err != nil {
		log.Printf("Failed to cleanup old user locations: %v", err)
		return
	}

	if count, _ := result.RowsAffected(); count > 0 {
		log.Printf("🗑️  Deleted %d old user location(s)", count)
	}
}
