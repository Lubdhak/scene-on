package handlers

import (
	"database/sql"
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

// Request/Response types
type SendChatRequestReq struct {
	ToSceneID string  `json:"to_scene_id" binding:"required"`
	Message   *string `json:"message,omitempty"`
}

type ChatRequestWithPersona struct {
	models.ChatRequest
	FromPersonaName        string `json:"from_persona_name"`
	FromPersonaAvatar      string `json:"from_persona_avatar"`
	FromPersonaDescription string `json:"from_persona_description"`
	ToPersonaName          string `json:"to_persona_name,omitempty"`
}

type SendChatMessageReq struct {
	RequestID string `json:"request_id" binding:"required"`
	Content   string `json:"content" binding:"required"`
	Nonce     string `json:"nonce,omitempty"`
}

// SendChatRequest sends a chat request to another scene
func SendChatRequest(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)

		var req SendChatRequestReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		toSceneID, err := uuid.Parse(req.ToSceneID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid to_scene_id"})
			return
		}

		// Get user's active scene
		var fromSceneID uuid.UUID
		err = config.DB.QueryRow(
			`SELECT s.id FROM scenes s
			 JOIN personas p ON s.persona_id = p.id
			 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
			 ORDER BY s.started_at DESC LIMIT 1`,
			userID,
		).Scan(&fromSceneID)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No active scene found. Start a scene first."})
			return
		}
		if err != nil {
			log.Printf("Failed to get active scene: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
			return
		}

		// Verify target scene exists and is active
		var targetExists bool
		err = config.DB.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM scenes WHERE id = $1 AND is_active = true AND expires_at > NOW())`,
			toSceneID,
		).Scan(&targetExists)

		if err != nil || !targetExists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Target scene not found or inactive"})
			return
		}

		// Prevent sending request to yourself
		if fromSceneID == toSceneID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot send chat request to yourself"})
			return
		}

		// Check if there's already a pending or accepted request between these scenes
		var existingID uuid.UUID
		err = config.DB.QueryRow(
			`SELECT id FROM chat_requests 
			 WHERE ((from_scene_id = $1 AND to_scene_id = $2) OR (from_scene_id = $2 AND to_scene_id = $1))
			 AND status IN ('pending', 'accepted')
			 LIMIT 1`,
			fromSceneID, toSceneID,
		).Scan(&existingID)

		if err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Chat request already exists between these scenes"})
			return
		}

		// Create chat request
		chatRequest := models.ChatRequest{
			ID:          uuid.New(),
			FromSceneID: fromSceneID,
			ToSceneID:   toSceneID,
			Message:     req.Message,
			Status:      "pending",
			CreatedAt:   time.Now(),
		}

		_, err = config.DB.Exec(
			`INSERT INTO chat_requests (id, from_scene_id, to_scene_id, message, status, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			chatRequest.ID, chatRequest.FromSceneID, chatRequest.ToSceneID,
			chatRequest.Message, chatRequest.Status, chatRequest.CreatedAt,
		)

		if err != nil {
			log.Printf("Failed to create chat request: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create chat request"})
			return
		}

		// Fetch requester persona info for the notification
		var fromPersonaName, fromPersonaAvatar, fromPersonaDescription string
		err = config.DB.QueryRow(
			`SELECT p.name, p.avatar_url, p.description 
			 FROM scenes s 
			 JOIN personas p ON s.persona_id = p.id 
			 WHERE s.id = $1`,
			fromSceneID,
		).Scan(&fromPersonaName, &fromPersonaAvatar, &fromPersonaDescription)

		if err == nil {
			// Send Targeted WebSocket notification to recipient scene
			wsHub.Targeted <- websocket.TargetedMessage{
				TargetSceneID: toSceneID,
				Message: websocket.Message{
					Type: "chat.request.received",
					Data: map[string]interface{}{
						"id":                       chatRequest.ID.String(),
						"from_scene_id":             chatRequest.FromSceneID.String(),
						"from_persona_name":        fromPersonaName,
						"from_persona_avatar":      fromPersonaAvatar,
						"from_persona_description": fromPersonaDescription,
						"message":                  chatRequest.Message,
						"created_at":               chatRequest.CreatedAt,
					},
				},
			}
		}

		c.JSON(http.StatusCreated, chatRequest)
	}
}

// GetChatInbox gets all pending chat requests for user's active scene
func GetChatInbox(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	// Get user's active scene
	var userSceneID uuid.UUID
	err := config.DB.QueryRow(
		`SELECT s.id FROM scenes s
		 JOIN personas p ON s.persona_id = p.id
		 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
		 ORDER BY s.started_at DESC LIMIT 1`,
		userID,
	).Scan(&userSceneID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, []ChatRequestWithPersona{})
		return
	}
	if err != nil {
		log.Printf("Failed to get active scene: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
		return
	}

	// Get pending chat requests with persona info
	rows, err := config.DB.Query(
		`SELECT cr.id, cr.from_scene_id, cr.to_scene_id, cr.message, cr.status, 
		        cr.accepted_at, cr.expires_at, cr.created_at,
		        p.name as from_persona_name, p.avatar_url as from_persona_avatar, p.description as from_persona_description
		 FROM chat_requests cr
		 JOIN scenes s ON cr.from_scene_id = s.id
		 JOIN personas p ON s.persona_id = p.id
		 WHERE cr.to_scene_id = $1 AND cr.status = 'pending'
		 ORDER BY cr.created_at DESC`,
		userSceneID,
	)

	if err != nil {
		log.Printf("Failed to get chat requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get chat requests"})
		return
	}
	defer rows.Close()

	var requests []ChatRequestWithPersona
	for rows.Next() {
		var req ChatRequestWithPersona
		err := rows.Scan(
			&req.ID, &req.FromSceneID, &req.ToSceneID, &req.Message, &req.Status,
			&req.AcceptedAt, &req.ExpiresAt, &req.CreatedAt,
			&req.FromPersonaName, &req.FromPersonaAvatar, &req.FromPersonaDescription,
		)
		if err != nil {
			log.Printf("Failed to scan chat request: %v", err)
			continue
		}
		requests = append(requests, req)
	}

	if requests == nil {
		requests = []ChatRequestWithPersona{}
	}

	c.JSON(http.StatusOK, requests)
}

// GetSentChatRequests gets all pending chat requests sent by the user's active scene
func GetSentChatRequests(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	// Get user's active scene
	var userSceneID uuid.UUID
	err := config.DB.QueryRow(
		`SELECT s.id FROM scenes s
		 JOIN personas p ON s.persona_id = p.id
		 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
		 ORDER BY s.started_at DESC LIMIT 1`,
		userID,
	).Scan(&userSceneID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, []ChatRequestWithPersona{})
		return
	}
	if err != nil {
		log.Printf("Failed to get active scene: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
		return
	}

	// Get pending sent chat requests with persona info of the recipient
	rows, err := config.DB.Query(
		`SELECT cr.id, cr.from_scene_id, cr.to_scene_id, cr.message, cr.status, 
		        cr.accepted_at, cr.expires_at, cr.created_at,
		        p.name as to_persona_name, p.avatar_url as to_persona_avatar, p.description as to_persona_description
		 FROM chat_requests cr
		 JOIN scenes s ON cr.to_scene_id = s.id
		 JOIN personas p ON s.persona_id = p.id
		 WHERE cr.from_scene_id = $1 AND cr.status = 'pending'
		 ORDER BY cr.created_at DESC`,
		userSceneID,
	)

	if err != nil {
		log.Printf("Failed to get sent chat requests: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get sent chat requests"})
		return
	}
	defer rows.Close()

	var requests []ChatRequestWithPersona
	for rows.Next() {
		var req ChatRequestWithPersona
		err := rows.Scan(
			&req.ID, &req.FromSceneID, &req.ToSceneID, &req.Message, &req.Status,
			&req.AcceptedAt, &req.ExpiresAt, &req.CreatedAt,
			&req.ToPersonaName, &req.FromPersonaAvatar, &req.FromPersonaDescription,
		)
		if err != nil {
			log.Printf("Failed to scan sent chat request: %v", err)
			continue
		}
		// We reuse FromPersona field names for simplicity in JSON, 
		// but they represent the "To" persona here for the outbox.
		requests = append(requests, req)
	}

	if requests == nil {
		requests = []ChatRequestWithPersona{}
	}

	c.JSON(http.StatusOK, requests)
}

// AcceptChatRequest accepts a chat request and sets expiration
func AcceptChatRequest(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)
		requestID := c.Param("id")

		reqUUID, err := uuid.Parse(requestID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request_id"})
			return
		}

		// Get user's active scene
		var userSceneID uuid.UUID
		err = config.DB.QueryRow(
			`SELECT s.id FROM scenes s
			 JOIN personas p ON s.persona_id = p.id
			 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
			 ORDER BY s.started_at DESC LIMIT 1`,
			userID,
		).Scan(&userSceneID)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No active scene found"})
			return
		}
		if err != nil {
			log.Printf("Failed to get active scene: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
			return
		}

		// Verify request is for this user's scene and is pending
		var fromSceneID, toSceneID uuid.UUID
		var status string
		err = config.DB.QueryRow(
			`SELECT from_scene_id, to_scene_id, status FROM chat_requests WHERE id = $1`,
			reqUUID,
		).Scan(&fromSceneID, &toSceneID, &status)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chat request not found"})
			return
		}
		if err != nil {
			log.Printf("Failed to get chat request: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get chat request"})
			return
		}

		if toSceneID != userSceneID {
			c.JSON(http.StatusForbidden, gin.H{"error": "This request is not for your scene"})
			return
		}

		if status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Request already " + status})
			return
		}

		// Accept request and set expiration (5 minutes from now)
		now := time.Now().UTC()
		expiresAt := now.Add(5 * time.Minute)

		_, err = config.DB.Exec(
			`UPDATE chat_requests 
			 SET status = 'accepted', accepted_at = $1, expires_at = $2
			 WHERE id = $3`,
			now, expiresAt, reqUUID,
		)

		if err != nil {
			log.Printf("Failed to accept chat request: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept chat request"})
			return
		}

		// Send WebSocket notification to both parties via Targeted messages
		acceptedMsg := websocket.Message{
			Type: "chat.request.accepted",
			Data: map[string]interface{}{
				"request_id":   reqUUID.String(),
				"expires_at":   expiresAt.Format(time.RFC3339),
				"from_scene_id": fromSceneID.String(),
				"to_scene_id":   toSceneID.String(),
			},
		}

		// Notify requester
		wsHub.Targeted <- websocket.TargetedMessage{
			TargetSceneID: fromSceneID,
			Message:       acceptedMsg,
		}
		// Notify recipient (the one who just accepted) - optional but good for multi-tab
		wsHub.Targeted <- websocket.TargetedMessage{
			TargetSceneID: toSceneID,
			Message:       acceptedMsg,
		}

		c.JSON(http.StatusOK, gin.H{
			"message":    "Chat request accepted",
			"request_id": reqUUID.String(),
			"expires_at": expiresAt,
		})
	}
}

// RejectChatRequest rejects a chat request
func RejectChatRequest(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)
		requestID := c.Param("id")

		reqUUID, err := uuid.Parse(requestID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request_id"})
			return
		}

		// Get user's active scene and persona name
		var userSceneID uuid.UUID
		var personaName string
		err = config.DB.QueryRow(
			`SELECT s.id, p.name FROM scenes s
			 JOIN personas p ON s.persona_id = p.id
			 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
			 ORDER BY s.started_at DESC LIMIT 1`,
			userID,
		).Scan(&userSceneID, &personaName)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No active scene found"})
			return
		}
		if err != nil {
			log.Printf("Failed to get active scene: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
			return
		}

		// Verify request is for this user's scene and is pending
		var fromSceneID, toSceneID uuid.UUID
		var status string
		err = config.DB.QueryRow(
			`SELECT from_scene_id, to_scene_id, status FROM chat_requests WHERE id = $1`,
			reqUUID,
		).Scan(&fromSceneID, &toSceneID, &status)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chat request not found"})
			return
		}
		if err != nil {
			log.Printf("Failed to get chat request: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get chat request"})
			return
		}

		if toSceneID != userSceneID {
			c.JSON(http.StatusForbidden, gin.H{"error": "This request is not for your scene"})
			return
		}

		if status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Request already " + status})
			return
		}

		// Reject request
		_, err = config.DB.Exec(
			`UPDATE chat_requests SET status = 'rejected' WHERE id = $1`,
			reqUUID,
		)

		if err != nil {
			log.Printf("Failed to reject chat request: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reject chat request"})
			return
		}

		// Send Targeted WebSocket notification to requester
		wsHub.Targeted <- websocket.TargetedMessage{
			TargetSceneID: fromSceneID,
			Message: websocket.Message{
				Type: "chat.request.rejected",
				Data: map[string]interface{}{
					"request_id":   reqUUID.String(),
					"rejecter_name": personaName,
				},
			},
		}

		c.JSON(http.StatusOK, gin.H{"message": "Chat request rejected"})
	}
}

// CancelChatRequest allows a user to cancel their own pending chat request
func CancelChatRequest(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)
		requestID := c.Param("id")

		reqUUID, err := uuid.Parse(requestID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request_id"})
			return
		}

		// Get user's active scene
		var userSceneID uuid.UUID
		err = config.DB.QueryRow(
			`SELECT s.id FROM scenes s
			 JOIN personas p ON s.persona_id = p.id
			 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
			 ORDER BY s.started_at DESC LIMIT 1`,
			userID,
		).Scan(&userSceneID)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No active scene found"})
			return
		}
		if err != nil {
			log.Printf("Failed to get active scene: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
			return
		}

		// Verify request is FROM this user's scene and is pending
		var fromSceneID, toSceneID uuid.UUID
		var status string
		err = config.DB.QueryRow(
			`SELECT from_scene_id, to_scene_id, status FROM chat_requests WHERE id = $1`,
			reqUUID,
		).Scan(&fromSceneID, &toSceneID, &status)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chat request not found"})
			return
		}

		if fromSceneID != userSceneID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You didn't send this request"})
			return
		}

		if status != "pending" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Request already " + status})
			return
		}

		// Set to 'rejected' to cancel
		_, err = config.DB.Exec(
			`UPDATE chat_requests SET status = 'rejected' WHERE id = $1`,
			reqUUID,
		)

		if err != nil {
			log.Printf("Failed to cancel chat request: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel chat request"})
			return
		}

		// Notify recipient via WebSocket
		wsHub.Targeted <- websocket.TargetedMessage{
			TargetSceneID: toSceneID,
			Message: websocket.Message{
				Type: "chat.request.canceled",
				Data: gin.H{
					"request_id": reqUUID.String(),
				},
			},
		}

		c.JSON(http.StatusOK, gin.H{"message": "Chat request canceled"})
	}
}

// SendChatMessage sends a message in an accepted chat
func SendChatMessage(wsHub *websocket.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := middleware.GetUserID(c)

		var req SendChatMessageReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		reqUUID, err := uuid.Parse(req.RequestID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request_id"})
			return
		}

		// Get user's active scene
		var userSceneID uuid.UUID
		err = config.DB.QueryRow(
			`SELECT s.id FROM scenes s
			 JOIN personas p ON s.persona_id = p.id
			 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
			 ORDER BY s.started_at DESC LIMIT 1`,
			userID,
		).Scan(&userSceneID)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No active scene found"})
			return
		}
		if err != nil {
			log.Printf("Failed to get active scene: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
			return
		}

		// Verify chat is accepted, not expired, and user is part of it
		var fromSceneID, toSceneID uuid.UUID
		var status string
		var expiresAt *time.Time
		err = config.DB.QueryRow(
			`SELECT from_scene_id, to_scene_id, status, expires_at 
			 FROM chat_requests WHERE id = $1`,
			reqUUID,
		).Scan(&fromSceneID, &toSceneID, &status, &expiresAt)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
			return
		}
		if err != nil {
			log.Printf("Failed to get chat request: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get chat"})
			return
		}

		// Check user is part of this chat
		if userSceneID != fromSceneID && userSceneID != toSceneID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You are not part of this chat"})
			return
		}

		// Check chat is accepted
		if status != "accepted" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Chat is not active (status: " + status + ")"})
			return
		}

		// Check chat is not expired
		if expiresAt != nil && time.Now().After(*expiresAt) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Chat has expired"})
			return
		}

		// Create message
		message := models.ChatMessage{
			ID:            uuid.New(),
			ChatRequestID: reqUUID,
			FromSceneID:   userSceneID,
			Content:       req.Content,
			CreatedAt:     time.Now(),
		}

		_, err = config.DB.Exec(
			`INSERT INTO chat_messages (id, chat_request_id, from_scene_id, content, created_at)
			 VALUES ($1, $2, $3, $4, $5)`,
			message.ID, message.ChatRequestID, message.FromSceneID, message.Content, message.CreatedAt,
		)

		if err != nil {
			log.Printf("Failed to create chat message: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
			return
		}

		// Send WebSocket notification to other party
		otherSceneID := toSceneID
		if userSceneID == toSceneID {
			otherSceneID = fromSceneID
		}

		wsHub.Targeted <- websocket.TargetedMessage{
			TargetSceneID: otherSceneID,
			Message: websocket.Message{
				Type: "chat.message.received",
				Data: map[string]interface{}{
					"message_id":      message.ID.String(),
					"request_id":      reqUUID.String(),
					"from_scene_id":   message.FromSceneID.String(),
					"content":         message.Content,
					"nonce":           req.Nonce,
					"created_at":      message.CreatedAt.Format(time.RFC3339),
					"target_scene_id": otherSceneID.String(),
				},
			},
		}

		c.JSON(http.StatusCreated, message)
	}
}

// GetChatMessages gets all messages in a chat session
func GetChatMessages(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	requestID := c.Param("request_id")

	reqUUID, err := uuid.Parse(requestID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request_id"})
		return
	}

	// Get user's active scene
	var userSceneID uuid.UUID
	err = config.DB.QueryRow(
		`SELECT s.id FROM scenes s
		 JOIN personas p ON s.persona_id = p.id
		 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
		 ORDER BY s.started_at DESC LIMIT 1`,
		userID,
	).Scan(&userSceneID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No active scene found"})
		return
	}
	if err != nil {
		log.Printf("Failed to get active scene: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
		return
	}

	// Verify user is part of this chat
	var fromSceneID, toSceneID uuid.UUID
	err = config.DB.QueryRow(
		`SELECT from_scene_id, to_scene_id FROM chat_requests WHERE id = $1`,
		reqUUID,
	).Scan(&fromSceneID, &toSceneID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Chat not found"})
		return
	}
	if err != nil {
		log.Printf("Failed to get chat request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get chat"})
		return
	}

	if userSceneID != fromSceneID && userSceneID != toSceneID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You are not part of this chat"})
		return
	}

	// Get messages
	rows, err := config.DB.Query(
		`SELECT id, chat_request_id, from_scene_id, content, created_at
		 FROM chat_messages
		 WHERE chat_request_id = $1
		 ORDER BY created_at ASC`,
		reqUUID,
	)

	if err != nil {
		log.Printf("Failed to get messages: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
		return
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		var msg models.ChatMessage
		err := rows.Scan(&msg.ID, &msg.ChatRequestID, &msg.FromSceneID, &msg.Content, &msg.CreatedAt)
		if err != nil {
			log.Printf("Failed to scan message: %v", err)
			continue
		}
		messages = append(messages, msg)
	}

	if messages == nil {
		messages = []models.ChatMessage{}
	}

	c.JSON(http.StatusOK, messages)
}

// GetActiveChatSessions gets all active chats for user's scene
func GetActiveChatSessions(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	// Get user's active scene
	var userSceneID uuid.UUID
	err := config.DB.QueryRow(
		`SELECT s.id FROM scenes s
		 JOIN personas p ON s.persona_id = p.id
		 WHERE p.user_id = $1 AND s.is_active = true AND s.expires_at > NOW()
		 ORDER BY s.started_at DESC LIMIT 1`,
		userID,
	).Scan(&userSceneID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusOK, []map[string]interface{}{})
		return
	}
	if err != nil {
		log.Printf("Failed to get active scene: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active scene"})
		return
	}

	// Get active chat sessions
	rows, err := config.DB.Query(
		`SELECT cr.id, cr.from_scene_id, cr.to_scene_id, cr.expires_at,
		        p.name as other_persona_name, p.avatar_url as other_persona_avatar,
		        p.description as other_persona_description,
		        cm.content as last_message_content,
		        cm.from_scene_id as last_message_sender_id,
		        cm.created_at as last_message_at
		 FROM chat_requests cr
		 JOIN scenes s ON (CASE WHEN cr.from_scene_id = $1 THEN cr.to_scene_id ELSE cr.from_scene_id END) = s.id
		 JOIN personas p ON s.persona_id = p.id
		 LEFT JOIN LATERAL (
		     SELECT content, from_scene_id, created_at
		     FROM chat_messages
		     WHERE chat_request_id = cr.id
		     ORDER BY created_at DESC
		     LIMIT 1
		 ) cm ON TRUE
		 WHERE (cr.from_scene_id = $1 OR cr.to_scene_id = $1)
		 AND cr.status = 'accepted'
		 AND cr.expires_at > NOW()
		 ORDER BY COALESCE(cm.created_at, cr.accepted_at) DESC`,
		userSceneID,
	)

	if err != nil {
		log.Printf("Failed to get active sessions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get active sessions"})
		return
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var id, fromSceneID, toSceneID uuid.UUID
		var expiresAt time.Time
		var otherPersonaName, otherPersonaAvatar, otherPersonaDescription string
		var lastMsgContent, lastMsgSenderID sql.NullString
		var lastMsgAt sql.NullTime

		err := rows.Scan(
			&id, &fromSceneID, &toSceneID, &expiresAt,
			&otherPersonaName, &otherPersonaAvatar, &otherPersonaDescription,
			&lastMsgContent, &lastMsgSenderID, &lastMsgAt,
		)
		if err != nil {
			log.Printf("Failed to scan session: %v", err)
			continue
		}

		session := map[string]interface{}{
			"request_id":                id.String(),
			"from_scene_id":             fromSceneID.String(),
			"to_scene_id":               toSceneID.String(),
			"expires_at":                expiresAt,
			"other_persona_name":        otherPersonaName,
			"other_persona_avatar":      otherPersonaAvatar,
			"other_persona_description": otherPersonaDescription,
		}

		if lastMsgContent.Valid {
			session["last_message_content"] = lastMsgContent.String
			session["last_message_sender_id"] = lastMsgSenderID.String
			session["last_message_at"] = lastMsgAt.Time
		}

		sessions = append(sessions, session)
	}

	if sessions == nil {
		sessions = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, sessions)
}
