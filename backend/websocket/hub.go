package websocket

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Message struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

type Client struct {
	ID        uuid.UUID
	SceneID   uuid.UUID
	Conn      *websocket.Conn
	Send      chan Message
	Hub       *Hub
	Location  Location
	closeChan chan struct{}
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
	ReadBufferSize:  2048,  // Increased for better performance
	WriteBufferSize: 2048,  // Increased for better performance
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: Implement proper origin checking
	},
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
	
	h.clients[client.ID] = client
	if client.SceneID != uuid.Nil {
		if h.sceneClients[client.SceneID] == nil {
			h.sceneClients[client.SceneID] = make(map[uuid.UUID]*Client)
		}
		h.sceneClients[client.SceneID][client.ID] = client
	}
	log.Printf("Client %s (Scene: %s) connected", client.ID, client.SceneID)
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
	}
	log.Printf("Client %s disconnected", client.ID)
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

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("JSON unmarshal error: %v", err)
			continue
		}

		// Handle different message types
		switch msg.Type {
		case "ping":
			c.Send <- Message{Type: "pong", Data: map[string]interface{}{}}
		case "location_update":
			if lat, ok := msg.Data["latitude"].(float64); ok {
				if lon, ok := msg.Data["longitude"].(float64); ok {
					c.Location = Location{Latitude: lat, Longitude: lon}
				}
			}
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			data, err := json.Marshal(message)
			if err != nil {
				log.Printf("JSON marshal error: %v", err)
				continue
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
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
