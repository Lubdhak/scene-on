package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Ping is a simple handler to test the API
func Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "pong",
	})
}
