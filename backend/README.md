# Scene-On Backend

A Go backend API built with the Gin framework for the Scene-On application with real Google OAuth 2.0 authentication.

## Tech Stack

- **Go** 1.21+
- **Gin** - HTTP web framework
- **CORS** - Cross-Origin Resource Sharing middleware
- **PostgreSQL** - Database
- **JWT** - JSON Web Tokens for authentication
- **Google OAuth 2.0** - User authentication
- **WebSockets** - Real-time communication

## Project Structure

```
backend/
├── main.go              # Application entry point
├── go.mod               # Go module dependencies
├── .env.example         # Example environment variables
├── config/              # Configuration
│   └── database.go      # Database configuration
├── handlers/            # Request handlers
│   ├── auth.go          # Authentication (Google OAuth)
│   ├── chat.go          # Chat functionality
│   ├── location.go      # Location tracking
│   ├── personas.go      # User personas
│   └── scenes.go        # Scene management
├── middleware/          # Middleware
│   └── auth.go          # JWT authentication middleware
├── models/              # Data models
│   └── models.go        # Database models
├── routes/              # Route definitions
│   └── routes.go        # API routes setup
└── websocket/           # WebSocket handlers
    └── hub.go           # WebSocket hub
```

## Getting Started

### Prerequisites

- Go 1.21 or higher installed
- PostgreSQL database
- Google Cloud Console account (for OAuth credentials)
- Git

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. **Set up Google OAuth** (Required):
   Follow the detailed guide in [docs/GOOGLE_OAUTH_SETUP.md](../docs/GOOGLE_OAUTH_SETUP.md)
   
   Quick summary:
   - Create a project in Google Cloud Console
   - Enable Google+ API
   - Create OAuth credentials
   - Add `http://localhost:8080/api/v1/auth/google/callback` as redirect URI
   - Copy Client ID and Client Secret to your `.env` file

4. Configure your `.env` file with:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=scene_on
   
   # JWT
   JWT_SECRET=your-secret-key
   
   # Google OAuth (get from Google Cloud Console)
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URL=http://localhost:8080/api/v1/auth/google/callback
   
   # Frontend
   FRONTEND_URL=http://localhost:5173
   ```

5. Download dependencies:
   ```bash
   go mod download
   ```

6. Run the server:
   ```bash
   go run main.go
   ```

The server will start on `http://localhost:8080`

## Authentication

Scene-On now uses **real Google OAuth 2.0** for authentication (the dummy login has been deprecated).

### Authentication Flow

1. Frontend requests OAuth URL: `GET /api/v1/auth/google/login`
2. Backend returns Google consent screen URL
3. User is redirected to Google to authorize
4. Google redirects back to: `/api/v1/auth/google/callback`
5. Backend exchanges code for user info
6. Backend creates/retrieves user and generates JWT
7. Backend redirects to frontend with JWT token
8. Frontend stores JWT and uses for authenticated requests

### Authenticated Endpoints

All protected endpoints require the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

## Makefile Commands

The project includes a Makefile for common development tasks:

```bash
make help          # Show all available commands
make install       # Install dependencies
make build         # Build the application binary
make run           # Run the application
make dev           # Run with auto-reload (requires air)
make test          # Run tests
make test-coverage # Run tests with coverage report
make lint          # Run linter (requires golangci-lint)
make fmt           # Format code
make vet           # Run go vet
make tidy          # Tidy dependencies
make clean         # Clean build artifacts
make docker-build  # Build Docker image
make docker-run    # Run Docker container
make all           # Run all checks and build
```

### Available Endpoints

#### Public Endpoints

- `GET /health` - Health check endpoint

#### Authentication Endpoints

- `GET /api/v1/auth/google/login` - Initiate Google OAuth flow
- `GET /api/v1/auth/google/callback` - Google OAuth callback (handled by redirect)
- `POST /api/v1/auth/google/dummy` - Deprecated dummy login (for migration only)
- `POST /api/v1/auth/send-otp` - Send OTP email (alternative auth)
- `POST /api/v1/auth/verify-otp` - Verify OTP code

#### Protected Endpoints (Require JWT)

**Personas**
- `GET /api/v1/personas` - Get user personas
- `POST /api/v1/personas` - Create/get persona

**Scenes**
- `POST /api/v1/scenes/start` - Start a scene
- `POST /api/v1/scenes/stop` - Stop active scene
- `GET /api/v1/scenes/active` - Get user's active scene
- `GET /api/v1/scenes/nearby` - Get nearby active scenes

**Chat**
- `POST /api/v1/chat/requests` - Send chat request
- `GET /api/v1/chat/requests/inbox` - Get received requests
- `GET /api/v1/chat/requests/sent` - Get sent requests
- `POST /api/v1/chat/requests/:id/accept` - Accept chat request
- `POST /api/v1/chat/requests/:id/reject` - Reject chat request
- `POST /api/v1/chat/messages` - Send chat message
- `GET /api/v1/chat/messages/:request_id` - Get chat history

**Location**
- `POST /api/v1/location/update` - Update user location
- `GET /api/v1/location/current` - Get current location

**WebSocket**
- `GET /ws?scene_id=<uuid>` - WebSocket connection for real-time updates

## Development

### Running in Development Mode

Using Makefile (recommended):
```bash
make run
```

Or directly with Go:
```bash
go run main.go
```

For auto-reload during development (install [air](https://github.com/cosmtrek/air) first):
```bash
make dev
```

### Building for Production

Using Makefile:
```bash
make build
./bin/scene-on-api
```

Or directly with Go:
```bash
go build -o scene-on-api main.go
./scene-on-api
```

### Adding New Routes

1. Create a new handler in `handlers/` directory
2. Register the route in `routes/routes.go`

Example:
```go
// handlers/example.go
package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func ExampleHandler(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "example"})
}

// routes/routes.go
v1.GET("/example", handlers.ExampleHandler)
```

## Configuration

The server is configured to:
- Run on port 8080
- Accept CORS requests from `http://localhost:5173` and `http://localhost:3000`
- Use Gin's default middleware (Logger and Recovery)

To modify these settings, edit `main.go`.

## API Versioning

All API routes are versioned under `/api/v1/`. This allows for future API versions without breaking existing clients.

## License

MIT
