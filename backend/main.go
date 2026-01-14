package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"scene-on/backend/config"
	"scene-on/backend/handlers"
	"scene-on/backend/routes"
	"scene-on/backend/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var wsHub *websocket.Hub

func mustEnv(key string) string {
	val := os.Getenv(key)
	if val == "" {
		log.Fatalf("Missing required environment variable: %s", key)
	}
	return val
}

func main() {
	// Load .env ONLY for local development
	if os.Getenv("RENDER") == "" {
		if err := godotenv.Load(); err != nil {
			log.Println("⚠️  Warning: .env file not found, using system environment variables")
		} else {
			log.Println("📄 Loaded .env file successfully")
		}
	} else {
		log.Println("☁️  Running in RENDER environment (using system env vars)")
	}

	// ---- REQUIRED ENV CHECKS ----
	mustEnv("DATABASE_URL")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ---- DATABASE ----
	if err := config.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer config.CloseDatabase()

	// ---- OAUTH ----
	handlers.InitGoogleOAuth()

	// ---- CLEANUP ----
	handlers.CleanupActiveScenes()

	// ---- WEBSOCKETS ----
	wsHub = websocket.NewHub()
	go wsHub.Run()

	go handlers.StartChatCleanupWorker(wsHub)

	// ---- GIN MODE ----
	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = gin.ReleaseMode
	}
	gin.SetMode(ginMode)

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	// ---- CORS ----
	corsConfig := cors.Config{
		AllowOriginFunc: func(origin string) bool {
			// Allow localhost for dev (any port)
			if strings.HasPrefix(origin, "http://localhost") || strings.HasPrefix(origin, "http://127.0.0.1") {
				return true
			}
			// Allow anything ending with .vercel.app
			if strings.HasSuffix(origin, ".vercel.app") {
				return true
			}
			log.Printf("⛔ CORS blocked origin: %s", origin)
			return false
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
	}
	router.Use(cors.New(corsConfig))

	// ---- HEALTH CHECK ----
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})

	// ---- ROUTES ----
	routes.SetupRoutes(router, wsHub)

	// ---- START SERVER ----
	log.Printf("🚀 Scene-On API running on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
