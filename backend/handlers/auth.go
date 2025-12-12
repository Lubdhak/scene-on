package handlers

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"scene-on/backend/config"
	"scene-on/backend/middleware"
	"scene-on/backend/models"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type SendOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type VerifyOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

type TokenResponse struct {
	AccessToken string `json:"access_token"`
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
}

//Send OTP sends a 6-digit code to the provided email
func SendOTP(c *gin.Context) {
	var req SendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate 6-digit OTP
	code := generateOTP()

	// Store OTP in database (expires in 15 minutes)
	expiresAt := time.Now().Add(15 * time.Minute)
	
	_, err := config.DB.Exec(
		`INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)`,
		req.Email, code, expiresAt,
	)
	if err != nil {
		log.Printf("Failed to store OTP: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send OTP"})
		return
	}

	// TODO: Send email with OTP code using SMTP
	// For now, just log it (in production, send actual email)
	log.Printf("OTP for %s: %s", req.Email, code)

	c.JSON(http.StatusOK, gin.H{
		"message": "OTP sent successfully",
		"email":   req.Email,
		// In development, include the code. Remove in production!
		"code": code,
	})
}

// VerifyOTP verifies the OTP and returns JWT token
func VerifyOTP(c *gin.Context) {
	var req VerifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify OTP from database
	var otpID uuid.UUID
	var expiresAt time.Time
	
	err := config.DB.QueryRow(
		`SELECT id, expires_at FROM otp_codes 
		 WHERE email = $1 AND code = $2 AND expires_at > NOW()
		 ORDER BY created_at DESC LIMIT 1`,
		req.Email, req.Code,
	).Scan(&otpID, &expiresAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OTP"})
		return
	}
	if err != nil {
		log.Printf("Failed to verify OTP: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify OTP"})
		return
	}

	// Delete used OTP
	config.DB.Exec(`DELETE FROM otp_codes WHERE id = $1`, otpID)

	// Get or create user
	var user models.User
	err = config.DB.QueryRow(
		`SELECT id, email, created_at, updated_at FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// Create new user
		user.ID = uuid.New()
		user.Email = req.Email
		user.CreatedAt = time.Now()
		user.UpdatedAt = time.Now()

		_, err = config.DB.Exec(
			`INSERT INTO users (id, email, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
			user.ID, user.Email, user.CreatedAt, user.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to create user: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}
	} else if err != nil {
		log.Printf("Failed to get user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	// Generate JWT token
	token, err := generateJWT(user.ID, user.Email)
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, TokenResponse{
		AccessToken: token,
		UserID:      user.ID.String(),
		Email:       user.Email,
	})
}

func generateOTP() string {
	max := big.NewInt(1000000)
	n, _ := rand.Int(rand.Reader, max)
	return fmt.Sprintf("%06d", n.Int64())
}

func generateJWT(userID uuid.UUID, email string) (string, error) {
	expiryDuration := 24 * time.Hour // Default 24 hours
	claims := middleware.Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiryDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}
