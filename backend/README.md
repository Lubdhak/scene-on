# Scene-On Backend

A Go backend API built with the Gin framework for the Scene-On application.

## Tech Stack

- **Go** 1.21+
- **Gin** - HTTP web framework
- **CORS** - Cross-Origin Resource Sharing middleware

## Project Structure

```
backend/
├── main.go           # Application entry point
├── go.mod            # Go module dependencies
├── handlers/         # Request handlers
│   └── ping.go       # Example ping handler
├── routes/           # Route definitions
│   └── routes.go     # API routes setup
└── models/           # Data models (to be added)
```

## Getting Started

### Prerequisites

- Go 1.21 or higher installed
- Git

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Download dependencies:
   ```bash
   go mod download
   ```

3. Run the server:
   ```bash
   go run main.go
   ```

The server will start on `http://localhost:8080`

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

- `GET /health` - Health check endpoint
- `GET /api/v1/ping` - Test endpoint that returns "pong"

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
