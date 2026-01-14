package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
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
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var googleOAuthConfig *oauth2.Config

// InitGoogleOAuth initializes the Google OAuth configuration
func InitGoogleOAuth() {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	
	if clientID == "" || clientSecret == "" || redirectURL == "" {
		log.Println("⚠️  WARNING: Google OAuth environment variables not fully configured")
		log.Printf("   GOOGLE_CLIENT_ID: %s", map[bool]string{true: "SET", false: "MISSING"}[clientID != ""])
		log.Printf("   GOOGLE_CLIENT_SECRET: %s", map[bool]string{true: "SET", false: "MISSING"}[clientSecret != ""])
		log.Printf("   GOOGLE_REDIRECT_URL: %s", map[bool]string{true: "SET", false: "MISSING"}[redirectURL != ""])
		return
	}
	
	googleOAuthConfig = &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
	
	log.Println("✓ Google OAuth initialized successfully")
	log.Printf("   Redirect URL: %s", redirectURL)
}

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

type GoogleUserInfo struct {
	Email         string `json:"email"`
	VerifiedEmail bool   `json:"verified_email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
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
	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	
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

// GoogleLogin initiates the Google OAuth flow
func GoogleLogin(c *gin.Context) {
	// Check if OAuth config is initialized
	if googleOAuthConfig == nil {
		log.Println("ERROR: Google OAuth config not initialized")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OAuth not configured"})
		return
	}
	
	// Verify required config
	if googleOAuthConfig.ClientID == "" || googleOAuthConfig.ClientSecret == "" {
		log.Println("ERROR: Google OAuth credentials missing")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OAuth credentials not configured"})
		return
	}
	
	// Generate a random state token for CSRF protection
	state := uuid.New().String()
	
	// Store state in session or temporary storage (here we'll pass it through)
	// In production, store in Redis or session with expiry
	url := googleOAuthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	
	log.Printf("Generated OAuth URL for client, state: %s", state)
	
	c.JSON(http.StatusOK, gin.H{
		"url":   url,
		"state": state,
	})
}

// GoogleCallback handles the OAuth callback from Google
func GoogleCallback(c *gin.Context) {
	// Get the authorization code from query params
	code := c.Query("code")
	state := c.Query("state")
	
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing authorization code"})
		return
	}
	
	// TODO: Verify state token to prevent CSRF
	// In production, validate state against stored session
	if state == "" {
		log.Println("Warning: State token not provided")
	}
	
	// Exchange the authorization code for an access token
	ctx := context.Background()
	token, err := googleOAuthConfig.Exchange(ctx, code)
	if err != nil {
		log.Printf("Failed to exchange token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange authorization code"})
		return
	}
	
	// Fetch user info from Google
	client := googleOAuthConfig.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		log.Printf("Failed to get user info: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}
	defer resp.Body.Close()
	
	var googleUser GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		log.Printf("Failed to decode user info: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode user info"})
		return
	}
	
	// Verify email is verified
	if !googleUser.VerifiedEmail {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email not verified with Google"})
		return
	}
	
	// Get or create user in database
	var user models.User
	err = config.DB.QueryRow(
		`SELECT id, email, created_at, updated_at FROM users WHERE email = $1`,
		googleUser.Email,
	).Scan(&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// Create new user
		user.ID = uuid.New()
		user.Email = googleUser.Email
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

		log.Printf("✓ New user created via Google OAuth: %s", user.Email)
	} else if err != nil {
		log.Printf("Failed to get user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	// Generate JWT token
	jwtToken, err := generateJWT(user.ID, user.Email)
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Redirect to frontend with token
	// Build redirect URL with token as query parameter
	frontendURL := os.Getenv("FRONTEND_URL")
	// if frontendURL == "" {
	// 	frontendURL = "http://localhost:5173"
	// }
	
	redirectURL := fmt.Sprintf("%s/auth/callback?token=%s&user_id=%s&email=%s", 
		frontendURL, jwtToken, user.ID.String(), user.Email)
	
	c.Redirect(http.StatusFound, redirectURL)
}

// DummyGoogleLogin - DEPRECATED: Use real Google OAuth instead
// Kept temporarily for backward compatibility during migration
func DummyGoogleLogin(c *gin.Context) {
	log.Println("⚠️  WARNING: Using deprecated dummy Google login. Please migrate to real OAuth.")
	
	type DummyGoogleLoginRequest struct {
		Email string `json:"email" binding:"required,email"`
		Name  string `json:"name" binding:"required"`
	}
	
	var req DummyGoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get or create user
	var user models.User
	err := config.DB.QueryRow(
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

		log.Printf("✓ New user created via Google login: %s", user.Email)
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
