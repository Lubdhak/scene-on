package main

import (
	"log"
	"net/http"
	"os"
	"scene-on/backend/config"
	"scene-on/backend/handlers"
	"scene-on/backend/routes"
	"scene-on/backend/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var wsHub *websocket.Hub

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	// Initialize database
	if err := config.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer config.CloseDatabase()

	// Initialize Google OAuth
	handlers.InitGoogleOAuth()

	// Cleanup stale scenes on boot
	handlers.CleanupActiveScenes()

	// Initialize WebSocket hub
	wsHub = websocket.NewHub()
	go wsHub.Run()

	// Start chat cleanup worker
	go handlers.StartChatCleanupWorker(wsHub)

	// Set Gin mode
	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = "debug"
	}
	gin.SetMode(ginMode)

	router := gin.Default()

	// Configure CORS
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{
		"http://localhost:5173",
		"http://localhost:3000",
		"http://localhost:4200",
		"http://localhost:8081", // Web frontend
		// Add your production frontend URL here
	}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	corsConfig.AllowCredentials = true
	router.Use(cors.New(corsConfig))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "Scene-On API is running",
		})
	})

	// Setup routes
	routes.SetupRoutes(router, wsHub)

	// Start server
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
