package handlers

import (
	"net/http"
	"scene-on/backend/config"
	"scene-on/backend/middleware"
	"scene-on/backend/models"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UpdateLocationRequest struct {
	Latitude  float64  `json:"latitude" binding:"required"`
	Longitude float64  `json:"longitude" binding:"required"`
	Accuracy  *float64 `json:"accuracy"`
}

// UpdateUserLocation updates the user's current location
func UpdateUserLocation(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var req UpdateLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now().UTC()

	// Update user's last location
	_, err := config.DB.Exec(
		`UPDATE users 
		 SET last_latitude = $1, last_longitude = $2, last_location_updated_at = $3, updated_at = $3
		 WHERE id = $4`,
		req.Latitude, req.Longitude, now, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update location"})
		return
	}

	// Store location history
	location := models.UserLocation{
		ID:        uuid.New(),
		UserID:    userID,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Accuracy:  req.Accuracy,
		CreatedAt: now,
	}

	_, err = config.DB.Exec(
		`INSERT INTO user_locations (id, user_id, latitude, longitude, accuracy, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		location.ID, location.UserID, location.Latitude, location.Longitude,
		location.Accuracy, location.CreatedAt,
	)
	if err != nil {
		// Non-critical error, location history is optional
		c.JSON(http.StatusOK, gin.H{
			"message": "Location updated (history failed)",
			"location": gin.H{
				"latitude":  req.Latitude,
				"longitude": req.Longitude,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Location updated successfully",
		"location": gin.H{
			"latitude":  req.Latitude,
			"longitude": req.Longitude,
			"accuracy":  req.Accuracy,
		},
	})
}

// GetUserLocation retrieves the user's last known location
func GetUserLocation(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)

	var user models.User
	err := config.DB.QueryRow(
		`SELECT id, email, last_latitude, last_longitude, last_location_updated_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.LastLatitude, &user.LastLongitude, &user.LastLocationUpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get location"})
		return
	}

	if user.LastLatitude == nil || user.LastLongitude == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No location data available"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"latitude":   *user.LastLatitude,
		"longitude":  *user.LastLongitude,
		"updated_at": user.LastLocationUpdatedAt,
	})
}
