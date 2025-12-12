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
	clients    map[uuid.UUID]*Client
	broadcast  chan BroadcastMessage
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

type BroadcastMessage struct {
	Message  Message
	Location *Location // If set, only send to clients within range
	Radius   float64   // Radius in meters
	Exclude  uuid.UUID // Client ID to exclude
}

var Upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: Implement proper origin checking
	},
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[uuid.UUID]*Client),
		broadcast:  make(chan BroadcastMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client.ID] = client
			h.mutex.Unlock()
			log.Printf("Client %s connected", client.ID)

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
			}
			h.mutex.Unlock()
			log.Printf("Client %s disconnected", client.ID)

		case broadcastMsg := <-h.broadcast:
			h.mutex.RLock()
			for _, client := range h.clients {
				// Skip excluded client
				if client.ID == broadcastMsg.Exclude {
					continue
				}

				// If location-based broadcast, check distance
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
					// Client send buffer full, disconnect
					close(client.Send)
					delete(h.clients, client.ID)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
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
