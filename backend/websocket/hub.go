package websocket

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"scene-on/backend/config"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	pingPeriod = (pongWait * 9) / 10 // 54 seconds

	// Maximum message size allowed from peer
	maxMessageSize = 8192 // 8KB
)

type Message struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

type Client struct {
	ID           uuid.UUID
	SceneID      uuid.UUID
	Conn         *websocket.Conn
	Send         chan Message
	Hub          *Hub
	Location     Location
	ConnectedAt  time.Time
	LastActivity time.Time
	mu           sync.RWMutex
}

type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type Hub struct {
	clients      map[uuid.UUID]*Client
	sceneClients map[uuid.UUID]map[uuid.UUID]*Client // SceneID -> ClientID -> Client
	Broadcast    chan BroadcastMessage
	Targeted     chan TargetedMessage
	Register     chan *Client
	Unregister   chan *Client
	mutex        sync.RWMutex
}

type TargetedMessage struct {
	Message       Message
	TargetSceneID uuid.UUID
}

type BroadcastMessage struct {
	Message  Message
	Location *Location // If set, only send to clients within range
	Radius   float64   // Radius in meters
	Exclude  uuid.UUID // Client ID to exclude
}

var Upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: In production, check against allowed origins
		return true
	},
	EnableCompression: true, // Enable per-message compression
}

func NewHub() *Hub {
	return &Hub{
		clients:      make(map[uuid.UUID]*Client),
		sceneClients: make(map[uuid.UUID]map[uuid.UUID]*Client),
		Broadcast:    make(chan BroadcastMessage, 512),  // Increased buffer
		Targeted:     make(chan TargetedMessage, 512),   // Increased buffer
		Register:     make(chan *Client, 32),            // Buffered for bursts
		Unregister:   make(chan *Client, 32),            // Buffered for bursts
	}
}

func (h *Hub) Run() {
	// Use a worker pool pattern for better CPU utilization
	for {
		select {
		case client := <-h.Register:
			h.registerClient(client)

		case client := <-h.Unregister:
			h.unregisterClient(client)

		case targetedMsg := <-h.Targeted:
			h.sendTargeted(targetedMsg)

		case broadcastMsg := <-h.Broadcast:
			h.sendBroadcast(broadcastMsg)
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	
	now := time.Now()
	client.ConnectedAt = now
	client.LastActivity = now
	
	h.clients[client.ID] = client
	if client.SceneID != uuid.Nil {
		if h.sceneClients[client.SceneID] == nil {
			h.sceneClients[client.SceneID] = make(map[uuid.UUID]*Client)
		}
		h.sceneClients[client.SceneID][client.ID] = client
	}
	log.Printf("✓ Client %s (Scene: %s) connected. Total clients: %d", client.ID, client.SceneID, len(h.clients))
}

func (h *Hub) unregisterClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	
	if _, ok := h.clients[client.ID]; ok {
		delete(h.clients, client.ID)
		if client.SceneID != uuid.Nil && h.sceneClients[client.SceneID] != nil {
			delete(h.sceneClients[client.SceneID], client.ID)
			if len(h.sceneClients[client.SceneID]) == 0 {
				delete(h.sceneClients, client.SceneID)
			}
		}
		close(client.Send)
		duration := time.Since(client.ConnectedAt)
		log.Printf("✓ Client %s disconnected. Duration: %v, Remaining: %d", client.ID, duration.Round(time.Second), len(h.clients))
	}
}

func (h *Hub) sendTargeted(targetedMsg TargetedMessage) {
	h.mutex.RLock()
	clients := h.sceneClients[targetedMsg.TargetSceneID]
	h.mutex.RUnlock()
	
	if len(clients) == 0 {
		return
	}
	
	for _, client := range clients {
		select {
		case client.Send <- targetedMsg.Message:
		default:
			// Skip if send buffer is full
		}
	}
}

func (h *Hub) sendBroadcast(broadcastMsg BroadcastMessage) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	for _, client := range h.clients {
		if client.ID == broadcastMsg.Exclude {
			continue
		}

		if broadcastMsg.Location != nil {
			distance := calculateDistance(
				client.Location.Latitude,
				client.Location.Longitude,
				broadcastMsg.Location.Latitude,
				broadcastMsg.Location.Longitude,
			)
			if distance > broadcastMsg.Radius {
				continue
			}
		}

		select {
		case client.Send <- broadcastMsg.Message:
		default:
			// Skip if send buffer is full
		}
	}
}

// BroadcastToNearby sends a message to all scenes within a geographic radius using PostGIS.
// This is much more efficient than the in-memory distance calculations in sendBroadcast.
func (h *Hub) BroadcastToNearby(msg Message, lat, lon, radiusMeters float64, excludeSceneID uuid.UUID) {
	log.Printf("🌍 BroadcastToNearby called: type=%s, lat=%.6f, lon=%.6f, radius=%.0fm, exclude=%s", 
		msg.Type, lat, lon, radiusMeters, excludeSceneID)
	
	// Query PostGIS for nearby active scenes
	rows, err := config.DB.Query(`
		SELECT DISTINCT s.id 
		FROM scenes s
		WHERE s.is_active = true 
		  AND s.expires_at > NOW()
		  AND s.id != $1
		  AND ST_DWithin(
		      ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
		      ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
		      $4
		  )`,
		excludeSceneID, lon, lat, radiusMeters,
	)
	if err != nil {
		log.Printf("❌ Failed to query nearby scenes: %v", err)
		return
	}
	defer rows.Close()
	
	// Send targeted messages to each nearby scene
	sceneCount := 0
	for rows.Next() {
		var sceneID uuid.UUID
		if err := rows.Scan(&sceneID); err == nil {
			sceneCount++
			log.Printf("📤 Sending %s to scene %s", msg.Type, sceneID)
			// Use the existing Targeted channel for delivery
			h.Targeted <- TargetedMessage{
				TargetSceneID: sceneID,
				Message:       msg,
			}
		}
	}
	
	if err := rows.Err(); err != nil {
		log.Printf("❌ Error iterating nearby scenes: %v", err)
	}
	
	log.Printf("✅ BroadcastToNearby completed: sent to %d scenes", sceneCount)
}


func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		c.updateActivity()
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure, websocket.CloseNormalClosure) {
				log.Printf("❌ WebSocket read error (Client %s): %v", c.ID, err)
			}
			break
		}

		c.updateActivity()

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("❌ JSON unmarshal error (Client %s): %v", c.ID, err)
			continue
		}

		// Handle different message types
		switch msg.Type {
		case "ping":
			select {
			case c.Send <- Message{Type: "pong", Data: map[string]interface{}{"timestamp": time.Now().Unix()}}:
			default:
				log.Printf("⚠️ Failed to send pong to client %s (buffer full)", c.ID)
			}
		case "location_update":
			if lat, ok := msg.Data["latitude"].(float64); ok {
				if lon, ok := msg.Data["longitude"].(float64); ok {
					c.mu.Lock()
					c.Location = Location{Latitude: lat, Longitude: lon}
					c.mu.Unlock()
				}
			}
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.Conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
				return
			}

			data, err := json.Marshal(message)
			if err != nil {
				log.Printf("❌ JSON marshal error (Client %s): %v", c.ID, err)
				continue
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(data)

			if err := w.Close(); err != nil {
				return
			}

			c.updateActivity()

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("⚠️ Failed to send ping to client %s: %v", c.ID, err)
				return
			}
		}
	}
}

// updateActivity updates the last activity timestamp
func (c *Client) updateActivity() {
	c.mu.Lock()
	c.LastActivity = time.Now()
	c.mu.Unlock()
}

// GetStats returns connection statistics
func (c *Client) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return map[string]interface{}{
		"client_id":     c.ID.String(),
		"scene_id":      c.SceneID.String(),
		"connected_at":  c.ConnectedAt.Unix(),
		"last_activity": c.LastActivity.Unix(),
		"uptime":        time.Since(c.ConnectedAt).Seconds(),
	}
}

// GetStats returns hub statistics
func (h *Hub) GetStats() map[string]interface{} {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	return map[string]interface{}{
		"total_clients":       len(h.clients),
		"total_scenes":        len(h.sceneClients),
		"broadcast_queue":     len(h.Broadcast),
		"targeted_queue":      len(h.Targeted),
		"register_queue":      len(h.Register),
		"unregister_queue":    len(h.Unregister),
	}
}

// GetClientsByScene returns the number of clients in a specific scene
func (h *Hub) GetClientsByScene(sceneID uuid.UUID) int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	if clients, ok := h.sceneClients[sceneID]; ok {
		return len(clients)
	}
	return 0
}

// Haversine formula to calculate distance between two coordinates
func calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000 // meters

	rad := func(deg float64) float64 {
		return deg * (3.14159265359 / 180)
	}

	dLat := rad(lat2 - lat1)
	dLon := rad(lon2 - lon1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rad(lat1))*math.Cos(rad(lat2))*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}
