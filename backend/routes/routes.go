package routes

import (
	"scene-on/backend/handlers"
	"scene-on/backend/middleware"
	"scene-on/backend/websocket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SetupRoutes configures all application routes
func SetupRoutes(router *gin.Engine, wsHub *websocket.Hub) {
	// WebSocket endpoint
	router.GET("/ws", func(c *gin.Context) {
		// TODO: Extract user/scene info from token
		conn, err := websocket.Upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}

		client := &websocket.Client{
			ID:   uuid.New(),
			Conn: conn,
			Send: make(chan websocket.Message, 256),
			Hub:  wsHub,
		}

		wsHub.Register <- client

		go client.WritePump()
		go client.ReadPump()
	})

	// API v1 group
	v1 := router.Group("/api/v1")
	{
		// Public auth routes
		auth := v1.Group("/auth")
		{
			auth.POST("/send-otp", handlers.SendOTP)
			auth.POST("/verify-otp", handlers.VerifyOTP)
			// Dummy Google login for development
			auth.POST("/google/dummy", handlers.DummyGoogleLogin)
		}

		// Protected routes (require authentication)
		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// Location
			location := protected.Group("/location")
			{
				location.POST("/update", handlers.UpdateUserLocation)
				location.GET("/current", handlers.GetUserLocation)
			}

			// Personas
			personas := protected.Group("/personas")
			{
				personas.GET("", handlers.Ping) // TODO: Implement
				personas.POST("", handlers.Ping) // TODO: Implement
			}

			// Scenes
			scenes := protected.Group("/scenes")
			{
				scenes.POST("/start", handlers.StartScene(wsHub))
				scenes.POST("/stop", handlers.StopScene(wsHub))
				scenes.GET("/nearby", handlers.GetNearbyScenes)
			}

			// Yells
			yells := protected.Group("/yells")
			{
				yells.POST("", handlers.Ping) // TODO: Implement
				yells.GET("/nearby", handlers.Ping) // TODO: Implement
			}

			// Chat
			chat := protected.Group("/chat")
			{
				chat.POST("/requests", handlers.Ping) // TODO: Implement
				chat.GET("/requests/inbox", handlers.Ping) // TODO: Implement
			}
		}
	}
}
